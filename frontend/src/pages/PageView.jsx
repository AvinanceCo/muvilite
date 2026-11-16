/**
 * Page view — a landing page assembled from its blocks.
 *
 * Purpose: render one editorial page (film, music, clips, …) as the ordered
 *          sequence of rails its admin configured.
 * Inputs:  the `:idOrSlug` route parameter
 * Outputs: JSX
 * Deps:    react-router-dom, @tanstack/react-query, api/catalog,
 *          components/{catalog,ui}, hooks/useDocumentTitle, utils/constants
 *
 * Replaces `page.php`, which called `App::process('page')` and then walked
 * `$data['data']` through a `switch ($item['type'])` with three arms —
 * `category`, `music` and `banner` — each handed to a `PageLayout` method. The
 * switch is the `BLOCK_RENDERERS` table below; the arms are the same three.
 *
 * Rules preserved from backend services/page.service.js:
 *
 *   - Block order is the admin's `item_order`, and item order inside a block is
 *     the block's own `item_sort`/`sort_type`. Both are already applied by the
 *     API, so nothing here sorts or reorders — rendering in array order IS the
 *     business rule.
 *
 *   - Rails are hard-capped at RAIL_ITEM_LIMIT (10) items and carry no `meta`.
 *     There is no total to show and no page to fetch, so a rail header gets a
 *     "see all" target and deliberately NO count: a number here would claim the
 *     ten visible posters are the whole category. The count belongs on
 *     /category/:id, where the endpoint really does report one.
 *
 *   - A block whose target category no longer resolves is dropped server-side
 *     (`blocks: resolved.filter(Boolean)`). An empty `items` array is still
 *     possible — an active category with nothing published in it — and that
 *     block is skipped here rather than rendered as an empty rail, matching the
 *     legacy behaviour where the `foreach` simply produced nothing.
 *
 * The legacy page had no loading, error or empty screen at all: PHP either
 * rendered the markup or emitted a warning. Those three states are new because
 * the data now arrives over a cabin network that can fail.
 */
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchPage } from '../api/catalog.js';
import SectionHeader from '../components/catalog/SectionHeader.jsx';
import BannerRail from '../components/catalog/BannerRail.jsx';
import MovieCard from '../components/catalog/MovieCard.jsx';
import MusicCard from '../components/catalog/MusicCard.jsx';
import { MediaGrid, MediaRail, RailItem } from '../components/catalog/MediaGrid.jsx';
import { Alert, EmptyState, PosterSkeleton } from '../components/ui/Feedback.jsx';
import useDocumentTitle from '../hooks/useDocumentTitle.js';
import { RAIL_ITEM_LIMIT } from '../utils/constants.js';

/** A movie rail: `PageLayout::displayGridItem()`. */
function CategoryBlock({ block }) {
  return (
    <section>
      <SectionHeader title={block.category.nameFa} to={`/category/${block.category.id}`} />
      <MediaRail>
        {block.items.map((movie) => (
          <RailItem key={movie._id}>
            <MovieCard movie={movie} />
          </RailItem>
        ))}
      </MediaRail>
    </section>
  );
}

/** A music rail: `PageLayout::musicDisplayGridItem()`. */
function MusicBlock({ block }) {
  return (
    <section>
      <SectionHeader title={block.category.nameFa} to={`/music-category/${block.category.id}`} />
      {/* Covers are square, so a music tile is wider than a poster at the same
          height — the rail cell widens to match (MediaGrid RailItem). */}
      <MediaRail>
        {block.items.map((music) => (
          <RailItem key={music._id} wide>
            <MusicCard music={music} />
          </RailItem>
        ))}
      </MediaRail>
    </section>
  );
}

/** A banner strip: `PageLayout::displayBanners()`. Never titled, never linked
 *  to a listing — a banner category has no page of its own. */
function BannerBlock({ block }) {
  return (
    <section>
      <BannerRail style={block.style} items={block.items} />
    </section>
  );
}

/** The legacy `switch ($item['type'])`, as a lookup. */
const BLOCK_RENDERERS = {
  category: CategoryBlock,
  music: MusicBlock,
  banner: BannerBlock,
};

export function PageView() {
  const { idOrSlug } = useParams();

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['page', idOrSlug],
    queryFn: () => fetchPage(idOrSlug),
    enabled: Boolean(idOrSlug),
  });

  useDocumentTitle(data?.page?.titleFa, data?.page?.descriptionFa);

  // A block with nothing in it is not a block. Computed before the early
  // returns so the empty-page check and the render agree on what is renderable.
  const blocks = (data?.blocks ?? []).filter(
    (block) => BLOCK_RENDERERS[block.type] && block.items?.length > 0,
  );

  if (isPending) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-3 h-6 w-40 animate-pulse rounded bg-panel" />
        <MediaGrid>
          <PosterSkeleton count={RAIL_ITEM_LIMIT} />
        </MediaGrid>
      </div>
    );
  }

  if (isError) {
    // A missing page is an addressing mistake, not a failure — retrying the same
    // URL cannot fix it, so it gets a way out instead of a retry button.
    if (error?.isNotFound) {
      return (
        <EmptyState
          title="این صفحه پیدا نشد"
          hint="ممکن است نشانی تغییر کرده باشد. از صفحه اصلی شروع کنید."
          actionLabel="صفحه اصلی"
          actionTo="/"
        />
      );
    }

    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <Alert title="این صفحه بارگذاری نشد" onRetry={refetch}>
          {error?.message}
        </Alert>
      </div>
    );
  }

  if (blocks.length === 0) {
    return (
      <EmptyState
        title="این صفحه هنوز محتوایی ندارد"
        hint="بخش‌های دیگر را ببینید یا عنوان مورد نظرتان را جستجو کنید."
        actionLabel="جستجو"
        actionTo="/search"
      />
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <h1 className="sr-only">{data.page.titleFa || data.page.titleEn}</h1>

      <div className="space-y-8 sm:space-y-10">
        {blocks.map((block, index) => {
          const Block = BLOCK_RENDERERS[block.type];
          // Blocks carry no id of their own, and one category can legitimately
          // appear twice on a page, so position is part of the identity.
          return <Block key={`${block.type}-${block.category?.id}-${index}`} block={block} />;
        })}
      </div>
    </div>
  );
}

export default PageView;
