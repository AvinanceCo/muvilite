/**
 * MusicGenre — NEW, no legacy table.
 *
 * Purpose: the genre taxonomy for music. Separate from `Genre`, which is the
 *          FILM taxonomy.
 * Inputs:  admin CRUD
 * Outputs: MusicGenre documents
 * Deps:    plugins/softDelete
 *
 * NO LEGACY ANCESTOR. `musics_tbl` had no genre column and the legacy music form
 * (admin/.../views/musics/form.php) had no such field; music was organised by
 * music CATEGORY alone. Added at the maintainer's request.
 *
 * WHY A SECOND COLLECTION rather than reusing `Genre`: the two vocabularies do
 * not overlap. «کمدی» and «مستند» are not music genres and «پاپ» is not a film
 * genre, so one shared list would put nonsense in both dropdowns — and `Genre`
 * is load-bearing for films (the public movie query inner-joins `genre_1` and
 * "similar movies" matches on it), which is not a thing to start mixing values
 * into.
 *
 * `colorClass` is deliberately absent, unlike `Genre`. There it is a legacy CSS
 * class the film chips were coloured with; music genres are not rendered on the
 * passenger site at all, so the field would have no consumer.
 */
import mongoose from 'mongoose';
import softDeletePlugin from './plugins/softDelete.js';

const musicGenreSchema = new mongoose.Schema(
  {
    nameFa: { type: String, required: true, trim: true },
    nameEn: { type: String, trim: true, default: '' },
  },
  { timestamps: true },
);

musicGenreSchema.plugin(softDeletePlugin);
musicGenreSchema.index({ nameFa: 1 });

export const MusicGenre = mongoose.model('MusicGenre', musicGenreSchema);
export default MusicGenre;
