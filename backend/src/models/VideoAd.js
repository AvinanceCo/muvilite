/**
 * VideoAd — the pre-roll creative shown before a movie.
 *
 * Purpose: make the ad break a managed record instead of a file on disk.
 * Inputs:  admin CRUD + video upload
 * Outputs: VideoAd documents
 * Deps:    plugins/softDelete, config/constants
 *
 * NEW TABLE — there was no legacy equivalent. The legacy pre-roll came from
 * five hand-written VAST 3.0 documents in `assets/ads/` alongside their MP4s,
 * and `player.php:40-41` picked one at random:
 *
 *     var randomm = Math.floor(Math.random() * 4) + 1;
 *     "advertising": { "client": "vast", "tag": "/assets/ads/vast"+randomm+".xml" }
 *
 * Adding an ad meant uploading an MP4 over FTP and hand-editing XML. Nothing in
 * the database described an ad; `ads_history_tbl` stored only the free-text
 * `<AdTitle>` the player reported back, with no key to join on.
 *
 * Each field below maps to the VAST element it replaces, so the generated tag
 * (services/ad.service.js) is the same document shape those five files had:
 *
 *   titleFa          -> <AdTitle>       (also what lands in AdsHistory.title)
 *   durationSecond   -> <Duration>      (legacy also duplicated it in <Description>)
 *   skipOffsetSecond -> Linear@skipoffset
 *   videoPath        -> <MediaFile>
 *   clickUrl         -> <ClickThrough>  (none of the legacy files had one)
 *
 * Two defects in the legacy set are not reproducible here: `vast1.xml` pointed
 * at `assets/ads/adVideo.mp4`, which does not exist, and `vast5.xml` could never
 * be selected because the random draw covered 1-4. A creative with no uploaded
 * file is simply not eligible, and selection covers every active row.
 */
import mongoose from 'mongoose';
import softDeletePlugin from './plugins/softDelete.js';
import { AD_SKIP_OFFSET_SECONDS } from '../config/constants.js';

const videoAdSchema = new mongoose.Schema(
  {
    /**
     * The advertiser-facing name. Required, because it is the only identifier
     * carried into the telemetry row the player writes back.
     */
    titleFa: { type: String, trim: true, required: true, maxlength: 255 },
    titleEn: { type: String, trim: true, default: '' },

    /** Uploaded MP4/WebM. Null until a file is attached; unplayable until then. */
    videoPath: { type: String, default: null },

    /** Advertised length in seconds. Filled from the file on upload. */
    durationSecond: { type: Number, default: 0, min: 0 },

    /** Seconds before the skip control appears. legacy: skipoffset="00:00:03". */
    skipOffsetSecond: { type: Number, default: AD_SKIP_OFFSET_SECONDS, min: 0 },

    /** Optional click-through. Empty means the creative is not clickable. */
    clickUrl: { type: String, trim: true, default: '' },

    /**
     * Relative selection weight. All-equal weights reproduce the legacy uniform
     * draw exactly; a higher number buys proportionally more impressions.
     * Zero excludes a creative from selection without deactivating it.
     */
    weight: { type: Number, default: 1, min: 0, max: 1000 },
  },
  { timestamps: true },
);

videoAdSchema.plugin(softDeletePlugin);

// The serving query is "active, not deleted, has a file", asked once per play.
videoAdSchema.index({ isDeleted: 1, isActive: 1, videoPath: 1 });

export const VideoAd = mongoose.model('VideoAd', videoAdSchema);
export default VideoAd;
