/**
 * Section header — the boarding-pass perforation.
 *
 * Purpose: title a rail or a listing, and carry its "see all" action.
 * Inputs:  title, optional count, optional action target
 * Outputs: JSX
 * Deps:    react-router-dom, services/format
 *
 * The dashed rule between the title and the action is the site's recurring
 * structural motif — a boarding-pass tear line. It is load-bearing rather than
 * ornamental: it is the only thing separating a section from the one above it,
 * so no other divider is needed.
 *
 * `count` is shown ONLY where the API actually reports a total. Rails have no
 * total — they are hard-capped at 10 items and the endpoint returns no `meta`
 * (backend RAIL_ITEM_LIMIT) — so a rail passes no count rather than showing a
 * number that would imply the rail is the whole collection.
 */
import { Link } from 'react-router-dom';
import { toPersianNumber } from '../../services/format.js';

/**
 * @param {object} props
 * @param {string} props.title
 * @param {number} [props.count] total item count, when the endpoint reports one
 * @param {string} [props.countUnit='عنوان']
 * @param {string} [props.to] "see all" target
 * @param {string} [props.eyebrow] small mono label above the title
 */
export function SectionHeader({ title, count, countUnit = 'عنوان', to, eyebrow }) {
  return (
    <header className="mb-3 flex items-end gap-3">
      <div className="shrink-0">
        {eyebrow ? (
          <p className="mb-1 font-mono text-[0.7rem] uppercase tracking-[0.2em] text-azure">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="text-lg font-bold leading-tight sm:text-xl">{title}</h2>
      </div>

      <span className="perforation mb-2" aria-hidden="true" />

      {Number.isFinite(count) ? (
        <span className="mb-1 shrink-0 text-sm text-muted">
          {toPersianNumber(count)} {countUnit}
        </span>
      ) : null}

      {to ? (
        <Link
          to={to}
          className="mb-1 shrink-0 text-sm text-azure transition-colors hover:text-paper"
        >
          نمایش همه
        </Link>
      ) : null}
    </header>
  );
}

export default SectionHeader;
