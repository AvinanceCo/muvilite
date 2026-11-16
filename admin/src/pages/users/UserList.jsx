/**
 * User list.
 *
 * Purpose: browse the accounts that can sign into this panel.
 * Inputs:  none (filters come from the URL)
 * Outputs: the users grid
 * Deps:    api/operations, hooks/useListParams, components/data/*
 *
 * Legacy counterpart: `views/users/panel.php` — the sidebar's «کاربران پنل».
 *
 * ADMINS AND END USERS SHARE ONE COLLECTION, exactly as the legacy schema did:
 * an administrator is a `User` whose `permissionGroup` is set, which is the
 * condition the legacy login query used. So this list can contain rows that
 * cannot sign in at all. The group column makes the difference visible, and the
 * group filter isolates real administrators.
 *
 * Users do not use the generic resource client: create needs a password,
 * update must omit it, and there are two extra routes. See api/operations.
 */
import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import * as ops from '../../api/operations.js';
import { useListParams } from '../../hooks/useListParams.js';
import { useLookupOptions } from '../../hooks/useResource.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { DataTable } from '../../components/data/DataTable.jsx';
import { ListToolbar, RowActions } from '../../components/data/RowControls.jsx';
import { ConfirmDialog } from '../../components/ui/Modal.jsx';
import { Badge, Card, PageHeader } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Switch } from '../../components/ui/Input.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { formatDateTime } from '../../services/format.js';
import { saveBlob } from '../../services/download.js';
import { EXPORT_FILENAMES } from '../../api/operations.js';

const STATUS_OPTIONS = [
  { value: 'true', label: 'فعال' },
  { value: 'false', label: 'غیرفعال' },
];

export function UserList() {
  useDocumentTitle('کاربران پنل');

  const { canEdit, canDelete } = usePermissions();
  const { user: currentUser } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [pendingDelete, setPendingDelete] = useState(null);
  const [exporting, setExporting] = useState(false);

  const list = useListParams({
    defaultSort: 'created_date',
    textFilters: ['mobile', 'displayName'],
  });

  const query = useQuery({
    queryKey: ['users', 'list', list.params],
    queryFn: () => ops.listUsers(list.params),
  });

  const { options: groupOptions } = useLookupOptions('permission-groups', {
    labelKey: 'name',
    sort: 'name',
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['users'] });

  const setStatus = useMutation({
    mutationFn: ({ id, isActive }) => ops.setUserStatus(id, isActive),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id) => ops.removeUser(id),
    onSuccess: invalidate,
  });

  const showRowControls = canEdit('users') || canDelete('users');

  const columns = [
    {
      key: 'displayName',
      header: 'نام',
      sortKey: 'display_name',
      filter: { key: 'displayName', type: 'text' },
      render: (row) => (
        <div className="min-w-32">
          <p className="text-paper">
            {row.displayName || [row.firstname, row.lastname].filter(Boolean).join(' ') || '—'}
            {row._id === currentUser?.id ? (
              <Badge tone="accent" className="ms-2">
                شما
              </Badge>
            ) : null}
          </p>
          {row.email ? (
            <p dir="ltr" className="text-start font-mono text-[0.7rem] text-muted">
              {row.email}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      key: 'mobile',
      header: 'موبایل',
      mono: true,
      width: 'w-36',
      sortKey: 'mobile',
      filter: { key: 'mobile', type: 'text', placeholder: '0912…' },
    },
    {
      key: 'permissionGroup',
      header: 'گروه دسترسی',
      width: 'w-40',
      filter: { key: 'permissionGroup', type: 'select', options: groupOptions },
      render: (row) =>
        row.permissionGroup?.name ? (
          <Badge tone="accent">{row.permissionGroup.name}</Badge>
        ) : (
          // No group means the account exists but cannot sign in — the legacy
          // login query required `permission_group_id IS NOT NULL AND != 0`.
          <span className="text-xs text-muted" title="بدون گروه دسترسی امکان ورود به پنل ندارد">
            بدون گروه
          </span>
        ),
    },
    {
      key: 'lastLoginAt',
      header: 'آخرین ورود',
      width: 'w-36',
      sortKey: 'last_login',
      render: (row) => formatDateTime(row.lastLoginAt) || '—',
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
              <UserStatusCell
                row={row}
                canEdit={canEdit('users')}
                onToggle={(isActive) => setStatus.mutateAsync({ id: row._id, isActive })}
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
                page="users"
                editTo={`/users/${row._id}`}
                // The API refuses to delete the caller's own account, so the
                // control is not offered for it.
                onDelete={row._id === currentUser?.id ? undefined : () => setPendingDelete(row)}
              />
            ),
          },
        ]
      : []),
  ];

  const handleDelete = async () => {
    try {
      await remove.mutateAsync(pendingDelete._id);
      toast.success('کاربر حذف شد.');
      setPendingDelete(null);
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await ops.exportUsers({
        mobile: list.filters.mobile,
        isActive: list.filters.isActive,
        permissionGroup: list.filters.permissionGroup,
      });
      saveBlob(blob, EXPORT_FILENAMES.users);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <PageHeader
        title="کاربران پنل"
        description="حساب‌های دارای گروه دسترسی می‌توانند وارد پنل شوند."
        actions={
          <ListToolbar
            page="users"
            addTo="/users/new"
            addLabel="افزودن کاربر"
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
          emptyTitle="کاربری یافت نشد"
        />
      </Card>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={handleDelete}
        loading={remove.isPending}
        title="حذف کاربر"
        itemLabel={pendingDelete?.displayName || pendingDelete?.mobile}
      />
    </>
  );
}

/** The status switch, with its own optimistic state (see RowControls). */
function UserStatusCell({ row, canEdit, onToggle }) {
  const [optimistic, setOptimistic] = useState(null);
  const [pending, setPending] = useState(false);
  const toast = useToast();

  const checked = optimistic ?? row.isActive;

  if (!canEdit) {
    return <span className="text-xs text-muted">{checked ? 'فعال' : 'غیرفعال'}</span>;
  }

  return (
    <Switch
      checked={checked}
      disabled={pending}
      label={`${checked ? 'غیرفعال کردن' : 'فعال کردن'} ${row.displayName ?? row.mobile}`}
      onChange={async (next) => {
        setOptimistic(next);
        setPending(true);
        try {
          await onToggle(next);
          toast.success(next ? 'حساب فعال شد.' : 'حساب غیرفعال شد.');
        } catch (error) {
          setOptimistic(null);
          toast.error(error.message);
        } finally {
          setPending(false);
        }
      }}
    />
  );
}

export default UserList;
