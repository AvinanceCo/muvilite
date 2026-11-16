/**
 * Video settings — whether uploaded film/clip video is transcoded to HLS.
 *
 * Purpose: own the installation-wide MP4/HLS switch — the DEFAULT for each
 *          upload: read it (resolving "not chosen yet" against whether ffmpeg
 *          is installed), change it, and decide each upload's mode, which the
 *          upload may choose for itself (`resolveUploadTranscode`).
 * Inputs:  the operator's choice; the server's ffmpeg/ffprobe
 * Outputs: `{ transcodeEnabled, chosen, transcoderAvailable, updatedAt }`
 * Deps:    repositories/systemSetting, services/{videoProbe,auditLog}
 *
 * NEW (beyond parity, requested by the maintainer): "a toggle that enables and
 * disables video transcoding — if enabled the uploaded video gets transcoded
 * and if disabled the video stays MP4 as before".
 *
 *   HLS  an upload in any container is measured, queued and transcoded to an
 *        adaptive ladder (§21). Needs ffmpeg, and CPU while it runs.
 *   MP4  an upload must be MP4 or WebM and is published as it is, the
 *        moment it arrives — the behaviour before the transcoder. Needs
 *        nothing beyond the API.
 *
 * The switch decides what the NEXT upload gets unless that upload chooses
 * otherwise on its own field. Videos already on the site keep their format, and a transcode already queued or running finishes.
 * The passenger player plays both formats, so nothing changes for passengers.
 *
 * NOT CHOSEN YET means "follow the server": HLS when ffmpeg is installed, MP4
 * when it is not, so a server deployed without the transcoder works without
 * anyone visiting this setting. HLS can only be chosen while ffmpeg is present.
 */
import { systemSettingRepository } from '../repositories/index.js';
import { isTranscoderAvailable } from './videoProbe.service.js';
import { logUpdate } from './auditLog.service.js';
import ApiError from '../utils/ApiError.js';

/**
 * How long the "is ffmpeg installed" answer is trusted. Finding out spawns two
 * processes, which is too slow to do on every upload and every screen load,
 * and installing ffmpeg is rare enough that a minute's delay is invisible.
 */
const AVAILABILITY_TTL_MS = 60_000;

let availability = { value: null, at: 0, pending: null };

/** Whether ffmpeg and ffprobe are installed, cached for a minute. */
export async function transcoderAvailable() {
  const now = Date.now();
  if (availability.value !== null && now - availability.at < AVAILABILITY_TTL_MS) {
    return availability.value;
  }
  if (!availability.pending) {
    availability.pending = isTranscoderAvailable()
      .then((value) => {
        availability = { value, at: Date.now(), pending: null };
        return value;
      })
      .catch(() => {
        availability = { value: false, at: Date.now(), pending: null };
        return false;
      });
  }
  return availability.pending;
}

/**
 * The current settings as the panel shows them.
 *
 * @returns {Promise<{transcodeEnabled: boolean, chosen: boolean, transcoderAvailable: boolean,
 *          updatedAt: Date|null, updatedBy: string|null}>}
 */
export async function getVideoSettings() {
  const [stored, available] = await Promise.all([systemSettingRepository.find(), transcoderAvailable()]);
  const chosen = typeof stored?.videoTranscodeEnabled === 'boolean';

  return {
    // What the next upload will get. A choice of HLS on a server that has
    // since lost ffmpeg is still reported as HLS — uploads then fail with a
    // 503 that says so, rather than silently changing format behind the
    // operator's back.
    transcodeEnabled: chosen ? stored.videoTranscodeEnabled : available,
    chosen,
    transcoderAvailable: available,
    updatedAt: stored?.updatedAt ?? null,
    updatedBy: stored?.updatedBy ?? null,
  };
}

/** What an upload gets when it does not choose for itself. */
export async function isTranscodeEnabled() {
  return (await getVideoSettings()).transcodeEnabled;
}

/** The values an upload may send as `?mode=` to choose for itself. */
export const UPLOAD_VIDEO_MODES = Object.freeze(['hls', 'mp4']);

/**
 * The one question the upload route asks: is THIS upload transcoded?
 *
 * Added 2026-11-15 at the maintainer's request ("I want it changeable for each
 * video"): the operator picks MP4 or HLS on each film's upload field, and the
 * installation-wide switch above becomes the choice that field starts on. An
 * upload that sends no `mode` gets the switch, exactly as before.
 *
 * Asked BEFORE the body is read (middleware/upload.js), which is why the choice
 * travels in the query string, and why an explicit HLS on a server without
 * ffmpeg is refused here — before a large file has been received for nothing.
 *
 * @param {string|undefined} mode 'hls', 'mp4', or absent for the default
 * @throws {ApiError} 422 for any other value; 409 for 'hls' without ffmpeg
 */
export async function resolveUploadTranscode(mode) {
  if (mode === undefined || mode === '') return isTranscodeEnabled();

  if (!UPLOAD_VIDEO_MODES.includes(mode)) {
    throw ApiError.validation([
      { field: 'mode', location: 'query', message: `"mode" must be one of: ${UPLOAD_VIDEO_MODES.join(', ')}` },
    ]);
  }

  if (mode === 'mp4') return false;

  if (!(await transcoderAvailable())) {
    throw ApiError.conflict(
      'HLS transcoding needs ffmpeg and ffprobe on the server, and they are not installed',
    );
  }
  return true;
}

/**
 * Changes the switch.
 *
 * @param {boolean} transcodeEnabled
 * @throws {ApiError} 409 when HLS is chosen on a server without ffmpeg
 */
export async function setTranscodeEnabled(transcodeEnabled, context) {
  const before = await getVideoSettings();

  if (transcodeEnabled && !(await transcoderAvailable())) {
    throw ApiError.conflict(
      'HLS transcoding needs ffmpeg and ffprobe on the server, and they are not installed',
    );
  }

  await systemSettingRepository.update({
    videoTranscodeEnabled: transcodeEnabled,
    updatedBy: context.userId ?? null,
  });

  await logUpdate({
    user: context.userId,
    userIp: context.userIp,
    page: 'settings',
    targetId: null,
    details: { videoTranscodeEnabled: { old: before.transcodeEnabled, new: transcodeEnabled } },
  });

  return getVideoSettings();
}

export default {
  getVideoSettings,
  isTranscodeEnabled,
  resolveUploadTranscode,
  setTranscodeEnabled,
  transcoderAvailable,
};
