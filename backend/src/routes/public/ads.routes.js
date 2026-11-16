/**
 * Public advertisement routes.
 *
 * Purpose: endpoint definitions for ad delivery.
 * Inputs:  none
 * Outputs: an Express router
 * Deps:    controllers/public/ads
 *
 * Legacy artefact -> route:
 *   /assets/ads/vast{1..4}.xml  -> GET /api/ads/vast.xml   (server picks now)
 *   index.php `<div class="ads">` -> GET /api/ads/placements
 *
 * All three are reads and need no validation: none takes a parameter. The
 * selection input the legacy design exposed — the client choosing its own tag
 * number — is deliberately not reproduced.
 */
import { Router } from 'express';
import {
  getPreroll,
  getPrerollVast,
  getPlacements,
} from '../../controllers/public/ads.controller.js';

const router = Router();

router.get('/ads/preroll', getPreroll);
router.get('/ads/vast.xml', getPrerollVast);
router.get('/ads/placements', getPlacements);

export default router;
