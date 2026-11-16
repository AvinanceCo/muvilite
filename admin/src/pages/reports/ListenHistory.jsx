/**
 * Listen history report.
 *
 * Purpose: every recorded audio session.
 * Inputs:  filters from the URL
 * Outputs: a paginated grid
 * Deps:    api/reports, ./ReportScreen
 *
 * NEW TO THE UI. `listen_history_tbl` was written by the legacy app but no view
 * ever displayed it, so this screen has no legacy counterpart to match.
 *
 * TWO THINGS MAKE THESE NUMBERS DIFFER FROM THE LEGACY TABLE'S:
 *
 *   1. Heartbeats credit a fixed 15 seconds each (audio's chunk size, half the
 *      video one), not elapsed time.
 *   2. In the legacy app, merely FETCHING a music detail inserted a listen row
 *      — so every crawler hit inflated the statistics. That was a defect and
 *      was not reproduced (backend/MIGRATION.md §6 defect 13): a session is now
 *      created only by an explicit request from a player that is actually
 *      playing. Rows recorded after the migration are therefore genuinely
 *      lower, and are not comparable with legacy figures.
 */
import { fetchListenHistory } from '../../api/reports.js';
import { ReportScreen } from './ReportScreen.jsx';
import { formatDateTime, formatDuration, truncate } from '../../services/format.js';

const COLUMNS = [
  {
    key: 'createdAt',
    header: 'زمان',
    width: 'w-36',
    sortKey: 'created_date',
    render: (row) => formatDateTime(row.createdAt),
  },
  {
    key: 'music',
    header: 'موسیقی',
    render: (row) =>
      row.music ? (
        <div>
          <p className="text-paper">{truncate(row.music.fullnameFa, 30)}</p>
          {row.music.albumFa ? (
            <p className="text-[0.7rem] text-muted">{truncate(row.music.albumFa, 30)}</p>
          ) : null}
        </div>
      ) : (
        <span className="text-muted">حذف شده</span>
      ),
  },
  {
    key: 'listenedSecond',
    header: 'مدت شنیدن',
    width: 'w-32',
    align: 'center',
    sortKey: 'listened_second',
    render: (row) => formatDuration(row.listenedSecond),
  },
  {
    key: 'userIp',
    header: 'نشانی IP',
    width: 'w-36',
    mono: true,
    render: (row) => row.userIp || '—',
  },
];

export function ListenHistory() {
  return (
    <ReportScreen
      title="سوابق شنیدن"
      description="مدت شنیدن از ضربان‌های ۱۵ ثانیه‌ای پخش‌کننده جمع می‌شود."
      queryKey="listen-history"
      fetcher={fetchListenHistory}
      columns={COLUMNS}
      textFilters={['userIp']}
    />
  );
}

export default ListenHistory;
