/**
 * Request validation middleware.
 *
 * Purpose: run an express-validator chain set and convert any failures into the
 *          project's standard validation response before a controller runs.
 * Inputs:  an array of express-validator chains
 * Outputs: middleware that either calls next() or throws ApiError.validation
 * Deps:    express-validator, utils/ApiError
 *
 * CLAUDE.md requires body, params, query and files to all be validated, and the
 * legacy code validated almost nothing — every route mounts this.
 */
import { validationResult, matchedData } from 'express-validator';
import ApiError from '../utils/ApiError.js';

/**
 * @param {import('express-validator').ValidationChain[]} chains
 */
export const validate = (chains) => [
  ...chains,
  (req, _res, next) => {
    const result = validationResult(req);

    if (!result.isEmpty()) {
      const errors = result.array().map((error) => ({
        field: error.path,
        location: error.location,
        message: error.msg,
      }));
      return next(ApiError.validation(errors));
    }

    // Expose only the values that were actually validated, so controllers
    // cannot accidentally read an unvalidated field off req.body.
    req.validated = matchedData(req, { includeOptionals: false });
    return next();
  },
];

export default validate;
