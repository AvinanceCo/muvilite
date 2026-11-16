/**
 * Domain constants carried over verbatim from the legacy PHP application.
 *
 * Purpose: single source of truth for the magic numbers the legacy business
 *          rules depend on. Changing any value here changes behaviour, so each
 *          one cites the PHP file it came from.
 * Inputs:  none
 * Outputs: frozen constant maps
 * Deps:    none
 *
 * Sources: legacy-php/api/system/define.php, legacy-php/admin/includes/define.php
 */

/** Cast roles. legacy: api/system/define.php CASTS_ROLE_FA / CASTS_ROLE_EN */
export const CAST_ROLES = Object.freeze([
  { value: 0, fa: 'بازیگر', en: 'Actor' },
  { value: 1, fa: 'کارگردان', en: 'Director' },
  { value: 2, fa: 'تهیه کننده', en: 'Producer' },
  { value: 3, fa: 'نویسنده', en: 'Writer' },
  { value: 4, fa: 'صدا پیشه', en: 'Speaker' },
  { value: 5, fa: 'تدوین‌گر', en: 'Editor' },
  { value: 6, fa: 'آهنگ‌ساز', en: 'Composer' },
]);

export const CAST_ROLE_VALUES = Object.freeze(CAST_ROLES.map((role) => role.value));

/** legacy: api/system/define.php LANGUAGE_LIST */
export const LANGUAGES = Object.freeze([
  { value: 0, fa: 'انگلیسی', en: 'English', code: 'en' },
  { value: 1, fa: 'فارسی', en: 'Persian', code: 'fa' },
  { value: 2, fa: 'عربی', en: 'Arabic', code: 'ar' },
  { value: 3, fa: 'ترکی', en: 'Turkish' },
  { value: 4, fa: 'فرانسوی', en: 'French' },
  { value: 5, fa: 'آلمانی', en: 'German' },
  { value: 6, fa: 'هندی', en: 'Hindi' },
  { value: 7, fa: 'چینی', en: 'Chinese' },
  { value: 8, fa: 'کره ای', en: 'Korean' },
  { value: 9, fa: 'سایر', en: 'Other' },
]);

/** legacy: api/system/define.php VIDEO_QUALITIES_LIST */
export const VIDEO_QUALITIES = Object.freeze([
  { value: 0, label: '720p' },
  { value: 1, label: '1080p' },
  { value: 2, label: '4K' },
  { value: 3, label: '5K' },
  { value: 4, label: '8K' },
  { value: 5, label: 'VR' },
  { value: 6, label: '3D' },
]);

/** legacy: admin/includes/define.php DEVICE_PLATFORMS */
export const DEVICE_PLATFORMS = Object.freeze({
  WEB: 0,
  ANDROID: 1,
  IOS: 2,
  ANDROID_TV: 3,
  WEB_TV: 4,
});

export const DEVICE_PLATFORM_VALUES = Object.freeze(Object.values(DEVICE_PLATFORMS));

/**
 * Maps a platform value to the WatchTrendDaily counter it increments.
 * legacy: admin/3P1z05m4n4Gm3nt/includes/crons/watch_history_daily.php
 */
export const PLATFORM_COUNTER_FIELD = Object.freeze({
  [DEVICE_PLATFORMS.WEB]: 'platformCountWeb',
  [DEVICE_PLATFORMS.ANDROID]: 'platformCountAndroid',
  [DEVICE_PLATFORMS.IOS]: 'platformCountIos',
  [DEVICE_PLATFORMS.ANDROID_TV]: 'platformCountAndroidTv',
  [DEVICE_PLATFORMS.WEB_TV]: 'platformCountWebTv',
});

/** legacy: admin/includes/define.php USER_LOG_ACTIONS */
export const USER_LOG_ACTIONS = Object.freeze({
  CREATE: 0,
  UPDATE: 1,
  DELETE: 2,
});

/**
 * Playback heartbeat intervals, in seconds.
 * legacy: api/system/define.php WATCH_CHUNK_TIME / LISTEN_CHUNK_TIME.
 * Each heartbeat adds exactly this many seconds to the session total.
 */
export const WATCH_CHUNK_SECONDS = 30;
export const LISTEN_CHUNK_SECONDS = 15;

/**
 * Pagination. legacy: api/system/define.php — PER_PAGE_PAGINATION and
 * MAXIMUM_PAGINATION are both 100, so the default page size equals the cap.
 */
export const DEFAULT_PAGE_SIZE = 100;
export const MAX_PAGE_SIZE = 100;

/**
 * Items per home-page rail. legacy: MAX_ROW_PER_FETCH — page blocks are hard
 * capped at 10 items with no pagination (api/v2/models/PageBlock.php).
 */
export const RAIL_ITEM_LIMIT = 10;

/** Similar-movies count. legacy: api/v2/index.php::similar() LIMIT 0,4 */
export const SIMILAR_MOVIE_LIMIT = 4;

/**
 * Poll re-vote window. legacy: api/v2/index.php::poll() —
 * `created_date BETWEEN DATE_SUB(now(), INTERVAL 3 HOUR) AND now()`.
 * Inside this window a repeat submission updates the existing votes.
 */
export const POLL_REVOTE_WINDOW_HOURS = 3;

/** Page block types. legacy: api/v2/index.php::page() switch on item_type */
export const BLOCK_ITEM_TYPES = Object.freeze(['banner', 'category', 'music']);

/**
 * Fixed advertisement slots on the landing page.
 * legacy: index.php had exactly two hardcoded `<div class="ads">` blocks — one
 * above the tile list annotated `size : 750x150`, one below it annotated
 * `size :750x300`. Those are the only two slots that ever existed.
 */
export const AD_PLACEMENTS = Object.freeze(['top', 'bottom']);

/**
 * The two artwork variants of a landing-page ad.
 *
 * legacy: each `<div class="ads">` held two anchors and the stylesheet chose
 * between them with `@media (orientation:landscape)` — the first anchor was the
 * narrow artwork (phones, held upright) and the second the wide one (laptops
 * and cabin screens). The panel now names them by the device instead of by the
 * media query, because that is what an operator preparing artwork is thinking
 * about.
 */
export const AD_VARIANTS = Object.freeze(['mobile', 'desktop']);

/**
 * REQUIRED pixel dimensions per slot and variant. An upload whose dimensions
 * differ is rejected outright (services/admin/attachment.service.js).
 *
 * The mobile figures are the legacy HTML comments verbatim — `size : 750x150`
 * above the tile list and `size :750x300` below it. The desktop figures are new:
 * the legacy installation shipped the same GIF in both anchors, so no second
 * size ever existed. They are double the width at the same height, which is the
 * wider shape a landscape viewport wants, and 1500px covers the widest the slot
 * is ever painted (the tile column is capped at 70rem).
 *
 * Enforcing them is a deliberate departure from the legacy CSS, which stretched
 * whatever was uploaded (`.ads>a>img{width:100%}`) and so silently accepted
 * artwork that came out blurry or the wrong height.
 */
export const AD_PLACEMENT_SIZES = Object.freeze({
  top: Object.freeze({
    mobile: Object.freeze({ width: 750, height: 150 }),
    desktop: Object.freeze({ width: 1500, height: 150 }),
  }),
  bottom: Object.freeze({
    mobile: Object.freeze({ width: 750, height: 300 }),
    desktop: Object.freeze({ width: 1500, height: 300 }),
  }),
});

/**
 * Seconds before a pre-roll may be skipped.
 * legacy: every assets/ads/vast*.xml carried `skipoffset="00:00:03"`.
 */
export const AD_SKIP_OFFSET_SECONDS = 3;

/**
 * REQUIRED banner artwork dimensions, per banner-category type.
 *
 * legacy: `_layout/PageLayout.php::displayBanners` sized each rail by the
 * category's `type`, and the holder image shipped for each one names the exact
 * figures — `posterHolder1920x360.jpg` for 'long' and `posterHolder517x282.jpg`
 * for 'item'. So these are the legacy dimensions, not new ones.
 *
 * A banner belongs to any number of categories and carries no type of its own,
 * so an upload is accepted when it matches ANY of these — which is also what the
 * panel states under the uploader. Narrowing it to the types of the categories a
 * banner happens to be in at upload time was considered and rejected: a banner
 * is routinely uploaded before it is filed, and the rule would then change under
 * the operator as they added it to a rail.
 *
 * 'full' (1920x720) is commented out rather than deleted — the full-width banner
 * is retired. See models/BannerCategory.js.
 */
export const BANNER_IMAGE_SIZES = Object.freeze({
  // full: { width: 1920, height: 720 },  // retired with the full-width banner
  long: Object.freeze({ width: 1920, height: 360 }),
  item: Object.freeze({ width: 517, height: 282 }),
});

/** The same set as a list, which is how every accepted-size check reads it. */
export const BANNER_ACCEPTED_SIZES = Object.freeze(Object.values(BANNER_IMAGE_SIZES));

/* ------------------------------------------------------- clips vs films --- */

/**
 * The two kinds of catalog video. NOT a legacy concept — `movies_tbl` had no
 * such column and the legacy site had one shape of title. `Movie.isClip` splits
 * the collection, chosen over a second collection because a clip carries the
 * same title, genre, description, tags, categories, poster and video as a film
 * and appears in the same rails; only the metadata it does *not* use differs.
 *
 * Each kind accepts a different video, and the rules are deliberately strict —
 * "حتما عمودی زیر ۳ دقیقه" for a clip:
 *
 *   clip  — PORTRAIT (taller than wide) and shorter than 3 minutes
 *   film  — either orientation, longer than 5 minutes
 *
 * **The 3-to-5-minute gap is intentional** (confirmed with the maintainer): a
 * four-minute video is neither, and is refused with a message that says so.
 * Both bounds are exclusive, exactly as stated.
 */
export const CLIP_MAX_DURATION_SECONDS = 3 * 60;
export const MOVIE_MIN_DURATION_SECONDS = 5 * 60;

/* ------------------------------------------------------------ HLS video --- */

/**
 * Where a catalog title's uploaded video is on its way to being playable.
 *
 * NEW (beyond parity, requested by the maintainer): an uploaded film or clip is
 * transcoded to HLS before the passenger player sees it. The status describes
 * the LATEST upload's job, not what is playing: while a replacement is being
 * transcoded, the previous `videoPath` keeps playing until the new one is ready.
 *
 *   none        no upload in flight (also every record from before this feature)
 *   queued      uploaded, waiting for the transcoder
 *   processing  ffmpeg is running; `videoProgress` is its percentage
 *   ready       the HLS output is in `videoPath`
 *   failed      ffmpeg gave up; the original is kept so the job can be retried
 */
export const VIDEO_STATUS = Object.freeze({
  NONE: 'none',
  QUEUED: 'queued',
  PROCESSING: 'processing',
  READY: 'ready',
  FAILED: 'failed',
});
export const VIDEO_STATUS_VALUES = Object.freeze(Object.values(VIDEO_STATUS));

/**
 * The adaptive ladder. A rung is produced only when the source's SHORT side is
 * at least `size`, so nothing is ever upscaled; a source smaller than the lowest
 * rung gets one rendition at its own size, at the lowest rung's bitrate.
 *
 * `size` is the short side, not the height, so a portrait clip (1080x1920) gets
 * the same "1080p" rung a landscape film does rather than being labelled by its
 * long edge.
 *
 * Bitrates are the conventional H.264 figures for each size at 30 fps; `maxrate`
 * and `bufsize` cap the peaks so a crowded cabin Wi-Fi sees a steady stream.
 */
export const HLS_LADDER = Object.freeze([
  Object.freeze({ name: '360p', size: 360, videoKbps: 800, maxKbps: 856, bufKbps: 1200 }),
  Object.freeze({ name: '480p', size: 480, videoKbps: 1400, maxKbps: 1498, bufKbps: 2100 }),
  Object.freeze({ name: '720p', size: 720, videoKbps: 2800, maxKbps: 2996, bufKbps: 4200 }),
  Object.freeze({ name: '1080p', size: 1080, videoKbps: 5000, maxKbps: 5350, bufKbps: 7500 }),
]);

/** Audio bitrate for every rung: stereo AAC. */
export const HLS_AUDIO_KBPS = 128;

/**
 * Segment length. Six seconds is Apple's recommendation and keeps a seek within
 * a few seconds of where the passenger tapped.
 */
export const HLS_SEGMENT_SECONDS = 6;

/** Name of the master playlist inside each title's HLS directory. */
export const HLS_MASTER_PLAYLIST = 'master.m3u8';

/**
 * Containers an operator may upload for a film or clip. Everything is
 * re-encoded, so the container only has to be one ffmpeg can read — ffprobe
 * decides whether the file really is a video, not this list. Pre-roll ads are
 * NOT transcoded and keep their own, narrower MP4/WebM list (middleware/upload.js).
 */
export const SOURCE_VIDEO_EXTENSIONS = Object.freeze([
  '.mp4', '.m4v', '.mov', '.mkv', '.webm', '.avi', '.wmv', '.flv',
  '.mpg', '.mpeg', '.ts', '.mts', '.m2ts', '.3gp', '.ogv',
]);

/**
 * A category is a CLIP category when its name contains one of these words, in
 * either language field. Hardcoded at the maintainer's request rather than
 * carried on a column: existing categories are already named this way, and a
 * flag would have to be set by hand on every one of them.
 *
 * Matching is case-insensitive and substring-based, so «کلیپ های ورزشی» and
 * "Sport Clips" both qualify.
 */
export const CLIP_CATEGORY_KEYWORDS = Object.freeze(['کلیپ', 'clip']);

/**
 * @param {{nameFa?: string, nameEn?: string}} category
 * @returns {boolean} true when the category is meant to hold clips
 */
export const isClipCategory = (category) => {
  const haystack = `${category?.nameFa ?? ''} ${category?.nameEn ?? ''}`.toLowerCase();
  return CLIP_CATEGORY_KEYWORDS.some((word) => haystack.includes(word.toLowerCase()));
};

/**
 * `default_origin` on a movie: 0 means dates are entered in the Jalali
 * calendar and must be converted before storage.
 * legacy: admin/3P1z05m4n4Gm3nt/views/movies/update.php:58-61
 */
export const ORIGIN_JALALI = 0;

/**
 * Fallback artwork slots — the image a client shows for a record that has none.
 *
 * NEW FUNCTIONALITY, but not a new idea: the legacy application had fallbacks,
 * as FILES shipped with the theme and named in the markup —
 *   src/images/posterHolder216x332.jpg  movie posters (_layout/PageLayout.php:97,
 *                                       search.php:57; category.php:34 used the
 *                                       216x331 file for the same grid)
 *   src/images/posterHolder200x200.jpg  music covers (music.php:46)
 *   src/images/posterHolder1920x720.jpg the `full` banner style
 *   src/images/posterHolder1920x360.jpg the `long` banner style
 *   src/images/posterHolder517x282.jpg  the `item` banner style
 *                                       (_layout/PageLayout.php:7-9)
 *   assets/avatarHolder.jpg             cast photos (includes/get-images.php:128)
 * Changing any of them meant an FTP upload; no screen in the panel touched them.
 * These slots put the same decisions in the database, where an operator can
 * change them.
 *
 * Two of those were also broken. The `<img src>` fallbacks were lazy-load
 * PLACEHOLDERS: the real image was swapped in by `data-src` on scroll and, since
 * that URL was derived from the row id, a record with no uploaded file swapped
 * the holder out for a 404. And `get-images.php` — the one true server-side
 * fallback — is dead code: `die('file not found:'.$path)` sits one line above
 * it, so a missing file answers with that text rather than the holder image.
 *
 * The dimensions below come from those filenames and are ADVISORY: nothing
 * resizes an upload, exactly as nothing resized the shipped files. They tell the
 * operator what shape the client will draw the image into.
 *
 * A slot key is part of the API (`GET /api/placeholders`, the admin upload
 * route) — renaming one orphans whatever was uploaded against the old key.
 */
export const PLACEHOLDER_SLOTS = Object.freeze([
  {
    key: 'moviePoster',
    fa: 'پوستر فیلم',
    en: 'Movie poster',
    width: 216,
    height: 332,
    /** Where the client draws it, for the admin screen's description. */
    usageFa: 'کارت فیلم‌ها، نتایج جستجو و صفحهٔ فیلم',
  },
  {
    key: 'musicCover',
    fa: 'کاور موسیقی',
    en: 'Music cover',
    width: 200,
    height: 200,
    usageFa: 'کارت موسیقی‌ها، دسته‌بندی موسیقی و صفحهٔ آلبوم',
  },
  {
    key: 'banner',
    fa: 'بنر',
    en: 'Banner',
    width: 1920,
    height: 720,
    usageFa: 'اسلایدهای بنر در برگه‌ها',
  },
  {
    key: 'castPhoto',
    fa: 'تصویر شخصیت',
    en: 'Cast photo',
    width: 300,
    height: 300,
    usageFa: 'عوامل در صفحهٔ فیلم',
  },
  {
    key: 'general',
    fa: 'سایر تصاویر',
    en: 'Other images',
    width: 800,
    height: 450,
    // The chain is slot -> general -> the image bundled with the frontend, so
    // this one alone covers every type at once.
    usageFa: 'هر تصویری که جانشین اختصاصی ندارد',
  },
]);

export const PLACEHOLDER_SLOT_KEYS = Object.freeze(PLACEHOLDER_SLOTS.map((slot) => slot.key));

/** The slot consulted when a specific one has no image. */
export const PLACEHOLDER_FALLBACK_SLOT = 'general';

/**
 * Branding — the operator-owned parts of the passenger site's chrome and hero.
 *
 * NEW FUNCTIONALITY, and the same story as the placeholder slots above: these
 * were literals, not data. The customer logo in the footer was a theme file
 * (`_layout/footer.php` drew the airline's mark straight from `src/images/`),
 * and the landing-page heading and its sentence beneath were hardcoded Persian
 * in `index.php`. Changing either meant editing a file on the server.
 *
 * ONE SINGLETON DOCUMENT holds all of it (models/Branding.js), because that is
 * what it is: an installation has one footer logo and one landing page, not a
 * list of them.
 *
 * BLANK MEANS DEFAULT. A text field the operator leaves empty is not published
 * as an empty heading — `getPublicBranding()` substitutes the value below, so
 * clearing a field is how an operator restores the shipped copy. The frontend
 * carries the same two strings for its FIRST PAINT only (its
 * `context/BrandingContext.jsx`); nothing renders empty while the request is in
 * flight. Keep the two copies in step — they are the same sentences.
 */
export const BRANDING_TEXT_FIELDS = Object.freeze([
  {
    // Added 2026-11-15 at the maintainer's request. The product's own name is
    // the default; the operator's replaces it in the header wordmark, the side
    // menu and the browser tab. The header mark IMAGE does not change.
    key: 'siteName',
    fa: 'نام سایت',
    en: 'Site name',
    multiline: false,
    maxLength: 40,
    default: 'MuviLite',
    usageFa: 'در سربرگ سایت، منوی کناری و عنوان زبانهٔ مرورگر نمایش داده می‌شود',
  },
  {
    key: 'homeTitle',
    fa: 'عنوان صفحهٔ اصلی',
    en: 'Home heading',
    /** Renders as the <h1>. One line — a textarea here would invite three. */
    multiline: false,
    maxLength: 120,
    // `{siteName}` is replaced with the site's name (services/branding), so a
    // renamed site does not keep welcoming visitors to MuviLite.
    default: 'به {siteName} خوش آمدید',
    usageFa: 'تیتر بزرگ بالای صفحهٔ اصلی سایت اصلی',
  },
  {
    key: 'homeDescription',
    fa: 'توضیح صفحهٔ اصلی',
    en: 'Home description',
    multiline: true,
    maxLength: 400,
    default: 'فیلم ببینید، موسیقی بشنوید و بازی کنید. یکی از بخش‌های زیر را انتخاب کنید.',
    usageFa: 'یک تا دو جمله زیر تیتر، پیش از فهرست بخش‌ها',
  },
]);

export const BRANDING_TEXT_KEYS = Object.freeze(
  BRANDING_TEXT_FIELDS.map((field) => field.key),
);

/** `{ homeTitle: '…', homeDescription: '…' }` — what a blank field publishes. */
export const BRANDING_DEFAULTS = Object.freeze(
  Object.fromEntries(BRANDING_TEXT_FIELDS.map((field) => [field.key, field.default])),
);

/**
 * The footer logo's shape, ADVISORY only.
 *
 * Deliberately NOT enforced the way ad and banner artwork is (AD_PLACEMENT_SIZES,
 * BANNER_ACCEPTED_SIZES). Those sizes exist because the creative sits in a fixed
 * frame the layout cannot adapt to; this one is a customer's own logo, whose
 * proportions are theirs and differ per customer. The footer scales it to a
 * fixed HEIGHT and lets the width follow, so any reasonable lockup fits.
 */
export const BRANDING_LOGO_SIZE = Object.freeze({ width: 480, height: 120 });

/**
 * The passenger site's colour themes — NEW FUNCTIONALITY, asked for by the
 * maintainer (2026-11-15): the operator picks one in the panel and the whole
 * public site follows. `dark-blue` is the original logo-derived palette and the
 * default, so an installation that never opens the picker looks as it always has.
 *
 * The real values live in the frontend (src/index.css, one `html[data-theme]`
 * block per key, plus src/utils/themes.js for the player). `swatches` here are
 * ONLY the admin's preview chips — the ground, a raised surface, the accent and
 * the body text — and must be kept in step with those blocks by hand.
 */
export const SITE_THEMES = Object.freeze([
  {
    key: 'dark-blue',
    fa: 'آبی تیره',
    en: 'Dark blue',
    swatches: { ground: '#050b12', surface: '#0c1826', accent: '#12b1f0', text: '#e4f8ff' },
  },
  {
    key: 'dark-red',
    fa: 'تیره و قرمز',
    en: 'Dark and red',
    swatches: { ground: '#0b0809', surface: '#171113', accent: '#ff4d55', text: '#fbeeee' },
  },
  {
    key: 'dark-pink',
    fa: 'آبی تیره و صورتی',
    en: 'Dark blue and pink',
    swatches: { ground: '#060818', surface: '#0e1430', accent: '#ff4fa3', text: '#eef0ff' },
  },
  {
    key: 'navy-orange',
    fa: 'سرمه‌ای و نارنجی',
    en: 'Navy and orange',
    swatches: { ground: '#07102a', surface: '#0f1a3d', accent: '#ff8a1f', text: '#eef3ff' },
  },
]);

export const SITE_THEME_KEYS = Object.freeze(SITE_THEMES.map((theme) => theme.key));

/** What an installation shows before anyone has picked a theme. */
export const DEFAULT_SITE_THEME = 'dark-blue';

/* ------------------------------------------------------------------ games --- */

/**
 * HTML5 games — NEW FUNCTIONALITY with no legacy ancestor at all. The legacy
 * portal offered films, music, clips and a poll; nothing in `legacy-php/` is a
 * game. The shape is taken from the maintainer's other product, Playva
 * (`playva-backend/models/Game.js` and `routes/games.js`), minus its leaderboard:
 * a game is a ZIP of static files uploaded through the panel, unpacked on the
 * server and played in an iframe.
 *
 * A folder name is the slug the bundle is unpacked under and therefore part of
 * the game's URL, so it is held to characters that are safe in a path on every
 * filesystem and need no escaping in a URL. Playva sanitised whatever it was
 * given (`[^a-zA-Z0-9_-]` -> `_`); here the same alphabet is REQUIRED instead, so
 * the name an operator typed is the name that is stored.
 */
export const GAME_FOLDER_NAME_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

/** The file a bundle must contain, at its root or one directory down. */
export const GAME_ENTRY_FILE = 'index.html';

/**
 * Ceilings on what a bundle may unpack to. The upload size itself is
 * `MAX_GAME_UPLOAD_SIZE_MB` (config/env.js); these bound the EXPANDED result,
 * which the upload size says nothing about — a few kilobytes of ZIP can declare
 * gigabytes of zeros. Both are checked against the archive's directory before a
 * single byte is written.
 *
 * Generous for a real game (HTML5 bundles are mostly already-compressed images
 * and audio, so they barely shrink in a ZIP) and far below what would fill the
 * disk the films live on.
 */
export const GAME_MAX_FILES = 5000;
export const GAME_MAX_UNPACKED_BYTES = 512 * 1024 * 1024;

/**
 * A game's card is drawn from these three fields, not from an image: an emoji on
 * a two-colour gradient, exactly as Playva draws it. The defaults are Playva's.
 */
export const GAME_DEFAULTS = Object.freeze({
  emoji: '🎮',
  color1: '#000000',
  color2: '#222222',
});

/** `#rgb` or `#rrggbb` — what an `<input type="color">` and a designer both write. */
export const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/**
 * Permission page identifiers. legacy: the `action_page` values in
 * access_permission_tbl, as checked across admin/3P1z05m4n4Gm3nt/views/**.
 */
export const PERMISSION_PAGES = Object.freeze([
  'movies',
  'casts',
  'musics',
  'categories',
  'genres',
  'age-ranges',
  'banners',
  // New section: the legacy panel had no ad management at all — pre-roll
  // creatives were hand-written XML on disk and the landing-page slots were
  // hardcoded markup. Existing installations must re-run `npm run seed` (or add
  // the row by hand) before any group can reach it.
  'ads',
  // New section, same story as 'ads': the legacy fallback images were theme
  // files on disk, so no permission ever guarded them. Existing installations
  // must re-run `npm run seed` (or add the row by hand) before any group can
  // reach it.
  'placeholders',
  // New section, same story as 'ads' and 'placeholders': the footer logo and the
  // landing-page copy were literals in the theme, so no permission ever guarded
  // them. Existing installations must re-run `npm run seed` (or add the row by
  // hand) before any group can reach it.
  'branding',
  // New section, same story again: the legacy application had no games, so no
  // permission guarded them. Covers the games AND their genre list — one grant
  // gives a games operator everything the section needs. Existing installations
  // must re-run `npm run seed` (or add the row by hand) before any group can
  // reach it.
  'games',
  // New section: installation-wide switches — today, whether uploaded video
  // is transcoded to HLS or kept as MP4. The legacy panel had no settings
  // screen. Existing installations must re-run `npm run seed` (or add the row
  // by hand) before any group can reach it.
  'settings',
  'blocks',
  'pages',
  'users',
  'groups',
  'user-logs',
  'watch-history',
]);

/** legacy: access_permission_tbl action_view / action_edit / action_delete */
export const PERMISSION_ACTIONS = Object.freeze(['view', 'edit', 'delete']);

export default {
  CAST_ROLES,
  CAST_ROLE_VALUES,
  LANGUAGES,
  VIDEO_QUALITIES,
  DEVICE_PLATFORMS,
  DEVICE_PLATFORM_VALUES,
  PLATFORM_COUNTER_FIELD,
  USER_LOG_ACTIONS,
  WATCH_CHUNK_SECONDS,
  LISTEN_CHUNK_SECONDS,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  RAIL_ITEM_LIMIT,
  SIMILAR_MOVIE_LIMIT,
  POLL_REVOTE_WINDOW_HOURS,
  BLOCK_ITEM_TYPES,
  AD_PLACEMENTS,
  AD_VARIANTS,
  AD_PLACEMENT_SIZES,
  AD_SKIP_OFFSET_SECONDS,
  BANNER_IMAGE_SIZES,
  BANNER_ACCEPTED_SIZES,
  CLIP_MAX_DURATION_SECONDS,
  MOVIE_MIN_DURATION_SECONDS,
  VIDEO_STATUS,
  VIDEO_STATUS_VALUES,
  HLS_LADDER,
  HLS_AUDIO_KBPS,
  HLS_SEGMENT_SECONDS,
  HLS_MASTER_PLAYLIST,
  SOURCE_VIDEO_EXTENSIONS,
  CLIP_CATEGORY_KEYWORDS,
  isClipCategory,
  ORIGIN_JALALI,
  PLACEHOLDER_SLOTS,
  PLACEHOLDER_SLOT_KEYS,
  PLACEHOLDER_FALLBACK_SLOT,
  BRANDING_TEXT_FIELDS,
  BRANDING_TEXT_KEYS,
  BRANDING_DEFAULTS,
  BRANDING_LOGO_SIZE,
  GAME_FOLDER_NAME_PATTERN,
  GAME_ENTRY_FILE,
  GAME_MAX_FILES,
  GAME_MAX_UNPACKED_BYTES,
  GAME_DEFAULTS,
  HEX_COLOR_PATTERN,
  PERMISSION_PAGES,
  PERMISSION_ACTIONS,
};
