/**
 * Daily watch-trend aggregation job.
 *
 * Purpose: roll the trailing 24 hours of watch history into one row per movie,
 *          so admin reporting reads a small precomputed collection instead of
 *          scanning raw sessions.
 * Inputs:  an optional window end (defaults to now)
 * Outputs: upserted WatchTrendDaily documents
 * Deps:    models, config/constants, utils/logger
 *
 * Legacy source: admin/3P1z05m4n4Gm3nt/includes/crons/watch_history_daily.php.
 *
 * Legacy computation, preserved exactly:
 *   sum_watched_second  = SUM(watched_second)
 *   mid_last_second     = integer MEAN(last_second)
 *   total_count         = row count
 *   platform_count_*    = counts bucketed from user_platform
 *                         (0 web, 1 android, 2 ios, 3 android tv, 4 web tv)
 * over the window [now - 1 day, now], restricted to sessions with
 * watched_second > 0.
 *
 * Three legacy defects are fixed:
 *
 * 1. NOT IDEMPOTENT. The script INSERTed unconditionally, so running it twice
 *    (or re-running after a failure) duplicated every row. This upserts on
 *    (movie, windowStart).
 * 2. DIVIDE BY ZERO. `general_calculate()` divided by the row count without
 *    checking it, so an empty group produced a warning and a bad average.
 * 3. N+1 QUERIES. It ran a GROUP BY to find movies, then a full SELECT per
 *    movie. This is a single aggregation.
 *
 * The legacy script also had no CLI guard and printed HTML, so it was reachable
 * over the web. This module is importable only; the HTTP surface is gone.
 */
import mongoose from 'mongoose';
import { WatchHistory, WatchTrendDaily } from '../models/index.js';
import { PLATFORM_COUNTER_FIELD, DEVICE_PLATFORMS } from '../config/constants.js';
import logger from '../utils/logger.js';

/** Window length. legacy: `date(strtotime("-1 days", time()))`. */
export const WINDOW_HOURS = 24;

/** Midnight UTC at the start of the day the given instant falls in. */
function startOfUtcDay(instant) {
  return new Date(
    Date.UTC(instant.getUTCFullYear(), instant.getUTCMonth(), instant.getUTCDate(), 0, 0, 0, 0),
  );
}

/**
 * Resolves the calendar day to aggregate.
 *
 * DIVERGENCE FROM LEGACY, and the reason for it: the legacy script aggregated
 * `[now - 24h, now]`, a window anchored to the moment of invocation. That makes
 * the bucket unidentifiable — two runs minutes apart describe different,
 * overlapping windows — so there is no key on which a re-run can be recognised
 * as the same work. Combined with its unconditional INSERT, every run appended
 * a fresh duplicate set of rows.
 *
 * Aggregating a whole UTC calendar day instead gives the bucket a stable
 * identity, which is what makes the (movie, windowStart) upsert idempotent. The
 * legacy job was invoked daily from cron, so a daily bucket is its intent; only
 * the alignment changes.
 *
 * @param {Date} [reference=new Date()] any instant inside, or after, the day wanted
 * @param {boolean} [previousDay=true] aggregate the last COMPLETE day
 */
export function resolveWindow(reference = new Date(), previousDay = true) {
  const today = startOfUtcDay(reference);
  const windowEnd = previousDay ? today : new Date(today.getTime() + WINDOW_HOURS * 3_600_000);
  const windowStart = new Date(windowEnd.getTime() - WINDOW_HOURS * 3_600_000);
  return { windowStart, windowEnd };
}

/**
 * Aggregates one day and upserts the results.
 *
 * @param {object}  [options]
 * @param {Date}    [options.date]  any instant in/after the day to aggregate
 * @param {boolean} [options.previousDay=true]  aggregate the last complete day;
 *                  pass false to aggregate the day in progress
 * @returns {Promise<{windowStart: Date, windowEnd: Date, movies: number}>}
 */
export async function runWatchTrendDaily({ date = new Date(), previousDay = true } = {}) {
  const { windowStart, windowEnd } = resolveWindow(date, previousDay);

  logger.info(`watch-trend: aggregating ${windowStart.toISOString()} .. ${windowEnd.toISOString()}`);

  const groups = await WatchHistory.aggregate([
    {
      $match: {
        isDeleted: false,
        // legacy: only sessions that actually played are counted.
        watchedSecond: { $gt: 0 },
        // Half-open interval, so consecutive days cannot both claim a session
        // landing exactly on midnight.
        createdAt: { $gte: windowStart, $lt: windowEnd },
      },
    },
    {
      $group: {
        _id: '$movie',
        sumWatchedSecond: { $sum: '$watchedSecond' },
        // $avg ignores an empty set rather than dividing by zero.
        avgLastSecond: { $avg: '$lastSecond' },
        totalCount: { $sum: 1 },
        platforms: { $push: '$userPlatform' },
      },
    },
  ]);

  if (groups.length === 0) {
    logger.info('watch-trend: no sessions in window, nothing to write');
    return { windowStart, windowEnd, movies: 0 };
  }

  const operations = groups.map((group) => {
    // Start every counter at zero so a platform with no sessions is recorded
    // as 0 rather than being absent.
    const counters = Object.fromEntries(
      Object.values(PLATFORM_COUNTER_FIELD).map((field) => [field, 0]),
    );

    for (const platform of group.platforms) {
      const field = PLATFORM_COUNTER_FIELD[platform] ?? PLATFORM_COUNTER_FIELD[DEVICE_PLATFORMS.WEB];
      counters[field] += 1;
    }

    return {
      updateOne: {
        filter: { movie: group._id, windowStart },
        update: {
          $set: {
            movie: group._id,
            windowStart,
            windowEnd,
            sumWatchedSecond: group.sumWatchedSecond,
            // legacy stored an integer mean.
            midLastSecond: Math.floor(group.avgLastSecond ?? 0),
            totalCount: group.totalCount,
            ...counters,
          },
        },
        upsert: true,
      },
    };
  });

  await WatchTrendDaily.bulkWrite(operations, { ordered: false });

  logger.info(`watch-trend: wrote ${operations.length} movie rows`);

  return { windowStart, windowEnd, movies: operations.length };
}

/**
 * Standalone entry point, for `npm run cron:watch-trends`.
 * Opens its own connection so it can run outside the server process, which is
 * how the legacy script was invoked from crontab.
 */
export async function runStandalone(mongodbUri, options = {}) {
  await mongoose.connect(mongodbUri);
  try {
    return await runWatchTrendDaily(options);
  } finally {
    await mongoose.disconnect();
  }
}

export default { runWatchTrendDaily, runStandalone, resolveWindow, WINDOW_HOURS };
