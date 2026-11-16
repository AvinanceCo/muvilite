/**
 * Button.
 *
 * Purpose: the panel's only button surface, so every action looks and behaves
 *          the same.
 * Inputs:  variant, size, `to`/`href`, loading, standard button props
 * Outputs: a button, a router Link, or an anchor, styled identically
 * Deps:    react-router-dom
 *
 * Variants map to intent, not colour — there is only one accent colour, and
 * these are its weights:
 *   primary — solid azure. The confirming action: save, add, apply.
 *   danger  — red. Destructive only: delete, remove, revoke.
 *   ghost   — quiet, for navigation and dismissal.
 *   subtle  — a panel-coloured chip, for filters, pagination and row actions.
 *
 * Red must never become a general "primary" colour — if two adjacent buttons are
 * red, one of them is wrong.
 */
import { Link } from 'react-router-dom';

const VARIANTS = {
  primary: 'bg-azure text-ink font-bold hover:brightness-110 active:brightness-95',
  danger: 'bg-signal text-white hover:brightness-110 active:brightness-95',
  ghost: 'text-paper hover:bg-panel-hi border border-transparent hover:border-line',
  subtle: 'bg-panel text-paper border border-line hover:border-azure-dim hover:text-azure',
};

const SIZES = {
  sm: 'h-8 px-2.5 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 gap-2.5',
};

const BASE =
  'inline-flex items-center justify-center rounded-lg transition-colors duration-150 ' +
  'select-none whitespace-nowrap disabled:opacity-40 disabled:pointer-events-none';

/**
 * @param {object} props
 * @param {'primary'|'danger'|'ghost'|'subtle'} [props.variant='subtle']
 * @param {'sm'|'md'|'lg'} [props.size='md']
 * @param {boolean} [props.loading] disables the button and shows a spinner
 * @param {string} [props.to] renders a router Link when present
 * @param {string} [props.href] renders an anchor when present
 */
export function Button({
  variant = 'subtle',
  size = 'md',
  loading = false,
  to,
  href,
  className = '',
  disabled,
  children,
  ...props
}) {
  const classes = `${BASE} ${VARIANTS[variant] ?? VARIANTS.subtle} ${SIZES[size] ?? SIZES.md} ${className}`;

  const content = (
    <>
      {loading ? <Spinner /> : null}
      {children}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={classes} {...props}>
        {content}
      </Link>
    );
  }

  if (href) {
    return (
      <a href={href} className={classes} {...props}>
        {content}
      </a>
    );
  }

  return (
    <button type="button" className={classes} disabled={disabled || loading} {...props}>
      {content}
    </button>
  );
}

/** An inline spinner sized to the current text. */
function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  );
}

/**
 * A square icon-only button for dense table rows.
 * `label` is required — an icon alone is not an accessible name.
 */
export function IconButton({ label, variant = 'subtle', className = '', children, ...props }) {
  return (
    <Button
      variant={variant}
      size="sm"
      aria-label={label}
      title={label}
      className={`w-8 px-0 ${className}`}
      {...props}
    >
      {children}
    </Button>
  );
}

export default Button;
