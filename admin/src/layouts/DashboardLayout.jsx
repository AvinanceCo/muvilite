/**
 * The signed-in shell.
 *
 * Purpose: the fixed sidenav, the top bar, and the region routes render into.
 * Inputs:  none (reads auth and permissions from context)
 * Outputs: the application chrome around an <Outlet/>
 * Deps:    react-router-dom, routes/nav, context/AuthContext
 *
 * Structure follows the material-tailwind dashboard the brief pointed at — a
 * fixed side navigation, a top bar carrying the breadcrumb and the account
 * menu, content on a distinct ground — rebuilt on this project's own tokens
 * rather than that library. The palette is the passenger site's — the MuviLite
 * mark's azure over a navy-black ground — with a solid azure fill as the primary
 * action (see src/index.css).
 *
 * The sidenav is a drawer under `lg`, where the panel is genuinely usable on a
 * tablet; below `sm` the data grids scroll horizontally inside themselves, which
 * is the compromise a table-heavy admin makes.
 *
 * RTL: the nav sits at the inline START, which `dir="rtl"` puts on the right.
 * Every offset here is logical (`start-0`, `ps-sidenav`, `border-e`) and the
 * two MUST agree: anchoring the nav physically (`right-0`) while insetting the
 * content logically (`pe-sidenav`, which is the LEFT in RTL) pads the wrong
 * edge and slides every data grid underneath the navigation. That bug is
 * invisible in the markup and obvious the moment a wide table is rendered.
 *
 * The off-canvas transform is the one physical value, because a transform has
 * no logical form: `translate-x-full` moves the drawer to the right, off screen
 * past its right-hand anchor.
 */
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { usePermissions } from '../hooks/usePermissions.js';
import { visibleGroups } from '../routes/nav.js';
import { Button } from '../components/ui/Button.jsx';
import muviliteMark from '../assets/images/muvilite-mark.png';

export function DashboardLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  // Navigating on a small screen must close the drawer, or the destination is
  // hidden behind the nav that was just used to reach it.
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-ink">
      <Sidenav open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      {/* The sidenav is fixed at the inline start, so the content is inset by
          its width on that same side. */}
      <div className="lg:ps-sidenav">
        <TopBar onOpenDrawer={() => setDrawerOpen(true)} />

        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- sidenav --- */

function Sidenav({ open, onClose }) {
  const { can } = usePermissions();
  const groups = visibleGroups(can);

  return (
    <>
      {/* Scrim, drawer only. */}
      {open ? (
        <button
          type="button"
          aria-label="بستن منو"
          onClick={onClose}
          className="fixed inset-0 z-30 bg-ink/70 backdrop-blur-sm lg:hidden"
        />
      ) : null}

      <aside
        className={
          'fixed inset-y-0 start-0 z-40 flex w-sidenav flex-col border-e border-line bg-panel ' +
          'transition-transform duration-200 lg:translate-x-0 ' +
          (open ? 'translate-x-0' : 'translate-x-full')
        }
      >
        <div className="flex h-16 shrink-0 items-center gap-2 border-b border-line px-5">
          <img src={muviliteMark} alt="" aria-hidden="true" className="h-6 w-auto shrink-0" />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-paper">MuviLite</p>
            <p className="font-mono text-[0.65rem] uppercase tracking-widest text-muted">
              admin panel
            </p>
          </div>
        </div>

        <nav className="thin-scroll flex-1 overflow-y-auto px-3 py-4">
          {groups.length === 0 ? (
            <p className="px-2 py-4 text-xs leading-6 text-muted">
              گروه دسترسی شما هیچ بخشی را شامل نمی‌شود.
            </p>
          ) : (
            groups.map((group) => (
              <div key={group.id} className="mb-5 last:mb-0">
                <p className="mb-2 flex items-center gap-2 px-2 text-[0.7rem] font-bold text-muted">
                  <span aria-hidden="true">{group.icon}</span>
                  {group.label}
                </p>

                <ul className="space-y-0.5">
                  {group.items.map((item) => (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        className={({ isActive }) =>
                          'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors ' +
                          (isActive
                            ? 'bg-azure-dim/30 font-bold text-azure'
                            : 'text-paper hover:bg-panel-hi')
                        }
                      >
                        <span aria-hidden="true" className="w-4 shrink-0 text-center text-xs opacity-80">
                          {item.icon}
                        </span>
                        <span className="truncate">{item.label}</span>
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </nav>
      </aside>
    </>
  );
}

/* ----------------------------------------------------------------- top bar --- */

function TopBar({ onOpenDrawer }) {
  const { user, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-ink/90 px-4 backdrop-blur sm:px-6">
      <Button
        variant="ghost"
        size="sm"
        onClick={onOpenDrawer}
        aria-label="باز کردن منو"
        className="lg:hidden"
      >
        ☰
      </Button>

      <Breadcrumb />

      <div className="flex-1" />

      <div className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((current) => !current)}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-panel"
        >
          <span
            aria-hidden="true"
            className="flex size-8 items-center justify-center rounded-full border border-line bg-panel text-xs text-azure"
          >
            {(user?.displayName ?? '؟').slice(0, 1)}
          </span>
          <span className="hidden text-start sm:block">
            <span className="block text-xs text-paper">{user?.displayName ?? 'کاربر'}</span>
            <span className="block text-[0.65rem] text-muted">
              {user?.permissionGroup?.name ?? '—'}
            </span>
          </span>
        </button>

        {menuOpen ? (
          <>
            <button
              type="button"
              aria-hidden="true"
              tabIndex={-1}
              onClick={() => setMenuOpen(false)}
              className="fixed inset-0 z-10 cursor-default"
            />
            <div
              role="menu"
              className="absolute end-0 z-20 mt-1 w-52 overflow-hidden rounded-lg border border-line bg-panel shadow-xl shadow-ink/50"
            >
              <div className="border-b border-line px-3 py-2.5">
                <p className="truncate text-xs text-paper">{user?.displayName}</p>
                <p dir="ltr" className="truncate text-start font-mono text-[0.65rem] text-muted">
                  {user?.mobile}
                </p>
              </div>

              <NavLink
                to="/profile"
                role="menuitem"
                className="block px-3 py-2.5 text-xs text-paper transition-colors hover:bg-panel-hi"
              >
                تغییر رمز عبور
              </NavLink>

              <button
                type="button"
                role="menuitem"
                onClick={signOut}
                className="block w-full px-3 py-2.5 text-start text-xs text-signal transition-colors hover:bg-panel-hi"
              >
                خروج از حساب
              </button>
            </div>
          </>
        ) : null}
      </div>
    </header>
  );
}

/**
 * The current section, resolved from the nav model.
 *
 * Deliberately shallow — one level, matching the legacy `خانه / <page>`
 * breadcrumb. A deeper trail would have to invent parentage the routes do not
 * express.
 */
function Breadcrumb() {
  const location = useLocation();
  const { can } = usePermissions();

  const segment = `/${location.pathname.split('/')[1] ?? ''}`;
  const item = visibleGroups(can)
    .flatMap((group) => group.items)
    .find((candidate) => candidate.to === segment);

  return (
    <nav aria-label="مسیر" className="flex items-center gap-2 text-xs text-muted">
      <NavLink to="/" className="transition-colors hover:text-azure">
        خانه
      </NavLink>
      {item ? (
        <>
          <span aria-hidden="true">/</span>
          <span className="text-paper">{item.label}</span>
        </>
      ) : null}
    </nav>
  );
}

export default DashboardLayout;
