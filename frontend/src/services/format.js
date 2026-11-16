/**
 * Display formatting.
 *
 * Purpose: render numbers, durations and text the way a Persian reader expects.
 * Inputs:  numbers, strings
 * Outputs: display strings
 * Deps:    none
 *
 * Digits are Persian throughout, matching the legacy site and the bundled Vazir
 * `-FD` font. `Intl` handles the digit substitution, so no lookup table is
 * maintained here.
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

/** A bare year, unformatted (no thousands separator). */
export function formatYear(year) {
  if (!year) return '';
  return String(year).replace(/\d/g, (digit) => '۰۱۲۳۴۵۶۷۸۹'[digit]);
}

/**
 * IMDb rank as one decimal place, e.g. 7.5 -> «۷٫۵».
 * Ranks of 0 mean "unrated" in this data and render as empty.
 */
export function formatRank(rank) {
  const numeric = Number(rank);
  if (!Number.isFinite(numeric) || numeric <= 0) return '';
  return new Intl.NumberFormat('fa-IR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(numeric);
}

/**
 * Runtime in minutes as hours and minutes: 95 -> «۱ ساعت و ۳۵ دقیقه».
 * @param {number} minutes
 */
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
 * Seconds as a player timecode, e.g. 3725 -> «1:02:05».
 * Latin digits deliberately: this sits in the monospaced player chrome, where
 * a fixed character width matters more than script consistency.
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
 * The legacy detail page replaced \r\n with <br> before echoing a description.
 * Splitting into paragraphs keeps that intent without injecting markup.
 * @returns {string[]}
 */
export function toParagraphs(text) {
  if (!text) return [];
  return String(text)
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export default {
  toPersianNumber,
  formatYear,
  formatRank,
  formatRuntime,
  formatTimecode,
  toParagraphs,
};
