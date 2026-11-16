/**
 * Home — the departures board.
 *
 * Purpose: the landing hub. Get a passenger from "I'm bored" to a section in
 *          one tap.
 * Inputs:  none
 * Outputs: JSX
 * Deps:    react-router-dom, @tanstack/react-query, api/ads,
 *          context/BrandingContext, hooks/useDocumentTitle
 *
 * Legacy counterpart: `index.php`, a four-tile grid linking to `page?id=3`
 * (film), `page?id=4` (music), `page?id=5` (clips) and `/poll`. Those numeric
 * ids were database rows on one specific installation; the pages carry slugs
 * now (backend scripts/seed.js seeds `film`, `music`, `clips`) and
 * `GET /api/pages/:idOrSlug` resolves either, so the hub links by slug and
 * survives a reseed.
 *
 * A fifth row, «بازی», has no legacy tile behind it: the games section is new.
 *
 * THE TILES NEVER WAIT ON THE NETWORK. This is the first screen a passenger
 * sees on a slow cabin link, and every destination it offers is a fixed part of
 * the product — fetching to render five known labels would only put a spinner
 * between the passenger and their first tap.
 *
 * The one request this page makes is for the two advertisement slots the legacy
 * page carried as hardcoded markup (lines 23-27 and 108-112, pointing at
 * `/assets/page/index/top.gif` and `bottom.gif`). Those are database records
 * now, managed under /placement-ads in the admin panel. The request is
 * deliberately NOT awaited before rendering: the tiles paint immediately and an
 * ad appears if and when one arrives. A failed or slow ad fetch costs the
 * passenger nothing.
 *
 * WHERE THE SLOTS SIT, and why the page is a fragment rather than one container:
 * the `top` slot is the first thing under the navbar and the `bottom` slot the
 * last thing before the footer, so each is flush against the layout chrome
 * rather than floating inside the text column's vertical padding. Both sit in
 * the same `max-w-3xl` column as the content, which also happens to match the
 * legacy artwork width (750px).
 *
 * Their spacing is carried on the slot element itself, never on a wrapper
 * around it. `PlacementAdSlot` returns null when it has nothing to show, so an
 * empty slot contributes no padding and the page closes up exactly as it did
 * before ads existed. A wrapper `<div>` would leave a visible gap instead.
 *
 * THE HEADING AND THE SENTENCE UNDER IT ARE OPERATOR TEXT, edited under
 * «هویت بصری» in the panel. They come from context/BrandingContext.jsx, which
 * renders the shipped wording on the first frame and swaps in the operator's
 * when `GET /api/branding` lands — so this page still never waits on the
 * network, exactly as the tiles never do. The destination rows below them
 * are still fixed: they name the product's sections, not the customer's.
 */
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchPlacementAds } from '../api/ads.js';
import PlacementAdSlot from '../components/ads/PlacementAdSlot.jsx';
import { useBranding } from '../context/BrandingContext.jsx';
import useDocumentTitle from '../hooks/useDocumentTitle.js';

/**
 * The destinations: the legacy four in the legacy order, with games added.
 *
 * `code` is the boarding-board abbreviation, derived from the destination
 * rather than decorative: it is what the row is, in three characters.
 *
 * «بازی» IS NEW — the legacy hub had four tiles and no games (MIGRATION.md §9).
 * It sits with the other things to do, ahead of the poll, which is the one row
 * that asks something of the passenger instead of offering something. Like the
 * rest it is a fixed part of the product and links without asking the network
 * whether any games exist; an installation with none shows an empty games page,
 * exactly as one with no clips shows an empty clips page.
 */
const DESTINATIONS = [
  { to: '/page/film', code: 'FLM', title: 'فیلم', note: 'سینمای ایران و جهان' },
  { to: '/page/music', code: 'MUS', title: 'موسیقی', note: 'آلبوم‌ها و تک‌آهنگ‌ها' },
  { to: '/page/clips', code: 'CLP', title: 'کلیپ‌های ویدئویی', note: 'کوتاه و تماشایی' },
  { to: '/games', code: 'GAM', title: 'بازی', note: 'بدون نصب، همین‌جا در مرورگر' },
  { to: '/poll', code: 'VOC', title: 'نظرسنجی', note: 'نظر شما برای ما مهم است' },
];

function ChevronIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-5 text-muted transition-colors group-hover:text-azure"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="m14 6-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Home() {
  useDocumentTitle(null, 'فیلم، موسیقی، بازی و نظرسنجی');

  const { homeTitle, homeDescription } = useBranding();

  /**
   * The two ad slots. Cached for the session: these change when an operator
   * edits them, not minute to minute, and a passenger returning to the hub
   * between films should not pay for the request again. An error resolves to
   * empty slots rather than surfacing — an advertisement is not worth an error
   * message on the landing page.
   */
  const ads = useQuery({
    queryKey: ['placement-ads'],
    queryFn: () => fetchPlacementAds().catch(() => ({ top: [], bottom: [] })),
    staleTime: 10 * 60_000,
    retry: false,
  });

  return (
    <>
      {/* Flush under the navbar, above everything the page says. The spacing
          lives on the slot itself, not on a wrapper, so an empty slot leaves no
          gap behind — PlacementAdSlot renders nothing at all when it has no
          artwork to show.

          `relative z-10` is load-bearing. The hero's `.brand-wash` below is tucked
          2rem upward under this slot so its own top edge stays hidden, and a
          z-index:-1 layer inside a stacking context still paints above an earlier
          SIBLING. Without this, the wash casts a teal tint across the bottom of
          the advertiser's artwork. Never recolour a creative — lift it instead. */}
      <PlacementAdSlot
        ads={ads.data?.top}
        className="relative z-10 mx-auto max-w-3xl px-4 pt-4"
      />

      {/* `brand-wash` is the logo's sweep rendered as light behind the heading —
          the site's one instance of it, and the reason the hero needs no artwork
          of its own. It stays on the hero rather than on a wrapper around both,
          so the glow lands on the heading whether or not an ad is running. See
          the motif's note in src/index.css. */}
      <div className="brand-wash mx-auto max-w-3xl px-4 py-10 sm:py-16">
        <header className="mb-8 sm:mb-12">
          {/* The heading is the first thing in the hero. There was a Latin
              eyebrow line above it — "In-flight entertainment" — removed at the
              maintainer's request; the operator's own heading now opens the
              page, so the h1 carries no top margin. */}
          <h1 className="text-3xl font-bold leading-tight sm:text-4xl">{homeTitle}</h1>
          {/* `whitespace-pre-line`: the description is a textarea in the panel,
              so an operator who pressed Enter gets the line break they typed
              rather than one run-on paragraph. `max-w-md` still holds the
              measure for the common case of one flowing sentence. */}
          <p className="mt-3 max-w-md whitespace-pre-line leading-7 text-muted">
            {homeDescription}
          </p>
        </header>

        <nav aria-label="بخش‌ها">
          <ul className="border-t border-line">
            {DESTINATIONS.map((destination, index) => (
              <li key={destination.to} className="board-row" style={{ '--row-index': index }}>
                <Link
                  to={destination.to}
                  className="group flex items-center gap-4 border-b border-line px-1 py-5 transition-colors hover:bg-panel sm:px-3 sm:py-6"
                >
                  <span className="font-mono text-sm tracking-[0.2em] text-azure sm:text-base">
                    {destination.code}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block text-xl font-bold leading-tight sm:text-2xl">
                      {destination.title}
                    </span>
                    <span className="mt-1 block text-sm text-muted">{destination.note}</span>
                  </span>

                  <ChevronIcon />
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <p className="mt-8 text-sm leading-7 text-muted">
          دنبال عنوان مشخصی هستید؟{' '}
          <Link to="/search" className="text-azure transition-colors hover:text-paper">
            جستجو کنید
          </Link>
          .
        </p>
      </div>

      {/* After everything the page has to say, immediately above the footer. */}
      <PlacementAdSlot ads={ads.data?.bottom} className="mx-auto max-w-3xl px-4 pb-10 sm:pb-12" />
    </>
  );
}

export default Home;
