/**
 * Generic resource list.
 *
 * Purpose: render any descriptor-driven resource as a filterable, sortable,
 *          paginated grid with the standard row actions.
 * Inputs:  a descriptor key
 * Outputs: a full list screen
 * Deps:    hooks/useResource, hooks/useListParams, components/data/*
 *
 * Three columns are added to every descriptor rather than repeated in each:
 * the shortened id, the status toggle, and the actions cluster. The status and
 * actions columns are omitted entirely when the administrator holds neither
 * `edit` nor `delete` — a column of disabled controls is noise, and the legacy
 * grids hid them on the same condition (`views/movies/index.php:166-182`).
 */
import { useState } from 'react';
import { useResourceList, useResourceMutations } from '../../hooks/useResource.js';
import { useListParams } from '../../hooks/useListParams.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { DataTable } from '../../components/data/DataTable.jsx';
import { ListToolbar, RowActions, StatusToggle } from '../../components/data/RowControls.jsx';
import { ConfirmDialog } from '../../components/ui/Modal.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Can } from '../../components/auth/Guards.jsx';
import { Card, PageHeader } from '../../components/ui/Card.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { shortId, truncate } from '../../services/format.js';
import { getDescriptor } from './descriptors.jsx';

/** @param {{descriptorKey: string}} props */
export function ResourceListPage({ descriptorKey }) {
  const descriptor = getDescriptor(descriptorKey);
  const {
    key,
    permission,
    labels,
    defaultSort,
    defaultDirection,
    columns,
    contentRoute,
    toolbarLinks = [],
  } = descriptor;

  useDocumentTitle(labels.plural);

  const { canEdit, canDelete } = usePermissions();
  const toast = useToast();
  const [pendingDelete, setPendingDelete] = useState(null);

  const textFilters = columns
    .filter((column) => column.filter?.type !== 'select' && column.filter)
    .map((column) => column.filter.key);

  const list = useListParams({ defaultSort, defaultDirection, textFilters });
  const query = useResourceList(key, list.params);
  const { setStatus, remove } = useResourceMutations(key);

  const showRowControls = canEdit(permission) || canDelete(permission);

  const tableColumns = [
    {
      key: '_id',
      header: 'شناسه',
      width: 'w-24',
      mono: true,
      sortKey: 'id',
      render: (row) => (
        <span title={row._id} className="text-muted">
          {shortId(row._id)}
        </span>
      ),
    },

    ...columns.map((column) => ({
      ...column,
      render:
        column.render ??
        ((row) => {
          const value = row[column.key];
          if (value === null || value === undefined || value === '') {
            return <span className="text-muted/50">—</span>;
          }
          // A descriptor can name an option list, so a stored value renders as
          // its Persian label rather than its raw enum string.
          if (column.options) {
            return column.options.find((option) => option.value === value)?.label ?? value;
          }
          return column.truncate ? truncate(value, column.truncate) : value;
        }),
    })),

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
                page={permission}
                label={row.nameFa ?? row.name ?? row.questionFa ?? ''}
                onToggle={(id, isActive) => setStatus.mutateAsync({ id, isActive })}
              />
            ),
          },
          {
            key: 'actions',
            header: 'عملیات',
            width: 'w-32',
            align: 'end',
            render: (row) => (
              <RowActions
                page={permission}
                editTo={`/${key}/${row._id}`}
                onDelete={() => setPendingDelete(row)}
                extras={
                  contentRoute
                    ? [{ to: contentRoute(row._id), label: 'محتوای دسته', icon: '☰' }]
                    : []
                }
              />
            ),
          },
        ]
      : []),
  ];

  const handleDelete = async () => {
    try {
      await remove.mutateAsync(pendingDelete._id);
      toast.success(`${labels.singular} حذف شد.`);
      setPendingDelete(null);
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <>
      <PageHeader
        title={labels.plural}
        actions={
          <ListToolbar
            page={permission}
            addTo={`/${key}/new`}
            addLabel={labels.addNew}
            hasFilters={list.hasFilters}
            onClearFilters={list.reset}
          >
            {/* Descriptor-declared extras — currently only the poll importer.
                Gated on `edit` because each one leads to a write. */}
            {toolbarLinks.map((link) => (
              <Can key={link.to} page={permission} action="edit">
                <Button to={link.to} size="sm">
                  {link.icon ? <span aria-hidden="true">{link.icon}</span> : null}
                  {link.label}
                </Button>
              </Can>
            ))}
          </ListToolbar>
        }
      />

      <Card padded={false}>
        <DataTable
          columns={tableColumns}
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
          emptyTitle={list.hasFilters ? 'با این فیلترها موردی یافت نشد' : `${labels.singular}ی ثبت نشده است`}
          emptyDescription={
            list.hasFilters ? 'فیلترها را تغییر دهید یا حذف کنید.' : undefined
          }
        />
      </Card>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={handleDelete}
        loading={remove.isPending}
        title={`حذف ${labels.singular}`}
        itemLabel={
          pendingDelete?.nameFa ??
          pendingDelete?.name ??
          pendingDelete?.countryFa ??
          pendingDelete?.questionFa ??
          pendingDelete?.displayName
        }
      />
    </>
  );
}

export default ResourceListPage;
