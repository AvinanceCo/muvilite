/**
 * Games API.
 *
 * Purpose: the HTML5 games catalog — listing, one game, the genre filter row,
 *          and the click counter.
 * Inputs:  ids, query parameters
 * Outputs: plain data (see each function)
 * Deps:    api/client
 *
 * No legacy actions behind these: the legacy portal had no games. The section
 * is modelled on Playva (backend MIGRATION.md §19), with the parameters renamed
 * to this API's conventions — `text` for the search term, as on /search and
 * /musics, and `popular=true` where Playva overloaded `genre=popular`.
 *
 * The games themselves are not fetched through here. A game is a directory of
 * static files; `gameUrl` on each record is the address of its `index.html`, and
 * the play screen points an iframe at it.
 */
import { request, requestWithMeta } from './client.js';

/**
 * Games, paginated. An absent `text` returns the whole catalog, which is what
 * makes the games page a browse screen before anything is typed.
 *
 * @param {object} [params]
 * @param {string} [params.text]     matches the Persian title
 * @param {string} [params.genre]    a game-genre id
 * @param {boolean} [params.popular] only games opened at least once, most
 *                                   opened first; overrides any sort
 * @param {number} [params.page]
 * @param {number} [params.limit]
 * @returns {Promise<{data: object[], meta: object}>}
 */
export function fetchGames(params = {}) {
  return requestWithMeta({ url: '/games', params });
}

/** One game. A deactivated or deleted one is a 404. */
export function fetchGame(id) {
  return request({ url: `/games/${id}` });
}

/** Active game genres, in name order — the filter row. */
export function fetchGameGenres() {
  return request({ url: '/games/genres' });
}

/**
 * Counts one opening of a game. Fire-and-forget from the caller's side: the
 * count feeds the "popular" ordering and nothing a passenger is waiting on.
 */
export function registerGameClick(id) {
  return request({ url: `/games/${id}/click`, method: 'POST' });
}

export default { fetchGames, fetchGame, fetchGameGenres, registerGameClick };
