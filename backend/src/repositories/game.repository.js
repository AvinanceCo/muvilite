/**
 * Game repository.
 *
 * Purpose: database access for the HTML5 games catalog.
 * Inputs:  filters, sort objects, pagination
 * Outputs: plain game documents
 * Deps:    models, repositories/BaseRepository
 *
 * No legacy counterpart — the legacy application had no games. The queries are
 * the ones Playva's `GET /api/games` ran (`playva-backend/routes/games.js`),
 * with the soft-delete/active scope this codebase puts on every public read.
 */
import { Game } from '../models/index.js';
import BaseRepository from './BaseRepository.js';

/** `item_sort` values a games listing accepts. Playva: newest, title, popular. */
export const GAME_SORT_FIELDS = Object.freeze({
  created_date: 'createdAt',
  title_fa: 'titleFa',
  clicks: 'clicks',
});

/**
 * What a card needs, and all a passenger is ever sent. `isActive`, the
 * soft-delete flags and the timestamps stay server-side.
 */
export const GAME_CARD_FIELDS = 'titleFa folderName genre emoji color1 color2 gameUrl clicks';

/** The genre as it rides on a game: enough to label a card, nothing more. */
export const GAME_GENRE_POPULATE = Object.freeze({ path: 'genre', select: 'nameFa nameEn' });

export class GameRepository extends BaseRepository {
  constructor() {
    super(Game);
  }

  /**
   * The public listing filter.
   *
   * Playva (`routes/games.js`): `titleFa` matched case-insensitively against the
   * search term, `genre` matched exactly, and the "popular" tab narrowed the
   * list to games that have been opened at least once (`clicks > 0`).
   *
   * @param {object} criteria
   * @param {string} [criteria.text]     search term; matched as a literal
   * @param {string} [criteria.genre]    a GameGenre id
   * @param {boolean} [criteria.popular] only games with at least one click
   */
  buildPublicFilter({ text, genre, popular } = {}) {
    const filter = {};

    if (text) {
      // Escaped, unlike Playva's `$regex: req.query.search`: a passenger typing
      // "(" should find nothing, not get a 500 from an invalid pattern.
      filter.titleFa = new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    }
    if (genre) filter.genre = genre;
    if (popular) filter.clicks = { $gt: 0 };

    return this.publicScope(filter);
  }

  /**
   * Counts one opening of a game. Atomic, so two passengers opening the same
   * game at once are both counted. Only a game the public can see is counted.
   *
   * @returns {Promise<{clicks: number}|null>} null when there is no such game
   */
  incrementClicks(id) {
    return Game.findOneAndUpdate(
      this.publicScope({ _id: id }),
      { $inc: { clicks: 1 } },
      { new: true, projection: { clicks: 1 } },
    ).lean();
  }
}

export const gameRepository = new GameRepository();
export default gameRepository;
