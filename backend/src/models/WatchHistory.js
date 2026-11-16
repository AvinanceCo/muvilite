/**
 * WatchHistory — legacy `watch_history_tbl`.
 *
 * Purpose: one row per playback session. Created when the player loads, then
 *          incremented by a heartbeat while the video plays.
 * Inputs:  public watch-session endpoints
 * Outputs: WatchHistory documents
 * Deps:    plugins/softDelete, config/constants
 *
 * Legacy behaviour (api/v2/index.php::watch_add / ::watch_update):
 *   INSERT INTO watch_history_tbl (movie_id, user_ip, watched_second)
 *   VALUES (?, ?, 0)                                    -- watch_add
 *   UPDATE watch_history_tbl
 *      SET modified_date = ?, watched_second = watched_second + 30
 *    WHERE id = ?                                       -- watch_update
 *
 * The insert returns lastInsertId(), which the player then uses as the
 * heartbeat target — so the session id, not the movie id, identifies the row.
 * (legacy player2.php got this wrong and sent the movie id; the new API takes
 * the session id in the path, which makes the mistake unrepresentable.)
 *
 * There is no end-user login in this application, so sessions are attributed by
 * IP only, exactly as before.
 */
import mongoose from 'mongoose';
import softDeletePlugin from './plugins/softDelete.js';
import { DEVICE_PLATFORMS, DEVICE_PLATFORM_VALUES } from '../config/constants.js';

const watchHistorySchema = new mongoose.Schema(
  {
    movie: { type: mongoose.Schema.Types.ObjectId, ref: 'Movie', required: true, index: true },
    userIp: { type: String, default: null },

    /** Total seconds watched; grows by WATCH_CHUNK_SECONDS per heartbeat. */
    watchedSecond: { type: Number, default: 0, min: 0 },
    /** Furthest playback position reached, used for resume and trend averages. */
    lastSecond: { type: Number, default: 0, min: 0 },

    /** legacy: watch_history_tbl.user_platform, bucketed by the daily cron. */
    userPlatform: {
      type: Number,
      enum: DEVICE_PLATFORM_VALUES,
      default: DEVICE_PLATFORMS.WEB,
      index: true,
    },
  },
  { timestamps: true },
);

watchHistorySchema.plugin(softDeletePlugin);

// The daily trend job scans a time window and groups by movie.
watchHistorySchema.index({ createdAt: -1 });
watchHistorySchema.index({ createdAt: -1, watchedSecond: 1 });

export const WatchHistory = mongoose.model('WatchHistory', watchHistorySchema);
export default WatchHistory;
