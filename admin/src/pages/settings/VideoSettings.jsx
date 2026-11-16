/**
 * «تنظیمات ویدئو» — the MP4/HLS switch for uploaded film and clip video.
 *
 * Purpose: let an operator choose whether an uploaded film or clip is
 *          transcoded to adaptive HLS on the server, or published as the
 *          MP4/WebM it was uploaded as.
 * Inputs:  GET/PUT /api/admin/settings/video
 * Outputs: JSX
 * Deps:    api/settings, hooks/usePermissions, components/ui/*
 *
 * SINCE 2026-11-15 THIS IS THE DEFAULT, not the rule: each film's upload field
 * has its own MP4/HLS choice that starts here (components/form/MovieVideoField).
 *
 * NEW (beyond parity, requested by the maintainer). The backend's
 * services/videoSettings.service.js is the source of truth for what each mode
 * does; this screen explains it in the operator's terms:
 *   - the switch affects the NEXT upload only — videos on the site keep their
 *     format, and a transcode already queued or running still finishes;
 *   - passengers see no difference beyond quality switching: the player plays
 *     both formats;
 *   - HLS needs ffmpeg on the server, so it cannot be chosen without it.
 *
 * A radio group rather than a checkbox: both choices are real modes with
 * their own consequences, and the operator should read both before choosing.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchVideoSettings, updateVideoSettings } from '../../api/settings.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { Card, PageHeader, SectionHeader, Badge } from '../../components/ui/Card.jsx';
import { Alert, ErrorState, Loader } from '../../components/ui/Feedback.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { formatDateTime } from '../../services/format.js';

const videoSettingsKeys = { all: ['settings', 'video'] };

const MODES = [
  {
    value: false,
    tag: 'MP4',
    title: 'بدون تبدیل — یک کیفیت',
    points: [
      'فقط فایل MP4 یا WebM پذیرفته می‌شود.',
      'ویدئو همان لحظهٔ بارگذاری، همان‌طور که هست منتشر می‌شود.',
      'بار اضافه‌ای روی سرور نیست؛ به ffmpeg نیازی نیست.',
      'همه یک کیفیت را می‌بینند؛ در وای‌فای شلوغ ممکن است پخش مکث کند.',
    ],
  },
  {
    value: true,
    tag: 'HLS',
    title: 'تبدیل به HLS — چند کیفیت',
    points: [
      'MP4، MKV، MOV، AVI و … پذیرفته می‌شود.',
      'سرور ویدئو را به ۳۶۰ تا ۱۰۸۰ تبدیل می‌کند؛ پخش‌کننده کیفیت را با سرعت شبکه تنظیم می‌کند.',
      'تبدیل چند دقیقه طول می‌کشد و در این مدت همهٔ هسته‌های پردازنده را مشغول می‌کند.',
      'به ffmpeg روی سرور نیاز دارد.',
    ],
  },
];

export function VideoSettings() {
  useDocumentTitle('تنظیمات ویدئو');

  const toast = useToast();
  const queryClient = useQueryClient();
  const { canEdit } = usePermissions();

  const query = useQuery({ queryKey: videoSettingsKeys.all, queryFn: fetchVideoSettings });

  const save = useMutation({
    mutationFn: updateVideoSettings,
    onSuccess: (data) => {
      queryClient.setQueryData(videoSettingsKeys.all, data);
      // The movie form reads the same answer to decide which files it takes.
      queryClient.invalidateQueries({ queryKey: ['movies', 'video-settings'] });
      toast.success(
        data.transcodeEnabled
          ? 'ویدئوهای بعدی به HLS تبدیل می‌شوند.'
          : 'ویدئوهای بعدی بدون تبدیل، به شکل MP4 منتشر می‌شوند.',
      );
    },
    onError: (error) => toast.error(error.message),
  });

  if (query.isLoading) return <Loader />;
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />;

  const settings = query.data;
  const editable = canEdit('settings');

  return (
    <>
      <PageHeader
        title="تنظیمات ویدئو"
        description="حالت پیش‌فرض انتشار ویدئوی فیلم‌ها و کلیپ‌ها. برای هر ویدئو می‌توان هنگام بارگذاری، در فرم همان فیلم، حالت دیگری را انتخاب کرد."
        actions={
          settings.updatedAt ? (
            <Badge tone="neutral">آخرین تغییر: {formatDateTime(settings.updatedAt)}</Badge>
          ) : null
        }
      />

      <div className="space-y-4">
        {!editable ? (
          <Alert tone="info" title="دسترسی فقط خواندنی">
            برای تغییر این تنظیم به مجوز ویرایش بخش «تنظیمات» نیاز دارید.
          </Alert>
        ) : null}

        {!settings.transcoderAvailable ? (
          <Alert tone={settings.transcodeEnabled ? 'danger' : 'warning'} title="ffmpeg روی سرور نصب نیست">
            {settings.transcodeEnabled
              ? 'حالت HLS انتخاب شده اما سرور ابزار تبدیل ندارد؛ بارگذاری ویدئو تا نصب ffmpeg یا انتخاب MP4 ممکن نیست.'
              : 'حالت HLS تا نصب ffmpeg روی سرور در دسترس نیست. راهنمای نصب در DEPLOYMENT.md آمده است.'}
          </Alert>
        ) : null}

        <Card>
          <SectionHeader
            title="تبدیل ویدئو — پیش‌فرض"
            description="این انتخاب حالتی است که گزینهٔ «نوع انتشار» در فرم هر فیلم با آن شروع می‌شود، و فقط روی بارگذاری‌های بعدی اثر دارد. ویدئوهای فعلی همان قالب خود را نگه می‌دارند و تبدیلی که در صف یا در حال انجام است تمام می‌شود. پخش‌کنندهٔ سایت هر دو قالب را پخش می‌کند."
          />

          <div role="radiogroup" aria-label="قالب ویدئوی بارگذاری‌شده" className="mt-4 grid gap-3 md:grid-cols-2">
            {MODES.map((mode) => {
              const selected = settings.transcodeEnabled === mode.value;
              const unavailable = mode.value && !settings.transcoderAvailable;
              const disabled = !editable || save.isPending || unavailable;

              return (
                <button
                  key={mode.tag}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={disabled && !selected}
                  onClick={() => {
                    if (!selected && !disabled) save.mutate(mode.value);
                  }}
                  className={
                    'flex flex-col gap-3 rounded-lg border p-4 text-start transition-colors ' +
                    (selected
                      ? 'border-azure bg-azure-dim/25 shadow-[0_0_0_1px] shadow-azure/40'
                      : 'border-line bg-panel-hi hover:border-azure-dim') +
                    (disabled && !selected ? ' cursor-not-allowed opacity-50' : '')
                  }
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className={
                          'flex size-4 items-center justify-center rounded-full border ' +
                          (selected ? 'border-azure' : 'border-muted')
                        }
                      >
                        {selected ? <span className="size-2 rounded-full bg-azure" /> : null}
                      </span>
                      <span className="font-bold text-paper">{mode.title}</span>
                    </span>
                    <span
                      dir="ltr"
                      className={
                        'rounded-md border px-2 py-0.5 font-mono text-xs ' +
                        (selected ? 'border-azure text-azure' : 'border-line text-muted')
                      }
                    >
                      {mode.tag}
                    </span>
                  </span>

                  <ul className="space-y-1.5 text-xs leading-6 text-muted">
                    {mode.points.map((point) => (
                      <li key={point} className="flex gap-2">
                        <span aria-hidden="true" className="text-azure">•</span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>

                  {unavailable ? <span className="text-xs text-signal">ffmpeg روی سرور نصب نیست.</span> : null}
                </button>
              );
            })}
          </div>

          {!settings.chosen ? (
            <p className="mt-4 text-xs leading-6 text-muted">
              هنوز کسی این تنظیم را انتخاب نکرده است؛ تا آن زمان سرور{' '}
              {settings.transcoderAvailable ? 'چون ffmpeg دارد، HLS' : 'چون ffmpeg ندارد، MP4'} را به کار
              می‌برد.
            </p>
          ) : null}
        </Card>
      </div>
    </>
  );
}

export default VideoSettings;
