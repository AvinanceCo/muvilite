/**
 * Form field layout and server-error mapping.
 *
 * Purpose: pair a label, a control, a hint and an error message consistently,
 *          and land the API's 422 response on the fields that caused it.
 * Inputs:  label, error, children
 * Outputs: a labelled field
 * Deps:    react-hook-form (for the helper), components/ui/Feedback
 *
 * A validation failure comes back as
 *   { success: false, message: 'Validation failed',
 *     errors: [{ field, location, message }] }
 * so `applyServerErrors` walks that array into react-hook-form. Anything whose
 * `field` has no matching input — a params or query error, or a field the form
 * does not render — is returned to the caller so it can be shown as a toast
 * rather than swallowed silently.
 */
import { useId } from 'react';
import { Alert } from '../ui/Feedback.jsx';

/**
 * @param {object} props
 * @param {string} props.label
 * @param {boolean} [props.required] renders the asterisk; does not enforce
 * @param {string} [props.hint]      guidance shown under the control
 * @param {{message?: string}} [props.error]
 * @param {(props: {id: string, invalid: boolean}) => import('react').ReactNode |
 *         import('react').ReactNode} props.children
 */
export function Field({ label, required = false, hint, error, className = '', children }) {
  const id = useId();
  const invalid = Boolean(error);

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-xs font-bold text-muted">
        {label}
        {required ? (
          <span aria-hidden="true" className="ms-1 text-signal">
            *
          </span>
        ) : null}
      </label>

      {typeof children === 'function' ? children({ id, invalid }) : children}

      {error?.message ? (
        <p role="alert" className="text-xs text-signal">
          {error.message}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted/80">{hint}</p>
      ) : null}
    </div>
  );
}

/** A responsive grid for a form's fields. */
export function FieldGrid({ columns = 2, children, className = '' }) {
  const COLUMNS = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  };

  return <div className={`grid gap-4 ${COLUMNS[columns] ?? COLUMNS[2]} ${className}`}>{children}</div>;
}

/** The sticky save/cancel bar at the foot of every form. */
export function FormActions({ children, className = '' }) {
  return (
    <div
      className={`sticky bottom-0 -mx-4 mt-6 flex items-center justify-end gap-2 border-t border-line bg-panel/95 px-4 py-3 backdrop-blur sm:-mx-5 sm:px-5 ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * The banner for an error that belongs to no single field — a 409 duplicate, a
 * 403, a network failure.
 */
export function FormError({ error }) {
  if (!error) return null;

  return (
    <Alert tone="danger" title="ثبت انجام نشد" className="mb-4">
      {error.message}
    </Alert>
  );
}

/**
 * Routes an ApiRequestError's field errors into react-hook-form.
 *
 * @param {{fieldErrors: Record<string,string>}} error
 * @param {(name: string, error: object) => void} setError  from useForm
 * @param {string[]} knownFields  the names this form actually renders
 * @returns {string[]} messages for fields the form does not render, which the
 *          caller should surface some other way
 */
export function applyServerErrors(error, setError, knownFields = []) {
  const fieldErrors = error?.fieldErrors ?? {};
  const unmatched = [];
  const known = new Set(knownFields);

  for (const [field, message] of Object.entries(fieldErrors)) {
    if (known.size === 0 || known.has(field)) {
      setError(field, { type: 'server', message });
    } else {
      unmatched.push(`${field}: ${message}`);
    }
  }

  return unmatched;
}

export default Field;
