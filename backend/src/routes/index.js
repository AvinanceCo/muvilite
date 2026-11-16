/**
 * Root API router.
 *
 * Purpose: mount the public and admin route trees under /api.
 * Inputs:  none
 * Outputs: an Express router
 * Deps:    routes/public/*, routes/admin/*
 */
import { Router } from 'express';
import catalogRoutes from './public/catalog.routes.js';
import trackingRoutes from './public/tracking.routes.js';
import adsRoutes from './public/ads.routes.js';
import lookupRoutes from './public/lookup.routes.js';
import placeholderRoutes from './public/placeholder.routes.js';
import brandingRoutes from './public/branding.routes.js';
import gameRoutes from './public/game.routes.js';
import adminRoutes from './admin/index.js';

const router = Router();

// Public — no authentication. There is no end-user login in this application.
router.use('/', catalogRoutes);
router.use('/', trackingRoutes);
router.use('/', adsRoutes);
router.use('/lookups', lookupRoutes);
// Fallback artwork. Its own resource rather than a lookup: these are images the
// site draws, not reference data for a dropdown.
router.use('/placeholders', placeholderRoutes);
// The customer logo and the landing-page copy. Same shape of thing as the
// placeholders: chrome an operator owns, read once per session.
router.use('/branding', brandingRoutes);
// HTML5 games: the listing, the genre filter row and the click counter. The
// games' own files are static and live under /uploads/games.
router.use('/games', gameRoutes);

// Admin — authenticated and permission-checked inside.
router.use('/admin', adminRoutes);

export default router;
