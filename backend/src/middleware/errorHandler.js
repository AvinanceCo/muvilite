/**
 * Centralized error handling.
 *
 * Purpose: turn every failure — thrown ApiError, Mongoose validation/cast
 *          error, duplicate key, multer upload error, or an unexpected crash —
 *          into the standard failure envelope, without ever leaking a stack
 *          trace to the client.
 * Inputs:  errors forwarded by Express
 * Outputs: a JSON failure response; server errors are logged
 * Deps:    mongoose, multer, utils/{ApiError,apiResponse,logger}
 */
import mongoose from 'mongoose';
import multer from 'multer';
import ApiError from '../utils/ApiError.js';
import { sendFailure } from '../utils/apiResponse.js';
import logger from '../utils/logger.js';

/** 404 handler for unmatched routes. Mounted after all routers. */
export function notFoundHandler(req, _res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

/**
 * Normalizes a non-ApiError into one, so the responder below has a single shape
 * to work with.
 */
function normalize(error) {
  if (error instanceof ApiError) {
    return error;
  }

  if (error instanceof mongoose.Error.ValidationError) {
    const errors = Object.values(error.errors).map((item) => ({
      field: item.path,
      message: item.message,
    }));
    return ApiError.validation(errors);
  }

  if (error instanceof mongoose.Error.CastError) {
    return ApiError.badRequest(`Invalid value for "${error.path}"`);
  }

  // Duplicate key on a unique index.
  if (error?.code === 11000) {
    const fields = Object.keys(error.keyPattern ?? {});
    return ApiError.conflict(
      fields.length > 0 ? `Already exists: ${fields.join(', ')}` : 'Duplicate value',
    );
  }

  if (error instanceof multer.MulterError) {
    const message =
      error.code === 'LIMIT_FILE_SIZE' ? 'Uploaded file is too large' : `Upload failed: ${error.message}`;
    return ApiError.badRequest(message);
  }

  return null;
}

// eslint-disable-next-line no-unused-vars -- Express identifies error middleware by arity.
export function errorHandler(error, req, res, _next) {
  const normalized = normalize(error);

  if (normalized) {
    if (normalized.statusCode >= 500) {
      logger.error(`${req.method} ${req.originalUrl}`, error);
    }
    return sendFailure(res, {
      message: normalized.message,
      statusCode: normalized.statusCode,
      errors: normalized.errors,
    });
  }

  // Unexpected: log everything, tell the client nothing.
  logger.error(`Unhandled error on ${req.method} ${req.originalUrl}`, error);
  return sendFailure(res, { message: 'Internal server error', statusCode: 500 });
}

export default { notFoundHandler, errorHandler };
