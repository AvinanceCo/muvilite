/**
 * Pagination.
 *
 * Purpose: page through a list endpoint using the `meta` block the API returns.
 * Inputs:  meta { page, limit, total, totalPages }, onChange(page)
 * Outputs: a page control, or nothing when there is only one page
 * Deps:    ui/Button, services/format
 *
 * The legacy site rendered NO pagination controls at all — its count query
 * (`Movie::totalItemsMovieList`) was written but never called, so listings
 * silently truncated. The API returns the count as `meta`, which is what makes
 * this possible (MIGRATION.md §7.6).
 */
import Button from './Button.jsx';
import { toPersianNumber } from '../../services/format.js';

/** Page numbers around the current page, with gaps marked as null. */
function pageWindow(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);

  const pages = new Set([1, total, current, current - 1, current + 1]);
  const sorted = [...pages].filter((page) => page >= 1 && page <= total).sort((a, b) => a - b);

  return sorted.flatMap((page, index) => {
    const previous = sorted[index - 1];
    return previous && page - previous > 1 ? [null, page] : [page];
  });
}

/**
 * @param {{meta: {page: number, totalPages: number, total: number}, onChange: (page: number) => void}} props
 */
export function Pagination({ meta, onChange }) {
  if (!meta || meta.totalPages <= 1) return null;

  const { page, totalPages } = meta;

  return (
    <nav className="flex flex-wrap items-center justify-center gap-1.5 py-8" aria-label="صفحه‌بندی">
      <Button
        size="sm"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        aria-label="صفحه قبل"
      >
        قبلی
      </Button>

      {pageWindow(page, totalPages).map((entry, index) =>
        entry === null ? (
          <span key={`gap-${index}`} className="px-1 text-muted" aria-hidden="true">
            …
          </span>
        ) : (
          <Button
            key={entry}
            size="sm"
            variant={entry === page ? 'primary' : 'subtle'}
            onClick={() => onChange(entry)}
            aria-current={entry === page ? 'page' : undefined}
            aria-label={`صفحه ${entry}`}
            className="min-w-9 px-2"
          >
            {toPersianNumber(entry)}
          </Button>
        ),
      )}

      <Button
        size="sm"
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        aria-label="صفحه بعد"
      >
        بعدی
      </Button>
    </nav>
  );
}

export default Pagination;
