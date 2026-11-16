/**
 * Banner — legacy `banner_tbl`.
 *
 * Purpose: a promotional slide shown in a banner rail.
 * Inputs:  admin CRUD + image upload
 * Outputs: Banner documents
 * Deps:    plugins/softDelete
 *
 * Columns from api/v2/models/PageBlock.php::getBanners:
 *   id, url, title_fa, subtitle_fa, label_fa, title_en, subtitle_en, label_en,
 *   is_active, is_delete — ordered by `order_index`, which lives on the
 *   banner<->category relation rather than the banner itself.
 *
 * The legacy image path was assets/banners/{id}.jpg; stored explicitly here so
 * uploads get unique filenames.
 */
import mongoose from 'mongoose';
import softDeletePlugin from './plugins/softDelete.js';

const bannerSchema = new mongoose.Schema(
  {
    titleFa: { type: String, trim: true, default: '' },
    titleEn: { type: String, trim: true, default: '' },
    subtitleFa: { type: String, trim: true, default: '' },
    subtitleEn: { type: String, trim: true, default: '' },
    labelFa: { type: String, trim: true, default: '' },
    labelEn: { type: String, trim: true, default: '' },
    /** Click-through target. Empty means the slide is not a link. */
    url: { type: String, trim: true, default: '' },
    imagePath: { type: String, default: null },
  },
  { timestamps: true },
);

bannerSchema.plugin(softDeletePlugin);

export const Banner = mongoose.model('Banner', bannerSchema);
export default Banner;
