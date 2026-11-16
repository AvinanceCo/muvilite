/**
 * Ad telemetry report.
 *
 * Purpose: how pre-roll advertisements performed.
 * Inputs:  filters from the URL
 * Outputs: a paginated grid
 * Deps:    api/reports, ./ReportScreen
 *
 * Legacy counterpart: `views/ads-history/index.php`.
 *
 * These rows come from the VAST player on the passenger site, which reports one
 * event per impression: `completed` when the ad played to the end, `skipped`
 * when the viewer dismissed it, with the seconds watched either way.
 *
 * `title` is the title the player reported. Historically that was ALL a row
 * had — legacy ads were VAST files on disk with nothing to reference, so two
 * campaigns sharing a name were indistinguishable. Creatives are records now
 * (/video-ads) and rows written since carry `ad` as well, which is what the
 * title links to when it is present. Rows without it are older, or came from a
 * player that reports only a title. The title filter is an EXACT match, not a
 * substring, so it needs the full string rather than a fragment.
 */
import { Link } from 'react-router-dom';
import { fetchAdsHistory } from '../../api/reports.js';
import { ReportScreen, FilterControl } from './ReportScreen.jsx';
import { Select } from '../../components/ui/Input.jsx';
import { Badge } from '../../components/ui/Card.jsx';
import { AD_EVENT_TYPES } from '../../utils/constants.js';
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
    key: 'title',
    header: 'عنوان تبلیغ',
    render: (row) => {
      // Prefer the creative's current title when the row is linked to one: an
      // ad renamed after it ran should read by its name today, not by the
      // string a player happened to send months ago.
      const label = truncate(row.ad?.titleFa || row.title, 50) || '—';

      return row.ad?._id ? (
        <Link to={`/video-ads/${row.ad._id}`} className="text-azure hover:underline">
          {label}
        </Link>
      ) : (
        label
      );
    },
  },
  {
    key: 'eventType',
    header: 'رویداد',
    width: 'w-32',
    align: 'center',
    render: (row) =>
      row.eventType === 'completed' ? (
        <Badge tone="active">تماشای کامل</Badge>
      ) : (
        <Badge tone="inactive">رد شده</Badge>
      ),
  },
  {
    key: 'watchedSecond',
    header: 'مدت',
    width: 'w-28',
    align: 'center',
    sortKey: 'watched_second',
    render: (row) => formatDuration(row.watchedSecond),
  },
  {
    key: 'userIp',
    header: 'نشانی IP',
    width: 'w-36',
    mono: true,
    render: (row) => row.userIp || '—',
  },
];

export function AdsHistory() {
  return (
    <ReportScreen
      title="سوابق نمایش تبلیغ"
      description="رویدادهای پخش‌کنندهٔ تبلیغ پیش از فیلم."
      queryKey="ads-history"
      fetcher={fetchAdsHistory}
      columns={COLUMNS}
      textFilters={['userIp', 'title']}
      renderFilters={(list) => (
        <FilterControl label="رویداد">
          <Select
            value={list.filters.eventType ?? ''}
            onChange={(event) => list.setFilter('eventType', event.target.value)}
            options={[...AD_EVENT_TYPES]}
            placeholder="همه"
            className="w-40"
          />
        </FilterControl>
      )}
    />
  );
}

export default AdsHistory;
