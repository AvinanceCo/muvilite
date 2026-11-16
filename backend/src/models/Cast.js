/**
 * Cast — legacy `casts_tbl`.
 *
 * Purpose: people credited on a movie (actors, directors, writers, ...).
 * Inputs:  admin CRUD, portrait uploads
 * Outputs: Cast documents
 * Deps:    plugins/softDelete
 *
 * Columns from admin/3P1z05m4n4Gm3nt/models/MovieModel.php::getCasts and
 * api/v2/models/Movie.php::casts — id, fullname_fa, fullname_en, birth_date,
 * brief_fa, brief_en, is_active, is_delete.
 */
import mongoose from 'mongoose';
import softDeletePlugin from './plugins/softDelete.js';

const castSchema = new mongoose.Schema(
  {
    fullnameFa: { type: String, required: true, trim: true },
    fullnameEn: { type: String, trim: true, default: '' },
    birthDate: { type: Date, default: null },
    briefFa: { type: String, default: '' },
    briefEn: { type: String, default: '' },
    /** Legacy served portraits from assets/casts/{id}.jpg. */
    photoPath: { type: String, default: null },
  },
  { timestamps: true },
);

castSchema.plugin(softDeletePlugin);
castSchema.index({ fullnameFa: 'text', fullnameEn: 'text' });

export const Cast = mongoose.model('Cast', castSchema);
export default Cast;
