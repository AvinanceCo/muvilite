import { useState } from "react";
import { Link } from "react-router-dom";
import { mediaUrl } from "../../services/media.js";
import Icon from "../ui/Icon.jsx";
import useWatchlist from "../../hooks/useWatchlist.js";
export default function CinemaHero({ movies = [] }) {
  const [index, setIndex] = useState(0);
  const { has, toggle } = useWatchlist();
  const i = Math.min(index, Math.max(0, movies.length - 1)),
    movie = movies[i];

  if (!movie) return null;
  const id = movie._id ?? movie.id;
  const saved = has(id);
  return (
    <section
      className="cinema-hero"
      aria-roledescription="اسلایدر"
      aria-label="پیشنهادهای تماشا"
    >
      <img
        key={id}
        className="hero-art"
        src={mediaUrl(
          movie.backdropPath || movie.posterPath || movie.thumbnailPath,
        )}
        alt=""
        fetchPriority="high"
      />
      <div className="hero-shade" />
      <div className="hero-inner">
        <div className="hero-copy" key={`copy-${id}`}>
          <div className="hero-eyebrow">
            <span />
            پیشنهاد مووی برای تماشا{" "}
            <span className="hero-quality">{movie.quality || "منتخب"}</span>
          </div>
          {movie.titleEn && (
            <p className="hero-english" dir="ltr">
              {movie.titleEn}
            </p>
          )}
          <h1>{movie.titleFa || movie.titleEn}</h1>
          {movie.tagline && <p className="hero-tagline">{movie.tagline}</p>}
          <div className="hero-meta">
            {movie.imdbRank > 0 && (
              <span className="hero-rating">
                <b>IMDb</b> {movie.imdbRank}
              </span>
            )}
            {movie.publishYear && (
              <span>
                {movie.publishYear.toLocaleString("fa-IR", {
                  useGrouping: false,
                })}
              </span>
            )}
            {movie.subtitle && <span>{movie.subtitle}</span>}
            {movie.ageRange?.nameFa && (
              <span className="age-label">{movie.ageRange.nameFa}</span>
            )}
          </div>
          {movie.descriptionFa && (
            <p className="hero-description">{movie.descriptionFa}</p>
          )}
          <div className="hero-buttons">
            <Link to={`/player/${id}`} className="cinema-button primary">
              <Icon name="play" size={19} />
              {movie.demo ? "پخش ویدئوی نمونه" : "شروع تماشا"}
            </Link>
            <Link to={`/movie/${id}`} className="cinema-button secondary">
              <Icon name="info" size={19} />
              اطلاعات بیشتر
            </Link>
            <button
              className={`hero-save ${saved ? "is-saved" : ""}`}
              onClick={() => toggle(movie)}
              aria-pressed={saved}
              aria-label={saved ? "حذف از فهرست من" : "افزودن به فهرست من"}
            >
              <Icon name={saved ? "check" : "plus"} />
            </button>
          </div>
        </div>
        <div className="hero-bottom">
          <div className="hero-indicators">
            {movies.map((m, n) => (
              <button
                key={m._id ?? m.id}
                onClick={() => setIndex(n)}
                aria-label={`نمایش ${m.titleFa || m.titleEn}`}
                aria-pressed={i === n}
                className={i === n ? "active" : ""}
              />
            ))}
          </div>
          <div className="hero-pagination">
            <span>
              {String(i + 1).padStart(2, "0")}{" "}
              <em>/ {String(movies.length).padStart(2, "0")}</em>
            </span>
            <button
              className="icon-button"
              aria-label="اسلاید قبلی"
              onClick={() => setIndex((i + movies.length - 1) % movies.length)}
            >
              <Icon name="right" />
            </button>
            <button
              className="icon-button"
              aria-label="اسلاید بعدی"
              onClick={() => setIndex((i + 1) % movies.length)}
            >
              <Icon name="left" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
