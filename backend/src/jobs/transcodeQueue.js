/**
 * Transcode queue — runs the HLS jobs, one (or TRANSCODE_CONCURRENCY) at a time.
 *
 * Purpose: take uploaded films and clips through ffmpeg in the background,
 *          keep the record's status and progress current, publish the result
 *          atomically, and pick up where it left off after a restart.
 * Inputs:  `enqueueTranscode(movieId, sourcePath)` from the movie video service
 * Outputs: movie documents moving queued → processing → ready | failed
 * Deps:    services/{videoProbe,hlsTranscode,media}, repositories/movie, config/env
 *
 * NEW (beyond parity). See services/admin/movieVideo.service.js for the flow as
 * a whole; this module is only the worker.
 *
 * THE QUEUE IS IN MEMORY, THE TRUTH IS IN MONGO. Every job's state is written
 * to its movie, so the in-memory list is just the order of work. On start-up
 * every movie left `queued` or `processing` (a crash, a deploy, a server
 * reboot) is queued again, and a `processing` one starts from scratch —
 * ffmpeg cannot resume a half-written ladder.
 *
 * PUBLISHED ALL AT ONCE. ffmpeg writes into `<name>-hls.partial/`, which no
 * record points at; only a finished set is renamed to `<name>-hls/`, and only
 * then does `videoPath` move to it. A passenger can therefore never be handed a
 * playlist that is still growing. Leftover `.partial` directories from a crash
 * are swept on start-up.
 *
 * A RESULT THE RECORD NO LONGER WANTS IS DISCARDED. Every write is conditional
 * on the movie still holding this job's source (repositories/movie.repository.js
 * `updateIfVideoSource`), so an operator replacing or removing the video while
 * ffmpeg runs wins, and the late output is deleted rather than published.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import env from '../config/env.js';
import { HLS_MASTER_PLAYLIST, VIDEO_STATUS } from '../config/constants.js';
import { movieRepository } from '../repositories/index.js';
import { probeVideo, isTranscoderAvailable } from '../services/videoProbe.service.js';
import { transcodeToHls } from '../services/hlsTranscode.service.js';
import {
  HLS_PARTIAL_SUFFIX,
  hlsDirsFor,
  removeDirectory,
  removeStoredFile,
  removeStoredVideo,
  toAbsoluteUploadPath,
  toPublicPath,
} from '../services/media.service.js';
import { UPLOAD_DIRS } from '../middleware/upload.js';
import logger from '../utils/logger.js';

/** Progress is written at most this often, so a film is not hundreds of writes. */
const PROGRESS_WRITE_INTERVAL_MS = 2_000;

/** Longest failure message stored on the record. */
const MAX_ERROR_LENGTH = 500;

/** @type {Array<{movieId: string, sourcePath: string}>} */
const waiting = [];
/** movieId → { sourcePath, controller, reason, done } */
const running = new Map();
let accepting = false;

const sameJob = (a, b) => String(a.movieId) === String(b.movieId);

/** Starts as many waiting jobs as the concurrency allows. */
function pump() {
  while (accepting && running.size < env.transcodeConcurrency && waiting.length > 0) {
    const job = waiting.shift();
    const controller = new AbortController();
    const entry = { sourcePath: job.sourcePath, controller, reason: null, done: null };
    running.set(String(job.movieId), entry);

    entry.done = runJob(job, entry)
      .catch((error) => logger.error(`Transcode of movie ${job.movieId} crashed`, error))
      .finally(() => {
        running.delete(String(job.movieId));
        pump();
      });
  }
}

/**
 * Queues a movie's uploaded source. A movie is only ever in the queue once:
 * queuing it again replaces its waiting entry (the newer upload is the one
 * wanted). A RUNNING job for the same movie must be cancelled first — the
 * video service does that before it stores the new source.
 */
export function enqueueTranscode(movieId, sourcePath) {
  const job = { movieId: String(movieId), sourcePath };
  const index = waiting.findIndex((entry) => sameJob(entry, job));
  if (index >= 0) waiting.splice(index, 1);
  waiting.push(job);
  pump();
}

/**
 * Stops whatever the transcoder is doing for this movie — drops it from the
 * queue, or kills its ffmpeg and waits for the partial output to be removed.
 * Resolves once nothing for this movie is running. The caller owns the
 * record's state afterwards.
 */
export async function cancelTranscode(movieId) {
  const key = String(movieId);
  const index = waiting.findIndex((entry) => entry.movieId === key);
  if (index >= 0) waiting.splice(index, 1);

  const entry = running.get(key);
  if (!entry) return;
  entry.reason = 'cancelled';
  entry.controller.abort();
  await entry.done;
}

/** Where a movie stands in the queue, for the admin panel's wording. */
export function queuePosition(movieId) {
  const key = String(movieId);
  if (running.has(key)) return 0;
  const index = waiting.findIndex((entry) => entry.movieId === key);
  return index >= 0 ? index + 1 : null;
}

/* --------------------------------------------------------------- the job --- */

function failureMessage(error) {
  const message = error?.message || 'Unknown transcoder error';
  return message.length > MAX_ERROR_LENGTH ? `${message.slice(0, MAX_ERROR_LENGTH)}…` : message;
}

async function runJob(job, entry) {
  const { movieId, sourcePath } = job;
  const sourceAbsolute = toAbsoluteUploadPath(sourcePath);
  if (!sourceAbsolute) {
    await movieRepository.updateIfVideoSource(movieId, sourcePath, {
      videoStatus: VIDEO_STATUS.FAILED,
      videoError: 'The uploaded file is outside the upload directory',
    });
    return;
  }

  const { finalDir, partialDir } = hlsDirsFor(sourceAbsolute);

  const started = await movieRepository.updateIfVideoSource(movieId, sourcePath, {
    videoStatus: VIDEO_STATUS.PROCESSING,
    videoProgress: 0,
    videoError: null,
  });
  // Replaced or removed while it waited: nothing to do, and nothing is ours.
  if (!started) return;

  let lastWrite = 0;
  const onProgress = (percent) => {
    const now = Date.now();
    if (now - lastWrite < PROGRESS_WRITE_INTERVAL_MS) return;
    lastWrite = now;
    movieRepository
      .updateIfVideoSource(movieId, sourcePath, { videoProgress: percent })
      .catch((error) => logger.warn(`Could not record progress for movie ${movieId}`, error));
  };

  try {
    const probe = await probeVideo(sourceAbsolute);

    await removeDirectory(partialDir);
    await fs.mkdir(partialDir, { recursive: true });

    const startedAt = Date.now();
    const { ladder } = await transcodeToHls({
      sourcePath: sourceAbsolute,
      outDir: partialDir,
      probe,
      onProgress,
      signal: entry.controller.signal,
    });

    // Publish: the finished set takes its final name in one rename.
    await removeDirectory(finalDir);
    await fs.rename(partialDir, finalDir);

    const masterPath = toPublicPath(path.join(finalDir, HLS_MASTER_PLAYLIST));
    const before = await movieRepository.findOne({ _id: movieId, videoSourcePath: sourcePath }, {
      select: 'videoPath',
    });

    const published = await movieRepository.updateIfVideoSource(movieId, sourcePath, {
      videoPath: masterPath,
      videoDurationSecond: probe.durationSecond,
      videoWidth: probe.width,
      videoHeight: probe.height,
      videoStatus: VIDEO_STATUS.READY,
      videoProgress: 100,
      videoError: null,
      videoSourcePath: null,
    });

    if (!published) {
      // The operator moved on during the final seconds: this set is nobody's.
      await removeDirectory(finalDir);
      return;
    }

    // The superseded video, and the original upload (deleted on success, by
    // the maintainer's decision — the HLS set is the only copy from here on).
    if (before?.videoPath && before.videoPath !== masterPath) {
      await removeStoredVideo(before.videoPath);
    }
    await removeStoredFile(sourcePath);

    logger.info(
      `Transcoded movie ${movieId} to HLS (${ladder.map((rung) => rung.name).join(', ')}) in ${Math.round((Date.now() - startedAt) / 1000)}s`,
    );
  } catch (error) {
    await removeDirectory(partialDir);

    if (error?.name === 'AbortError') {
      // `cancelled`: the video service rewrites the record itself.
      // `shutdown`: the record stays `processing` and is resumed on start-up.
      return;
    }

    logger.warn(`Transcode of movie ${movieId} failed: ${failureMessage(error)}`);
    await movieRepository.updateIfVideoSource(movieId, sourcePath, {
      videoStatus: VIDEO_STATUS.FAILED,
      videoProgress: 0,
      videoError: failureMessage(error),
    });
  }
}

/* ------------------------------------------------------------ lifecycle --- */

/** Removes `.partial` sets a crash left behind. They are never referenced. */
async function sweepPartialOutput() {
  const directory = path.resolve(env.uploadPath, UPLOAD_DIRS.movies);
  let entries;
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch {
    return;
  }
  await Promise.all(
    entries
      .filter((item) => item.isDirectory() && item.name.endsWith(HLS_PARTIAL_SUFFIX))
      .map((item) => removeDirectory(path.join(directory, item.name))),
  );
}

/**
 * Starts the worker: sweeps crash leftovers and re-queues interrupted jobs.
 * Called once from server.js after the database is connected.
 */
export async function startTranscodeWorker() {
  accepting = true;

  if (!(await isTranscoderAvailable())) {
    logger.warn(
      `ffmpeg/ffprobe not found (FFMPEG_PATH="${env.ffmpegPath}", FFPROBE_PATH="${env.ffprobePath}"). ` +
        'HLS transcoding is unavailable: uploads are published as MP4, and choosing HLS in «تنظیمات ویدئو» is refused until they are installed.',
    );
  }

  await sweepPartialOutput();

  const pending = await movieRepository.findPendingTranscodes();
  for (const movie of pending) {
    enqueueTranscode(movie._id, movie.videoSourcePath);
  }
  if (pending.length > 0) {
    logger.info(`Resumed ${pending.length} interrupted video transcode(s)`);
  }
}

/**
 * Stops accepting work and kills any running ffmpeg, so a deploy or restart
 * does not leave an orphaned encoder eating the CPU. Interrupted jobs stay
 * `processing` in the database and are resumed by the next start.
 */
export async function stopTranscodeWorker() {
  accepting = false;
  waiting.length = 0;
  const entries = [...running.values()];
  for (const entry of entries) {
    entry.reason = 'shutdown';
    entry.controller.abort();
  }
  await Promise.all(entries.map((entry) => entry.done));
}

export default {
  enqueueTranscode,
  cancelTranscode,
  queuePosition,
  startTranscodeWorker,
  stopTranscodeWorker,
};
