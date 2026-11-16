/**
 * Game bundle service — unpacking and removing HTML5 game files.
 *
 * Purpose: turn an uploaded ZIP into a directory of static files the web server
 *          can publish, and remove that directory again.
 * Inputs:  the path of an uploaded archive and the game's folder name
 * Outputs: the public URL of the bundle's `index.html`
 * Deps:    yauzl, node:fs, config/{env,constants}, utils/{ApiError,logger}
 *
 * NO LEGACY ANCESTOR — the legacy application had no games. The behaviour is
 * Playva's `POST /api/games` (`playva-backend/routes/games.js`): accept a ZIP,
 * find its `index.html` at the root or one directory down, publish what is
 * beside it. Three things are done differently, each on purpose.
 *
 * 1. THE ARCHIVE IS INSPECTED BEFORE ANYTHING IS WRITTEN. Playva extracts the
 *    whole archive to a scratch directory and looks for `index.html` afterwards.
 *    Here the archive's directory is read first, so a bundle with no entry file,
 *    too many files, or a declared size past the ceiling is refused without a
 *    byte reaching the disk. That matters on a server whose disk also holds
 *    every film: a ZIP is a few kilobytes that can declare gigabytes.
 *
 * 2. ONLY THE GAME'S OWN FILES ARE WRITTEN. Entries outside the directory that
 *    holds `index.html` are skipped, along with symbolic links and the
 *    `__MACOSX` resource forks a Mac adds to every archive. Each destination is
 *    resolved and checked to lie inside the target directory — yauzl already
 *    rejects `../` and absolute names, and this does not rely on that.
 *
 * 3. THE DIRECTORY NAME CARRIES A RANDOM SUFFIX: `<folderName>-<8 hex>`. Playva
 *    unpacks to `games/<folderName>/` and refuses a name that exists. That works
 *    when a server sends `Cache-Control: no-cache`, as Playva's does, but uploads
 *    here are served by nginx with `expires 7d` (admin/nginx.conf,
 *    DEPLOY-SERVER.md) — so deleting a broken game and re-uploading the fixed
 *    build under the same name would keep serving the broken files to every
 *    browser that had already opened it, for a week. A fresh directory per
 *    upload gives each build its own URLs, which is also the rule the rest of
 *    this application follows for media: generated names, never overwritten.
 *
 * Unpacking happens in a hidden sibling directory that is renamed into place at
 * the end, so a half-written bundle is never reachable under its final URL and a
 * failure leaves nothing behind.
 *
 * WHAT THIS DOES NOT DO: it does not read, rewrite or vet the game's code. A
 * bundle is published as uploaded and runs in the passenger's browser on this
 * site's origin. Who may upload one is the `games` permission; see
 * MIGRATION.md §19 for what that implies for the admin host.
 */
import path from 'node:path';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import crypto from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import yauzl from 'yauzl';
import env from '../config/env.js';
import {
  GAME_ENTRY_FILE,
  GAME_MAX_FILES,
  GAME_MAX_UNPACKED_BYTES,
} from '../config/constants.js';
import { UPLOAD_DIRS } from '../middleware/upload.js';
import ApiError from '../utils/ApiError.js';
import logger from '../utils/logger.js';

/** Absolute path of `uploads/games`. Resolved per call so tests can move it. */
const gamesRoot = () => path.resolve(env.uploadPath, UPLOAD_DIRS.games);

/** Public prefix every bundle URL starts with. */
const GAMES_PUBLIC_PREFIX = `/uploads/${UPLOAD_DIRS.games}/`;

/** Unix file-type bits, as stored in the high word of a ZIP entry's attributes. */
const S_IFMT = 0o170000;
const S_IFLNK = 0o120000;

const megabytes = (bytes) => Math.round(bytes / (1024 * 1024));

/* ------------------------------------------------------------ yauzl glue --- */

function openArchive(zipPath) {
  return new Promise((resolve, reject) => {
    // `autoClose: false` keeps the file open after the directory has been read,
    // which is what lets the entries be streamed out afterwards.
    yauzl.open(zipPath, { lazyEntries: true, autoClose: false }, (error, zipfile) => {
      if (error) return reject(error);

      // An EventEmitter with no `error` listener throws, and that would take
      // the whole API process down over one bad archive. readDirectory() adds
      // its own listener for the errors it can act on and answers the request
      // from it; this one only guarantees that a late error — closing the file,
      // say — is never unhandled. It is silent because every error worth
      // reporting has already been reported once, to the uploader.
      zipfile.on('error', () => {});
      return resolve(zipfile);
    });
  });
}

function readDirectory(zipfile) {
  return new Promise((resolve, reject) => {
    const entries = [];
    zipfile.on('entry', (entry) => {
      entries.push(entry);
      zipfile.readEntry();
    });
    zipfile.once('end', () => resolve(entries));
    zipfile.once('error', reject);
    zipfile.readEntry();
  });
}

function openEntry(zipfile, entry) {
  return new Promise((resolve, reject) => {
    zipfile.openReadStream(entry, (error, stream) => (error ? reject(error) : resolve(stream)));
  });
}

/**
 * A failure of the machine (disk full, permissions) as opposed to a failure of
 * the archive. Node's system errors carry an `E…` code; yauzl's and zlib's
 * complaints about the file's contents do not.
 */
const isSystemError = (error) => typeof error?.code === 'string' && error.code.startsWith('E');

/**
 * Anything wrong with the bytes of the archive is the uploader's to fix: 400.
 *
 * yauzl refuses an entry whose name climbs out of the archive (`../`), is
 * absolute, or carries a drive letter, and reports it as an error on the whole
 * file. That case gets its own wording: "not readable" would send an operator
 * off to re-zip a file whose real problem is what is inside it.
 */
const unreadableArchive = (error) =>
  /relative path|absolute path/i.test(error?.message ?? '')
    ? ApiError.badRequest('The archive contains a file path that points outside the game')
    : ApiError.badRequest('The uploaded file is not a readable ZIP archive');

/* ------------------------------------------------------------- selection --- */

/** True for entries that are never part of a game. */
function isNoise(entry) {
  const name = entry.fileName;
  if (name.endsWith('/')) return true; // a directory record
  if (name.startsWith('__MACOSX/') || name.includes('/__MACOSX/')) return true;
  if (path.posix.basename(name) === '.DS_Store') return true;

  const mode = entry.externalFileAttributes >>> 16;
  return (mode & S_IFMT) === S_IFLNK;
}

/**
 * The directory inside the archive that holds `index.html`, as a prefix: `''`
 * for the root, `'my-game/'` for one level down.
 *
 * Playva's rule exactly (`findIndexHtml`): the root wins, otherwise the first
 * top-level directory that has one. Archives are routinely made by zipping a
 * FOLDER rather than its contents, which is what the second case is for.
 *
 * @returns {string|null} null when the archive has no entry file in either place
 */
function findBundleRoot(files) {
  if (files.some((entry) => entry.fileName === GAME_ENTRY_FILE)) return '';

  const nested = files.find((entry) => {
    const parts = entry.fileName.split('/');
    return parts.length === 2 && parts[1] === GAME_ENTRY_FILE;
  });

  return nested ? `${nested.fileName.split('/')[0]}/` : null;
}

/* ------------------------------------------------------------ public API --- */

/**
 * Unpacks a game archive into a new directory under `uploads/games`.
 *
 * @param {string} zipPath     the uploaded archive on disk
 * @param {string} folderName  the game's slug; already validated by the caller
 * @returns {Promise<{gameUrl: string, fileCount: number, unpackedBytes: number}>}
 * @throws {ApiError} 400 when the archive is unreadable, has no `index.html`, or
 *         exceeds a ceiling
 */
export async function unpackGameBundle(zipPath, folderName) {
  let zipfile;
  try {
    zipfile = await openArchive(zipPath);
  } catch (error) {
    if (isSystemError(error)) throw error;
    throw unreadableArchive(error);
  }

  const root = gamesRoot();
  const staging = path.join(root, `.incoming-${crypto.randomBytes(8).toString('hex')}`);

  try {
    // Cheap first: a directory this long is not a game, and reading it into
    // memory to count it properly would be the attack.
    if (zipfile.entryCount > GAME_MAX_FILES * 4) {
      throw ApiError.badRequest(`The archive holds too many files (limit ${GAME_MAX_FILES})`);
    }

    let entries;
    try {
      entries = await readDirectory(zipfile);
    } catch (error) {
      if (isSystemError(error)) throw error;
      throw unreadableArchive(error);
    }

    const files = entries.filter((entry) => !isNoise(entry));

    const prefix = findBundleRoot(files);
    if (prefix === null) {
      throw ApiError.badRequest(`No ${GAME_ENTRY_FILE} found in the zip file`);
    }

    const wanted = files.filter((entry) => entry.fileName.startsWith(prefix));

    if (wanted.length > GAME_MAX_FILES) {
      throw ApiError.badRequest(
        `The game holds ${wanted.length} files; the limit is ${GAME_MAX_FILES}`,
      );
    }

    // The declared sizes can be trusted for this check: yauzl verifies each
    // entry against its declaration while streaming and fails the read if the
    // real data runs longer.
    const unpackedBytes = wanted.reduce((sum, entry) => sum + entry.uncompressedSize, 0);
    if (unpackedBytes > GAME_MAX_UNPACKED_BYTES) {
      throw ApiError.badRequest(
        `The game unpacks to ${megabytes(unpackedBytes)} MB; the limit is ${megabytes(GAME_MAX_UNPACKED_BYTES)} MB`,
      );
    }

    await fsp.mkdir(staging, { recursive: true });

    for (const entry of wanted) {
      const relative = entry.fileName.slice(prefix.length);
      const destination = path.resolve(staging, ...relative.split('/'));

      // Belt and braces over yauzl's own filename validation.
      if (!destination.startsWith(staging + path.sep)) {
        throw ApiError.badRequest(`The archive contains an unsafe path: "${entry.fileName}"`);
      }

      await fsp.mkdir(path.dirname(destination), { recursive: true });

      try {
        // One at a time: a game is thousands of small files, and opening them
        // all at once would only trade a little speed for a burst of handles.
        await pipeline(await openEntry(zipfile, entry), fs.createWriteStream(destination));
      } catch (error) {
        if (isSystemError(error)) throw error;
        throw unreadableArchive(error);
      }
    }

    const directory = `${folderName}-${crypto.randomBytes(4).toString('hex')}`;
    await fsp.rename(staging, path.join(root, directory));

    return {
      gameUrl: `${GAMES_PUBLIC_PREFIX}${directory}/${GAME_ENTRY_FILE}`,
      fileCount: wanted.length,
      unpackedBytes,
    };
  } catch (error) {
    await fsp.rm(staging, { recursive: true, force: true }).catch(() => {});
    throw error;
  } finally {
    zipfile.close();
  }
}

/**
 * Deletes the directory a `gameUrl` points into.
 *
 * Deliberately narrow: the URL must name `index.html` inside a DIRECT child of
 * `uploads/games`. Anything else — an empty value, a path somewhere else, a
 * record edited by hand — is left alone and logged, because this is a recursive
 * delete and the argument comes out of the database.
 *
 * A directory that is already gone is not an error.
 *
 * @param {string|null|undefined} gameUrl a value produced by unpackGameBundle()
 * @returns {Promise<void>}
 */
export async function removeGameBundle(gameUrl) {
  if (!gameUrl) return;

  const root = gamesRoot();

  // Exactly `<prefix><directory>/index.html` — two segments, no more.
  const segments = gameUrl.startsWith(GAMES_PUBLIC_PREFIX)
    ? gameUrl.slice(GAMES_PUBLIC_PREFIX.length).split('/')
    : [];
  const wellFormed =
    segments.length === 2 && segments[1] === GAME_ENTRY_FILE && !segments[0].startsWith('.');
  const target = wellFormed ? path.resolve(root, segments[0]) : null;

  if (!target || path.dirname(target) !== root) {
    logger.warn(`Refusing to delete a game bundle outside the games directory: ${gameUrl}`);
    return;
  }

  try {
    await fsp.rm(target, { recursive: true, force: true });
  } catch (error) {
    // The record is already updated by the time this runs; a directory that
    // would not go is litter to clean up, not a reason to fail the request.
    logger.warn(`Failed to delete game bundle ${gameUrl}`, error);
  }
}

export default { unpackGameBundle, removeGameBundle };
