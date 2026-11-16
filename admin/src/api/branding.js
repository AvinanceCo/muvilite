/**
 * Branding admin API.
 *
 * Purpose: read and change the customer logo, the landing-page copy and the
 *          passenger site's colour theme.
 * Inputs:  text values, a File
 * Outputs: the branding settings, after every call
 * Deps:    api/client
 *
 * A SINGLETON RESOURCE, so there is no id and no list: `/admin/branding` is the
 * installation's branding. Every call answers the full settings object, which is
 * why the screen can drop the response straight into its query cache.
 *
 * The logo moves on its own two calls rather than as a field of the save. A text
 * save must not be able to null a path whose file is still on disk, and an
 * upload must not be able to overwrite text the operator is in the middle of
 * editing.
 */
import { request } from './client.js';

/**
 * The RAW stored values — a field the operator never filled comes back empty,
 * not filled with the default. `fields` carries the labels, limits and defaults
 * the form renders from, and `logoSize` the recommended logo dimensions.
 *
 * @returns {Promise<{footerLogoPath: string|null, homeTitle: string,
 *   homeDescription: string, logoSize: {width: number, height: number},
 *   updatedAt: string|null,
 *   fields: {key: string, fa: string, multiline: boolean, maxLength: number,
 *            default: string, usageFa: string}[]}>}
 */
export function fetchBranding() {
  return request({ url: '/admin/branding' });
}

/**
 * Saves the text fields. An empty value CLEARS the stored text, which is how an
 * operator restores the shipped default — it does not publish an empty heading.
 */
export function updateBranding(payload) {
  return request({ url: '/admin/branding', method: 'PUT', data: payload });
}

/**
 * Switches the passenger site's colour theme — one of the `themes[].key` values
 * the settings carry. Saved on its own, apart from the text form.
 */
export function updateBrandingTheme(theme) {
  return request({ url: '/admin/branding/theme', method: 'PATCH', data: { theme } });
}

/** Field `image`, same as every other upload here. Replaces the previous file. */
export function uploadBrandingLogo(file) {
  const body = new FormData();
  body.append('image', file);
  return request({ url: '/admin/branding/logo', method: 'POST', data: body });
}

/**
 * Removes the customer logo. The footer then shows its text alone — it does not
 * fall back to the product's own mark.
 */
export function removeBrandingLogo() {
  return request({ url: '/admin/branding/logo', method: 'DELETE' });
}

export default {
  fetchBranding,
  updateBranding,
  updateBrandingTheme,
  uploadBrandingLogo,
  removeBrandingLogo,
};
