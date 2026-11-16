/**
 * Game list.
 *
 * Purpose: browse the HTML5 games offered on the passenger site.
 * Inputs:  none (filters come from the URL)
 * Outputs: the games grid
 * Deps:    hooks/useResource, hooks/useListParams, components/data/*
 *
 * NEW SCREEN — the legacy panel had none, because the legacy application had no
 * games. It is modelled on Playva's games page
 * (`playva-admin/src/pages/dashboard/games/index.jsx`), without its leaderboard
 * column and trophy button, and on this panel's own grids rather than Playva's
 * dialogs: a game is created and edited on a form page, like everything else
 * here.
 *
 * «بازشدن» is the count of times passengers have opened the game. It is the one
 * number on this grid an operator cannot set, and what «پرطرفدار» on the
 * passenger site sorts by.
 *
 * DELETING A GAME REMOVES ITS FILES. Every other delete in the panel leaves the
 * record's media on disk; a game's bundle is thousands of files that nothing
 * would ever serve again, so the API removes the directory. The confirmation
 * says so, in place of the usual line about being restorable.
 */
import { useState } from 'react';
import {
  useLookupOptions,
  useResourceList,
  useResourceMutations,
} from '../../hooks/useResource.js';
import { useListParams } from '../../hooks/useListParams.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { DataTable } from '../../components/data/DataTable.jsx';
import { ListToolbar, RowActions, StatusToggle } from '../../components/data/RowControls.jsx';
import { ConfirmDialog } from '../../components/ui/Modal.jsx';
import { Badge, Card, PageHeader } from '../../components/ui/Card.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { toPersianNumber, truncate } from '../../services/format.js';
import { GameTile } from './GameTile.jsx';

export function GameList() {
  useDocumentTitle('بازی‌ها');

  const { canEdit, canDelete } = usePermissions();
  const toast = useToast();
  const [pendingDelete, setPendingDelete] = useState(null);

  const list = useListParams({
    defaultSort: 'created_date',
    textFilters: ['titleFa', 'folderName'],
  });
  const query = useResourceList('games', list.params);
  const { setStatus, remove } = useResourceMutations('games');

  // The genre filter's choices. Deactivated genres are included: a game still
  // filed under one must remain findable by it.
  const { options: genreOptions } = useLookupOptions('game-genres');

  const showRowControls = canEdit('games') || canDelete('games');

  const columns = [
    {
      key: 'titleFa',
      header: 'بازی',
      sortKey: 'title_fa',
      filter: { key: 'titleFa', type: 'text' },
      render: (row) => (
        <div className="flex min-w-40 items-center gap-3">
          <GameTile emoji={row.emoji} color1={row.color1} color2={row.color2} />
          <p className="text-paper">{truncate(row.titleFa, 40)}</p>
        </div>
      ),
    },
    {
      key: 'folderName',
      header: 'پوشه',
      mono: true,
      sortKey: 'folder_name',
      filter: { key: 'folderName', type: 'text' },
    },
    {
      key: 'genre',
      header: 'ژانر',
      width: 'w-36',
      filter: { key: 'genre', type: 'select', options: genreOptions },
      render: (row) =>
        row.genre?.nameFa ? (
          <Badge tone="accent">{row.genre.nameFa}</Badge>
        ) : (
          // The genre's row is gone. The API prevents this for a genre in use,
          // so it means the record predates that rule or was edited by hand.
          <Badge tone="danger">بدون ژانر</Badge>
        ),
    },
    {
      key: 'clicks',
      header: 'بازشدن',
      width: 'w-24',
      align: 'center',
      sortKey: 'clicks',
      render: (row) => toPersianNumber(row.clicks ?? 0),
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
                page="games"
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
                page="games"
                editTo={`/games/${row._id}`}
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
      toast.success('بازی و فایل‌های آن حذف شد.');
      setPendingDelete(null);
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <>
      <PageHeader
        title="بازی‌ها"
        description="بازی‌های HTML5 که در سایت اصلی، بدون نصب و درون مرورگر اجرا می‌شوند. هر بازی یک فایل ZIP است که اینجا بارگذاری می‌شود."
        actions={
          <ListToolbar
            page="games"
            addTo="/games/new"
            addLabel="افزودن بازی"
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
          emptyTitle="بازی‌ای ثبت نشده است"
        />
      </Card>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={handleDelete}
        loading={remove.isPending}
        title="حذف بازی"
        itemLabel={pendingDelete?.titleFa}
        note="بازی از سایت اصلی برداشته می‌شود و فایل‌های آن از روی سرور پاک می‌شوند. برای بازگرداندنش باید فایل ZIP را دوباره بارگذاری کنید."
      />
    </>
  );
}

export default GameList;
