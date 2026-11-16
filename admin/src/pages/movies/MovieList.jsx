/**
 * Movie list.
 *
 * Purpose: browse, filter, sort and act on the film catalog.
 * Inputs:  none (filters come from the URL)
 * Outputs: the movies grid
 * Deps:    hooks/useResource, hooks/useListParams, components/data/*
 *
 * Legacy counterpart: `views/movies/index.php`, a server-side DataTables grid.
 * Its filters are reproduced where the API supports them: title (fa and en),
 * company, publish year and status. Two are NOT:
 *
 *   - **the id range** (`from_id_filter` / `to_id_filter`). Ids were auto
 *     increment integers, so a range meant "recently added". They are ObjectIds
 *     now and a range over them is meaningless; sorting by creation date, which
 *     this grid does by default, answers the same question properly.
 *   - **the "additional" filters** (no poster, no Persian description, no
 *     English description, for children). The API has no query parameter for
 *     any of them and inventing client-side filtering over a single page would
 *     be a filter that silently ignores the other pages. `isKids` is visible in
 *     the row, and the poster column shows at a glance which titles lack art.
 *
 * The category multi-select filter is also absent, for the same reason: the
 * list endpoint takes no category parameter. Browsing by category is what the
 * category-contents screen is for, and it is one click away from
 * /categories.
 */
import { useState } from 'react';
import { useResourceList, useResourceMutations, useLookupOptions } from '../../hooks/useResource.js';
import { useListParams } from '../../hooks/useListParams.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { DataTable } from '../../components/data/DataTable.jsx';
import { Thumb } from '../../components/data/Thumb.jsx';
import { ListToolbar, RowActions, StatusToggle } from '../../components/data/RowControls.jsx';
import { ConfirmDialog } from '../../components/ui/Modal.jsx';
import { Badge, Card, PageHeader } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { thumbnailUrl } from '../../services/media.js';
import { formatRank, formatYear, toPersianNumber, truncate } from '../../services/format.js';
import { exportMovies, EXPORT_FILENAMES } from '../../api/operations.js';
import { saveBlob } from '../../services/download.js';

const STATUS_OPTIONS = [
  { value: 'true', label: 'فعال' },
  { value: 'false', label: 'غیرفعال' },
];

/**
 * Clips and films share this collection and this grid — the panel manages one
 * catalog. The filter is how an operator looks at one kind, and the grid opens
 * on both.
 */
const KIND_OPTIONS = [
  { value: 'false', label: 'فیلم' },
  { value: 'true', label: 'کلیپ' },
];

export function MovieList() {
  useDocumentTitle('فیلم ها');

  const { canEdit, canDelete } = usePermissions();
  const toast = useToast();
  const [pendingDelete, setPendingDelete] = useState(null);
  const [exporting, setExporting] = useState(false);

  const list = useListParams({
    defaultSort: 'created_date',
    textFilters: ['titleFa', 'titleEn', 'company', 'publishYear'],
  });

  const query = useResourceList('movies', list.params);
  const { setStatus, remove } = useResourceMutations('movies');
  const { options: genreOptions } = useLookupOptions('genres');

  const showRowControls = canEdit('movies') || canDelete('movies');

  const columns = [
    {
      key: 'poster',
      header: '',
      width: 'w-14',
      render: (row) => <Thumb src={thumbnailUrl(row)} className="h-14 w-9 rounded" />,
    },
    {
      key: 'titleFa',
      header: 'نام ویدئو',
      sortKey: 'title_fa',
      filter: { key: 'titleFa', type: 'text' },
      render: (row) => (
        <div className="min-w-40">
          <p className="text-paper">{truncate(row.titleFa, 40)}</p>
          {row.titleEn ? (
            <p dir="ltr" className="text-start font-mono text-[0.7rem] text-muted">
              {truncate(row.titleEn, 40)}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      key: 'isClip',
      header: 'نوع',
      width: 'w-24',
      align: 'center',
      filter: { key: 'isClip', type: 'select', options: KIND_OPTIONS, placeholder: 'هر دو' },
      render: (row) =>
        row.isClip ? <Badge tone="accent">کلیپ</Badge> : <span className="text-muted">فیلم</span>,
    },
    {
      key: 'genre1',
      header: 'ژانر',
      width: 'w-32',
      filter: { key: 'genre1', type: 'select', options: genreOptions },
      render: (row) =>
        row.genre1?.nameFa ? (
          <Badge tone="accent">{row.genre1.nameFa}</Badge>
        ) : (
          // A movie without a primary genre is invisible to the passenger site:
          // the public detail query INNER JOINed genres on genre_1. Load-bearing,
          // and preserved deliberately (MIGRATION.md §6), so it is flagged here.
          <Badge tone="danger" title="بدون ژانر اصلی در سایت اصلی نمایش داده نمی‌شود">
            بدون ژانر
          </Badge>
        ),
    },
    {
      key: 'publishYear',
      header: 'سال',
      width: 'w-20',
      align: 'center',
      sortKey: 'publish_date',
      filter: { key: 'publishYear', type: 'text', placeholder: '۲۰۲۰' },
      render: (row) => formatYear(row.publishYear) || '—',
    },
    {
      key: 'imdbRank',
      header: 'IMDb',
      width: 'w-20',
      align: 'center',
      sortKey: 'imdb_rank',
      render: (row) => formatRank(row.imdbRank) || '—',
    },
    {
      key: 'visitCount',
      header: 'بازدید',
      width: 'w-24',
      align: 'center',
      sortKey: 'visit_count',
      render: (row) => toPersianNumber(row.visitCount ?? 0),
    },
    {
      key: 'company',
      header: 'تولید کننده',
      width: 'w-36',
      filter: { key: 'company', type: 'text' },
      render: (row) => truncate(row.company, 24) || '—',
    },

    ...(showRowControls
      ? [
          {
            key: 'isActive',
            header: 'وضعیت',
            width: 'w-24',
            align: 'center',
            filter: { key: 'isActive', type: 'select', options: STATUS_OPTIONS },
            render: (row) => (
              <StatusToggle
                row={row}
                page="movies"
                label={row.titleFa}
                onToggle={(id, isActive) => setStatus.mutateAsync({ id, isActive })}
              />
            ),
          },
          {
            key: 'actions',
            header: 'عملیات',
            width: 'w-24',
            align: 'end',
            render: (row) => (
              <RowActions
                page="movies"
                editTo={`/movies/${row._id}`}
                onDelete={() => setPendingDelete(row)}
              />
            ),
          },
        ]
      : []),
  ];

  const handleDelete = async () => {
    try {
      await remove.mutateAsync(pendingDelete._id);
      toast.success('فیلم حذف شد.');
      setPendingDelete(null);
    } catch (error) {
      toast.error(error.message);
    }
  };

  /** Exports what the current filters select, not just the visible page. */
  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await exportMovies({
        titleFa: list.filters.titleFa,
        company: list.filters.company,
        isActive: list.filters.isActive,
      });
      saveBlob(blob, EXPORT_FILENAMES.movies);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <PageHeader
        title="فیلم ها"
        actions={
          <ListToolbar
            page="movies"
            addTo="/movies/new"
            addLabel="افزودن ویدئو"
            hasFilters={list.hasFilters}
            onClearFilters={list.reset}
          >
            <Button size="sm" onClick={handleExport} loading={exporting}>
              خروجی اکسل
            </Button>
          </ListToolbar>
        }
      />

      <Card padded={false}>
        <DataTable
          columns={columns}
          rows={query.items}
          meta={query.meta}
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
          emptyTitle={list.hasFilters ? 'با این فیلترها فیلمی یافت نشد' : 'هنوز فیلمی ثبت نشده است'}
        />
      </Card>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={handleDelete}
        loading={remove.isPending}
        title="حذف فیلم"
        itemLabel={pendingDelete?.titleFa}
      />
    </>
  );
}

export default MovieList;
