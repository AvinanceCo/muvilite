/**
 * Non-CRUD admin endpoints.
 *
 * Purpose: relations, uploads, ordering, users, and the spreadsheet exports —
 *          everything the generic resource client cannot express.
 * Inputs:  ids, payloads, File objects
 * Outputs: documents, relation rows, Blobs
 * Deps:    api/client
 *
 * Three conventions here are easy to get wrong and are called out at each site:
 *
 *   1. The four relation REMOVALS are `DELETE` with a BODY. axios needs
 *      `{ data: {...} }` for that — a second positional argument is a config
 *      object, not a body.
 *   2. Every upload has its own multipart FIELD NAME (`poster`, `photo`,
 *      `image`, `cover`, `files`). The server looks for that exact name.
 *   3. Content-Type is never set on a FormData request; the browser must add
 *      the multipart boundary itself.
 *
 * Uploads carry no timeout, and none of them has to ask: api/client.js lifts
 * the 30-second default for any multipart body.
 */
import { request, requestWithMeta, requestBlob } from './client.js';

/* ------------------------------------------------------------ relations --- */

/** Casts credited on a movie, sorted by role. No pagination. */
export function fetchMovieCasts(movieId) {
  return request({ url: `/admin/movies/${movieId}/casts` });
}

/** `role` is a CAST_ROLES value; (movie, cast, role) is unique. */
export function addMovieCast({ movie, cast, role }) {
  return request({ url: '/admin/movie-casts', method: 'POST', data: { movie, cast, role } });
}

export function removeMovieCast({ movie, cast, role }) {
  return request({ url: '/admin/movie-casts', method: 'DELETE', data: { movie, cast, role } });
}

/** Categories a movie belongs to. */
export function fetchMovieCategories(movieId) {
  return request({ url: `/admin/movies/${movieId}/categories` });
}

export function addMovieCategory({ category, item }) {
  return request({ url: '/admin/movie-categories', method: 'POST', data: { category, item } });
}

export function removeMovieCategory({ category, item }) {
  return request({ url: '/admin/movie-categories', method: 'DELETE', data: { category, item } });
}

/** Music categories a track collection belongs to. */
export function fetchMusicCategories(musicId) {
  return request({ url: `/admin/musics/${musicId}/categories` });
}

export function addMusicCategory({ category, item }) {
  return request({ url: '/admin/music-categories-items', method: 'POST', data: { category, item } });
}

export function removeMusicCategory({ category, item }) {
  return request({
    url: '/admin/music-categories-items',
    method: 'DELETE',
    data: { category, item },
  });
}

/**
 * What is INSIDE a movie category — added during the admin pass, since the
 * public endpoint of this shape hides deactivated titles and the legacy grid
 * showed them. Paginated; returns `{ category, items }`.
 */
export async function fetchCategoryMovies(categoryId, params = {}) {
  const { data, meta } = await requestWithMeta({
    url: `/admin/categories/${categoryId}/movies`,
    params,
  });
  return { category: data?.category ?? null, items: data?.items ?? [], meta };
}

/** The same, for a music category. */
export async function fetchMusicCategoryItems(categoryId, params = {}) {
  const { data, meta } = await requestWithMeta({
    url: `/admin/music-categories/${categoryId}/musics`,
    params,
  });
  return { category: data?.category ?? null, items: data?.items ?? [], meta };
}

/* ------------------------------------------------- banner relations/order --- */

/** Banners in a category, sorted by orderIndex. */
export function fetchCategoryBanners(categoryId) {
  return request({ url: `/admin/banner-categories/${categoryId}/banners` });
}

export function addCategoryBanner({ bannerCategory, banner, orderIndex }) {
  return request({
    url: '/admin/banner-category-items',
    method: 'POST',
    data: { bannerCategory, banner, orderIndex },
  });
}

export function removeCategoryBanner({ bannerCategory, banner }) {
  return request({
    url: '/admin/banner-category-items',
    method: 'DELETE',
    data: { bannerCategory, banner },
  });
}

/** @param {{bannerCategory: string, entries: {bannerId: string, orderIndex: number}[]}} payload */
export function reorderBanners(payload) {
  return request({ url: '/admin/banners/order', method: 'PATCH', data: payload });
}

/* ------------------------------------------------------ pages and blocks --- */

/**
 * A page with its blocks in display order, each block's target resolved.
 * Added during the admin pass; replaces the legacy composer's N+1 lookups.
 * @returns {Promise<{page: object, blocks: object[]}>}
 */
export function fetchPageBlocks(pageId) {
  return request({ url: `/admin/pages/${pageId}/blocks` });
}

/** @param {{entries: {id: string, itemOrder: number}[]}} payload */
export function reorderPageBlocks(payload) {
  return request({ url: '/admin/page-blocks/order', method: 'PATCH', data: payload });
}

/* -------------------------------------------------------------- uploads --- */

/** Wraps one File in the multipart body the server expects. */
function fileBody(fieldName, file) {
  const body = new FormData();
  body.append(fieldName, file);
  return body;
}

/** Field `poster`. Returns the movie with `posterPath` and `thumbnailPath`. */
export function uploadMoviePoster(movieId, file) {
  return request({
    url: `/admin/movies/${movieId}/poster`,
    method: 'POST',
    data: fileBody('poster', file),
  });
}

/**
 * A title's video, in its three forms — upload, link, clear — plus the HLS
 * transcode an upload starts.
 *
 * An UPLOAD answers once the file is stored and queued; the server measures it
 * with ffprobe and transcodes it to HLS in the background, and
 * `getMovieVideoStatus` reports how far that has got. The browser's own
 * measurements still ride along (they are what the panel checked locally), but
 * the server uses its own.
 *
 * A LINK is never transcoded, so for it the browser's `durationSecond`,
 * `width` and `height` are the only numbers there are; anything the browser
 * could not read is omitted and stored as null.
 *
 * Both write forms target the same `videoPath`, so setting one clears the other.
 *
 * @param {(percent: number) => void} [onProgress] upload progress, 0–100
 * @param {'hls'|'mp4'} [mode] this upload's own choice; omitted, the server
 *        applies the installation's MP4/HLS switch. Sent in the query string
 *        because the server decides before it reads the body.
 */
export function uploadMovieVideo(movieId, file, meta = {}, onProgress, mode) {
  const body = fileBody('video', file);
  for (const key of ['durationSecond', 'width', 'height']) {
    if (meta[key] != null) body.append(key, String(Math.round(meta[key])));
  }
  return request({
    url: `/admin/movies/${movieId}/video`,
    method: 'POST',
    params: mode ? { mode } : undefined,
    data: body,
    onUploadProgress: onProgress
      ? (event) => {
          if (event.total) onProgress(Math.round((event.loaded / event.total) * 100));
        }
      : undefined,
  });
}

/**
 * The MP4/HLS switch, read-only, under the movies permission: the mode each
 * upload field starts on, and whether HLS can be chosen at all.
 * `{ transcodeEnabled, chosen, transcoderAvailable }`
 */
export function getMovieVideoSettings() {
  return request({ url: '/admin/movies/video-settings' });
}

/** `{ videoStatus, videoProgress, videoError, videoQueuePosition, videoPath, … }` */
export function getMovieVideoStatus(movieId) {
  return request({ url: `/admin/movies/${movieId}/video` });
}

/** Re-runs a failed transcode from the original the server kept. */
export function retryMovieVideo(movieId) {
  return request({ url: `/admin/movies/${movieId}/video/retry`, method: 'POST' });
}

export function setMovieVideoLink(movieId, url, meta = {}) {
  return request({
    url: `/admin/movies/${movieId}/video`,
    method: 'PUT',
    data: {
      url,
      durationSecond: meta.durationSecond ?? undefined,
      width: meta.width ?? undefined,
      height: meta.height ?? undefined,
    },
  });
}

export function removeMovieVideo(movieId) {
  return request({ url: `/admin/movies/${movieId}/video`, method: 'DELETE' });
}

/** Field `photo`. */
export function uploadCastPhoto(castId, file) {
  return request({
    url: `/admin/casts/${castId}/photo`,
    method: 'POST',
    data: fileBody('photo', file),
  });
}

/** Field `image`. */
export function uploadBannerImage(bannerId, file) {
  return request({
    url: `/admin/banners/${bannerId}/image`,
    method: 'POST',
    data: fileBody('image', file),
  });
}

/**
 * Field `video`, plus a `durationSecond` text part.
 *
 * The duration is measured in the browser (components/form/VideoUpload.jsx)
 * because probing the container server-side would need ffmpeg, and the value is
 * only ever the VAST `<Duration>` the tag advertises. The server bounds it and
 * the operator can correct it on the form.
 */
export function uploadVideoAdFile(adId, file, durationSecond) {
  const body = new FormData();
  body.append('video', file);
  if (Number.isFinite(durationSecond)) {
    body.append('durationSecond', String(Math.round(durationSecond)));
  }
  return request({ url: `/admin/video-ads/${adId}/video`, method: 'POST', data: body });
}

/**
 * Field `image` for both variants — the ROUTE distinguishes them, not the field
 * name. `portrait` is the «موبایل» artwork and the default; `landscape` is the
 * «دسکتاپ» one, shown instead when the viewport is wider than it is tall, which
 * is what the legacy stylesheet did with its two anchors. The variant names
 * here stay orientation-based because they name the endpoints, which are part
 * of the API contract.
 *
 * Each variant has one accepted pixel size and the server rejects anything else
 * (backend AD_PLACEMENT_SIZES) — a 400 whose message names both dimensions.
 */
export function uploadPlacementAdImage(adId, file, variant = 'portrait') {
  const segment = variant === 'landscape' ? 'landscape-image' : 'image';
  return request({
    url: `/admin/placement-ads/${adId}/${segment}`,
    method: 'POST',
    data: fileBody('image', file),
  });
}

/** Field `cover`. */
export function uploadMusicCover(musicId, file) {
  return request({
    url: `/admin/musics/${musicId}/cover`,
    method: 'POST',
    data: fileBody('cover', file),
  });
}

/**
 * Step one of two for tracks: field `files`, up to 30 audio files.
 *
 * This uploads bytes and returns `[{ originalName, file, size }]`. It does NOT
 * touch the music document — the returned `file` paths must then be sent to
 * `putMusicTracks`, or they are orphaned on disk.
 */
export function uploadMusicTrackFiles(musicId, files) {
  const body = new FormData();
  for (const file of files) {
    body.append('files', file);
  }
  return request({ url: `/admin/musics/${musicId}/track-files`, method: 'POST', data: body });
}

/**
 * Step two: replaces the ENTIRE track list.
 *
 * Files no longer referenced by the new list are deleted from disk, so a
 * partial list silently destroys the omitted tracks. Always send every track
 * that should survive.
 *
 * @param {{title?: string, file: string, image?: string|null,
 *          duration?: number, order?: number}[]} tracks
 */
export function putMusicTracks(musicId, tracks) {
  return request({ url: `/admin/musics/${musicId}/tracks`, method: 'PUT', data: { tracks } });
}

/* ---------------------------------------------------------------- games --- */

/**
 * Reports upload progress as a whole percentage. axios supplies `total` only
 * when the browser can compute the body's length, which for FormData it can.
 */
const percentReporter = (onProgress) =>
  onProgress
    ? (event) => {
        if (event.total) onProgress(Math.round((event.loaded / event.total) * 100));
      }
    : undefined;

/**
 * Creates a game from its ZIP — field `zip`, with the form fields as text parts
 * beside it. ONE request, unlike every other upload in this file: a game with no
 * bundle is not a game, so there is no record to create first.
 *
 * No timeout is set here: api/client.js lifts the 30-second default for every
 * multipart body, since each one is an upload.
 *
 * @param {object} fields  titleFa, folderName, genre, emoji, color1, color2, isActive
 * @param {File} file
 * @param {(percent: number) => void} [onProgress]
 */
export function createGame(fields, file, onProgress) {
  const body = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined && value !== null) body.append(key, String(value));
  }
  body.append('zip', file);

  return request({
    url: '/admin/games',
    method: 'POST',
    data: body,
    onUploadProgress: percentReporter(onProgress),
  });
}

/**
 * A new build for an existing game. The record — and its click count — stay;
 * the previous files are deleted once the new ones are in place, and a refused
 * archive leaves the game exactly as it was.
 */
export function replaceGameBundle(gameId, file, onProgress) {
  return request({
    url: `/admin/games/${gameId}/bundle`,
    method: 'POST',
    data: fileBody('zip', file),
    onUploadProgress: percentReporter(onProgress),
  });
}

/* ---------------------------------------------------------- bulk import --- */

/**
 * Uploads a CSV of survey questions. Field `file`, plus two text switches.
 *
 * `dryRun` returns the identical report without writing anything, which is how
 * the screen previews a file before committing it. `skipInvalid` imports the
 * readable rows instead of refusing the whole file — without it, one bad row is
 * a 400 whose `errors[]` names the offending lines.
 *
 * Booleans must be stringified: a FormData part is always text, and `false`
 * would otherwise be sent as the string "false" only by accident of coercion.
 *
 * @param {File} file
 * @param {{dryRun?: boolean, skipInvalid?: boolean}} [options]
 */
export function importPollQuestions(file, { dryRun = false, skipInvalid = false } = {}) {
  const body = new FormData();
  body.append('file', file);
  body.append('dryRun', String(dryRun));
  body.append('skipInvalid', String(skipInvalid));
  return request({ url: '/admin/polls/import', method: 'POST', data: body });
}

/* ---------------------------------------------------------------- users --- */

/**
 * Users are not served by the generic CRUD factory: create requires a
 * password, update must omit it to leave it unchanged, and there are two extra
 * routes. The list supports `mobile`, `displayName`, `isActive` and
 * `permissionGroup` filters.
 */
export async function listUsers(params = {}) {
  const { data, meta } = await requestWithMeta({ url: '/admin/users', params });
  return { items: data ?? [], meta };
}

export function fetchUser(id) {
  return request({ url: `/admin/users/${id}` });
}

/** `mobile` and `password` are both required here. */
export function createUser(payload) {
  return request({ url: '/admin/users', method: 'POST', data: payload });
}

/** Omit `password` to leave it unchanged — sending an empty string is a 422. */
export function updateUser(id, payload) {
  return request({ url: `/admin/users/${id}`, method: 'PUT', data: payload });
}

export function setUserStatus(id, isActive) {
  return request({ url: `/admin/users/${id}/status`, method: 'PATCH', data: { isActive } });
}

/** An administrative reset: no current-password challenge. Minimum 6 chars. */
export function resetUserPassword(id, newPassword) {
  return request({ url: `/admin/users/${id}/password`, method: 'PATCH', data: { newPassword } });
}

/** Soft delete. The API refuses to delete the caller's own account. */
export function removeUser(id) {
  return request({ url: `/admin/users/${id}`, method: 'DELETE' });
}

/* -------------------------------------------------------------- exports --- */

/**
 * The filenames are hardcoded because `Content-Disposition` is not in the
 * backend's CORS `exposedHeaders` and so cannot be read from JavaScript.
 */
export function exportMovies(params = {}) {
  return requestBlob({ url: '/admin/movies/export', params });
}

export function exportUsers(params = {}) {
  return requestBlob({ url: '/admin/users/export', params });
}

export const EXPORT_FILENAMES = Object.freeze({
  movies: 'movies.xlsx',
  users: 'users.xlsx',
});
