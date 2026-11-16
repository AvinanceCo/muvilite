/**
 * Watch history report.
 *
 * Purpose: every recorded viewing session.
 * Inputs:  filters from the URL
 * Outputs: a paginated grid
 * Deps:    api/reports, ./ReportScreen
 *
 * Legacy counterpart: `views/watch-history/index.php`.
 *
 * A row is one session, not one view: `watchedSecond` accumulates over the
 * session's heartbeats, and each heartbeat credits a FIXED 30 seconds rather
 * than elapsed time — the client cannot choose how much to add. So the total is
 * a count of heartbeats × 30, which is close to watch time but not identical to
 * it, and a session left paused still accrues nothing.
 *
 * `lastSecond` is the playhead position the client last reported, which is what
 * "resume where I left off" would use.
 *
 * Sessions are anonymous. There is no end-user login in this application, so
 * `userIp` is the only identifier and the same aircraft NAT can produce many
 * sessions from one address.
 */
import { fetchWatchHistory } from '../../api/reports.js';
import { ReportScreen, FilterControl } from './ReportScreen.jsx';
import { Select } from '../../components/ui/Input.jsx';
import { Badge } from '../../components/ui/Card.jsx';
import { PLATFORMS, platformLabel } from '../../utils/constants.js';
import { formatDateTime, formatDuration, formatTimecode, truncate } from '../../services/format.js';

const COLUMNS = [
  {
    key: 'createdAt',
    header: 'زمان',
    width: 'w-36',
    sortKey: 'created_date',
    render: (row) => formatDateTime(row.createdAt),
  },
  {
    key: 'movie',
    header: 'ویدئو',
    render: (row) =>
      row.movie?.titleFa ? (
        truncate(row.movie.titleFa, 40)
      ) : (
        // The movie may have been deleted since; the session row survives.
        <span className="text-muted">حذف شده</span>
      ),
  },
  {
    key: 'watchedSecond',
    header: 'مدت تماشا',
    width: 'w-32',
    align: 'center',
    sortKey: 'watched_second',
    render: (row) => formatDuration(row.watchedSecond),
  },
  {
    key: 'lastSecond',
    header: 'آخرین ثانیه',
    width: 'w-28',
    align: 'center',
    mono: true,
    render: (row) => formatTimecode(row.lastSecond),
  },
  {
    key: 'userPlatform',
    header: 'پلتفرم',
    width: 'w-28',
    align: 'center',
    render: (row) => <Badge>{platformLabel(row.userPlatform)}</Badge>,
  },
  {
    key: 'userIp',
    header: 'نشانی IP',
    width: 'w-36',
    mono: true,
    render: (row) => row.userIp || '—',
  },
];

export function WatchHistory() {
  return (
    <ReportScreen
      title="سوابق تماشا"
      description="هر ردیف یک نشست تماشاست. مدت تماشا از ضربان‌های ۳۰ ثانیه‌ای پخش‌کننده جمع می‌شود."
      queryKey="watch-history"
      fetcher={fetchWatchHistory}
      columns={COLUMNS}
      textFilters={['userIp']}
      renderFilters={(list) => (
        <FilterControl label="پلتفرم">
          <Select
            value={list.filters.platform ?? ''}
            onChange={(event) => list.setFilter('platform', event.target.value)}
            options={[...PLATFORMS]}
            placeholder="همه"
            className="w-40"
          />
        </FilterControl>
      )}
    />
  );
}

export default WatchHistory;
