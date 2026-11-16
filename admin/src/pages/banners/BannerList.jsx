/**
 * Banner list.
 *
 * Purpose: browse the promotional slides.
 * Inputs:  none (filters come from the URL)
 * Outputs: the banners grid
 * Deps:    hooks/useResource, hooks/useListParams, components/data/*
 *
 * Legacy counterpart: `views/banners/index.php`.
 *
 * A banner has no required field — the API's write rules are entirely optional,
 * so `POST {}` is valid. That is the backend's contract, not an oversight to
 * correct here: a banner is often just an image with a link.
 *
 * Ordering is per category, not global, so it lives on the banner-category
 * contents screen rather than this one.
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
import { Card, PageHeader } from '../../components/ui/Card.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { mediaUrl } from '../../services/media.js';
import { truncate } from '../../services/format.js';

export function BannerList() {
  useDocumentTitle('بنر ها');

  const { canEdit, canDelete } = usePermissions();
  const toast = useToast();
  const [pendingDelete, setPendingDelete] = useState(null);

  const list = useListParams({ defaultSort: 'created_date', textFilters: ['titleFa'] });
  const query = useResourceList('banners', list.params);
  const { setStatus, remove } = useResourceMutations('banners');

  const showRowControls = canEdit('banners') || canDelete('banners');

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
          {row.subtitleFa ? (
            <p className="text-[0.7rem] text-muted">{truncate(row.subtitleFa, 40)}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: 'labelFa',
      header: 'برچسب',
      width: 'w-28',
      render: (row) => row.labelFa || '—',
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
                page="banners"
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
                page="banners"
                editTo={`/banners/${row._id}`}
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
      toast.success('بنر حذف شد.');
      setPendingDelete(null);
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <>
      <PageHeader
        title="بنر ها"
        description="ترتیب نمایش هر بنر در صفحهٔ دسته‌بندی بنر تعیین می‌شود."
        actions={
          <ListToolbar
            page="banners"
            addTo="/banners/new"
            addLabel="افزودن بنر"
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
          emptyTitle="بنری ثبت نشده است"
        />
      </Card>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={handleDelete}
        loading={remove.isPending}
        title="حذف بنر"
        itemLabel={pendingDelete?.titleFa}
      />
    </>
  );
}

export default BannerList;
