/**
 * Lookup controllers.
 *
 * Purpose: expose reference data to clients.
 * Inputs:  Express req/res
 * Outputs: JSON responses
 * Deps:    services/lookup, utils/{apiResponse,asyncHandler}
 */
import {
  listGenres,
  listAgeRanges,
  listCountries,
  listStaticLookups,
} from '../../services/lookup.service.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import asyncHandler from '../../utils/asyncHandler.js';

export const getGenres = asyncHandler(async (_req, res) => sendSuccess(res, await listGenres()));

export const getAgeRanges = asyncHandler(async (_req, res) => sendSuccess(res, await listAgeRanges()));

export const getCountries = asyncHandler(async (_req, res) => sendSuccess(res, await listCountries()));

export const getStatic = asyncHandler(async (_req, res) => sendSuccess(res, listStaticLookups()));

export default { getGenres, getAgeRanges, getCountries, getStatic };
