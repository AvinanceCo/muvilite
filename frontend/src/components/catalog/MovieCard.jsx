/**
 * Movie card.
 *
 * Purpose: one poster tile, used by rails, listings, search results and the
 *          similar-titles strip.
 * Inputs:  a movie card object from any list endpoint
 * Outputs: a linked poster with title and rank
 * Deps:    react-router-dom, services/{media,format}
 *
 * The card projection is identical across every list endpoint
 * (backend MOVIE_CARD_FIELDS): _id, titleFa, titleEn, imdbRank, posterPath,
 * thumbnailPath, visitCount. Nothing else is available here — runtime, genres
 * and country live on the detail endpoint only.
 *
 * `thumbnailPath` is the 216×332 crop the backend generates on upload; the full
 * poster is the fallback when a thumbnail was never produced. A title with
 * neither — or one whose file has gone missing from disk — draws the
 * `moviePoster` placeholder an operator uploaded, and the bundled holder image
 * only when no placeholder is configured either (components/media/MediaImage).
 *
 * The card opens the player directly (`/player/:id`) rather than the detail
 * page: one tap from a poster to picture. The detail page is still there and
 * still routed — the player's back control and its two error states link to
 * `/movie/:id` — it is simply no longer what a poster click leads to. Titles
 * with no video file on record are safe to open this way: the player renders
 * its "file not uploaded" notice with a link through to the detail page.
 */
import { Link } from 'react-router-dom';
import { PLACEHOLDER_SLOTS } from '../../services/media.js';
import MediaImage from '../media/MediaImage.jsx';
import { formatRank } from '../../services/format.js';

/**
 * @param {{movie: object}} props
 */
export function MovieCard({ movie }) {
  const title = movie.titleFa || movie.titleEn;
  const rank = formatRank(movie.imdbRank);

  return (
    <Link
      to={`/player/${movie._id ?? movie.id}`}
      className="group block focus-visible:outline-none"
      aria-label={`پخش ${title}`}
    >
      <div className="relative overflow-hidden rounded-panel border border-line bg-panel transition-colors group-hover:border-azure-dim group-focus-visible:border-azure">
        <MediaImage
          path={movie.thumbnailPath ?? movie.posterPath}
          slot={PLACEHOLDER_SLOTS.MOVIE_POSTER}
          loading="lazy"
          decoding="async"
          className="aspect-[216/332] w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />

        {rank ? (
          <span className="absolute bottom-1.5 left-1.5 rounded bg-ink/85 px-1.5 py-0.5 font-mono text-xs text-azure">
            {rank}
          </span>
        ) : null}
      </div>

      <h3 className="mt-2 truncate text-sm leading-6 text-paper transition-colors group-hover:text-azure">
        {title}
      </h3>
    </Link>
  );
}

export default MovieCard;
