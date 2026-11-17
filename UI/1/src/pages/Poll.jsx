/**
 * Poll — the in-flight satisfaction survey.
 *
 * Purpose: ask the passenger every active survey question and record one answer
 *          per question in a single submission.
 * Inputs:  none (the respondent token comes from localStorage via usePollToken)
 * Outputs: JSX
 * Deps:    @tanstack/react-query, react-hook-form, api/poll, hooks/{usePollToken,
 *          useDocumentTitle}, components/ui/{Button,Feedback,Toast}, utils/constants
 *
 * Replaces `poll.php`. That file was a standalone HTML page: nine Persian
 * questions hardcoded in the markup, four radios each (values 4..1, the top one
 * `checked`), and a jQuery submit that posted every answer at once to
 * `/api/v2/?@=poll` and showed the server's reply in a SweetAlert toast.
 *
 * Preserved rules, and why:
 *
 * 1. The questions come from the API, not from here. They live in `poll_tbl` now
 *    (backend poll.service.js listQuestions, sorted by `order`), so the survey
 *    can change without a deploy — which means nothing in this file may assume
 *    there are nine of them, or that any particular question is present.
 *
 * 2. The answer scale is still 4/3/2/1 and the top answer is still pre-selected
 *    on every question, exactly as the legacy markup shipped it. The scale is
 *    not part of the API response; it is POLL_ANSWERS in utils/constants.js and
 *    is enforced server-side (tracking.validators.js `isIn(POLL_ANSWER_VALUES)`).
 *
 * 3. Every question is submitted in one request, as the legacy form did. This is
 *    not cosmetic: poll.service.js rejects the whole submission if any
 *    referenced question is missing or inactive, so a partial post is a 400
 *    rather than a partial record. (The endpoint accepts at most 50 answers per
 *    request — far above any plausible survey length, but the reason a single
 *    request stays correct only up to that point.)
 *
 * 4. The confirmation text is the server's `message`, never a local string.
 *    poll.service.js treats a resubmission within three hours on the same token
 *    as a REVISION of the earlier answers and returns
 *    "نظرات شما با موفقیت بروزرسانی شد."; otherwise it records a new response and
 *    returns "نظرات شما با موفقیت ثبت شد." Only the server knows which happened,
 *    so only the server may word it.
 *
 * 5. Because revising is a normal, supported act, a successful submission does
 *    not end the page. The form stays filled and enabled so the passenger can
 *    change an answer and submit again; a second submission is never an error.
 *
 * Both outcomes are announced in a toast rather than in a banner above the form.
 * The survey is long enough to scroll, so by the time the passenger reaches the
 * submit button a banner at the top of the page is off screen: the button
 * flickered through its pending label and, as far as the passenger could tell,
 * nothing happened. A toast is pinned to the viewport, so the confirmation is
 * seen from wherever the form was submitted - and it is what `poll.php` did,
 * with a SweetAlert toast carrying the same server message.
 *
 * The token is a deduplication key, not authentication (see usePollToken). It is
 * never shown and nothing here implies it identifies the passenger.
 */
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation } from '@tanstack/react-query';
import { fetchPollQuestions, submitPollVotes } from '../api/poll.js';
import { Button } from '../components/ui/Button.jsx';
import { Alert, EmptyState, Loader } from '../components/ui/Feedback.jsx';
import { useToast } from '../components/ui/Toast.jsx';
import usePollToken from '../hooks/usePollToken.js';
import useDocumentTitle from '../hooks/useDocumentTitle.js';
import { POLL_ANSWERS } from '../utils/constants.js';

/** The legacy markup shipped the first radio (value 4) `checked` on every row. */
const DEFAULT_ANSWER = POLL_ANSWERS[0].value;

/** react-hook-form field path for one question. ObjectIds are hex, so safe as a key. */
function fieldName(questionId) {
  return `votes.${questionId}`;
}

/**
 * One question: a fieldset whose legend is the question, and four radios styled
 * as chips. The inputs are real radios kept visually hidden — that preserves
 * arrow-key navigation and the native `name` grouping while letting the chip
 * carry the checked and focus treatment.
 */
function QuestionCard({ question, index, register, disabled }) {
  const name = fieldName(question._id);

  return (
    <fieldset
      disabled={disabled}
      className="rounded-panel border border-line bg-panel p-4 disabled:opacity-60 sm:p-5"
    >
      <legend className="flex gap-3 px-1">
        <span className="mt-0.5 font-mono text-sm text-azure">
          {String(index + 1).padStart(2, '0')}
        </span>
        <span className="text-base font-bold leading-7">{question.questionFa}</span>
      </legend>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {POLL_ANSWERS.map((answer) => (
          <label key={answer.value} className="cursor-pointer">
            <input
              type="radio"
              className="peer sr-only"
              value={answer.value}
              {...register(name)}
            />
            <span
              className="block rounded-lg border border-line bg-panel-hi px-3 py-2.5 text-center text-sm text-muted transition-colors hover:border-azure-dim peer-checked:border-azure peer-checked:bg-azure peer-checked:font-bold peer-checked:text-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-azure"
            >
              {answer.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function Poll() {
  useDocumentTitle('نظرسنجی', 'نظر شما برای ما مهم است');

  const token = usePollToken();
  const toast = useToast();

  const {
    data: questions,
    isPending,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['poll-questions'],
    queryFn: fetchPollQuestions,
    // The survey does not change mid-flight, and a background refetch that
    // replaced the question list would reset a half-filled form.
    staleTime: Infinity,
  });

  /**
   * Defaults: the top answer on every question, per the legacy markup. Built
   * from the fetched list, so the form only exists once the questions do.
   * TanStack Query's structural sharing keeps `questions` referentially stable
   * across refetches, so this memo — and the reset it drives — does not re-run
   * under the passenger.
   */
  const defaultValues = useMemo(() => {
    const votes = {};
    (questions ?? []).forEach((question) => {
      votes[question._id] = String(DEFAULT_ANSWER);
    });
    return { votes };
  }, [questions]);

  // react-hook-form rather than a useState map: the answers are uncontrolled
  // native radios, so selecting one does not re-render the whole question list,
  // and `values` seeds the defaults the moment the questions arrive.
  const { register, handleSubmit } = useForm({
    values: defaultValues,
    // A refetch must never discard answers the passenger has already changed.
    resetOptions: { keepDirtyValues: true },
  });

  const mutation = useMutation({
    mutationFn: (votes) => submitPollVotes({ token, votes }),
    // `data.message` is the server's own wording - recorded, or revised. The
    // second line is ours, because only the client knows the form is still open
    // for another pass.
    onSuccess: (data) =>
      toast.success('می‌توانید پاسخ‌ها را تغییر دهید و دوباره ثبت کنید.', {
        title: data.message,
      }),
    // Stays on screen until dismissed: a failure the passenger does not read is
    // a survey they believe they filled in.
    onError: (error) =>
      toast.error(`${error?.message ?? ''} پاسخ‌های شما محفوظ است؛ دوباره ثبت کنید.`.trim(), {
        title: 'نظرات شما ثبت نشد',
      }),
  });

  /**
   * Maps over the questions, not over the form values, so every question is
   * always present in the request even if a field somehow never registered.
   */
  const onSubmit = (values) => {
    const votes = (questions ?? []).map((question) => ({
      pollId: question._id,
      vote: Number(values.votes?.[question._id] ?? DEFAULT_ANSWER),
    }));

    mutation.mutate(votes);
  };

  if (isPending) {
    return <Loader label="در حال بارگذاری پرسش‌ها" />;
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Alert title="پرسش‌های نظرسنجی بارگذاری نشد" onRetry={refetch}>
          {error?.message}
        </Alert>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <EmptyState
        title="نظرسنجی فعالی وجود ندارد"
        hint="در حال حاضر پرسشی برای پاسخ ثبت نشده است. از بخش‌های دیگر سایت استفاده کنید."
        actionLabel="صفحه اصلی"
        actionTo="/"
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <header className="mb-6 sm:mb-8">
        <p className="font-mono text-xs uppercase tracking-[0.28em] text-azure">Voice of customer</p>
        <h1 className="mt-3 text-2xl font-bold leading-tight sm:text-3xl">نظرسنجی</h1>
        <p className="mt-3 max-w-md leading-7 text-muted">
          به هر پرسش یک پاسخ بدهید و در پایان همه را ثبت کنید. پاسخ‌ها بی‌نام ثبت می‌شوند.
        </p>
      </header>

      {/* Both submission outcomes are toasts - see the note at the top of this
          file. The Alert above stays for the question list failing to load,
          which is a state of the page rather than of a submission. */}
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="space-y-4">
          {questions.map((question, index) => (
            <QuestionCard
              key={question._id}
              question={question}
              index={index}
              register={register}
              disabled={mutation.isPending}
            />
          ))}
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={mutation.isPending}
          className="mt-6 w-full sm:w-auto"
        >
          {mutation.isPending ? 'در حال ثبت نظرات…' : 'ثبت نظرات'}
        </Button>
      </form>
    </div>
  );
}

export default Poll;
