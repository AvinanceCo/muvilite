/**
 * Category — legacy `categories_tbl`.
 *
 * Purpose: a curated collection of movies, surfaced as a home-page rail and as
 *          its own listing page.
 * Inputs:  admin CRUD
 * Outputs: Category documents
 * Deps:    plugins/softDelete
 *
 * Columns from api/v2/models/PageBlock.php::getCategory and
 * api/v2/index.php::categories — id, name_fa, name_en, icon, style,
 * is_active, is_delete.
 */
import mongoose from 'mongoose';
import softDeletePlugin from './plugins/softDelete.js';

const categorySchema = new mongoose.Schema(
  {
    nameFa: { type: String, required: true, trim: true },
    nameEn: { type: String, trim: true, default: '' },
    /** Icon class/path shown beside the rail heading. */
    icon: { type: String, trim: true, default: '' },
    /** Presentation hint consumed by the rail renderer. */
    style: { type: String, trim: true, default: '' },
  },
  { timestamps: true },
);

categorySchema.plugin(softDeletePlugin);

export const Category = mongoose.model('Category', categorySchema);
export default Category;
