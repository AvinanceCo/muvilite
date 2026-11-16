/**
 * Jalali (Persian) <-> Gregorian calendar helpers.
 *
 * Purpose: replace the legacy `jdf.include.php` date library and the two
 *          year-level wrappers in `includes/functions.include.php`.
 * Inputs:  year numbers
 * Outputs: converted year numbers
 * Deps:    jalaali-js
 *
 * Legacy behaviour being preserved — note that both helpers convert the YEAR
 * ONLY, never a full date:
 *
 *   function year_jalali_to_gregorian($year) {
 *       $date = jalali_to_gregorian($year, 0, 0, ""); return $date[0];
 *   }
 *   function year_gregorian_to_jalali($year) {
 *       $date = gregorian_to_jalali($year, 12, 12, ""); return $date[0];
 *   }
 *
 * So `movies_tbl.publish_date` and `musics_tbl.publish_date` hold a bare year
 * (e.g. 1399 / 2020), not a timestamp. The admin form submits a Jalali year
 * whenever `default_origin === 0`, and the music detail endpoint renders a
 * Jalali year whenever `is_iranian === 1`.
 */
// jalaali-js ships as CommonJS, so its functions come off the default export
// rather than as named ESM bindings.
import jalaali from 'jalaali-js';

const { toJalaali, toGregorian } = jalaali;

/**
 * Jalali year -> Gregorian year.
 * Mirrors `jalali_to_gregorian($year, 0, 0)`, which lands on the day before
 * 1 Farvardin, i.e. the Gregorian year the Jalali year begins in.
 */
export function jalaliYearToGregorian(jalaliYear) {
  const year = Number(jalaliYear);
  if (!Number.isFinite(year)) return null;
  return toGregorian(year, 1, 1).gy;
}

/**
 * Gregorian year -> Jalali year.
 * Mirrors `gregorian_to_jalali($year, 12, 12)` — 12 December always falls in
 * the Jalali year that started the previous March.
 */
export function gregorianYearToJalali(gregorianYear) {
  const year = Number(gregorianYear);
  if (!Number.isFinite(year)) return null;
  return toJalaali(year, 12, 12).jy;
}

/**
 * Distinguishes a plausible Jalali year from a Gregorian one. Used defensively
 * so a re-submitted admin form cannot double-convert a value.
 */
export function looksJalali(year) {
  const value = Number(year);
  return Number.isFinite(value) && value > 1000 && value < 1700;
}

export default { jalaliYearToGregorian, gregorianYearToJalali, looksJalali };
