/**
 * Advertisement API.
 *
 * Purpose: fetch the pre-roll a player should show and the still ads the
 *          landing page should render.
 * Inputs:  none
 * Outputs: an ad descriptor (or null), and slot-grouped still ads
 * Deps:    api/client
 *
 * The legacy client chose its own ad: `player.php` generated a random number and
 * requested `/assets/ads/vast{n}.xml` — a static file, one of five, of which the
 * fifth could never be drawn. The SERVER chooses now, weighted by each
 * creative's `weight`, and equal weights reproduce that uniform draw exactly.
 *
 * `null` from getPreroll is the normal "no ad scheduled" answer, not a failure:
 * an installation with no creatives uploaded plays its films with no ad break,
 * just as one with an empty `assets/ads/` directory did.
 */
import { request } from './client.js';

/**
 * The pre-roll for this playback. A fresh draw per call — do not cache it.
 *
 * @returns {Promise<{
 *   id: string, titleFa: string, titleEn: string, videoPath: string,
 *   durationSecond: number, skipOffsetSecond: number, clickUrl: string|null
 * }|null>}
 */
export function fetchPrerollAd() {
  return request({ url: '/ads/preroll' });
}

/**
 * Still advertisements for the landing page, grouped by slot.
 *
 * Both keys are always present, empty when nothing is scheduled, so the caller
 * never has to probe. `imageLandscapePath` is filled in server-side from
 * `imagePath` when no landscape artwork was uploaded.
 *
 * @returns {Promise<{top: object[], bottom: object[]}>}
 */
export function fetchPlacementAds() {
  return request({ url: '/ads/placements' });
}

export default { fetchPrerollAd, fetchPlacementAds };
