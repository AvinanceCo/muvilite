/**
 * Movie video attachment.
 *
 * Purpose: give a catalog title its video — an uploaded file, transcoded to
 *          HLS in the background, or an external link — and hold both to the
 *          clip/film standard.
 * Inputs:  a movie id, plus either a multer file or a URL (with the dimensions
 *          and duration the browser measured, for links)
 * Outputs: the updated movie
 * Deps:    repositories/movie, services/{media,videoProbe,auditLog},
 *          jobs/transcodeQueue, config/constants
 *
 * NEW CAPABILITY. The legacy player read the video from a URL derived from the
 * row id — `<?= $movieObj['id'] ?>.mp4` in player.php:31 — so files were placed
 * under `assets/video/` over FTP and no screen in the panel could attach one.
 * `videoPath` survived the migration as a stored, publicly exposed field with
 * nothing able to write it. This is what writes it.
 *
 * ONE FIELD PLAYS. `videoPath` is what the passenger player loads: an HLS
 * master playlist for an upload, or an external `http(s)` address for a link.
 * Setting either replaces the other, and the replaced upload's files are
 * deleted, the same rule the poster and pre-roll attachers follow.
 *
 * UPLOADS ARE TRANSCODED (NEW, beyond parity — requested by the maintainer).
 * An uploaded file in any container ffmpeg reads is stored as
 * `videoSourcePath`, queued, and turned into an adaptive HLS ladder by
 * jobs/transcodeQueue.js. `videoPath` moves to the result only once it is
 * complete, so a title whose video is being replaced keeps playing the old one
 * until then, and the original upload is deleted after the transcode succeeds.
 * Replacing, linking or removing the video while a transcode is waiting or
 * running cancels it.
 *
 * THE STANDARD CHECK. A clip must be portrait and under three minutes; a film
 * must run over five (config/constants.js).
 *   - For an UPLOAD the server measures the file itself with ffprobe, before
 *     accepting it, so the check is a real boundary: the numbers the browser
 *     sends are ignored. A file ffprobe cannot read as a video is refused.
 *   - For a LINK nothing is fetched, so the check still uses the numbers the
 *     browser measured. That is a consistency check a hand-crafted request can
 *     defeat, and missing numbers (a host that will not report) are accepted
 *     and stored as null rather than blocking a link that plays perfectly well.
 */
import { movieRepository } from '../../repositories/index.js';
import {
  removeStoredFile,
  removeStoredVideo,
  toPublicPath,
} from '../media.service.js';
import { probeVideo } from '../videoProbe.service.js';
import { logUpdate } from '../auditLog.service.js';
import { cancelTranscode, enqueueTranscode, queuePosition } from '../../jobs/transcodeQueue.js';
import {
  CLIP_MAX_DURATION_SECONDS,
  MOVIE_MIN_DURATION_SECONDS,
  VIDEO_STATUS,
} from '../../config/constants.js';
import ApiError from '../../utils/ApiError.js';

/** Minutes, for a message an operator reads. */
const minutes = (seconds) => seconds / 60;

/**
 * Applies the clip/film standard to measured video metadata.
 *
 * @param {boolean} isClip           what the record says it is
 * @param {{durationSecond?: number|null, width?: number|null, height?: number|null}} measured
 * @throws {ApiError} 400 when the video does not match the kind of record
 */
export function assertVideoMeetsStandard(isClip, measured = {}) {
  const { durationSecond, width, height } = measured;

  // Orientation is only decidable when both dimensions arrived.
  if (isClip && Number.isFinite(width) && Number.isFinite(height) && width >= height) {
    throw ApiError.badRequest(
      `A clip must be a portrait video (taller than it is wide); this one is ${width}x${height}`,
    );
  }

  if (!Number.isFinite(durationSecond)) return;

  if (isClip && durationSecond >= CLIP_MAX_DURATION_SECONDS) {
    throw ApiError.badRequest(
      `A clip must be shorter than ${minutes(CLIP_MAX_DURATION_SECONDS)} minutes; this one runs ${Math.round(durationSecond)} seconds`,
    );
  }

  if (!isClip && durationSecond <= MOVIE_MIN_DURATION_SECONDS) {
    throw ApiError.badRequest(
      `A film must run longer than ${minutes(MOVIE_MIN_DURATION_SECONDS)} minutes; this one runs ${Math.round(durationSecond)} seconds. ` +
        `A video under ${minutes(CLIP_MAX_DURATION_SECONDS)} minutes belongs to a record marked as a clip`,
    );
  }
}

/** Normalizes the three measured numbers, dropping anything unusable. */
function readMeasured(source = {}) {
  const number = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };

  return {
    durationSecond: number(source.durationSecond),
    width: number(source.width),
    height: number(source.height),
  };
}

/** Loads the movie or 404s, so every entry point fails the same way. */
async function loadMovie(movieId) {
  const movie = await movieRepository.findById(movieId, { scope: 'admin' });
  if (!movie) throw ApiError.notFound('Movie not found');
  return movie;
}

/**
 * Stops any transcode for this movie and deletes the upload it was working
 * from. Used by every path that changes the video, so a superseded upload
 * never finishes and never lingers.
 */
async function abandonPendingUpload(movie) {
  await cancelTranscode(movie._id);
  // A backfilled title (scripts/transcode-backfill.js) transcodes the very
  // MP4 it is still playing from, so source and videoPath are the same file.
  // That file belongs to videoPath, whose own replacement logic deletes it.
  if (movie.videoSourcePath && movie.videoSourcePath !== movie.videoPath) {
    await removeStoredFile(movie.videoSourcePath);
  }
}

/** The admin document, with where it stands in the transcode queue. */
function withQueue(movie) {
  if (!movie) return movie;
  return { ...movie, videoQueuePosition: queuePosition(movie._id) };
}

/**
 * Measures an upload that will be published as it is (MP4 mode).
 *
 * ffprobe when the server has it — then the check is real, as in HLS mode.
 * Without it (a server deployed without the transcoder) the numbers the
 * browser measured are used, exactly as before the transcoder existed: a
 * consistency check, not a boundary (see the header).
 */
async function measureForMp4(absolutePath, body) {
  try {
    return await probeVideo(absolutePath);
  } catch (error) {
    if (error?.statusCode === 503) return readMeasured(body);
    throw error;
  }
}

/**
 * Accepts an uploaded file: published as it is in MP4 mode, queued for HLS
 * otherwise. Which one is decided by the MP4/HLS switch BEFORE the file was
 * read (middleware/upload.js `uploadMovieVideoFile`), and passed in here so the
 * file is treated the way it was accepted.
 *
 * The file is on disk before this runs — multer writes it during the request —
 * so a refusal has to delete it, or every rejected attempt leaves an orphan.
 *
 * @param {string} movieId
 * @param {Express.Multer.File} file
 * @param {object} body          the browser's measurements (used in MP4 mode without ffprobe)
 * @param {object} context
 * @param {{transcode?: boolean}} [options]
 */
export async function attachMovieVideoFile(movieId, file, body, context, { transcode = true } = {}) {
  if (!transcode) return publishMovieVideoFile(movieId, file, body, context);

  const sourcePath = toPublicPath(file.path);

  let movie;
  try {
    movie = await loadMovie(movieId);
    // Measured here, by the server, and checked before anything is replaced.
    const probe = await probeVideo(file.path);
    assertVideoMeetsStandard(movie.isClip, probe);
  } catch (error) {
    await removeStoredFile(sourcePath);
    throw error;
  }

  await abandonPendingUpload(movie);

  const updated = await movieRepository.updateById(movie._id, {
    videoSourcePath: sourcePath,
    videoStatus: VIDEO_STATUS.QUEUED,
    videoProgress: 0,
    videoError: null,
  });

  await logUpdate({
    user: context.userId,
    userIp: context.userIp,
    page: 'movies',
    targetId: movie._id,
    details: { videoSourcePath: { old: movie.videoSourcePath ?? null, new: sourcePath } },
  });

  enqueueTranscode(movie._id, sourcePath);
  return withQueue(updated);
}

/**
 * MP4 mode: the uploaded file IS the video, published immediately — the
 * behaviour before the transcoder. Any transcode still pending for this title
 * is cancelled, and the video it replaces (a file or an HLS set) is deleted.
 */
async function publishMovieVideoFile(movieId, file, body, context) {
  const videoPath = toPublicPath(file.path);

  let movie;
  let measured;
  try {
    movie = await loadMovie(movieId);
    measured = await measureForMp4(file.path, body);
    assertVideoMeetsStandard(movie.isClip, measured);
  } catch (error) {
    await removeStoredFile(videoPath);
    throw error;
  }

  await abandonPendingUpload(movie);

  const updated = await movieRepository.updateById(movie._id, {
    videoPath,
    videoDurationSecond: measured.durationSecond ?? null,
    videoWidth: measured.width ?? null,
    videoHeight: measured.height ?? null,
    videoSourcePath: null,
    videoStatus: VIDEO_STATUS.NONE,
    videoProgress: 0,
    videoError: null,
  });

  if (movie.videoPath !== videoPath) await removeStoredVideo(movie.videoPath);

  await logUpdate({
    user: context.userId,
    userIp: context.userIp,
    page: 'movies',
    targetId: movie._id,
    details: { videoPath: { old: movie.videoPath, new: videoPath } },
  });

  return withQueue(updated);
}

/**
 * Points the record at an external URL.
 *
 * Nothing is fetched: the operator is trusted with the address, the same way
 * they are trusted with an advertisement's click-through URL. What the link
 * serves is checked in the browser before it is submitted, not here. Links are
 * played as they are by the passenger player — an `.m3u8` link as HLS,
 * anything else as a single progressive file — and are never transcoded.
 *
 * @param {string} movieId
 * @param {{url: string, durationSecond?: number, width?: number, height?: number}} body
 */
export async function setMovieVideoLink(movieId, body, context) {
  const movie = await loadMovie(movieId);
  const measured = readMeasured(body);
  assertVideoMeetsStandard(movie.isClip, measured);

  await abandonPendingUpload(movie);

  const url = body.url.trim();
  const updated = await movieRepository.updateById(movie._id, {
    videoPath: url,
    videoDurationSecond: measured.durationSecond,
    videoWidth: measured.width,
    videoHeight: measured.height,
    videoSourcePath: null,
    videoStatus: VIDEO_STATUS.NONE,
    videoProgress: 0,
    videoError: null,
  });

  // Only an uploaded video is ours to delete; a link points at someone else's
  // server and there is nothing on disk behind it.
  await removeStoredVideo(movie.videoPath);

  await logUpdate({
    user: context.userId,
    userIp: context.userIp,
    page: 'movies',
    targetId: movie._id,
    details: { videoPath: { old: movie.videoPath, new: url } },
  });

  return withQueue(updated);
}

/**
 * Runs a failed transcode again, from the original that was kept for exactly
 * this. 409 when there is nothing to retry.
 */
export async function retryMovieVideo(movieId, context) {
  const movie = await loadMovie(movieId);
  if (movie.videoStatus !== VIDEO_STATUS.FAILED || !movie.videoSourcePath) {
    throw ApiError.conflict('There is no failed video transcode to retry');
  }

  const updated = await movieRepository.updateById(movie._id, {
    videoStatus: VIDEO_STATUS.QUEUED,
    videoProgress: 0,
    videoError: null,
  });

  await logUpdate({
    user: context.userId,
    userIp: context.userIp,
    page: 'movies',
    targetId: movie._id,
    details: { videoStatus: { old: VIDEO_STATUS.FAILED, new: VIDEO_STATUS.QUEUED } },
  });

  enqueueTranscode(movie._id, movie.videoSourcePath);
  return withQueue(updated);
}

/**
 * Removes the video, and any upload still being transcoded, deleting the files
 * the record owned.
 * Idempotent: clearing a record that has none is a success, because the request
 * asks for a state and that state already holds.
 */
export async function clearMovieVideo(movieId, context) {
  const movie = await loadMovie(movieId);

  await abandonPendingUpload(movie);

  const updated = await movieRepository.updateById(movieId, {
    videoPath: null,
    videoDurationSecond: null,
    videoWidth: null,
    videoHeight: null,
    videoSourcePath: null,
    videoStatus: VIDEO_STATUS.NONE,
    videoProgress: 0,
    videoError: null,
  });

  await removeStoredVideo(movie.videoPath);

  if (movie.videoPath || movie.videoSourcePath) {
    await logUpdate({
      user: context.userId,
      userIp: context.userIp,
      page: 'movies',
      targetId: movieId,
      details: {
        videoPath: { old: movie.videoPath, new: null },
        ...(movie.videoSourcePath ? { videoSourcePath: { old: movie.videoSourcePath, new: null } } : {}),
      },
    });
  }

  return withQueue(updated);
}

/** The current video state, for the panel to poll while a transcode runs. */
export async function getMovieVideoStatus(movieId) {
  const movie = await loadMovie(movieId);
  return withQueue({
    _id: movie._id,
    videoPath: movie.videoPath,
    videoSourcePath: movie.videoSourcePath ?? null,
    videoStatus: movie.videoStatus ?? VIDEO_STATUS.NONE,
    videoProgress: movie.videoProgress ?? 0,
    videoError: movie.videoError ?? null,
    videoDurationSecond: movie.videoDurationSecond,
    videoWidth: movie.videoWidth,
    videoHeight: movie.videoHeight,
  });
}

export default {
  assertVideoMeetsStandard,
  attachMovieVideoFile,
  setMovieVideoLink,
  retryMovieVideo,
  clearMovieVideo,
  getMovieVideoStatus,
};
