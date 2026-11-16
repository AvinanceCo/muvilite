/**
 * Loading, empty and error states.
 *
 * Purpose: the three things a data screen shows when it has no data, kept
 *          consistent so every grid and form fails the same way.
 * Inputs:  labels, an error object
 * Outputs: block-level notices
 * Deps:    components/ui/Button
 *
 * The distinction these draw is the one operators care about: "nothing matched"
 * is a normal outcome and gets a quiet notice, while "the request failed" is a
 * fault and gets a retry. Collapsing the two into one "no data" message is the
 * mistake this file exists to prevent.
 */
import { Button } from './Button.jsx';

/** Centred spinner for a route or panel that has not loaded yet. */
export function Loader({ label = 'در حال بارگذاری', compact = false }) {
  return (
    <div
      role="status"
      className={`flex items-center justify-center gap-3 text-muted ${compact ? 'py-4' : 'py-16'}`}
    >
      <span
        aria-hidden="true"
        className="size-5 animate-spin rounded-full border-2 border-line border-t-azure"
      />
      <span className="text-sm">{label}</span>
    </div>
  );
}

/** A short inline spinner for a button row or a table cell. */
export function InlineLoader({ label = 'در حال بارگذاری' }) {
  return (
    <span role="status" className="inline-flex items-center gap-2 text-xs text-muted">
      <span
        aria-hidden="true"
        className="size-3 animate-spin rounded-full border-2 border-line border-t-azure"
      />
      {label}
    </span>
  );
}

/**
 * A successful request that returned nothing.
 * @param {object} props
 * @param {import('react').ReactNode} [props.action] e.g. an "add the first one" button
 */
export function EmptyState({ title = 'موردی یافت نشد', description, action, icon = '📭' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <span aria-hidden="true" className="text-2xl opacity-70">
        {icon}
      </span>
      <p className="text-sm font-bold text-paper">{title}</p>
      {description ? <p className="max-w-sm text-xs text-muted">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

/**
 * A failed request.
 *
 * A 403 is called out separately: it is not a fault to retry but a permission
 * the operator does not hold, and offering "try again" for it wastes their time.
 *
 * @param {object} props
 * @param {{message?: string, status?: number, isForbidden?: boolean}} props.error
 * @param {() => void} [props.onRetry]
 */
export function ErrorState({ error, onRetry, title = 'خطا در دریافت اطلاعات' }) {
  const forbidden = error?.status === 403;

  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <span aria-hidden="true" className="text-2xl">
        {forbidden ? '🔒' : '⚠️'}
      </span>
      <p className="text-sm font-bold text-paper">{forbidden ? 'دسترسی ندارید' : title}</p>
      <p className="max-w-md text-xs text-muted">{error?.message ?? 'خطای ناشناخته'}</p>
      {onRetry && !forbidden ? (
        <Button size="sm" onClick={onRetry}>
          تلاش دوباره
        </Button>
      ) : null}
    </div>
  );
}

/**
 * A static notice inside a form or page.
 * @param {'info'|'success'|'warning'|'danger'} [props.tone='info']
 */
export function Alert({ tone = 'info', title, children, className = '' }) {
  const TONES = {
    info: 'border-line bg-panel text-paper',
    success: 'border-verdant/40 bg-verdant-dim/40 text-paper',
    warning: 'border-azure-dim bg-azure-dim/20 text-paper',
    danger: 'border-signal/40 bg-signal-dim/40 text-paper',
  };

  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={`rounded-lg border px-4 py-3 text-sm ${TONES[tone] ?? TONES.info} ${className}`}
    >
      {title ? <p className="mb-1 font-bold">{title}</p> : null}
      <div className="text-xs leading-6 text-muted">{children}</div>
    </div>
  );
}

export default Loader;
