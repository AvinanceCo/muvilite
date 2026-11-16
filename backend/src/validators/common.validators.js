/**
 * Reusable validation chains.
 *
 * Purpose: the checks that repeat across nearly every endpoint — an ObjectId in
 *          the path, and the pagination/sort query trio.
 * Inputs:  none
 * Outputs: express-validator chains
 * Deps:    express-validator, config/constants
 *
 * Legacy counterpart: `App::process()` validated `id` with
 * `filter_var($id, FILTER_VALIDATE_INT)` and redirected to `/` when it failed;
 * `page` and `limit` got the same integer treatment. Nothing else was checked.
 */
import { param, query } from 'express-validator';
import { MAX_PAGE_SIZE } from '../config/constants.js';

/** An ObjectId path parameter. */
export const objectIdParam = (name = 'id') =>
  param(name).isMongoId().withMessage(`"${name}" must be a valid id`);

/**
 * Pagination query. Both are optional; the service applies the legacy defaults
 * (page 1, limit 100) when they are absent.
 */
export const paginationQuery = [
  query('page').optional().isInt({ min: 1 }).withMessage('"page" must be a positive integer').toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: MAX_PAGE_SIZE })
    .withMessage(`"limit" must be between 1 and ${MAX_PAGE_SIZE}`)
    .toInt(),
];

/**
 * Sort query. The field itself is whitelisted per endpoint inside the service
 * (the allowed sets genuinely differ), so only the direction is checked here.
 */
export const sortQuery = [
  query('item_sort').optional().isString().trim(),
  query('sort_type')
    .optional()
    .toUpperCase()
    .isIn(['ASC', 'DESC'])
    .withMessage('"sort_type" must be ASC or DESC'),
];

/** Free-text search term. Length-capped so a huge regex cannot be built. */
export const searchTextQuery = query('text')
  .optional()
  .isString()
  .trim()
  .isLength({ max: 200 })
  .withMessage('"text" must be at most 200 characters');

export default { objectIdParam, paginationQuery, sortQuery, searchTextQuery };
