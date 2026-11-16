/**
 * BannerCategoryRelation — legacy `banner_categories_relations_tbl`.
 *
 * Purpose: places a banner in a banner category, at a given position.
 * Inputs:  admin banner ordering UI
 * Outputs: BannerCategoryRelation documents
 * Deps:    plugins/softDelete
 *
 * Legacy columns: banner_id, banner_category_id, order_index, is_delete.
 * `order_index` lives here rather than on the banner, so the same banner can
 * appear at different positions in different categories.
 */
import mongoose from 'mongoose';
import softDeletePlugin from './plugins/softDelete.js';

const bannerCategoryRelationSchema = new mongoose.Schema(
  {
    banner: { type: mongoose.Schema.Types.ObjectId, ref: 'Banner', required: true, index: true },
    bannerCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BannerCategory',
      required: true,
      index: true,
    },
    orderIndex: { type: Number, default: 0 },
  },
  { timestamps: true },
);

bannerCategoryRelationSchema.plugin(softDeletePlugin);
bannerCategoryRelationSchema.index({ bannerCategory: 1, banner: 1 }, { unique: true });
bannerCategoryRelationSchema.index({ bannerCategory: 1, orderIndex: 1 });

export const BannerCategoryRelation = mongoose.model(
  'BannerCategoryRelation',
  bannerCategoryRelationSchema,
);
export default BannerCategoryRelation;
