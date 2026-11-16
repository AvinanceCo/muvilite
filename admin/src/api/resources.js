/**
 * Generic CRUD client.
 *
 * Purpose: one implementation of the six routes every admin resource exposes,
 *          so sixteen resources do not each hand-roll the same five requests.
 * Inputs:  a base path, plus params or a payload
 * Outputs: documents, and `{ items, meta }` for lists
 * Deps:    api/client
 *
 * Every resource under /api/admin exposes exactly:
 *   GET    {base}            list, paginated, with `meta`
 *   GET    {base}/:id        one document
 *   POST   {base}            create -> 201
 *   PUT    {base}/:id        update — FULL OBJECT, see below
 *   PATCH  {base}/:id/status toggle isActive
 *   DELETE {base}/:id        soft delete
 *
 * PUT IS A FULL REPLACE OF THE VALIDATED FIELDS. The server applies the same
 * validation rules to create and update, so a field that is required on create
 * is required on update too — omitting it is a 422, not a partial update. Load
 * the record, edit it, send the whole thing back.
 *
 * Users are the one resource this factory does not serve: they have extra
 * routes (password reset, export) and a create/update shape that differs.
 * See api/operations.js.
 */
import { request, requestWithMeta } from './client.js';

/**
 * Strips empty filter values so a cleared search box does not send `?title=`,
 * which the API would read as "match the empty string" on some endpoints.
 */
function cleanParams(params = {}) {
  const cleaned = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === '' || value === null || value === undefined) continue;
    cleaned[key] = value;
  }
  return cleaned;
}

/**
 * Builds a client for one resource.
 *
 * @param {string} base e.g. `/admin/movies`
 */
export function createResourceApi(base) {
  return {
    base,

    /**
     * @param {object} params page, limit, item_sort, sort_type, plus filters
     * @returns {Promise<{items: object[], meta: object|null}>}
     */
    async list(params = {}) {
      const { data, meta } = await requestWithMeta({ url: base, params: cleanParams(params) });
      return { items: data ?? [], meta };
    },

    get(id) {
      return request({ url: `${base}/${id}` });
    },

    create(payload) {
      return request({ url: base, method: 'POST', data: payload });
    },

    /** Remember: a full object, not a patch. */
    update(id, payload) {
      return request({ url: `${base}/${id}`, method: 'PUT', data: payload });
    },

    setStatus(id, isActive) {
      return request({ url: `${base}/${id}/status`, method: 'PATCH', data: { isActive } });
    },

    /** Soft delete — the row is flagged, never removed. */
    remove(id) {
      return request({ url: `${base}/${id}`, method: 'DELETE' });
    },
  };
}

/* --------------------------------------------------- the resource clients --- */

export const moviesApi = createResourceApi('/admin/movies');
export const castsApi = createResourceApi('/admin/casts');
export const musicsApi = createResourceApi('/admin/musics');
export const categoriesApi = createResourceApi('/admin/categories');
export const musicCategoriesApi = createResourceApi('/admin/music-categories');
export const genresApi = createResourceApi('/admin/genres');
// The MUSIC taxonomy — a separate collection from genres, which is films only.
export const musicGenresApi = createResourceApi('/admin/music-genres');
// HTML5 games. `gamesApi.create` is NOT how a game is made — the API answers a
// JSON POST with a 400, because a game is created from its ZIP. Use
// `createGame` in api/operations.js; list, get, update, status and remove here
// are the ordinary ones.
export const gamesApi = createResourceApi('/admin/games');
export const gameGenresApi = createResourceApi('/admin/game-genres');
export const ageRangesApi = createResourceApi('/admin/age-ranges');
export const countriesApi = createResourceApi('/admin/countries');
export const bannersApi = createResourceApi('/admin/banners');
export const bannerCategoriesApi = createResourceApi('/admin/banner-categories');
export const videoAdsApi = createResourceApi('/admin/video-ads');
export const placementAdsApi = createResourceApi('/admin/placement-ads');
export const pagesApi = createResourceApi('/admin/pages');
export const pageBlocksApi = createResourceApi('/admin/page-blocks');
export const pollsApi = createResourceApi('/admin/polls');
export const userCategoriesApi = createResourceApi('/admin/user-categories');
export const permissionGroupsApi = createResourceApi('/admin/permission-groups');
export const accessPermissionsApi = createResourceApi('/admin/access-permissions');

/**
 * Every resource client by its route key, so a generic page can look one up
 * from its descriptor without a switch.
 */
export const RESOURCE_APIS = Object.freeze({
  movies: moviesApi,
  casts: castsApi,
  musics: musicsApi,
  categories: categoriesApi,
  'music-categories': musicCategoriesApi,
  genres: genresApi,
  'music-genres': musicGenresApi,
  games: gamesApi,
  'game-genres': gameGenresApi,
  'age-ranges': ageRangesApi,
  countries: countriesApi,
  banners: bannersApi,
  'banner-categories': bannerCategoriesApi,
  'video-ads': videoAdsApi,
  'placement-ads': placementAdsApi,
  pages: pagesApi,
  'page-blocks': pageBlocksApi,
  polls: pollsApi,
  'user-categories': userCategoriesApi,
  'permission-groups': permissionGroupsApi,
  'access-permissions': accessPermissionsApi,
});

export default RESOURCE_APIS;
