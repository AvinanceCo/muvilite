/**
 * Lookup routes.
 *
 * Purpose: reference-data endpoints.
 * Inputs:  none
 * Outputs: an Express router
 * Deps:    controllers/public/lookup
 */
import { Router } from 'express';
import {
  getGenres,
  getAgeRanges,
  getCountries,
  getStatic,
} from '../../controllers/public/lookup.controller.js';

const router = Router();

router.get('/genres', getGenres);
router.get('/age-ranges', getAgeRanges);
router.get('/countries', getCountries);
/** Cast roles, video qualities, languages and device platforms. */
router.get('/static', getStatic);

export default router;
