/**
 * Lookup service — reference data for client dropdowns and filters.
 *
 * Purpose: serve the small taxonomy collections plus the fixed enumerations
 *          that lived as PHP constants.
 * Inputs:  none
 * Outputs: lookup lists
 * Deps:    repositories, config/constants
 *
 * Legacy counterpart: `custom.js` called v1 endpoints for these lists
 * (`list_qualities`, `list_age_ranges`, `list_platforms`, `location_countries`,
 * `GetDataController.php?action=genreList`). Those v1 endpoints no longer exist
 * — the constants they served are in `api/system/define.php` and the taxonomy
 * tables are still live, so the data is real even though the old routes are not.
 */
import { genreRepository, ageRangeRepository, countryRepository } from '../repositories/index.js';
import { CAST_ROLES, VIDEO_QUALITIES, LANGUAGES, DEVICE_PLATFORMS } from '../config/constants.js';

export async function listGenres() {
  const genres = await genreRepository.find(genreRepository.publicScope(), {
    sort: { nameFa: 1 },
    select: 'nameFa nameEn colorClass',
  });
  return genres;
}

export async function listAgeRanges() {
  return ageRangeRepository.find(ageRangeRepository.publicScope(), {
    sort: { nameFa: 1 },
    select: 'nameFa nameEn description',
  });
}

export async function listCountries() {
  return countryRepository.find(countryRepository.publicScope(), {
    sort: { countryFa: 1 },
    select: 'countryCode countryFa countryEn',
  });
}

/** Static enumerations — no database read needed. */
export function listStaticLookups() {
  return {
    castRoles: CAST_ROLES,
    videoQualities: VIDEO_QUALITIES,
    languages: LANGUAGES,
    platforms: Object.entries(DEVICE_PLATFORMS).map(([name, value]) => ({ name, value })),
  };
}

export default { listGenres, listAgeRanges, listCountries, listStaticLookups };
