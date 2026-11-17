/**
 * Lookup API.
 *
 * Purpose: reference data — genres, age ranges, countries, and the fixed
 *          enumerations that were PHP constants.
 * Inputs:  none
 * Outputs: lookup lists
 * Deps:    api/client
 *
 * These are the only survivors of the taxonomy calls in the legacy
 * `custom.js`; the rest of that file targets actions that no longer exist
 * (MIGRATION.md §7.1).
 */
import { request } from './client.js';

/** @returns {Promise<{_id: string, nameFa: string, nameEn: string, colorClass: string}[]>} */
export function fetchGenres() {
  return request({ url: '/lookups/genres' });
}

export function fetchAgeRanges() {
  return request({ url: '/lookups/age-ranges' });
}

export function fetchCountries() {
  return request({ url: '/lookups/countries' });
}

/** Cast roles, video qualities, languages and device platforms. */
export function fetchStaticLookups() {
  return request({ url: '/lookups/static' });
}

export default { fetchGenres, fetchAgeRanges, fetchCountries, fetchStaticLookups };
