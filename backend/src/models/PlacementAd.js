/**
 * PlacementAd — a still advertisement in a fixed landing-page slot.
 *
 * Purpose: make the two hardcoded home-page ad strips editable.
 * Inputs:  admin CRUD + two image uploads
 * Outputs: PlacementAd documents
 * Deps:    plugins/softDelete, config/constants
 *
 * NEW TABLE — there was no legacy equivalent. `index.php` carried the two slots
 * as literal markup (lines 23-27 and 108-112):
 *
 *     <div class="ads">
 *       <!--  size : 750x150 -->
 *       <a href="/assets/page/index/top.mp4"><img src="/assets/page/index/top.gif" /></a>
 *       <a href="/assets/page/index/top.mp4"><img src="/assets/page/index/top.gif" /></a>
 *     </div>
 *
 * Two anchors, not one, and the stylesheet chose between them by viewport
 * orientation — `.ads>a:last-child{display:none}` normally, and under
 * `@media (orientation:landscape)` the reverse. So each slot has always had a
 * PORTRAIT artwork and a LANDSCAPE artwork; that installation just happened to
 * point both at the same GIF. `imagePath` and `imageLandscapePath` are those two
 * anchors, and the landscape one falls back to the portrait when unset, which is
 * exactly what shipping the same file twice achieved.
 *
 * GIF is a supported upload type (middleware/upload.js), so the animated
 * creatives the legacy slots used still work.
 *
 * This is deliberately NOT the Banner collection. Banners belong to a banner
 * category and are placed by a page block; these two slots are fixed furniture
 * on one page, which is why the legacy app kept them apart too.
 */
import mongoose from 'mongoose';
import softDeletePlugin from './plugins/softDelete.js';
import { AD_PLACEMENTS } from '../config/constants.js';

const placementAdSchema = new mongoose.Schema(
  {
    /** Internal label, and the image's alt text. */
    titleFa: { type: String, trim: true, default: '' },

    /** Which of the two slots this fills. */
    placement: { type: String, enum: AD_PLACEMENTS, required: true, index: true },

    /** Portrait artwork — the legacy first anchor. */
    imagePath: { type: String, default: null },

    /** Landscape artwork — the legacy second anchor. Falls back to imagePath. */
    imageLandscapePath: { type: String, default: null },

    /**
     * Click-through target. The legacy slots linked to a local MP4; an empty
     * value renders a plain figure rather than a dead link.
     */
    url: { type: String, trim: true, default: '' },

    /** Display order within a slot. Lower first. */
    order: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

placementAdSchema.plugin(softDeletePlugin);

// The serving query is "active rows for a slot, in order".
placementAdSchema.index({ isDeleted: 1, isActive: 1, placement: 1, order: 1 });

export const PlacementAd = mongoose.model('PlacementAd', placementAdSchema);
export default PlacementAd;
