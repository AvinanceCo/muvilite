/**
 * Media URL resolution.
 *
 * Purpose: turn a stored media path from the API into a URL the browser can load,
 *          and decide what to draw when there is no path at all.
 * Inputs:  a path string from a document (posterPath, coverPath, videoPath, …)
 * Outputs: an absolute or root-relative URL, or null
 * Deps:    api/client (MEDIA_BASE_URL)
 *
 * IMPORTANT: media paths are STORED FIELDS. The legacy app derived them from
 * the row id (`assets/movies/{id}.jpg`), which is why an upload overwrote the
 * previous file. Uploads now get unique generated names, so a path can never be
 * reconstructed from an id — always read it off the document.
 *
 * FALLBACKS ARE CONFIGURED, NOT COMPILED IN. The legacy site named a holder file
 * per shape in its markup (`/src/images/posterHolder216x332.jpg` and friends);
 * changing one meant an FTP upload. An operator now uploads a placeholder per
 * slot in the admin panel and the map arrives from `GET /api/placeholders`, so
 * the resolution chain is:
 *
 *   the record's own image  ->  the slot's placeholder  ->  the `general`
 *   placeholder  ->  the poster image bundled with this app
 *
 * The last step exists because the frontend must render something on a fresh
 * installation, before anyone has opened the panel.
 *
 * The map is passed in as an ARGUMENT rather than read from a module-level
 * cache: a module variable filled by a fetch does not re-render the components
 * that already read it, so the first paint would keep the built-in image until
 * something else happened to update. Components take the map from context
 * (context/PlaceholderContext.jsx), which does re-render, and draw through
 * components/media/MediaImage.jsx.
 */
import { MEDIA_BASE_URL } from '../api/client.js';
import posterPlaceholder from '../assets/images/posterHolder216x332.jpg';

/**
 * Last-resort artwork, shipped with the bundle.
 *
 * One image for every slot, and deliberately so: it is the "nothing is
 * configured yet" state, not a design. A 216×332 poster in a square music tile
 * is cropped by `object-cover` and looks like what it is — a reminder to upload
 * a placeholder — while a second built-in file would be another thing to keep
 * in step with the panel.
 */
export const POSTER_PLACEHOLDER = posterPlaceholder;

/** Slot keys the backend defines (config/constants.js PLACEHOLDER_SLOTS). */
export const PLACEHOLDER_SLOTS = Object.freeze({
  MOVIE_POSTER: 'moviePoster',
  MUSIC_COVER: 'musicCover',
  BANNER: 'banner',
  CAST_PHOTO: 'castPhoto',
  GENERAL: 'general',
});

/**
 * @param {string|null|undefined} path stored path, e.g. `uploads/movies/ab12.jpg`
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
 * The placeholder configured for a slot, or null when none is.
 *
 * @param {Record<string, string>} placeholders the map from the API
 * @param {string} slot one of PLACEHOLDER_SLOTS
 * @returns {string|null}
 */
export function placeholderUrl(placeholders, slot) {
  return mediaUrl(placeholders?.[slot] ?? placeholders?.[PLACEHOLDER_SLOTS.GENERAL]);
}

export default { mediaUrl, placeholderUrl, POSTER_PLACEHOLDER, PLACEHOLDER_SLOTS };
