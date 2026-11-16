/**
 * Authentication endpoints.
 *
 * Purpose: sign in, restore a session, sign out, change own password.
 * Inputs:  credentials
 * Outputs: the authenticated user and its permission map
 * Deps:    api/client
 *
 * Legacy counterpart: `views/users/login.php`, which wrote `$_SESSION` and
 * checked the captcha *after* the credential check — a wrong captcha still
 * produced a valid session (backend/MIGRATION.md §6 defect 1). Nothing is
 * issued here until the password verifies, and there is no captcha.
 *
 * Two shapes to be careful with, both from backend/MIGRATION.md:
 *
 *   `permissions` is a SPARSE MAP. A section with no grant is absent entirely,
 *   not present with false flags. Read it through hooks/usePermissions, never
 *   by indexing directly.
 *
 *   `expiresIn` is the raw env string ("12h"), not a number of seconds. The
 *   real expiry is the `exp` claim inside the token.
 */
import { request } from './client.js';

/**
 * @param {{mobile: string, password: string}} credentials
 * @returns {Promise<{token: string, expiresIn: string, user: object}>}
 *
 * The API normalizes the mobile number, so `09121234567`, `9121234567` and
 * `+989121234567` are all the same account.
 */
export function login({ mobile, password }) {
  return request({
    url: '/admin/auth/login',
    method: 'POST',
    data: { mobile, password },
  });
}

/**
 * The signed-in administrator, re-read from the database.
 *
 * This is the source of truth for the permission set after a page reload, and
 * it is deliberately re-fetched rather than cached: the backend resolves
 * permissions per request, so a group change takes effect without re-login —
 * which the legacy panel could not do.
 *
 * Note it returns no `firstname`/`lastname`; only login does.
 */
export function fetchMe() {
  return request({ url: '/admin/auth/me' });
}

/**
 * Ends the session server-side (it writes an audit row) and returns.
 *
 * The token itself is stateless and stays valid until it expires, so the
 * client MUST discard it regardless of what this call does — including when it
 * fails, which is why callers ignore the rejection.
 */
export function logout() {
  return request({ url: '/admin/auth/logout', method: 'POST' });
}

/** @param {{currentPassword: string, newPassword: string}} payload */
export function changeOwnPassword(payload) {
  return request({ url: '/admin/auth/password', method: 'PATCH', data: payload });
}

export default { login, fetchMe, logout, changeOwnPassword };
