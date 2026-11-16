/**
 * Text input and select.
 *
 * Purpose: form controls with a consistent surface and accessible labelling.
 * Inputs:  label, error, standard input/select props
 * Outputs: a labelled control
 * Deps:    react
 *
 * A visible label is the default; pass `srLabel` when the surrounding layout
 * already names the field (the search bar, for instance) so the label stays
 * available to a screen reader without repeating on screen.
 */
import { useId, forwardRef } from 'react';

const FIELD =
  'w-full rounded-lg bg-panel border border-line px-3 h-11 text-paper ' +
  'placeholder:text-muted transition-colors focus:border-azure outline-none';

export const Input = forwardRef(function Input(
  { label, srLabel = false, error, className = '', id, ...props },
  ref,
) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const errorId = `${fieldId}-error`;

  return (
    <div className="w-full">
      {label ? (
        <label
          htmlFor={fieldId}
          className={srLabel ? 'sr-only' : 'mb-1.5 block text-sm text-muted'}
        >
          {label}
        </label>
      ) : null}
      <input
        ref={ref}
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`${FIELD} ${error ? 'border-signal' : ''} ${className}`}
        {...props}
      />
      {error ? (
        <p id={errorId} className="mt-1.5 text-sm text-signal">
          {error}
        </p>
      ) : null}
    </div>
  );
});

export const Select = forwardRef(function Select(
  { label, srLabel = false, options = [], className = '', id, ...props },
  ref,
) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;

  return (
    <div className="w-full">
      {label ? (
        <label
          htmlFor={fieldId}
          className={srLabel ? 'sr-only' : 'mb-1.5 block text-sm text-muted'}
        >
          {label}
        </label>
      ) : null}
      <select ref={ref} id={fieldId} className={`${FIELD} cursor-pointer ${className}`} {...props}>
        {options.map((option) => (
          <option key={option.value} value={option.value} className="bg-panel">
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
});

export default Input;
