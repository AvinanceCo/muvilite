/**
 * Playback session hooks — watch and listen telemetry.
 *
 * Purpose: open a session for a piece of media and beat while it plays.
 * Inputs:  a media id, and play/pause/stop calls from the player
 * Outputs: { sessionId, start, stop, error }
 * Deps:    api/tracking
 *
 * The legacy lifecycle, reproduced exactly (player2.php and sound.php):
 *
 *   1. the page opens a session, which returns its id and `interval_second`;
 *   2. on play/resume the client starts setInterval(interval_second * 1000);
 *   3. the interval is CLEARED on pause, stop, error, idle and complete.
 *
 * So a heartbeat is sent only while media is actually moving, and each beat
 * credits a fixed chunk server-side (30s video, 15s audio) regardless of how
 * much time really passed. A tab left paused for an hour adds nothing, which is
 * the behaviour the watch totals have always had.
 *
 * DEFECT NOT REPRODUCED: player2.php sent the MOVIE id where the session id
 * belonged, so every heartbeat targeted the wrong row. The session id is a path
 * parameter now, which makes that mistake unrepresentable.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createWatchSession,
  sendWatchHeartbeat,
  createListenSession,
  sendListenHeartbeat,
} from '../api/tracking.js';
import { PLATFORM_WEB } from '../utils/constants.js';

/**
 * Shared session machinery. `open` creates the session, `beat` sends one
 * heartbeat; the caller supplies both so watch and listen can differ.
 */
function useSession({ mediaId, open, beat, getPosition }) {
  const [sessionId, setSessionId] = useState(null);
  const [error, setError] = useState(null);

  const intervalRef = useRef(null);
  const sessionRef = useRef(null);
  const intervalSecondRef = useRef(null);
  // Guards against two `start()` calls racing into two sessions — a real risk,
  // since some browsers fire `play` more than once on a single tap.
  const openingRef = useRef(false);
  const mountedRef = useRef(true);

  const clear = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // A session belongs to one piece of media; changing media ends the old one.
  useEffect(() => {
    sessionRef.current = null;
    intervalSecondRef.current = null;
    openingRef.current = false;
    setSessionId(null);
    setError(null);
    return clear;
  }, [mediaId, clear]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clear();
    };
  }, [clear]);

  const schedule = useCallback(() => {
    clear();
    const seconds = intervalSecondRef.current;
    if (!sessionRef.current || !seconds) return;

    intervalRef.current = setInterval(() => {
      beat(sessionRef.current, getPosition?.()).catch(() => {
        // A dropped heartbeat is not worth interrupting playback over — the
        // aircraft link is unreliable by nature. The next beat retries.
      });
    }, seconds * 1000);
  }, [beat, clear, getPosition]);

  /** Call on play/resume. Opens the session on first use, then beats. */
  const start = useCallback(async () => {
    if (!mediaId) return;

    if (!sessionRef.current) {
      if (openingRef.current) return;
      openingRef.current = true;
      try {
        const session = await open(mediaId);
        if (!mountedRef.current) return;
        sessionRef.current = session.sessionId;
        intervalSecondRef.current = session.intervalSecond;
        setSessionId(session.sessionId);
      } catch (caught) {
        if (mountedRef.current) setError(caught);
        return;
      } finally {
        openingRef.current = false;
      }
    }

    schedule();
  }, [mediaId, open, schedule]);

  /** Call on pause, stop, error, idle and complete. */
  const stop = useCallback(() => clear(), [clear]);

  return { sessionId, start, stop, error };
}

/**
 * Watch telemetry for a movie. Heartbeat interval comes from the server
 * (30s); each beat credits exactly that much.
 *
 * @param {string} movieId
 * @param {() => number} [getPosition] current playback position in seconds.
 *        Sent as `lastSecond`, which the daily trend job averages. The legacy
 *        client never sent it, so the column was always zero.
 */
export function useWatchSession(movieId, getPosition) {
  return useSession({
    mediaId: movieId,
    open: useCallback((id) => createWatchSession(id, PLATFORM_WEB), []),
    beat: useCallback((id, position) => sendWatchHeartbeat(id, position), []),
    getPosition,
  });
}

/**
 * Listen telemetry for an album. One session per album, matching the legacy
 * row: it was opened when the album was fetched, not per track.
 */
export function useListenSession(musicId) {
  return useSession({
    mediaId: musicId,
    open: useCallback((id) => createListenSession(id), []),
    beat: useCallback((id) => sendListenHeartbeat(id), []),
  });
}

export default { useWatchSession, useListenSession };
