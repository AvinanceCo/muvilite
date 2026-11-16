/**
 * Branding routes (public).
 *
 * Purpose: the customer logo and landing-page copy, read once by a client on
 *          start-up.
 * Inputs:  none
 * Outputs: an Express router
 * Deps:    controllers/public/branding
 *
 * Public and unauthenticated, like the placeholder map: this is chrome the site
 * draws, and its legacy equivalents were a theme image and two literals in
 * `index.php` that anyone could read by loading the page.
 */
import { Router } from 'express';
import { getBranding } from '../../controllers/public/branding.controller.js';

const router = Router();

router.get('/', getBranding);

export default router;
