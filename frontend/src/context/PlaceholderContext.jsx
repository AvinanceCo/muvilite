/**
 * Placeholder context — the configured fallback artwork.
 *
 * Purpose: fetch `GET /api/placeholders` once per session and hand the map to
 *          every component that draws an image.
 * Inputs:  none
 * Outputs: the slot -> path map, and a resolver bound to it
 * Deps:    @tanstack/react-query, api/placeholders, services/media
 *
 * WHY A CONTEXT AND NOT A MODULE VARIABLE. Resolution needs data that arrives
 * over the network, and a module-level cache filled by a fetch cannot re-render
 * the components that already read it — the first paint would keep the built-in
 * image until an unrelated state change happened to refresh it. Context makes
 * the arrival a render.
 *
 * NOTHING BLOCKS ON THIS. The map starts empty, so the first frames use the
 * bundled poster and swap to the configured artwork when the request lands;
 * cards whose record has its own image are unaffected either way. Holding the
 * whole app back for one small JSON would cost every passenger a round trip over
 * the aircraft link to change what is, at most, the picture on an empty record.
 */
import { createContext, useCallback, useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchPlaceholders } from '../api/placeholders.js';
import { placeholderUrl } from '../services/media.js';

/** Same object every time, so an unconfigured app doesn't re-render on it. */
const EMPTY_MAP = Object.freeze({});

const PlaceholderContext = createContext(EMPTY_MAP);

export function PlaceholderProvider({ children }) {
  const { data } = useQuery({
    queryKey: ['placeholders'],
    queryFn: fetchPlaceholders,
    // An operator changes these perhaps twice in the life of an installation,
    // and the cabin link is slow: read it once and keep it for the session.
    staleTime: Infinity,
    // A failure here must not surface anywhere — the built-in image covers it.
    retry: 1,
  });

  const value = data ?? EMPTY_MAP;

  return <PlaceholderContext.Provider value={value}>{children}</PlaceholderContext.Provider>;
}

/** The raw map, for the rare caller that wants to know whether a slot is set. */
export function usePlaceholders() {
  return useContext(PlaceholderContext);
}

/**
 * `(slot) => url | null` — the CONFIGURED placeholder, with no bundled last
 * resort.
 *
 * Used by components/media/MediaImage.jsx to build its fallback chain, and
 * directly by the two callers for which "nothing configured" must mean "draw
 * nothing": the banner rail, which skips imageless slides rather than showing
 * empty frames, and the player's poster, where the alternative is a black screen
 * and not a broken-looking tile.
 */
export function usePlaceholderUrl() {
  const placeholders = usePlaceholders();

  return useCallback((slot) => placeholderUrl(placeholders, slot), [placeholders]);
}

export default PlaceholderProvider;
