/**
 * Authentication service.
 *
 * Purpose: verify admin credentials and issue JWTs.
 * Inputs:  mobile + password
 * Outputs: a signed token and the caller's resolved permissions
 * Deps:    jsonwebtoken, repositories, config/env, utils/*
 *
 * Legacy counterpart: admin/.../controllers/UserController.php::actionLogin,
 * driven by admin/.../views/users/login.php.
 *
 * Three deliberate divergences, all fixing real defects:
 *
 * 1. ORDER OF CHECKS. The legacy login called actionLogin() — which ran the
 *    credential query AND populated the session — at line 29, then compared the
 *    captcha at line 31. A wrong captcha therefore still produced a fully
 *    authenticated session; it only changed which page you were redirected to.
 *    Here nothing is issued until the password verifies.
 *
 * 2. PASSWORD STORAGE. The legacy table held unsalted sha1($password), and the
 *    hash was interpolated into the WHERE clause, so the lookup itself depended
 *    on the secret. Passwords are bcrypt here and verified after the row is
 *    loaded. `legacyPasswordHash` supports a transparent upgrade if a real
 *    database is ever imported: a correct SHA-1 on first login is accepted once
 *    and immediately replaced with a bcrypt hash.
 *
 * 3. STATELESS SESSIONS. The legacy panel snapshotted permissions into
 *    $_SESSION at login, so a permission change did not take effect until the
 *    user logged out and back in. Permissions are resolved per request from the
 *    database by the auth middleware instead.
 */
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { userRepository, userLogRepository } from '../repositories/index.js';
import env from '../config/env.js';
import ApiError from '../utils/ApiError.js';
import { normalizeMobile } from '../utils/mobile.js';
import logger from '../utils/logger.js';

/** Legacy hash function, kept only to verify carried-over credentials. */
const sha1 = (value) => crypto.createHash('sha1').update(value).digest('hex');

function signToken(user) {
  return jwt.sign({ sub: String(user._id), mobile: user.mobile }, env.jwtSecret, {
    expiresIn: env.jwtExpires,
  });
}

/**
 * Flattens a permission group into `{ page: {view, edit, delete} }`.
 *
 * DEFECT FIXED: the legacy resolver aggregated with
 *   `sum(action_view) AS action_view ... GROUP BY action_page`
 * and the guards then compared `== 1`. Two permission rows granting the same
 * flag for the same page summed to 2, the equality failed, and the user was
 * silently denied access they had been given. Flags are OR-ed here.
 */
export function resolvePermissions(permissionGroup) {
  const permissions = {};
  if (!permissionGroup?.permissions) return permissions;

  for (const permission of permissionGroup.permissions) {
    const page = permission.actionPage;
    if (!permissions[page]) {
      permissions[page] = { view: false, edit: false, delete: false };
    }
    permissions[page].view ||= Boolean(permission.actionView);
    permissions[page].edit ||= Boolean(permission.actionEdit);
    permissions[page].delete ||= Boolean(permission.actionDelete);
  }

  return permissions;
}

/**
 * Verifies credentials and returns a token.
 *
 * The same generic message is returned for "no such user", "wrong password" and
 * "not an administrator", so the endpoint cannot be used to enumerate accounts.
 *
 * @param {{mobile: string, password: string, userIp?: string}} input
 */
export async function login({ mobile, password, userIp }) {
  const normalized = normalizeMobile(mobile);
  const invalid = ApiError.unauthorized('Invalid mobile number or password');

  if (!normalized) throw invalid;

  const user = await userRepository.findByMobileForAuth(normalized);
  if (!user) throw invalid;

  let passwordMatches = await user.verifyPassword(password);

  // Carried-over SHA-1 credential: accept once, then upgrade to bcrypt.
  if (!passwordMatches && user.legacyPasswordHash) {
    if (sha1(password) === user.legacyPasswordHash) {
      passwordMatches = true;
      user.password = password;
      user.legacyPasswordHash = null;
      await user.save();
      logger.info(`Upgraded legacy password hash for user ${user._id}`);
    }
  }

  if (!passwordMatches) throw invalid;

  // Deactivated and soft-deleted accounts cannot sign in.
  if (!user.isActive || user.isDeleted) throw invalid;

  // legacy: `permission_group_id IS NOT NULL AND permission_group_id != 0` was
  // part of the login query — an account without a group is not an admin.
  if (!user.permissionGroup) throw invalid;

  user.lastLoginAt = new Date();
  user.userIp = userIp ?? user.userIp;
  await user.save();

  // The legacy panel logged entity CRUD but never logged authentication.
  await userLogRepository.create({
    user: user._id,
    userIp,
    actionPage: 'auth',
    actionType: 1,
    actionId: String(user._id),
    details: { event: 'login' },
  });

  return {
    token: signToken(user),
    expiresIn: env.jwtExpires,
    user: {
      id: user._id,
      mobile: user.mobile,
      displayName: user.displayName,
      firstname: user.firstname,
      lastname: user.lastname,
      permissionGroup: {
        id: user.permissionGroup._id,
        name: user.permissionGroup.name,
      },
      permissions: resolvePermissions(user.permissionGroup),
    },
  };
}

/**
 * Records a sign-out.
 *
 * JWTs are stateless, so this does not invalidate the token — the client
 * discards it and it expires on its own. It exists so the audit trail shows the
 * session ending, which the legacy panel never recorded either way.
 */
export async function logout({ userId, userIp }) {
  await userLogRepository.create({
    user: userId,
    userIp,
    actionPage: 'auth',
    actionType: 1,
    actionId: String(userId),
    details: { event: 'logout' },
  });
  return { loggedOut: true };
}

/** Verifies a bearer token and returns its payload. */
export function verifyToken(token) {
  try {
    return jwt.verify(token, env.jwtSecret);
  } catch {
    throw ApiError.unauthorized('Invalid or expired token');
  }
}

/** Changes the caller's own password. */
export async function changePassword({ userId, currentPassword, newPassword }) {
  const user = await userRepository.model.findById(userId).select('+password +legacyPasswordHash');
  if (!user) throw ApiError.notFound('User not found');

  let matches = await user.verifyPassword(currentPassword);
  if (!matches && user.legacyPasswordHash && sha1(currentPassword) === user.legacyPasswordHash) {
    matches = true;
  }
  if (!matches) throw ApiError.unauthorized('Current password is incorrect');

  user.password = newPassword;
  user.legacyPasswordHash = null;
  await user.save();

  return { changed: true };
}

export default { login, logout, verifyToken, resolvePermissions, changePassword };
