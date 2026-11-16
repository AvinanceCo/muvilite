/**
 * Display formatting.
 *
 * Purpose: render numbers, dates and durations the way a Persian reader
 *          expects, and shorten the identifiers a data grid has to show.
 * Inputs:  numbers, strings, dates
 * Outputs: display strings
 * Deps:    none
 *
 * Digits are Persian throughout, matching the legacy panel and the bundled
 * Vazir `-FD` font. `Intl` handles both the digit substitution and the Jalali
 * calendar — `fa-IR` resolves to the Persian calendar natively, so no date
 * library is bundled. See services/jalali.js for the *year arithmetic* the
 * movie form needs, which Intl cannot do.
 */

const persianNumber = new Intl.NumberFormat('fa-IR');

/**
 * Formats a number with Persian digits and grouping.
 * @param {number|string|null|undefined} value
 * @returns {string} empty string when there is nothing to show
 */
export function toPersianNumber(value) {
  if (value === null || value === undefined || value === '') return '';
  const numeric = Number(value);
  return Number.isFinite(numeric) ? persianNumber.format(numeric) : '';
}

/** Persian digits with no thousands separator — years, ids, counts in a badge. */
export function toPersianDigits(value) {
  if (value === null || value === undefined || value === '') return '';
  return String(value).replace(/\d/g, (digit) => '۰۱۲۳۴۵۶۷۸۹'[digit]);
}

/** A bare year, unformatted. */
export const formatYear = toPersianDigits;

/** IMDb rank to one decimal. A rank of 0 means "unrated" and renders empty. */
export function formatRank(rank) {
  const numeric = Number(rank);
  if (!Number.isFinite(numeric) || numeric <= 0) return '';
  return new Intl.NumberFormat('fa-IR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(numeric);
}

/** Runtime in minutes as hours and minutes: 95 -> «۱ ساعت و ۳۵ دقیقه». */
export function formatRuntime(minutes) {
  const numeric = Number(minutes);
  if (!Number.isFinite(numeric) || numeric <= 0) return '';

  const hours = Math.floor(numeric / 60);
  const rest = numeric % 60;

  if (hours === 0) return `${toPersianNumber(rest)} دقیقه`;
  if (rest === 0) return `${toPersianNumber(hours)} ساعت`;
  return `${toPersianNumber(hours)} ساعت و ${toPersianNumber(rest)} دقیقه`;
}

/**
 * Seconds as a timecode, e.g. 3725 -> «1:02:05».
 * Latin digits deliberately: these sit in monospaced data columns where a fixed
 * character width matters more than script consistency.
 */
export function formatTimecode(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const pad = (value) => String(value).padStart(2, '0');

  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${minutes}:${pad(secs)}`;
}

/**
 * Watched/listened seconds as a compact human duration — the history grids show
 * these by the thousand, so «۲ ساعت» beats «2:03:41» for scanning.
 */
export function formatDuration(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  if (total === 0) return '۰ ثانیه';
  if (total < 60) return `${toPersianNumber(total)} ثانیه`;
  if (total < 3600) return `${toPersianNumber(Math.floor(total / 60))} دقیقه`;
  return formatRuntime(Math.floor(total / 60));
}

const jalaliDate = new Intl.DateTimeFormat('fa-IR', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const jalaliDateTime = new Intl.DateTimeFormat('fa-IR', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

/**
 * An ISO timestamp as a Jalali date — «۱۴۰۵/۰۵/۱۸».
 * The legacy panel ran every timestamp through `helper::date_en_to_fa`.
 * @param {string|Date|null|undefined} value
 */
export function formatDate(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : jalaliDate.format(date);
}

/** As formatDate, with the time — for activity logs and history rows. */
export function formatDateTime(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : jalaliDateTime.format(date);
}

/**
 * An ObjectId shortened for a grid cell: the last six characters, which is
 * where the entropy is. The full value belongs in a title attribute.
 */
export function shortId(id) {
  const text = String(id ?? '');
  return text.length > 6 ? text.slice(-6) : text;
}

/** Truncates for a table cell without cutting mid-word where avoidable. */
export function truncate(text, length = 60) {
  const value = String(text ?? '').trim();
  if (value.length <= length) return value;
  return `${value.slice(0, length).trimEnd()}…`;
}

/** Bytes as a human size — the track uploader reports these. */
export function formatBytes(bytes) {
  const numeric = Number(bytes);
  if (!Number.isFinite(numeric) || numeric <= 0) return '';
  if (numeric < 1024) return `${toPersianNumber(numeric)} بایت`;
  if (numeric < 1024 * 1024) return `${toPersianNumber(Math.round(numeric / 1024))} کیلوبایت`;
  return `${toPersianNumber((numeric / (1024 * 1024)).toFixed(1))} مگابایت`;
}

export default {
  toPersianNumber,
  toPersianDigits,
  formatYear,
  formatRank,
  formatRuntime,
  formatTimecode,
  formatDuration,
  formatDate,
  formatDateTime,
  shortId,
  truncate,
  formatBytes,
};
