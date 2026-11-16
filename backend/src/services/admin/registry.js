/**
 * Admin CRUD service registry.
 *
 * Purpose: build one CRUD service per entity, each with its own list filters,
 *          sort whitelist and write normalization.
 * Inputs:  none
 * Outputs: named service objects
 * Deps:    services/crud, repositories, utils/dates, config/constants
 *
 * Each entry corresponds to a legacy admin controller under
 * admin/3P1z05m4n4Gm3nt/controllers/.
 */
import createCrudService from '../crud.service.js';
import {
  movieRepository,
  castRepository,
  musicRepository,
  categoryRepository,
  musicCategoryRepository,
  genreRepository,
  musicGenreRepository,
  gameRepository,
  gameGenreRepository,
  GAME_GENRE_POPULATE,
  ageRangeRepository,
  countryRepository,
  bannerRepository,
  bannerCategoryRepository,
  videoAdRepository,
  placementAdRepository,
  pageRepository,
  pageBlockRepository,
  userCategoryRepository,
  permissionGroupRepository,
  accessPermissionRepository,
  pollRepository,
} from '../../repositories/index.js';
import { jalaliYearToGregorian, looksJalali } from '../../utils/dates.js';
import { resolveGrants, grantsFromPermissions } from './permissionGrant.service.js';
import { pickGameFields, assertGenreExists, removeGame } from './game.service.js';
import { ORIGIN_JALALI } from '../../config/constants.js';
import ApiError from '../../utils/ApiError.js';

/** Case-insensitive substring filter — the legacy `LIKE '%value%'`, made safe. */
const like = (value) => new RegExp(String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

const TIMESTAMP_SORTS = { created_date: 'createdAt', modified_date: 'updatedAt', id: '_id' };

/* --------------------------------------------------------------- movies --- */

/**
 * The only fields a CLIP carries. Everything else on the movie schema belongs
 * to a feature film and is dropped from a clip's write.
 *
 * The panel disables those inputs when «کلیپ» is ticked, so they never arrive
 * from it; this makes the API agree with the form rather than trusting it. They
 * are DROPPED, not cleared — flipping a film to a clip and back must not destroy
 * its year, cast, pricing and platforms, and a clip's copies of those fields sit
 * at their schema defaults anyway.
 *
 * `isActive`, the poster and the video are not "movie options" and stay
 * available: a clip that could not be deactivated or given a video would be
 * useless.
 */
const CLIP_FIELDS = new Set([
  'titleFa',
  'titleEn',
  'genre1',
  'descriptionFa',
  'descriptionEn',
  'tags',
  'isClip',
  'isActive',
]);

/**
 * Normalizes a movie payload before it is written.
 *
 * legacy (admin/.../views/movies/update.php:39-61):
 *   - price, price_discount and movie_length coerce '' to 0;
 *   - cinema_expire_hour is UNSET when '' (not zeroed);
 *   - genre_2 and genre_3 become null when '';
 *   - publish_date is converted Jalali -> Gregorian when default_origin == 0;
 *   - platform is stored comma-joined (an array here).
 *
 * A clip short-circuits all of it: none of those fields reach the database.
 */
function transformMovieWrite(payload) {
  const next = { ...payload };

  if (next.isClip === true) {
    for (const field of Object.keys(next)) {
      if (!CLIP_FIELDS.has(field)) delete next[field];
    }
    return next;
  }

  for (const field of ['price', 'priceDiscount', 'movieLength']) {
    if (next[field] === '' || next[field] === undefined || next[field] === null) {
      next[field] = 0;
    }
  }

  if (next.cinemaExpireHour === '' || next.cinemaExpireHour === undefined) {
    delete next.cinemaExpireHour;
  }

  for (const field of ['genre2', 'genre3']) {
    if (next[field] === '' || next[field] === 0) {
      next[field] = null;
    }
  }

  // Only convert when the form says the input is Jalali AND the value actually
  // looks Jalali, so re-saving an already-converted record cannot double-convert.
  if (Number(next.defaultOrigin) === ORIGIN_JALALI && looksJalali(next.publishYear)) {
    next.publishYear = jalaliYearToGregorian(next.publishYear);
  }

  return next;
}

export const movieService = createCrudService({
  repository: movieRepository,
  page: 'movies',
  label: 'Movie',
  sortFields: {
    ...TIMESTAMP_SORTS,
    imdb_rank: 'imdbRank',
    visit_count: 'visitCount',
    publish_date: 'publishYear',
    title_fa: 'titleFa',
  },
  defaultSort: 'created_date',
  populate: ['genre1', 'genre2', 'genre3', 'ageRange'],
  transformWrite: transformMovieWrite,
  buildFilter: (query) => {
    const filter = {};
    if (query.titleFa) filter.titleFa = like(query.titleFa);
    if (query.titleEn) filter.titleEn = like(query.titleEn);
    if (query.company) filter.company = like(query.company);
    if (query.genre1) filter.genre1 = query.genre1;
    if (query.publishYear !== undefined) filter.publishYear = query.publishYear;
    if (query.isActive !== undefined) filter.isActive = query.isActive;
    // Absent means "both kinds", which is what the grid opens on: the panel
    // manages one catalog, not two.
    if (query.isClip !== undefined) filter.isClip = query.isClip;
    return filter;
  },
});

/* ---------------------------------------------------------------- casts --- */

export const castService = createCrudService({
  repository: castRepository,
  page: 'casts',
  label: 'Cast',
  sortFields: { ...TIMESTAMP_SORTS, fullname_fa: 'fullnameFa' },
  defaultSort: 'created_date',
  buildFilter: (query) => {
    const filter = {};
    if (query.fullnameFa) filter.fullnameFa = like(query.fullnameFa);
    if (query.isActive !== undefined) filter.isActive = query.isActive;
    return filter;
  },
});

/* ---------------------------------------------------------------- music --- */

export const musicService = createCrudService({
  repository: musicRepository,
  page: 'musics',
  label: 'Music',
  sortFields: { ...TIMESTAMP_SORTS, visit_count: 'visitCount', publish_date: 'publishYear' },
  defaultSort: 'created_date',
  // The music form needs the genre's name, not just its id.
  populate: ['genre'],
  buildFilter: (query) => {
    const filter = {};
    if (query.fullnameFa) filter.fullnameFa = like(query.fullnameFa);
    if (query.albumFa) filter.albumFa = like(query.albumFa);
    if (query.isActive !== undefined) filter.isActive = query.isActive;
    return filter;
  },
});

/* ----------------------------------------------------------- taxonomies --- */

const nameFilter = (query) => {
  const filter = {};
  if (query.nameFa) filter.nameFa = like(query.nameFa);
  if (query.isActive !== undefined) filter.isActive = query.isActive;
  return filter;
};

export const categoryService = createCrudService({
  repository: categoryRepository,
  page: 'categories',
  label: 'Category',
  sortFields: { ...TIMESTAMP_SORTS, name_fa: 'nameFa' },
  defaultSort: 'created_date',
  buildFilter: nameFilter,
});

export const musicCategoryService = createCrudService({
  repository: musicCategoryRepository,
  // legacy views/music-categories/* checked the 'categories'/'musics'
  // identifiers; music categories are guarded by 'categories' here.
  page: 'categories',
  label: 'Music category',
  sortFields: { ...TIMESTAMP_SORTS, name_fa: 'nameFa' },
  defaultSort: 'created_date',
  buildFilter: nameFilter,
});

export const genreService = createCrudService({
  repository: genreRepository,
  page: 'genres',
  label: 'Genre',
  sortFields: { ...TIMESTAMP_SORTS, name_fa: 'nameFa' },
  defaultSort: 'created_date',
  buildFilter: nameFilter,
});

/**
 * The MUSIC taxonomy — a different collection from `genreService` above, which
 * is films only. Guarded by `genres`, the permission that already covers genre
 * management, so no installation has to re-seed a new permission row before it
 * can reach the section.
 */
export const musicGenreService = createCrudService({
  repository: musicGenreRepository,
  page: 'genres',
  label: 'Music genre',
  sortFields: { ...TIMESTAMP_SORTS, name_fa: 'nameFa' },
  defaultSort: 'name_fa',
  buildFilter: nameFilter,
});

/* ---------------------------------------------------------------- games --- */

/**
 * HTML5 games. New section — the legacy application had none, so there is no
 * controller to mirror; the shape is Playva's.
 *
 * The factory supplies the grid, the detail read, the text-field save and the
 * status toggle. The two operations that involve the bundle on disk do not fit
 * it and are replaced below:
 *
 *   create  a game cannot exist without its files, so it is created from a ZIP
 *           by a multipart route (routes/admin/index.js -> services/admin/
 *           game.service.js). The JSON create the factory offers is refused.
 *   remove  must delete the unpacked directory as well as flag the row.
 *
 * `transformWrite` is a whitelist rather than a normalizer: `gameUrl`, `clicks`
 * and `folderName` are not editable, and a PUT carrying the whole form must not
 * be able to move any of them.
 */
const baseGameService = createCrudService({
  repository: gameRepository,
  page: 'games',
  label: 'Game',
  sortFields: {
    ...TIMESTAMP_SORTS,
    title_fa: 'titleFa',
    folder_name: 'folderName',
    clicks: 'clicks',
  },
  defaultSort: 'created_date',
  populate: [GAME_GENRE_POPULATE],
  transformWrite: pickGameFields,
  buildFilter: (query) => {
    const filter = {};
    if (query.titleFa) filter.titleFa = like(query.titleFa);
    if (query.folderName) filter.folderName = like(query.folderName);
    if (query.genre) filter.genre = query.genre;
    if (query.isActive !== undefined) filter.isActive = query.isActive;
    return filter;
  },
});

export const gameService = {
  ...baseGameService,

  // Unreachable through the router, which sends POST /games to the multipart
  // handler first. Kept explicit so that nothing calling the service directly
  // can create a game with no bundle behind it.
  async create() {
    throw ApiError.badRequest('A game is created by uploading its ZIP bundle');
  },

  async update(id, payload, context) {
    await assertGenreExists(payload.genre);
    return baseGameService.update(id, payload, context);
  },

  remove: removeGame,
};

const baseGameGenreService = createCrudService({
  repository: gameGenreRepository,
  // Guarded by `games`, not by `genres`: this list exists only for the games
  // section, and one grant should be all a games operator needs.
  page: 'games',
  label: 'Game genre',
  sortFields: { ...TIMESTAMP_SORTS, name_fa: 'nameFa' },
  defaultSort: 'name_fa',
  buildFilter: nameFilter,
});

/**
 * The game taxonomy — a third collection, beside `genreService` (films) and
 * `musicGenreService` (music).
 *
 * A genre still in use cannot be deleted. That is Playva's rule
 * (`routes/genres.js`), and it is needed here for the same reason: `Game.genre`
 * is required, so deleting the genre would leave every one of its games pointing
 * at nothing. Deactivating is the way to retire a genre that still has games —
 * it drops out of the passenger site's filter row and the games keep their label.
 */
export const gameGenreService = {
  ...baseGameGenreService,

  async remove(id, context) {
    const inUse = await gameRepository.count(gameRepository.adminScope({ genre: id }));
    if (inUse > 0) {
      throw ApiError.conflict(
        `This genre cannot be deleted: ${inUse} game${inUse === 1 ? ' uses' : 's use'} it`,
      );
    }
    return baseGameGenreService.remove(id, context);
  },
};

export const ageRangeService = createCrudService({
  repository: ageRangeRepository,
  page: 'age-ranges',
  label: 'Age range',
  sortFields: { ...TIMESTAMP_SORTS, name_fa: 'nameFa' },
  defaultSort: 'created_date',
  buildFilter: nameFilter,
});

export const countryService = createCrudService({
  repository: countryRepository,
  // No dedicated legacy permission existed for countries; they are reference
  // data managed alongside age ranges.
  page: 'age-ranges',
  label: 'Country',
  sortFields: { ...TIMESTAMP_SORTS, country_fa: 'countryFa' },
  defaultSort: 'created_date',
  buildFilter: (query) => {
    const filter = {};
    if (query.countryFa) filter.countryFa = like(query.countryFa);
    if (query.countryCode) filter.countryCode = String(query.countryCode).toUpperCase();
    return filter;
  },
});

/* -------------------------------------------------------------- banners --- */

export const bannerService = createCrudService({
  repository: bannerRepository,
  page: 'banners',
  label: 'Banner',
  sortFields: { ...TIMESTAMP_SORTS, title_fa: 'titleFa' },
  defaultSort: 'created_date',
  buildFilter: (query) => {
    const filter = {};
    if (query.titleFa) filter.titleFa = like(query.titleFa);
    if (query.isActive !== undefined) filter.isActive = query.isActive;
    return filter;
  },
});

export const bannerCategoryService = createCrudService({
  repository: bannerCategoryRepository,
  page: 'banners',
  label: 'Banner category',
  sortFields: { ...TIMESTAMP_SORTS, name: 'name' },
  defaultSort: 'created_date',
  buildFilter: (query) => (query.name ? { name: like(query.name) } : {}),
});

/* -------------------------------------------------------- advertisements --- */

/**
 * Pre-roll creatives. New section — the legacy panel managed no ads at all, so
 * there is no controller to mirror; the shape follows the other entities.
 *
 * `videoPath` is deliberately absent from the write rules: a file arrives
 * through the upload endpoint, which also records the duration it measured. A
 * PUT carrying the whole form must not be able to blank it.
 */
export const videoAdService = createCrudService({
  repository: videoAdRepository,
  page: 'ads',
  label: 'Video advertisement',
  sortFields: { ...TIMESTAMP_SORTS, title_fa: 'titleFa', weight: 'weight', duration: 'durationSecond' },
  defaultSort: 'created_date',
  buildFilter: (query) => {
    const filter = {};
    if (query.titleFa) filter.titleFa = like(query.titleFa);
    if (query.isActive !== undefined) filter.isActive = query.isActive;
    return filter;
  },
});

/** Landing-page slot ads. Artwork likewise arrives through upload endpoints. */
export const placementAdService = createCrudService({
  repository: placementAdRepository,
  page: 'ads',
  label: 'Placement advertisement',
  sortFields: { ...TIMESTAMP_SORTS, title_fa: 'titleFa', order: 'order', placement: 'placement' },
  // Slots are curated by hand and rarely number more than a few, so the list
  // opens in the order they will actually render rather than newest-first.
  defaultSort: 'order',
  buildFilter: (query) => {
    const filter = {};
    if (query.titleFa) filter.titleFa = like(query.titleFa);
    if (query.placement) filter.placement = query.placement;
    if (query.isActive !== undefined) filter.isActive = query.isActive;
    return filter;
  },
});

/* ---------------------------------------------------------------- pages --- */

export const pageService = createCrudService({
  repository: pageRepository,
  page: 'pages',
  label: 'Page',
  sortFields: { ...TIMESTAMP_SORTS, title_fa: 'titleFa' },
  defaultSort: 'created_date',
  buildFilter: (query) => (query.titleFa ? { titleFa: like(query.titleFa) } : {}),
});

export const pageBlockService = createCrudService({
  repository: pageBlockRepository,
  page: 'blocks',
  label: 'Page block',
  sortFields: { ...TIMESTAMP_SORTS, item_order: 'itemOrder' },
  defaultSort: 'item_order',
  buildFilter: (query) => (query.page ? { page: query.page } : {}),
});

/* --------------------------------------------------- users & permissions --- */

export const userCategoryService = createCrudService({
  repository: userCategoryRepository,
  page: 'users',
  label: 'User category',
  sortFields: { ...TIMESTAMP_SORTS, name: 'name' },
  defaultSort: 'created_date',
  buildFilter: (query) => (query.name ? { name: like(query.name) } : {}),
});

const basePermissionGroupService = createCrudService({
  repository: permissionGroupRepository,
  page: 'groups',
  label: 'Permission group',
  sortFields: { ...TIMESTAMP_SORTS, name: 'name' },
  defaultSort: 'created_date',
  populate: ['permissions'],
  buildFilter: (query) => (query.name ? { name: like(query.name) } : {}),
});

/**
 * Replaces `grants` — the section x action matrix the group editor submits —
 * with the permission ids it resolves to.
 *
 * Not a `transformWrite`: resolving a matrix reads and sometimes writes the
 * AccessPermission collection, and the factory's transform is synchronous.
 */
async function resolveGroupWrite(payload) {
  if (!payload?.grants) return payload;

  const { grants, ...rest } = payload;
  return { ...rest, permissions: await resolveGrants(grants) };
}

/**
 * The group editor speaks in grants, not permission ids.
 *
 * `getById` answers with the matrix alongside the stored array so the editor
 * does not have to re-derive it — and so the OR-ing of overlapping rows, which
 * is what the authorization resolver does, is defined in exactly one place.
 */
export const permissionGroupService = {
  ...basePermissionGroupService,

  async getById(id) {
    const group = await basePermissionGroupService.getById(id);
    return { ...group, grants: grantsFromPermissions(group.permissions) };
  },

  async create(payload, context) {
    return basePermissionGroupService.create(await resolveGroupWrite(payload), context);
  },

  async update(id, payload, context) {
    return basePermissionGroupService.update(id, await resolveGroupWrite(payload), context);
  },
};

export const accessPermissionService = createCrudService({
  repository: accessPermissionRepository,
  page: 'groups',
  label: 'Access permission',
  sortFields: { ...TIMESTAMP_SORTS, action_page: 'actionPage' },
  defaultSort: 'action_page',
  buildFilter: (query) => (query.actionPage ? { actionPage: query.actionPage } : {}),
});

/* ---------------------------------------------------------------- polls --- */

export const pollService = createCrudService({
  repository: pollRepository,
  // legacy views/polls/* checked the 'banners' identifier by copy-paste; polls
  // are guarded by 'pages' here, which is the section they belong to.
  page: 'pages',
  label: 'Poll question',
  sortFields: { ...TIMESTAMP_SORTS, order: 'order' },
  defaultSort: 'order',
  buildFilter: () => ({}),
});

export default {
  movieService,
  castService,
  musicService,
  categoryService,
  musicCategoryService,
  genreService,
  musicGenreService,
  gameService,
  gameGenreService,
  ageRangeService,
  countryService,
  bannerService,
  bannerCategoryService,
  videoAdService,
  placementAdService,
  pageService,
  pageBlockService,
  userCategoryService,
  permissionGroupService,
  accessPermissionService,
  pollService,
};
