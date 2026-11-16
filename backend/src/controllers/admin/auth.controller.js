/**
 * Admin authentication controllers.
 *
 * Purpose: login, logout, current-user, and self-service password change.
 * Inputs:  Express req/res
 * Outputs: JSON responses
 * Deps:    services/auth, utils/{apiResponse,asyncHandler,clientInfo}
 */
import { login, logout, changePassword } from '../../services/auth.service.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import asyncHandler from '../../utils/asyncHandler.js';
import { getClientIp } from '../../utils/clientInfo.js';

/** POST /api/admin/auth/login */
export const postLogin = asyncHandler(async (req, res) => {
  const data = await login({
    mobile: req.body.mobile,
    password: req.body.password,
    userIp: getClientIp(req),
  });
  return sendSuccess(res, data, { message: 'Signed in' });
});

/** POST /api/admin/auth/logout */
export const postLogout = asyncHandler(async (req, res) => {
  const data = await logout({ userId: req.user.id, userIp: getClientIp(req) });
  return sendSuccess(res, data, { message: 'Signed out' });
});

/** GET /api/admin/auth/me — the caller plus their resolved permissions. */
export const getMe = asyncHandler(async (req, res) => sendSuccess(res, req.user));

/** PATCH /api/admin/auth/password */
export const patchPassword = asyncHandler(async (req, res) => {
  const data = await changePassword({
    userId: req.user.id,
    currentPassword: req.body.currentPassword,
    newPassword: req.body.newPassword,
  });
  return sendSuccess(res, data, { message: 'Password updated' });
});

export default { postLogin, postLogout, getMe, patchPassword };
