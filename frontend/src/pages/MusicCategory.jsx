/**
 * Music category — every album in one music category.
 *
 * Purpose: the full listing behind a music rail's "see all", with sorting and
 *          paging.
 * Inputs:  the `:id` route parameter; `page` and `sort` query parameters
 * Outputs: JSX
 * Deps:    react-router-dom, @tanstack/react-query, api/catalog,
 *          components/{catalog,ui}, hooks/useDocumentTitle, utils/constants
 *
 * Replaces `music_category.php`. That file is `category.php` with three
 * differences, all preserved here: the cover is square rather than a 216×332
 * poster, there is no IMDb badge (music carries no rank), and each card links to
 * `/sound?id=` — `/music/:id` now. It read the category from
 * `$result['category'][0]`, a one-row result set the API returns as an object.
 *
 * Sorting. The music whitelist is the narrowest of the three: only `id`,
 * `visit_count` and `publish_date`, defaulting to `id`
 * (backend music.service.js MUSIC_CATEGORY_SORTS). The movie list's keys —
 * `imdb_rank`, `created_date`, `modified_date` — would each return HTTP 400 on
 * this endpoint, which is why MUSIC_CATEGORY_SORT_OPTIONS is a separate list in
 * utils/constants.js and must never be swapped for the movie one.
 *
 * Everything else — URL-held state, fixed DESC direction, the count coming from
 * a real `meta.total` — matches pages/Category.jsx; see that file for the
 * reasoning, which is identical.
 */
import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { fetchMusicCategoryItems } from '../api/catalog.js';
import SectionHeader from '../components/catalog/SectionHeader.jsx';
import MusicCard from '../components/catalog/MusicCard.jsx';
import { MediaGrid } from '../components/catalog/MediaGrid.jsx';
import { Select } from '../components/ui/Input.jsx';
import { Alert, EmptyState, PosterSkeleton } from '../components/ui/Feedback.jsx';
import Pagination from '../components/ui/Pagination.jsx';
import useDocumentTitle from '../hooks/useDocumentTitle.js';
import { MUSIC_CATEGORY_SORT_OPTIONS, PAGE_SIZE } from '../utils/constants.js';

/** Server-side default (music.service.js listMusicByCategory, defaultField). */
const DEFAULT_SORT = 'id';

/** The legacy listing was newest-first and offered no direction control. */
const SORT_DIRECTION = 'DESC';

export function MusicCategory() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const rawSort = searchParams.get('sort');
  // A key from the movie list, or any other unknown value, would 400 this
  // endpoint — drop it rather than forward it.
  const sort = MUSIC_CATEGORY_SORT_OPTIONS.some((option) => option.value === rawSort)
    ? rawSort
    : DEFAULT_SORT;

  const { data, isPending, isError, error, refetch, isPlaceholderData } = useQuery({
    queryKey: ['music-category-items', id, page, sort],
    queryFn: () =>
      fetchMusicCategoryItems(id, {
        page,
        limit: PAGE_SIZE,
        item_sort: sort,
        sort_type: SORT_DIRECTION,
      }),
    enabled: Boolean(id),
    placeholderData: keepPreviousData,
  });

  const category = data?.data?.category;
  const items = data?.data?.items ?? [];
  const meta = data?.meta;

  useDocumentTitle(category?.nameFa);

  const updateParams = (changes) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(changes).forEach(([key, value]) => {
      if (value === null) next.delete(key);
      else next.set(key, String(value));
    });
    setSearchParams(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (isError) {
    if (error?.isNotFound) {
      return (
        <EmptyState
          title="این دسته‌بندی پیدا نشد"
          hint="ممکن است این دسته‌بندی حذف شده باشد. از صفحه اصلی ادامه دهید."
          actionLabel="صفحه اصلی"
          actionTo="/"
        />
      );
    }

    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <Alert title="فهرست این دسته‌بندی بارگذاری نشد" onRetry={refetch}>
          {error?.message}
        </Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <SectionHeader title={category?.nameFa ?? '…'} count={meta?.total} countUnit="آلبوم" />

      <div className="mb-5 flex justify-end">
        <div className="w-full sm:w-56">
          <Select
            label="ترتیب نمایش"
            srLabel
            value={sort}
            onChange={(event) => updateParams({ sort: event.target.value, page: 1 })}
            options={MUSIC_CATEGORY_SORT_OPTIONS}
          />
        </div>
      </div>

      {isPending ? (
        <MediaGrid>
          <PosterSkeleton count={PAGE_SIZE} square />
        </MediaGrid>
      ) : items.length === 0 ? (
        <EmptyState
          title="آلبومی در این دسته‌بندی نیست"
          hint="آلبوم مورد نظرتان را جستجو کنید یا به بخش‌های دیگر سر بزنید."
          actionLabel="جستجوی موسیقی"
          actionTo="/musics"
        />
      ) : (
        <div className={isPlaceholderData ? 'opacity-60 transition-opacity' : undefined}>
          <MediaGrid>
            {items.map((music) => (
              <MusicCard key={music._id} music={music} />
            ))}
          </MediaGrid>
        </div>
      )}

      <Pagination meta={meta} onChange={(next) => updateParams({ page: next })} />
    </div>
  );
}

export default MusicCategory;
