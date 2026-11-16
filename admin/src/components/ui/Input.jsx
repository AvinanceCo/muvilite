/**
 * Form input surfaces.
 *
 * Purpose: text, number, textarea, select, checkbox and switch controls that
 *          share one visual language and one error treatment.
 * Inputs:  standard control props, plus `invalid`
 * Outputs: styled controls; all forward their ref for react-hook-form
 * Deps:    react
 *
 * Every control forwards its ref because react-hook-form's `register()`
 * attaches one — a control that swallows the ref registers as permanently
 * empty, which looks like a validation bug rather than a wiring bug.
 *
 * `invalid` only paints the control. The message itself belongs to `Field`
 * (components/form/Field.jsx), which owns the label/description/error layout.
 */
import { forwardRef } from 'react';

const CONTROL =
  'w-full rounded-lg border bg-panel px-3 text-paper placeholder:text-muted/60 ' +
  'transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed';

const BORDER = 'border-line focus:border-azure-dim';
const BORDER_INVALID = 'border-signal/70 focus:border-signal';

const borderFor = (invalid) => (invalid ? BORDER_INVALID : BORDER);

export const Input = forwardRef(function Input(
  { invalid = false, className = '', type = 'text', ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      aria-invalid={invalid || undefined}
      className={`${CONTROL} ${borderFor(invalid)} h-10 text-sm ${className}`}
      {...props}
    />
  );
});

/**
 * Latin-data input — ids, codes, URLs, IP addresses, slugs.
 * Forced LTR inside an RTL page: an ObjectId or a URL rendered right-to-left is
 * unreadable, and the caret jumps while typing.
 */
export const CodeInput = forwardRef(function CodeInput({ className = '', ...props }, ref) {
  return <Input ref={ref} dir="ltr" className={`font-mono ${className}`} {...props} />;
});

export const Textarea = forwardRef(function Textarea(
  { invalid = false, className = '', rows = 4, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={invalid || undefined}
      className={`${CONTROL} ${borderFor(invalid)} resize-y py-2 text-sm leading-6 ${className}`}
      {...props}
    />
  );
});

/**
 * @param {object} props
 * @param {{value: string|number, label: string}[]} [props.options]
 * @param {string} [props.placeholder] renders as an empty-valued first option
 */
export const Select = forwardRef(function Select(
  { invalid = false, className = '', options = [], placeholder, children, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      aria-invalid={invalid || undefined}
      className={`${CONTROL} ${borderFor(invalid)} h-10 cursor-pointer text-sm ${className}`}
      {...props}
    >
      {placeholder ? <option value="">{placeholder}</option> : null}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
      {children}
    </select>
  );
});

/** A labelled checkbox. The label is the hit target, so it is not optional. */
export const Checkbox = forwardRef(function Checkbox(
  { label, className = '', ...props },
  ref,
) {
  return (
    <label className={`inline-flex cursor-pointer items-center gap-2 text-sm ${className}`}>
      <input
        ref={ref}
        type="checkbox"
        className="size-4 cursor-pointer accent-azure"
        {...props}
      />
      <span className="text-paper">{label}</span>
    </label>
  );
});

/**
 * The status toggle — the bootstrap-toggle the legacy grids used in their
 * «وضعیت» column.
 *
 * Controlled and uncontrolled at once by design: it reflects `checked`
 * immediately while the PATCH is in flight, so the switch does not visibly
 * snap back and forth on a slow connection. The caller reverts it if the
 * request fails.
 *
 * @param {object} props
 * @param {boolean} props.checked
 * @param {(next: boolean) => void} props.onChange
 * @param {string} props.label  accessible name; never rendered
 */
export function Switch({ checked, onChange, label, disabled = false, className = '' }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full ' +
        'border transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 ' +
        (checked ? 'border-verdant/50 bg-verdant-dim' : 'border-line bg-panel') +
        ` ${className}`
      }
    >
      <span
        aria-hidden="true"
        className={
          'absolute size-4 rounded-full transition-all duration-150 ' +
          (checked ? 'right-1 bg-verdant' : 'right-6 bg-muted')
        }
      />
    </button>
  );
}

export default Input;
