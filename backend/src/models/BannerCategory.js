/**
 * BannerCategory — legacy `banner_categories_tbl`.
 *
 * Purpose: a named group of banners, referenced by a PageBlock of type
 *          'banner'. Its `type` drives the slide dimensions the client renders.
 * Inputs:  admin CRUD
 * Outputs: BannerCategory documents
 * Deps:    plugins/softDelete
 *
 * Legacy `type` values, from _layout/PageLayout.php::displayBanners:
 *   'full' -> 1920x720, 'long' -> 1920x360, 'item' -> 517x282.
 * Only 'full' and 'long' render navigation arrows and pagination, and only they
 * get the flush-to-top treatment when the block is first on the page.
 *
 * 'full' IS RETIRED — the maintainer withdrew the full-width banner. It stays in
 * the schema enum because rows already carry it and narrowing the enum would
 * make those documents fail validation on their next save; what changed is that
 * nothing may be SET to it any more (BANNER_CATEGORY_TYPES_AVAILABLE, which the
 * write validator uses) and no client offers it.
 */
import mongoose from 'mongoose';
import softDeletePlugin from './plugins/softDelete.js';

/** Every value the column may legally hold, including the retired one. */
export const BANNER_CATEGORY_TYPES = Object.freeze(['full', 'long', 'item']);

/**
 * The values a write may choose. Restoring the full-width banner is a matter of
 * putting 'full' back in this list and uncommenting its counterparts in
 * config/constants.js BANNER_IMAGE_SIZES, admin utils/constants.js and the
 * frontend's BannerRail.
 */
export const BANNER_CATEGORY_TYPES_AVAILABLE = Object.freeze([
  // 'full',  // retired — the full-width banner is no longer offered
  'long',
  'item',
]);

const bannerCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    type: { type: String, enum: BANNER_CATEGORY_TYPES, default: 'item' },
  },
  { timestamps: true },
);

bannerCategorySchema.plugin(softDeletePlugin);

export const BannerCategory = mongoose.model('BannerCategory', bannerCategorySchema);
export default BannerCategory;
