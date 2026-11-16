/**
 * Mobile number normalization.
 *
 * Purpose: reduce every way an Iranian mobile number can be typed to one stored
 *          form, so lookups are exact.
 * Inputs:  a raw number string
 * Outputs: '+98' followed by the last 10 digits
 * Deps:    none
 *
 * Legacy implementation (includes/functions.include.php:590):
 *
 *   function normalize_mobile_number($input_number) {
 *       $input_number = strrev($input_number);
 *       $firs_part    = substr($input_number, 0, 10);
 *       return "+98" . strrev($firs_part);
 *   }
 *
 * Reversing, taking the first 10 characters and reversing back is just "the
 * last 10 characters". So 09121234567, 9121234567, +989121234567 and
 * 00989121234567 all normalize to +989121234567.
 *
 * The legacy version operated on raw characters, so any punctuation counted
 * toward the ten. Non-digits are stripped first here, which makes formats like
 * '0912 123 4567' normalize correctly instead of silently truncating.
 */
export function normalizeMobile(input) {
  if (typeof input !== 'string' && typeof input !== 'number') return '';

  const digits = String(input).replace(/\D/g, '');
  if (digits.length < 10) return '';

  return `+98${digits.slice(-10)}`;
}

/**
 * Masks a number for display, e.g. +989121234567 -> +98912XXX4567.
 * legacy: mask_mobile_number() — keeps the last 4 and the leading part,
 * replacing the middle with 'XXX'.
 */
export function maskMobile(input) {
  const value = String(input ?? '');
  if (value.length < 8) return value;
  return `${value.slice(0, -7)}XXX${value.slice(-4)}`;
}

/** Matches a normalized Iranian mobile: +98 then 9 then 9 more digits. */
export const MOBILE_PATTERN = /^\+989\d{9}$/;

export default { normalizeMobile, maskMobile, MOBILE_PATTERN };
