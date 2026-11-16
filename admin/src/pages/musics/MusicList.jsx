/**
 * Music list.
 *
 * Purpose: browse the music catalog.
 * Inputs:  none (filters come from the URL)
 * Outputs: the musics grid
 * Deps:    hooks/useResource, hooks/useListParams, components/data/*
 *
 * Legacy counterpart: `views/musics/index.php`. Note the legacy folder had no
 * `create.php` or `delete.php` — music could be edited but not created or
 * removed from the panel. The API offers full CRUD, so this screen does too;
 * that is a superset of the legacy behaviour, not a change to it.
 *
 * A row is an album, not a song: `fullnameFa` is the artist and `albumFa` the
 * album, and the songs are the `tracks` array inside it.
 */
import { useState } from 'react';
import { useResourceList, useResourceMutations } from '../../hooks/useResource.js';
import { useListParams } from '../../hooks/useListParams.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { DataTable } from '../../components/data/DataTable.jsx';
import { Thumb } from '../../components/data/Thumb.jsx';
import { ListToolbar, RowActions, StatusToggle } from '../../components/data/RowControls.jsx';
import { ConfirmDialog } from '../../components/ui/Modal.jsx';
import { Badge, Card, PageHeader } from '../../components/ui/Card.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { mediaUrl } from '../../services/media.js';
import { formatYear, toPersianNumber, truncate } from '../../services/format.js';

export function MusicList() {
  useDocumentTitle('موسیقی ها');

  const { canEdit, canDelete } = usePermissions();
  const toast = useToast();
  const [pendingDelete, setPendingDelete] = useState(null);

  const list = useListParams({
    defaultSort: 'created_date',
    textFilters: ['fullnameFa', 'albumFa'],
  });

  const query = useResourceList('musics', list.params);
  const { setStatus, remove } = useResourceMutations('musics');

  const showRowControls = canEdit('musics') || canDelete('musics');

  const columns = [
    {
      key: 'cover',
      header: '',
      width: 'w-14',
      render: (row) => (
        <Thumb src={mediaUrl(row.coverPath)} className="size-10 rounded" fallback="♪" />
      ),
    },
    {
      key: 'fullnameFa',
      header: 'هنرمند',
      filter: { key: 'fullnameFa', type: 'text' },
      render: (row) => (
        <div className="min-w-32">
          <p className="text-paper">{row.fullnameFa}</p>
          {row.fullnameEn ? (
            <p dir="ltr" className="text-start font-mono text-[0.7rem] text-muted">
              {row.fullnameEn}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      key: 'albumFa',
      header: 'آلبوم',
      filter: { key: 'albumFa', type: 'text' },
      render: (row) => truncate(row.albumFa, 30) || '—',
    },
    {
      key: 'tracks',
      header: 'قطعات',
      width: 'w-20',
      align: 'center',
      render: (row) => toPersianNumber(row.tracks?.length ?? 0),
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
      key: 'isIranian',
      header: 'ایرانی',
      width: 'w-20',
      align: 'center',
      render: (row) => (row.isIranian ? <Badge tone="accent">ایرانی</Badge> : '—'),
    },
    {
      key: 'visitCount',
      header: 'بازدید',
      width: 'w-24',
      align: 'center',
      sortKey: 'visit_count',
      render: (row) => toPersianNumber(row.visitCount ?? 0),
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
                page="musics"
                label={row.albumFa || row.fullnameFa}
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
                page="musics"
                editTo={`/musics/${row._id}`}
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
      toast.success('آلبوم حذف شد.');
      setPendingDelete(null);
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <>
      <PageHeader
        title="موسیقی ها"
        actions={
          <ListToolbar
            page="musics"
            addTo="/musics/new"
            addLabel="افزودن آلبوم"
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
          emptyTitle="آلبومی ثبت نشده است"
        />
      </Card>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={handleDelete}
        loading={remove.isPending}
        title="حذف آلبوم"
        itemLabel={pendingDelete?.albumFa || pendingDelete?.fullnameFa}
      />
    </>
  );
}

export default MusicList;
