/**
 * Placeholder admin API.
 *
 * Purpose: read, replace and clear the fallback image of each artwork slot.
 * Inputs:  slot keys, File objects
 * Outputs: slot descriptors, updated documents
 * Deps:    api/client
 *
 * Keyed by SLOT, not by id. The set of slots is fixed by the backend
 * (config/constants.js PLACEHOLDER_SLOTS), so there is no record to create
 * first: uploading to a slot creates its row, clearing it removes the row and
 * the file together.
 */
import { request } from './client.js';

/**
 * Every slot the application defines, configured or not.
 * @returns {Promise<{key: string, fa: string, en: string, width: number,
 *   height: number, usageFa: string, imagePath: string|null,
 *   updatedAt: string|null}[]>}
 */
export function fetchPlaceholders() {
  return request({ url: '/admin/placeholders' });
}

/**
 * Field `image`, same as the banner and ad uploads. Replacing a slot's image
 * deletes the file it replaced.
 */
export function uploadPlaceholder(slot, file) {
  const body = new FormData();
  body.append('image', file);
  return request({ url: `/admin/placeholders/${slot}/image`, method: 'POST', data: body });
}

/**
 * Clears a slot. Succeeds on an already-empty slot rather than 404ing — the
 * request asks for a state, and that state already holds.
 */
export function removePlaceholder(slot) {
  return request({ url: `/admin/placeholders/${slot}`, method: 'DELETE' });
}

export default { fetchPlaceholders, uploadPlaceholder, removePlaceholder };
