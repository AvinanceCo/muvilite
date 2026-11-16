/**
 * Movie service — public catalog business logic.
 *
 * Purpose: reproduce `api/v2/index.php::movie()`, `::similar()`, `::categories()`
 *          and `::search()`.
 * Inputs:  ids, query parameters
 * Outputs: view models for the movie detail, listing and search endpoints
 * Deps:    repositories, config/constants, utils/{pagination,ApiError}
 */
import {
  movieRepository,
  categoryRepository,
  countryRepository,
  MOVIE_SORT_FIELDS,
} from '../repositories/index.js';
import { CAST_ROLES, SIMILAR_MOVIE_LIMIT } from '../config/constants.js';
import { resolvePagination, resolveSort, buildMeta } from '../utils/pagination.js';
import ApiError from '../utils/ApiError.js';

/**
 * Sort keys accepted by the category listing endpoint.
 * legacy (api/v2/index.php::categories) whitelist, defaulting to created_date:
 *   imdb_rank | visit_count | created_date | publish_date | modified_date
 */
const CATEGORY_SORTS = Object.freeze({
  imdb_rank: MOVIE_SORT_FIELDS.imdb_rank,
  visit_count: MOVIE_SORT_FIELDS.visit_count,
  created_date: MOVIE_SORT_FIELDS.created_date,
  publish_date: MOVIE_SORT_FIELDS.publish_date,
  modified_date: MOVIE_SORT_FIELDS.modified_date,
});

/**
 * Sort keys accepted by search — a NARROWER set than the listing endpoint:
 * modified_date is absent, and the legacy default was `id`, not created_date.
 * legacy: api/v2/index.php::search
 */
const SEARCH_SORTS = Object.freeze({
  imdb_rank: MOVIE_SORT_FIELDS.imdb_rank,
  visit_count: MOVIE_SORT_FIELDS.visit_count,
  created_date: MOVIE_SORT_FIELDS.created_date,
  publish_date: MOVIE_SORT_FIELDS.publish_date,
  id: MOVIE_SORT_FIELDS.id,
});

const roleLabel = (value) => CAST_ROLES.find((role) => role.value === value) ?? null;

/**
 * Movie detail, with genres, credits, country and age rating resolved.
 *
 * Legacy behaviour preserved: `Movie::withGenre()` INNER JOINed genres_tbl on
 * genre_1, so a movie without a primary genre never rendered. That is enforced
 * explicitly below rather than left to a join side effect.
 *
 * genre_2 and genre_3 were each looked up only when non-null AND non-zero, so a
 * movie carries at most three genres.
 */
export async function getMovieDetail(movieId) {
  const movie = await movieRepository.findDetailById(movieId);

  if (!movie) {
    throw ApiError.notFound('Movie not found');
  }

  // Mirrors the legacy INNER JOIN on genre_1.
  if (!movie.genre1) {
    throw ApiError.notFound('Movie not found');
  }

  const [casts, country] = await Promise.all([
    movieRepository.findCasts(movieId),
    movie.country ? countryRepository.findOne({ countryCode: movie.country, isDeleted: false }) : null,
  ]);

  const genres = [movie.genre1, movie.genre2, movie.genre3].filter(Boolean).map((genre) => ({
    id: genre._id,
    nameFa: genre.nameFa,
    nameEn: genre.nameEn,
    colorClass: genre.colorClass,
  }));

  return {
    id: movie._id,
    titleFa: movie.titleFa,
    titleEn: movie.titleEn,
    // New: lets a client tell a short vertical clip from a feature before it
    // decides how to frame the player. Nothing on the passenger site branches on
    // it yet; it is exposed because the distinction is meaningless if only the
    // panel can see it.
    isClip: movie.isClip,
    // Returned as stored. The legacy page replaced \r\n with <br> before
    // echoing; that is a rendering concern and belongs to the client.
    descriptionFa: movie.descriptionFa,
    descriptionEn: movie.descriptionEn,
    publishYear: movie.publishYear,
    imdbRank: movie.imdbRank,
    imdbCode: movie.imdbCode,
    company: movie.company,
    location: movie.location,
    tags: movie.tags,
    movieLength: movie.movieLength,
    isKids: movie.isKids,
    platform: movie.platform,
    posterPath: movie.posterPath,
    thumbnailPath: movie.thumbnailPath,
    trailerPath: movie.trailerPath,
    // The legacy player page read the video from a public derived URL
    // (assets/video/{id}.mp4), so the stored path is exposed here for the same
    // reason: without it a client cannot play the title at all.
    videoPath: movie.videoPath,
    visitCount: movie.visitCount,
    genres,
    ageRange: movie.ageRange
      ? { id: movie.ageRange._id, nameFa: movie.ageRange.nameFa, nameEn: movie.ageRange.nameEn }
      : null,
    country: country ? { code: country.countryCode, fa: country.countryFa, en: country.countryEn } : null,
    casts: casts
      // A credit whose person is inactive/deleted comes back with a null
      // populate, matching the legacy join's is_active/is_delete conditions.
      .filter((credit) => credit.cast)
      .map((credit) => ({
        id: credit.cast._id,
        fullnameFa: credit.cast.fullnameFa,
        fullnameEn: credit.cast.fullnameEn,
        photoPath: credit.cast.photoPath,
        role: credit.role,
        roleLabel: roleLabel(credit.role),
      })),
  };
}

/**
 * Related titles: same primary genre, random order, capped at 4.
 * legacy: api/v2/index.php::similar — `ORDER BY RAND() LIMIT 0,4`.
 */
export async function getSimilarMovies(movieId) {
  const movie = await movieRepository.findById(movieId, { select: 'genre1' });
  if (!movie) {
    throw ApiError.notFound('Movie not found');
  }
  if (!movie.genre1) {
    return [];
  }
  return movieRepository.findSimilar(movie._id, movie.genre1, SIMILAR_MOVIE_LIMIT);
}

/**
 * Movies in a category, paginated.
 * legacy: api/v2/index.php::categories — 404s when the category itself is
 * missing or inactive, before any movie lookup happens.
 */
export async function listMoviesByCategory(categoryId, query) {
  const category = await categoryRepository.findById(categoryId);
  if (!category) {
    throw ApiError.notFound('Category not found');
  }

  const { page, limit, skip } = resolvePagination(query);
  const sort = resolveSort(query.item_sort, query.sort_type, {
    allowed: CATEGORY_SORTS,
    defaultField: 'created_date',
    defaultDirection: 'DESC',
    tiebreaker: { _id: -1 },
  });

  const [items, total] = await Promise.all([
    movieRepository.findByCategory(category._id, { sort, skip, limit }),
    movieRepository.countByCategory(category._id),
  ]);

  return {
    category: { id: category._id, nameFa: category.nameFa, nameEn: category.nameEn },
    items,
    meta: buildMeta({ page, limit, total }),
  };
}

/**
 * Catalog search.
 * legacy: api/v2/index.php::search — an empty `text` returned the first page of
 * all active movies rather than an error, which is preserved.
 */
export async function searchMovies(query) {
  const { page, limit, skip } = resolvePagination(query);
  const sort = resolveSort(query.item_sort, query.sort_type, {
    allowed: SEARCH_SORTS,
    defaultField: 'id',
    defaultDirection: 'DESC',
  });

  const filter = movieRepository.buildSearchFilter(query.text);

  const { items, total } = await movieRepository.paginate(filter, {
    sort,
    skip,
    limit,
    select: 'titleFa titleEn imdbRank posterPath thumbnailPath visitCount',
  });

  return { items, meta: buildMeta({ page, limit, total }) };
}

export default { getMovieDetail, getSimilarMovies, listMoviesByCategory, searchMovies };
