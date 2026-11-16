/**
 * Music-category contents.
 *
 * Purpose: see and edit which albums are inside a music category.
 * Inputs:  the category id from the route
 * Outputs: an add/remove screen over the category's members
 * Deps:    api/operations, hooks/useListParams, components/data/*
 *
 * Legacy counterpart: `views/music-categories/content.php`. The same shape as
 * the movie version — see CategoryContent.jsx for why the admin endpoint is
 * used rather than the public one.
 *
 * ONE REAL DIFFERENCE: the sort whitelist. Music categories accept only
 * `id`, `publish_date`, `visit_count` (plus the universal `created_date` /
 * `modified_date`), and default to `id` — where movie categories default to
 * `created_date`. The two whitelists genuinely differ in the API and were NOT
 * unified during the migration (backend/MIGRATION.md §6), so the sortable
 * columns here are deliberately not the same set.
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
import { mediaUrl } from '../../services/media.js';
import { formatYear, truncate } from '../../services/format.js';

export function MusicCategoryContent() {
  const { id } = useParams();
  const { canEdit, canDelete } = usePermissions();
  const toast = useToast();
  const queryClient = useQueryClient();

  // Defaults to `id`, matching this endpoint's whitelist.
  const list = useListParams({ defaultSort: 'id' });

  const query = useQuery({
    queryKey: ['music-categories', 'content', id, list.params],
    queryFn: () => ops.fetchMusicCategoryItems(id, list.params),
  });

  const category = query.data?.category;
  useDocumentTitle(category ? `محتوای ${category.nameFa}` : 'محتوای دسته بندی موسیقی');

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['music-categories', 'content', id] });

  const attach = useMutation({
    mutationFn: (musicId) => ops.addMusicCategory({ category: id, item: musicId }),
    onSuccess: invalidate,
  });

  const detach = useMutation({
    mutationFn: (musicId) => ops.removeMusicCategory({ category: id, item: musicId }),
    onSuccess: invalidate,
  });

  const memberIds = new Set((query.data?.items ?? []).map((music) => music._id));

  const columns = [
    {
      key: 'cover',
      header: '',
      width: 'w-12',
      render: (row) => (
        <Thumb src={mediaUrl(row.coverPath)} className="size-10 rounded" fallback="♪" />
      ),
    },
    {
      key: 'fullnameFa',
      header: 'هنرمند',
      render: (row) => truncate(row.fullnameFa, 30),
    },
    {
      key: 'albumFa',
      header: 'آلبوم',
      render: (row) => truncate(row.albumFa, 30) || '—',
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
                label={`حذف ${row.fullnameFa} از دسته`}
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
        title={category ? `محتوای «${category.nameFa}»` : 'محتوای دسته بندی موسیقی'}
        description="آلبوم‌های غیرفعال هم نمایش داده می‌شوند تا قابل حذف باشند."
        actions={
          <Button variant="ghost" size="sm" to="/music-categories">
            بازگشت به دسته بندی ها
          </Button>
        }
      />

      {canEdit('categories') ? (
        <Card className="mb-5">
          <SectionHeader title="افزودن آلبوم" />
          <MusicSearchPicker
            excludeIds={memberIds}
            onPick={async (musicId) => {
              try {
                await attach.mutateAsync(musicId);
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
          emptyDescription="با جستجوی بالا آلبوم اضافه کنید."
        />
      </Card>
    </>
  );
}

/** Search-as-you-type over the music list. See MovieSearchPicker for why. */
function MusicSearchPicker({ excludeIds = new Set(), onPick }) {
  const [term, setTerm] = useState('');
  const debounced = useDebouncedValue(term, 350);

  const results = useResourceList(
    'musics',
    { fullnameFa: debounced, limit: 10, item_sort: 'created_date' },
    { enabled: debounced.trim().length > 0 },
  );

  return (
    <div>
      <Input
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        placeholder="نام هنرمند را بنویسید…"
        aria-label="جستجوی آلبوم"
      />

      {debounced.trim().length === 0 ? null : results.isLoading ? (
        <div className="mt-2">
          <InlineLoader label="در حال جستجو" />
        </div>
      ) : results.items.length === 0 ? (
        <p className="mt-2 text-xs text-muted">آلبومی با این نام پیدا نشد.</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {results.items.map((music) => {
            const already = excludeIds.has(music._id);
            return (
              <li
                key={music._id}
                className="flex items-center justify-between gap-3 rounded-lg border border-line bg-panel-hi px-3 py-2"
              >
                <span className="min-w-0 truncate text-xs text-paper">
                  {music.fullnameFa}
                  {music.albumFa ? <span className="text-muted"> — {music.albumFa}</span> : null}
                </span>
                <Button
                  size="sm"
                  variant={already ? 'ghost' : 'subtle'}
                  disabled={already}
                  onClick={() => onPick(music._id)}
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

export default MusicCategoryContent;
