/**
 * Client IP resolution.
 *
 * Purpose: derive the viewer IP recorded on watch/listen/ads/poll history rows.
 * Inputs:  Express request
 * Outputs: an IP string
 * Deps:    none
 *
 * Legacy behaviour: `helper::get_ip_address()` (api/v2/controller/__helper.php)
 * and its admin twin walked HTTP_CLIENT_IP -> HTTP_X_FORWARDED_FOR -> ... ->
 * REMOTE_ADDR, trusting the first header present. That is trivially spoofable.
 *
 * Here we trust proxy headers only when the app is explicitly configured to sit
 * behind a proxy (`app.set('trust proxy', ...)`), which is what makes
 * `req.ip` safe to use. Analytics rows stay IP-keyed exactly as before — the
 * legacy app has no end-user login, so the IP is the only identity available.
 */
export function getClientIp(req) {
  return req.ip ?? req.socket?.remoteAddress ?? 'unknown';
}

export default { getClientIp };
