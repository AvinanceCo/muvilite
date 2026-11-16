/**
 * Pre-roll advertisement list.
 *
 * Purpose: browse the creatives that play before a movie.
 * Inputs:  none (filters come from the URL)
 * Outputs: the creatives grid
 * Deps:    hooks/useResource, hooks/useListParams, components/data/*
 *
 * NEW SCREEN — the legacy panel had none. Pre-roll ads lived as five
 * hand-written VAST files in `assets/ads/` with their MP4s beside them, and
 * `player.php` drew one at random. The only ad-related screen was
 * `views/ads-history/index.php`, a read-only report of what had played, which
 * survives as /ads-history.
 *
 * The two columns that matter most on this grid are the ones an operator cannot
 * see anywhere else: whether a creative has a FILE (without one it is never
 * served) and its WEIGHT relative to the others, since that is what decides how
 * often it plays.
 */
import { useState } from 'react';
import { useResourceList, useResourceMutations } from '../../hooks/useResource.js';
import { useListParams } from '../../hooks/useListParams.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { DataTable } from '../../components/data/DataTable.jsx';
import { ListToolbar, RowActions, StatusToggle } from '../../components/data/RowControls.jsx';
import { ConfirmDialog } from '../../components/ui/Modal.jsx';
import { Badge, Card, PageHeader } from '../../components/ui/Card.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { formatTimecode, toPersianNumber, truncate } from '../../services/format.js';

export function VideoAdList() {
  useDocumentTitle('تبلیغات پیش از پخش');

  const { canEdit, canDelete } = usePermissions();
  const toast = useToast();
  const [pendingDelete, setPendingDelete] = useState(null);

  const list = useListParams({ defaultSort: 'created_date', textFilters: ['titleFa'] });
  const query = useResourceList('video-ads', list.params);
  const { setStatus, remove } = useResourceMutations('video-ads');

  const showRowControls = canEdit('ads') || canDelete('ads');

  // What the passenger actually sees: an active creative with a file. Shown as
  // a running count so an operator can tell at a glance whether the break is
  // live, rather than deducing it from two separate columns per row.
  const playable = query.items.filter((row) => row.isActive && row.videoPath).length;

  const columns = [
    {
      key: 'titleFa',
      header: 'عنوان',
      sortKey: 'title_fa',
      filter: { key: 'titleFa', type: 'text' },
      render: (row) => (
        <div className="min-w-32">
          <p className="text-paper">{truncate(row.titleFa, 40)}</p>
          {row.titleEn ? (
            <p dir="ltr" className="text-[0.7rem] text-muted">
              {truncate(row.titleEn, 40)}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      key: 'videoPath',
      header: 'فایل',
      width: 'w-24',
      align: 'center',
      render: (row) =>
        row.videoPath ? (
          <Badge tone="active">دارد</Badge>
        ) : (
          // Not merely cosmetic: a creative with no file is skipped by the
          // server's selection, so this row is inert until one is uploaded.
          <Badge tone="danger">ندارد</Badge>
        ),
    },
    {
      key: 'durationSecond',
      header: 'مدت',
      width: 'w-20',
      align: 'center',
      mono: true,
      sortKey: 'duration',
      render: (row) => formatTimecode(row.durationSecond),
    },
    {
      key: 'skipOffsetSecond',
      header: 'رد شدن پس از',
      width: 'w-28',
      align: 'center',
      render: (row) => `${toPersianNumber(row.skipOffsetSecond ?? 0)} ثانیه`,
    },
    {
      key: 'weight',
      header: 'وزن',
      width: 'w-20',
      align: 'center',
      sortKey: 'weight',
      render: (row) =>
        row.weight > 0 ? (
          toPersianNumber(row.weight)
        ) : (
          <span title="با وزن صفر هرگز انتخاب نمی‌شود" className="text-muted/60">
            ۰
          </span>
        ),
    },

    ...(showRowControls
      ? [
          {
            key: 'isActive',
            header: 'وضعیت',
            width: 'w-24',
            align: 'center',
            render: (row) => (
              <StatusToggle
                row={row}
                page="ads"
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
                page="ads"
                editTo={`/video-ads/${row._id}`}
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
      toast.success('تبلیغ حذف شد.');
      setPendingDelete(null);
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <>
      <PageHeader
        title="تبلیغات پیش از پخش"
        description={
          playable > 0
            ? `${toPersianNumber(playable)} تبلیغ آمادهٔ پخش است. پیش از هر فیلم یکی از آن‌ها به‌تصادف و به‌نسبت وزنش انتخاب می‌شود.`
            : 'هیچ تبلیغ آمادهٔ پخشی وجود ندارد؛ فیلم‌ها بدون وقفهٔ تبلیغاتی پخش می‌شوند.'
        }
        actions={
          <ListToolbar
            page="ads"
            addTo="/video-ads/new"
            addLabel="افزودن تبلیغ"
            hasFilters={list.hasFilters}
            onClearFilters={list.reset}
          />
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
          emptyTitle="تبلیغی ثبت نشده است"
        />
      </Card>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={handleDelete}
        loading={remove.isPending}
        title="حذف تبلیغ"
        itemLabel={pendingDelete?.titleFa}
      />
    </>
  );
}

export default VideoAdList;
