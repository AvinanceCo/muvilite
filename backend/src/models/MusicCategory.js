/**
 * MusicCategory — legacy `music_categories_tbl`.
 *
 * Purpose: a curated collection of music entries, mirroring Category but for
 *          the music side of the catalog.
 * Inputs:  admin CRUD
 * Outputs: MusicCategory documents
 * Deps:    plugins/softDelete
 *
 * Source: api/v2/models/PageBlock.php::getMusicCategory,
 *         api/v2/index.php::music_categories.
 */
import mongoose from 'mongoose';
import softDeletePlugin from './plugins/softDelete.js';

const musicCategorySchema = new mongoose.Schema(
  {
    nameFa: { type: String, required: true, trim: true },
    nameEn: { type: String, trim: true, default: '' },
    icon: { type: String, trim: true, default: '' },
    style: { type: String, trim: true, default: '' },
  },
  { timestamps: true },
);

musicCategorySchema.plugin(softDeletePlugin);

export const MusicCategory = mongoose.model('MusicCategory', musicCategorySchema);
export default MusicCategory;
