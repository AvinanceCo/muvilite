/**
 * Playback telemetry API.
 *
 * Purpose: open playback sessions and send heartbeats.
 * Inputs:  media ids, session ids
 * Outputs: session descriptors and heartbeat acknowledgements
 * Deps:    api/client
 *
 * How a session works (backend services/tracking.service.js, unchanged from the
 * legacy design): creating a session returns its id together with
 * `intervalSecond`. The client then sends one heartbeat per interval while
 * media is playing, and each heartbeat credits a FIXED chunk server-side — 30s
 * for video, 15s for audio. The client cannot choose how many seconds to add,
 * so a slow or fast interval changes how often, not how much.
 */
import { request } from './client.js';

/**
 * Opens a watch session. Also increments the movie's visit count server-side.
 * @returns {Promise<{sessionId: string, intervalSecond: number, movie: object}>}
 */
export function createWatchSession(movieId, platform) {
  return request({
    url: '/watch-sessions',
    method: 'POST',
    data: platform === undefined ? { movieId } : { movieId, platform },
  });
}

/**
 * One watch heartbeat.
 * @param {string} sessionId
 * @param {number} [lastSecond] current playback position, averaged by the daily
 *        trend job. Optional — the legacy client never sent it.
 */
export function sendWatchHeartbeat(sessionId, lastSecond) {
  return request({
    url: `/watch-sessions/${sessionId}`,
    method: 'PATCH',
    data: Number.isFinite(lastSecond) ? { lastSecond: Math.floor(lastSecond) } : {},
  });
}

/**
 * Opens a listen session.
 *
 * In the legacy app this was a side effect of fetching music metadata, which
 * meant every crawler hit inflated the stats. It is an explicit call now, so
 * the frontend must make it when playback starts — not when the page loads.
 */
export function createListenSession(musicId) {
  return request({ url: '/listen-sessions', method: 'POST', data: { musicId } });
}

/** One listen heartbeat. */
export function sendListenHeartbeat(sessionId) {
  return request({ url: `/listen-sessions/${sessionId}`, method: 'PATCH' });
}

/**
 * Records a pre-roll ad outcome.
 *
 * Called by components/player/PrerollAd.jsx once per impression, from the two
 * handlers the legacy player used (`adSkipped` and `adComplete`).
 *
 * Two things differ from the legacy call. It sent the ad DESCRIPTION as the
 * watched seconds on completion (`player.php:138`), which was a bug — the real
 * playhead position is sent in both cases here, and `eventType` says which
 * outcome it was. And `adId` identifies the creative, which the legacy row could
 * not: ads were files on disk with nothing to reference.
 *
 * A failed report must never interrupt playback, so callers fire and forget.
 *
 * @param {{adId?: string, title?: string, watchedSecond?: number,
 *          eventType?: 'skipped'|'completed'}} event
 */
export function recordAdEvent(event) {
  return request({ url: '/ads-events', method: 'POST', data: event });
}

export default {
  createWatchSession,
  sendWatchHeartbeat,
  createListenSession,
  sendListenHeartbeat,
  recordAdEvent,
};
