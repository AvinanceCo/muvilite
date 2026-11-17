import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchPage, fetchMovie } from "../api/catalog.js";
import { fetchPlacementAds } from "../api/ads.js";
import PlacementAdSlot from "../components/ads/PlacementAdSlot.jsx";
import CinemaHero from "../components/catalog/CinemaHero.jsx";
import MovieCard from "../components/catalog/MovieCard.jsx";
import SectionHeader from "../components/catalog/SectionHeader.jsx";
import BannerRail from "../components/catalog/BannerRail.jsx";
import MusicCard from "../components/catalog/MusicCard.jsx";
import { MediaRail, RailItem } from "../components/catalog/MediaGrid.jsx";
import { Alert, Loader, EmptyState } from "../components/ui/Feedback.jsx";
import { useBranding } from "../context/BrandingContext.jsx";
import useDocumentTitle from "../hooks/useDocumentTitle.js";
import Icon from "../components/ui/Icon.jsx";
export default function Home() {
  const { homeTitle, homeDescription } = useBranding();
  useDocumentTitle(null, "دنیایی از فیلم، سریال و سرگرمی");
  const query = useQuery({
    queryKey: ["page", "film"],
    queryFn: () => fetchPage("film"),
  });
  const ads = useQuery({
    queryKey: ["placement-ads"],
    queryFn: () => fetchPlacementAds().catch(() => ({})),
    retry: false,
  });
  const blocks = (query.data?.blocks || []).filter((b) => b.items?.length);
  const movies = [
    ...new Map(
      blocks
        .filter((b) => b.type === "category")
        .flatMap((b) => b.items)
        .map((m) => [m._id ?? m.id, m]),
    ).values(),
  ];
  const first = movies[0];
  const detail = useQuery({
    queryKey: ["movie", first?._id ?? first?.id],
    queryFn: () => fetchMovie(first._id ?? first.id),
    enabled: !!first,
  });
  const heroPool = movies.some((m) => m.hero)
    ? movies.filter((m) => m.hero)
    : movies;
  const heroes = heroPool
    .slice(0, 3)
    .map((m, i) => (i === 0 ? { ...m, ...(detail.data || {}) } : m));
  return (
    <>
      <PlacementAdSlot ads={ads.data?.top} />
      {query.isPending ? (
        <div className="hero-loading">
          <Loader label="در حال آماده‌سازی دنیای تماشا" />
        </div>
      ) : heroes.length ? (
        <CinemaHero movies={heroes} />
      ) : (
        <div className="catalog-container empty-home">
          <h1>{homeTitle}</h1>
          <p>{homeDescription}</p>
        </div>
      )}
      <div className="catalog-container home-catalog">
        <div className="discovery-line">
          <span>
            <i /> امشب چی ببینیم؟
          </span>
          <Link to="/search">
            داستان بعدی‌ات را پیدا کن <Icon name="left" size={16} />
          </Link>
        </div>
        {query.isError && (
          <Alert title="محتوا بارگذاری نشد" onRetry={query.refetch}>
            {query.error?.message}
          </Alert>
        )}
        {!query.isPending && !query.isError && !blocks.length && (
          <EmptyState
            title="داستان‌ها به‌زودی شروع می‌شوند"
            hint="هنوز محتوایی برای این صفحه منتشر نشده است."
            actionLabel="جستجو در کاتالوگ"
            actionTo="/search"
          />
        )}
        {blocks.map((block, i) =>
          block.type === "category" ? (
            <section className="catalog-section" key={`${block.type}-${i}`}>
              <SectionHeader
                title={block.category.nameFa}
                to={`/category/${block.category.id}`}
              />
              <MediaRail>
                {block.items.map((m) => (
                  <RailItem
                    key={m._id ?? m.id}
                    wide={block.presentation === "landscape"}
                  >
                    <MovieCard
                      movie={m}
                      wide={block.presentation === "landscape"}
                    />
                  </RailItem>
                ))}
              </MediaRail>
            </section>
          ) : block.type === "banner" ? (
            <section className="catalog-section editorial-banners" key={i}>
              <BannerRail style={block.style} items={block.items} />
            </section>
          ) : block.type === "music" ? (
            <section className="catalog-section" key={i}>
              <SectionHeader
                title={block.category.nameFa}
                to={`/music-category/${block.category.id}`}
              />
              <MediaRail>
                {block.items.map((m) => (
                  <RailItem key={m._id} wide>
                    <MusicCard music={m} />
                  </RailItem>
                ))}
              </MediaRail>
            </section>
          ) : null,
        )}
        <div className="explore-strip">
          <div>
            <span className="section-eyebrow">دنیای سرگرمی تو</span>
            <h2>فراتر از یک فیلم.</h2>
            <p>یک موسیقی تازه، یک بازی کوتاه، یک حال خوب.</p>
          </div>
          <Link to="/page/music">
            موسیقی <Icon name="left" />
          </Link>
          <Link to="/page/clips">
            کلیپ‌های کوتاه <Icon name="left" />
          </Link>
          <Link to="/games">
            بازی‌ها <Icon name="left" />
          </Link>
        </div>
      </div>
      <PlacementAdSlot ads={ads.data?.bottom} />
    </>
  );
}
