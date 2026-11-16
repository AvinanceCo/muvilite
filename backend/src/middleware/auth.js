/**
 * Authentication middleware.
 *
 * Purpose: turn a Bearer token into `req.user`, with permissions resolved fresh
 *          from the database on every request.
 * Inputs:  Authorization header
 * Outputs: sets req.user; throws 401 otherwise
 * Deps:    services/auth, repositories, utils/{ApiError,asyncHandler}
 *
 * Legacy counterpart: admin/.../views/layout/header.php read
 * `UserSessionModel::readFromSession()` and redirected to the login page when it
 * came back false. That guard lived in the VIEW files only — the controllers
 * under admin/.../controllers/ included no such check, so hitting a controller
 * URL directly (they dispatch on `?@=`) skipped authentication entirely. Here
 * the guard is mounted on the route, so there is no path around it.
 */
import { userRepository } from '../repositories/index.js';
import { verifyToken, resolvePermissions } from '../services/auth.service.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';

function extractToken(req) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim() || null;
}

/**
 * Requires a valid token belonging to an active, non-deleted account.
 * Permissions are read per request, so a group change takes effect immediately
 * rather than at next login as it did in the legacy panel.
 */
export const authenticate = asyncHandler(async (req, _res, next) => {
  const token = extractToken(req);
  if (!token) {
    throw ApiError.unauthorized('Authentication required');
  }

  const payload = verifyToken(token);
  const user = await userRepository.findByIdWithPermissions(payload.sub);

  if (!user) {
    // Deleted or deactivated since the token was issued.
    throw ApiError.unauthorized('Account is no longer active');
  }

  req.user = {
    id: user._id,
    mobile: user.mobile,
    displayName: user.displayName,
    permissionGroup: user.permissionGroup
      ? { id: user.permissionGroup._id, name: user.permissionGroup.name }
      : null,
    permissions: resolvePermissions(user.permissionGroup),
  };

  return next();
});

/**
 * Requires the caller to be an administrator.
 * legacy: an account is an admin exactly when it belongs to a permission group.
 */
export const requireAdmin = (req, _res, next) => {
  if (!req.user?.permissionGroup) {
    return next(ApiError.forbidden('Administrator access required'));
  }
  return next();
};

export default { authenticate, requireAdmin };
