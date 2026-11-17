/**
 * Game card.
 *
 * Purpose: one game tile, used by the games page and by the games rail on the
 *          film search.
 * Inputs:  a game object from `GET /api/games`
 * Outputs: a linked tile with the game's title and genre
 * Deps:    react-router-dom, utils/constants
 *
 * No legacy counterpart — the legacy portal had no games. The tile is Playva's
 * (`playva-front/components/GameCard.js`): AN EMOJI ON A GRADIENT, not an image.
 * That is the whole of a game's artwork — `emoji`, `color1`, `color2` on the
 * record — and it is why this card, alone among the three, does not draw through
 * MediaImage and has no placeholder slot: there is no file that could be
 * missing.
 *
 * The gradient is the game's own artwork and is drawn as given, exactly as an
 * advertiser's creative is; the site's palette applies to the frame around it,
 * not to it. What Playva's card carried that this one does not is a solid
 * «بازی کن» button on every tile. A screen here gets one solid fill
 * (src/index.css), so the tile itself is the control, as it is on the film and
 * music cards.
 *
 * Opens the play screen directly, the way a poster opens the player.
 */
import { Link } from 'react-router-dom';
import { GAME_POPULAR_CLICKS } from '../../utils/constants.js';

/**
 * @param {{game: object}} props
 */
export function GameCard({ game }) {
  const title = game.titleFa;
  const genre = game.genre?.nameFa;

  return (
    <Link
      to={`/game/${game._id ?? game.id}`}
      className="group block focus-visible:outline-none"
      aria-label={`بازی ${title}`}
    >
      <div className="relative overflow-hidden rounded-panel border border-line bg-panel transition-colors group-hover:border-azure-dim group-focus-visible:border-azure">
        {/* 16∶10, Playva's tile shape. Two fixed emoji sizes are enough: the
            grid and the rail both keep a tile between roughly 130 and 190px
            wide at every breakpoint. */}
        <div
          aria-hidden="true"
          className="grid aspect-16/10 w-full place-items-center text-4xl leading-none transition-transform duration-300 group-hover:scale-[1.03] sm:text-5xl"
          style={{ backgroundImage: `linear-gradient(135deg, ${game.color1}, ${game.color2})` }}
        >
          {game.emoji}
        </div>

        {game.clicks >= GAME_POPULAR_CLICKS ? (
          <span className="absolute bottom-1.5 left-1.5 rounded bg-ink/85 px-1.5 py-0.5 text-xs text-azure">
            پرطرفدار
          </span>
        ) : null}
      </div>

      <h3 className="mt-2 truncate text-sm leading-6 text-paper transition-colors group-hover:text-azure">
        {title}
      </h3>
      {genre ? <p className="truncate text-xs leading-5 text-muted">{genre}</p> : null}
    </Link>
  );
}

export default GameCard;
