/**
 * Branding API.
 *
 * Purpose: the customer logo and the landing-page copy an operator configured.
 * Inputs:  none
 * Outputs: `{ footerLogoPath, homeTitle, homeDescription }`
 * Deps:    api/client
 *
 * Read once on start-up (context/BrandingContext.jsx). Unlike the placeholder
 * map, the TEXT fields are always present and never empty — the backend
 * substitutes the shipped default for a field the operator left blank, so this
 * client renders what it is given. `footerLogoPath` is null when no logo has
 * been uploaded, and the footer then shows none.
 */
import { request } from './client.js';

/**
 * @returns {Promise<{footerLogoPath: string|null, homeTitle: string,
 *   homeDescription: string}>}
 */
export function fetchBranding() {
  return request({ url: '/branding' });
}

export default { fetchBranding };
