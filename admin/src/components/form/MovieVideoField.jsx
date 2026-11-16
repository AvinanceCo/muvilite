/**
 * A catalog title's video — uploaded (and transcoded to HLS) or linked.
 *
 * Purpose: attach the file a passenger actually watches, by drag-and-drop, by
 *          file picker, or by pasting an address; follow an upload through the
 *          server's HLS transcode; and refuse anything that does not meet the
 *          standard for the kind of record it is.
 * Inputs:  the stored path, its measured metadata, the transcode state, and
 *          the API calls
 * Outputs: the updated movie, through `onChanged`
 * Deps:    services/media, services/format, components/form/VideoPreview,
 *          components/ui/*
 *
 * NEW CONTROL. The legacy player derived the video URL from the row id
 * (`assets/video/{id}.mp4` in player.php), so files were placed by FTP and the
 * panel had no way to attach one — `videoPath` survived the migration with
 * nothing able to write it.
 *
 * TWO SOURCES, ONE FIELD. A file and a link both end up in `videoPath`, so
 * setting either replaces the other; the control makes that visible rather than
 * showing two half-filled inputs whose precedence nobody could guess.
 *
 * MP4 OR HLS, PER UPLOAD (2026-11-15). A two-way choice above the buttons
 * decides how the next file is published. It starts on the installation's
 * switch («تنظیمات ویدئو»), which is now only that — a default — and travels
 * with the upload as `?mode=`. HLS cannot be picked on a server without ffmpeg.
 * Changing it affects only the next upload from this field; the video already
 * attached keeps its format.
 *
 * UPLOADS ARE TRANSCODED (NEW, beyond parity). In HLS mode the server turns an upload —
 * MP4, MKV, MOV, AVI… — into an adaptive HLS set in the background. The upload
 * request returns as soon as the file is queued; this control then polls the
 * job and shows its queue position, progress, or failure (with a retry), and
 * refreshes the form when it lands. Until then the title keeps playing whatever
 * video it had before.
 *
 * THE SIZE CHECK. For an upload the server measures the file with ffprobe and
 * has the last word; this browser still decodes what it can first, so an
 * obvious mismatch is refused before gigabytes are sent. A container the
 * browser cannot decode (MKV, AVI…) is simply left to the server. For a link,
 * what this browser reads is the only measurement there is, and an unreadable
 * one is saved unverified.
 *
 * The drop zone accepts a drop anywhere on itself, and `dragover` must be
 * cancelled or the browser navigates away to the dropped file — which loses the
 * form.
 */
import { useEffect, useRef, useState } from 'react';
import {
  MOVIE_VIDEO_ACCEPT,
  VIDEO_ACCEPT,
  mediaUrl,
  readVideoMetadata,
  validateMovieVideoFile,
  validateVideoFile,
  validateVideoStandard,
} from '../../services/media.js';
import { formatTimecode, toPersianDigits } from '../../services/format.js';
import { Button } from '../ui/Button.jsx';
import { CodeInput } from '../ui/Input.jsx';
import { useToast } from '../ui/Toast.jsx';
import VideoPreview from './VideoPreview.jsx';

/** An `http(s)` address is a link; anything else came out of `/uploads/`. */
const isExternal = (path) => /^https?:\/\//i.test(path ?? '');
const isHls = (path) => /\.m3u8(?:[?#]|$)/i.test(path ?? '');

/** How often a running transcode is asked about. */
const POLL_MS = 3000;

const ACTIVE = new Set(['queued', 'processing']);

/** The transcode state as this control tracks it. */
const jobFrom = (source = {}) => ({
  status: source.videoStatus ?? 'none',
  progress: source.videoProgress ?? 0,
  error: source.videoError ?? null,
  queuePosition: source.videoQueuePosition ?? null,
});

/**
 * @param {object} props
 * @param {string|null} props.path         stored `videoPath` — what plays
 * @param {boolean} props.isClip           which standard applies
 * @param {number|null} [props.durationSecond] stored measurement
 * @param {number|null} [props.width]
 * @param {number|null} [props.height]
 * @param {boolean|null} [props.transcode] the MP4/HLS switch — the mode this
 *        field STARTS on: true = HLS (any container, transcoded), false = MP4
 *        (MP4/WebM only, published as it is), null = not known yet (HLS)
 * @param {boolean|null} [props.transcoderAvailable] false when the server has
 *        no ffmpeg, which rules HLS out; null = not known yet
 * @param {string} [props.status]          `videoStatus`
 * @param {number} [props.progress]        `videoProgress`
 * @param {string|null} [props.error]      `videoError`
 * @param {(file: File, meta: object, onProgress: (n: number) => void, mode: 'hls'|'mp4') => Promise<object>} props.onUploadFile
 * @param {(url: string, meta: object) => Promise<object>} props.onSaveLink
 * @param {() => Promise<object>} props.onRemove
 * @param {() => Promise<object>} props.onLoadStatus
 * @param {() => Promise<object>} props.onRetry
 * @param {(document: object) => void} [props.onChanged]
 * @param {boolean} [props.disabled]       true until the record exists
 */
export function MovieVideoField({
  path,
  isClip,
  durationSecond,
  width,
  height,
  transcode = null,
  transcoderAvailable = null,
  status,
  progress,
  error,
  onUploadFile,
  onSaveLink,
  onRemove,
  onLoadStatus,
  onRetry,
  onChanged,
  disabled = false,
}) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [link, setLink] = useState('');
  const [broken, setBroken] = useState(false);
  const [job, setJob] = useState(() => jobFrom({ videoStatus: status, videoProgress: progress, videoError: error }));
  const toast = useToast();

  // The form's copy wins whenever it changes (a refetch after save, say).
  useEffect(() => {
    setJob(jobFrom({ videoStatus: status, videoProgress: progress, videoError: error }));
  }, [status, progress, error]);

  const shown = mediaUrl(path);

  /**
   * This field's MP4/HLS choice. Follows the installation default until the
   * operator picks one here (the default arrives in its own request); falls
   * back to MP4 when the server cannot transcode.
   */
  const [pickedMode, setPickedMode] = useState(null);
  const hlsAllowed = transcoderAvailable !== false;
  const defaultMode = transcode === false || !hlsAllowed ? 'mp4' : 'hls';
  const mode = pickedMode === 'hls' && !hlsAllowed ? 'mp4' : (pickedMode ?? defaultMode);
  /** Which files the picker offers and how they are judged. */
  const hlsMode = mode === 'hls';

  useEffect(() => {
    setBroken(false);
  }, [shown]);

  // Read through refs, so the poll is not restarted by new callback identities.
  const loadStatusRef = useRef(onLoadStatus);
  loadStatusRef.current = onLoadStatus;
  const changedRef = useRef(onChanged);
  changedRef.current = onChanged;
  const toastRef = useRef(toast);
  toastRef.current = toast;

  /**
   * While a transcode is queued or running, ask the server how it is going.
   * When it settles, hand the fresh record to the form so the preview and the
   * measured size update, and say what happened.
   */
  const active = ACTIVE.has(job.status);
  useEffect(() => {
    if (!active || !loadStatusRef.current) return undefined;

    let stopped = false;
    const timer = setInterval(async () => {
      try {
        const latest = await loadStatusRef.current();
        if (stopped || !latest) return;
        const next = jobFrom(latest);
        setJob(next);
        if (next.status === 'ready') {
          toastRef.current.success('تبدیل ویدئو به HLS تمام شد و آمادهٔ پخش است.');
          changedRef.current?.(latest);
        } else if (next.status === 'failed') {
          toastRef.current.error('تبدیل ویدئو ناموفق بود.');
          changedRef.current?.(latest);
        }
      } catch {
        // A missed poll is not worth a toast; the next one will try again.
      }
    }, POLL_MS);

    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [active]);

  /** Shared by the picker and the drop zone. */
  const acceptFile = async (file) => {
    if (!file) return;

    const problem = hlsMode ? validateMovieVideoFile(file) : validateVideoFile(file);
    if (problem) {
      toast.error(problem);
      return;
    }

    setBusy(true);

    try {
      // Best effort: null for a container this browser cannot decode, and the
      // server's ffprobe decides.
      const meta = await readVideoMetadata(file);
      const wrong = validateVideoStandard(isClip, meta);
      if (wrong) {
        toast.error(wrong);
        return;
      }

      setUploadPercent(0);
      const updated = await onUploadFile(file, meta ?? {}, setUploadPercent, mode);
      setJob(jobFrom(updated));
      onChanged?.(updated);
      // The server's answer, not this screen's copy, says which mode it was.
      toast.success(
        ACTIVE.has(updated?.videoStatus)
          ? 'ویدئو بارگذاری شد و در صف تبدیل به HLS قرار گرفت.'
          : 'ویدئو بارگذاری و به شکل MP4 منتشر شد.',
      );
    } catch (failure) {
      toast.error(failure.message);
    } finally {
      setBusy(false);
      setUploadPercent(null);
    }
  };

  const saveLink = async () => {
    const url = link.trim();
    if (!url) return;

    if (!/^https?:\/\/\S+$/i.test(url)) {
      toast.error('نشانی باید با http:// یا https:// شروع شود.');
      return;
    }

    setBusy(true);

    try {
      // Best effort: a host that blocks hotlinking, or answers slowly, simply
      // yields nothing and the link is saved unverified.
      const meta = await readVideoMetadata(url);
      const wrong = validateVideoStandard(isClip, meta);
      if (wrong) {
        toast.error(wrong);
        return;
      }

      const updated = await onSaveLink(url, meta ?? {});
      setJob(jobFrom(updated));
      onChanged?.(updated);
      setLink('');
      toast.success(
        meta ? 'لینک ویدئو ثبت شد.' : 'لینک ثبت شد. مشخصات ویدئو خوانده نشد و بررسی نشد.',
      );
    } catch (failure) {
      toast.error(failure.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      const updated = await onRemove();
      setJob(jobFrom(updated));
      onChanged?.(updated);
      toast.success('ویدئو حذف شد.');
    } catch (failure) {
      toast.error(failure.message);
    } finally {
      setBusy(false);
    }
  };

  const retry = async () => {
    setBusy(true);
    try {
      const updated = await onRetry();
      setJob(jobFrom(updated));
      toast.success('ویدئو دوباره در صف تبدیل قرار گرفت.');
    } catch (failure) {
      toast.error(failure.message);
    } finally {
      setBusy(false);
    }
  };

  const standard = isClip
    ? 'کلیپ: ویدئوی عمودی و کوتاه‌تر از ۳ دقیقه.'
    : 'فیلم: عمودی یا افقی، بلندتر از ۵ دقیقه.';

  const kind = isExternal(path) ? 'لینک بیرونی' : isHls(path) ? 'HLS — چند کیفیت' : 'MP4 — یک کیفیت';
  const hasSomething = Boolean(path) || active || job.status === 'failed';

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-muted">ویدئو</span>
        {path ? (
          <span className="rounded-full border border-line px-2 py-0.5 text-[0.7rem] text-muted">{kind}</span>
        ) : null}
      </div>

      <div
        // A drop anywhere on the frame counts, including on the player.
        onDragOver={(event) => {
          if (disabled || busy) return;
          // Without this the browser opens the file and the form is lost.
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          if (disabled || busy) return;
          event.preventDefault();
          setDragging(false);
          acceptFile(event.dataTransfer?.files?.[0]);
        }}
        className={
          'flex aspect-video items-center justify-center overflow-hidden rounded-lg border border-dashed transition-colors ' +
          (dragging ? 'border-azure bg-azure-dim/20' : 'border-line bg-panel-hi')
        }
      >
        {shown && !broken ? (
          <VideoPreview
            src={shown}
            onError={() => setBroken(true)}
            className="size-full bg-black object-contain"
          />
        ) : (
          <span className="px-3 text-center text-xs leading-6 text-muted">
            {broken
              ? 'ویدئو قابل پخش نیست یا روی سرور پیدا نشد'
              : active
                ? 'ویدئو پس از تبدیل اینجا نمایش داده می‌شود'
                : disabled
                  ? 'ویدئویی ندارد'
                  : 'فایل ویدئو را اینجا رها کنید'}
          </span>
        )}
      </div>

      <TranscodeStatus
        job={job}
        uploadPercent={uploadPercent}
        replacing={Boolean(path)}
        onRetry={retry}
        busy={busy}
        disabled={disabled}
      />

      <ModePicker
        mode={mode}
        onChange={setPickedMode}
        hlsAllowed={hlsAllowed}
        isDefault={mode === defaultMode}
        disabled={disabled || busy}
      />

      <input
        ref={inputRef}
        type="file"
        accept={hlsMode ? MOVIE_VIDEO_ACCEPT : VIDEO_ACCEPT}
        onChange={(event) => {
          const file = event.target.files?.[0];
          // Reset first, so picking the same file twice still fires a change.
          event.target.value = '';
          acceptFile(file);
        }}
        className="hidden"
      />

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || busy}
          loading={busy}
        >
          {path ? 'تغییر فایل' : 'انتخاب فایل'}
        </Button>

        {hasSomething ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={remove}
            disabled={disabled || busy}
            className="hover:border-signal/50 hover:text-signal"
          >
            {path ? 'حذف ویدئو' : 'لغو بارگذاری'}
          </Button>
        ) : null}
      </div>

      <div className="border-t border-line pt-3">
        <label htmlFor="movie-video-link" className="text-xs font-bold text-muted">
          یا نشانی ویدئو
        </label>
        <div className="mt-1.5 flex gap-2">
          <CodeInput
            id="movie-video-link"
            value={link}
            onChange={(event) => setLink(event.target.value)}
            placeholder="https://…/movie.mp4"
            disabled={disabled || busy}
            className="min-w-0 flex-1"
          />
          <Button size="sm" onClick={saveLink} disabled={disabled || busy || !link.trim()}>
            ثبت
          </Button>
        </div>
      </div>

      <div className="space-y-1 text-xs leading-6 text-muted/80">
        <p>{standard}</p>
        {hlsMode ? (
          <p>
            حالت HLS: فرمت‌های MP4، MKV، MOV، AVI، WebM و … پذیرفته می‌شوند؛ ویدئو روی سرور به HLS با
            چند کیفیت (۳۶۰ تا ۱۰۸۰) تبدیل می‌شود.
          </p>
        ) : (
          <p>حالت MP4: فقط فایل MP4 یا WebM پذیرفته می‌شود و همان‌طور که هست منتشر می‌شود.</p>
        )}
        <p>
          حالت پیش‌فرض این گزینه از «تنظیمات ویدئو» می‌آید؛ تغییر آن در اینجا فقط برای بارگذاری بعدی
          همین ویدئو است و ویدئوی فعلی همان‌طور که هست می‌ماند.
        </p>

        {durationSecond || width ? (
          <p>
            مشخصات ثبت‌شده:{' '}
            {durationSecond ? (
              <span className="font-mono">{formatTimecode(Math.round(durationSecond))}</span>
            ) : (
              'مدت نامشخص'
            )}
            {width && height ? (
              <>
                {' — '}
                <span className="font-mono" dir="ltr">
                  {toPersianDigits(width)}×{toPersianDigits(height)}
                </span>
                {height > width ? ' (عمودی)' : ' (افقی)'}
              </>
            ) : null}
          </p>
        ) : null}

        {disabled ? <p>ابتدا رکورد را ذخیره کنید، سپس ویدئو را اضافه کنید.</p> : null}
      </div>
    </div>
  );
}

/** A thin bar with its percentage, for the upload and for the transcode. */
function ProgressBar({ percent, label }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-muted">
        <span>{label}</span>
        <span className="font-mono">{toPersianDigits(percent)}٪</span>
      </div>
      <div
        className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={label}
      >
        <div className="h-full rounded-full bg-azure transition-[width] duration-500" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

/**
 * Where the latest upload stands: being sent, waiting, encoding, or failed.
 * Nothing at all when there is no upload in flight.
 */
/** The two ways an upload can be published, in the order they are offered. */
const MODES = [
  { value: 'hls', label: 'HLS', hint: 'چند کیفیت، تبدیل روی سرور' },
  { value: 'mp4', label: 'MP4', hint: 'یک کیفیت، بدون تبدیل' },
];

/**
 * The per-upload MP4/HLS choice: a two-way radio group. HLS is disabled, with
 * the reason, on a server that has no ffmpeg.
 */
function ModePicker({ mode, onChange, hlsAllowed, isDefault, disabled }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-muted">نوع انتشار بارگذاری</span>
        {isDefault ? <span className="text-[0.7rem] text-muted/80">پیش‌فرض</span> : null}
      </div>
      <div role="radiogroup" aria-label="نوع انتشار بارگذاری" className="grid grid-cols-2 gap-2">
        {MODES.map((option) => {
          const checked = option.value === mode;
          const unavailable = option.value === 'hls' && !hlsAllowed;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={checked}
              disabled={disabled || unavailable}
              title={unavailable ? 'ffmpeg روی سرور نصب نیست' : undefined}
              onClick={() => onChange(option.value)}
              className={
                'rounded-lg border px-3 py-2 text-start transition-colors disabled:cursor-not-allowed disabled:opacity-50 ' +
                (checked
                  ? 'border-azure bg-azure/10 ring-1 ring-azure'
                  : 'border-line hover:border-azure/50 disabled:hover:border-line')
              }
            >
              <span className="block font-mono text-sm font-bold text-paper">{option.label}</span>
              <span className="block text-[0.7rem] leading-5 text-muted">
                {unavailable ? 'ffmpeg روی سرور نصب نیست' : option.hint}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TranscodeStatus({ job, uploadPercent, replacing, onRetry, busy, disabled }) {
  if (uploadPercent !== null) {
    return <ProgressBar percent={uploadPercent} label="در حال ارسال فایل…" />;
  }

  const keepsPlaying = replacing ? ' تا پایان کار، ویدئوی قبلی پخش می‌شود.' : '';

  if (job.status === 'queued') {
    return (
      <p className="rounded-lg border border-line bg-panel-hi px-3 py-2 text-xs leading-6 text-muted">
        در صف تبدیل به HLS
        {job.queuePosition > 1 ? ` (نوبت ${toPersianDigits(job.queuePosition)})` : ''}.{keepsPlaying}
      </p>
    );
  }

  if (job.status === 'processing') {
    return (
      <div className="rounded-lg border border-line bg-panel-hi px-3 py-2">
        <ProgressBar percent={job.progress} label="در حال تبدیل به HLS…" />
        {keepsPlaying ? <p className="mt-1.5 text-xs leading-6 text-muted">{keepsPlaying.trim()}</p> : null}
      </div>
    );
  }

  if (job.status === 'failed') {
    return (
      <div className="rounded-lg border border-signal/40 bg-signal/10 px-3 py-2 text-xs leading-6">
        <p className="font-bold text-signal">تبدیل ویدئو ناموفق بود.</p>
        {job.error ? (
          <p className="mt-1 break-all font-mono text-[0.7rem] text-muted" dir="ltr">
            {job.error}
          </p>
        ) : null}
        <Button size="sm" variant="ghost" className="mt-2" onClick={onRetry} disabled={disabled || busy}>
          تلاش دوباره
        </Button>
      </div>
    );
  }

  return null;
}

export default MovieVideoField;
