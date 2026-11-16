/**
 * Placeholder routes (public).
 *
 * Purpose: the fallback-image map, read once by a client on start-up.
 * Inputs:  none
 * Outputs: an Express router
 * Deps:    controllers/public/placeholder
 *
 * Public and unauthenticated, like the rest of the catalog: these are the images
 * the site draws, and the legacy equivalents were static files under
 * `/src/images/` that anyone could request by name.
 */
import { Router } from 'express';
import { getPlaceholders } from '../../controllers/public/placeholder.controller.js';

const router = Router();

router.get('/', getPlaceholders);

export default router;
