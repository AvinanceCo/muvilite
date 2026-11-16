/**
 * Transient notifications.
 *
 * Purpose: confirm that a write succeeded, or report that it failed, without
 *          taking over the screen.
 * Inputs:  children (the provider), then `toast.success(...)` / `toast.error(...)`
 * Outputs: a fixed stack of notices
 * Deps:    react
 *
 * Legacy counterpart: `FlashMessages`, a session-backed queue rendered at the
 * top of each page after a redirect. Nothing redirects here, so the notice is
 * shown directly.
 *
 * Errors do not auto-dismiss. A success can be missed harmlessly; a failure
 * that vanishes before it is read leaves the operator believing a write
 * succeeded when it did not.
 */
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

const ToastContext = createContext(null);

const AUTO_DISMISS_MS = 4000;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (tone, message, { title } = {}) => {
      const id = nextId.current++;
      setToasts((current) => [...current, { id, tone, message, title }]);

      if (tone !== 'error') {
        setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
      }

      return id;
    },
    [dismiss],
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

const TONES = {
  success: 'border-verdant/50 bg-verdant-dim',
  error: 'border-signal/50 bg-signal-dim',
  info: 'border-line bg-panel-hi',
};

const ICONS = { success: '✓', error: '!', info: 'i' };

function ToastViewport({ toasts, onDismiss }) {
  return (
    <div
      // `polite` so a success does not interrupt a screen reader mid-sentence;
      // failures are also announced here rather than as an assertive alert,
      // because they stay on screen until dismissed.
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 left-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex items-start gap-3 rounded-lg border px-4 py-3 shadow-lg shadow-ink/50 ${TONES[toast.tone] ?? TONES.info}`}
        >
          <span aria-hidden="true" className="mt-0.5 font-mono text-xs text-paper opacity-70">
            {ICONS[toast.tone] ?? ICONS.info}
          </span>
          <div className="min-w-0 flex-1">
            {toast.title ? <p className="text-sm font-bold text-paper">{toast.title}</p> : null}
            <p className="break-words text-xs leading-6 text-paper">{toast.message}</p>
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
      ))}
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
