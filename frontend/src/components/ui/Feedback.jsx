/**
 * Feedback surfaces — loader, alert, empty state, poster skeleton.
 *
 * Purpose: the four things a page shows when it does not (yet) have content.
 * Inputs:  see each component
 * Outputs: JSX
 * Deps:    ui/Button
 *
 * Copy rule followed here: an error says what happened and what to do about it,
 * and an empty screen is an invitation to act rather than an apology.
 */
import Button from './Button.jsx';

/** Indeterminate loader. `label` is announced; the ring is decorative. */
export function Loader({ label = 'در حال بارگذاری' }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-muted" role="status">
      <span
        aria-hidden="true"
        className="size-5 animate-spin rounded-full border-2 border-line border-t-azure"
      />
      <span className="text-sm">{label}</span>
    </div>
  );
}

/**
 * An error or notice.
 * @param {'error'|'info'} [props.tone='error']
 * @param {() => void} [props.onRetry] shows a retry action when provided
 */
export function Alert({ tone = 'error', title, children, onRetry }) {
  const accent = tone === 'error' ? 'border-signal/40' : 'border-azure-dim';

  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`rounded-panel border ${accent} bg-panel p-4 sm:p-5`}
    >
      {title ? <p className="font-bold">{title}</p> : null}
      {children ? <p className="mt-1 text-sm leading-6 text-muted">{children}</p> : null}
      {onRetry ? (
        <Button size="sm" className="mt-3" onClick={onRetry}>
          تلاش دوباره
        </Button>
      ) : null}
    </div>
  );
}

/**
 * Nothing to show, with a way forward.
 * @param {{title: string, hint?: string, actionLabel?: string, actionTo?: string}} props
 */
export function EmptyState({ title, hint, actionLabel, actionTo }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-20 text-center">
      <p className="text-lg font-bold">{title}</p>
      {hint ? <p className="max-w-sm text-sm leading-6 text-muted">{hint}</p> : null}
      {actionLabel && actionTo ? (
        <Button to={actionTo} variant="primary" size="sm" className="mt-2">
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}

/**
 * Placeholder card grid shown while covers load.
 *
 * `square` matches the album cover; the default matches the 216×332 movie
 * poster the backend generates on upload. Getting this wrong makes the grid
 * jump height when the real images arrive.
 */
export function PosterSkeleton({ count = 6, square = false }) {
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="animate-pulse">
          <div
            className={`${square ? 'aspect-square' : 'aspect-[216/332]'} rounded-panel bg-panel`}
          />
          <div className="mt-2 h-3.5 w-3/4 rounded bg-panel" />
        </div>
      ))}
    </>
  );
}

export default { Loader, Alert, EmptyState, PosterSkeleton };
