/**
 * Media grid and rail.
 *
 * Purpose: the two ways a collection of cards is laid out — a wrapping grid on
 *          listing pages, a horizontally scrolling strip on a landing page.
 * Inputs:  children (cards)
 * Outputs: JSX
 * Deps:    none
 *
 * Mobile-first: two columns on a phone held upright, widening with the
 * viewport. The rail scrolls with snap points and hides its scrollbar, which is
 * how it reads on a touch screen; on a desktop it still scrolls with the wheel.
 */

/** Wrapping grid for listing pages and search results. */
export function MediaGrid({ children }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-6">
      {children}
    </div>
  );
}

/**
 * Horizontally scrolling strip for landing-page rails.
 *
 * Rails carry at most 10 items and never paginate (backend RAIL_ITEM_LIMIT), so
 * this deliberately has no "load more" affordance — the section header's
 * "see all" is the way into the full collection.
 */
export function MediaRail({ children }) {
  return (
    <ul className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 sm:gap-4">
      {children}
    </ul>
  );
}

/** One rail cell. Sized so a partial next card hints that the strip scrolls. */
export function RailItem({ children, wide = false }) {
  const width = wide ? 'w-40 sm:w-48' : 'w-32 sm:w-40';
  return <li className={`${width} shrink-0 snap-start`}>{children}</li>;
}

export default { MediaGrid, MediaRail, RailItem };
