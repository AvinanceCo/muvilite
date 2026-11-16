/**
 * Transient notifications.
 *
 * Purpose: confirm that a submission was recorded — or report that it was not —
 *          without moving the page under the passenger.
 * Inputs:  children (the provider), then `toast.success(...)` / `toast.error(...)`
 * Outputs: a fixed stack of notices
 * Deps:    react
 *
 * Why this exists: the poll's confirmation used to render at the top of the
 * page, above a form the passenger has scrolled past by the time they press
 * submit. The button changed label for a moment and nothing else visibly
 * happened, so a successful submission read as a dead button. A notice pinned to
 * the viewport is seen wherever the passenger is standing on the page.
 *
 * The legacy `poll.php` did the same thing with a SweetAlert toast, so this is
 * also the behaviour the passenger had before the migration.
 *
 * Errors do not auto-dismiss. A missed success is harmless; a failure that
 * vanishes before it is read leaves the passenger believing their answers were
 * recorded when they were not.
 *
 * This is the passenger-facing twin of the admin panel's Toast. It is a separate
 * file rather than shared code because the two applications have separate
 * palettes and build graphs; the API is deliberately identical.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const ToastContext = createContext(null);

const AUTO_DISMISS_MS = 5000;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(0);
  // Cleared on unmount so a pending dismissal cannot set state on a dead tree.
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (tone, message, { title } = {}) => {
      const id = nextId.current++;
      setToasts((current) => [...current, { id, tone, message, title }]);

      if (tone !== 'error') {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), AUTO_DISMISS_MS),
        );
      }

      return id;
    },
    [dismiss],
  );

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      timers.current.clear();
    },
    [],
  );

  const value = useMemo(
    () => ({
      success: (message, options) => push('success', message, options),
      error: (message, options) => push('error', message, options),
      info: (message, options) => push('info', message, options),
      dismiss,
    }),
    [push, dismiss],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

/**
 * Azure confirms, red reports a fault — the same two meanings they carry
 * everywhere else on the site. The ground stays `panel` in all three tones so a
 * notice never turns translucent over whatever it happens to cover.
 */
const TONES = {
  success: { border: 'border-azure/50', icon: 'text-azure' },
  error: { border: 'border-signal/50', icon: 'text-signal' },
  info: { border: 'border-line', icon: 'text-muted' },
};

const ICONS = { success: '✓', error: '!', info: 'i' };

function ToastViewport({ toasts, onDismiss }) {
  return (
    <div
      // `polite` so a confirmation does not interrupt a screen reader
      // mid-sentence; failures are announced here too rather than as an
      // assertive alert, because they stay on screen until dismissed.
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col gap-2 sm:inset-x-auto sm:start-4 sm:w-96"
    >
      {toasts.map((toast) => {
        const tone = TONES[toast.tone] ?? TONES.info;

        return (
          <div
            key={toast.id}
            className={`toast-in pointer-events-auto flex items-start gap-3 rounded-panel border bg-panel p-4 shadow-lg shadow-ink/60 ${tone.border}`}
          >
            <span aria-hidden="true" className={`mt-0.5 font-mono text-sm ${tone.icon}`}>
              {ICONS[toast.tone] ?? ICONS.info}
            </span>
            <div className="min-w-0 flex-1">
              {toast.title ? <p className="font-bold">{toast.title}</p> : null}
              {toast.message ? (
                <p className="mt-1 break-words text-sm leading-6 text-muted">{toast.message}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              aria-label="بستن اعلان"
              className="text-muted transition-colors hover:text-paper"
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}

/** @returns {{success: Function, error: Function, info: Function, dismiss: Function}} */
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used inside <ToastProvider>');
  }
  return context;
}

export default ToastProvider;
