/**
 * File upload middleware.
 *
 * Purpose: accept image, audio, video and game-archive uploads safely — unique
 *          filenames, verified types, bounded size, nothing left behind by an
 *          upload that never finishes — and route each entity's files to its
 *          own directory.
 * Inputs:  multipart/form-data requests
 * Outputs: multer middleware; sets req.file / req.files
 * Deps:    multer, config/env, utils/ApiError
 *
 * Legacy behaviour: uploads were written as `assets/<entity>/<row id>.jpg`, so
 * re-uploading a poster silently OVERWROTE the previous file and the filename
 * leaked the database id. CLAUDE.md requires unique generated filenames and no
 * overwriting, so each upload gets a random name and the path is stored on the
 * document instead of being derived from its id.
 */
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import crypto from 'node:crypto';
import multer from 'multer';
import env from '../config/env.js';
import ApiError from '../utils/ApiError.js';
import { SOURCE_VIDEO_EXTENSIONS } from '../config/constants.js';

/** Subdirectory per entity, mirroring the legacy assets/ layout. */
export const UPLOAD_DIRS = Object.freeze({
  movies: 'movies',
  musics: 'musics',
  casts: 'casts',
  banners: 'banners',
  users: 'users',
  /** Pre-roll creatives and landing-page slot artwork. legacy: assets/ads/. */
  ads: 'ads',
  /**
   * Fallback artwork, one image per slot. The legacy equivalents shipped with
   * the theme under src/images/ and were not uploadable at all.
   */
  placeholders: 'placeholders',
  /**
   * The customer logo shown in the passenger site's footer. Its own directory
   * rather than sharing one: it is a single file for the whole installation,
   * and keeping it apart makes obvious what a redeploy must preserve.
   */
  branding: 'branding',
  /**
   * Unpacked HTML5 game bundles, one directory per upload. Unlike every other
   * entry here, multer never writes to it: the ZIP lands in the system temp
   * directory and services/gameBundle.service.js unpacks it into place.
   */
  games: 'games',
});

const IMAGE_MIME_TYPES = Object.freeze({
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
});

const AUDIO_MIME_TYPES = Object.freeze({
  'audio/mpeg': '.mp3',
  'audio/mp3': '.mp3',
  'audio/wav': '.wav',
  'audio/ogg': '.ogg',
});

/**
 * Video types accepted for pre-roll creatives.
 *
 * The legacy ads were all MP4 (`type="video/mp4"` in every VAST file); WebM is
 * added because every browser this frontend targets plays it and it is
 * materially smaller over a cabin link.
 */
const VIDEO_MIME_TYPES = Object.freeze({
  'video/mp4': '.mp4',
  'video/webm': '.webm',
});

/**
 * Types a browser puts on a `.csv`, which is very nearly anything.
 *
 * Windows reports `application/vnd.ms-excel` whenever Excel is installed, and
 * some file managers fall back to `application/octet-stream`, so the MIME type
 * cannot be the check here — the extension is, and the content is parsed
 * strictly afterwards. Nothing is written to disk either way.
 */
const CSV_MIME_TYPES = Object.freeze([
  'text/csv',
  'application/csv',
  'text/plain',
  'text/comma-separated-values',
  'application/vnd.ms-excel',
  'application/octet-stream',
]);

function ensureDir(absolutePath) {
  fs.mkdirSync(absolutePath, { recursive: true });
}

/**
 * Random, collision-resistant filename. The extension comes from the verified
 * MIME type, never from the client-supplied name — otherwise `evil.php.jpg`
 * style tricks depend on how the static server is configured.
 */
function generateFilename(extension) {
  return `${Date.now()}-${crypto.randomBytes(12).toString('hex')}${extension}`;
}

/* ------------------------------------------------------- storage engine --- */

/**
 * Writes still in progress, per request, with ONE `close` listener per request
 * however many files it carries — a thirty-track upload must not hang thirty
 * listeners on the same object.
 */
const writesInProgress = new WeakMap();

/** True when the connection went away before the whole body had arrived. */
const wasAbandoned = (req) => req.destroyed && !req.complete;

function trackWrites(req) {
  let active = writesInProgress.get(req);
  if (active) return active;

  active = new Set();
  writesInProgress.set(req, active);

  // `close` also fires after an ordinary, complete request. `complete` is what
  // tells the two apart: it is only true once the whole body has been read.
  req.once('close', () => {
    if (req.complete) return;
    for (const abandon of [...active]) abandon();
  });

  return active;
}

/**
 * A disk storage engine that cleans up after an upload that never finishes.
 *
 * WHY NOT `multer.diskStorage`. It writes the incoming file and reports back
 * when the write FINISHES — and when a browser gives up half-way (a closed tab,
 * a dropped connection, a client-side timeout) the write never finishes, so
 * nothing is reported, multer never learns the file's name, and the partial
 * file stays on disk for good with its stream still open. Under `uploads/` that
 * is a publicly served fragment of a film that no record points at. Measured
 * before this existed: every upload route left one, and the audio route left
 * the complete tracks that preceded the cut one as well.
 *
 * This engine does the same job and keeps hold of the stream, so when the
 * request closes before its body is complete it can stop the write, delete the
 * file, and tell multer the upload failed — at which point multer removes the
 * files it HAD finished for that request, through `_removeFile` below. An
 * abandoned upload therefore leaves nothing, whatever it had got through.
 *
 * What it cannot cover is the process itself dying mid-upload: there is nobody
 * left to clean up. The game-archive directory has a sweep for that
 * (`sweepStaleGameZips`); `uploads/` does not.
 *
 * @param {(req: import('express').Request, file: object) => {directory: string, filename: string}} resolveTarget
 *        where this file goes; may throw
 * @returns {import('multer').StorageEngine}
 */
function abortSafeStorage(resolveTarget) {
  return {
    _handleFile(req, file, callback) {
      let target;
      try {
        const { directory, filename } = resolveTarget(req, file);
        ensureDir(directory);
        target = { directory, filename, path: path.join(directory, filename) };
      } catch (error) {
        return callback(error);
      }

      const output = fs.createWriteStream(target.path);
      const active = trackWrites(req);
      let settled = false;

      const fail = (error) => {
        if (settled) return;
        settled = true;
        active.delete(abandon);

        // Keep the part flowing to nowhere, so the parser is not left holding
        // data for a stream nobody reads; then release the file and remove it.
        file.stream.unpipe(output);
        file.stream.resume();
        output.destroy();
        fs.unlink(target.path, () => callback(error));
      };

      function abandon() {
        fail(ApiError.badRequest('The upload was interrupted before it finished'));
      }

      active.add(abandon);

      // The connection can already be gone by the time a buffered part is
      // handed over, in which case the `close` listener has had its one turn.
      if (wasAbandoned(req)) return abandon();

      file.stream.once('error', fail);
      output.once('error', fail);
      output.once('finish', () => {
        if (settled) return;
        settled = true;
        active.delete(abandon);
        callback(null, {
          destination: target.directory,
          filename: target.filename,
          path: target.path,
          size: output.bytesWritten,
        });
      });

      return file.stream.pipe(output);
    },

    /** Called by multer for each finished file when a request fails later on. */
    _removeFile(_req, file, callback) {
      const stored = file.path;
      delete file.destination;
      delete file.filename;
      delete file.path;
      fs.unlink(stored, callback);
    },
  };
}

/** Storage for one entity's media, under `uploads/<subdirectory>/`. */
function buildStorage(subdirectory) {
  return abortSafeStorage((_req, file) => {
    const extension =
      IMAGE_MIME_TYPES[file.mimetype] ??
      AUDIO_MIME_TYPES[file.mimetype] ??
      VIDEO_MIME_TYPES[file.mimetype] ??
      '';

    return {
      directory: path.resolve(env.uploadPath, subdirectory),
      filename: generateFilename(extension),
    };
  });
}

/** Rejects anything whose MIME type and extension don't both check out. */
function buildFileFilter(allowedTypes) {
  return (_req, file, callback) => {
    const expectedExtension = allowedTypes[file.mimetype];

    if (!expectedExtension) {
      return callback(
        ApiError.badRequest(
          `Unsupported file type "${file.mimetype}". Allowed: ${Object.keys(allowedTypes).join(', ')}`,
        ),
      );
    }

    // Belt and braces: the declared MIME type must be consistent with the
    // original extension too.
    const originalExtension = path.extname(file.originalname).toLowerCase();
    const consistent =
      originalExtension === expectedExtension ||
      (expectedExtension === '.jpg' && originalExtension === '.jpeg') ||
      (expectedExtension === '.mp3' && originalExtension === '.mpeg');

    if (originalExtension && !consistent) {
      return callback(
        ApiError.badRequest(`File extension "${originalExtension}" does not match type "${file.mimetype}"`),
      );
    }

    return callback(null, true);
  };
}

const sizeLimit = env.maxUploadSizeMb * 1024 * 1024;

/** Single image upload into the given entity directory. */
export const uploadImage = (subdirectory, field = 'file') =>
  multer({
    storage: buildStorage(subdirectory),
    fileFilter: buildFileFilter(IMAGE_MIME_TYPES),
    limits: { fileSize: sizeLimit, files: 1 },
  }).single(field);

/** Multiple audio files, used by the music track manager. */
export const uploadAudio = (subdirectory, field = 'files', maxCount = 30) =>
  multer({
    storage: buildStorage(subdirectory),
    fileFilter: buildFileFilter(AUDIO_MIME_TYPES),
    // Audio is larger than artwork; allow four times the configured image cap.
    limits: { fileSize: sizeLimit * 4, files: maxCount },
  }).array(field, maxCount);

/**
 * Single video upload, for pre-roll creatives.
 *
 * A 30-second advertisement is an order of magnitude larger than any artwork,
 * so the image cap would reject every realistic file. `MAX_VIDEO_UPLOAD_SIZE_MB`
 * governs this one; it defaults to twenty times the image cap (200 MB out of the
 * box) rather than being unbounded.
 */
export const uploadVideo = (subdirectory, field = 'video') =>
  multer({
    storage: buildStorage(subdirectory),
    fileFilter: buildFileFilter(VIDEO_MIME_TYPES),
    limits: { fileSize: env.maxVideoUploadSizeMb * 1024 * 1024, files: 1 },
  }).single(field);

/**
 * MIME types a browser may put on a video it does not know well. Chrome on
 * Windows labels an `.mkv` with nothing at all, an `.avi` as `video/avi` or
 * `video/x-msvideo` depending on what is installed, and so on — so for the
 * transcoder's sources the MIME type is only a sanity check, and ffprobe
 * (services/videoProbe.service.js) is what decides that the file is a video.
 */
const isPlausibleVideoMime = (mimetype) =>
  !mimetype || mimetype.startsWith('video/') || mimetype === 'application/octet-stream';

/**
 * Single SOURCE video for a film or clip, in any container ffmpeg reads.
 *
 * NEW (beyond parity): these uploads are transcoded to HLS, so unlike the
 * pre-roll uploader above they are not limited to what a browser can play
 * directly. The stored extension is the original's, lowercased — safe because
 * it must be one on the SOURCE_VIDEO_EXTENSIONS allow-list, and the file is
 * deleted once the transcode succeeds anyway.
 */
export const uploadSourceVideo = (subdirectory, field = 'video') =>
  multer({
    storage: abortSafeStorage((_req, file) => ({
      directory: path.resolve(env.uploadPath, subdirectory),
      filename: generateFilename(path.extname(file.originalname).toLowerCase()),
    })),
    fileFilter: (_req, file, callback) => {
      const extension = path.extname(file.originalname).toLowerCase();
      if (!SOURCE_VIDEO_EXTENSIONS.includes(extension)) {
        return callback(
          ApiError.badRequest(
            `Unsupported video file "${extension || file.originalname}". Allowed: ${SOURCE_VIDEO_EXTENSIONS.join(', ')}`,
          ),
        );
      }
      if (!isPlausibleVideoMime(file.mimetype)) {
        return callback(ApiError.badRequest(`Unsupported file type "${file.mimetype}"`));
      }
      return callback(null, true);
    },
    limits: { fileSize: env.maxVideoUploadSizeMb * 1024 * 1024, files: 1 },
  }).single(field);

/**
 * A film's or clip's video, accepted according to its MP4/HLS mode.
 *
 * NEW, with the switch (services/videoSettings.service.js). The two modes take
 * different files — HLS any container ffmpeg reads, MP4 only what a browser
 * plays as it is — so the mode (the upload's own `?mode=`, else the switch) is
 * decided BEFORE multer reads the body,
 * and the decision is left on `req.videoTranscode` for the service, which must
 * treat the file the same way it was accepted.
 *
 * @param {(req) => Promise<boolean>} resolveTranscode decides the mode for this
 *        request; injected so this middleware stays free of service imports
 */
export const uploadMovieVideoFile = (subdirectory, field, resolveTranscode) => {
  const transcodable = uploadSourceVideo(subdirectory, field);
  const playable = uploadVideo(subdirectory, field);

  return async (req, res, next) => {
    try {
      req.videoTranscode = await resolveTranscode(req);
    } catch (error) {
      return next(error);
    }
    return (req.videoTranscode ? transcodable : playable)(req, res, next);
  };
};

/**
 * Single CSV upload held in MEMORY, for the bulk importers.
 *
 * A spreadsheet is read once and thrown away — it is not an asset the app
 * serves later — so writing it under `uploads/` would only leave litter that
 * nothing cleans up. The cap is deliberately small: these files are text, and
 * the importer bounds the row count separately.
 */
export const uploadCsv = (field = 'file', maxSizeMb = 2) =>
  multer({
    storage: multer.memoryStorage(),
    fileFilter: (_req, file, callback) => {
      const extension = path.extname(file.originalname).toLowerCase();
      if (extension !== '.csv' && extension !== '.txt') {
        return callback(ApiError.badRequest('Only .csv files are accepted'));
      }
      if (file.mimetype && !CSV_MIME_TYPES.includes(file.mimetype)) {
        return callback(ApiError.badRequest(`Unsupported file type "${file.mimetype}"`));
      }
      return callback(null, true);
    },
    limits: { fileSize: maxSizeMb * 1024 * 1024, files: 1 },
  }).single(field);

/** Where a game's ZIP waits while it is being unpacked. Never served. */
const GAME_ZIP_TEMP_DIR = path.join(os.tmpdir(), 'muvilite-game-uploads');

/** Long past any upload still in flight; an archive is capped at ~100 MB. */
const STALE_GAME_ZIP_MS = 60 * 60 * 1000;

/**
 * Removes archives stranded in the temp directory.
 *
 * A backstop, not the main mechanism. An archive that arrives is deleted by
 * `discardWhenDone` below, and one whose upload is abandoned is deleted by the
 * storage engine the moment the connection drops. What is left is the case
 * neither can see: the PROCESS dying while an archive sits here — a crash, a
 * redeploy, a power cut — after which nothing remembers the file. It is found
 * by age instead: anything here older than an hour belongs to no request that
 * is still running.
 *
 * Run as each new upload starts, which is exactly as often as the directory can
 * have grown. Best effort throughout — a sweep that fails must not fail the
 * upload that triggered it.
 */
function sweepStaleGameZips() {
  fs.readdir(GAME_ZIP_TEMP_DIR, (listError, names) => {
    if (listError) return;

    const cutoff = Date.now() - STALE_GAME_ZIP_MS;
    for (const name of names) {
      const candidate = path.join(GAME_ZIP_TEMP_DIR, name);
      fs.stat(candidate, (statError, stats) => {
        if (!statError && stats.isFile() && stats.mtimeMs < cutoff) {
          fs.unlink(candidate, () => {});
        }
      });
    }
  });
}

/**
 * Deletes the uploaded ZIP once the response is over, whatever it was.
 *
 * The archive is an envelope, not an asset: what the application keeps is the
 * directory it unpacks to. `close` fires after a normal response AND after an
 * aborted connection, so a validation failure, a refused bundle and a dropped
 * upload all clean up the same way — no handler has to remember to.
 */
function discardWhenDone(req, res, next) {
  const temporaryPath = req.file?.path;
  if (temporaryPath) {
    res.once('close', () => fs.unlink(temporaryPath, () => {}));
  }
  next();
}

/**
 * Single ZIP upload, for an HTML5 game bundle.
 *
 * Written to the system temp directory rather than under `uploads/`: everything
 * under `uploads/` is published by the static server, and an archive that has
 * not been inspected yet has no business being downloadable.
 *
 * The EXTENSION is the check, as it is for CSV and for the same reason — a
 * browser labels a `.zip` as `application/zip`, `application/x-zip-compressed`
 * or `application/octet-stream` depending on the operating system. Whether the
 * bytes are really an archive is settled by opening it.
 *
 * Returns two middlewares; Express flattens an array given as one handler.
 */
export const uploadGameZip = (field = 'zip') => [
  multer({
    storage: abortSafeStorage(() => {
      sweepStaleGameZips();
      return { directory: GAME_ZIP_TEMP_DIR, filename: generateFilename('.zip') };
    }),
    fileFilter: (_req, file, callback) => {
      if (path.extname(file.originalname).toLowerCase() !== '.zip') {
        return callback(ApiError.badRequest('Only .zip files are accepted'));
      }
      return callback(null, true);
    },
    limits: { fileSize: env.maxGameUploadSizeMb * 1024 * 1024, files: 1 },
  }).single(field),
  discardWhenDone,
];

/** Fails the request when no file was attached. */
export const requireFile = (req, _res, next) => {
  if (!req.file && !(req.files?.length > 0)) {
    return next(ApiError.badRequest('A file is required'));
  }
  return next();
};

export default {
  uploadImage,
  uploadAudio,
  uploadVideo,
  uploadCsv,
  uploadGameZip,
  requireFile,
  UPLOAD_DIRS,
};
