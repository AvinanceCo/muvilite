/**
 * Dashboard.
 *
 * Purpose: an at-a-glance landing screen — catalog sizes, recent viewing,
 *          survey results and the latest administrative activity.
 * Inputs:  none
 * Outputs: stat tiles, a trend chart, and two recent-activity panels
 * Deps:    @tanstack/react-query, api/*, hooks/usePermissions
 *
 * NEW TO THE UI. The legacy panel had no dashboard; its «کاربران پنل» link went
 * straight to the user list, and there was no landing screen at all.
 *
 * EVERY NUMBER HERE COMES FROM DATA THE API ALREADY RETURNS. Nothing is
 * computed from an invented rule:
 *   - the tiles are `meta.total` from a one-row list query, which is the
 *     cheapest way to ask "how many are there";
 *   - the chart is the watch-trends table, which the nightly cron writes;
 *   - the survey panel is the poll-summary aggregate.
 *
 * EVERY PANEL IS PERMISSION-GATED INDIVIDUALLY. An administrator who cannot see
 * watch history must not be shown a chart of it, and a panel they cannot read
 * would otherwise render as a 403 error card. Panels they lack are omitted, and
 * if that leaves nothing, the screen says so rather than looking broken.
 *
 * The chart is inline SVG with no charting library: a bar series needs none,
 * and nothing external can load on an aircraft.
 */
import { useQueries, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { RESOURCE_APIS } from '../api/resources.js';
import { listUsers } from '../api/operations.js';
import { fetchPollSummary, fetchUserLogs, fetchWatchTrends } from '../api/reports.js';
import { usePermissions } from '../hooks/usePermissions.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Badge, Card, PageHeader, SectionHeader } from '../components/ui/Card.jsx';
import { EmptyState, InlineLoader } from '../components/ui/Feedback.jsx';
import { Button } from '../components/ui/Button.jsx';
import { formatDateTime, formatDuration, toPersianNumber, truncate } from '../services/format.js';
import { logActionLabel } from '../utils/constants.js';

/** Tiles: a label, the resource to count, the permission, and where it links. */
const TILES = [
  { key: 'movies', label: 'فیلم', permission: 'movies', to: '/movies', icon: '🎞' },
  { key: 'musics', label: 'موسیقی', permission: 'musics', to: '/musics', icon: '♬' },
  { key: 'casts', label: 'شخصیت', permission: 'casts', to: '/casts', icon: '🎭' },
  { key: 'users', label: 'کاربر', permission: 'users', to: '/users', icon: '👤' },
];

export function Dashboard() {
  useDocumentTitle('خانه');

  const { can } = usePermissions();
  const { user } = useAuth();

  const visibleTiles = TILES.filter((tile) => can(tile.permission, 'view'));
  const canSeeTrends = can('watch-history', 'view');
  const canSeePolls = can('pages', 'view');
  const canSeeLogs = can('user-logs', 'view');

  /**
   * One count per visible tile. `limit: 1` because only `meta.total` is wanted
   * — fetching a full page to count it would move a hundred documents per tile.
   */
  const counts = useQueries({
    queries: visibleTiles.map((tile) => ({
      queryKey: [tile.key, 'count'],
      queryFn: () =>
        tile.key === 'users'
          ? listUsers({ limit: 1 })
          : RESOURCE_APIS[tile.key].list({ limit: 1 }),
      staleTime: 60_000,
    })),
  });

  const nothingVisible =
    visibleTiles.length === 0 && !canSeeTrends && !canSeePolls && !canSeeLogs;

  return (
    <>
      <PageHeader
        title={`سلام${user?.displayName ? `، ${user.displayName}` : ''}`}
        description="نمای کلی سامانه. هر بخش فقط در صورت داشتن دسترسی نمایش داده می‌شود."
      />

      {nothingVisible ? (
        <Card>
          <EmptyState
            icon="🔒"
            title="بخشی برای نمایش وجود ندارد"
            description="گروه دسترسی شما هیچ‌یک از بخش‌های این صفحه را شامل نمی‌شود. از منوی کناری بخش‌های در دسترس خود را ببینید."
          />
        </Card>
      ) : null}

      {visibleTiles.length > 0 ? (
        <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {visibleTiles.map((tile, index) => (
            <StatTile
              key={tile.key}
              tile={tile}
              total={counts[index]?.data?.meta?.total}
              loading={counts[index]?.isLoading}
            />
          ))}
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        {canSeeTrends ? <TrendPanel /> : null}
        {canSeePolls ? <PollPanel /> : null}
        {canSeeLogs ? <ActivityPanel /> : null}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ tiles --- */

function StatTile({ tile, total, loading }) {
  return (
    <Link
      to={tile.to}
      className="rounded-panel border border-line bg-panel p-4 transition-colors hover:border-azure-dim"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted">{tile.label}</span>
        <span aria-hidden="true" className="opacity-70">
          {tile.icon}
        </span>
      </div>
      <p className="mt-2 text-2xl font-bold text-paper">
        {loading ? <span className="text-base text-muted">…</span> : toPersianNumber(total ?? 0)}
      </p>
    </Link>
  );
}

/* ------------------------------------------------------------------ trend --- */

/**
 * Watch totals for the last fourteen days.
 *
 * Rows exist only for days the nightly cron has processed, so a gap is a day
 * the job did not run — not a day with no viewing. The panel says so when it
 * comes back empty, rather than implying nobody watched anything.
 */
function TrendPanel() {
  const query = useQuery({
    queryKey: ['watch-trends', 'dashboard'],
    queryFn: () =>
      fetchWatchTrends({ limit: 100, item_sort: 'window_start', sort_type: 'DESC' }),
    staleTime: 60_000,
  });

  // Several films share a day, so sum per day before charting.
  const byDay = new Map();
  for (const row of query.data?.items ?? []) {
    const day = String(row.windowStart).slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + (row.sumWatchedSecond ?? 0));
  }

  const days = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14)
    .map(([day, seconds]) => ({ day, seconds }));

  const peak = Math.max(1, ...days.map((entry) => entry.seconds));

  return (
    <Card>
      <SectionHeader
        title="روند تماشا"
        description="مجموع زمان تماشا در ۱۴ روز اخیر"
        actions={
          <Button size="sm" variant="ghost" to="/watch-trends">
            جزئیات
          </Button>
        }
      />

      {query.isLoading ? (
        <InlineLoader />
      ) : days.length === 0 ? (
        <p className="py-8 text-center text-xs leading-6 text-muted">
          داده‌ای محاسبه نشده است.
          <br />
          این جدول را کرون شبانه پر می‌کند.
        </p>
      ) : (
        <div className="flex h-40 gap-1.5" role="img" aria-label="نمودار میله‌ای زمان تماشا در ۱۴ روز اخیر">
          {days.map((entry) => (
            <div key={entry.day} className="flex h-full min-w-0 flex-1 flex-col items-center gap-1">
              {/*
                The bar's height is a percentage, so its parent needs a DEFINITE
                height for it to resolve — a flex item in a fixed-height column
                has one, an auto-height wrapper does not, and the bar silently
                collapses to its 2% minimum.
              */}
              <div className="flex w-full flex-1 items-end">
                <div
                  className="w-full rounded-t bg-azure/70 transition-all hover:bg-azure"
                  style={{ height: `${Math.max(2, (entry.seconds / peak) * 100)}%` }}
                  title={`${entry.day} — ${formatDuration(entry.seconds)}`}
                />
              </div>
              <span className="w-full truncate text-center font-mono text-[0.6rem] text-muted">
                {entry.day.slice(8)}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------- poll --- */

/** The survey at a glance: each question's positive share. */
function PollPanel() {
  const query = useQuery({
    queryKey: ['poll-summary'],
    queryFn: fetchPollSummary,
    staleTime: 60_000,
  });

  const questions = (query.data ?? []).slice(0, 5);

  return (
    <Card>
      <SectionHeader
        title="نظرسنجی"
        description="سهم پاسخ‌های «عالی» و «خوب»"
        actions={
          <Button size="sm" variant="ghost" to="/poll-summary">
            جزئیات
          </Button>
        }
      />

      {query.isLoading ? (
        <InlineLoader />
      ) : questions.length === 0 ? (
        <p className="py-8 text-center text-xs text-muted">هنوز پاسخی ثبت نشده است.</p>
      ) : (
        <ul className="space-y-3">
          {questions.map((question) => {
            const positive = (question.answers ?? [])
              .filter((answer) => answer.vote >= 3)
              .reduce((sum, answer) => sum + answer.count, 0);
            const share = question.total > 0 ? (positive / question.total) * 100 : 0;

            return (
              <li key={question.pollId}>
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate text-xs text-paper">
                    {truncate(question.questionFa, 45)}
                  </span>
                  <span className="shrink-0 font-mono text-xs text-muted">
                    {toPersianNumber(Math.round(share))}٪
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded bg-panel-hi">
                  <div className="h-full rounded bg-verdant" style={{ width: `${share}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/* --------------------------------------------------------------- activity --- */

/** The most recent administrative changes. */
function ActivityPanel() {
  const query = useQuery({
    queryKey: ['user-logs', 'dashboard'],
    queryFn: () => fetchUserLogs({ limit: 8, item_sort: 'created_date', sort_type: 'DESC' }),
    staleTime: 30_000,
  });

  return (
    <Card className="lg:col-span-2">
      <SectionHeader
        title="آخرین فعالیت ها"
        actions={
          <Button size="sm" variant="ghost" to="/user-logs">
            همه گزارش ها
          </Button>
        }
      />

      {query.isLoading ? (
        <InlineLoader />
      ) : (query.data?.items ?? []).length === 0 ? (
        <p className="py-8 text-center text-xs text-muted">فعالیتی ثبت نشده است.</p>
      ) : (
        <ul className="divide-y divide-line">
          {query.data.items.map((log) => (
            <li key={log._id} className="flex flex-wrap items-center gap-2 py-2.5 text-xs">
              <Badge tone={log.actionType === 2 ? 'danger' : 'accent'}>
                {logActionLabel(log.actionType)}
              </Badge>
              <span className="font-mono text-muted">{log.actionPage}</span>
              <span className="min-w-0 flex-1 truncate text-paper">
                {log.user?.displayName || log.user?.mobile || 'کاربر حذف شده'}
              </span>
              <span className="shrink-0 text-muted">{formatDateTime(log.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default Dashboard;
