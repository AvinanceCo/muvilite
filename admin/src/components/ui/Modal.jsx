/**
 * Modal dialog and delete confirmation.
 *
 * Purpose: a focus-trapped overlay for forms and pickers, and the confirmation
 *          every destructive action goes through.
 * Inputs:  open, onClose, title, children
 * Outputs: a dialog rendered in place
 * Deps:    react
 *
 * Built on the native `<dialog>` element, which gives the focus trap, the
 * top-layer stacking and Escape-to-close without a focus-management library.
 * `showModal()` is called imperatively because that is the only way to enter
 * the top layer — the `open` attribute alone renders a non-modal dialog that
 * the page behind it can still be tabbed into.
 *
 * The legacy panel confirmed deletions with `confirm()` and a `location.href`
 * to `delete.php`. Deletion is a soft delete server-side either way, but it
 * still hides the row from every list, so it keeps a confirmation.
 */
import { useCallback, useEffect, useRef } from 'react';
import { Button } from './Button.jsx';

const SIZES = {
  sm: 'max-w-md',
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
};

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {'sm'|'md'|'lg'} [props.size='md']
 * @param {import('react').ReactNode} [props.footer]
 */
export function Modal({ open, onClose, title, description, size = 'md', footer, children }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // Escape fires the dialog's own `cancel`; route it through onClose so the
  // parent's state stays in step with what is on screen.
  const handleCancel = useCallback(
    (event) => {
      event.preventDefault();
      onClose();
    },
    [onClose],
  );

  return (
    <dialog
      ref={dialogRef}
      onCancel={handleCancel}
      onClose={onClose}
      // Clicking the backdrop means clicking the dialog element itself, since
      // the content sits in a child. Anything inside must not close it.
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
      className={
        'm-auto w-[calc(100vw-2rem)] rounded-panel border border-line bg-panel p-0 ' +
        'text-paper backdrop:bg-ink/80 backdrop:backdrop-blur-sm ' +
        `${SIZES[size] ?? SIZES.md}`
      }
    >
      <div className="flex max-h-[85vh] flex-col" dir="rtl">
        <header className="flex items-start gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-paper">{title}</h2>
            {description ? <p className="mt-1 text-xs text-muted">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن"
            className="rounded-md px-2 py-1 text-muted transition-colors hover:bg-panel-hi hover:text-paper"
          >
            ✕
          </button>
        </header>

        <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer ? (
          <footer className="flex items-center justify-end gap-2 border-t border-line px-5 py-3">
            {footer}
          </footer>
        ) : null}
      </div>
    </dialog>
  );
}

/**
 * The confirmation in front of every destructive action.
 *
 * @param {object} props
 * @param {string} [props.itemLabel] the thing being acted on, quoted in the body
 * @param {boolean} [props.loading]  keeps the dialog open while the request runs
 * @param {string} [props.note]      replaces the small print. The default says
 *        the row stays in the database and can be restored, which is true of
 *        every soft delete — but not the whole truth where deleting also removes
 *        files from disk (a game's bundle), so such a caller says so instead.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = 'حذف مورد',
  message,
  itemLabel,
  confirmLabel = 'حذف',
  loading = false,
  note = 'این مورد از فهرست‌ها حذف می‌شود اما در پایگاه داده باقی می‌ماند و توسط مدیر سامانه قابل بازیابی است.',
}) {
  return (
    <Modal
      open={open}
      onClose={loading ? () => {} : onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            انصراف
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm leading-7 text-paper">
        {message ?? (
          <>
            آیا از حذف {itemLabel ? <b className="text-azure">«{itemLabel}»</b> : 'این مورد'} مطمئن
            هستید؟
          </>
        )}
      </p>
      <p className="mt-2 text-xs leading-6 text-muted">{note}</p>
    </Modal>
  );
}

export default Modal;
