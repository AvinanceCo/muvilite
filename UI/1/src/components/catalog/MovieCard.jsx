import { Link } from "react-router-dom";
import MediaImage from "../media/MediaImage.jsx";
import { PLACEHOLDER_SLOTS } from "../../services/media.js";
import { formatRank } from "../../services/format.js";
import Icon from "../ui/Icon.jsx";
import useWatchlist from "../../hooks/useWatchlist.js";
export default function MovieCard({ movie, wide = false }) {
  const id = movie._id ?? movie.id,
    title = movie.titleFa || movie.titleEn;
  const { has, toggle } = useWatchlist();
  const saved = has(id);
  return (
    <article className={`movie-card ${wide ? "wide-card" : ""}`}>
      <Link
        className="poster-link"
        to={`/movie/${id}`}
        aria-label={`جزئیات ${title}`}
      >
        <MediaImage
          path={
            wide
              ? movie.backdropPath || movie.thumbnailPath || movie.posterPath
              : movie.thumbnailPath || movie.posterPath
          }
          slot={PLACEHOLDER_SLOTS.MOVIE_POSTER}
          alt={title}
          loading="lazy"
          className="poster-art"
        />
        {movie.badge && <span className="poster-badge">{movie.badge}</span>}
        <div className="poster-hover">
          <span className="poster-play">
            <Icon name="play" size={26} />
          </span>
          <span>اطلاعات و تماشا</span>
        </div>
      </Link>
      <button
        onClick={() => toggle(movie)}
        className={`card-save ${saved ? "is-saved" : ""}`}
        aria-label={`${saved ? "حذف" : "افزودن"} ${title} ${saved ? "از" : "به"} فهرست من`}
        aria-pressed={saved}
      >
        <Icon name={saved ? "check" : "plus"} size={19} />
      </button>
      <div className="card-title-row">
        <Link to={`/movie/${id}`}>
          <h3>{title}</h3>
        </Link>
        {formatRank(movie.imdbRank) && (
          <span className="card-score">
            <Icon name="star" size={12} />
            {formatRank(movie.imdbRank)}
          </span>
        )}
      </div>
      {movie.subtitle && <p className="card-subtitle">{movie.subtitle}</p>}
    </article>
  );
}
