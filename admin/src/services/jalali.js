/**
 * Jalali <-> Gregorian YEAR conversion.
 *
 * Purpose: let the movie and music forms show and accept a Persian publish year
 *          while the API stores a Gregorian one.
 * Inputs:  year numbers
 * Outputs: converted year numbers
 * Deps:    none
 *
 * `publishYear` is a BARE YEAR, not a date. The legacy helpers converted only
 * the year component, each anchored to a fixed day:
 *
 *   year_jalali_to_gregorian($y) -> jalali_to_gregorian($y, 0, 0)[0]
 *   year_gregorian_to_jalali($y) -> gregorian_to_jalali($y, 12, 12)[0]
 *
 * Between those two anchors — 1 Farvardin, and 12 December — the offset is
 * always exactly 621, with no leap-year exception, which is why this file needs
 * no calendar library. `npm run lint` cannot prove that, so it is asserted by
 * the round-trip check below and matches the vectors verified against the PHP
 * in backend/MIGRATION.md §9 (1399→2020, 1400→2021, 2020→1399, 1999→1378).
 *
 * The backend converts on write when `defaultOrigin === 0`
 * (backend/src/utils/dates.js), so a form submits Jalali and must convert the
 * stored Gregorian value BACK for display when loading a record to edit.
 * Getting this backwards shifts every year by 621, which is conspicuous.
 */

/** The constant offset between the two anchor days. */
const YEAR_OFFSET = 621;

/** Jalali year -> Gregorian year. 1399 -> 2020 */
export function jalaliYearToGregorian(jalaliYear) {
  const year = Number(jalaliYear);
  return Number.isFinite(year) ? year + YEAR_OFFSET : null;
}

/** Gregorian year -> Jalali year. 2020 -> 1399 */
export function gregorianYearToJalali(gregorianYear) {
  const year = Number(gregorianYear);
  return Number.isFinite(year) ? year - YEAR_OFFSET : null;
}

/**
 * Distinguishes a plausible Jalali year from a Gregorian one — the same guard
 * the backend applies, so a re-submitted form cannot double-convert.
 */
export function looksJalali(year) {
  const value = Number(year);
  return Number.isFinite(value) && value > 1000 && value < 1700;
}

/**
 * The stored Gregorian year as the form should display it.
 * @param {number|null} storedYear   value from the API
 * @param {number} origin            0 = Jalali (ORIGIN_JALALI), 1 = Gregorian
 */
export function toFormYear(storedYear, origin) {
  if (storedYear === null || storedYear === undefined || storedYear === '') return '';
  return origin === 0 ? gregorianYearToJalali(storedYear) : Number(storedYear);
}

/**
 * A form value as the API expects it. The server converts a Jalali year itself,
 * so this passes the entered value through unchanged and exists only to
 * normalize empties — converting here as well would double-convert.
 */
export function toApiYear(formYear) {
  if (formYear === null || formYear === undefined || formYear === '') return null;
  const numeric = Number(formYear);
  return Number.isFinite(numeric) ? numeric : null;
}

/** The current year in each calendar, for form placeholders and validation. */
export function currentYear(origin) {
  const gregorian = new Date().getFullYear();
  return origin === 0 ? gregorianYearToJalali(gregorian) : gregorian;
}

export default {
  jalaliYearToGregorian,
  gregorianYearToJalali,
  looksJalali,
  toFormYear,
  toApiYear,
  currentYear,
};
