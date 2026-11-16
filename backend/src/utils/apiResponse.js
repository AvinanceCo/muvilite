/**
 * Response envelope helpers.
 *
 * Purpose: keep every endpoint on the exact success/failure shape CLAUDE.md
 *          specifies, so clients never have to special-case a route.
 * Inputs:  Express response, payload, optional message/meta
 * Outputs: writes JSON
 * Deps:    none
 *
 * Success: { success: true,  message, data, meta? }
 * Failure: { success: false, message, errors }
 */

/**
 * @param {import('express').Response} res
 * @param {unknown} data      payload placed under `data`
 * @param {object}  [options]
 * @param {string}  [options.message='Success']
 * @param {number}  [options.statusCode=200]
 * @param {object}  [options.meta]  pagination info for list endpoints
 */
export function sendSuccess(res, data = null, { message = 'Success', statusCode = 200, meta } = {}) {
  const body = { success: true, message, data };
  if (meta !== undefined) {
    body.meta = meta;
  }
  return res.status(statusCode).json(body);
}

export function sendCreated(res, data, options = {}) {
  return sendSuccess(res, data, { message: 'Created', statusCode: 201, ...options });
}

/**
 * Only used by the error middleware — controllers should throw ApiError instead
 * of calling this directly.
 */
export function sendFailure(res, { message = 'Request failed', statusCode = 400, errors = [] } = {}) {
  return res.status(statusCode).json({ success: false, message, errors });
}

export default { sendSuccess, sendCreated, sendFailure };
