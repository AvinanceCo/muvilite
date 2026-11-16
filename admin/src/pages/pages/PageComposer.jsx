/**
 * Page composer.
 *
 * Purpose: build a landing page out of blocks — add them, point each at a
 *          collection, set how its items sort, and order the rails.
 * Inputs:  the page id from the route
 * Outputs: block create/edit/delete and a reorder
 * Deps:    api/operations, hooks/useResource, components/form/OrderableList
 *
 * Legacy counterpart: `views/pages/content.php`, `graph.php` and the `blocks/`
 * views — a go.js diagram plus separate add/edit/order screens.
 *
 * A BLOCK IS A RAIL on the passenger site. `itemType` decides which collection
 * `itemId` addresses:
 *   banner   -> a BannerCategory  (a carousel)
 *   category -> a Category        (a row of films)
 *   music    -> a MusicCategory   (a row of albums)
 * `itemId` carries no ref in the schema, so nothing but this pairing keeps it
 * honest — pick the type first and the picker follows.
 *
 * `itemSort`/`sortType` order the items INSIDE the rail. Those two values were
 * the second-order SQL injection in the legacy app: they were read out of
 * `page_block_tbl` and interpolated straight into the rail query
 * (backend/MIGRATION.md §6 defect 4). They are a closed enum now, which is why
 * this form offers a fixed list rather than a free-text field.
 *
 * Rails are hard-capped at 10 items with no pagination — legacy behaviour,
 * deliberately preserved — so the composer says so instead of implying a block
 * shows everything in its category.
 */
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import * as ops from '../../api/operations.js';
import { useLookupOptions, useResourceMutations } from '../../hooks/useResource.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { Button, IconButton } from '../../components/ui/Button.jsx';
import { Badge, Card, PageHeader, SectionHeader } from '../../components/ui/Card.jsx';
import { Select } from '../../components/ui/Input.jsx';
import { Alert, ErrorState, Loader } from '../../components/ui/Feedback.jsx';
import { Modal, ConfirmDialog } from '../../components/ui/Modal.jsx';
import { Field, FieldGrid } from '../../components/form/Field.jsx';
import { OrderableList } from '../../components/form/OrderableList.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { BLOCK_ITEM_TYPES, BLOCK_SORT_FIELDS, SORT_DIRECTIONS } from '../../utils/constants.js';

const TYPE_LABEL = Object.fromEntries(BLOCK_ITEM_TYPES.map((type) => [type.value, type.label]));

export function PageComposer() {
  const { id } = useParams();
  const { canEdit, canDelete } = usePermissions();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [editing, setEditing] = useState(null); // a block, or {} for a new one
  const [pendingDelete, setPendingDelete] = useState(null);

  // One request: the page, its blocks in display order, and each block's
  // resolved target name. Added to the backend during this pass.
  const composition = useQuery({
    queryKey: ['pages', 'blocks', id],
    queryFn: () => ops.fetchPageBlocks(id),
  });

  const page = composition.data?.page;
  useDocumentTitle(page ? `بلوک‌های ${page.titleFa}` : 'بلوک های برگه');

  const blockMutations = useResourceMutations('page-blocks');

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['pages', 'blocks', id] });

  const reorder = useMutation({
    mutationFn: (entries) => ops.reorderPageBlocks({ entries }),
    onSuccess: invalidate,
  });

  if (composition.isLoading) return <Loader />;
  if (composition.error) {
    return <ErrorState error={composition.error} onRetry={composition.refetch} />;
  }

  const blocks = composition.data?.blocks ?? [];

  const handleDelete = async () => {
    try {
      await blockMutations.remove.mutateAsync(pendingDelete._id);
      await invalidate();
      toast.success('بلوک حذف شد.');
      setPendingDelete(null);
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <>
      <PageHeader
        title={`بلوک‌های «${page?.titleFa}»`}
        description="هر بلوک یک ردیف در سایت اصلی است. ردیف‌ها حداکثر ۱۰ مورد نشان می‌دهند."
        actions={
          <>
            {canEdit('blocks') ? (
              <Button variant="primary" size="sm" onClick={() => setEditing({})}>
                <span aria-hidden="true">+</span>
                افزودن بلوک
              </Button>
            ) : null}
            <Button variant="ghost" size="sm" to="/pages">
              بازگشت به برگه ها
            </Button>
          </>
        }
      />

      {blocks.some((block) => !block.target) ? (
        <Alert tone="warning" className="mb-5" title="بلوک بدون مقصد">
          یک یا چند بلوک به دسته‌بندی‌ای اشاره می‌کنند که دیگر وجود ندارد. این بلوک‌ها در سایت اصلی
          نمایش داده نمی‌شوند؛ آن‌ها را اصلاح یا حذف کنید.
        </Alert>
      ) : null}

      <Card>
        <SectionHeader
          title="ترتیب بلوک ها"
          description="ترتیب بالا به پایین، همان ترتیب نمایش ردیف‌ها در برگه است."
        />

        <OrderableList
          items={blocks}
          itemKey={(block) => block._id}
          canEdit={canEdit('blocks')}
          emptyLabel="این برگه هنوز بلوکی ندارد"
          onSave={(ordered) =>
            reorder.mutateAsync(
              ordered.map((block, index) => ({ id: block._id, itemOrder: index })),
            )
          }
          renderItem={(block) => (
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="accent">{TYPE_LABEL[block.itemType] ?? block.itemType}</Badge>

              <span className="min-w-0 flex-1 truncate text-xs text-paper">
                {block.target ? (
                  block.target.name
                ) : (
                  <span className="text-signal">مقصد یافت نشد</span>
                )}
              </span>

              {block.target && !block.target.isActive ? (
                <Badge tone="inactive">دستهٔ غیرفعال</Badge>
              ) : null}
              {!block.isActive ? <Badge tone="inactive">بلوک غیرفعال</Badge> : null}

              <span className="font-mono text-[0.65rem] text-muted">
                {block.itemSort} {block.sortType}
              </span>

              {canEdit('blocks') ? (
                <IconButton label="ویرایش بلوک" onClick={() => setEditing(block)}>
                  ✎
                </IconButton>
              ) : null}
              {canDelete('blocks') ? (
                <IconButton
                  label="حذف بلوک"
                  onClick={() => setPendingDelete(block)}
                  className="hover:border-signal/50 hover:text-signal"
                >
                  🗑
                </IconButton>
              ) : null}
            </div>
          )}
        />
      </Card>

      {editing ? (
        <BlockDialog
          pageId={id}
          block={editing._id ? editing : null}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            await invalidate();
            setEditing(null);
          }}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={handleDelete}
        loading={blockMutations.remove.isPending}
        title="حذف بلوک"
        itemLabel={pendingDelete?.target?.name}
      />
    </>
  );
}

/**
 * The add/edit dialog for one block.
 *
 * The target picker is driven by the chosen `itemType`: each type addresses a
 * different collection, and the three lookups are loaded together so switching
 * type is instant. Changing the type clears the target, because an id from one
 * collection is meaningless in another and the schema will not catch it.
 */
function BlockDialog({ pageId, block, onClose, onSaved }) {
  const isNew = !block;
  const toast = useToast();
  const { create, update } = useResourceMutations('page-blocks');

  const { options: bannerCategories } = useLookupOptions('banner-categories', {
    labelKey: 'name',
    sort: 'name',
  });
  const { options: categories } = useLookupOptions('categories');
  const { options: musicCategories } = useLookupOptions('music-categories');

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { isSubmitting },
  } = useForm({
    defaultValues: {
      itemType: block?.itemType ?? 'category',
      itemId: block?.itemId ?? '',
      itemSort: block?.itemSort ?? 'created_date',
      sortType: block?.sortType ?? 'DESC',
      isActive: block?.isActive ?? true,
    },
  });

  const itemType = watch('itemType');

  const targetOptions =
    itemType === 'banner' ? bannerCategories : itemType === 'music' ? musicCategories : categories;

  const onSubmit = async (values) => {
    const payload = {
      page: pageId,
      itemType: values.itemType,
      itemId: values.itemId,
      itemSort: values.itemSort,
      sortType: values.sortType,
      isActive: values.isActive,
      // New blocks go to the end; the composer's list handles reordering.
      ...(isNew ? { itemOrder: 0 } : { itemOrder: block.itemOrder }),
    };

    try {
      if (isNew) {
        await create.mutateAsync(payload);
        toast.success('بلوک افزوده شد.');
      } else {
        await update.mutateAsync({ id: block._id, payload });
        toast.success('بلوک ذخیره شد.');
      }
      onSaved();
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={isNew ? 'افزودن بلوک' : 'ویرایش بلوک'}
      description="نوع بلوک تعیین می‌کند مقصد آن از کدام مجموعه انتخاب شود."
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            انصراف
          </Button>
          <Button variant="primary" onClick={handleSubmit(onSubmit)} loading={isSubmitting}>
            {isNew ? 'افزودن' : 'ذخیره'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <FieldGrid columns={1}>
          <Field label="نوع بلوک" required>
            {({ id }) => (
              <Select
                id={id}
                options={[...BLOCK_ITEM_TYPES]}
                {...register('itemType', {
                  // An id from one collection means nothing in another.
                  onChange: () => setValue('itemId', ''),
                })}
              />
            )}
          </Field>

          <Field label="مقصد" required hint="ردیف، محتوای خود را از این دسته‌بندی می‌گیرد.">
            {({ id }) => (
              <Select
                id={id}
                options={targetOptions}
                placeholder="انتخاب کنید"
                {...register('itemId', { required: true })}
              />
            )}
          </Field>

          <Field label="ترتیب موارد داخل ردیف">
            {({ id }) => <Select id={id} options={[...BLOCK_SORT_FIELDS]} {...register('itemSort')} />}
          </Field>

          <Field label="جهت ترتیب">
            {({ id }) => <Select id={id} options={[...SORT_DIRECTIONS]} {...register('sortType')} />}
          </Field>
        </FieldGrid>

        <Alert tone="info" className="mt-4">
          هر ردیف حداکثر ۱۰ مورد نمایش می‌دهد و صفحه‌بندی ندارد؛ پیوند «همه» کاربر را به صفحهٔ
          دسته‌بندی می‌برد.
        </Alert>
      </form>
    </Modal>
  );
}

export default PageComposer;
