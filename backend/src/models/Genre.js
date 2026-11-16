/**
 * Genre — legacy `genres_tbl`.
 *
 * Purpose: film genre taxonomy. A movie carries up to three (genre_1..genre_3),
 *          and `genre_1` is load-bearing: the movie detail query inner-joins on
 *          it, and "similar movies" matches on it.
 * Inputs:  admin CRUD
 * Outputs: Genre documents
 * Deps:    plugins/softDelete
 *
 * Columns seen in legacy SQL: id, name_fa, name_en, color_class, is_active,
 * is_delete (api/v2/models/Movie.php::withGenre, movie.php genre lookups).
 */
import mongoose from 'mongoose';
import softDeletePlugin from './plugins/softDelete.js';

const genreSchema = new mongoose.Schema(
  {
    nameFa: { type: String, required: true, trim: true },
    nameEn: { type: String, trim: true, default: '' },
    /** CSS class used to colour the genre chip in the legacy UI. */
    colorClass: { type: String, trim: true, default: '' },
  },
  { timestamps: true },
);

genreSchema.plugin(softDeletePlugin);
genreSchema.index({ nameFa: 1 });

export const Genre = mongoose.model('Genre', genreSchema);
export default Genre;
