/**
 * Async route wrapper.
 *
 * Purpose: forward rejected promises from async controllers to Express's error
 *          middleware. Without it, a thrown ApiError inside an async handler
 *          would hang the request instead of producing a response.
 * Inputs:  an async (req, res, next) handler
 * Outputs: a handler Express can safely mount
 * Deps:    none
 */
export const asyncHandler = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

export default asyncHandler;
