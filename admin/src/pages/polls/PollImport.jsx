/**
 * Bulk import of survey questions from a CSV file.
 *
 * Purpose: load a whole survey at once instead of typing each question into the
 *          single-record form.
 * Inputs:  a `.csv` file the operator picks or drops
 * Outputs: created Poll questions, and a report of what happened to every row
 * Deps:    api/operations, hooks/useResource, components/ui/*
 *
 * NEW SCREEN, matching new backend functionality — the legacy panel had no
 * import anywhere in it.
 *
 * TWO PHASES, DELIBERATELY. The file is first sent with `dryRun`, which runs
 * every check server-side and writes nothing; only after the operator has seen
 * the report does the same file go up again for real. Client-side parsing was
 * rejected for this: the duplicate check needs the questions already stored,
 * and a preview computed by different code from the import it promises is a
 * preview that can lie.
 *
 * The template is generated here rather than fetched, because it is four lines
 * of text and the panel must work with no network beyond its own API. It
 * carries a UTF-8 BOM so that double-clicking it opens in Excel as Persian text
 * rather than as mojibake — the one case where a BOM is the helpful choice.
 */
import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { importPollQuestions } from '../../api/operations.js';
import { resourceKeys } from '../../hooks/useResource.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { Card, PageHeader, SectionHeader, Badge, StatusBadge } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Checkbox } from '../../components/ui/Input.jsx';
import { Alert } from '../../components/ui/Feedback.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { toPersianNumber, formatBytes } from '../../services/format.js';

/** Columns the importer recognises, in the order the template writes them. */
const COLUMNS = [
  {
    header: 'سوال',
    required: true,
    note: 'متن فارسی سوال. حداکثر ۵۰۰ نویسه.',
  },
  {
    header: 'سوال لاتین',
    required: false,
    note: 'اختیاری. اگر خالی بماند ذخیره نمی‌شود.',
  },
  {
    header: 'ترتیب',
    required: false,
    note: 'عدد صحیح؛ کوچک‌تر بالاتر. خالی بگذارید تا پس از سوالات فعلی قرار گیرد.',
  },
  {
    header: 'وضعیت',
    required: false,
    note: 'فعال یا غیرفعال (۱ و ۰ هم پذیرفته می‌شود). پیش‌فرض فعال است.',
  },
];

const TEMPLATE_ROWS = [
  ['سوال', 'سوال لاتین', 'ترتیب', 'وضعیت'],
  ['کیفیت پذیرایی را چگونه ارزیابی می‌کنید؟', 'How do you rate the catering?', '1', 'فعال'],
  ['از سرعت اینترنت داخل کابین راضی بودید؟', 'Were you satisfied with the cabin internet?', '2', 'فعال'],
  ['تنوع فیلم‌های ارائه‌شده چطور بود؟', 'How was the film selection?', '', ''],
];

/** Quotes a cell only when it needs it, the way a spreadsheet writes CSV. */
function csvCell(value) {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** U+FEFF, built rather than typed so the source file has no stray BOM in it. */
const BOM = String.fromCharCode(0xfeff);

function downloadTemplate() {
  const body = TEMPLATE_ROWS.map((row) => row.map(csvCell).join(',')).join('\r\n');
  // The BOM is what makes Excel read this as UTF-8; without it the Persian
  // headers arrive as question marks.
  const blob = new Blob([`${BOM}${body}\r\n`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = 'poll-questions-template.csv';
  link.click();

  URL.revokeObjectURL(url);
}

export function PollImport() {
  useDocumentTitle('ورود گروهی سوالات نظرسنجی');

  const toast = useToast();
  const queryClient = useQueryClient();
  const inputRef = useRef(null);

  const [file, setFile] = useState(null);
  const [skipInvalid, setSkipInvalid] = useState(false);
  const [dragging, setDragging] = useState(false);
  /** The dry-run report, or the final one once the import has run. */
  const [report, setReport] = useState(null);
  const [failure, setFailure] = useState(null);

  const preview = useMutation({
    mutationFn: (options) => importPollQuestions(file, { ...options, dryRun: true }),
    onSuccess: (data) => {
      setReport(data);
      setFailure(null);
    },
    onError: (error) => {
      setReport(null);
      setFailure(error);
    },
  });

  const commit = useMutation({
    mutationFn: () => importPollQuestions(file, { skipInvalid, dryRun: false }),
    onSuccess: (data) => {
      setReport(data);
      setFailure(null);
      // The list, the lookup and any open detail all go stale at once.
      queryClient.invalidateQueries({ queryKey: resourceKeys.all('polls') });
      toast.success(`${toPersianNumber(data.totals.created)} سوال افزوده شد.`);
    },
    onError: (error) => setFailure(error),
  });

  const busy = preview.isPending || commit.isPending;
  const imported = Boolean(report && !report.dryRun);

  /** A new file invalidates everything already on screen. */
  const chooseFile = (next) => {
    setFile(next ?? null);
    setReport(null);
    setFailure(null);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDragging(false);
    if (busy) return;
    const dropped = event.dataTransfer.files?.[0];
    if (dropped) chooseFile(dropped);
  };

  // Re-checking after a preview must re-run it, or the checkbox would appear to
  // change a report it no longer describes.
  const toggleSkipInvalid = (next) => {
    setSkipInvalid(next);
    if (report?.dryRun && file) {
      preview.mutate({ skipInvalid: next });
    }
  };

  return (
    <>
      <PageHeader
        title="ورود گروهی سوالات نظرسنجی"
        description="یک فایل CSV بارگذاری کنید تا سوالات نظرسنجی یکجا افزوده شوند."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="ghost" to="/polls">
              بازگشت به فهرست
            </Button>
            <Button size="sm" onClick={downloadTemplate}>
              <span aria-hidden="true">⭳</span>
              دریافت فایل نمونه
            </Button>
          </div>
        }
      />

      <div className="space-y-4">
        <Card>
          <SectionHeader
            title="ساختار فایل"
            description="سربرگ فارسی یا لاتین، به هر ترتیبی، پذیرفته می‌شود. جداکنندهٔ ویرگول، نقطه‌ویرگول و tab شناسایی می‌شود."
          />

          <ul className="mt-3 space-y-2">
            {COLUMNS.map((column) => (
              <li key={column.header} className="flex flex-wrap items-baseline gap-2 text-xs">
                <span className="rounded bg-panel-hi px-2 py-1 font-bold text-paper">
                  {column.header}
                </span>
                <Badge tone={column.required ? 'accent' : 'neutral'}>
                  {column.required ? 'الزامی' : 'اختیاری'}
                </Badge>
                <span className="text-muted">{column.note}</span>
              </li>
            ))}
          </ul>

          <p className="mt-4 text-xs leading-6 text-muted">
            سوالی که متن آن با یکی از سوالات موجود یکسان باشد، دوباره ساخته نمی‌شود؛ بنابراین
            بارگذاری دوبارهٔ یک فایل اصلاح‌شده فقط موارد جدید را اضافه می‌کند. مقیاس پاسخ ثابت است
            (عالی، خوب، متوسط، ضعیف) و در فایل نمی‌آید.
          </p>
        </Card>

        <Card>
          <SectionHeader title="فایل" description="حداکثر ۲ مگابایت و ۵۰۰ سطر." />

          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={
              'mt-3 flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed ' +
              'px-4 py-8 text-center transition-colors ' +
              (dragging ? 'border-azure bg-azure-dim/20' : 'border-line bg-panel-hi')
            }
          >
            <span aria-hidden="true" className="text-2xl">
              🗒
            </span>

            {file ? (
              <p className="text-sm text-paper">
                {file.name}
                <span className="text-muted"> · {formatBytes(file.size)}</span>
              </p>
            ) : (
              <p className="text-sm text-muted">فایل CSV را اینجا رها کنید یا انتخاب نمایید.</p>
            )}

            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(event) => {
                const picked = event.target.files?.[0];
                // Reset first, so picking the same file twice still fires.
                event.target.value = '';
                if (picked) chooseFile(picked);
              }}
            />

            <Button size="sm" onClick={() => inputRef.current?.click()} disabled={busy}>
              {file ? 'انتخاب فایل دیگر' : 'انتخاب فایل'}
            </Button>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <Checkbox
              label="سطرهای نامعتبر نادیده گرفته شوند"
              checked={skipInvalid}
              disabled={busy || imported}
              onChange={(event) => toggleSkipInvalid(event.target.checked)}
            />

            <div className="flex flex-wrap items-center gap-2">
              {imported ? (
                <Button variant="primary" size="sm" to="/polls">
                  مشاهدهٔ سوالات
                </Button>
              ) : (
                <>
                  <Button
                    size="sm"
                    onClick={() => preview.mutate({ skipInvalid })}
                    disabled={!file || busy}
                    loading={preview.isPending}
                  >
                    بررسی فایل
                  </Button>

                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => commit.mutate()}
                    disabled={
                      !file ||
                      busy ||
                      !report?.dryRun ||
                      report.wouldFail ||
                      report.totals.pending === 0
                    }
                    loading={commit.isPending}
                  >
                    {report?.dryRun && report.totals.pending > 0
                      ? `افزودن ${toPersianNumber(report.totals.pending)} سوال`
                      : 'افزودن سوالات'}
                  </Button>
                </>
              )}
            </div>
          </div>

          {failure ? (
            <Alert tone="danger" title="فایل پذیرفته نشد" className="mt-4">
              <p>{failure.message}</p>
              {failure.errors?.length > 0 ? (
                <ul className="mt-2 space-y-1">
                  {failure.errors.slice(0, 20).map((item, index) => (
                    <li key={`${item.field}-${index}`}>
                      <span className="font-mono">{item.field}</span> — {item.message}
                    </li>
                  ))}
                </ul>
              ) : null}
            </Alert>
          ) : null}
        </Card>

        {report ? <ImportReport report={report} /> : null}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ report --- */

function ImportReport({ report }) {
  const { totals } = report;
  const pending = report.dryRun ? totals.pending : totals.created;

  return (
    <Card>
      <SectionHeader
        title={report.dryRun ? 'پیش‌نمایش' : 'نتیجهٔ ورود'}
        description={report.fileName}
      />

      <div className="mt-3 flex flex-wrap gap-2">
        <Stat
          label={report.dryRun ? 'آمادهٔ افزودن' : 'افزوده شد'}
          value={pending}
          tone={pending > 0 ? 'success' : 'neutral'}
        />
        <Stat label="تکراری" value={totals.duplicates} tone={totals.duplicates > 0 ? 'warning' : 'neutral'} />
        <Stat label="نامعتبر" value={totals.invalid} tone={totals.invalid > 0 ? 'danger' : 'neutral'} />
        <Stat label="کل سطرها" value={totals.rows} tone="neutral" />
      </div>

      {report.wouldFail ? (
        <Alert tone="danger" title="این فایل به همین شکل وارد نمی‌شود" className="mt-4">
          سطرهای نامعتبر را در فایل اصلاح کنید، یا گزینهٔ «سطرهای نامعتبر نادیده گرفته شوند» را
          فعال کنید تا فقط سطرهای سالم افزوده شوند.
        </Alert>
      ) : null}

      {!report.hasHeader ? (
        <Alert tone="warning" title="سربرگ شناسایی نشد" className="mt-4">
          ستون‌ها به ترتیب «سوال، سوال لاتین، ترتیب، وضعیت» خوانده شدند. اگر ترتیب فایل شما متفاوت
          است، یک سطر سربرگ به آن اضافه کنید.
        </Alert>
      ) : null}

      {report.errors.length > 0 ? (
        <ReportTable
          title="سطرهای نامعتبر"
          tone="danger"
          rows={report.errors}
          columns={[
            { header: 'سطر', render: (row) => toPersianNumber(row.line), width: 'w-16' },
            { header: 'اشکال', render: (row) => row.message },
            { header: 'مقدار', render: (row) => row.value || '—' },
          ]}
        />
      ) : null}

      {report.duplicates.length > 0 ? (
        <ReportTable
          title="سوالات تکراری (افزوده نشدند)"
          tone="warning"
          rows={report.duplicates}
          columns={[
            { header: 'سطر', render: (row) => toPersianNumber(row.line), width: 'w-16' },
            { header: 'سوال', render: (row) => row.questionFa },
            {
              header: 'دلیل',
              render: (row) =>
                row.reason === 'existing'
                  ? 'از قبل ثبت شده است'
                  : `تکرار سطر ${toPersianNumber(row.firstSeenLine)} همین فایل`,
            },
          ]}
        />
      ) : null}

      {report.questions.length > 0 ? (
        <ReportTable
          title={report.dryRun ? 'سوالاتی که افزوده می‌شوند' : 'سوالات افزوده‌شده'}
          tone="neutral"
          rows={report.questions}
          columns={[
            { header: 'ترتیب', render: (row) => toPersianNumber(row.order), width: 'w-16' },
            { header: 'سوال', render: (row) => row.questionFa },
            {
              header: 'سوال لاتین',
              render: (row) =>
                row.questionEn ? <span dir="ltr">{row.questionEn}</span> : <span className="text-muted/50">—</span>,
            },
            {
              header: 'وضعیت',
              width: 'w-20',
              render: (row) => <StatusBadge isActive={row.isActive} />,
            },
          ]}
        />
      ) : null}
    </Card>
  );
}

function Stat({ label, value, tone }) {
  const TONES = {
    success: 'border-verdant/40 text-paper',
    warning: 'border-azure-dim text-paper',
    danger: 'border-signal/50 text-paper',
    neutral: 'border-line text-muted',
  };

  return (
    <div className={`rounded-lg border bg-panel-hi px-3 py-2 ${TONES[tone] ?? TONES.neutral}`}>
      <span className="font-mono text-sm font-bold">{toPersianNumber(value)}</span>
      <span className="ms-2 text-xs text-muted">{label}</span>
    </div>
  );
}

/**
 * A plain table for one section of the report. Not `DataTable`: these rows are
 * client-side, unpaginated and unsortable, and belong to a file rather than to
 * the database.
 */
function ReportTable({ title, rows, columns, tone }) {
  const HEADING_TONES = {
    danger: 'text-signal',
    warning: 'text-azure',
    neutral: 'text-paper',
  };

  return (
    <section className="mt-5">
      <h3 className={`mb-2 text-xs font-bold ${HEADING_TONES[tone] ?? HEADING_TONES.neutral}`}>
        {title} ({toPersianNumber(rows.length)})
      </h3>

      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full text-start text-xs">
          <thead className="bg-panel-hi text-muted">
            <tr>
              {columns.map((column) => (
                <th key={column.header} className={`px-3 py-2 text-start font-bold ${column.width ?? ''}`}>
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row.line}-${index}`} className="border-t border-line/60">
                {columns.map((column) => (
                  <td key={column.header} className="px-3 py-2 align-top leading-6 text-paper">
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default PollImport;
