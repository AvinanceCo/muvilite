/**
 * Daily watch trends.
 *
 * Purpose: per-film viewing totals for each day, as the nightly job computed
 *          them.
 * Inputs:  filters from the URL
 * Outputs: a paginated grid
 * Deps:    api/reports, ./ReportScreen
 *
 * NEW TO THE UI. `watch_history_trend_daily_tbl` was written by
 * `crons/watch_history_daily.php` and no legacy view ever read it.
 *
 * ROWS EXIST ONLY FOR DAYS THE JOB HAS RUN. An empty result means the cron has
 * not run for that range — not that nobody watched anything. The job is
 * disabled by default (`ENABLE_CRON=false`) and driven externally with
 * `npm run cron:watch-trends`, matching the legacy arrangement, so on a fresh
 * install this screen is legitimately empty. The notice says so.
 *
 * The window is a whole UTC CALENDAR DAY. The legacy job aggregated
 * `[now - 24h, now]`, a window with no stable identity, which is why re-running
 * it duplicated every row (backend/MIGRATION.md §6 defect 9). A calendar day
 * gives the bucket a key, which is what makes the upsert idempotent — so these
 * rows are safe to recompute.
 */
import { fetchWatchTrends } from '../../api/reports.js';
import { ReportScreen } from './ReportScreen.jsx';
import { Alert } from '../../components/ui/Feedback.jsx';
import { formatDate, formatDuration, toPersianNumber, truncate } from '../../services/format.js';

const COLUMNS = [
  {
    key: 'windowStart',
    header: 'روز',
    width: 'w-32',
    sortKey: 'window_start',
    render: (row) => formatDate(row.windowStart),
  },
  {
    key: 'movie',
    header: 'ویدئو',
    render: (row) =>
      row.movie?.titleFa ? truncate(row.movie.titleFa, 40) : <span className="text-muted">حذف شده</span>,
  },
  {
    key: 'totalCount',
    header: 'نشست ها',
    width: 'w-24',
    align: 'center',
    sortKey: 'total_count',
    render: (row) => toPersianNumber(row.totalCount),
  },
  {
    key: 'sumWatchedSecond',
    header: 'مجموع تماشا',
    width: 'w-32',
    align: 'center',
    sortKey: 'sum_watched_second',
    render: (row) => formatDuration(row.sumWatchedSecond),
  },
  {
    key: 'midLastSecond',
    header: 'میانگین توقف',
    width: 'w-32',
    align: 'center',
    // The mean playhead position where sessions ended — how far into the film
    // the average viewer got.
    render: (row) => formatDuration(row.midLastSecond),
  },
  {
    key: 'platforms',
    header: 'به تفکیک پلتفرم',
    render: (row) => (
      <span className="font-mono text-[0.7rem] text-muted">
        {[
          ['وب', row.platformCountWeb],
          ['اندروید', row.platformCountAndroid],
          ['iOS', row.platformCountIos],
          ['اندروید TV', row.platformCountAndroidTv],
          ['وب TV', row.platformCountWebTv],
        ]
          .filter(([, count]) => count > 0)
          .map(([label, count]) => `${label} ${toPersianNumber(count)}`)
          .join(' · ') || '—'}
      </span>
    ),
  },
];

export function WatchTrends() {
  return (
    <>
      <Alert tone="info" className="mb-5">
        این جدول را کرون شبانه پر می‌کند. اگر بازه‌ای خالی است، یعنی کرون برای آن روزها اجرا نشده
        است — نه اینکه تماشایی صورت نگرفته.
      </Alert>

      <ReportScreen
        title="روند تماشا"
        description="جمع‌بندی روزانه به ازای هر ویدئو، بر مبنای روز تقویمی UTC."
        queryKey="watch-trends"
        fetcher={fetchWatchTrends}
        columns={COLUMNS}
        defaultSort="window_start"
        emptyTitle="داده‌ای برای این بازه محاسبه نشده است"
      />
    </>
  );
}

export default WatchTrends;
