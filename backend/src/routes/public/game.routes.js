/**
 * Public game routes.
 *
 * Purpose: endpoint definitions for the HTML5 games catalog.
 * Inputs:  none
 * Outputs: an Express router, mounted at /api/games
 * Deps:    controllers/public/game, validators, middleware/validate
 *
 * No legacy actions to map — the legacy application had no games. Playva's
 * routes, for comparison (`playva-backend/routes/games.js`, `genres.js`):
 *
 *   GET  /api/games            -> GET  /api/games
 *   GET  /api/genres           -> GET  /api/games/genres
 *   GET  /api/games/:id        -> GET  /api/games/:id
 *   POST /api/games/:id/click  -> POST /api/games/:id/click
 *
 * The genre list sits under /games because `/api/lookups/genres` is already the
 * FILM taxonomy. It is declared before `/:id` so that "genres" is not read as an
 * id — which would be a 422, not a wrong answer, but a confusing one.
 *
 * The bundles themselves are static files under /uploads/games/** and are not
 * served by this router at all.
 */
import { Router } from 'express';
import { query } from 'express-validator';
import rateLimit from 'express-rate-limit';
import {
  getGames,
  getGameGenres,
  getGameById,
  postGameClick,
} from '../../controllers/public/game.controller.js';
import validate from '../../middleware/validate.js';
import {
  objectIdParam,
  paginationQuery,
  sortQuery,
  searchTextQuery,
} from '../../validators/common.validators.js';

const router = Router();

/**
 * One count per opening is the honest rate, so this is far above anything a
 * passenger produces. It is here because the endpoint is an unauthenticated
 * write that moves a number other passengers see — the "popular" ordering.
 */
const clickLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests', errors: [] },
});

router.get(
  '/',
  validate([
    searchTextQuery,
    query('genre').optional().isMongoId().withMessage('"genre" must be a valid id'),
    query('popular').optional().isBoolean().withMessage('"popular" must be a boolean').toBoolean(),
    ...paginationQuery,
    ...sortQuery,
  ]),
  getGames,
);

router.get('/genres', getGameGenres);

router.get('/:id', validate([objectIdParam()]), getGameById);

router.post('/:id/click', clickLimiter, validate([objectIdParam()]), postGameClick);

export default router;
