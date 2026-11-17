import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchMovie, fetchSimilarMovies } from "../api/catalog.js";
import { mediaUrl, PLACEHOLDER_SLOTS } from "../services/media.js";
import MediaImage from "../components/media/MediaImage.jsx";
import {
  formatRank,
  formatRuntime,
  formatYear,
  toParagraphs,
} from "../services/format.js";
import useDocumentTitle from "../hooks/useDocumentTitle.js";
import useWatchlist from "../hooks/useWatchlist.js";
import SectionHeader from "../components/catalog/SectionHeader.jsx";
import MovieCard from "../components/catalog/MovieCard.jsx";
import { MediaRail, RailItem } from "../components/catalog/MediaGrid.jsx";
import { Alert, EmptyState, Loader } from "../components/ui/Feedback.jsx";
import Icon from "../components/ui/Icon.jsx";
export default function MovieDetail() {
  const { id } = useParams();
  const { has, toggle } = useWatchlist();
  const query = useQuery({
    queryKey: ["movie", id],
    queryFn: () => fetchMovie(id),
  });
  const movie = query.data;
  const similar = useQuery({
    queryKey: ["movie", id, "similar"],
    queryFn: () => fetchSimilarMovies(id),
    enabled: query.isSuccess,
  });
  useDocumentTitle(movie?.titleFa, movie?.descriptionFa);
  if (query.isPending) return <Loader label="در حال بارگذاری عنوان" />;
  if (query.error?.isNotFound)
    return (
      <EmptyState
        title="این عنوان در دسترس نیست"
        actionLabel="کشف فیلم‌ها"
        actionTo="/search"
      />
    );
  if (query.isError)
    return (
      <div className="catalog-container">
        <Alert title="اطلاعات بارگذاری نشد" onRetry={query.refetch}>
          {query.error.message}
        </Alert>
      </div>
    );
  const saved = has(id),
    poster = movie.posterPath || movie.thumbnailPath;
  return (
    <article className="detail-page">
      <header className="detail-hero">
        <img
          className="detail-backdrop"
          src={mediaUrl(movie.backdropPath || poster)}
          alt=""
        />
        <div className="detail-shade" />
        <div className="catalog-container detail-intro">
          <Link className="detail-back" to="/">
            <Icon name="right" size={16} />
            بازگشت به خانه
          </Link>
          <div className="detail-intro-grid">
            <MediaImage
              path={poster}
              slot={PLACEHOLDER_SLOTS.MOVIE_POSTER}
              alt={movie.titleFa}
              className="detail-poster"
            />
            <div className="detail-copy">
              <p className="section-eyebrow">
                {movie.genres?.map((g) => g.nameFa || g.nameEn).join(" • ")}
              </p>
              <h1>{movie.titleFa || movie.titleEn}</h1>
              {movie.titleEn && (
                <p className="detail-english" dir="ltr">
                  {movie.titleEn}
                </p>
              )}
              <div className="hero-meta">
                {formatRank(movie.imdbRank) && (
                  <span className="hero-rating">
                    <b>IMDb</b> {formatRank(movie.imdbRank)}
                  </span>
                )}
                {formatYear(movie.publishYear) && (
                  <span>{formatYear(movie.publishYear)}</span>
                )}
                {movie.country?.fa && <span>{movie.country.fa}</span>}
                {formatRuntime(movie.movieLength) && (
                  <span>{formatRuntime(movie.movieLength)}</span>
                )}
                {movie.ageRange?.nameFa && (
                  <span className="age-label">{movie.ageRange.nameFa}</span>
                )}
              </div>
              <p className="detail-summary">
                {toParagraphs(movie.descriptionFa)[0]}
              </p>
              <div className="hero-buttons">
                <Link to={`/player/${id}`} className="cinema-button primary">
                  <Icon name="play" size={19} />
                  {movie.demo ? "پخش ویدئوی نمونه" : "شروع تماشا"}
                </Link>
                <button
                  className={`cinema-button secondary ${saved ? "is-saved" : ""}`}
                  onClick={() => toggle(movie)}
                  aria-pressed={saved}
                >
                  <Icon name={saved ? "check" : "plus"} />
                  {saved ? "در فهرست من" : "افزودن به فهرست من"}
                </button>
              </div>
              {movie.demo && (
                <p className="demo-disclosure">
                  در این نسخه نمایشی، پلیر با یک ویدئوی آزاد از طبیعت آزمایش
                  می‌شود؛ فیلم اصلی در دسترس نیست.
                </p>
              )}
            </div>
          </div>
        </div>
      </header>
      <div className="catalog-container detail-body">
        <section>
          <SectionHeader title={`درباره ${movie.titleFa || movie.titleEn}`} />
          <div className="storyline">
            {toParagraphs(movie.descriptionFa).map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </section>
        {movie.casts?.length > 0 && (
          <section>
            <SectionHeader title="بازیگران و عوامل" />
            <div className="cast-list">
              {movie.casts.map((c) => (
                <div key={c.id}>
                  <MediaImage
                    path={c.photoPath}
                    slot={PLACEHOLDER_SLOTS.CAST_PHOTO}
                    alt={c.fullnameFa || c.fullnameEn}
                  />
                  <h3>{c.fullnameFa || c.fullnameEn}</h3>
                  <p>{c.roleLabel?.fa}</p>
                </div>
              ))}
            </div>
          </section>
        )}
        {similar.data?.length > 0 && (
          <section>
            <SectionHeader title="اگر این داستان را دوست داشتید" />
            <MediaRail>
              {similar.data.map((m) => (
                <RailItem key={m._id ?? m.id}>
                  <MovieCard movie={m} />
                </RailItem>
              ))}
            </MediaRail>
          </section>
        )}
      </div>
    </article>
  );
}
