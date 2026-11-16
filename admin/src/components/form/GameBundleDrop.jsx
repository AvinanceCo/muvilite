/**
 * Game bundle picker.
 *
 * Purpose: choose the ZIP that holds an HTML5 game — by dropping it or through
 *          the file picker — and show how its upload is going.
 * Inputs:  the chosen file, a callback for a new choice, an upload percentage
 * Outputs: a File, through `onPick`
 * Deps:    services/{media,format}, components/ui/*
 *
 * NEW CONTROL, for the games section; the legacy panel had nothing to compare.
 *
 * IT PICKS, IT DOES NOT UPLOAD — unlike ImageUpload and MovieVideoField, which
 * send the file the moment it is chosen. Those attach a file to a record that
 * already exists; a game's record is CREATED from its bundle, in one request
 * with the rest of the form, so the file has to wait for the submit button. The
 * edit screen reuses this control the same way and puts its own button beside
 * it, because replacing a live game's files should take more than a stray drop.
 *
 * What is checked here is only what can be known without opening the archive —
 * its extension and size. Everything about its CONTENTS is the server's call.
 *
 * `dragover` must be cancelled or the browser navigates to the dropped file and
 * the form is lost, exactly as on the video field.
 */
import { useRef, useState } from 'react';
import { GAME_ZIP_ACCEPT, validateGameZip } from '../../services/media.js';
import { formatBytes, toPersianDigits } from '../../services/format.js';
import { MAX_GAME_ZIP_MB } from '../../utils/constants.js';
import { Button } from '../ui/Button.jsx';
import { useToast } from '../ui/Toast.jsx';

/**
 * @param {object} props
 * @param {File|null} props.file            the current choice
 * @param {(file: File|null) => void} props.onPick
 * @param {number|null} [props.progress]    0–100 while uploading, otherwise null
 * @param {boolean} [props.disabled]
 * @param {boolean} [props.invalid]         paints the frame as an error
 * @param {string} [props.emptyLabel]       what the empty frame says
 */
export function GameBundleDrop({
  file,
  onPick,
  progress = null,
  disabled = false,
  invalid = false,
  emptyLabel = 'فایل ZIP بازی را اینجا رها کنید',
}) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const toast = useToast();

  const uploading = progress !== null;
  const locked = disabled || uploading;

  const accept = (candidate) => {
    if (!candidate) return;

    const problem = validateGameZip(candidate);
    if (problem) {
      toast.error(problem);
      return;
    }
    onPick(candidate);
  };

  const frame = dragging
    ? 'border-azure bg-azure-dim/20'
    : invalid
      ? 'border-signal/70 bg-panel-hi'
      : 'border-line bg-panel-hi';

  return (
    <div className="flex flex-col gap-2">
      <div
        onDragOver={(event) => {
          if (locked) return;
          // Without this the browser opens the file and the form is lost.
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          if (locked) return;
          event.preventDefault();
          setDragging(false);
          accept(event.dataTransfer?.files?.[0]);
        }}
        className={`flex min-h-28 flex-col items-center justify-center gap-1 rounded-lg border border-dashed px-3 py-4 text-center transition-colors ${frame}`}
      >
        {file ? (
          <>
            <p dir="ltr" className="max-w-full truncate font-mono text-xs text-paper">
              {file.name}
            </p>
            <p className="text-xs text-muted">{formatBytes(file.size)}</p>
          </>
        ) : (
          <p className="text-xs leading-6 text-muted">{emptyLabel}</p>
        )}

        {uploading ? (
          <div className="mt-2 w-full max-w-xs">
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
              aria-label="پیشرفت بارگذاری"
              className="h-1.5 overflow-hidden rounded-full bg-line"
            >
              <div
                className="h-full bg-azure transition-[width] duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-muted">
              {progress < 100
                ? `در حال بارگذاری — ${toPersianDigits(progress)}٪`
                : 'در حال بازکردن فایل‌ها روی سرور…'}
            </p>
          </div>
        ) : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={GAME_ZIP_ACCEPT}
        onChange={(event) => {
          const candidate = event.target.files?.[0];
          // Reset first, so picking the same file twice still fires a change.
          event.target.value = '';
          accept(candidate);
        }}
        className="hidden"
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => inputRef.current?.click()} disabled={locked}>
          {file ? 'انتخاب فایل دیگر' : 'انتخاب فایل'}
        </Button>

        {file && !uploading ? (
          <Button size="sm" variant="ghost" onClick={() => onPick(null)} disabled={disabled}>
            برداشتن
          </Button>
        ) : null}
      </div>

      <p className="text-xs leading-6 text-muted/80">
        یک فایل ZIP تا {toPersianDigits(MAX_GAME_ZIP_MB)} مگابایت که{' '}
        <span dir="ltr" className="font-mono">
          index.html
        </span>{' '}
        در ریشهٔ آن یا درون تنها پوشه‌اش باشد.
      </p>
    </div>
  );
}

export default GameBundleDrop;
