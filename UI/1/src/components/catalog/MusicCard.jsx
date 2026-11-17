/**
 * Music card.
 *
 * Purpose: one album tile, used by music rails, the music category listing and
 *          music search.
 * Inputs:  a music card object from any list endpoint
 * Outputs: a linked square cover with its display title
 * Deps:    react-router-dom, services/media
 *
 * The card projection (backend MUSIC_CARD_FIELDS) is _id, fullnameFa/En,
 * albumFa/En, coverPath, visitCount. The services already join artist and album
 * into `titleFa`/`titleEn` — the legacy CONCAT(fullname, ' - ', album) — so the
 * joined value is preferred and the parts are only a fallback.
 *
 * Covers are square, unlike the 216×332 movie poster: the legacy music listing
 * used a 200×200 placeholder (music.php:46). That shape is now the recommended
 * size of the `musicCover` placeholder slot, which is what an album with no
 * cover of its own draws here.
 */
import { Link } from 'react-router-dom';
import { PLACEHOLDER_SLOTS } from '../../services/media.js';
import MediaImage from '../media/MediaImage.jsx';

/**
 * @param {{music: object}} props
 */
export function MusicCard({ music }) {
  const title =
    music.titleFa ||
    [music.fullnameFa, music.albumFa].filter(Boolean).join(' - ') ||
    music.titleEn ||
    music.fullnameEn;

  return (
    <Link
      to={`/music/${music._id ?? music.id}`}
      className="group block focus-visible:outline-none"
      aria-label={title}
    >
      <div className="overflow-hidden rounded-panel border border-line bg-panel transition-colors group-hover:border-azure-dim group-focus-visible:border-azure">
        <MediaImage
          path={music.coverPath}
          slot={PLACEHOLDER_SLOTS.MUSIC_COVER}
          loading="lazy"
          decoding="async"
          className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
      </div>

      <h3 className="mt-2 truncate text-sm leading-6 text-paper transition-colors group-hover:text-azure">
        {title}
      </h3>
    </Link>
  );
}

export default MusicCard;
