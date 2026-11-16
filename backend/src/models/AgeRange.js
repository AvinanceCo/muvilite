/**
 * AgeRange — legacy `age_range_tbl`.
 *
 * Purpose: content age rating attached to a movie.
 * Inputs:  admin CRUD
 * Outputs: AgeRange documents
 * Deps:    plugins/softDelete
 *
 * Columns seen in legacy SQL: id, name_fa, name_en, is_delete
 * (`SELECT name_en AS en, name_fa AS fa FROM age_range_tbl WHERE is_delete = 0
 *   AND id = ...` in api/v2/index.php::movie).
 */
import mongoose from 'mongoose';
import softDeletePlugin from './plugins/softDelete.js';

const ageRangeSchema = new mongoose.Schema(
  {
    nameFa: { type: String, required: true, trim: true },
    nameEn: { type: String, trim: true, default: '' },
    description: { type: String, trim: true, default: '' },
  },
  { timestamps: true },
);

ageRangeSchema.plugin(softDeletePlugin);

export const AgeRange = mongoose.model('AgeRange', ageRangeSchema);
export default AgeRange;
