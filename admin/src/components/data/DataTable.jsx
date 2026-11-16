/**
 * Data grid.
 *
 * Purpose: the panel's single table surface — sortable headers, per-column
 *          filters, row actions, and the three empty states — driven by a
 *          column descriptor.
 * Inputs:  columns, rows, the API's `meta`, and the list-params handlers
 * Outputs: a table inside its own horizontal scroll container
 * Deps:    components/ui/*, services/format
 *
 * Replaces the legacy DataTables grid, which was configured separately on every
 * screen. It reproduces what those grids actually did — a filter input under
 * each column heading, click-to-sort, a status toggle in the row, an actions
 * column — but pages against the server through `meta` rather than holding the
 * whole table client-side.
 *
 * A column is:
 *   {
 *     key:      unique; also the React key
 *     header:   column title
 *     render:   (row) => node        — defaults to row[key]
 *     sortKey:  the API `item_sort` value, when sortable
 *     filter:   { key, type: 'text'|'select', options?, placeholder? }
 *     width:    a Tailwind width class
 *     align:    'start' | 'center' | 'end'
 *     mono:     render in the mono face — ids, counts, IPs
 *   }
 *
 * The table scrolls inside its own container: these grids are wide and the page
 * body must never scroll horizontally.
 */
import { Input, Select } from '../ui/Input.jsx';
import { EmptyState, ErrorState, Loader } from '../ui/Feedback.jsx';
import { Pagination } from '../ui/Pagination.jsx';

const ALIGN = {
  start: 'text-start',
  center: 'text-center',
  end: 'text-end',
};

/**
 * @param {object} props
 * @param {object[]} props.columns
 * @param {object[]} props.rows
 * @param {(row: object) => string} [props.rowKey] defaults to `row._id`
 * @param {object|null} props.meta
 * @param {boolean} props.isLoading  first load — replaces the table body
 * @param {boolean} [props.isFetching] a refetch — dims the body instead
 * @param {object|null} [props.error]
 * @param {object} [props.filters]   current filter values, by filter key
 * @param {(key: string, value: string) => void} [props.onFilterChange]
 * @param {string} [props.itemSort]
 * @param {'ASC'|'DESC'} [props.sortType]
 * @param {(sortKey: string) => void} [props.onSortChange]
 * @param {import('react').ReactNode} [props.emptyAction]
 */
export function DataTable({
  columns,
  rows = [],
  rowKey = (row) => row._id,
  meta,
  isLoading = false,
  isFetching = false,
  error = null,
  filters = {},
  onFilterChange,
  itemSort,
  sortType,
  onSortChange,
  onPageChange,
  onLimitChange,
  onRetry,
  emptyTitle,
  emptyDescription,
  emptyAction,
}) {
  const hasFilterRow = columns.some((column) => column.filter);

  if (error) {
    return <ErrorState error={error} onRetry={onRetry} />;
  }

  return (
    <div>
      <div className="thin-scroll overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line">
              {columns.map((column) => (
                <HeaderCell
                  key={column.key}
                  column={column}
                  itemSort={itemSort}
                  sortType={sortType}
                  onSortChange={onSortChange}
                />
              ))}
            </tr>

            {hasFilterRow && onFilterChange ? (
              <tr className="border-b border-line">
                {columns.map((column) => (
                  <td key={column.key} className="px-3 pb-3 align-top">
                    <FilterControl
                      filter={column.filter}
                      value={filters[column.filter?.key] ?? ''}
                      onChange={onFilterChange}
                    />
                  </td>
                ))}
              </tr>
            ) : null}
          </thead>

          <tbody className={isFetching && !isLoading ? 'opacity-50 transition-opacity' : ''}>
            {isLoading ? (
              <tr>
                <td colSpan={columns.length}>
                  <Loader />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>
                  <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  className="border-b border-line/60 transition-colors last:border-0 hover:bg-panel-hi"
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={
                        'px-3 py-2.5 align-middle ' +
                        `${ALIGN[column.align] ?? ALIGN.start} ` +
                        `${column.mono ? 'font-mono text-xs' : ''}`
                      }
                      dir={column.mono ? 'ltr' : undefined}
                    >
                      {column.render ? column.render(row) : (row[column.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination meta={meta} onPageChange={onPageChange} onLimitChange={onLimitChange} />
    </div>
  );
}

/** A heading, sortable when the column declares a `sortKey`. */
function HeaderCell({ column, itemSort, sortType, onSortChange }) {
  const sortable = Boolean(column.sortKey && onSortChange);
  const active = sortable && itemSort === column.sortKey;

  return (
    <th
      scope="col"
      aria-sort={active ? (sortType === 'ASC' ? 'ascending' : 'descending') : undefined}
      className={
        'px-3 py-2.5 text-xs font-bold text-muted ' +
        `${ALIGN[column.align] ?? ALIGN.start} ${column.width ?? ''}`
      }
    >
      {sortable ? (
        <button
          type="button"
          onClick={() => onSortChange(column.sortKey)}
          className={`inline-flex items-center gap-1 transition-colors hover:text-azure ${active ? 'text-azure' : ''}`}
        >
          {column.header}
          <span aria-hidden="true" className="text-[0.65rem] opacity-70">
            {active ? (sortType === 'ASC' ? '▲' : '▼') : '↕'}
          </span>
        </button>
      ) : (
        column.header
      )}
    </th>
  );
}

/** The per-column filter the legacy grids put under each heading. */
function FilterControl({ filter, value, onChange }) {
  if (!filter) return null;

  if (filter.type === 'select') {
    return (
      <Select
        value={value}
        onChange={(event) => onChange(filter.key, event.target.value)}
        options={filter.options ?? []}
        placeholder={filter.placeholder ?? 'همه'}
        className="h-8 text-xs"
        aria-label={filter.label ?? filter.key}
      />
    );
  }

  return (
    <Input
      value={value}
      onChange={(event) => onChange(filter.key, event.target.value)}
      placeholder={filter.placeholder ?? 'جستجو'}
      className="h-8 text-xs"
      aria-label={filter.label ?? filter.key}
    />
  );
}

export default DataTable;
