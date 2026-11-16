/**
 * Row-level table controls.
 *
 * Purpose: the status toggle and the edit/delete cluster that appear in every
 *          grid's last two columns.
 * Inputs:  a row, permission keys, mutation callbacks
 * Outputs: interactive cells
 * Deps:    components/ui/*, components/auth/Guards, hooks/useToast
 *
 * Both reproduce the legacy grids: `status.php` behind a bootstrap-toggle in
 * the «وضعیت» column, and the edit/delete links in «عملیات» — each rendered
 * only when the group held the matching permission
 * (`$edit_permission` / `$delete_permission` in views/*\/index.php).
 *
 * The toggle is optimistic. A status flip is a one-field write that essentially
 * always succeeds, and waiting for the round trip makes the switch feel broken;
 * on failure it snaps back and the error is announced.
 */
import { useState } from 'react';
import { Switch } from '../ui/Input.jsx';
import { Button, IconButton } from '../ui/Button.jsx';
import { Can } from '../auth/Guards.jsx';
import { useToast } from '../ui/Toast.jsx';

/**
 * @param {object} props
 * @param {object} props.row
 * @param {string} props.page  permission key; the toggle is read-only without `edit`
 * @param {(id: string, isActive: boolean) => Promise<unknown>} props.onToggle
 * @param {string} [props.label] accessible name, e.g. the row's title
 */
export function StatusToggle({ row, page, onToggle, label }) {
  const [optimistic, setOptimistic] = useState(null);
  const [pending, setPending] = useState(false);
  const toast = useToast();

  const checked = optimistic ?? row.isActive;

  const handleChange = async (next) => {
    setOptimistic(next);
    setPending(true);

    try {
      await onToggle(row._id, next);
      toast.success(next ? 'فعال شد.' : 'غیرفعال شد.');
    } catch (error) {
      setOptimistic(null);
      toast.error(error.message);
    } finally {
      setPending(false);
    }
  };

  return (
    <Can
      page={page}
      action="edit"
      fallback={<span className="text-xs text-muted">{checked ? 'فعال' : 'غیرفعال'}</span>}
    >
      <Switch
        checked={checked}
        onChange={handleChange}
        disabled={pending}
        label={`${checked ? 'غیرفعال کردن' : 'فعال کردن'} ${label ?? ''}`.trim()}
      />
    </Can>
  );
}

/**
 * The «عملیات» cluster: edit, delete, and any extra links a screen adds (the
 * poster uploader, a category's contents, a movie's casts).
 *
 * @param {object} props
 * @param {string} props.editTo    route for the edit form
 * @param {() => void} props.onDelete  opens the confirmation; does not delete
 * @param {{to: string, label: string, icon: string}[]} [props.extras]
 */
export function RowActions({ page, editTo, onDelete, extras = [] }) {
  return (
    <div className="flex items-center justify-end gap-1">
      {extras.map((extra) => (
        <IconButton key={extra.to} to={extra.to} label={extra.label}>
          <span aria-hidden="true">{extra.icon}</span>
        </IconButton>
      ))}

      {editTo ? (
        <Can page={page} action="edit">
          <IconButton to={editTo} label="ویرایش">
            <span aria-hidden="true">✎</span>
          </IconButton>
        </Can>
      ) : null}

      {onDelete ? (
        <Can page={page} action="delete">
          <IconButton
            onClick={onDelete}
            label="حذف"
            className="hover:border-signal/50 hover:text-signal"
          >
            <span aria-hidden="true">🗑</span>
          </IconButton>
        </Can>
      ) : null}
    </div>
  );
}

/**
 * The toolbar above a grid: an "add" button gated on `edit`, plus whatever else
 * the screen offers (export, bulk actions), and a "clear filters" escape hatch.
 */
export function ListToolbar({ page, addTo, addLabel = 'افزودن', hasFilters, onClearFilters, children }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {children}

      {hasFilters ? (
        <Button size="sm" variant="ghost" onClick={onClearFilters}>
          حذف فیلترها
        </Button>
      ) : null}

      {addTo ? (
        <Can page={page} action="edit">
          <Button to={addTo} variant="primary" size="sm">
            <span aria-hidden="true">+</span>
            {addLabel}
          </Button>
        </Can>
      ) : null}
    </div>
  );
}

export default StatusToggle;
