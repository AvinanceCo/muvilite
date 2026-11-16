/**
 * Movie-category contents.
 *
 * Purpose: see and edit which films are inside a category.
 * Inputs:  the category id from the route
 * Outputs: an add/remove screen over the category's members
 * Deps:    api/operations, hooks/useListParams, components/data/*
 *
 * Legacy counterpart: `views/categories/content.php`, whose grid called
 * `CategoryController::list` -> `MovieModel::movieList`.
 *
 * This is the screen the backend endpoint added during the admin pass exists
 * for. The obvious substitute — the public `GET /api/categories/:id/movies` —
 * hides deactivated titles, so a film deactivated while in a category would be
 * invisible here and could never be removed. The admin endpoint filters
 * `isDeleted` only, matching what the legacy query did.
 *
 * The legacy screen's `daily` / `weekly` / `monthly` sort options are not
 * offered: they ranked by `visit_movie_tbl`, which MIGRATION.md §7.6 records as
 * a dead table.
 *
 * Adding is a search-and-pick over the movie list rather than a dropdown of
 * every film: the catalog is larger than the API's 100-row cap.
 */
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ops from '../../api/operations.js';
import { useListParams } from '../../hooks/useListParams.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { useResourceList } from '../../hooks/useResource.js';
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js';
import { DataTable } from '../../components/data/DataTable.jsx';
import { Thumb } from '../../components/data/Thumb.jsx';
import { Button, IconButton } from '../../components/ui/Button.jsx';
import { Card, PageHeader, SectionHeader, StatusBadge } from '../../components/ui/Card.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { InlineLoader } from '../../components/ui/Feedback.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { thumbnailUrl } from '../../services/media.js';
import { formatYear, truncate } from '../../services/format.js';
import { isClipCategory } from '../../utils/constants.js';

export function CategoryContent() {
  const { id } = useParams();
  const { canEdit, canDelete } = usePermissions();
  const toast = useToast();
  const queryClient = useQueryClient();

  const list = useListParams({ defaultSort: 'created_date' });

  const query = useQuery({
    queryKey: ['categories', 'content', id, list.params],
    queryFn: () => ops.fetchCategoryMovies(id, list.params),
  });

  const category = query.data?.category;
  useDocumentTitle(category ? `محتوای ${category.nameFa}` : 'محتوای دسته بندی');

  // A category named for clips takes clips only. The API enforces it; the
  // picker below hides films rather than letting the operator pick one and be
  // refused. An ordinary category is free to hold both kinds.
  const clipsOnly = isClipCategory(category);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['categories', 'content', id] });

  const attach = useMutation({
    mutationFn: (movieId) => ops.addMovieCategory({ category: id, item: movieId }),
    onSuccess: invalidate,
  });

  const detach = useMutation({
    mutationFn: (movieId) => ops.removeMovieCategory({ category: id, item: movieId }),
    onSuccess: invalidate,
  });

  const memberIds = new Set((query.data?.items ?? []).map((movie) => movie._id));

  const columns = [
    {
      key: 'poster',
      header: '',
      width: 'w-12',
      render: (row) => <Thumb src={thumbnailUrl(row)} className="h-12 w-8 rounded" />,
    },
    {
      key: 'titleFa',
      header: 'نام ویدئو',
      render: (row) => truncate(row.titleFa, 50),
    },
    {
      key: 'publishYear',
      header: 'سال',
      width: 'w-20',
      align: 'center',
      sortKey: 'publish_date',
      render: (row) => formatYear(row.publishYear) || '—',
    },
    {
      key: 'isActive',
      header: 'وضعیت',
      width: 'w-24',
      align: 'center',
      render: (row) => <StatusBadge isActive={row.isActive} />,
    },
    ...(canDelete('categories')
      ? [
          {
            key: 'actions',
            header: '',
            width: 'w-16',
            align: 'end',
            render: (row) => (
              <IconButton
                label={`حذف ${row.titleFa} از دسته`}
                onClick={async () => {
                  try {
                    await detach.mutateAsync(row._id);
                    toast.success('از دسته‌بندی حذف شد.');
                  } catch (error) {
                    toast.error(error.message);
                  }
                }}
                className="hover:border-signal/50 hover:text-signal"
              >
                ✕
              </IconButton>
            ),
          },
        ]
      : []),
  ];

  return (
    <>
      <PageHeader
        title={category ? `محتوای «${category.nameFa}»` : 'محتوای دسته بندی'}
        description="فیلم‌های غیرفعال هم نمایش داده می‌شوند تا قابل حذف باشند."
        actions={
          <Button variant="ghost" size="sm" to="/categories">
            بازگشت به دسته بندی ها
          </Button>
        }
      />

      {canEdit('categories') ? (
        <Card className="mb-5">
          <SectionHeader
            title={clipsOnly ? 'افزودن کلیپ' : 'افزودن فیلم یا کلیپ'}
            description={
              clipsOnly
                ? 'نام این دسته‌بندی شامل «کلیپ» است، پس فقط کلیپ می‌پذیرد.'
                : undefined
            }
          />
          <MovieSearchPicker
            clipsOnly={clipsOnly}
            excludeIds={memberIds}
            onPick={async (movieId) => {
              try {
                await attach.mutateAsync(movieId);
                toast.success('به دسته‌بندی افزوده شد.');
              } catch (error) {
                toast.error(error.message);
              }
            }}
          />
        </Card>
      ) : null}

      <Card padded={false}>
        <DataTable
          columns={columns}
          rows={query.data?.items ?? []}
          meta={query.data?.meta}
          isLoading={query.isLoading}
          isFetching={query.isFetching}
          error={query.error}
          onRetry={query.refetch}
          itemSort={list.itemSort}
          sortType={list.sortType}
          onSortChange={list.setSort}
          onPageChange={list.setPage}
          onLimitChange={list.setLimit}
          emptyTitle="این دسته بندی خالی است"
          emptyDescription="با جستجوی بالا فیلم اضافه کنید."
        />
      </Card>
    </>
  );
}

/**
 * Search-as-you-type over the movie list.
 *
 * A `<select>` cannot serve this: the API caps a page at 100 rows and the
 * catalog is larger, so a dropdown would silently omit most of it. The legacy
 * panel reached for the same solution (`views/movies/search_casts.php`) but no
 * endpoint backs it — the filtered list endpoint does the job.
 */
export function MovieSearchPicker({ clipsOnly = false, excludeIds = new Set(), onPick }) {
  const [term, setTerm] = useState('');
  const debounced = useDebouncedValue(term, 350);

  const results = useResourceList(
    'movies',
    // Filtered server-side rather than after the fact: the page is ten rows,
    // so dropping films locally would leave a search that mostly returns
    // nothing visible.
    { titleFa: debounced, limit: 10, item_sort: 'created_date', ...(clipsOnly ? { isClip: true } : {}) },
    { enabled: debounced.trim().length > 0 },
  );

  return (
    <div>
      <Input
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        placeholder={clipsOnly ? 'نام کلیپ را بنویسید…' : 'نام فیلم یا کلیپ را بنویسید…'}
        aria-label="جستجوی ویدئو"
      />

      {debounced.trim().length === 0 ? null : results.isLoading ? (
        <div className="mt-2">
          <InlineLoader label="در حال جستجو" />
        </div>
      ) : results.items.length === 0 ? (
        <p className="mt-2 text-xs text-muted">
          {clipsOnly ? 'کلیپی با این نام پیدا نشد.' : 'ویدئویی با این نام پیدا نشد.'}
        </p>
      ) : (
        <ul className="mt-2 space-y-1">
          {results.items.map((movie) => {
            const already = excludeIds.has(movie._id);
            return (
              <li
                key={movie._id}
                className="flex items-center justify-between gap-3 rounded-lg border border-line bg-panel-hi px-3 py-2"
              >
                <span className="min-w-0 truncate text-xs text-paper">
                  {movie.titleFa}
                  {movie.publishYear ? (
                    <span className="ms-2 font-mono text-[0.7rem] text-muted">
                      {formatYear(movie.publishYear)}
                    </span>
                  ) : null}
                </span>
                <Button
                  size="sm"
                  variant={already ? 'ghost' : 'subtle'}
                  disabled={already}
                  onClick={() => onPick(movie._id)}
                >
                  {already ? 'در دسته هست' : 'افزودن'}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default CategoryContent;
