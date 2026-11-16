/**
 * Game tile — a game's card artwork.
 *
 * Purpose: draw a game the way the passenger site does, in the grid's first
 *          column and as the live preview beside the form.
 * Inputs:  emoji, the two gradient colours, a size
 * Outputs: JSX
 * Deps:    utils/constants
 *
 * A game has no image. Its artwork IS these three fields — an emoji on a
 * gradient from `color1` to `color2` — which is Playva's design and the reason
 * this component exists instead of the `Thumb` the other grids use: there is no
 * file to point one at.
 *
 * Keep it in step with the passenger site's components/catalog/GameCard.jsx.
 * The preview is only worth showing if it is what a passenger will see.
 */
import { GAME_DEFAULTS } from '../../utils/constants.js';

const SIZES = {
  // The grid's thumbnail.
  sm: 'h-9 w-14 rounded-md text-xl',
  // The form's preview, at the passenger card's own 16∶10.
  lg: 'aspect-16/10 w-full rounded-panel text-6xl',
};

/**
 * @param {object} props
 * @param {string} [props.emoji]
 * @param {string} [props.color1]
 * @param {string} [props.color2]
 * @param {'sm'|'lg'} [props.size='sm']
 */
export function GameTile({ emoji, color1, color2, size = 'sm', className = '' }) {
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center border border-line leading-none ${SIZES[size] ?? SIZES.sm} ${className}`}
      style={{
        backgroundImage: `linear-gradient(135deg, ${color1 || GAME_DEFAULTS.color1}, ${color2 || GAME_DEFAULTS.color2})`,
      }}
    >
      {emoji || GAME_DEFAULTS.emoji}
    </span>
  );
}

export default GameTile;
