/**
 * GameGenre — NEW, no legacy table.
 *
 * Purpose: the genre taxonomy for HTML5 games. A third list, separate from
 *          `Genre` (films) and `MusicGenre` (music).
 * Inputs:  admin CRUD
 * Outputs: GameGenre documents
 * Deps:    plugins/softDelete
 *
 * NO LEGACY ANCESTOR — the legacy application had no games at all. The shape is
 * Playva's `Genre` model (`name`, `name_en`), renamed to this codebase's
 * `nameFa` / `nameEn` so a game genre reads like every other taxonomy here.
 *
 * WHY A THIRD COLLECTION, for the same reason `MusicGenre` is a second one: the
 * vocabularies do not overlap. «آرکید» and «پازل» are not film genres and «درام»
 * is not a game genre, and `Genre` is load-bearing for films — the public movie
 * query inner-joins it.
 *
 * Unlike a music genre, this one IS rendered on the passenger site: it is the
 * filter row on the games page and the label on every game card.
 */
import mongoose from 'mongoose';
import softDeletePlugin from './plugins/softDelete.js';

const gameGenreSchema = new mongoose.Schema(
  {
    nameFa: { type: String, required: true, trim: true },
    nameEn: { type: String, trim: true, default: '' },
  },
  { timestamps: true },
);

gameGenreSchema.plugin(softDeletePlugin);
gameGenreSchema.index({ nameFa: 1 });

export const GameGenre = mongoose.model('GameGenre', gameGenreSchema);
export default GameGenre;
