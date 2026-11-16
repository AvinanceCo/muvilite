/**
 * WatchTrendDaily — legacy `watch_history_trend_daily_tbl`.
 *
 * Purpose: precomputed daily viewing statistics per movie, written by the
 *          nightly aggregation job so admin reporting does not scan the raw
 *          history collection.
 * Inputs:  jobs/watchTrendDaily.job.js
 * Outputs: WatchTrendDaily documents
 * Deps:    plugins/softDelete
 *
 * Legacy source: admin/3P1z05m4n4Gm3nt/includes/crons/watch_history_daily.php,
 * which inserted movie_id, sum_watched_second, mid_last_second, total_count,
 * comment, platform_count_web, platform_count_android, platform_count_ios,
 * platform_count_android_tv, platform_count_web_tv, created_date.
 *
 * Computation preserved: `sum_watched_second` is the SUM of watched_second over
 * the window, `mid_last_second` the integer MEAN of last_second, `total_count`
 * the row count, and the five platform counters are buckets of user_platform.
 *
 * Two legacy defects are fixed in the job rather than reproduced: the mean
 * divided by zero on an empty set, and re-running the script duplicated rows
 * because nothing keyed on the window. The unique index below is what makes the
 * job idempotent.
 */
import mongoose from 'mongoose';
import softDeletePlugin from './plugins/softDelete.js';

const watchTrendDailySchema = new mongoose.Schema(
  {
    movie: { type: mongoose.Schema.Types.ObjectId, ref: 'Movie', required: true, index: true },

    /** Inclusive start of the aggregated window; identifies the bucket. */
    windowStart: { type: Date, required: true, index: true },
    windowEnd: { type: Date, required: true },

    sumWatchedSecond: { type: Number, default: 0 },
    /** Integer mean of lastSecond across the window's sessions. */
    midLastSecond: { type: Number, default: 0 },
    totalCount: { type: Number, default: 0 },

    platformCountWeb: { type: Number, default: 0 },
    platformCountAndroid: { type: Number, default: 0 },
    platformCountIos: { type: Number, default: 0 },
    platformCountAndroidTv: { type: Number, default: 0 },
    platformCountWebTv: { type: Number, default: 0 },

    /** Free-text annotation. legacy: watch_history_trend_daily_tbl.comment */
    comment: { type: String, default: '' },
  },
  { timestamps: true },
);

watchTrendDailySchema.plugin(softDeletePlugin);

// One row per movie per window — makes a re-run overwrite instead of duplicate.
watchTrendDailySchema.index({ movie: 1, windowStart: 1 }, { unique: true });

export const WatchTrendDaily = mongoose.model('WatchTrendDaily', watchTrendDailySchema);
export default WatchTrendDaily;
