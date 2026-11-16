/**
 * Reorderable list.
 *
 * Purpose: let an operator change display order and save it in one request.
 * Inputs:  rows, a render function, and a save callback
 * Outputs: the reordered rows, through `onSave`
 * Deps:    components/ui/*
 *
 * Legacy counterpart: `views/banners/order.php` and `views/blocks/order.php`,
 * which used jQuery UI sortable and posted the whole sequence to `?@=order`.
 * The API kept that shape: `PATCH .../order` takes the complete list of
 * `{ id, order }` pairs and bulk-writes them.
 *
 * Up/down buttons rather than drag-and-drop. Dragging needs a pointer, and a
 * keyboard-accessible drag implementation is a large amount of code for a list
 * that is typically under ten rows; buttons work with a keyboard, a touch
 * screen and a mouse without any of it.
 *
 * Order is held locally until saved, so an accidental reorder can be abandoned
 * by leaving the screen — matching how the legacy screen's explicit save worked.
 */
import { useEffect, useState } from 'react';
import { Button, IconButton } from '../ui/Button.jsx';
import { Alert } from '../ui/Feedback.jsx';
import { useToast } from '../ui/Toast.jsx';

/**
 * @param {object} props
 * @param {object[]} props.items          in current display order
 * @param {(item: object) => string} props.itemKey
 * @param {(item: object, index: number) => import('react').ReactNode} props.renderItem
 * @param {(ordered: object[]) => Promise<unknown>} props.onSave
 * @param {boolean} [props.canEdit]
 */
export function OrderableList({
  items = [],
  itemKey,
  renderItem,
  onSave,
  canEdit = true,
  emptyLabel = 'موردی وجود ندارد',
}) {
  const [rows, setRows] = useState(items);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  // Follow the server, but never over an unsaved reorder.
  useEffect(() => {
    if (!dirty) setRows(items);
  }, [items, dirty]);

  const move = (index, delta) => {
    const target = index + delta;
    if (target < 0 || target >= rows.length) return;

    setRows((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      await onSave(rows);
      setDirty(false);
      toast.success('ترتیب ذخیره شد.');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    setRows(items);
    setDirty(false);
  };

  if (rows.length === 0) {
    return <p className="py-6 text-center text-xs text-muted">{emptyLabel}</p>;
  }

  return (
    <div>
      {dirty ? (
        <Alert tone="warning" className="mb-3">
          ترتیب تغییر کرده و ذخیره نشده است.
        </Alert>
      ) : null}

      <ol className="space-y-2">
        {rows.map((item, index) => (
          <li
            key={itemKey(item)}
            className="flex items-center gap-3 rounded-lg border border-line bg-panel-hi p-2"
          >
            <span className="w-6 shrink-0 text-center font-mono text-xs text-muted">
              {index + 1}
            </span>

            <div className="min-w-0 flex-1">{renderItem(item, index)}</div>

            {canEdit ? (
              <span className="flex shrink-0 items-center gap-1">
                <IconButton label="بالا" onClick={() => move(index, -1)} disabled={index === 0}>
                  ▲
                </IconButton>
                <IconButton
                  label="پایین"
                  onClick={() => move(index, 1)}
                  disabled={index === rows.length - 1}
                >
                  ▼
                </IconButton>
              </span>
            ) : null}
          </li>
        ))}
      </ol>

      {canEdit && dirty ? (
        <div className="mt-3 flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={cancel} disabled={saving}>
            بازگرداندن
          </Button>
          <Button size="sm" variant="primary" onClick={save} loading={saving}>
            ذخیره ترتیب
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export default OrderableList;
