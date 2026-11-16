/**
 * Poll summary.
 *
 * Purpose: the satisfaction survey's results — how each question was answered.
 * Inputs:  none (an aggregate over the whole table)
 * Outputs: a bar per question
 * Deps:    api/reports, components/ui/*
 *
 * NEW TO THE UI. The legacy panel only listed raw votes; nothing added them up,
 * so reading the survey meant exporting rows and counting them by hand.
 *
 * TWO PROPERTIES OF THE DATA SHAPE THIS SCREEN:
 *
 *   1. `answers` contains ONLY VOTES THAT OCCURRED. A question nobody rated
 *      «ضعیف» has no entry for vote 1 — it is not present with a zero. Reading
 *      `answers[i]` positionally would mislabel every bar, so the fixed
 *      four-point scale is iterated and each count looked up.
 *   2. There is no date range. The endpoint aggregates everything ever
 *      recorded and takes no parameters, so this is a lifetime total. The
 *      per-vote log next door is where a date range lives.
 *
 * The bars are inline SVG-free — plain divs — because a proportion of a whole
 * needs no charting library, and nothing external can load on an aircraft.
 */
import { useQuery } from '@tanstack/react-query';
import { fetchPollSummary } from '../../api/reports.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { Card, PageHeader } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { EmptyState, ErrorState, Loader } from '../../components/ui/Feedback.jsx';
import { POLL_ANSWERS } from '../../utils/constants.js';
import { toPersianNumber } from '../../services/format.js';

/** A four-step scale: teal and azure for the positive end, muted through to red. */
const ANSWER_COLOR = {
  4: 'bg-verdant',
  3: 'bg-azure',
  2: 'bg-muted',
  1: 'bg-signal',
};

export function PollSummary() {
  useDocumentTitle('جمع‌بندی نظرسنجی');

  const query = useQuery({
    queryKey: ['poll-summary'],
    queryFn: fetchPollSummary,
  });

  if (query.isLoading) return <Loader />;
  if (query.error) return <ErrorState error={query.error} onRetry={query.refetch} />;

  const questions = query.data ?? [];

  return (
    <>
      <PageHeader
        title="جمع‌بندی نظرسنجی"
        description="مجموع همهٔ پاسخ‌های ثبت‌شده از ابتدا. برای بازهٔ زمانی، به «سوابق نظرات کاربران» بروید."
        actions={
          <Button size="sm" variant="ghost" to="/poll-history">
            مشاهده پاسخ های تکی
          </Button>
        }
      />

      {questions.length === 0 ? (
        <Card>
          <EmptyState
            title="هنوز پاسخی ثبت نشده است"
            description="پس از آنکه کاربران نظرسنجی را تکمیل کنند، نتایج اینجا نمایش داده می‌شود."
            icon="％"
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {questions.map((question) => (
            <QuestionResult key={question.pollId} question={question} />
          ))}
        </div>
      )}
    </>
  );
}

function QuestionResult({ question }) {
  const total = question.total ?? 0;

  // The API returns only the votes that occurred, so look each one up against
  // the fixed scale rather than reading the array in order.
  const counts = new Map((question.answers ?? []).map((answer) => [answer.vote, answer.count]));

  return (
    <Card>
      <div className="mb-3 flex items-start justify-between gap-3">
        <h2 className="text-sm font-bold text-paper">{question.questionFa}</h2>
        <span className="shrink-0 font-mono text-xs text-muted">
          {toPersianNumber(total)} پاسخ
        </span>
      </div>

      {total === 0 ? (
        <p className="text-xs text-muted">به این سوال پاسخی داده نشده است.</p>
      ) : (
        <div className="space-y-2">
          {POLL_ANSWERS.map((answer) => {
            const count = counts.get(answer.value) ?? 0;
            const share = total > 0 ? (count / total) * 100 : 0;

            return (
              <div key={answer.value} className="flex items-center gap-3">
                <span className="w-16 shrink-0 text-xs text-muted">{answer.label}</span>

                <div
                  className="h-5 flex-1 overflow-hidden rounded bg-panel-hi"
                  role="img"
                  aria-label={`${answer.label}: ${count} پاسخ، ${Math.round(share)} درصد`}
                >
                  <div
                    className={`h-full rounded transition-all ${ANSWER_COLOR[answer.value] ?? 'bg-muted'}`}
                    style={{ width: `${share}%` }}
                  />
                </div>

                <span className="w-20 shrink-0 text-start font-mono text-xs text-muted">
                  {toPersianNumber(count)}
                  <span className="opacity-60"> · {toPersianNumber(Math.round(share))}٪</span>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

export default PollSummary;
