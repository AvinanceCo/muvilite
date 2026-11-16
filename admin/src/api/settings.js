/**
 * Installation settings API.
 *
 * Purpose: read and change installation-wide switches.
 * Inputs:  `{ transcodeEnabled }`
 * Outputs: `{ transcodeEnabled, chosen, transcoderAvailable, updatedAt, updatedBy }`
 * Deps:    api/client
 *
 * New: the legacy panel had no settings screen. See the backend's
 * services/videoSettings.service.js for what the video switch does.
 */
import { request } from './client.js';

/** settings/view */
export function fetchVideoSettings() {
  return request({ url: '/admin/settings/video' });
}

/** settings/edit. 409 when HLS is chosen on a server without ffmpeg. */
export function updateVideoSettings(transcodeEnabled) {
  return request({ url: '/admin/settings/video', method: 'PUT', data: { transcodeEnabled } });
}

export default { fetchVideoSettings, updateVideoSettings };
