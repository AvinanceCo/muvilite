/**
 * Media thumbnail cell.
 *
 * Purpose: show a stored image in a grid, and degrade to a placeholder when
 *          there is no image OR the file behind it cannot be loaded.
 * Inputs:  a resolved URL and a size class
 * Outputs: an image, or a placeholder box of the same dimensions
 * Deps:    react
 *
 * THE ERROR CASE IS NOT HYPOTHETICAL. A document keeps the path it was given;
 * nothing re-checks that the file is still on disk. A record whose upload
 * directory was lost — or restored from a database dump without its media —
 * has a `posterPath` pointing at a 404, and a bare `<img>` renders the
 * browser's broken-image glyph in every row. Falling back on `onError` keeps
 * the grid legible and keeps the column the same width either way.
 */
import { useEffect, useState } from 'react';

/**
 * @param {object} props
 * @param {string|null} props.src   already resolved through services/media
 * @param {string} props.className  size and shape, e.g. `h-14 w-9 rounded`
 * @param {string} [props.fallback] glyph shown when there is no image
 * @param {string} [props.title]    tooltip on the placeholder
 */
export function Thumb({ src, className = 'size-10 rounded', fallback = '✕', title }) {
  const [failed, setFailed] = useState(false);

  // A row can be reused for a different record as a list re-sorts or pages, so
  // a previous failure must not stick to the next image.
  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return (
      <div
        title={title ?? (failed ? 'فایل تصویر یافت نشد' : 'تصویری ندارد')}
        className={`flex items-center justify-center border border-dashed border-line text-[0.65rem] text-muted ${className}`}
      >
        {fallback}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className={`border border-line object-cover ${className}`}
    />
  );
}

export default Thumb;
