/**
 * Report screen scaffold.
 *
 * Purpose: the shared shell for the six read-only history grids — a date range,
 *          extra filters, and a paginated table.
 * Inputs:  a title, a fetcher, columns, and optional filter controls
 * Outputs: a full report screen
 * Deps:    @tanstack/react-query, hooks/useListParams, components/data/DataTable
 *
 * Every report is the same screen with different columns, so they share this
 * rather than repeating six near-identical files. What differs per report — the
 * sort whitelist and which filters exist — is passed in, because those genuinely
 * differ in the API and a shared default would be wrong for most of them.
 *
 * `from`/`to` map to an inclusive `createdAt` range on every one of these
 * endpoints, so the date range lives here.
 *
 * These routes carry no validation middleware: an unknown filter is ignored
 * rather than rejected, but an unknown `item_sort` is still a 400. Only sort
 * keys the endpoint declares are made clickable.
 */
import { useQuery } from '@tanstack/react-query';
import { useListParams } from '../../hooks/useListParams.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { DataTable } from '../../components/data/DataTable.jsx';
import { Card, PageHeader } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Input } from '../../components/ui/Input.jsx';

/**
 * @param {object} props
 * @param {string} props.title
 * @param {string} [props.description]
 * @param {string} props.queryKey            cache key root, e.g. 'watch-history'
 * @param {(params: object) => Promise<{items: object[], meta: object}>} props.fetcher
 * @param {object[]} props.columns
 * @param {string} [props.defaultSort='created_date']
 * @param {string[]} [props.textFilters]     filter keys to debounce
 * @param {import('react').ReactNode} [props.filters] extra controls above the grid
 * @param {(list: object) => import('react').ReactNode} [props.renderFilters]
 */
export function ReportScreen({
  title,
  description,
  queryKey,
  fetcher,
  columns,
  defaultSort = 'created_date',
  textFilters = [],
  renderFilters,
  emptyTitle = 'رکوردی در این بازه یافت نشد',
}) {
  useDocumentTitle(title);

  const list = useListParams({ defaultSort, textFilters });

  const query = useQuery({
    queryKey: [queryKey, list.params],
    queryFn: () => fetcher(list.params),
  });

  return (
    <>
      <PageHeader
        title={title}
        description={description}
        actions={
          list.hasFilters ? (
            <Button size="sm" variant="ghost" onClick={list.reset}>
              حذف فیلترها
            </Button>
          ) : null
        }
      />

      <Card className="mb-5">
        <div className="flex flex-wrap items-end gap-3">
          <DateRangeFilter list={list} />
          {renderFilters?.(list)}
        </div>
      </Card>

      <Card padded={false}>
        <DataTable
          columns={columns}
          rows={query.data?.items ?? []}
          meta={query.data?.meta}
          isLoading={query.isLoading}
          isFetching={query.isFetching}
          error={query.error}
          onRetry={query.refetch}
          filters={list.filters}
          onFilterChange={list.setFilter}
          itemSort={list.itemSort}
          sortType={list.sortType}
          onSortChange={list.setSort}
          onPageChange={list.setPage}
          onLimitChange={list.setLimit}
          emptyTitle={emptyTitle}
        />
      </Card>
    </>
  );
}

/**
 * The inclusive `createdAt` range every report accepts.
 *
 * Native date inputs, so the value on the wire is always ISO regardless of the
 * operator's locale. The label says «شمسی» is not used here because the control
 * shows whatever calendar the browser is configured for — being explicit beats
 * a mismatch the operator cannot see.
 */
function DateRangeFilter({ list }) {
  return (
    <>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-bold text-muted">از تاریخ</span>
        <Input
          type="date"
          dir="ltr"
          value={list.filters.from ?? ''}
          onChange={(event) => list.setFilter('from', event.target.value)}
          className="w-40"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-bold text-muted">تا تاریخ</span>
        <Input
          type="date"
          dir="ltr"
          value={list.filters.to ?? ''}
          onChange={(event) => list.setFilter('to', event.target.value)}
          className="w-40"
        />
      </label>
    </>
  );
}

/** A labelled control for the filter row, so reports lay out consistently. */
export function FilterControl({ label, children, className = '' }) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-xs font-bold text-muted">{label}</span>
      {children}
    </label>
  );
}

export default ReportScreen;
