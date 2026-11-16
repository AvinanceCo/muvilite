/**
 * Cast list.
 *
 * Purpose: browse the people credited on films.
 * Inputs:  none (filters come from the URL)
 * Outputs: the casts grid
 * Deps:    hooks/useResource, hooks/useListParams, components/data/*
 *
 * Legacy counterpart: `views/casts/index.php`. Not descriptor-driven only
 * because of the photo thumbnail column, which needs a renderer.
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
import { formatDate, truncate } from '../../services/format.js';

export function CastList() {
  useDocumentTitle('شخصیت ها');

  const { canEdit, canDelete } = usePermissions();
  const toast = useToast();
  const [pendingDelete, setPendingDelete] = useState(null);

  const list = useListParams({
    defaultSort: 'created_date',
    textFilters: ['fullnameFa'],
  });

  const query = useResourceList('casts', list.params);
  const { setStatus, remove } = useResourceMutations('casts');

  const showRowControls = canEdit('casts') || canDelete('casts');

  const columns = [
    {
      key: 'photo',
      header: '',
      width: 'w-14',
      render: (row) => (
        <Thumb
          src={mediaUrl(row.photoPath)}
          className="size-10 rounded-full"
          fallback={(row.fullnameFa ?? '؟').slice(0, 1)}
        />
      ),
    },
    {
      key: 'fullnameFa',
      header: 'نام',
      sortKey: 'fullname_fa',
      filter: { key: 'fullnameFa', type: 'text' },
    },
    {
      key: 'fullnameEn',
      header: 'نام لاتین',
      mono: true,
      render: (row) => row.fullnameEn || '—',
    },
    {
      key: 'birthDate',
      header: 'تولد',
      width: 'w-28',
      align: 'center',
      render: (row) => formatDate(row.birthDate) || '—',
    },
    {
      key: 'briefFa',
      header: 'معرفی',
      render: (row) => truncate(row.briefFa, 60) || '—',
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
                page="casts"
                label={row.fullnameFa}
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
                page="casts"
                editTo={`/casts/${row._id}`}
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
      toast.success('شخصیت حذف شد.');
      setPendingDelete(null);
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <>
      <PageHeader
        title="شخصیت ها"
        actions={
          <ListToolbar
            page="casts"
            addTo="/casts/new"
            addLabel="افزودن شخصیت"
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
          emptyTitle="شخصیتی ثبت نشده است"
        />
      </Card>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={handleDelete}
        loading={remove.isPending}
        title="حذف شخصیت"
        itemLabel={pendingDelete?.fullnameFa}
      />
    </>
  );
}

export default CastList;
