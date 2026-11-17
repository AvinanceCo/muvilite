/**
 * Banner rail — the promotional slide strip.
 *
 * Purpose: render a `banner` block from a landing page as a scrollable strip of
 *          slides.
 * Inputs:  style ('long' | 'item'; 'full' is retired), items (banner documents)
 * Outputs: JSX, or nothing when no slide has an image
 * Deps:    services/media
 *
 * Replaces `_layout/PageLayout.php::displayBanners()`.
 *
 * Style -> shape. The legacy template picked a placeholder image per style, and
 * those three placeholder dimensions are the only record of what each style was
 * meant to look like, so they are the mapping:
 *
 *   style   legacy placeholder      here
 *   ─────   ────────────────────    ──────────────────────────────────────────
 *   full    posterHolder1920x720    one slide per view, 16/6 — the hero strip
 *   long    posterHolder1920x360    one slide per view, 16/3 — half the hero's
 *                                   height at the same width, hence "long"
 *   item    posterHolder517x282     a small card, ~517/282, several per view
 *
 * `full` HAS SINCE BEEN RETIRED at the maintainer's request. Its row above is
 * kept because it is the record of what the style was, and a category created
 * before the withdrawal may still carry the type — see RETIRED_STYLES below for
 * what such a rail renders as now.
 *
 * The legacy markup reinforces the split: `full` and `long` both got the
 * `header-banner` class with prev/next arrows and pagination dots, while `item`
 * got `mixed-swiper` — a strip of cards. So the first two are full-bleed and the
 * third is a card rail, which is what the widths below do.
 *
 * The Swiper arrows and dots are not reproduced: they drove a JS carousel that
 * is not a dependency here. Native scroll-snap gives the same gesture on touch
 * and the wheel on a desktop, with no library.
 *
 * Two rules carried over verbatim:
 *   - a banner with an empty `url` rendered `<a>` with no href — a dead link. It
 *     becomes a plain figure here, so nothing that cannot be followed looks
 *     followable;
 *   - `url` is admin-entered and routinely points off-site, so it stays an `<a>`
 *     rather than a router Link.
 *
 * That off-site habit is also why the anchor opens in a new tab: a banner is an
 * aside from whatever the viewer came to the page for, and following one should
 * not cost them their place. `rel="noopener noreferrer"` rides along so the
 * opened page gets no handle on this window and no referrer.
 *
 * A slide with no `imagePath` falls back to the `banner` placeholder an operator
 * uploaded, and is skipped entirely when no placeholder is configured. The
 * legacy image src was derived from the row id (`assets/banners/{id}.jpg`) and
 * always rendered, so a missing file showed a broken frame; the path is a stored
 * field now (backend models/Banner.js) and its absence means there is nothing of
 * the banner's own to show.
 *
 * There is no bundled last resort here, deliberately: an unconfigured slot draws
 * no rail at all rather than a strip of identical holder images, which is what
 * the legacy per-style holders would have produced.
 */
import { PLACEHOLDER_SLOTS } from '../../services/media.js';
import { usePlaceholderUrl } from '../../context/PlaceholderContext.jsx';
import MediaImage from '../media/MediaImage.jsx';

/**
 * Slide geometry per style. `width` is the slide's share of the rail, `aspect`
 * its frame — see the table in the file header for where each came from.
 */
const SLIDE_STYLES = {
  // full: { width: 'w-full', aspect: 'aspect-[16/6]' },
  //   RETIRED. The full-width banner was withdrawn by the maintainer; the entry
  //   is kept commented so restoring it is one line here plus its counterparts
  //   in the backend's BANNER_IMAGE_SIZES / BANNER_CATEGORY_TYPES_AVAILABLE and
  //   the admin's BANNER_CATEGORY_TYPES.
  long: { width: 'w-full', aspect: 'aspect-[16/3]' },
  item: { width: 'w-64 sm:w-80', aspect: 'aspect-[517/282]' },
};

/**
 * Where a retired style lands.
 *
 * A category created before the withdrawal may still be typed 'full', and its
 * rail has to keep rendering. It falls to 'long' rather than to the `item`
 * default, because 'long' is the surviving full-bleed style and dropping such a
 * rail to a strip of small cards would be a bigger change to a live page than
 * the withdrawal itself.
 */
const RETIRED_STYLES = { full: 'long' };

/** One slide's visible content, shared by the link and the plain-figure form. */
function BannerFace({ banner, aspect }) {
  return (
    <>
      {/* `builtIn={false}`: with no banner placeholder configured the rail has
          already dropped this slide, so there is nothing left to fall back to. */}
      <MediaImage
        path={banner.imagePath}
        slot={PLACEHOLDER_SLOTS.BANNER}
        builtIn={false}
        loading="lazy"
        decoding="async"
        className={`${aspect} w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]`}
      />

      {/* The legacy `darkshadow` overlay: without it, light artwork swallows the
          caption. Only drawn when there is a caption to protect. */}
      {banner.titleFa || banner.subtitleFa || banner.labelFa ? (
        <div className="absolute inset-0 flex flex-col justify-end gap-1 bg-gradient-to-t from-ink/90 via-ink/30 to-transparent p-3 sm:p-4">
          {banner.labelFa ? (
            <span className="w-fit rounded bg-azure px-1.5 py-0.5 font-mono text-[0.7rem] font-bold text-ink">
              {banner.labelFa}
            </span>
          ) : null}

          {banner.titleFa ? (
            <p className="truncate text-base font-bold leading-tight text-paper sm:text-lg">
              {banner.titleFa}
            </p>
          ) : null}

          {banner.subtitleFa ? (
            <p className="truncate text-sm leading-6 text-muted">{banner.subtitleFa}</p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

/**
 * @param {object} props
 * @param {'long'|'item'|'full'} [props.style='item'] the banner category's type;
 *        'full' is retired and renders as 'long'
 * @param {object[]} props.items banner documents (backend BANNER_CARD_FIELDS)
 */
export function BannerRail({ style = 'item', items = [] }) {
  const resolved = RETIRED_STYLES[style] ?? style;
  const { width, aspect } = SLIDE_STYLES[resolved] ?? SLIDE_STYLES.item;
  const placeholderFor = usePlaceholderUrl();
  const fallback = placeholderFor(PLACEHOLDER_SLOTS.BANNER);

  // A slide with no artwork of its own survives only while a placeholder exists
  // to stand in for it — see the file header.
  const slides = fallback ? items : items.filter((banner) => banner.imagePath);

  if (slides.length === 0) return null;

  return (
    <ul
      className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 sm:gap-4"
      // Banners are promotional, not navigational; a screen reader gets the
      // region name rather than an unlabelled list of images.
      aria-label="بنرهای تبلیغاتی"
    >
      {slides.map((banner) => {
        const caption = banner.titleFa || banner.subtitleFa || banner.labelFa;
        const frame =
          'group relative block overflow-hidden rounded-panel border border-line bg-panel';

        return (
          <li key={banner._id} className={`${width} shrink-0 snap-start`}>
            {banner.url ? (
              <a
                href={banner.url}
                target={banner.url.startsWith('/') ? undefined : '_blank'}
                rel="noopener noreferrer"
                className={`${frame} transition-colors hover:border-azure-dim`}
                aria-label={caption || 'بنر'}
              >
                <BannerFace banner={banner} aspect={aspect} />
              </a>
            ) : (
              <figure className={`${frame} m-0`}>
                <BannerFace banner={banner} aspect={aspect} />
              </figure>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export default BannerRail;
