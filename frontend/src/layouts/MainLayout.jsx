/**
 * Main layout — header, slide-out panel, footer.
 *
 * Purpose: the chrome every browsing page sits inside.
 * Inputs:  route children via <Outlet>
 * Outputs: JSX
 * Deps:    react-router-dom, context/BrandingContext, services/media
 *
 * Reproduces `_layout/header-menu.php` and `_layout/sidebar.php`: a menu
 * button, the MuviLite logo linking home, a search action, and a right-side
 * panel holding the two links the legacy sidebar actually had — home and the
 * poll. The commented-out genre dropdown and the "series" tab are not carried
 * over; the series tab set a query parameter `search.php` ignored
 * (MIGRATION.md §7.3).
 *
 * The panel opens from the right because the document is RTL.
 *
 * THE FOOTER LOGO IS THE CUSTOMER'S, NOT THE PRODUCT'S. It comes from
 * `GET /api/branding` and is uploaded under «هویت بصری» in the panel; the header
 * mark above is a different image and is untouched by it. An installation that
 * has not uploaded one shows the copyright line alone — there is no fallback to
 * the product lockup, because the point of the slot is to carry whoever the
 * installation belongs to.
 */
import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
// The Muvi Lite artwork (2026-11-16), cut out of the maintainer's JPEGs for a
// dark ground: the full lockup ("muvi" redrawn in white, the "lite" pill as
// supplied) is the DEFAULT logo, shown while the site still has the product's
// name. Once an operator renames the site in the panel, the lockup would name
// the wrong thing, so the header pairs the bare mark with their name instead.
// The footer shows the CUSTOMER's logo, not either of these (see below).
import muviliteLogo from '../assets/images/muvilite-logo.png';
import muviliteMark from '../assets/images/muvilite-mark.png';
import { PRODUCT_NAME, useBranding } from '../context/BrandingContext.jsx';
import { mediaUrl } from '../services/media.js';

const PANEL_LINKS = [
  { to: '/', label: 'صفحه اصلی' },
  { to: '/search', label: 'جستجوی فیلم' },
  { to: '/musics', label: 'جستجوی موسیقی' },
  // New: the legacy portal had no games, so its sidebar had no such link.
  { to: '/games', label: 'بازی‌ها' },
  { to: '/poll', label: 'نظرسنجی' },
];

/**
 * How the site's name is set as a wordmark. A Latin name keeps the original
 * look — monospace capitals at the logo's letterspacing. A name in Persian (or
 * any Arabic-script) gets the body face with no tracking: letterspacing pulls
 * joined letters apart, and capitals do not exist there.
 */
function wordmarkClass(name) {
  return /[؀-ۿ]/.test(name ?? '') ? 'font-sans' : 'font-mono uppercase tracking-[0.18em]';
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" strokeLinecap="round" />
    </svg>
  );
}

export function MainLayout() {
  const [panelOpen, setPanelOpen] = useState(false);
  const location = useLocation();
  const { footerLogoPath, siteName } = useBranding();
  /** True while the site still carries the product's name: show the full lockup. */
  const isDefaultName = siteName === PRODUCT_NAME;
  const customerLogo = mediaUrl(footerLogoPath);

  // A navigation always closes the panel, including a back gesture.
  useEffect(() => setPanelOpen(false), [location.pathname, location.search]);

  // Escape closes the panel; the page behind it stays put while it is open.
  useEffect(() => {
    if (!panelOpen) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') setPanelOpen(false);
    };

    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [panelOpen]);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-ink/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4">
          <button
            type="button"
            onClick={() => setPanelOpen(true)}
            className="-mr-2 grid size-10 place-items-center rounded-lg text-paper transition-colors hover:bg-panel"
            aria-label="باز کردن منو"
            aria-expanded={panelOpen}
          >
            <MenuIcon />
          </button>

          <Link to="/" className="flex items-center gap-2.5" aria-label={siteName}>
            {isDefaultName ? (
              <img src={muviliteLogo} alt={siteName} className="h-8 w-auto" />
            ) : (
              <>
                <img src={muviliteMark} alt="" aria-hidden="true" className="h-7 w-auto" />
                {/* The accent at the logo's own letterspacing, so the operator's
                    name reads as the same object as the mark beside it. */}
                <span className={`text-lg font-bold text-azure ${wordmarkClass(siteName)}`}>
                  {siteName}
                </span>
              </>
            )}
          </Link>

          <span className="flex-1" />

          <Link
            to="/search"
            className="grid size-10 place-items-center rounded-lg text-paper transition-colors hover:bg-panel"
            aria-label="جستجو"
          >
            <SearchIcon />
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-line px-4 py-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 text-xs text-muted">
          <span>تمامی حقوق مدیا وای‌فای برای آوین انس محفوظ می‌باشد.</span>

          {/* Scaled by HEIGHT, with the width left to follow: a customer logo
              has whatever proportions it has, and constraining both would
              letterbox or squash somebody's mark. `max-w-[12rem]` is the guard
              for a very wide lockup, and nothing renders at all when no logo has
              been uploaded — an empty <span> would leave the copyright line
              stretched across the footer for no reason. */}
          {customerLogo ? (
            <span className="flex items-center gap-4">
              <img
                src={customerLogo}
                alt=""
                className="h-8 w-auto max-w-[12rem] object-contain opacity-90"
              />
            </span>
          ) : null}
        </div>
      </footer>

      {panelOpen ? (
        <div className="fixed inset-0 z-40">
          <button
            type="button"
            className="absolute inset-0 bg-ink/80"
            onClick={() => setPanelOpen(false)}
            aria-label="بستن منو"
          />
          <nav
            className="absolute inset-y-0 right-0 w-72 max-w-[85vw] border-l border-line bg-panel p-5"
            aria-label="منوی اصلی"
          >
            {isDefaultName ? (
              <img src={muviliteLogo} alt={siteName} className="mb-6 h-7 w-auto" />
            ) : (
              <p className={`mb-6 text-sm text-azure ${wordmarkClass(siteName)}`}>{siteName}</p>
            )}
            <ul className="space-y-1">
              {PANEL_LINKS.map((link) => (
                <li key={link.to}>
                  <NavLink
                    to={link.to}
                    className={({ isActive }) =>
                      `block rounded-lg px-3 py-2.5 transition-colors ${
                        isActive ? 'bg-panel-hi text-azure' : 'text-paper hover:bg-panel-hi'
                      }`
                    }
                  >
                    {link.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      ) : null}
    </div>
  );
}

export default MainLayout;
