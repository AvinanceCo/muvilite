/**
 * Catalog API.
 *
 * Purpose: every public read endpoint, one function each, named for what it
 *          fetches rather than for the legacy action it replaced.
 * Inputs:  ids, slugs, query parameters
 * Outputs: plain data (see each function)
 * Deps:    api/client
 *
 * Legacy action -> endpoint (MIGRATION.md §4):
 *   ?@=page             GET /api/pages/:idOrSlug
 *   ?@=movie            GET /api/movies/:id
 *   ?@=similar          GET /api/movies/:id/similar
 *   ?@=categories       GET /api/categories/:id/movies
 *   ?@=search           GET /api/search
 *   ?@=music            GET /api/musics/:id
 *   ?@=musics           GET /api/musics
 *   ?@=music_categories GET /api/music-categories/:id/musics
 *
 * Sort parameters keep their legacy names (`item_sort`, `sort_type`) because the
 * server's whitelists are keyed on them, and those whitelists differ per
 * endpoint — see utils/constants.js.
 */
import { request, requestWithMeta } from './client.js';

/**
 * A landing page and its ordered blocks.
 * @param {string} idOrSlug
 * @returns {Promise<{page: object, blocks: object[]}>} blocks are banner|category|music
 */
export function fetchPage(idOrSlug) {
  return request({ url: `/pages/${encodeURIComponent(idOrSlug)}` });
}

/** Movie detail with genres, casts, country and age rating. */
export function fetchMovie(id) {
  return request({ url: `/movies/${id}` });
}

/** Related titles: same primary genre, random order, exactly 4. */
export function fetchSimilarMovies(id) {
  return request({ url: `/movies/${id}/similar` });
}

/**
 * Movies in a category, paginated.
 * @returns {Promise<{data: {category: object, items: object[]}, meta: object}>}
 */
export function fetchCategoryMovies(id, params = {}) {
  return requestWithMeta({ url: `/categories/${id}/movies`, params });
}

/**
 * Music entries in a category, paginated.
 * @returns {Promise<{data: {category: object, items: object[]}, meta: object}>}
 */
export function fetchMusicCategoryItems(id, params = {}) {
  return requestWithMeta({ url: `/music-categories/${id}/musics`, params });
}

/** Album detail with its track playlist. */
export function fetchMusic(id) {
  return request({ url: `/musics/${id}` });
}

/**
 * Movie search. An empty `text` returns the first page of everything, which is
 * the legacy behaviour and is relied on by the empty search screen.
 */
export function searchMovies(params = {}) {
  return requestWithMeta({ url: '/search', params });
}

/** Music search. Paginated here; the legacy query had no LIMIT at all. */
export function searchMusics(params = {}) {
  return requestWithMeta({ url: '/musics', params });
}

export default {
  fetchPage,
  fetchMovie,
  fetchSimilarMovies,
  fetchCategoryMovies,
  fetchMusicCategoryItems,
  fetchMusic,
  searchMovies,
  searchMusics,
};
