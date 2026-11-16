/**
 * Video attachment control.
 *
 * Purpose: preview the current pre-roll creative, pick a replacement, and
 *          upload it together with the duration measured from the file.
 * Inputs:  the current stored path and an upload function
 * Outputs: the updated document, through `onUploaded`
 * Deps:    services/media, components/ui/*
 *
 * The image sibling of this control is components/form/ImageUpload.jsx and the
 * rules are the same: the upload is a SEPARATE REQUEST from the form save, so a
 * record must exist before a file can hang off it, and the control stays
 * disabled until it does.
 *
 * What differs is the duration. A VAST tag has to advertise how long the
 * creative runs, and the server cannot measure that without ffmpeg. The browser
 * can — it decodes the metadata of the chosen file locally — so the number is
 * read here and sent with the upload. It is advisory metadata only: playback is
 * driven by the file, and the value stays editable on the form.
 */
import { useEffect, useRef, useState } from 'react';
import { VIDEO_ACCEPT, mediaUrl, readVideoDuration, validateVideoFile } from '../../services/media.js';
import { formatTimecode } from '../../services/format.js';
import { Button } from '../ui/Button.jsx';
import { useToast } from '../ui/Toast.jsx';

/**
 * @param {object} props
 * @param {string|null} props.path       current stored path, e.g. `/uploads/ads/…`
 * @param {number} [props.durationSecond] the stored duration, for the caption
 * @param {(file: File, durationSecond: number|null) => Promise<object>} props.onUpload
 * @param {(document: object) => void} [props.onUploaded]
 * @param {boolean} [props.disabled]     true until the record exists
 * @param {string} [props.hint]
 */
export function VideoUpload({
  label = 'فایل تبلیغ',
  path,
  durationSecond,
  onUpload,
  onUploaded,
  disabled = false,
  hint,
}) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  // A local object URL so the new creative is previewable at once, before the
  // response comes back with its stored path.
  const [preview, setPreview] = useState(null);
  // A stored path can outlive its file — a database restored without its
  // uploads directory. Saying so beats a silently dead player.
  const [broken, setBroken] = useState(false);
  const toast = useToast();

  const shown = preview ?? mediaUrl(path);

  useEffect(() => {
    setBroken(false);
  }, [shown]);

  // An object URL created for the preview must outlive the upload, so it is
  // released on unmount or replacement rather than in the upload handler.
  useEffect(() => {
    if (!preview) return undefined;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    // Reset at once, so choosing the same file twice still fires a change.
    event.target.value = '';
    if (!file) return;

    const problem = validateVideoFile(file);
    if (problem) {
      toast.error(problem);
      return;
    }

    setPreview(URL.createObjectURL(file));
    setUploading(true);

    try {
      const duration = await readVideoDuration(file);
      const updated = await onUpload(file, duration);
      onUploaded?.(updated);
      toast.success(
        duration === null
          ? 'ویدئو بارگذاری شد. مدت زمان قابل تشخیص نبود؛ آن را دستی وارد کنید.'
          : 'ویدئو بارگذاری شد.',
      );
    } catch (error) {
      setPreview(null);
      toast.error(error.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-bold text-muted">{label}</span>

      <div className="flex items-center justify-center overflow-hidden rounded-lg border border-line bg-panel-hi aspect-video">
        {shown && !broken ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption -- a preview of
          // an advertisement creative; there is no caption track to attach.
          <video
            src={shown}
            controls
            preload="metadata"
            onError={() => setBroken(true)}
            className="size-full bg-black object-contain"
          />
        ) : (
          <span className="px-2 text-center text-xs text-muted">
            {broken ? 'فایل ویدئو روی سرور یافت نشد' : 'ویدئویی ندارد'}
          </span>
        )}
      </div>

      <input ref={inputRef} type="file" accept={VIDEO_ACCEPT} onChange={handleFile} className="hidden" />

      <Button
        size="sm"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || uploading}
        loading={uploading}
      >
        {path ? 'تغییر ویدئو' : 'انتخاب ویدئو'}
      </Button>

      {durationSecond ? (
        <p className="text-xs text-muted/80">
          مدت زمان ثبت‌شده: <span className="font-mono">{formatTimecode(durationSecond)}</span>
        </p>
      ) : null}

      {disabled ? (
        <p className="text-xs text-muted/80">
          ابتدا رکورد را ذخیره کنید، سپس ویدئو را بارگذاری کنید.
        </p>
      ) : hint ? (
        <p className="text-xs text-muted/80">{hint}</p>
      ) : null}
    </div>
  );
}

export default VideoUpload;
