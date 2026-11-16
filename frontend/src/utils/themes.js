/**
 * Site colour themes — the parts of a theme that CSS cannot carry.
 *
 * Purpose: apply the operator's chosen theme to the page, and hand the colours
 *          that must be literal values (the video player's tokens, the
 *          browser's `theme-color`) to the code that needs them.
 * Inputs:  a theme key from `GET /api/branding` (`theme`)
 * Outputs: `applyTheme(key)`, `getStoredTheme()`, `SITE_THEMES[key]`
 * Deps:    utils/storage
 *
 * The palette itself is CSS: each theme is one `html[data-theme]` block in
 * index.css that re-points the design tokens, so every Tailwind class follows
 * without knowing a theme exists. This file holds only what CSS cannot reach.
 * Keep the two in step — and the admin's preview swatches, which come from the
 * backend's SITE_THEMES (config/constants.js).
 *
 * THE LAST THEME IS REMEMBERED ON THE DEVICE so the next visit paints in it
 * straight away (main.jsx applies it before React mounts) instead of flashing
 * the default until the branding request lands. The server's value still wins
 * whenever it arrives.
 */
import { readLocal, writeLocal } from './storage.js';

export const DEFAULT_THEME = 'dark-blue';

const STORAGE_KEY = 'muvilite.theme';

/** Player tokens shared by every theme. */
const PLAYER_FONTS = Object.freeze({
  fontFamily: 'Vazir, Tahoma, sans-serif',
  fontFamilyFa: 'Vazir, Tahoma, sans-serif',
});

export const SITE_THEMES = Object.freeze({
  // The original, logo-derived palette: one azure accent on a navy-black ground.
  'dark-blue': {
    themeColor: '#050b12',
    player: {
      primary: '#12b1f0',
      primaryText: '#050b12',
      slider: '#12b1f0',
      focus: '#afe9fc',
      danger: '#ed1c24',
      surfaceStrong: 'rgba(12, 24, 38, 0.96)',
      ...PLAYER_FONTS,
    },
  },
  // Red accent on a warm near-black. Errors turn amber here, so a failure never
  // reads as one more accent.
  'dark-red': {
    themeColor: '#0b0809',
    player: {
      primary: '#ff4d55',
      primaryText: '#0b0809',
      slider: '#ff4d55',
      focus: '#fbb9bd',
      danger: '#f5a524',
      surfaceStrong: 'rgba(23, 17, 19, 0.96)',
      ...PLAYER_FONTS,
    },
  },
  // Pink accent on a deep indigo-navy.
  'dark-pink': {
    themeColor: '#060818',
    player: {
      primary: '#ff4fa3',
      primaryText: '#060818',
      slider: '#ff4fa3',
      focus: '#ffc0de',
      danger: '#ed1c24',
      surfaceStrong: 'rgba(14, 20, 48, 0.96)',
      ...PLAYER_FONTS,
    },
  },
  // Orange accent on a true navy.
  'navy-orange': {
    themeColor: '#07102a',
    player: {
      primary: '#ff8a1f',
      primaryText: '#07102a',
      slider: '#ff8a1f',
      focus: '#ffd0a3',
      danger: '#ff3b5c',
      surfaceStrong: 'rgba(15, 26, 61, 0.96)',
      ...PLAYER_FONTS,
    },
  },
});

/** A known key, or the default — an unknown value must never blank the palette. */
export function resolveTheme(key) {
  return Object.hasOwn(SITE_THEMES, key) ? key : DEFAULT_THEME;
}

/** The theme this device last showed, for the first paint. */
export function getStoredTheme() {
  return resolveTheme(readLocal(STORAGE_KEY));
}

/** Points the design tokens at `key`, updates the browser chrome, remembers it. */
export function applyTheme(key) {
  const theme = resolveTheme(key);
  document.documentElement.dataset.theme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', SITE_THEMES[theme].themeColor);
  writeLocal(STORAGE_KEY, theme);
  return theme;
}

export default { SITE_THEMES, DEFAULT_THEME, resolveTheme, getStoredTheme, applyTheme };
