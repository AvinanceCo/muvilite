/**
 * Domain constants and display vocabulary.
 *
 * Purpose: the enumerations the panel renders as dropdowns, badges and column
 *          labels — kept in one place so a value and its Persian label can
 *          never drift apart.
 * Inputs:  none
 * Outputs: frozen constant maps
 * Deps:    none
 *
 * The numeric values mirror backend/src/config/constants.js, which took them
 * verbatim from the legacy PHP. **Changing a value changes behaviour** — these
 * are stored in the database, not display preferences. The Persian labels come
 * from the legacy admin views.
 */

/** legacy: api/system/define.php CASTS_ROLE_FA — the order is the sort order. */
export const CAST_ROLES = Object.freeze([
  { value: 0, label: 'بازیگر' },
  { value: 1, label: 'کارگردان' },
  { value: 2, label: 'تهیه کننده' },
  { value: 3, label: 'نویسنده' },
  { value: 4, label: 'صدا پیشه' },
  { value: 5, label: 'تدوین‌گر' },
  { value: 6, label: 'آهنگ‌ساز' },
]);

export const castRoleLabel = (value) =>
  CAST_ROLES.find((role) => role.value === value)?.label ?? String(value ?? '');

/** legacy: admin/includes/define.php DEVICE_PLATFORMS */
export const PLATFORMS = Object.freeze([
  { value: 0, label: 'وب' },
  { value: 1, label: 'اندروید' },
  { value: 2, label: 'iOS' },
  { value: 3, label: 'اندروید TV' },
  { value: 4, label: 'وب TV' },
]);

export const platformLabel = (value) =>
  PLATFORMS.find((platform) => platform.value === value)?.label ?? String(value ?? '');

/**
 * legacy: admin/includes/define.php USER_LOG_ACTIONS. The activity log stores
 * the action as this integer.
 */
export const LOG_ACTIONS = Object.freeze([
  { value: 0, label: 'ایجاد' },
  { value: 1, label: 'ویرایش' },
  { value: 2, label: 'حذف' },
]);

export const logActionLabel = (value) =>
  LOG_ACTIONS.find((action) => action.value === value)?.label ?? String(value ?? '');

/** legacy: api/v2/index.php::page() switch on item_type */
export const BLOCK_ITEM_TYPES = Object.freeze([
  { value: 'banner', label: 'بنر' },
  { value: 'category', label: 'دسته بندی فیلم' },
  { value: 'music', label: 'دسته بندی موسیقی' },
]);

/**
 * A page block's own sort, applied to the items inside its rail. This exact set
 * is the backend's enum — anything else is rejected on write (MIGRATION.md §6
 * defect 4, the second-order injection).
 */
export const BLOCK_SORT_FIELDS = Object.freeze([
  { value: 'created_date', label: 'تاریخ ایجاد' },
  { value: 'modified_date', label: 'تاریخ ویرایش' },
  { value: 'publish_date', label: 'سال انتشار' },
  { value: 'imdb_rank', label: 'امتیاز IMDb' },
  { value: 'visit_count', label: 'تعداد بازدید' },
  { value: 'id', label: 'شناسه' },
]);

export const SORT_DIRECTIONS = Object.freeze([
  { value: 'DESC', label: 'نزولی' },
  { value: 'ASC', label: 'صعودی' },
]);

/**
 * legacy: banner_categories_tbl.type — drives the slide dimensions client-side.
 *
 * «تمام عرض» (`full`) is RETIRED at the maintainer's request and commented out
 * rather than deleted: putting the line back, together with its counterparts in
 * the backend's BANNER_CATEGORY_TYPES_AVAILABLE and BANNER_IMAGE_SIZES and the
 * frontend's BannerRail, is all it takes to restore it.
 *
 * A category created before the withdrawal may still be typed `full`. The API
 * refuses to SAVE that value, so such a category has to be given a surviving
 * type before its form will submit — which is the intended prompt, not a bug.
 */
export const BANNER_CATEGORY_TYPES = Object.freeze([
  { value: 'item', label: 'معمولی' },
  { value: 'long', label: 'کشیده' },
  // { value: 'full', label: 'تمام عرض' },  // retired — full-width banner
]);

/**
 * REQUIRED banner artwork dimensions, mirroring the backend's
 * BANNER_IMAGE_SIZES. Stated under the uploader and enforced on both sides.
 *
 * These are the legacy figures: the holder image shipped for each rail style
 * names them — `posterHolder1920x360.jpg` for «کشیده», `posterHolder517x282.jpg`
 * for «معمولی».
 *
 * A banner has no type of its own — the rail it appears in does, and it can
 * appear in several — so an upload is accepted when it matches ANY of these.
 */
export const BANNER_IMAGE_SIZES = Object.freeze([
  // { width: 1920, height: 720, label: 'تمام عرض' },  // retired with `full`
  Object.freeze({ width: 1920, height: 360, label: 'کشیده' }),
  Object.freeze({ width: 517, height: 282, label: 'معمولی' }),
]);

/**
 * The two fixed advertisement slots on the passenger landing page, each with the
 * two artwork variants it needs.
 *
 * legacy: index.php carried the slots as literal markup, annotated
 * `size : 750x150` and `size :750x300`. Each slot held two anchors and the
 * stylesheet swapped them under `@media (orientation:landscape)` — the first was
 * the narrow artwork and the second the wide one. They are named «موبایل» and
 * «دسکتاپ» here because that is the device an operator is preparing artwork
 * for; the media query underneath is unchanged.
 *
 * The desktop dimensions are new — the legacy installation shipped the same GIF
 * in both anchors, so no second size existed. **These sizes are enforced**: the
 * server rejects an upload whose dimensions differ (backend
 * config/constants.js AD_PLACEMENT_SIZES), and this file must stay in step with
 * it. `aspect` mirrors each variant's shape in the form's preview box.
 *
 * `where` describes the final position on the passenger page, which the label
 * alone does not pin down closely enough to be useful.
 */
export const AD_PLACEMENTS = Object.freeze([
  {
    value: 'top',
    label: 'بالای صفحه',
    where: 'بلافاصله زیر نوار بالای صفحه، پیش از هر محتوای دیگری.',
    variants: Object.freeze({
      mobile: { width: 750, height: 150, aspect: '5 / 1' },
      desktop: { width: 1500, height: 150, aspect: '10 / 1' },
    }),
  },
  {
    value: 'bottom',
    label: 'پایین صفحه',
    where: 'پس از پایان محتوا و درست بالای فوتر.',
    variants: Object.freeze({
      mobile: { width: 750, height: 300, aspect: '5 / 2' },
      desktop: { width: 1500, height: 300, aspect: '5 / 1' },
    }),
  },
]);

/** Persian labels for the two artwork variants, used wherever one is named. */
export const AD_VARIANT_LABELS = Object.freeze({ mobile: 'موبایل', desktop: 'دسکتاپ' });

/* ------------------------------------------------------- clips vs films --- */

/**
 * The video standard each kind of catalog title must meet. Mirrors the backend's
 * config/constants.js — the server refuses anything outside these bounds, and
 * this copy exists so the panel can say why before uploading.
 *
 *   clip — portrait (taller than wide) AND shorter than 3 minutes
 *   film — either orientation, longer than 5 minutes
 *
 * The gap between them is deliberate: a four-minute video is neither, and the
 * operator is told so rather than having it silently accepted as one.
 */
export const CLIP_MAX_DURATION_SECONDS = 3 * 60;
export const MOVIE_MIN_DURATION_SECONDS = 5 * 60;

/**
 * A category holds CLIPS when its name contains one of these words, in either
 * language. Hardcoded rather than a column, at the maintainer's request —
 * existing categories are already named this way.
 *
 * The rule is one-directional: a clip category refuses films, an ordinary
 * category takes both. Enforced by the API; repeated here so the panel can grey
 * out an impossible action instead of letting it fail.
 */
export const CLIP_CATEGORY_KEYWORDS = Object.freeze(['کلیپ', 'clip']);

/** @param {{nameFa?: string, nameEn?: string}} category */
export const isClipCategory = (category) => {
  const haystack = `${category?.nameFa ?? ''} ${category?.nameEn ?? ''}`.toLowerCase();
  return CLIP_CATEGORY_KEYWORDS.some((word) => haystack.includes(word.toLowerCase()));
};

export const placementLabel = (value) =>
  AD_PLACEMENTS.find((placement) => placement.value === value)?.label ?? String(value ?? '');

/** legacy: ads_history_tbl.event_type */
export const AD_EVENT_TYPES = Object.freeze([
  { value: 'completed', label: 'تماشای کامل' },
  { value: 'skipped', label: 'رد شده' },
]);

/**
 * The poll's fixed answer scale. legacy: poll.php, where the four options were
 * hardcoded in the HTML. Votes are stored as these integers.
 */
export const POLL_ANSWERS = Object.freeze([
  { value: 4, label: 'عالی' },
  { value: 3, label: 'خوب' },
  { value: 2, label: 'متوسط' },
  { value: 1, label: 'ضعیف' },
]);

/**
 * `default_origin` on a movie: 0 means the publish year was entered in the
 * Jalali calendar and the server converts it before storage.
 * legacy: admin/3P1z05m4n4Gm3nt/views/movies/update.php:58-61
 */
export const ORIGIN_JALALI = 0;
export const ORIGIN_GREGORIAN = 1;

export const CALENDAR_ORIGINS = Object.freeze([
  { value: ORIGIN_JALALI, label: 'شمسی' },
  { value: ORIGIN_GREGORIAN, label: 'میلادی' },
]);

/**
 * The 17 permission sections. legacy: the `action_page` values in
 * access_permission_tbl, plus `ads`, `placeholders`, `branding` and `games`,
 * which are new — the legacy panel had no ad management, no uploadable fallback
 * images, no editable branding and no games to guard. This list IS the backend's
 * enum (config/constants.js PERMISSION_PAGES) and a group can hold no other key.
 *
 * KEEP IT COMPLETE. The group editor renders one row per entry, so a section
 * missing here could not be granted at all — and, worse, saving a group that
 * already held it would drop the grant.
 */
export const PERMISSION_PAGES = Object.freeze([
  { key: 'movies', label: 'فیلم ها' },
  { key: 'casts', label: 'شخصیت ها' },
  { key: 'musics', label: 'موسیقی ها' },
  { key: 'categories', label: 'دسته بندی ها' },
  { key: 'genres', label: 'ژانر ها' },
  { key: 'age-ranges', label: 'رده های سنی' },
  { key: 'banners', label: 'بنر ها' },
  { key: 'ads', label: 'تبلیغات' },
  { key: 'placeholders', label: 'تصاویر پیش‌فرض' },
  { key: 'branding', label: 'هویت بصری' },
  // Covers the games and their genre list together.
  { key: 'games', label: 'بازی ها' },
  // Installation-wide switches (today: MP4 or HLS for uploaded video).
  { key: 'settings', label: 'تنظیمات' },
  { key: 'blocks', label: 'بلوک های برگه' },
  { key: 'pages', label: 'برگه ها' },
  { key: 'users', label: 'کاربران' },
  { key: 'groups', label: 'گروه های دسترسی' },
  { key: 'user-logs', label: 'گزارش فعالیت ها' },
  { key: 'watch-history', label: 'سوابق تماشا' },
]);

export const PERMISSION_ACTIONS = Object.freeze([
  { key: 'view', label: 'مشاهده' },
  { key: 'edit', label: 'ویرایش' },
  { key: 'delete', label: 'حذف' },
]);

/**
 * Rows per page. The API's default and its maximum are both 100
 * (`PER_PAGE_PAGINATION` = `MAXIMUM_PAGINATION`), so 100 is the ceiling: a
 * larger value is silently clamped, not honoured.
 */
export const PAGE_SIZE = 25;
export const PAGE_SIZE_OPTIONS = Object.freeze([10, 25, 50, 100]);
export const MAX_PAGE_SIZE = 100;

/** Poster aspect, matching the 216×332 thumbnail the backend generates. */
export const POSTER_ASPECT = '216 / 332';

/** Upload ceiling, mirroring the backend's MAX_UPLOAD_SIZE_MB default. */
export const MAX_IMAGE_MB = 10;

/**
 * Video ceiling, mirroring the backend's MAX_VIDEO_UPLOAD_SIZE_MB default.
 * Video gets its own, far larger cap than artwork — the image limit would
 * reject every real file, and a feature film is the largest thing the
 * application accepts.
 *
 * A deployment can lower this in the backend's environment without touching
 * the panel; the only cost is that the rejection then comes from the server
 * instead of from here.
 */
export const MAX_VIDEO_MB = 2048;

/** The backend accepts at most 30 audio files in one track upload. */
export const MAX_TRACK_FILES = 30;

/* ------------------------------------------------------------------ games --- */

/**
 * ZIP ceiling for one HTML5 game, mirroring the backend's
 * MAX_GAME_UPLOAD_SIZE_MB default. As with video, a deployment can change it
 * server-side; the only cost is that the refusal then comes from the server.
 */
export const MAX_GAME_ZIP_MB = 100;

/**
 * What a game's folder name may contain. The backend's GAME_FOLDER_NAME_PATTERN,
 * to the character — the name becomes part of the game's address, so it is held
 * to what needs no escaping in a URL.
 */
export const GAME_FOLDER_NAME_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

/** What a blank field is stored as — the backend's GAME_DEFAULTS, and Playva's. */
export const GAME_DEFAULTS = Object.freeze({
  emoji: '🎮',
  color1: '#000000',
  color2: '#222222',
});

/**
 * One-tap emoji for a game card. A convenience only: the field takes any emoji,
 * typed or pasted, and the operating system's own picker (Win + . on Windows,
 * Ctrl + Cmd + Space on a Mac) reaches all of them.
 *
 * A list in this file instead of the emoji-picker component Playva's panel uses,
 * because that component loads its artwork from a CDN, and this panel depends
 * on no third-party host.
 */
export const GAME_EMOJI_SUGGESTIONS = Object.freeze([
  '🎮', '🕹️', '🎯', '🧩', '🎲', '♟️', '🃏', '🏆',
  '⚽', '🏀', '🏎️', '🚀', '🐍', '🐦', '🧱', '💎',
  '⚔️', '🔫', '👾', '🤖', '🧟', '🐉', '🍬', '🎈',
]);
