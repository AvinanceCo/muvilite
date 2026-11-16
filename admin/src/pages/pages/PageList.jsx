/**
 * Page list.
 *
 * Purpose: browse the landing pages the passenger site is composed of.
 * Inputs:  none
 * Outputs: the pages grid
 * Deps:    hooks/useResource, components/data/*
 *
 * Legacy counterpart: `views/pages/index.php`.
 *
 * The «بلوک ها» action is the point of this screen: a page is an empty shell
 * until blocks are added to it, so the composer is one click from every row.
 */
import { useState } from 'react';
import { useResourceList, useResourceMutations } from '../../hooks/useResource.js';
import { useListParams } from '../../hooks/useListParams.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { DataTable } from '../../components/data/DataTable.jsx';
import { ListToolbar, RowActions, StatusToggle } from '../../components/data/RowControls.jsx';
import { ConfirmDialog } from '../../components/ui/Modal.jsx';
import { Card, PageHeader } from '../../components/ui/Card.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { truncate } from '../../services/format.js';

export function PageList() {
  useDocumentTitle('برگه ها');

  const { canEdit, canDelete } = usePermissions();
  const toast = useToast();
  const [pendingDelete, setPendingDelete] = useState(null);

  const list = useListParams({ defaultSort: 'created_date', textFilters: ['titleFa'] });
  const query = useResourceList('pages', list.params);
  const { setStatus, remove } = useResourceMutations('pages');

  const showRowControls = canEdit('pages') || canDelete('pages');

  const columns = [
    {
      key: 'titleFa',
      header: 'عنوان',
      sortKey: 'title_fa',
      filter: { key: 'titleFa', type: 'text' },
    },
    { key: 'titleEn', header: 'عنوان لاتین', mono: true, render: (row) => row.titleEn || '—' },
    {
      key: 'slug',
      header: 'نشانی',
      mono: true,
      render: (row) =>
        row.slug ? (
          // The slug is how the passenger site addresses the page:
          // `GET /api/pages/:idOrSlug` resolves either.
          <span title={`/page/${row.slug}`}>/{row.slug}</span>
        ) : (
          <span className="text-muted/50">—</span>
        ),
    },
    {
      key: 'descriptionFa',
      header: 'توضیح',
      render: (row) => truncate(row.descriptionFa, 50) || '—',
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
                page="pages"
                label={row.titleFa}
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
                page="pages"
                editTo={`/pages/${row._id}`}
                onDelete={() => setPendingDelete(row)}
                extras={[{ to: `/pages/${row._id}/blocks`, label: 'بلوک ها', icon: '▤' }]}
              />
            ),
          },
        ]
      : []),
  ];

  const handleDelete = async () => {
    try {
      await remove.mutateAsync(pendingDelete._id);
      toast.success('برگه حذف شد.');
      setPendingDelete(null);
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <>
      <PageHeader
        title="برگه ها"
        description="هر برگه از بلوک‌هایی ساخته می‌شود که ردیف‌های سایت اصلی را می‌سازند."
        actions={
          <ListToolbar
            page="pages"
            addTo="/pages/new"
            addLabel="افزودن برگه"
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
          emptyTitle="برگه‌ای ثبت نشده است"
        />
      </Card>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={handleDelete}
        loading={remove.isPending}
        title="حذف برگه"
        itemLabel={pendingDelete?.titleFa}
      />
    </>
  );
}

export default PageList;
