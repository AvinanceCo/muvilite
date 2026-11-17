/**
 * Placeholder API.
 *
 * Purpose: the fallback image an operator configured for each kind of artwork.
 * Inputs:  none
 * Outputs: `{ slot: path }` for the CONFIGURED slots only
 * Deps:    api/client
 *
 * Read once on start-up (context/PlaceholderContext.jsx). Slots the operator has
 * not filled are absent from the object, so resolution is
 * `map[slot] ?? map.general ?? the image bundled with this app`.
 */
import { request } from './client.js';

/**
 * @returns {Promise<Record<'moviePoster'|'musicCover'|'banner'|'castPhoto'|'general', string>>}
 */
export function fetchPlaceholders() {
  return request({ url: '/placeholders' });
}

export default { fetchPlaceholders };
