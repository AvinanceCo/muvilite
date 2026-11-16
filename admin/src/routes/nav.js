/**
 * Sidebar navigation model.
 *
 * Purpose: one declaration of every section, its route, and the permission that
 *          reveals it — used to build the sidenav and to pick a landing route.
 * Inputs:  none
 * Outputs: a grouped nav tree
 * Deps:    none
 *
 * The four groups and their Persian names are the legacy sidebar
 * (`views/layout/header.php:178-388`), preserved so an existing operator finds
 * things where they left them.
 *
 * TWO DELIBERATE CORRECTIONS to that sidebar, both consistent with
 * backend/MIGRATION.md §6 defect 18 ("wrong permission identifiers"):
 *
 *   1. Genres, age ranges and the two category sections were gated on
 *      `$user_group_id_session == 1` — a hardcoded group id, not a permission.
 *      Any other group, however privileged, could not see them. They are gated
 *      on their real keys (`genres`, `age-ranges`, `categories`) here.
 *   2. `views/polls/*` existed with no link into it at all — reachable only by
 *      typing the URL. It gets one.
 *
 * Items new to the UI (the backend serves them; the legacy panel had no screen)
 * are marked `isNew` in the comments rather than hidden: listen history, watch
 * trends, poll summary, countries, and the access-permission editor.
 *
 * The two advertising items go further than that: they are new FUNCTIONALITY,
 * not a screen for something the backend already did. Nothing in the legacy
 * application could create an ad — see pages/ads/ for what each replaces.
 */

/**
 * Each item: { to, label, page (permission key), icon }.
 * `page` is checked with `view`; an item whose permission is absent is not
 * rendered, and a group whose items all disappear is not rendered either.
 */
export const NAV_GROUPS = Object.freeze([
  {
    id: 'reports',
    label: 'مدیریت کاربران',
    icon: '👥',
    items: [
      { to: '/watch-history', label: 'سوابق تماشا', page: 'watch-history', icon: '▶' },
      // New: the table was written but never displayed.
      { to: '/listen-history', label: 'سوابق شنیدن', page: 'watch-history', icon: '♪' },
      { to: '/ads-history', label: 'سوابق نمایش تبلیغ', page: 'watch-history', icon: '◆' },
      // New: written by the nightly cron, never surfaced.
      { to: '/watch-trends', label: 'روند تماشا', page: 'watch-history', icon: '📈' },
      { to: '/poll-history', label: 'سوابق نظرات کاربران', page: 'pages', icon: '☰' },
      // New: an aggregate the legacy panel never computed.
      { to: '/poll-summary', label: 'جمع‌بندی نظرسنجی', page: 'pages', icon: '％' },
    ],
  },
  {
    id: 'access',
    label: 'مدیریت دسترسی ها',
    icon: '🔓',
    items: [
      { to: '/users', label: 'کاربران پنل', page: 'users', icon: '👤' },
      { to: '/user-categories', label: 'دسته بندی کاربران', page: 'users', icon: '🏷' },
      { to: '/permission-groups', label: 'گروه های دسترسی', page: 'groups', icon: '🔒' },
      // New: the legacy panel picked from a seeded list; there was no editor.
      { to: '/access-permissions', label: 'مجوز های دسترسی', page: 'groups', icon: '🗝' },
      { to: '/user-logs', label: 'گزارش فعالیت ها', page: 'user-logs', icon: '🕘' },
    ],
  },
  {
    id: 'content',
    label: 'مدیریت محتوا',
    icon: '🎬',
    items: [
      { to: '/movies', label: 'فیلم', page: 'movies', icon: '🎞' },
      { to: '/casts', label: 'شخصیت', page: 'casts', icon: '🎭' },
      { to: '/musics', label: 'موسیقی', page: 'musics', icon: '♬' },
      // New: the legacy application had no games. A game is a ZIP of static
      // files uploaded here and played in the passenger's browser.
      { to: '/games', label: 'بازی', page: 'games', icon: '🎮' },
    ],
  },
  {
    id: 'platform',
    label: 'مدیریت پلتفرم',
    icon: '▦',
    items: [
      { to: '/pages', label: 'مدیریت برگه ها', page: 'pages', icon: '▤' },
      { to: '/banners', label: 'بنر ها', page: 'banners', icon: '🔖' },
      { to: '/banner-categories', label: 'دسته بندی های بنر', page: 'banners', icon: '🗂' },
      // New: the legacy panel managed no advertisements at all. Pre-roll
      // creatives were VAST files uploaded over FTP and the two landing-page
      // slots were hardcoded in index.php.
      { to: '/video-ads', label: 'تبلیغات پیش از پخش', page: 'ads', icon: '📺' },
      { to: '/placement-ads', label: 'تبلیغات صفحهٔ اصلی', page: 'ads', icon: '🖼' },
      // New: the legacy fallback images were files that shipped with the theme
      // (src/images/posterHolder*.jpg) and could only be changed over FTP.
      { to: '/placeholders', label: 'تصاویر پیش‌فرض', page: 'placeholders', icon: '▩' },
      // New: the customer logo in the passenger site's footer and the copy on
      // its landing page — a theme image and two literals in index.php before.
      { to: '/branding', label: 'هویت بصری', page: 'branding', icon: '✦' },
      // New: installation-wide switches — today, the default MP4/HLS mode for
      // uploaded video (each upload can still choose its own).
      { to: '/settings/video', label: 'تنظیمات ویدئو', page: 'settings', icon: '⚙' },
      { to: '/categories', label: 'دسته بندی فیلم ها', page: 'categories', icon: '🎬' },
      { to: '/music-categories', label: 'دسته بندی موسیقی ها', page: 'categories', icon: '🎵' },
      { to: '/genres', label: 'ژانر ها', page: 'genres', icon: '🏷' },
      // New: the legacy application had no music genre at all.
      { to: '/music-genres', label: 'ژانر موسیقی', page: 'genres', icon: '🎼' },
      // New, with the games section. Gated on `games`, not `genres`.
      { to: '/game-genres', label: 'ژانر بازی', page: 'games', icon: '🕹' },
      { to: '/age-ranges', label: 'رده های سنی', page: 'age-ranges', icon: '🔞' },
      // New: reference data the legacy panel had no screen for.
      { to: '/countries', label: 'کشور ها', page: 'age-ranges', icon: '🌍' },
      // New link to an existing legacy screen that nothing pointed at.
      { to: '/polls', label: 'سوالات نظرسنجی', page: 'pages', icon: '❓' },
    ],
  },
]);

/**
 * The groups an administrator can see, with items they cannot removed.
 * @param {(page: string, action?: string) => boolean} can
 */
export function visibleGroups(can) {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => can(item.page, 'view')),
  })).filter((group) => group.items.length > 0);
}

/**
 * Where to send someone after signing in.
 *
 * The dashboard reads several sections at once, so it is only worth showing to
 * an operator who can see something on it. A single-section account — a
 * content editor with `movies` alone — lands on that section instead of a
 * dashboard of empty panels and 403s.
 */
export function landingRoute(can) {
  if (can('movies', 'view') || can('watch-history', 'view')) {
    return '/';
  }

  const groups = visibleGroups(can);
  return groups[0]?.items[0]?.to ?? '/no-access';
}

export default NAV_GROUPS;
