/**
 * Banner-category contents.
 *
 * Purpose: choose which banners belong to a category and in what order.
 * Inputs:  the category id from the route
 * Outputs: membership and ordering changes
 * Deps:    api/operations, components/form/OrderableList
 *
 * Legacy counterpart: the banner relation views plus `views/banners/order.php`.
 *
 * Order is per category, not per banner — the same banner can sit third in one
 * carousel and first in another, because `orderIndex` lives on the relation.
 * That is why ordering is here and not on the banner form.
 *
 * `PATCH /banners/order` takes `{ bannerCategory, entries: [{bannerId,
 * orderIndex}] }` — the category is part of the payload for exactly that
 * reason.
 */
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ops from '../../api/operations.js';
import { useLookupOptions, useResourceDetail, useResourceList } from '../../hooks/useResource.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { Button } from '../../components/ui/Button.jsx';
import { Badge, Card, PageHeader, SectionHeader, StatusBadge } from '../../components/ui/Card.jsx';
import { ErrorState, Loader } from '../../components/ui/Feedback.jsx';
import { Thumb } from '../../components/data/Thumb.jsx';
import { RelationPicker } from '../../components/form/RelationPicker.jsx';
import { OrderableList } from '../../components/form/OrderableList.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { mediaUrl } from '../../services/media.js';
import { BANNER_CATEGORY_TYPES } from '../../utils/constants.js';

export function BannerCategoryContent() {
  const { id } = useParams();
  const { canEdit, canDelete } = usePermissions();
  const toast = useToast();
  const queryClient = useQueryClient();

  const category = useResourceDetail('banner-categories', id);
  useDocumentTitle(category.data ? `بنرهای ${category.data.name}` : 'بنرهای دسته');

  const members = useQuery({
    queryKey: ['banner-categories', 'banners', id],
    queryFn: () => ops.fetchCategoryBanners(id),
  });

  // The picker offers every banner; the API caps a page at 100, which is well
  // past what a single carousel holds.
  const { options: bannerOptions } = useLookupOptions('banners', {
    labelKey: 'titleFa',
    sort: 'title_fa',
  });
  const allBanners = useResourceList('banners', { limit: 100, item_sort: 'title_fa', sort_type: 'ASC' });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['banner-categories', 'banners', id] });

  const reorder = useMutation({
    mutationFn: (entries) => ops.reorderBanners({ bannerCategory: id, entries }),
    onSuccess: invalidate,
  });

  if (category.isLoading) return <Loader />;
  if (category.error) return <ErrorState error={category.error} onRetry={category.refetch} />;

  const relations = members.data ?? [];
  const bannerById = new Map(allBanners.items.map((banner) => [banner._id, banner]));

  const rows = relations.map((relation) => {
    const bannerId = relation.banner?._id ?? relation.banner;
    return {
      key: relation._id,
      id: bannerId,
      label: relation.banner?.titleFa || 'بدون عنوان',
      relation,
      banner: relation.banner ?? bannerById.get(bannerId),
    };
  });

  const typeLabel = BANNER_CATEGORY_TYPES.find(
    (type) => type.value === category.data?.type,
  )?.label;

  return (
    <>
      <PageHeader
        title={`بنرهای «${category.data?.name}»`}
        description={typeLabel ? `نوع نمایش: ${typeLabel}` : undefined}
        actions={
          <Button variant="ghost" size="sm" to="/banner-categories">
            بازگشت به دسته بندی ها
          </Button>
        }
      />

      <div className="space-y-5">
        <Card>
          <SectionHeader title="بنرهای این دسته" />
          <RelationPicker
            rows={rows.map((row) => ({ key: row.key, id: row.id, label: row.label }))}
            options={bannerOptions}
            loading={members.isLoading}
            canEdit={canEdit('banners')}
            canDelete={canDelete('banners')}
            addPlaceholder="انتخاب بنر"
            emptyLabel="بنری در این دسته نیست"
            onAdd={async (bannerId) => {
              await ops.addCategoryBanner({
                bannerCategory: id,
                banner: bannerId,
                // Appended to the end; the operator reorders below.
                orderIndex: relations.length,
              });
              await invalidate();
              toast.success('بنر افزوده شد.');
            }}
            onRemove={async (row) => {
              await ops.removeCategoryBanner({ bannerCategory: id, banner: row.id });
              await invalidate();
              toast.success('بنر حذف شد.');
            }}
          />
        </Card>

        <Card>
          <SectionHeader
            title="ترتیب نمایش"
            description="ترتیب مخصوص همین دسته است؛ همین بنر در دستهٔ دیگر می‌تواند جای دیگری داشته باشد."
          />
          <OrderableList
            items={rows}
            itemKey={(row) => row.key}
            canEdit={canEdit('banners')}
            emptyLabel="بنری برای مرتب‌سازی وجود ندارد"
            onSave={(ordered) =>
              reorder.mutateAsync(
                ordered.map((row, index) => ({ bannerId: row.id, orderIndex: index })),
              )
            }
            renderItem={(row) => (
              <div className="flex items-center gap-3">
                <Thumb src={mediaUrl(row.banner?.imagePath)} className="h-8 w-16 rounded" />
                <span className="min-w-0 flex-1 truncate text-xs text-paper">{row.label}</span>
                {row.banner ? <StatusBadge isActive={row.banner.isActive} /> : (
                  <Badge tone="danger">حذف شده</Badge>
                )}
              </div>
            )}
          />
        </Card>
      </div>
    </>
  );
}

export default BannerCategoryContent;
