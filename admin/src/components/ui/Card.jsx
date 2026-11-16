/**
 * Panel surfaces and headings.
 *
 * Purpose: the raised container everything on a screen sits in, and the header
 *          that names it.
 * Inputs:  title, description, actions, children
 * Outputs: layout elements
 * Deps:    none
 *
 * `SectionHeader` carries the boarding-pass perforation — the dashed rule from
 * a title to its action. It is the passenger site's section divider, reused
 * here so the two applications share a signature, and it is the ONLY divider
 * between sections: adding a plain `border-b` alongside it doubles the rule.
 */

/** A raised surface. `padded={false}` when the child is a full-bleed table. */
export function Card({ children, className = '', padded = true }) {
  return (
    <section
      className={`rounded-panel border border-line bg-panel ${padded ? 'p-4 sm:p-5' : ''} ${className}`}
    >
      {children}
    </section>
  );
}

/**
 * A title, an optional count or description, and the actions for the section.
 *
 * @param {object} props
 * @param {string} props.title
 * @param {import('react').ReactNode} [props.description]
 * @param {import('react').ReactNode} [props.actions] buttons, right-aligned
 */
export function SectionHeader({ title, description, actions, className = '' }) {
  return (
    <div className={`mb-4 ${className}`}>
      <div className="flex items-center gap-3">
        <h2 className="shrink-0 text-base font-bold text-paper">{title}</h2>
        <span aria-hidden="true" className="perforation" />
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      {description ? <p className="mt-1.5 text-xs text-muted">{description}</p> : null}
    </div>
  );
}

/**
 * The heading at the top of a route — larger than a section header, and the
 * page's single `h1`.
 */
export function PageHeader({ title, description, actions, className = '' }) {
  return (
    <header className={`mb-5 ${className}`}>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="shrink-0 text-xl font-bold text-paper">{title}</h1>
        <span aria-hidden="true" className="perforation" />
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {description ? <p className="mt-2 max-w-3xl text-xs leading-6 text-muted">{description}</p> : null}
    </header>
  );
}

/**
 * A small status or category chip.
 * @param {'neutral'|'active'|'inactive'|'accent'} [props.tone='neutral']
 */
export function Badge({ tone = 'neutral', children, className = '' }) {
  const TONES = {
    neutral: 'border-line bg-panel-hi text-muted',
    active: 'border-verdant/40 bg-verdant-dim/50 text-verdant',
    inactive: 'border-line bg-panel-hi text-muted',
    accent: 'border-azure-dim bg-azure-dim/30 text-azure',
    danger: 'border-signal/40 bg-signal-dim/50 text-signal',
  };

  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs ${TONES[tone] ?? TONES.neutral} ${className}`}
    >
      {children}
    </span>
  );
}

/** The active/inactive badge every list shows for `isActive`. */
export function StatusBadge({ isActive }) {
  return <Badge tone={isActive ? 'active' : 'inactive'}>{isActive ? 'فعال' : 'غیرفعال'}</Badge>;
}

export default Card;
