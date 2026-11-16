/**
 * Activity log.
 *
 * Purpose: what administrators changed, when, and from where.
 * Inputs:  filters from the URL
 * Outputs: a paginated grid with expandable field-level diffs
 * Deps:    api/reports, ./ReportScreen
 *
 * Legacy counterpart: `views/user-logs/index.php`.
 *
 * READ-ONLY, DELIBERATELY. The legacy panel offered a delete action, but
 * `UserLogController::actionDelete()` targeted the wrong model and a column
 * that does not exist (`UserModel->delete("row = $id")`), so it never worked.
 * It was not ported (backend/MIGRATION.md §6 defect 8) — an audit log that the
 * audited party can erase is not an audit log.
 *
 * `details` holds a field-level diff on updates (`{field: {old, new}}`), the
 * created payload on creates, and null on deletes. It is rendered on demand
 * rather than inline: a movie edit can touch twenty fields and would swamp the
 * grid.
 *
 * Authentication events appear under `actionPage: 'auth'`. The legacy log
 * covered entity CRUD only and recorded no sign-ins at all (defect 17).
 */
import { useState } from 'react';
import { fetchUserLogs } from '../../api/reports.js';
import { ReportScreen, FilterControl } from './ReportScreen.jsx';
import { Select } from '../../components/ui/Input.jsx';
import { Badge } from '../../components/ui/Card.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { LOG_ACTIONS, logActionLabel } from '../../utils/constants.js';
import { formatDateTime, shortId } from '../../services/format.js';

const ACTION_TONE = { 0: 'active', 1: 'accent', 2: 'danger' };

export function UserLogs() {
  const [inspecting, setInspecting] = useState(null);

  const columns = [
    {
      key: 'createdAt',
      header: 'زمان',
      width: 'w-36',
      sortKey: 'created_date',
      render: (row) => formatDateTime(row.createdAt),
    },
    {
      key: 'user',
      header: 'کاربر',
      width: 'w-40',
      render: (row) =>
        row.user ? (
          <div>
            <p className="text-paper">{row.user.displayName || '—'}</p>
            <p dir="ltr" className="text-start font-mono text-[0.7rem] text-muted">
              {row.user.mobile}
            </p>
          </div>
        ) : (
          <span className="text-muted">حذف شده</span>
        ),
    },
    {
      key: 'actionPage',
      header: 'بخش',
      width: 'w-32',
      mono: true,
      render: (row) => row.actionPage,
    },
    {
      key: 'actionType',
      header: 'اقدام',
      width: 'w-24',
      align: 'center',
      render: (row) => (
        <Badge tone={ACTION_TONE[row.actionType] ?? 'neutral'}>
          {logActionLabel(row.actionType)}
        </Badge>
      ),
    },
    {
      key: 'actionId',
      header: 'شناسه مورد',
      width: 'w-28',
      mono: true,
      render: (row) =>
        row.actionId ? (
          <span title={row.actionId}>{shortId(row.actionId)}</span>
        ) : (
          <span className="text-muted/50">—</span>
        ),
    },
    {
      key: 'userIp',
      header: 'نشانی IP',
      width: 'w-32',
      mono: true,
      render: (row) => row.userIp || '—',
    },
    {
      key: 'details',
      header: 'جزئیات',
      width: 'w-24',
      align: 'end',
      render: (row) =>
        row.details ? (
          <Button size="sm" variant="ghost" onClick={() => setInspecting(row)}>
            مشاهده
          </Button>
        ) : (
          <span className="text-muted/50">—</span>
        ),
    },
  ];

  return (
    <>
      <ReportScreen
        title="گزارش فعالیت ها"
        description="این گزارش فقط خواندنی است و از داخل پنل قابل حذف نیست."
        queryKey="user-logs"
        fetcher={fetchUserLogs}
        columns={columns}
        textFilters={['actionPage', 'userIp', 'actionId']}
        renderFilters={(list) => (
          <FilterControl label="اقدام">
            <Select
              value={list.filters.actionType ?? ''}
              onChange={(event) => list.setFilter('actionType', event.target.value)}
              options={[...LOG_ACTIONS]}
              placeholder="همه"
              className="w-40"
            />
          </FilterControl>
        )}
      />

      <Modal
        open={Boolean(inspecting)}
        onClose={() => setInspecting(null)}
        title="جزئیات تغییر"
        description={
          inspecting
            ? `${logActionLabel(inspecting.actionType)} در «${inspecting.actionPage}» — ${formatDateTime(inspecting.createdAt)}`
            : undefined
        }
      >
        {inspecting ? <DetailsView details={inspecting.details} /> : null}
      </Modal>
    </>
  );
}

/**
 * Renders `details` two ways, because the log stores two shapes:
 *   - an update writes `{ field: { old, new } }`, shown as a before/after table;
 *   - a create writes the payload itself, shown as a field/value list.
 * Anything else falls back to formatted JSON rather than being dropped.
 */
function DetailsView({ details }) {
  if (!details || typeof details !== 'object') {
    return <p className="text-xs text-muted">جزئیاتی ثبت نشده است.</p>;
  }

  const entries = Object.entries(details);

  const isDiff = entries.every(
    ([, value]) =>
      value && typeof value === 'object' && !Array.isArray(value) && ('old' in value || 'new' in value),
  );

  if (!isDiff) {
    return (
      <dl className="space-y-2">
        {entries.map(([field, value]) => (
          <div key={field} className="flex items-start justify-between gap-3 border-b border-line pb-2">
            <dt className="shrink-0 font-mono text-xs text-muted">{field}</dt>
            <dd dir="auto" className="min-w-0 break-words text-start text-xs text-paper">
              {formatValue(value)}
            </dd>
          </div>
        ))}
      </dl>
    );
  }

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-line text-muted">
          <th scope="col" className="px-2 py-2 text-start font-bold">
            فیلد
          </th>
          <th scope="col" className="px-2 py-2 text-start font-bold">
            مقدار قبلی
          </th>
          <th scope="col" className="px-2 py-2 text-start font-bold">
            مقدار جدید
          </th>
        </tr>
      </thead>
      <tbody>
        {entries.map(([field, change]) => (
          <tr key={field} className="border-b border-line/60 last:border-0">
            <td className="px-2 py-2 font-mono text-muted">{field}</td>
            <td dir="auto" className="px-2 py-2 text-muted line-through decoration-signal/50">
              {formatValue(change.old)}
            </td>
            <td dir="auto" className="px-2 py-2 text-paper">
              {formatValue(change.new)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function formatValue(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'بله' : 'خیر';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export default UserLogs;
