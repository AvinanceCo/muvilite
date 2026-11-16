/**
 * Branding service — the customer logo and the landing-page copy.
 *
 * Purpose: serve the small branding payload every passenger page reads on
 *          start-up, and maintain it from the admin panel.
 * Inputs:  text patches, a multer file, an audit context
 * Outputs: the public payload, the admin view, updated documents
 * Deps:    repositories, services/{media,auditLog}, config/constants
 *
 * NEW FUNCTIONALITY — no legacy controller behind it. What it replaces is
 * documented at BRANDING_TEXT_FIELDS in config/constants.js: a logo file that
 * shipped with the theme and two Persian sentences hardcoded in `index.php`.
 *
 * BLANK MEANS DEFAULT, applied HERE and not in the database. Storing the default
 * text on first save would freeze it: a later release that improves the shipped
 * wording would never reach an installation that had once opened this screen.
 * The stored value is exactly what the operator typed, and the substitution
 * happens on the way out.
 *
 * THE PAYLOAD IS CACHED IN PROCESS, on the same terms as the placeholder map
 * (services/placeholder.service.js): it is on the critical path of every first
 * page load, it is one small document, and it changes when an operator edits it
 * — which is roughly never. Every write below drops the cache, so the only
 * staleness window is between two Node processes; with more than one, a second
 * process keeps serving its copy until it writes or restarts. Acceptable for a
 * logo and a heading, and called out here so nobody finds it as a bug.
 */
import { brandingRepository } from '../repositories/index.js';
import { ApiError } from '../utils/ApiError.js';
import { storeImage, removeStoredFile } from './media.service.js';
import { logUpdate, logDelete } from './auditLog.service.js';
import {
  BRANDING_TEXT_FIELDS,
  BRANDING_TEXT_KEYS,
  BRANDING_DEFAULTS,
  BRANDING_LOGO_SIZE,
  SITE_THEMES,
  SITE_THEME_KEYS,
  DEFAULT_SITE_THEME,
} from '../config/constants.js';

/** Audit section; matches the permission identifier the routes require. */
const AUDIT_PAGE = 'branding';

/** The public payload, or null when it must be rebuilt from the database. */
let cachedPublic = null;

/** Called by every write, so the next read rebuilds. */
function invalidate() {
  cachedPublic = null;
}

/**
 * Stored value if the operator typed one, the shipped default otherwise.
 * Trimmed, so a field holding only spaces counts as blank rather than
 * publishing an invisible heading.
 */
function textOf(document, key) {
  const stored = document?.[key];
  if (typeof stored === 'string' && stored.trim()) return stored.trim();
  return key === 'siteName' ? BRANDING_DEFAULTS.siteName : withSiteName(BRANDING_DEFAULTS[key], document);
}

/**
 * Fills `{siteName}` in a shipped default with the site's resolved name — the
 * operator's, or the product's. Only defaults carry the token; what an operator
 * typed is published exactly as typed.
 */
function withSiteName(text, document) {
  return text.replaceAll('{siteName}', textOf(document, 'siteName'));
}

/**
 * The stored theme, or the default for a document saved before the field
 * existed — or holding a key a later release has since retired.
 */
function themeOf(document) {
  return SITE_THEME_KEYS.includes(document?.theme) ? document.theme : DEFAULT_SITE_THEME;
}

/**
 * What the passenger site reads:
 * `{ footerLogoPath, homeTitle, homeDescription, theme }`.
 *
 * The text fields are ALWAYS present and never empty — unlike the placeholder
 * map, where an absent key means "use your own". A client that had to choose
 * between an empty heading and a default would be a second place the defaults
 * live, and the two would drift.
 *
 * `footerLogoPath` IS nullable, and null means the footer draws no logo at all —
 * not that it falls back to the product mark, which was taken out of the footer
 * rather than kept behind this slot.
 */
export async function getPublicBranding() {
  if (cachedPublic) return cachedPublic;

  const document = await brandingRepository.find();

  cachedPublic = {
    footerLogoPath: document?.footerLogoPath ?? null,
    theme: themeOf(document),
    ...Object.fromEntries(BRANDING_TEXT_KEYS.map((key) => [key, textOf(document, key)])),
  };

  return cachedPublic;
}

/**
 * The admin screen's view: the RAW stored values, plus the field definitions and
 * their defaults so the form can show an empty input with the shipped wording as
 * its placeholder.
 *
 * Raw, not resolved: an operator who sees the default already filled in cannot
 * tell whether they are looking at their own text or at the fallback, and saving
 * the form would then store the default and freeze it (see the file header).
 */
export async function getBrandingSettings() {
  const document = await brandingRepository.find();

  return {
    footerLogoPath: document?.footerLogoPath ?? null,
    logoSize: BRANDING_LOGO_SIZE,
    theme: themeOf(document),
    /** The choices and their preview swatches — the picker renders from these. */
    themes: SITE_THEMES.map((theme) => ({ ...theme, swatches: { ...theme.swatches } })),
    updatedAt: document?.updatedAt ?? null,
    updatedBy: document?.updatedBy ?? null,
    ...Object.fromEntries(BRANDING_TEXT_KEYS.map((key) => [key, document?.[key] ?? ''])),
    /** Labels, limits and defaults — the panel renders the form from these. */
    fields: BRANDING_TEXT_FIELDS.map((field) => ({
      ...field,
      // The placeholder shows what a blank field would publish today.
      default: field.key === 'siteName' ? field.default : withSiteName(field.default, document),
    })),
  };
}

/**
 * Saves the text fields.
 *
 * Only the keys BRANDING_TEXT_FIELDS defines are read off the payload, so a
 * client cannot reach `footerLogoPath` — which belongs to the upload route — or
 * any other document field through this call.
 *
 * A field the payload omits is left alone; a field it sends empty is CLEARED,
 * which is how an operator restores the shipped wording.
 *
 * @param {object} payload
 * @param {{userId: string, userIp: string}} context
 */
export async function updateBrandingText(payload, context) {
  const previous = await brandingRepository.find();

  const patch = {};
  for (const key of BRANDING_TEXT_KEYS) {
    if (payload[key] === undefined) continue;
    patch[key] = typeof payload[key] === 'string' ? payload[key].trim() : '';
  }

  if (Object.keys(patch).length === 0) {
    return getBrandingSettings();
  }

  const details = Object.fromEntries(
    Object.keys(patch).map((key) => [key, { old: previous?.[key] ?? '', new: patch[key] }]),
  );

  await brandingRepository.update({ ...patch, updatedBy: context.userId });
  invalidate();

  await logUpdate({
    user: context.userId,
    userIp: context.userIp,
    page: AUDIT_PAGE,
    targetId: previous?._id ?? null,
    details,
  });

  return getBrandingSettings();
}

/**
 * Switches the passenger site's colour theme.
 *
 * The validator has already held `theme` to SITE_THEME_KEYS; it is checked
 * again here so the service cannot be talked into storing anything else by a
 * caller that skipped the route. Re-saving the current theme is a no-op and
 * writes no audit row.
 *
 * @param {string} theme one of SITE_THEME_KEYS
 * @param {{userId: string, userIp: string}} context
 */
export async function updateBrandingTheme(theme, context) {
  if (!SITE_THEME_KEYS.includes(theme)) {
    throw ApiError.validation([
      { field: 'theme', message: `"theme" must be one of: ${SITE_THEME_KEYS.join(', ')}` },
    ]);
  }

  const previous = await brandingRepository.find();
  const old = themeOf(previous);
  if (old === theme) return getBrandingSettings();

  await brandingRepository.update({ theme, updatedBy: context.userId });
  invalidate();

  await logUpdate({
    user: context.userId,
    userIp: context.userIp,
    page: AUDIT_PAGE,
    targetId: previous?._id ?? null,
    details: { theme: { old, new: theme } },
  });

  return getBrandingSettings();
}

/**
 * Stores an uploaded customer logo, replacing whatever was there.
 *
 * @param {Express.Multer.File} file
 * @param {{userId: string, userIp: string}} context
 */
export async function setFooterLogo(file, context) {
  const previous = await brandingRepository.find();
  const { imagePath } = await storeImage(file);

  await brandingRepository.update({ footerLogoPath: imagePath, updatedBy: context.userId });
  invalidate();

  // Uploads never overwrite (middleware/upload.js), so the superseded file would
  // otherwise stay on disk forever. Removed only AFTER the new path is stored: a
  // crash in between leaves an orphan file, which is harmless, where the other
  // order leaves a document pointing at a file that is gone.
  await removeStoredFile(previous?.footerLogoPath);

  await logUpdate({
    user: context.userId,
    userIp: context.userIp,
    page: AUDIT_PAGE,
    targetId: previous?._id ?? null,
    details: { footerLogoPath: { old: previous?.footerLogoPath ?? null, new: imagePath } },
  });

  return getBrandingSettings();
}

/**
 * Clears the customer logo: the path is nulled, the file deleted, and the footer
 * goes back to its text alone. Clearing an already-empty slot succeeds rather
 * than 404ing — the caller asked for a state, and that state already holds.
 */
export async function clearFooterLogo(context) {
  const previous = await brandingRepository.find();

  if (!previous?.footerLogoPath) {
    return getBrandingSettings();
  }

  await brandingRepository.update({ footerLogoPath: null, updatedBy: context.userId });
  invalidate();

  await removeStoredFile(previous.footerLogoPath);

  await logDelete({
    user: context.userId,
    userIp: context.userIp,
    page: AUDIT_PAGE,
    targetId: previous._id,
    details: { footerLogoPath: { old: previous.footerLogoPath, new: null } },
  });

  return getBrandingSettings();
}

export default {
  getPublicBranding,
  getBrandingSettings,
  updateBrandingText,
  updateBrandingTheme,
  setFooterLogo,
  clearFooterLogo,
};
