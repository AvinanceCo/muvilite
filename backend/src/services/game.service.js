/**
 * Game service — the public games catalog.
 *
 * Purpose: list, find and count openings of HTML5 games for the passenger site.
 * Inputs:  ids, query parameters
 * Outputs: view models for the games listing, a single game and the genre list
 * Deps:    repositories, utils/{pagination,ApiError}
 *
 * NO LEGACY ANCESTOR. The behaviour is Playva's public games API
 * (`playva-backend/routes/games.js`) — listing with search, a genre filter, a
 * "popular" tab and a click counter — expressed in this API's conventions:
 *
 *   Playva                              here
 *   ?search=                            ?text=        (as /search and /musics)
 *   ?genre=<id>                         ?genre=<id>
 *   ?genre=popular  (a magic value)     ?popular=true (its own parameter, so
 *                                                      `genre` is always an id)
 *   ?sort=newest|oldest|title|popular   ?item_sort=created_date|title_fa|clicks
 *                                       &sort_type=ASC|DESC
 *   { data, pagination }                the standard envelope with `meta`
 *
 * The leaderboard endpoints (`/leaderboard`, `/:id/scores…`) are not here: the
 * leaderboard was explicitly left out.
 */
import {
  gameRepository,
  gameGenreRepository,
  GAME_SORT_FIELDS,
  GAME_CARD_FIELDS,
  GAME_GENRE_POPULATE,
} from '../repositories/index.js';
import { resolvePagination, resolveSort, buildMeta } from '../utils/pagination.js';
import ApiError from '../utils/ApiError.js';

/**
 * Games, paginated.
 *
 * An absent `text` is the whole catalog, which is what makes the games page a
 * browse screen before anything is typed — the same contract /search has.
 *
 * `popular` narrows AND orders: only games opened at least once, most opened
 * first. It overrides `item_sort`, exactly as Playva's popular tab overrode its
 * `sort` parameter — a "popular" list in title order would not be one.
 */
export async function listGames(query = {}) {
  const { page, limit, skip } = resolvePagination(query);
  const popular = query.popular === true;

  const sort = popular
    ? { clicks: -1, _id: -1 }
    : resolveSort(query.item_sort, query.sort_type, {
        allowed: GAME_SORT_FIELDS,
        defaultField: 'created_date',
        defaultDirection: 'DESC',
        // Titles and click counts repeat; without this, two pages of the same
        // listing could show the same game twice.
        tiebreaker: { _id: -1 },
      });

  const filter = gameRepository.buildPublicFilter({
    text: query.text,
    genre: query.genre,
    popular,
  });

  const { items, total } = await gameRepository.paginate(filter, {
    sort,
    skip,
    limit,
    select: GAME_CARD_FIELDS,
    populate: [GAME_GENRE_POPULATE],
  });

  return { items, meta: buildMeta({ page, limit, total }) };
}

/** One game, for the play screen. A deactivated game answers 404, like any other. */
export async function getGame(gameId) {
  const game = await gameRepository.findById(gameId, {
    select: GAME_CARD_FIELDS,
    populate: [GAME_GENRE_POPULATE],
  });

  if (!game) {
    throw ApiError.notFound('Game not found');
  }
  return game;
}

/**
 * Counts one opening of a game. Playva: `POST /api/games/:id/click`.
 *
 * Its own call rather than a side effect of `getGame()`, for the reason the
 * music detail endpoint stopped opening a listen session: a metadata read should
 * not write. The play screen calls it once, when it opens.
 */
export async function registerGameClick(gameId) {
  const updated = await gameRepository.incrementClicks(gameId);
  if (!updated) {
    throw ApiError.notFound('Game not found');
  }
  return { clicks: updated.clicks };
}

/** The genre filter row on the games page. Playva: `GET /api/genres`. */
export async function listGameGenres() {
  return gameGenreRepository.find(gameGenreRepository.publicScope(), {
    sort: { nameFa: 1 },
    select: 'nameFa nameEn',
  });
}

export default { listGames, getGame, registerGameClick, listGameGenres };
