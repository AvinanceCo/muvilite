/**
 * Image attachment control.
 *
 * Purpose: preview the current image, pick a replacement, and upload it.
 * Inputs:  the current stored path and an upload function
 * Outputs: the updated document, through `onUploaded`
 * Deps:    services/media, components/ui/*
 *
 * Uploads are a SEPARATE REQUEST from the form save, exactly as the legacy
 * panel's `upload.php` / `poster.php` were: the record must exist before a file
 * can be attached to it. So this control is disabled until the record has an
 * id, and a new record must be saved once before it can get a picture.
 *
 * The chosen file is checked client-side first (services/media) so an operator
 * on a slow link learns about a wrong format before a 10 MB round trip. The
 * server re-checks everything — including that the extension matches the
 * sniffed MIME type — so this is courtesy, not enforcement.
 */
import { useEffect, useRef, useState } from 'react';
import {
  IMAGE_ACCEPT,
  mediaUrl,
  validateImageFile,
  validateImageSize,
} from '../../services/media.js';
import { Button } from '../ui/Button.jsx';
import { useToast } from '../ui/Toast.jsx';

/**
 * @param {object} props
 * @param {string|null} props.path        current stored path, e.g. `/uploads/…`
 * @param {(file: File) => Promise<object>} props.onUpload  the API call
 * @param {(document: object) => void} [props.onUploaded]   receives the response
 * @param {boolean} [props.disabled]      true until the record exists
 * @param {string} [props.aspect]         CSS aspect-ratio for the preview box
 * @param {string} [props.hint]           recommended dimensions, etc.
 * @param {{width: number, height: number}[]} [props.acceptedSizes] the exact
 *        dimensions the file may have — one entry for an ad slot, several for a
 *        banner. The server enforces the same rule and rejects a mismatch.
 * @param {string} [props.disabledHint]   why the control is disabled. Defaults to
 *        the save-first rule above, which is the reason on every entity form —
 *        the placeholders screen has no record to save and overrides it.
 */
export function ImageUpload({
  label = 'تصویر',
  path,
  onUpload,
  onUploaded,
  disabled = false,
  aspect = '16 / 9',
  hint,
  acceptedSizes,
  disabledHint = 'ابتدا رکورد را ذخیره کنید، سپس تصویر را بارگذاری کنید.',
}) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  // A local object URL so the new image appears immediately, before the
  // response comes back with its stored path.
  const [preview, setPreview] = useState(null);
  // A stored path can outlive its file — say a database restored without its
  // uploads directory. Saying so beats a broken-image glyph.
  const [broken, setBroken] = useState(false);
  const toast = useToast();

  const shown = preview ?? mediaUrl(path);

  // A new path deserves a fresh attempt.
  useEffect(() => {
    setBroken(false);
  }, [shown]);

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    // Reset at once, so choosing the same file twice still fires a change.
    event.target.value = '';
    if (!file) return;

    const problem = validateImageFile(file);
    if (problem) {
      toast.error(problem);
      return;
    }

    // Decoding the file to measure it takes a moment on large artwork, so the
    // button shows its busy state before the check rather than only during the
    // upload that follows.
    setUploading(true);

    const wrongSize = await validateImageSize(file, acceptedSizes);
    if (wrongSize) {
      setUploading(false);
      toast.error(wrongSize);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);

    try {
      const updated = await onUpload(file);
      onUploaded?.(updated);
      toast.success('تصویر بارگذاری شد.');
    } catch (error) {
      setPreview(null);
      toast.error(error.message);
    } finally {
      setUploading(false);
      URL.revokeObjectURL(objectUrl);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Omitted entirely when empty: a caller whose own heading already names
          the image (the placeholders screen) should not get a blank line. */}
      {label ? <span className="text-xs font-bold text-muted">{label}</span> : null}

      <div
        className="flex items-center justify-center overflow-hidden rounded-lg border border-line bg-panel-hi"
        style={{ aspectRatio: aspect }}
      >
        {shown && !broken ? (
          <img src={shown} alt="" onError={() => setBroken(true)} className="size-full object-cover" />
        ) : (
          <span className="px-2 text-center text-xs text-muted">
            {broken ? 'فایل تصویر روی سرور یافت نشد' : 'تصویری ندارد'}
          </span>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={IMAGE_ACCEPT}
        onChange={handleFile}
        className="hidden"
      />

      <Button
        size="sm"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || uploading}
        loading={uploading}
      >
        {path ? 'تغییر تصویر' : 'انتخاب تصویر'}
      </Button>

      {disabled ? (
        <p className="text-xs text-muted/80">{disabledHint}</p>
      ) : hint ? (
        <p className="text-xs text-muted/80">{hint}</p>
      ) : null}
    </div>
  );
}

export default ImageUpload;
