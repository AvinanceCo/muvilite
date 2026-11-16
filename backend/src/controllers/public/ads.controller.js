/**
 * Public advertisement controllers.
 *
 * Purpose: serve the pre-roll a player should show and the still ads a landing
 *          page should render.
 * Inputs:  Express req/res
 * Outputs: JSON, or an XML VAST document
 * Deps:    services/ad, utils/{apiResponse,asyncHandler}
 *
 * Legacy counterpart: none — the legacy client fetched a STATIC file
 * (`/assets/ads/vast3.xml`) chosen by a random number it generated itself, and
 * the landing-page ads were markup. Both are endpoints now.
 */
import { pickPreroll, listPlacementAds, renderVast } from '../../services/ad.service.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import asyncHandler from '../../utils/asyncHandler.js';

/**
 * Absolute origin of the current request, for URLs that leave the JSON envelope.
 * `trust proxy` is set in app.js, so these reflect the public address rather
 * than the internal one.
 */
const originOf = (req) => `${req.protocol}://${req.get('host')}`;

/**
 * GET /api/ads/preroll — one creative, weighted-random, or `null`.
 *
 * `null` is a success, not a 404: "no ad is scheduled" is a normal state and a
 * player must treat it as "go straight to content", which an error status would
 * make harder rather than easier.
 */
export const getPreroll = asyncHandler(async (_req, res) => {
  const ad = await pickPreroll();

  // The response differs per call by design; a cached copy would pin every
  // passenger to whichever creative was drawn first.
  res.set('Cache-Control', 'no-store');

  return sendSuccess(res, ad, { message: ad ? 'Success' : 'No advertisement scheduled' });
});

/**
 * GET /api/ads/vast.xml — the same selection as a VAST 3.0 document.
 *
 * Kept for the players that were configured with a tag URL rather than this
 * API: the legacy jwplayer setup and the mobile clients. Not used by the
 * passenger frontend, which reads the JSON above.
 */
export const getPrerollVast = asyncHandler(async (req, res) => {
  const ad = await pickPreroll();

  res.set('Cache-Control', 'no-store');
  res.type('application/xml');

  return res.send(renderVast(ad, originOf(req)));
});

/** GET /api/ads/placements — active still ads, grouped by slot. */
export const getPlacements = asyncHandler(async (_req, res) =>
  sendSuccess(res, await listPlacementAds()),
);

export default { getPreroll, getPrerollVast, getPlacements };
