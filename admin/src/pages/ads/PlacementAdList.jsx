/**
 * Landing-page advertisement list.
 *
 * Purpose: browse the still ads that fill the two fixed slots on the passenger
 *          home page.
 * Inputs:  none (filters come from the URL)
 * Outputs: the slot-ads grid
 * Deps:    hooks/useResource, hooks/useListParams, components/data/*
 *
 * NEW SCREEN — the legacy panel had none. Both slots were literal markup in
 * `index.php`, pointing at `assets/page/index/top.gif` and `bottom.gif`;
 * changing an ad meant editing PHP and uploading a file over FTP.
 *
 * The grid opens sorted by `order` ASCENDING, because that is the sequence the
 * passenger sees. Every other list in this panel opens newest-first, which is
 * right for a catalogue and wrong for a hand-curated strip of two or three
 * items.
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
import { toPersianNumber, truncate } from '../../services/format.js';
import { AD_PLACEMENTS, placementLabel } from '../../utils/constants.js';

export function PlacementAdList() {
  useDocumentTitle('تبلیغات صفحهٔ اصلی');

  const { canEdit, canDelete } = usePermissions();
  const toast = useToast();
  const [pendingDelete, setPendingDelete] = useState(null);

  const list = useListParams({
    defaultSort: 'order',
    defaultDirection: 'ASC',
    textFilters: ['titleFa'],
  });
  const query = useResourceList('placement-ads', list.params);
  const { setStatus, remove } = useResourceMutations('placement-ads');

  const showRowControls = canEdit('ads') || canDelete('ads');

  const columns = [
    {
      key: 'image',
      header: '',
      width: 'w-24',
      render: (row) => (
        <Thumb src={mediaUrl(row.imagePath)} className="h-10 w-20 rounded" fallback="بدون تصویر" />
      ),
    },
    {
      key: 'titleFa',
      header: 'عنوان',
      sortKey: 'title_fa',
      filter: { key: 'titleFa', type: 'text' },
      render: (row) => (
        <div className="min-w-32">
          <p className="text-paper">{truncate(row.titleFa, 40) || '—'}</p>
          {/* The desktop variant is optional and falls back to the mobile one
              when serving, so its absence is information, not an error. */}
          {row.imageLandscapePath ? null : (
            <p className="text-[0.7rem] text-muted">بدون نسخهٔ دسکتاپ</p>
          )}
        </div>
      ),
    },
    {
      key: 'placement',
      header: 'جایگاه',
      width: 'w-32',
      sortKey: 'placement',
      filter: {
        key: 'placement',
        type: 'select',
        options: AD_PLACEMENTS.map(({ value, label }) => ({ value, label })),
      },
      render: (row) => <Badge tone="accent">{placementLabel(row.placement)}</Badge>,
    },
    {
      key: 'order',
      header: 'ترتیب',
      width: 'w-20',
      align: 'center',
      mono: true,
      sortKey: 'order',
      render: (row) => toPersianNumber(row.order ?? 0),
    },
    {
      key: 'url',
      header: 'پیوند',
      mono: true,
      render: (row) =>
        row.url ? (
          <span title={row.url}>{truncate(row.url, 40)}</span>
        ) : (
          <span className="text-muted/50">—</span>
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
                editTo={`/placement-ads/${row._id}`}
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
        title="تبلیغات صفحهٔ اصلی"
        description="دو جایگاه ثابت بالای و پایین فهرست بخش‌ها. تبلیغی که تصویر نداشته باشد نمایش داده نمی‌شود."
        actions={
          <ListToolbar
            page="ads"
            addTo="/placement-ads/new"
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

export default PlacementAdList;
