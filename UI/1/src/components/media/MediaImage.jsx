/**
 * Media image — an `<img>` that degrades to the configured placeholder.
 *
 * Purpose: draw a record's own artwork, and fall back when there is none OR
 *          when the file behind it cannot be loaded.
 * Inputs:  a stored path and the placeholder slot that applies
 * Outputs: an `<img>`
 * Deps:    services/media, context/PlaceholderContext
 *
 * THE ERROR CASE IS NOT HYPOTHETICAL, and it is the reason this is a component
 * rather than a URL-resolving helper called at each site. A document keeps the
 * path it was given; nothing re-checks that the file is still on disk. A database
 * restored without its uploads directory has records whose `posterPath` points
 * at a 404, and a bare `<img>` renders the browser's broken-image glyph for
 * every one of them. The admin grids have carried an `onError` fallback for this
 * since the panel was built (admin components/data/Thumb.jsx); the passenger
 * site now does too, and lands on the placeholder an operator chose.
 *
 * Sources are tried in order and never retried: own file, the slot's
 * placeholder, the image bundled with this app. When the last one fails the
 * element stays on it, so a missing file cannot put the component in a loop.
 */
import { useEffect, useMemo, useState } from 'react';
import { mediaUrl, POSTER_PLACEHOLDER } from '../../services/media.js';
import { usePlaceholderUrl } from '../../context/PlaceholderContext.jsx';

/**
 * @param {object} props
 * @param {string|null|undefined} props.path  the record's stored path
 * @param {string} props.slot                 a PLACEHOLDER_SLOTS value
 * @param {boolean} [props.builtIn=true]      allow the bundled last resort.
 *        Pass false where drawing nothing beats drawing a stand-in — the banner
 *        rail, which hides a slide it has no artwork for.
 * @param {string} [props.alt='']             decorative by default: these images
 *        sit next to the title they illustrate.
 */
export function MediaImage({ path, slot, builtIn = true, alt = '', ...imgProps }) {
  const placeholderFor = usePlaceholderUrl();

  const sources = useMemo(() => {
    const candidates = [mediaUrl(path), placeholderFor(slot)];
    if (builtIn) candidates.push(POSTER_PLACEHOLDER);
    return candidates.filter(Boolean);
  }, [path, slot, builtIn, placeholderFor]);

  const [index, setIndex] = useState(0);

  // A row is reused for a different record as a list pages or re-sorts, and the
  // placeholder map arrives after the first paint — either way the next source
  // deserves a fresh attempt rather than inheriting the last one's failure.
  const key = sources.join('|');
  useEffect(() => {
    setIndex(0);
  }, [key]);

  if (sources.length === 0) return null;

  return (
    <img
      src={sources[Math.min(index, sources.length - 1)]}
      alt={alt}
      onError={() => setIndex((current) => Math.min(current + 1, sources.length - 1))}
      {...imgProps}
    />
  );
}

export default MediaImage;
