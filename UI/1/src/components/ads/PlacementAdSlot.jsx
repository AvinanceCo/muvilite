/**
 * Landing-page advertisement slot.
 *
 * Purpose: render the still ads scheduled for one fixed slot.
 * Inputs:  the ads for a slot, from `GET /api/ads/placements`
 * Outputs: JSX, or nothing when the slot is empty
 * Deps:    services/media
 *
 * Replaces the two hardcoded blocks in `index.php`:
 *
 *     <div class="ads">
 *       <!--  size : 750x150 -->
 *       <a href="/assets/page/index/top.mp4"><img src="/assets/page/index/top.gif" /></a>
 *       <a href="/assets/page/index/top.mp4"><img src="/assets/page/index/top.gif" /></a>
 *     </div>
 *
 * THE TWO ANCHORS WERE ORIENTATION VARIANTS, not two ads. The legacy stylesheet
 * hid the second normally and swapped them under
 * `@media (orientation:landscape)`, so the first artwork was the narrow one and
 * the second the wide one. The admin panel calls them «موبایل» and «دسکتاپ»,
 * after the device rather than the media query; Tailwind's `portrait:` /
 * `landscape:` variants below ARE that media query, unchanged, and the API
 * fills the desktop path from the mobile one when only one was uploaded — which
 * is what shipping the same GIF twice achieved.
 *
 * Sizing follows the legacy rule exactly: `.ads>a>img{width:100%}` with no
 * height constraint, so the artwork keeps its own proportions and nothing is
 * cropped. Nothing needs constraining here because the dimensions are enforced
 * at upload (backend config/constants.js AD_PLACEMENT_SIZES): 750×150 / 750×300
 * for mobile and 1500×150 / 1500×300 for desktop.
 *
 * Two rules borrowed from the banner rail, for the same reasons:
 *   - an ad with no `url` renders as a plain figure, not an anchor with no
 *     href — nothing that cannot be followed should look followable;
 *   - `url` is operator-entered and routinely points off-site, so it stays an
 *     `<a>` rather than a router Link.
 */
import { mediaUrl } from '../../services/media.js';

/** One ad's artwork, in whichever orientation the viewport is in. */
function AdArtwork({ ad }) {
  const mobile = mediaUrl(ad.imagePath);
  const desktop = mediaUrl(ad.imageLandscapePath) ?? mobile;

  // Two elements rather than one with a `srcset`: the choice is orientation,
  // not resolution, and these are frequently different artwork rather than two
  // renderings of the same image.
  return (
    <>
      <img
        src={mobile}
        alt={ad.titleFa || ''}
        loading="lazy"
        decoding="async"
        className="w-full rounded-panel landscape:hidden"
      />
      <img
        src={desktop}
        alt={ad.titleFa || ''}
        loading="lazy"
        decoding="async"
        className="hidden w-full rounded-panel landscape:block"
      />
    </>
  );
}

/**
 * @param {object} props
 * @param {object[]} [props.ads] the slot's ads, already ordered by the API
 * @param {string} [props.className]
 */
export function PlacementAdSlot({ ads = [], className = '' }) {
  const slides = ads.filter((ad) => ad.imagePath);

  if (slides.length === 0) return null;

  return (
    <div
      className={`flex flex-col gap-3 ${className}`}
      // Advertisements are not part of the page's navigation; a screen reader
      // gets the region name and can skip past it.
      role="region"
      aria-label="تبلیغات"
    >
      {slides.map((ad) =>
        ad.url ? (
          <a
            key={ad.id}
            href={ad.url}
            className="block overflow-hidden rounded-panel border border-line transition-colors hover:border-azure-dim"
          >
            <AdArtwork ad={ad} />
          </a>
        ) : (
          <figure
            key={ad.id}
            className="m-0 block overflow-hidden rounded-panel border border-line"
          >
            <AdArtwork ad={ad} />
          </figure>
        ),
      )}
    </div>
  );
}

export default PlacementAdSlot;
