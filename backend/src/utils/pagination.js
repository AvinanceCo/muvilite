/**
 * Pagination and sorting helpers.
 *
 * Purpose: reproduce the legacy paging and ordering semantics exactly, and give
 *          every list endpoint one place to enforce its own sort whitelist.
 * Inputs:  request query values
 * Outputs: { page, limit, skip } and validated sort objects
 * Deps:    config/constants, utils/ApiError
 *
 * Legacy reference (api/v2/index.php):
 *   - `limit` defaults to PER_PAGE_PAGINATION (100) and is clamped to
 *     MAXIMUM_PAGINATION (100).
 *   - the offset is computed as `(page - 1) * limit`, and only when `page > 0`;
 *     page 0 and page 1 both mean "start at the first row".
 *   - `sort_type` accepts only DESC or ASC and defaults to DESC.
 *   - the allowed `item_sort` columns differ per endpoint, so the whitelist is
 *     always supplied by the caller rather than shared.
 */
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../config/constants.js';
import ApiError from './ApiError.js';

/**
 * @param {object} query           req.query
 * @param {object} [options]
 * @param {number} [options.defaultLimit=DEFAULT_PAGE_SIZE]
 * @param {number} [options.maxLimit=MAX_PAGE_SIZE]
 * @returns {{page: number, limit: number, skip: number}}
 */
export function resolvePagination(query = {}, { defaultLimit = DEFAULT_PAGE_SIZE, maxLimit = MAX_PAGE_SIZE } = {}) {
  const rawPage = Number.parseInt(query.page, 10);
  const rawLimit = Number.parseInt(query.limit, 10);

  const page = Number.isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;

  let limit = Number.isNaN(rawLimit) || rawLimit < 1 ? defaultLimit : rawLimit;
  if (limit > maxLimit) {
    limit = maxLimit;
  }

  return { page, limit, skip: (page - 1) * limit };
}

/**
 * Build a Mongoose sort object from client input, rejecting anything outside
 * the endpoint's whitelist.
 *
 * The legacy code interpolated these values straight into SQL. Validating here
 * closes that injection path — including the second-order one, where
 * `item_sort` arrives from a `page_block_tbl` row rather than the request.
 *
 * @param {string|undefined} field       requested sort field
 * @param {string|undefined} direction   'ASC' | 'DESC' (case-insensitive)
 * @param {object} options
 * @param {Record<string,string>} options.allowed  request field -> schema path
 * @param {string} options.defaultField            request field used when none given
 * @param {string} [options.defaultDirection='DESC']
 * @param {Record<string,1|-1>} [options.tiebreaker]  appended to keep ordering stable
 * @returns {Record<string, 1|-1>}
 */
export function resolveSort(field, direction, { allowed, defaultField, defaultDirection = 'DESC', tiebreaker }) {
  const requestedField = field ?? defaultField;

  if (!Object.prototype.hasOwnProperty.call(allowed, requestedField)) {
    throw ApiError.badRequest(
      `Invalid sort field "${requestedField}". Allowed values: ${Object.keys(allowed).join(', ')}`,
    );
  }

  const requestedDirection = (direction ?? defaultDirection).toUpperCase();
  if (requestedDirection !== 'ASC' && requestedDirection !== 'DESC') {
    throw ApiError.badRequest('Invalid sort direction. Allowed values: ASC, DESC');
  }

  const sort = { [allowed[requestedField]]: requestedDirection === 'ASC' ? 1 : -1 };
  return tiebreaker ? { ...sort, ...tiebreaker } : sort;
}

/**
 * Pagination block attached to list responses as `meta`.
 */
export function buildMeta({ page, limit, total }) {
  return {
    page,
    limit,
    total,
    totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
  };
}

export default { resolvePagination, resolveSort, buildMeta };
