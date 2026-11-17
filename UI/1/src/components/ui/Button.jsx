/**
 * Button.
 *
 * Purpose: the site's only button surface, so every action looks and behaves
 *          the same.
 * Inputs:  variant, size, `as` (button | link target), standard button props
 * Outputs: a button or a router Link styled identically
 * Deps:    react-router-dom
 *
 * Variants map to intent, not colour — there is only one accent colour now, and
 * these are its weights. See src/index.css for the rule they implement:
 *   play    — solid azure and the only glow on the site. Starting playback only.
 *   primary — solid azure, no glow. The confirming action on a screen with no
 *             player; never rendered alongside `play`.
 *   ghost   — quiet, for navigation and dismissal.
 *   subtle  — a panel-coloured chip, for filters and pagination.
 */
import { Link } from 'react-router-dom';

const VARIANTS = {
  play:
    'bg-azure text-ink font-bold shadow-lg shadow-azure/25 ' +
    'hover:brightness-110 active:brightness-95',
  primary: 'bg-azure text-ink font-bold hover:brightness-110 active:brightness-95',
  ghost: 'text-paper hover:bg-panel-hi border border-transparent hover:border-line',
  subtle: 'bg-panel text-paper border border-line hover:border-azure-dim hover:text-azure',
};

const SIZES = {
  sm: 'h-9 px-3 text-sm gap-1.5',
  md: 'h-11 px-5 gap-2',
  lg: 'h-12 px-6 text-lg gap-2.5',
};

const BASE =
  'inline-flex items-center justify-center rounded-lg transition-colors duration-150 ' +
  'select-none disabled:opacity-40 disabled:pointer-events-none';

/**
 * @param {object} props
 * @param {'play'|'primary'|'ghost'|'subtle'} [props.variant='subtle']
 * @param {'sm'|'md'|'lg'} [props.size='md']
 * @param {string} [props.to] renders a router Link when present
 * @param {string} [props.href] renders an anchor when present
 */
export function Button({
  variant = 'subtle',
  size = 'md',
  to,
  href,
  className = '',
  children,
  ...props
}) {
  const classes = `${BASE} ${VARIANTS[variant] ?? VARIANTS.subtle} ${SIZES[size] ?? SIZES.md} ${className}`;

  if (to) {
    return (
      <Link to={to} className={classes} {...props}>
        {children}
      </Link>
    );
  }

  if (href) {
    return (
      <a href={href} className={classes} {...props}>
        {children}
      </a>
    );
  }

  return (
    <button type="button" className={classes} {...props}>
      {children}
    </button>
  );
}

export default Button;
