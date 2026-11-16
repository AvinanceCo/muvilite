/**
 * Category — every movie in one category.
 *
 * Purpose: the full listing behind a rail's "see all", with sorting and paging.
 * Inputs:  the `:id` route parameter; `page` and `sort` query parameters
 * Outputs: JSX
 * Deps:    react-router-dom, @tanstack/react-query, api/catalog,
 *          components/{catalog,ui}, hooks/useDocumentTitle, utils/constants
 *
 * Replaces `category.php`, which called `App::process('categories')` and echoed
 * `$result['category']['name_fa']` above a bare `foreach` over `$result['items']`
 * — no sort control, no pagination, no count. The rows it printed are exactly
 * the rows this page prints; what is added is the ability to reach the ones the
 * legacy page silently truncated (backend movie.service.js listMoviesByCategory
 * returns a `meta` block the legacy count query never produced).
 *
 * Sorting. The whitelist is enforced server-side and an unrecognised key returns
 * HTTP 400 rather than falling back (backend movie.service.js CATEGORY_SORTS),
 * so the control is driven by CATEGORY_SORT_OPTIONS and by nothing else. This
 * list is NOT the search page's list and NOT the music list — the three endpoints
 * genuinely accept different keys, which is why utils/constants.js keeps them
 * apart. The server's own default is `created_date`, mirrored here so the
 * control shows the truth on first paint.
 *
 * Direction is fixed at DESC, as the legacy listing was: `sort_type` exists in
 * the API but the legacy site never exposed a control for it, and every option
 * offered here reads naturally newest/highest-first.
 *
 * State lives in the URL, not in component state: a passenger who opens a title
 * and presses back returns to the page and ordering they left, and a shared or
 * reloaded URL reproduces the same screen.
 */
import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { fetchCategoryMovies } from '../api/catalog.js';
import SectionHeader from '../components/catalog/SectionHeader.jsx';
import MovieCard from '../components/catalog/MovieCard.jsx';
import { MediaGrid } from '../components/catalog/MediaGrid.jsx';
import { Select } from '../components/ui/Input.jsx';
import { Alert, EmptyState, PosterSkeleton } from '../components/ui/Feedback.jsx';
import Pagination from '../components/ui/Pagination.jsx';
import useDocumentTitle from '../hooks/useDocumentTitle.js';
import { CATEGORY_SORT_OPTIONS, PAGE_SIZE } from '../utils/constants.js';

/** Server-side default (movie.service.js CATEGORY_SORTS, defaultField). */
const DEFAULT_SORT = 'created_date';

/** The legacy listing was newest-first and offered no direction control. */
const SORT_DIRECTION = 'DESC';

export function Category() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const rawSort = searchParams.get('sort');
  // An unknown key in a hand-edited URL would 400 the request, so it is dropped
  // here rather than forwarded.
  const sort = CATEGORY_SORT_OPTIONS.some((option) => option.value === rawSort)
    ? rawSort
    : DEFAULT_SORT;

  const { data, isPending, isError, error, refetch, isPlaceholderData } = useQuery({
    queryKey: ['category-movies', id, page, sort],
    queryFn: () =>
      fetchCategoryMovies(id, {
        page,
        limit: PAGE_SIZE,
        item_sort: sort,
        sort_type: SORT_DIRECTION,
      }),
    enabled: Boolean(id),
    // Paging keeps the previous grid on screen instead of collapsing to
    // skeletons, so the layout does not jump under the passenger's thumb.
    placeholderData: keepPreviousData,
  });

  const category = data?.data?.category;
  const items = data?.data?.items ?? [];
  const meta = data?.meta;

  useDocumentTitle(category?.nameFa);

  /** Any control change rewrites the URL; the query key follows from it. */
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
    // 404 means the category is missing or inactive — the server checks it
    // before touching movies at all (movie.service.js listMoviesByCategory).
    // Retrying cannot help, so the passenger is offered a way out instead.
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
      {/* The count is legitimate here, unlike on a rail: this endpoint returns a
          real total in `meta`. */}
      <SectionHeader title={category?.nameFa ?? '…'} count={meta?.total} />

      <div className="mb-5 flex justify-end">
        <div className="w-full sm:w-56">
          <Select
            label="ترتیب نمایش"
            srLabel
            value={sort}
            onChange={(event) => updateParams({ sort: event.target.value, page: 1 })}
            options={CATEGORY_SORT_OPTIONS}
          />
        </div>
      </div>

      {isPending ? (
        <MediaGrid>
          <PosterSkeleton count={PAGE_SIZE} />
        </MediaGrid>
      ) : items.length === 0 ? (
        <EmptyState
          title="فیلمی در این دسته‌بندی نیست"
          hint="عنوان مورد نظرتان را جستجو کنید یا به بخش‌های دیگر سر بزنید."
          actionLabel="جستجو"
          actionTo="/search"
        />
      ) : (
        <div className={isPlaceholderData ? 'opacity-60 transition-opacity' : undefined}>
          <MediaGrid>
            {items.map((movie) => (
              <MovieCard key={movie._id} movie={movie} />
            ))}
          </MediaGrid>
        </div>
      )}

      <Pagination meta={meta} onChange={(next) => updateParams({ page: next })} />
    </div>
  );
}

export default Category;
