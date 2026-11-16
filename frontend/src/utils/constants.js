/**
 * Domain constants.
 *
 * Purpose: values the UI needs that the API does not serve, each one traceable
 *          to the backend or the legacy source it came from.
 * Inputs:  none
 * Outputs: frozen constants
 * Deps:    none
 *
 * Nothing here is invented. If a value has a server-side counterpart, the
 * comment names the file so the two can be kept in step.
 */

/**
 * The poll answer scale.
 *
 * Fixed by the legacy markup (`poll.php`, four radios per question, values
 * 4..1) and mirrored server-side in backend/src/models/Poll.js POLL_ANSWERS,
 * which validates submissions against exactly these values. `GET
 * /api/poll/questions` returns questions only, so the scale lives here.
 */
export const POLL_ANSWERS = Object.freeze([
  { value: 4, label: 'عالی' },
  { value: 3, label: 'خوب' },
  { value: 2, label: 'متوسط' },
  { value: 1, label: 'ضعیف' },
]);

/** localStorage key for the anonymous poll token. Legacy used the same key. */
export const POLL_TOKEN_KEY = 'token';

/**
 * Sort options per endpoint.
 *
 * These whitelists genuinely differ and are enforced server-side — offering a
 * key the endpoint does not accept produces a 400, not a fallback. See
 * backend/src/services/movie.service.js (CATEGORY_SORTS, SEARCH_SORTS) and
 * music.service.js (MUSIC_CATEGORY_SORTS).
 */
export const CATEGORY_SORT_OPTIONS = Object.freeze([
  { value: 'created_date', label: 'تازه‌ترین' },
  { value: 'imdb_rank', label: 'امتیاز IMDb' },
  { value: 'visit_count', label: 'پربازدیدترین' },
  { value: 'publish_date', label: 'سال انتشار' },
  { value: 'modified_date', label: 'آخرین بروزرسانی' },
]);

/** Search accepts a narrower set: no modified_date, and it defaults to `id`. */
export const SEARCH_SORT_OPTIONS = Object.freeze([
  { value: 'id', label: 'تازه‌ترین' },
  { value: 'imdb_rank', label: 'امتیاز IMDb' },
  { value: 'visit_count', label: 'پربازدیدترین' },
  { value: 'publish_date', label: 'سال انتشار' },
  { value: 'created_date', label: 'تاریخ افزودن' },
]);

/** Music categories accept only three keys, and default to `id`. */
export const MUSIC_CATEGORY_SORT_OPTIONS = Object.freeze([
  { value: 'id', label: 'تازه‌ترین' },
  { value: 'visit_count', label: 'پرشنیده‌ترین' },
  { value: 'publish_date', label: 'سال انتشار' },
]);

/**
 * Page size for listing pages.
 *
 * The API defaults to 100 and caps at 100 (backend config/constants.js). A
 * smaller page is requested so a passenger on a phone is not handed a hundred
 * posters at once; the cap still applies above this.
 */
export const PAGE_SIZE = 24;

/**
 * Rails are hard-capped at 10 items with no pagination
 * (backend RAIL_ITEM_LIMIT). Used only to size skeletons.
 */
export const RAIL_ITEM_LIMIT = 10;

/** Similar movies: always exactly 4 (backend SIMILAR_MOVIE_LIMIT). */
export const SIMILAR_MOVIE_LIMIT = 4;

/**
 * Device platform reported when opening a watch session.
 * backend config/constants.js DEVICE_PLATFORMS.WEB
 */
export const PLATFORM_WEB = 0;

/** Poster aspect, from the legacy 216x332 thumbnail the backend still generates. */
export const POSTER_ASPECT = '216 / 332';

/**
 * Opens at which a game's card is marked «پرطرفدار».
 *
 * Playva's figure (`playva-front/components/GameCard.js`, `clicks >= 50`). It is
 * a display threshold only — the "popular" LISTING is the server's, and includes
 * any game opened at least once.
 */
export const GAME_POPULAR_CLICKS = 50;

/**
 * How many matching games the film search shows before sending the passenger to
 * the games page for the rest. One rail's worth — the same cap a landing-page
 * rail has (RAIL_ITEM_LIMIT), for the same reason.
 */
export const SEARCH_GAME_LIMIT = 10;

export default {
  POLL_ANSWERS,
  POLL_TOKEN_KEY,
  CATEGORY_SORT_OPTIONS,
  SEARCH_SORT_OPTIONS,
  MUSIC_CATEGORY_SORT_OPTIONS,
  PAGE_SIZE,
  RAIL_ITEM_LIMIT,
  SIMILAR_MOVIE_LIMIT,
  PLATFORM_WEB,
  POSTER_ASPECT,
  GAME_POPULAR_CLICKS,
  SEARCH_GAME_LIMIT,
};
