/**
 * Game — NEW, no legacy table.
 *
 * Purpose: one HTML5 game: the static bundle a passenger plays in an iframe, and
 *          the handful of fields its card is drawn from.
 * Inputs:  the admin upload (a ZIP) and the admin edit form
 * Outputs: Game documents
 * Deps:    plugins/softDelete, config/constants
 *
 * NO LEGACY ANCESTOR. The fields are Playva's (`playva-backend/models/Game.js`),
 * field for field, with two deliberate differences:
 *
 *   1. THE LEADERBOARD IS NOT HERE. Playva carries `leaderboardEnabled`,
 *      `scoreOrder`, `scoreLabel`, `scoreFormat`, `minScore`, `maxScore`, a
 *      `Score` collection and a script injected into every game page to report
 *      scores. None of it was asked for, and none of it is carried over — a game
 *      here is served exactly as it was uploaded.
 *   2. The soft-delete/active flags every content collection here has
 *      (`isActive`, `isDeleted`). Playva deletes the row; this codebase flags it.
 *
 * A GAME HAS NO IMAGE. Its card is an emoji on a gradient from `color1` to
 * `color2` — Playva's design, kept because it means a game needs no artwork to
 * be prepared and nothing extra to download on a cabin link.
 *
 * `folderName` is the operator's slug for the game and the stem of the directory
 * its bundle is unpacked into. `gameUrl` is the stored path of the bundle's
 * `index.html`, e.g. `/uploads/games/snake-1a2b3c4d/index.html`. It is a STORED
 * field, like every media path in this application: the directory carries a
 * random suffix, so the URL cannot be rebuilt from `folderName`
 * (services/gameBundle.service.js explains why).
 *
 * `clicks` counts how many times the game has been opened — Playva's name for
 * it, and what "popular" sorts on.
 */
import mongoose from 'mongoose';
import softDeletePlugin from './plugins/softDelete.js';
import { GAME_DEFAULTS } from '../config/constants.js';

const { Schema } = mongoose;

const gameSchema = new Schema(
  {
    titleFa: { type: String, required: true, trim: true },
    folderName: { type: String, required: true, trim: true },
    genre: { type: Schema.Types.ObjectId, ref: 'GameGenre', required: true },

    emoji: { type: String, trim: true, default: GAME_DEFAULTS.emoji },
    color1: { type: String, trim: true, default: GAME_DEFAULTS.color1 },
    color2: { type: String, trim: true, default: GAME_DEFAULTS.color2 },

    gameUrl: { type: String, required: true },
    clicks: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

gameSchema.plugin(softDeletePlugin);

// Unique among games that still exist. A deleted game keeps its row (soft
// delete) but must not hold its folder name hostage — re-uploading a fixed
// build under the same name is the ordinary way to repair a broken game.
gameSchema.index(
  { folderName: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } },
);
gameSchema.index({ genre: 1 });
gameSchema.index({ clicks: -1 });
gameSchema.index({ createdAt: -1 });

export const Game = mongoose.model('Game', gameSchema);
export default Game;
