/**
 * Placeholder controller (public).
 *
 * Purpose: hand a client the fallback image to draw for a record that has none.
 * Inputs:  Express req/res
 * Outputs: JSON `{ slot: path }`
 * Deps:    services/placeholder, utils/{apiResponse,asyncHandler}
 */
import { getPlaceholderMap } from '../../services/placeholder.service.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import asyncHandler from '../../utils/asyncHandler.js';

/**
 * GET /api/placeholders
 *
 * Answers a flat map of the CONFIGURED slots only — an unconfigured slot is
 * absent, not null, so a client resolves with `map[slot] ?? map.general ?? own`.
 * Paths are the same `/uploads/...` form as every other stored media path.
 */
export const getPlaceholders = asyncHandler(async (_req, res) =>
  sendSuccess(res, await getPlaceholderMap()),
);

export default { getPlaceholders };
