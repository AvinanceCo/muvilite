/**
 * MovieCast — legacy `movies_cast_tbl`.
 *
 * Purpose: join between a movie and a person, carrying the role they played.
 * Inputs:  admin movie-cast editor
 * Outputs: MovieCast documents
 * Deps:    plugins/softDelete, config/constants
 *
 * Legacy columns: row (PK), movie_id, cast_id, role, is_delete
 * (admin/3P1z05m4n4Gm3nt/models/MovieCastModel.php).
 *
 * `role` is an integer 0-6 mapped to Persian/English labels via CAST_ROLES.
 * The legacy cast list was ordered by this column, so the display order of
 * credits is role order (actors first, then director, and so on).
 */
import mongoose from 'mongoose';
import softDeletePlugin from './plugins/softDelete.js';
import { CAST_ROLE_VALUES } from '../config/constants.js';

const movieCastSchema = new mongoose.Schema(
  {
    movie: { type: mongoose.Schema.Types.ObjectId, ref: 'Movie', required: true, index: true },
    cast: { type: mongoose.Schema.Types.ObjectId, ref: 'Cast', required: true, index: true },
    role: { type: Number, required: true, enum: CAST_ROLE_VALUES },
  },
  { timestamps: true },
);

movieCastSchema.plugin(softDeletePlugin);

// One credit per person per role on a given title.
movieCastSchema.index({ movie: 1, cast: 1, role: 1 }, { unique: true });
movieCastSchema.index({ movie: 1, role: 1 });

export const MovieCast = mongoose.model('MovieCast', movieCastSchema);
export default MovieCast;
