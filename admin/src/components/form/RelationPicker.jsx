/**
 * Relation editor.
 *
 * Purpose: attach and detach many-to-many links — a movie's categories and
 *          cast credits, a music entry's categories, a banner's categories.
 * Inputs:  the current rows, an option list or a search, and add/remove calls
 * Outputs: a list of chips with an add control
 * Deps:    components/ui/*, hooks/useDebouncedValue
 *
 * Legacy counterpart: `views/movies/categories.php` and `movies/casts.php`,
 * which posted to `?@=add` / `?@=remove` and reloaded a fragment. Relations are
 * saved IMMEDIATELY here, not with the parent form — that matches the legacy
 * behaviour and the API, where each is its own endpoint, and it means an
 * abandoned form does not leave half-applied links.
 *
 * Adding a relation that already exists returns 409. The server revives a
 * previously removed pair rather than colliding, so the only way to see that
 * error is a genuine duplicate, which is reported plainly.
 */
import { useState } from 'react';
import { Button, IconButton } from '../ui/Button.jsx';
import { Select } from '../ui/Input.jsx';
import { Badge } from '../ui/Card.jsx';
import { InlineLoader } from '../ui/Feedback.jsx';
import { useToast } from '../ui/Toast.jsx';

/**
 * @param {object} props
 * @param {{id: string, label: string, meta?: string}[]} props.rows current links
 * @param {{value: string, label: string}[]} props.options  what can be added
 * @param {(value: string) => Promise<unknown>} props.onAdd
 * @param {(row: object) => Promise<unknown>} props.onRemove
 * @param {boolean} [props.disabled]  true until the parent record exists
 * @param {string} [props.disabledHint] why. Defaults to the save-first rule,
 *        which is the reason on every screen but the movie form's categories —
 *        those are also blocked while an unsaved «کلیپ» change is pending.
 * @param {boolean} [props.canEdit]
 * @param {boolean} [props.canDelete]
 * @param {boolean} [props.allowDuplicates] keep linked options in the picker
 * @param {import('react').ReactNode} [props.extraControl] e.g. the cast role select
 * @param {string} [props.addValue]   controlled value when extraControl is used
 * @param {(value: string) => void} [props.onAddValueChange]
 */
export function RelationPicker({
  rows = [],
  options = [],
  onAdd,
  onRemove,
  loading = false,
  disabled = false,
  disabledHint = 'ابتدا رکورد را ذخیره کنید.',
  canEdit = true,
  canDelete = true,
  allowDuplicates = false,
  emptyLabel = 'موردی افزوده نشده است',
  addPlaceholder = 'انتخاب کنید',
  extraControl = null,
  addValue,
  onAddValueChange,
}) {
  const [internalValue, setInternalValue] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  // Controlled when the caller needs the pending selection (the cast picker
  // pairs it with a role); uncontrolled otherwise.
  const selected = addValue ?? internalValue;
  const setSelected = onAddValueChange ?? setInternalValue;

  const handleAdd = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await onAdd(selected);
      setSelected('');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (row) => {
    setBusy(true);
    try {
      await onRemove(row);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  // Already-linked options are dropped from the picker so the only way to hit
  // the 409 is a race with another operator.
  //
  // `allowDuplicates` exists for cast credits, where the unique key is
  // (movie, cast, role): the same person legitimately appears twice under
  // different roles, so filtering them out would make the second credit
  // impossible to add.
  const linkedValues = new Set(rows.map((row) => row.id));
  const available = allowDuplicates
    ? options
    : options.filter((option) => !linkedValues.has(option.value));

  return (
    <div className="flex flex-col gap-3">
      {loading ? (
        <InlineLoader />
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted">{emptyLabel}</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {rows.map((row) => (
            <li
              key={row.key ?? row.id}
              className="flex items-center gap-2 rounded-lg border border-line bg-panel-hi px-2.5 py-1.5"
            >
              <span className="text-xs text-paper">{row.label}</span>
              {row.meta ? <Badge tone="accent">{row.meta}</Badge> : null}
              {canDelete ? (
                <IconButton
                  label={`حذف ${row.label}`}
                  onClick={() => handleRemove(row)}
                  disabled={busy}
                  className="size-5 min-h-0 border-0 bg-transparent px-0 text-muted hover:text-signal"
                >
                  ✕
                </IconButton>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canEdit ? (
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
            options={available}
            placeholder={addPlaceholder}
            disabled={disabled || busy}
            className="w-56"
          />
          {extraControl}
          <Button size="sm" onClick={handleAdd} disabled={disabled || busy || !selected}>
            افزودن
          </Button>
        </div>
      ) : null}

      {disabled ? <p className="text-xs text-muted/80">{disabledHint}</p> : null}
    </div>
  );
}

export default RelationPicker;
