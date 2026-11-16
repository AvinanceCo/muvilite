/**
 * Branding controller (public).
 *
 * Purpose: hand a client the customer logo and the landing-page copy.
 * Inputs:  Express req/res
 * Outputs: JSON `{ footerLogoPath, homeTitle, homeDescription }`
 * Deps:    services/branding, utils/{apiResponse,asyncHandler}
 */
import { getPublicBranding } from '../../services/branding.service.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import asyncHandler from '../../utils/asyncHandler.js';

/**
 * GET /api/branding
 *
 * The text fields are always present and never empty — the service substitutes
 * the shipped default for a field the operator left blank, so a client renders
 * what it is given without a fallback of its own. `footerLogoPath` is null when
 * no customer logo has been uploaded, and the footer then draws none.
 */
export const getBranding = asyncHandler(async (_req, res) =>
  sendSuccess(res, await getPublicBranding()),
);

export default { getBranding };
