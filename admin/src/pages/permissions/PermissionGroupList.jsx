/**
 * Permission group list.
 *
 * Purpose: browse the groups that decide what an administrator may do.
 * Inputs:  none
 * Outputs: the groups grid
 * Deps:    hooks/useResource, components/data/*
 *
 * Legacy counterpart: `views/groups/index.php`.
 *
 * The summary column counts the sections a group reaches, which is the question
 * actually being asked when scanning this list: an "Editors" group granting one
 * section and one granting twelve look identical by name alone.
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
import { toPersianNumber } from '../../services/format.js';

export function PermissionGroupList() {
  useDocumentTitle('گروه های دسترسی');

  const { canEdit, canDelete } = usePermissions();
  const toast = useToast();
  const [pendingDelete, setPendingDelete] = useState(null);

  const list = useListParams({ defaultSort: 'name', defaultDirection: 'ASC', textFilters: ['name'] });
  const query = useResourceList('permission-groups', list.params);
  const { setStatus, remove } = useResourceMutations('permission-groups');

  const showRowControls = canEdit('groups') || canDelete('groups');

  const columns = [
    {
      key: 'name',
      header: 'نام گروه',
      sortKey: 'name',
      filter: { key: 'name', type: 'text' },
    },
    {
      key: 'permissions',
      header: 'بخش ها',
      render: (row) => {
        // `permissions` arrives populated with the AccessPermission documents,
        // so the distinct sections can be counted without another request.
        const pages = new Set((row.permissions ?? []).map((item) => item.actionPage));
        return pages.size === 0 ? (
          <span className="text-xs text-muted">هیچ دسترسی‌ای ندارد</span>
        ) : (
          <span className="flex flex-wrap gap-1">
            {[...pages].slice(0, 4).map((page) => (
              <Badge key={page} tone="accent">
                {page}
              </Badge>
            ))}
            {pages.size > 4 ? (
              <Badge>+{toPersianNumber(pages.size - 4)}</Badge>
            ) : null}
          </span>
        );
      },
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
                page="groups"
                label={row.name}
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
                page="groups"
                editTo={`/permission-groups/${row._id}`}
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
      toast.success('گروه حذف شد.');
      setPendingDelete(null);
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <>
      <PageHeader
        title="گروه های دسترسی"
        description="تغییر دسترسی‌های یک گروه بلافاصله روی نشست‌های باز اعضای آن اثر می‌گذارد."
        actions={
          <ListToolbar
            page="groups"
            addTo="/permission-groups/new"
            addLabel="افزودن گروه"
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
          emptyTitle="گروهی تعریف نشده است"
        />
      </Card>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={handleDelete}
        loading={remove.isPending}
        title="حذف گروه دسترسی"
        itemLabel={pendingDelete?.name}
        message={
          <>
            آیا از حذف گروه <b className="text-azure">«{pendingDelete?.name}»</b> مطمئن هستید؟
            کاربران این گروه پس از حذف، بدون گروه می‌مانند و امکان ورود به پنل را از دست می‌دهند.
          </>
        }
      />
    </>
  );
}

export default PermissionGroupList;
