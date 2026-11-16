/**
 * Media URL resolution.
 *
 * Purpose: turn a stored media path from the API into a URL the browser can
 *          load, and describe what the uploader will accept.
 * Inputs:  a path string from a document (posterPath, coverPath, photoPath, …)
 * Outputs: an absolute or root-relative URL, or null
 * Deps:    api/client (MEDIA_BASE_URL), utils/constants
 *
 * IMPORTANT: media paths are STORED FIELDS. The legacy app derived them from
 * the row id (`assets/movies/{id}.jpg`), which is why an upload overwrote the
 * previous file and the filename leaked the id. Uploads now get unique
 * generated names, so a path can never be reconstructed from an id — always
 * read it off the document.
 */
import { MEDIA_BASE_URL } from '../api/client.js';
import {
  CLIP_MAX_DURATION_SECONDS,
  MAX_GAME_ZIP_MB,
  MAX_IMAGE_MB,
  MAX_VIDEO_MB,
  MOVIE_MIN_DURATION_SECONDS,
} from '../utils/constants.js';
// Digits, not the number formatter: pixel dimensions must not pick up a
// thousands separator (۱۵۰۰ is a size, «۱٬۵۰۰» is not).
import { toPersianDigits } from './format.js';

/**
 * @param {string|null|undefined} path stored path, e.g. `/uploads/movies/ab12.jpg`
 * @returns {string|null} null when there is no media, so callers can decide
 *          between a placeholder and hiding the element entirely
 */
export function mediaUrl(path) {
  if (!path) return null;

  // Already absolute — an admin may have stored an external URL.
  if (/^https?:\/\//i.test(path)) return path;

  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${MEDIA_BASE_URL}${normalized}`;
}

/**
 * A movie's list thumbnail.
 *
 * `thumbnailPath` is generated at 216×332 by sharp, but the upload endpoint
 * succeeds even when that generation fails — in which case the field is null
 * and the full poster is the only image there is.
 */
export function thumbnailUrl(document) {
  return mediaUrl(document?.thumbnailPath) ?? mediaUrl(document?.posterPath);
}

/** MIME types the backend's image uploader accepts, for the file input. */
export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';

/** MIME types the backend's audio uploader accepts. */
export const AUDIO_ACCEPT = 'audio/mpeg,audio/mp3,audio/wav,audio/ogg';

/** MIME types the backend's video uploader accepts (pre-roll creatives). */
export const VIDEO_ACCEPT = 'video/mp4,video/webm';

/**
 * Rejects a file the server would reject anyway, so the operator learns before
 * a 10 MB upload rather than after. The server re-checks everything; this is
 * courtesy, not enforcement.
 *
 * @returns {string|null} a Persian error message, or null when acceptable
 */
export function validateImageFile(file) {
  if (!file) return 'فایلی انتخاب نشده است.';

  if (!IMAGE_ACCEPT.split(',').includes(file.type)) {
    return 'فرمت تصویر پشتیبانی نمی‌شود. JPEG، PNG، WebP یا GIF انتخاب کنید.';
  }

  if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
    return `حجم تصویر بیشتر از ${MAX_IMAGE_MB} مگابایت است.`;
  }

  return null;
}

/**
 * Reads a local image's pixel dimensions without uploading it.
 *
 * `decoding='async'` and an object URL keep this off the main thread for the
 * large artwork these checks run on. A file the browser cannot decode resolves
 * to null, and the caller lets the server have the final say.
 *
 * @param {File} file
 * @returns {Promise<{width: number, height: number}|null>}
 */
export function readImageSize(file) {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const probe = new Image();

    const finish = (value) => {
      URL.revokeObjectURL(objectUrl);
      resolve(value);
    };

    probe.decoding = 'async';
    probe.onload = () => finish({ width: probe.naturalWidth, height: probe.naturalHeight });
    probe.onerror = () => finish(null);
    probe.src = objectUrl;
  });
}

/** «۵۱۷×۲۸۲» — Persian digits, no thousands separator. */
export const formatImageSize = ({ width, height }) =>
  `${toPersianDigits(width)}×${toPersianDigits(height)}`;

/**
 * Rejects artwork that is not exactly one of the sizes the target accepts.
 *
 * A LIST, not one size: an advertisement slot accepts a single shape, while a
 * banner accepts any of the banner sizes because it carries no type of its own.
 * One size is passed as a list of one.
 *
 * The server enforces the same rule (backend attachment.service.js) — doing it
 * here too means the operator is told the actual dimensions of the file they
 * picked, in Persian, before a multi-megabyte upload.
 *
 * @param {File} file
 * @param {{width: number, height: number}[]} accepted
 * @returns {Promise<string|null>} a Persian error message, or null when acceptable
 */
export async function validateImageSize(file, accepted) {
  if (!accepted?.length) return null;

  const actual = await readImageSize(file);
  // Undecodable here does not mean undecodable on the server (an exotic but
  // valid GIF, say), so this defers rather than blocking the upload.
  if (!actual) return null;

  const matches = accepted.some(
    (size) => size.width === actual.width && size.height === actual.height,
  );
  if (matches) return null;

  const wanted = accepted.map(formatImageSize).join(' یا ');
  return (
    `اندازهٔ تصویر باید دقیقاً ${wanted} پیکسل باشد؛ ` +
    `تصویر انتخاب‌شده ${formatImageSize(actual)} است.`
  );
}

/**
 * The video counterpart of validateImageFile, with its own size ceiling.
 * @returns {string|null} a Persian error message, or null when acceptable
 */
export function validateVideoFile(file) {
  if (!file) return 'فایلی انتخاب نشده است.';

  if (!VIDEO_ACCEPT.split(',').includes(file.type)) {
    return 'فرمت ویدئو پشتیبانی نمی‌شود. MP4 یا WebM انتخاب کنید.';
  }

  if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
    return `حجم ویدئو بیشتر از ${MAX_VIDEO_MB} مگابایت است.`;
  }

  return null;
}

/**
 * Containers a film or clip may be uploaded in. Mirrors the backend's
 * SOURCE_VIDEO_EXTENSIONS: every upload is transcoded to HLS on the server, so
 * any container ffmpeg reads will do — not only what this browser can play.
 * Pre-roll ads are not transcoded and keep VIDEO_ACCEPT above.
 */
export const MOVIE_VIDEO_EXTENSIONS = Object.freeze([
  '.mp4', '.m4v', '.mov', '.mkv', '.webm', '.avi', '.wmv', '.flv',
  '.mpg', '.mpeg', '.ts', '.mts', '.m2ts', '.3gp', '.ogv',
]);

/**
 * The picker's filter. Extensions lead, because browsers disagree about the
 * MIME type of anything but MP4 — Chrome on Windows gives an `.mkv` none at all.
 */
export const MOVIE_VIDEO_ACCEPT = [...MOVIE_VIDEO_EXTENSIONS, 'video/*'].join(',');

/**
 * The film/clip counterpart of validateVideoFile: judged by extension and
 * size. Whether the file really is a video is decided by the server's ffprobe.
 * @returns {string|null} a Persian error message, or null when acceptable
 */
export function validateMovieVideoFile(file) {
  if (!file) return 'فایلی انتخاب نشده است.';

  const name = file.name ?? '';
  const extension = name.includes('.') ? name.slice(name.lastIndexOf('.')).toLowerCase() : '';
  if (!MOVIE_VIDEO_EXTENSIONS.includes(extension)) {
    return `فرمت ویدئو پشتیبانی نمی‌شود. یکی از این‌ها را انتخاب کنید: ${MOVIE_VIDEO_EXTENSIONS.join('، ')}`;
  }

  if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
    return `حجم ویدئو بیشتر از ${MAX_VIDEO_MB} مگابایت است.`;
  }

  return null;
}

/**
 * What the file picker offers for a game bundle. The extension leads, because a
 * browser's idea of a ZIP's MIME type depends on the operating system.
 */
export const GAME_ZIP_ACCEPT = '.zip,application/zip,application/x-zip-compressed';

/**
 * The game-bundle counterpart of validateImageFile.
 *
 * Only what can be known without opening the archive: its name and its size.
 * Whether it holds an `index.html`, how many files it unpacks to and how large
 * they are is decided by the server, which is the only side that reads it.
 *
 * @returns {string|null} a Persian error message, or null when acceptable
 */
export function validateGameZip(file) {
  if (!file) return 'فایلی انتخاب نشده است.';

  if (!/\.zip$/i.test(file.name)) {
    return 'فایل بازی باید با پسوند ‎.zip باشد.';
  }

  if (file.size > MAX_GAME_ZIP_MB * 1024 * 1024) {
    return `حجم فایل بازی بیشتر از ${toPersianDigits(MAX_GAME_ZIP_MB)} مگابایت است.`;
  }

  return null;
}

/**
 * Reads a video's duration and pixel dimensions without uploading it.
 *
 * **The server cannot do this.** There is no ffmpeg in the image, so every rule
 * that depends on how long a video runs or which way up it is — the VAST
 * `<Duration>`, and the whole clip/film standard — is measured here and sent
 * with the request. See the backend's services/admin/movieVideo.service.js for
 * what that means for enforcement.
 *
 * Takes a local `File` or a remote URL. A cross-origin URL still reports
 * metadata: CORS gates pixel access, not `duration` or `videoWidth`. Anything
 * the browser cannot decode — an exotic container, a link behind auth, a host
 * that never answers — resolves to null, and the caller treats "unknown" as a
 * reason to defer rather than to refuse.
 *
 * @param {File|string} source
 * @param {{timeoutMs?: number}} [options]
 * @returns {Promise<{durationSecond: number|null, width: number|null, height: number|null}|null>}
 */
export function readVideoMetadata(source, { timeoutMs = 15_000 } = {}) {
  return new Promise((resolve) => {
    const objectUrl = typeof source === 'string' ? null : URL.createObjectURL(source);
    const probe = document.createElement('video');
    let settled = false;

    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      // Detaching the source stops a half-loaded remote file downloading in the
      // background after the answer is already known.
      probe.removeAttribute('src');
      probe.load();
      resolve(value);
    };

    // A URL that neither loads nor errors would otherwise leave the caller
    // waiting forever with a spinner it can never clear.
    const timer = setTimeout(() => finish(null), timeoutMs);

    probe.preload = 'metadata';
    probe.onloadedmetadata = () =>
      finish({
        durationSecond: Number.isFinite(probe.duration) ? probe.duration : null,
        width: probe.videoWidth || null,
        height: probe.videoHeight || null,
      });
    probe.onerror = () => finish(null);
    probe.src = objectUrl ?? source;
  });
}

/**
 * Just the duration, rounded — what the pre-roll uploader has always asked for.
 * @param {File} file
 * @returns {Promise<number|null>} duration in seconds
 */
export async function readVideoDuration(file) {
  const meta = await readVideoMetadata(file);
  return meta?.durationSecond == null ? null : Math.round(meta.durationSecond);
}

/**
 * Holds a video to the standard for the kind of record it is being attached to.
 *
 * Mirrors the backend check exactly, so the panel refuses locally what the API
 * would refuse anyway — with the real numbers, in Persian, before the bytes are
 * sent. Metadata that could not be read is NOT an error: it is unknown, and the
 * server (which stores it as null) has the last word.
 *
 * @param {boolean} isClip
 * @param {{durationSecond: number|null, width: number|null, height: number|null}|null} meta
 * @returns {string|null} a Persian error message, or null when acceptable
 */
export function validateVideoStandard(isClip, meta) {
  if (!meta) return null;

  const { durationSecond, width, height } = meta;
  const minutes = (seconds) => toPersianDigits(seconds / 60);

  if (isClip && width && height && width >= height) {
    return `کلیپ باید ویدئوی عمودی باشد؛ این فایل ${toPersianDigits(width)}×${toPersianDigits(height)} و افقی است.`;
  }

  if (durationSecond == null) return null;
  const seconds = Math.round(durationSecond);

  if (isClip && seconds >= CLIP_MAX_DURATION_SECONDS) {
    return `کلیپ باید کوتاه‌تر از ${minutes(CLIP_MAX_DURATION_SECONDS)} دقیقه باشد؛ این ویدئو ${toPersianDigits(seconds)} ثانیه است.`;
  }

  if (!isClip && seconds <= MOVIE_MIN_DURATION_SECONDS) {
    return (
      `فیلم باید بلندتر از ${minutes(MOVIE_MIN_DURATION_SECONDS)} دقیقه باشد؛ این ویدئو ${toPersianDigits(seconds)} ثانیه است. ` +
      `ویدئوی کوتاه‌تر از ${minutes(CLIP_MAX_DURATION_SECONDS)} دقیقه باید روی رکوردی ثبت شود که تیک «کلیپ» دارد.`
    );
  }

  return null;
}

export default {
  mediaUrl,
  thumbnailUrl,
  validateImageFile,
  validateImageSize,
  formatImageSize,
  readImageSize,
  validateVideoFile,
  validateMovieVideoFile,
  validateVideoStandard,
  validateGameZip,
  readVideoDuration,
  readVideoMetadata,
  IMAGE_ACCEPT,
  AUDIO_ACCEPT,
  VIDEO_ACCEPT,
  MOVIE_VIDEO_ACCEPT,
  MOVIE_VIDEO_EXTENSIONS,
  GAME_ZIP_ACCEPT,
};
