/**
 * Poll vote log.
 *
 * Purpose: the individual satisfaction-survey answers.
 * Inputs:  filters from the URL
 * Outputs: a paginated grid
 * Deps:    api/reports, ./ReportScreen
 *
 * Legacy counterpart: `views/poll-history/index.php`.
 *
 * `token` IS NOT A USER. It is an anonymous identifier the client generates and
 * keeps in local storage — the survey has no login, because the application has
 * no end-user accounts at all. Its purpose is the three-hour revision window:
 * a repeat submission from the same token inside three hours UPDATES the
 * existing rows instead of adding new ones, so a passenger can change their
 * mind. Filtering by token therefore groups one passenger's answers across the
 * nine questions.
 *
 * The legacy update had no time bound, so once a token qualified as recent it
 * rewrote every row that token had ever written for the question — corrupting
 * answers recorded days earlier. That was fixed rather than reproduced
 * (backend/MIGRATION.md §6 defect 5), so rows older than the window are stable.
 */
import { fetchPollHistory } from '../../api/reports.js';
import { ReportScreen, FilterControl } from './ReportScreen.jsx';
import { Select } from '../../components/ui/Input.jsx';
import { Badge } from '../../components/ui/Card.jsx';
import { POLL_ANSWERS } from '../../utils/constants.js';
import { formatDateTime, truncate } from '../../services/format.js';

const ANSWER_TONE = { 4: 'active', 3: 'active', 2: 'neutral', 1: 'danger' };
const ANSWER_LABEL = Object.fromEntries(POLL_ANSWERS.map((answer) => [answer.value, answer.label]));

const COLUMNS = [
  {
    key: 'createdAt',
    header: 'زمان',
    width: 'w-36',
    sortKey: 'created_date',
    render: (row) => formatDateTime(row.createdAt),
  },
  {
    key: 'poll',
    header: 'سوال',
    render: (row) =>
      row.poll?.questionFa ? (
        truncate(row.poll.questionFa, 60)
      ) : (
        <span className="text-muted">سوال حذف شده</span>
      ),
  },
  {
    key: 'vote',
    header: 'پاسخ',
    width: 'w-28',
    align: 'center',
    render: (row) => (
      <Badge tone={ANSWER_TONE[row.vote] ?? 'neutral'}>{ANSWER_LABEL[row.vote] ?? row.vote}</Badge>
    ),
  },
  {
    key: 'token',
    header: 'شناسه پاسخ‌دهنده',
    width: 'w-40',
    mono: true,
    render: (row) => (
      <span title={row.token}>{truncate(row.token, 16)}</span>
    ),
  },
  {
    key: 'userIp',
    header: 'نشانی IP',
    width: 'w-36',
    mono: true,
    render: (row) => row.userIp || '—',
  },
];

export function PollHistory() {
  return (
    <ReportScreen
      title="سوابق نظرات کاربران"
      description="هر ردیف پاسخ یک نفر به یک سوال است. شناسهٔ پاسخ‌دهنده ناشناس است و فقط برای ویرایش پاسخ تا سه ساعت کاربرد دارد."
      queryKey="poll-history"
      fetcher={fetchPollHistory}
      columns={COLUMNS}
      textFilters={['token', 'userIp']}
      renderFilters={(list) => (
        <FilterControl label="پاسخ">
          <Select
            value={list.filters.vote ?? ''}
            onChange={(event) => list.setFilter('vote', event.target.value)}
            options={[...POLL_ANSWERS]}
            placeholder="همه"
            className="w-40"
          />
        </FilterControl>
      )}
    />
  );
}

export default PollHistory;
