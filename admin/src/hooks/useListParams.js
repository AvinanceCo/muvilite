/**
 * List query state.
 *
 * Purpose: own the page, page size, sort and filters of a data grid, and keep
 *          them in the URL.
 * Inputs:  the resource's default sort
 * Outputs: `{ params, filters, setFilter, setSort, setPage, setLimit, reset }`
 * Deps:    react-router-dom, hooks/useDebouncedValue, utils/constants
 *
 * State lives in the query string rather than in component state so that a
 * filtered grid can be linked to, bookmarked, and — the case that actually
 * comes up — survives the back button after editing a row. The legacy grids
 * held all of this in DataTables' memory and lost it on every navigation.
 *
 * Text filters are debounced; everything else applies immediately. Any change
 * other than the page itself resets to page 1 — staying on page 7 while
 * narrowing a filter to three results shows an empty grid over real data, which
 * reads as a bug.
 */
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDebouncedValue } from './useDebouncedValue.js';
import { PAGE_SIZE } from '../utils/constants.js';

/** Query-string keys that are not filters. */
const RESERVED = new Set(['page', 'limit', 'item_sort', 'sort_type']);

/**
 * @param {object} [options]
 * @param {string} [options.defaultSort]      an `item_sort` key
 * @param {'ASC'|'DESC'} [options.defaultDirection='DESC']
 * @param {string[]} [options.textFilters]    filter keys to debounce
 */
export function useListParams({
  defaultSort,
  defaultDirection = 'DESC',
  textFilters = [],
} = {}) {
  const [searchParams, setSearchParams] = useSearchParams();

  const page = Number(searchParams.get('page')) || 1;
  const limit = Number(searchParams.get('limit')) || PAGE_SIZE;
  const itemSort = searchParams.get('item_sort') ?? defaultSort;
  const sortType = searchParams.get('sort_type') ?? defaultDirection;

  /** Everything in the URL that is not a reserved key. */
  const filters = useMemo(() => {
    const collected = {};
    for (const [key, value] of searchParams.entries()) {
      if (!RESERVED.has(key) && value !== '') collected[key] = value;
    }
    return collected;
  }, [searchParams]);

  // Serialized so the debounce compares by value, not by object identity — a
  // new object every render would keep the timer permanently reset.
  const filterKey = JSON.stringify(filters);
  const debouncedFilterKey = useDebouncedValue(filterKey, 350);

  /**
   * The filters as the request should see them: text filters lag behind the
   * inputs, while selects and toggles are current.
   */
  const requestFilters = useMemo(() => {
    if (textFilters.length === 0) return filters;

    const debounced = JSON.parse(debouncedFilterKey);
    const merged = { ...filters };

    for (const key of textFilters) {
      if (debounced[key] === undefined) {
        delete merged[key];
      } else {
        merged[key] = debounced[key];
      }
    }

    return merged;
    // `filters` is derived from `filterKey`, which is in the dependency list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, debouncedFilterKey, textFilters.join(',')]);

  /** What goes to the API. */
  const params = useMemo(
    () => ({
      page,
      limit,
      ...(itemSort ? { item_sort: itemSort, sort_type: sortType } : {}),
      ...requestFilters,
    }),
    [page, limit, itemSort, sortType, requestFilters],
  );

  /** Writes keys into the query string, dropping any set to an empty value. */
  const patch = useCallback(
    (changes, { resetPage = true } = {}) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);

          for (const [key, value] of Object.entries(changes)) {
            if (value === '' || value === null || value === undefined) {
              next.delete(key);
            } else {
              next.set(key, String(value));
            }
          }

          if (resetPage && !('page' in changes)) {
            next.delete('page');
          }

          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const setFilter = useCallback((key, value) => patch({ [key]: value }), [patch]);

  const setFilters = useCallback((changes) => patch(changes), [patch]);

  const setPage = useCallback(
    (nextPage) => patch({ page: nextPage <= 1 ? '' : nextPage }, { resetPage: false }),
    [patch],
  );

  const setLimit = useCallback(
    (nextLimit) => patch({ limit: nextLimit === PAGE_SIZE ? '' : nextLimit }),
    [patch],
  );

  /**
   * Clicking a column header. The same column flips direction; a new column
   * starts descending, which is what every grid in the legacy panel defaulted
   * to and what the API defaults to as well.
   */
  const setSort = useCallback(
    (key) => {
      const flipped = itemSort === key && sortType === 'DESC' ? 'ASC' : 'DESC';
      patch({ item_sort: key, sort_type: flipped });
    },
    [itemSort, sortType, patch],
  );

  const reset = useCallback(() => setSearchParams({}, { replace: true }), [setSearchParams]);

  /** True when any filter is applied — drives the "clear filters" button. */
  const hasFilters = Object.keys(filters).length > 0;

  return {
    params,
    filters,
    page,
    limit,
    itemSort,
    sortType,
    hasFilters,
    setFilter,
    setFilters,
    setPage,
    setLimit,
    setSort,
    reset,
  };
}

export default useListParams;
