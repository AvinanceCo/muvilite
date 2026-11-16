/**
 * Operational HTTP error.
 *
 * Purpose: distinguish errors we raise deliberately (and whose message is safe
 *          to show a client) from unexpected crashes, which the error
 *          middleware masks.
 * Inputs:  status code, message, optional field-level errors array
 * Outputs: an Error subclass carrying `statusCode`, `errors`, `isOperational`
 * Deps:    none
 */
export class ApiError extends Error {
  constructor(statusCode, message, errors = []) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errors = errors;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = 'Bad request', errors = []) {
    return new ApiError(400, message, errors);
  }

  static unauthorized(message = 'Authentication required') {
    return new ApiError(401, message);
  }

  static forbidden(message = 'You do not have permission to perform this action') {
    return new ApiError(403, message);
  }

  static notFound(message = 'Resource not found') {
    return new ApiError(404, message);
  }

  static conflict(message = 'Conflict') {
    return new ApiError(409, message);
  }

  static validation(errors, message = 'Validation failed') {
    return new ApiError(422, message, errors);
  }

  static tooManyRequests(message = 'Too many requests') {
    return new ApiError(429, message);
  }
}

export default ApiError;
