/**
 * Video probe — what an uploaded file really is.
 *
 * Purpose: read a video's duration, display dimensions and audio presence with
 *          ffprobe, and say plainly when the file is not a video at all.
 * Inputs:  an absolute path on disk
 * Outputs: `{ durationSecond, width, height, hasAudio }`
 * Deps:    node:child_process, config/env, utils/ApiError
 *
 * WHY THIS EXISTS. Before the HLS transcoder the server had no ffmpeg, so the
 * clip/film standard was checked against numbers the BROWSER measured and sent
 * with the upload — a consistency check that a crafted request could defeat
 * (see services/admin/movieVideo.service.js). With ffprobe on the host the
 * server measures the file itself, which makes the check a real boundary for
 * uploads, and it also catches the formats a browser cannot decode at all
 * (MKV, AVI, WMV…), for which the panel sends no numbers.
 *
 * DISPLAY DIMENSIONS, NOT CODED ONES. A phone records a portrait clip as a
 * landscape frame plus a rotation flag. The coded size is 1920x1080 and the
 * picture a viewer sees is 1080x1920. The clip rule ("portrait") is about the
 * picture, and ffmpeg applies the rotation when it transcodes, so the probe
 * swaps the dimensions whenever the rotation is a quarter turn.
 */
import { execFile } from 'node:child_process';
import env from '../config/env.js';
import ApiError from '../utils/ApiError.js';

/** ffprobe on a corrupt or enormous file should still answer in seconds. */
const PROBE_TIMEOUT_MS = 60_000;

/** The rotation a stream carries, in degrees, from either place it is stored. */
function readRotation(stream) {
  const fromSideData = stream.side_data_list?.find((entry) => entry.rotation !== undefined)?.rotation;
  const fromTag = stream.tags?.rotate;
  const rotation = Number(fromSideData ?? fromTag ?? 0);
  return Number.isFinite(rotation) ? rotation : 0;
}

/** A positive finite number, or null. */
const positive = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
};

/**
 * Runs ffprobe and returns its JSON.
 *
 * ENOENT means the binary is missing, which is an installation problem and is
 * reported as such (503), not as a bad upload.
 */
function runProbe(absolutePath) {
  const args = [
    '-v', 'error',
    '-print_format', 'json',
    '-show_format',
    '-show_streams',
    absolutePath,
  ];

  return new Promise((resolve, reject) => {
    execFile(
      env.ffprobePath,
      args,
      { timeout: PROBE_TIMEOUT_MS, maxBuffer: 8 * 1024 * 1024, windowsHide: true },
      (error, stdout) => {
        if (error?.code === 'ENOENT') {
          return reject(
            new ApiError(503, 'Video processing is not available: ffprobe is not installed on the server'),
          );
        }
        if (error) {
          return reject(ApiError.badRequest('The file could not be read as a video'));
        }
        try {
          return resolve(JSON.parse(stdout));
        } catch {
          return reject(ApiError.badRequest('The file could not be read as a video'));
        }
      },
    );
  });
}

/**
 * Probes a video file.
 *
 * @param {string} absolutePath
 * @returns {Promise<{durationSecond: number|null, width: number, height: number, hasAudio: boolean}>}
 * @throws {ApiError} 400 when the file has no video stream; 503 when ffprobe is missing
 */
export async function probeVideo(absolutePath) {
  const info = await runProbe(absolutePath);
  const streams = info.streams ?? [];

  // Cover art in an MP4/MKV is a video stream too, flagged as an attached
  // picture; it is never the film.
  const video = streams.find(
    (stream) => stream.codec_type === 'video' && !stream.disposition?.attached_pic,
  );
  if (!video || !positive(video.width) || !positive(video.height)) {
    throw ApiError.badRequest('The file has no video track');
  }

  const quarterTurn = Math.abs(readRotation(video)) % 180 === 90;
  const width = quarterTurn ? video.height : video.width;
  const height = quarterTurn ? video.width : video.height;

  return {
    durationSecond: positive(info.format?.duration) ?? positive(video.duration),
    width,
    height,
    hasAudio: streams.some((stream) => stream.codec_type === 'audio'),
  };
}

/**
 * A stream's frame rate from ffprobe's `"30000/1001"`-style fraction: the
 * average rate first, the container's nominal one as a fallback. null when
 * neither is a usable positive number.
 */
function frameRateOf(stream) {
  for (const value of [stream?.avg_frame_rate, stream?.r_frame_rate]) {
    const [numerator, denominator = '1'] = String(value ?? '').split('/');
    const rate = Number(numerator) / Number(denominator);
    if (Number.isFinite(rate) && rate > 0) return rate;
  }
  return null;
}

/**
 * The frame rate of a file's first video stream, or null if it has none.
 *
 * @param {string} absolutePath
 * @returns {Promise<number|null>}
 * @throws {ApiError} 400 when unreadable; 503 when ffprobe is missing
 */
export async function probeFrameRate(absolutePath) {
  const info = await runProbe(absolutePath);
  const video = (info.streams ?? []).find(
    (stream) => stream.codec_type === 'video' && !stream.disposition?.attached_pic,
  );
  return frameRateOf(video);
}

/**
 * Whether both tools are installed, for the startup log line. Never throws.
 * @returns {Promise<boolean>}
 */
export function isTranscoderAvailable() {
  const check = (binary) =>
    new Promise((resolve) => {
      execFile(binary, ['-version'], { timeout: 10_000, windowsHide: true }, (error) => resolve(!error));
    });

  return Promise.all([check(env.ffmpegPath), check(env.ffprobePath)]).then((results) =>
    results.every(Boolean),
  );
}

export default { probeVideo, isTranscoderAvailable };
