/**
 * Pagination controls.
 *
 * Purpose: move between pages of a server-paginated list and change the page
 *          size.
 * Inputs:  the API's `meta` block, plus change handlers
 * Outputs: a control bar
 * Deps:    services/format, utils/constants
 *
 * Driven entirely by `meta` — `{ page, limit, total, totalPages }` — because
 * the server owns the paging. The legacy grids rendered no page controls at
 * all: `Movie::totalItemsMovieList()` existed but was never called, so no total
 * was available to build them from (backend/MIGRATION.md §7.6).
 *
 * The page-size options stop at 100 because that is the API's hard cap
 * (`MAXIMUM_PAGINATION`); a larger value is clamped server-side, so offering it
 * would show a number that does not match what arrives.
 */
import { toPersianNumber } from '../../services/format.js';
import { PAGE_SIZE_OPTIONS } from '../../utils/constants.js';
import { Button } from './Button.jsx';

/**
 * @param {object} props
 * @param {{page: number, limit: number, total: number, totalPages: number}|null} props.meta
 * @param {(page: number) => void} props.onPageChange
 * @param {(limit: number) => void} [props.onLimitChange]
 */
export function Pagination({ meta, onPageChange, onLimitChange }) {
  if (!meta || meta.total === 0) return null;

  const { page, limit, total, totalPages } = meta;
  const first = (page - 1) * limit + 1;
  const last = Math.min(page * limit, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
      <p className="text-xs text-muted">
        نمایش {toPersianNumber(first)} تا {toPersianNumber(last)} از {toPersianNumber(total)} مورد
      </p>

      <div className="flex items-center gap-2">
        {onLimitChange ? (
          <label className="flex items-center gap-2 text-xs text-muted">
            <span>در هر صفحه</span>
            <select
              value={limit}
              onChange={(event) => onLimitChange(Number(event.target.value))}
              className="h-8 cursor-pointer rounded-md border border-line bg-panel px-2 text-xs text-paper"
            >
              {PAGE_SIZE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {toPersianNumber(option)}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <div className="flex items-center gap-1">
          {/* RTL: "previous" points right. The chevrons follow reading order,
              not the Latin convention. */}
          <Button
            size="sm"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            aria-label="صفحه قبل"
          >
            ›
          </Button>

          <span className="px-2 font-mono text-xs text-muted">
            {toPersianNumber(page)} / {toPersianNumber(totalPages)}
          </span>

          <Button
            size="sm"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            aria-label="صفحه بعد"
          >
            ‹
          </Button>
        </div>
      </div>
    </div>
  );
}

export default Pagination;
