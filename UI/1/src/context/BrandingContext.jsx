/**
 * Branding context — the customer logo, the landing-page copy and the theme.
 *
 * Purpose: fetch `GET /api/branding` once per session, hand it to the layout
 *          and the landing page, and apply the operator's colour theme.
 * Inputs:  none
 * Outputs: `{ footerLogoPath, siteName, homeTitle, homeDescription, theme }`
 * Deps:    @tanstack/react-query, api/branding, utils/themes
 *
 * A CONTEXT, not a module variable, for the same reason as
 * context/PlaceholderContext.jsx: a module-level cache filled by a fetch cannot
 * re-render the components that already read it, so the arrival of the data has
 * to be a render.
 *
 * NOTHING BLOCKS ON THIS. The two sentences below are rendered on the first
 * frame and replaced if and when the operator's own text lands. That is why they
 * are duplicated from the backend (config/constants.js BRANDING_TEXT_FIELDS)
 * rather than waited for: the alternative is a landing page with an empty
 * heading for the length of one round trip over the cabin link. Keep the two
 * copies in step — they are the same sentences, and the backend's are the ones
 * an operator sees as the "restore the default" text in the panel.
 *
 * THE LOGO HAS NO DEFAULT. Before the request lands, and on an installation
 * where nobody has uploaded one, the footer shows no logo at all. The product
 * mark was deliberately removed from the footer rather than kept behind this
 * slot, so there is nothing to flash in its place.
 */
import { createContext, useContext, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchBranding } from '../api/branding.js';
import { applyTheme, getStoredTheme, resolveTheme } from '../utils/themes.js';
import { readLocal, writeLocal } from '../utils/storage.js';

/** The product's own name — what a site nobody has renamed is called. */
export const PRODUCT_NAME = 'MuviLite';

/**
 * The site's name is remembered on the device, like the theme, so a returning
 * visitor's header does not flash the product name before the request lands.
 */
const SITE_NAME_KEY = 'muvilite.siteName';
const storedSiteName = readLocal(SITE_NAME_KEY)?.trim() || PRODUCT_NAME;

/** First-paint copy. Mirrors the backend's BRANDING_DEFAULTS — see above. */
export const DEFAULT_BRANDING = Object.freeze({
  footerLogoPath: null,
  siteName: storedSiteName,
  // The colour theme the operator picked. Until the request lands, whatever this
  // device showed last time (main.jsx has already applied it).
  theme: getStoredTheme(),
  homeTitle: `به ${storedSiteName} خوش آمدید`,
  homeDescription: 'فیلم ببینید، موسیقی بشنوید و بازی کنید. یکی از بخش‌های زیر را انتخاب کنید.',
});

const BrandingContext = createContext(DEFAULT_BRANDING);

export function BrandingProvider({ children }) {
  const { data } = useQuery({
    queryKey: ['branding'],
    queryFn: fetchBranding,
    // An operator changes these perhaps twice in the life of an installation,
    // and the cabin link is slow: read it once and keep it for the session.
    staleTime: Infinity,
    // A failure must not surface anywhere — the defaults above cover it.
    retry: 1,
  });

  // Merged rather than swapped, so a payload that somehow lacks a field still
  // renders a sentence instead of nothing.
  const value = useMemo(() => {
    const merged = { ...DEFAULT_BRANDING, ...(data ?? {}) };
    return { ...merged, theme: resolveTheme(merged.theme) };
  }, [data]);

  useEffect(() => {
    applyTheme(value.theme);
  }, [value.theme]);

  // Only once the server has answered — never write back the first-paint guess.
  useEffect(() => {
    if (data?.siteName) writeLocal(SITE_NAME_KEY, data.siteName);
  }, [data?.siteName]);

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

/** `{ footerLogoPath, siteName, homeTitle, homeDescription, theme }` — never partial. */
export function useBranding() {
  return useContext(BrandingContext);
}

export default BrandingProvider;
