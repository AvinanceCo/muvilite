/**
 * Public catalog controllers.
 *
 * Purpose: parse validated requests, call the catalog services, and shape the
 *          standard response envelope. No business logic and no database access
 *          lives here, per the layering rules in CLAUDE.md.
 * Inputs:  Express req/res
 * Outputs: JSON responses
 * Deps:    services/{page,movie,music}, utils/{apiResponse,asyncHandler}
 */
import { getPageWithBlocks } from '../../services/page.service.js';
import {
  getMovieDetail,
  getSimilarMovies,
  listMoviesByCategory,
  searchMovies,
} from '../../services/movie.service.js';
import {
  getMusicDetail,
  listMusicByCategory,
  searchMusic,
} from '../../services/music.service.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import asyncHandler from '../../utils/asyncHandler.js';

/** GET /api/pages/:idOrSlug — legacy `?@=page` */
export const getPage = asyncHandler(async (req, res) => {
  const data = await getPageWithBlocks(req.params.idOrSlug);
  return sendSuccess(res, data);
});

/** GET /api/movies/:id — legacy `?@=movie` */
export const getMovie = asyncHandler(async (req, res) => {
  const data = await getMovieDetail(req.params.id);
  return sendSuccess(res, data);
});

/** GET /api/movies/:id/similar — legacy `?@=similar` */
export const getSimilar = asyncHandler(async (req, res) => {
  const data = await getSimilarMovies(req.params.id);
  return sendSuccess(res, data);
});

/** GET /api/categories/:id/movies — legacy `?@=categories` */
export const getCategoryMovies = asyncHandler(async (req, res) => {
  const { category, items, meta } = await listMoviesByCategory(req.params.id, req.query);
  return sendSuccess(res, { category, items }, { meta });
});

/** GET /api/search — legacy `?@=search` */
export const search = asyncHandler(async (req, res) => {
  const { items, meta } = await searchMovies(req.query);
  return sendSuccess(res, items, { meta });
});

/** GET /api/musics/:id — legacy `?@=music` */
export const getMusic = asyncHandler(async (req, res) => {
  const data = await getMusicDetail(req.params.id);
  return sendSuccess(res, data);
});

/** GET /api/music-categories/:id/musics — legacy `?@=music_categories` */
export const getMusicCategoryItems = asyncHandler(async (req, res) => {
  const { category, items, meta } = await listMusicByCategory(req.params.id, req.query);
  return sendSuccess(res, { category, items }, { meta });
});

/** GET /api/musics — legacy `?@=musics` */
export const searchMusics = asyncHandler(async (req, res) => {
  const { items, meta } = await searchMusic(req.query);
  return sendSuccess(res, items, { meta });
});

export default {
  getPage,
  getMovie,
  getSimilar,
  getCategoryMovies,
  search,
  getMusic,
  getMusicCategoryItems,
  searchMusics,
};
