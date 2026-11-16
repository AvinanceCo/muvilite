/**
 * Ad serving service.
 *
 * Purpose: choose which pre-roll a player gets, list the still ads for a
 *          landing-page slot, and render the VAST tag the legacy players expect.
 * Inputs:  a request origin (for absolute media URLs in the VAST document)
 * Outputs: an ad descriptor, grouped placement ads, or a VAST 3.0 XML string
 * Deps:    repositories, config/constants
 *
 * Legacy counterpart: none in PHP — this replaces `assets/ads/vast{1..5}.xml`,
 * five static files, and the one line of `player.php` that picked between them:
 *
 *     var randomm = Math.floor(Math.random() * 4) + 1;
 *
 * That draw was uniform over four of the five tags, so the fifth creative could
 * never play. Selection here covers every eligible creative and is weighted, and
 * WEIGHTS THAT ARE ALL EQUAL REPRODUCE THE LEGACY UNIFORM DRAW EXACTLY — which
 * is why `weight` defaults to 1. A creative with no uploaded file is ineligible
 * rather than served as a broken tag, which is the other legacy defect
 * (`vast1.xml` pointed at an `adVideo.mp4` that was never uploaded).
 *
 * Selection is server-side so that the rule lives in one place: the JSON
 * endpoint the React player uses and the VAST endpoint a native player uses both
 * call `pickPreroll()` and therefore obey the same weighting.
 */
import { videoAdRepository, placementAdRepository } from '../repositories/index.js';
import { AD_PLACEMENTS, AD_SKIP_OFFSET_SECONDS } from '../config/constants.js';

/** Fields a player needs. Nothing else about a creative is public. */
const PREROLL_FIELDS = 'titleFa titleEn videoPath durationSecond skipOffsetSecond clickUrl weight';

/** Fields the landing page needs for a still ad. */
const PLACEMENT_FIELDS = 'titleFa placement imagePath imageLandscapePath url order';

/**
 * Picks one creative in proportion to its weight.
 *
 * A zero weight is excluded — that is the point of the value — but if EVERY
 * eligible creative is zero-weighted the draw falls back to uniform rather than
 * serving nothing, since an operator who zeroed everything more likely meant
 * "no preference" than "disable ads" (deactivating does that).
 *
 * @param {object[]} ads eligible creatives
 * @returns {object|null}
 */
function pickWeighted(ads) {
  if (ads.length === 0) return null;

  const total = ads.reduce((sum, ad) => sum + Math.max(0, ad.weight ?? 0), 0);

  if (total <= 0) {
    return ads[Math.floor(Math.random() * ads.length)];
  }

  let ticket = Math.random() * total;
  for (const ad of ads) {
    ticket -= Math.max(0, ad.weight ?? 0);
    if (ticket < 0) return ad;
  }

  // Only reachable through floating-point drift on the last subtraction.
  return ads[ads.length - 1];
}

/**
 * The pre-roll for one playback, or null when there is nothing to show.
 *
 * Null is a normal answer, not an error: an installation with no creatives
 * uploaded plays its movies with no ad break, exactly as one whose
 * `assets/ads/` directory was empty did.
 *
 * @returns {Promise<object|null>}
 */
export async function pickPreroll() {
  const eligible = await videoAdRepository.find(
    // `videoPath: { $ne: null }` is the "has a file" test — a creative can be
    // created before its MP4 is attached, and must not be served meanwhile.
    videoAdRepository.publicScope({ videoPath: { $ne: null } }),
    { select: PREROLL_FIELDS },
  );

  const ad = pickWeighted(eligible);
  if (!ad) return null;

  return {
    id: ad._id,
    titleFa: ad.titleFa,
    titleEn: ad.titleEn,
    videoPath: ad.videoPath,
    durationSecond: ad.durationSecond ?? 0,
    skipOffsetSecond: ad.skipOffsetSecond ?? AD_SKIP_OFFSET_SECONDS,
    clickUrl: ad.clickUrl || null,
  };
}

/**
 * Active still ads for the landing page, grouped by slot.
 *
 * Always returns a key per slot, empty when nothing is scheduled, so the client
 * renders a stable layout without probing for missing properties.
 *
 * @returns {Promise<Record<'top'|'bottom', object[]>>}
 */
export async function listPlacementAds() {
  const ads = await placementAdRepository.find(
    // A slot with neither artwork has nothing to draw, so it is filtered out
    // here rather than shipped to the client to be skipped there.
    placementAdRepository.publicScope({ imagePath: { $ne: null } }),
    { sort: { order: 1, createdAt: 1 }, select: PLACEMENT_FIELDS },
  );

  const grouped = Object.fromEntries(AD_PLACEMENTS.map((placement) => [placement, []]));

  for (const ad of ads) {
    grouped[ad.placement]?.push({
      id: ad._id,
      titleFa: ad.titleFa,
      placement: ad.placement,
      imagePath: ad.imagePath,
      // Falling back here rather than in the client keeps the "same file twice"
      // legacy arrangement working without every consumer re-implementing it.
      imageLandscapePath: ad.imageLandscapePath || ad.imagePath,
      url: ad.url || null,
    });
  }

  return grouped;
}

/* ------------------------------------------------------------------ VAST --- */

/** XML text escaping. Titles are operator-entered and may contain `&` or `<`. */
function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Seconds -> `HH:MM:SS`, the VAST duration format. */
function toTimecode(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds || 0));
  const pad = (value) => String(value).padStart(2, '0');
  return `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor((seconds % 3600) / 60))}:${pad(seconds % 60)}`;
}

/**
 * Renders a creative as a VAST 3.0 document.
 *
 * This exists for parity, not for the React player: the passenger frontend
 * consumes the JSON form. The legacy Android/iOS clients and any jwplayer
 * install were configured with a VAST tag URL, and this keeps that contract
 * working — the element set below is the same one the five legacy files used,
 * with `<ClickThrough>` added because the schema now has somewhere to put it.
 *
 * `<Description>` repeats the duration in seconds. That looks redundant, and it
 * is, but the legacy player read `eventObjet.description` as the watched-second
 * value it reported on completion (player.php:138), so a tag without it would
 * make an old client report `undefined`.
 *
 * @param {object} ad     the descriptor from pickPreroll()
 * @param {string} origin absolute origin for media URLs, e.g. `https://api.host`
 * @returns {string} XML
 */
export function renderVast(ad, origin = '') {
  if (!ad) {
    // A well-formed empty response. VAST clients treat this as "no ad" and
    // continue to content; an HTTP error would surface as a playback failure.
    return '<?xml version="1.0" encoding="UTF-8"?>\n<VAST version="3.0"></VAST>\n';
  }

  const mediaUrl = `${origin}${ad.videoPath}`;
  const clickThrough = ad.clickUrl
    ? `\n            <VideoClicks><ClickThrough><![CDATA[${ad.clickUrl}]]></ClickThrough></VideoClicks>`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<VAST xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" version="3.0">
  <Ad id="${escapeXml(ad.id)}">
    <InLine>
      <AdSystem version="1.0">MuviLite</AdSystem>
      <AdTitle>${escapeXml(ad.titleFa)}</AdTitle>
      <Description>${Math.floor(ad.durationSecond || 0)}</Description>
      <Creatives>
        <Creative sequence="1">
          <Linear skipoffset="${toTimecode(ad.skipOffsetSecond)}">
            <Duration>${toTimecode(ad.durationSecond)}</Duration>
            <MediaFiles>
              <MediaFile id="1" delivery="progressive" type="video/mp4" bitrate="400" width="640" height="360">${escapeXml(mediaUrl)}</MediaFile>
            </MediaFiles>${clickThrough}
          </Linear>
        </Creative>
      </Creatives>
    </InLine>
  </Ad>
</VAST>
`;
}

export default { pickPreroll, listPlacementAds, renderVast };
