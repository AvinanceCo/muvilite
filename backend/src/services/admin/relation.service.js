/**
 * Relation management service.
 *
 * Purpose: attach and detach the many-to-many links the admin panel maintains —
 *          movies in categories, music in music categories, banners in banner
 *          categories, and cast credits on movies.
 * Inputs:  the two ids involved
 * Outputs: the relation document
 * Deps:    repositories, services/auditLog, utils/ApiError
 *
 * Legacy counterparts: CategoryController (`?@=add` / `?@=remove`),
 * MusicCategoryController, MovieCastController and the banner relation views.
 *
 * The legacy `add` actions inserted unconditionally, so clicking twice produced
 * duplicate join rows and the same title appeared twice in a rail. Each
 * relation collection has a unique compound index, and re-adding a soft-deleted
 * pair revives it rather than colliding.
 */
import {
  categoryRelationRepository,
  musicCategoryRelationRepository,
  bannerCategoryRelationRepository,
  movieCastRepository,
  categoryRepository,
  musicCategoryRepository,
  movieRepository,
  musicRepository,
  MOVIE_SORT_FIELDS,
  MUSIC_SORT_FIELDS,
  MOVIE_ADMIN_ROW_FIELDS,
  MUSIC_ADMIN_ROW_FIELDS,
} from '../../repositories/index.js';
import { logCreate, logDelete } from '../auditLog.service.js';
import { resolvePagination, resolveSort, buildMeta } from '../../utils/pagination.js';
import { isClipCategory } from '../../config/constants.js';
import ApiError from '../../utils/ApiError.js';

/**
 * Creates a relation, reviving a previously removed one instead of failing on
 * the unique index.
 */
async function attach(repository, filter, extra, { page, context }) {
  const existing = await repository.findOne(filter);

  if (existing && !existing.isDeleted) {
    throw ApiError.conflict('This relation already exists');
  }

  const relation = existing
    ? await repository.model
        .findOneAndUpdate(
          { _id: existing._id },
          { $set: { ...extra, isDeleted: false, deletedAt: null } },
          { new: true },
        )
        .lean()
    : await repository.create({ ...filter, ...extra });

  await logCreate({
    user: context.userId,
    userIp: context.userIp,
    page,
    targetId: relation._id,
    details: { ...filter, ...extra },
  });

  return relation;
}

async function detach(repository, filter, { page, context }) {
  const existing = await repository.findOne({ ...filter, isDeleted: false });
  if (!existing) {
    throw ApiError.notFound('Relation not found');
  }

  await repository.softDeleteById(existing._id);

  await logDelete({
    user: context.userId,
    userIp: context.userIp,
    page,
    targetId: existing._id,
    details: filter,
  });

  return { deleted: true };
}

/* ------------------------------------------------ movies <-> categories --- */

/**
 * A category whose name contains «کلیپ» or "clip" holds clips only.
 *
 * The rule is one-directional by design: a clip category refuses films, while an
 * ordinary category takes both. So «کلیپ های ورزشی» stays a clip rail, and a
 * mixed category like «پیشنهاد سردبیر» can carry a short vertical clip beside a
 * feature without anyone having to duplicate it.
 *
 * There is no flag behind this — the keywords are hardcoded
 * (config/constants.js `isClipCategory`) because existing categories are already
 * named this way and a column would have to be set by hand on every one.
 * Renaming a category therefore changes what it accepts; titles already linked
 * are left alone, since removing them silently would lose curation nobody asked
 * to undo.
 */
export async function addMovieToCategory(category, item, context) {
  const [categoryDocument, movie] = await Promise.all([
    categoryRepository.findById(category, { scope: 'admin' }),
    movieRepository.findById(item, { scope: 'admin' }),
  ]);

  if (!categoryDocument) throw ApiError.notFound('Category not found');
  if (!movie) throw ApiError.notFound('Movie not found');

  if (isClipCategory(categoryDocument) && !movie.isClip) {
    throw ApiError.badRequest(
      `"${categoryDocument.nameFa}" is a clip category and accepts clips only; "${movie.titleFa}" is not marked as a clip`,
    );
  }

  return attach(categoryRelationRepository, { category, item }, {}, { page: 'categories', context });
}

export const removeMovieFromCategory = (category, item, context) =>
  detach(categoryRelationRepository, { category, item }, { page: 'categories', context });

/** Categories a given movie belongs to. */
export const listMovieCategories = (item) =>
  categoryRelationRepository.find({ item, isDeleted: false }, { populate: ['category'] });

/* -------------------------------------------- music <-> music categories --- */

export const addMusicToCategory = (category, item, context) =>
  attach(musicCategoryRelationRepository, { category, item }, {}, { page: 'categories', context });

export const removeMusicFromCategory = (category, item, context) =>
  detach(musicCategoryRelationRepository, { category, item }, { page: 'categories', context });

export const listMusicCategories = (item) =>
  musicCategoryRelationRepository.find({ item, isDeleted: false }, { populate: ['category'] });

/* ---------------------------------------- banners <-> banner categories --- */

export const addBannerToCategory = (bannerCategory, banner, orderIndex, context) =>
  attach(
    bannerCategoryRelationRepository,
    { bannerCategory, banner },
    { orderIndex: orderIndex ?? 0 },
    { page: 'banners', context },
  );

export const removeBannerFromCategory = (bannerCategory, banner, context) =>
  detach(bannerCategoryRelationRepository, { bannerCategory, banner }, { page: 'banners', context });

export const listCategoryBanners = (bannerCategory) =>
  bannerCategoryRelationRepository.find(
    { bannerCategory, isDeleted: false },
    { populate: ['banner'], sort: { orderIndex: 1 } },
  );

/* ------------------------------------------------------ movies <-> casts --- */

/**
 * Adds a credit. The unique index is (movie, cast, role), so the same person
 * can hold two roles on one title — e.g. director and writer — which the
 * legacy `ORDER BY role` cast list also assumed.
 */
export const addCastToMovie = (movie, cast, role, context) =>
  attach(movieCastRepository, { movie, cast, role }, {}, { page: 'movies', context });

export const removeCastFromMovie = (movie, cast, role, context) =>
  detach(movieCastRepository, { movie, cast, role }, { page: 'movies', context });

export const listMovieCasts = (movie) =>
  movieCastRepository.find({ movie, isDeleted: false }, { populate: ['cast'], sort: { role: 1 } });

/* ------------------------------------------- category content (members) --- */

/**
 * Builds the "what is inside this category" reader for one side of the
 * catalog. Both sides read the join from the item's own repository, which
 * already owns the lookup pipeline the public rails use.
 *
 * Legacy counterpart: `views/categories/content.php` and
 * `views/music-categories/content.php`, whose grids called
 * `CategoryController::list` -> `MovieModel::movieList`. That query filtered
 * `movie.is_delete = 0` only, so a deactivated title stayed listed and
 * removable — `activeOnly: false` preserves that. It also had **no LIMIT**;
 * pagination is added here for the same reason it was added to music search
 * (MIGRATION.md §6 defect 12): which rows match is unchanged.
 *
 * The legacy `daily` / `weekly` / `monthly` sort options are not offered: they
 * ranked by `visit_movie_tbl`, a table MIGRATION.md §7.6 records as dead.
 *
 * The category is resolved to a document first, for two reasons: an unknown id
 * must 404 rather than read as an empty category, and `findByCategory` matches
 * inside an aggregation pipeline — which, unlike a query, does **not** cast a
 * string to an ObjectId, so passing `req.params.id` through would match nothing.
 */
function buildMemberReader({
  repository,
  categoryRepository: categories,
  notFound,
  sortFields,
  defaultSort,
  project,
}) {
  return async function readMembers(categoryId, query = {}) {
    const category = await categories.findById(categoryId, { scope: 'admin' });
    if (!category) {
      throw ApiError.notFound(notFound);
    }

    const { page, limit, skip } = resolvePagination(query);
    const sort = resolveSort(query.item_sort, query.sort_type, {
      allowed: sortFields,
      defaultField: defaultSort,
      // The legacy query ended `ORDER BY <sort>, id`.
      tiebreaker: { _id: -1 },
    });

    const [items, total] = await Promise.all([
      repository.findByCategory(category._id, { sort, skip, limit, activeOnly: false, project }),
      repository.countByCategory(category._id, { activeOnly: false }),
    ]);

    return { category, items, meta: buildMeta({ page, limit, total }) };
  };
}

/** Movies inside a movie category, deactivated ones included. */
export const listCategoryMovies = buildMemberReader({
  repository: movieRepository,
  categoryRepository,
  notFound: 'Category not found',
  sortFields: MOVIE_SORT_FIELDS,
  defaultSort: 'created_date',
  project: MOVIE_ADMIN_ROW_FIELDS,
});

/** Music inside a music category, deactivated ones included. */
export const listMusicCategoryItems = buildMemberReader({
  repository: musicRepository,
  categoryRepository: musicCategoryRepository,
  notFound: 'Music category not found',
  sortFields: MUSIC_SORT_FIELDS,
  defaultSort: 'id',
  project: MUSIC_ADMIN_ROW_FIELDS,
});

export default {
  addMovieToCategory,
  removeMovieFromCategory,
  listMovieCategories,
  addMusicToCategory,
  removeMusicFromCategory,
  listMusicCategories,
  addBannerToCategory,
  removeBannerFromCategory,
  listCategoryBanners,
  addCastToMovie,
  removeCastFromMovie,
  listMovieCasts,
  listCategoryMovies,
  listMusicCategoryItems,
};
