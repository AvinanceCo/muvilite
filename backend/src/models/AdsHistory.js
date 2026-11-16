/**
 * AdsHistory — legacy `ads_history_tbl`.
 *
 * Purpose: telemetry for the VAST pre-roll ads shown before playback. The
 *          player reported both skips and completions to the same endpoint.
 * Inputs:  public ads-event endpoint
 * Outputs: AdsHistory documents
 * Deps:    plugins/softDelete
 *
 * Legacy behaviour (api/v2/index.php::ads_add, player.php):
 *   INSERT INTO ads_history_tbl (title, watched_second, user_ip)
 * fired from the player's `adSkipped` and `adComplete` handlers.
 *
 * The legacy client sent the ad *description* as `second` on completion — a
 * client bug. `watchedSecond` is numeric-validated here, and `eventType`
 * distinguishes a skip from a completion, which the legacy row could not.
 */
import mongoose from 'mongoose';
import softDeletePlugin from './plugins/softDelete.js';

export const AD_EVENT_TYPES = Object.freeze(['skipped', 'completed']);

const adsHistorySchema = new mongoose.Schema(
  {
    /**
     * The creative this event belongs to.
     *
     * Null for every legacy row: ads were files on disk with nothing to
     * reference, so `title` was the only identifier and two campaigns sharing a
     * name were indistinguishable. Now that creatives are records (VideoAd) the
     * player reports the id alongside the title, and `title` is still stored so
     * old rows and new ones read the same way in the report.
     */
    ad: { type: mongoose.Schema.Types.ObjectId, ref: 'VideoAd', default: null, index: true },

    /** Ad creative title reported by the player. legacy: ads_history_tbl.title */
    title: { type: String, trim: true, default: '' },
    watchedSecond: { type: Number, default: 0, min: 0 },
    eventType: { type: String, enum: AD_EVENT_TYPES, default: 'completed' },
    userIp: { type: String, default: null },
  },
  { timestamps: true },
);

adsHistorySchema.plugin(softDeletePlugin);
adsHistorySchema.index({ createdAt: -1 });

export const AdsHistory = mongoose.model('AdsHistory', adsHistorySchema);
export default AdsHistory;
