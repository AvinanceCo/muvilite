/**
 * Public catalog routes.
 *
 * Purpose: endpoint definitions only — each maps a REST route to a validator
 *          set and a controller. No logic here, per CLAUDE.md.
 * Inputs:  none
 * Outputs: an Express router
 * Deps:    controllers/public/catalog, validators, middleware/validate
 *
 * Legacy action -> route:
 *   ?@=page             -> GET /api/pages/:idOrSlug
 *   ?@=movie            -> GET /api/movies/:id
 *   ?@=similar          -> GET /api/movies/:id/similar
 *   ?@=categories       -> GET /api/categories/:id/movies
 *   ?@=search           -> GET /api/search
 *   ?@=music            -> GET /api/musics/:id
 *   ?@=musics           -> GET /api/musics
 *   ?@=music_categories -> GET /api/music-categories/:id/musics
 */
import { Router } from 'express';
import { param } from 'express-validator';
import {
  getPage,
  getMovie,
  getSimilar,
  getCategoryMovies,
  search,
  getMusic,
  getMusicCategoryItems,
  searchMusics,
} from '../../controllers/public/catalog.controller.js';
import validate from '../../middleware/validate.js';
import {
  objectIdParam,
  paginationQuery,
  sortQuery,
  searchTextQuery,
} from '../../validators/common.validators.js';

const router = Router();

// A page is addressable by id or by slug, so this one is not an ObjectId check.
router.get(
  '/pages/:idOrSlug',
  validate([
    param('idOrSlug')
      .isString()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('"idOrSlug" is required'),
  ]),
  getPage,
);

router.get('/movies/:id', validate([objectIdParam()]), getMovie);
router.get('/movies/:id/similar', validate([objectIdParam()]), getSimilar);

router.get(
  '/categories/:id/movies',
  validate([objectIdParam(), ...paginationQuery, ...sortQuery]),
  getCategoryMovies,
);

router.get('/search', validate([searchTextQuery, ...paginationQuery, ...sortQuery]), search);

router.get('/musics', validate([searchTextQuery, ...paginationQuery]), searchMusics);
router.get('/musics/:id', validate([objectIdParam()]), getMusic);

router.get(
  '/music-categories/:id/musics',
  validate([objectIdParam(), ...paginationQuery, ...sortQuery]),
  getMusicCategoryItems,
);

export default router;
