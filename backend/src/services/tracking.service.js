/**
 * Tracking service — playback, listening and ad telemetry.
 *
 * Purpose: reproduce `watch_add`, `watch_update`, `listen_update` and `ads_add`
 *          from api/v2/index.php.
 * Inputs:  media ids, session ids, client IP, platform
 * Outputs: session records and heartbeat acknowledgements
 * Deps:    repositories, config/constants, utils/ApiError
 *
 * How the legacy heartbeat worked:
 *   1. the player page called `watch_add`, which INSERTed a watch_history_tbl
 *      row with watched_second = 0 and returned lastInsertId() together with
 *      `interval_second` (30);
 *   2. on play, the client started setInterval(interval_second * 1000) calling
 *      `watch_update&id=<that id>`, which did
 *      `watched_second = watched_second + 30`;
 *   3. the interval was cleared on pause/stop/error/idle/complete.
 *
 * Each heartbeat therefore credits a FIXED chunk, not elapsed wall time. That
 * is preserved: the client cannot choose how many seconds to add.
 */
import {
  watchHistoryRepository,
  listenHistoryRepository,
  adsHistoryRepository,
  movieRepository,
  musicRepository,
} from '../repositories/index.js';
import {
  WATCH_CHUNK_SECONDS,
  LISTEN_CHUNK_SECONDS,
  DEVICE_PLATFORMS,
} from '../config/constants.js';
import ApiError from '../utils/ApiError.js';

/**
 * Opens a watch session.
 * legacy: `watch_add` — 404s when the movie is missing or inactive, before the
 * INSERT.
 */
export async function startWatchSession({ movieId, userIp, platform }) {
  const movie = await movieRepository.findById(movieId, {
    select: 'titleFa titleEn imdbRank movieLength posterPath videoPath videoStatus',
  });
  if (!movie) {
    throw ApiError.notFound('Movie not found');
  }

  const session = await watchHistoryRepository.create({
    movie: movie._id,
    userIp,
    watchedSecond: 0,
    lastSecond: 0,
    userPlatform: platform ?? DEVICE_PLATFORMS.WEB,
  });

  // The legacy endpoint bumped nothing here; visit_count was a sortable column
  // that the public code never wrote. Counting a play as a visit is the only
  // way the column is ever populated, so it is incremented at session start.
  await movieRepository.incrementVisitCount(movie._id);

  return {
    sessionId: session._id,
    /** Seconds the client should wait between heartbeats. legacy: interval_second */
    intervalSecond: WATCH_CHUNK_SECONDS,
    movie: {
      id: movie._id,
      titleFa: movie.titleFa,
      titleEn: movie.titleEn,
      imdbRank: movie.imdbRank,
      movieLength: movie.movieLength,
      // The legacy player derived both from the row id (assets/movies/{id}.jpg,
      // assets/video/{id}.mp4); paths are stored fields now, so they are
      // returned with the session the player is about to start.
      posterPath: movie.posterPath,
      videoPath: movie.videoPath,
      // NEW: lets the player say "being prepared" instead of "no file" while
      // a title's first upload is still being transcoded to HLS. Only the
      // coarse state — the operator-facing error text is never sent here.
      videoStatus: movie.videoStatus ?? 'none',
    },
  };
}

/**
 * Records one watch heartbeat.
 * legacy: `watch_update` — adds exactly WATCH_CHUNK_SECONDS.
 *
 * `lastSecond` is an optional client-reported playback position. The legacy
 * column existed and was averaged by the daily trend job, but no public
 * endpoint ever set it; accepting it here is what makes that average meaningful.
 */
export async function recordWatchHeartbeat(sessionId, { lastSecond } = {}) {
  const extraSet = {};
  if (Number.isFinite(lastSecond)) {
    extraSet.lastSecond = lastSecond;
  }

  const session = await watchHistoryRepository.incrementById(
    sessionId,
    { watchedSecond: WATCH_CHUNK_SECONDS },
    extraSet,
  );

  if (!session) {
    throw ApiError.notFound('Watch session not found');
  }

  return {
    sessionId: session._id,
    watchedSecond: session.watchedSecond,
    intervalSecond: WATCH_CHUNK_SECONDS,
  };
}

/**
 * Opens a listen session.
 *
 * legacy: the INSERT into listen_history_tbl was a side effect of the `music`
 * detail endpoint. It is a separate explicit call here so that reading metadata
 * no longer writes a row — otherwise every crawler hit inflates the stats.
 */
export async function startListenSession({ musicId, userIp }) {
  const music = await musicRepository.findById(musicId, { select: 'fullnameFa albumFa' });
  if (!music) {
    throw ApiError.notFound('Music not found');
  }

  const session = await listenHistoryRepository.create({
    music: music._id,
    userIp,
    listenedSecond: 0,
  });

  await musicRepository.incrementVisitCount(music._id);

  return { sessionId: session._id, intervalSecond: LISTEN_CHUNK_SECONDS };
}

/**
 * Records one listen heartbeat.
 * legacy: `listen_update` — adds exactly LISTEN_CHUNK_SECONDS.
 */
export async function recordListenHeartbeat(sessionId) {
  const session = await listenHistoryRepository.incrementById(sessionId, {
    listenedSecond: LISTEN_CHUNK_SECONDS,
  });

  if (!session) {
    throw ApiError.notFound('Listen session not found');
  }

  return {
    sessionId: session._id,
    listenedSecond: session.listenedSecond,
    intervalSecond: LISTEN_CHUNK_SECONDS,
  };
}

/**
 * Records a pre-roll ad outcome.
 *
 * legacy: `ads_add` was called from both the player's `adSkipped` and
 * `adComplete` handlers with `title` and `second`. The completion path
 * mistakenly sent the ad description as `second`; `watchedSecond` is validated
 * as a number here and `eventType` distinguishes the two cases, which the
 * legacy row could not.
 *
 * `adId` is new and optional. Legacy ads were files with nothing to reference,
 * so the free-text title was the only identifier and two creatives sharing a
 * name were indistinguishable in the report. Creatives are records now
 * (models/VideoAd.js) and the player reports which one played; the title is
 * still stored so legacy rows and new ones read alike.
 */
export async function recordAdEvent({ adId, title, watchedSecond, eventType, userIp }) {
  const event = await adsHistoryRepository.create({
    ad: adId ?? null,
    title,
    watchedSecond: Number.isFinite(watchedSecond) ? watchedSecond : 0,
    eventType,
    userIp,
  });

  return { id: event._id };
}

export default {
  startWatchSession,
  recordWatchHeartbeat,
  startListenSession,
  recordListenHeartbeat,
  recordAdEvent,
};
