/**
 * Document title and description.
 *
 * Purpose: set the tab title and meta description per route, replacing the
 *          legacy `_layout/header-includes.php` metadata block.
 * Inputs:  a title, optionally a description
 * Outputs: none (side effect on document)
 * Deps:    context/BrandingContext (the site's name, set in the panel)
 */
import { useEffect } from 'react';
import { useBranding } from '../context/BrandingContext.jsx';

/**
 * @param {string|null|undefined} title page title; falsy leaves the site name alone
 * @param {string} [description] meta description
 */
export function useDocumentTitle(title, description) {
  const { siteName } = useBranding();

  useEffect(() => {
    const previous = document.title;
    document.title = title ? `${title} — ${siteName}` : siteName;
    return () => {
      document.title = previous;
    };
  }, [title, siteName]);

  useEffect(() => {
    if (!description) return undefined;

    const tag = document.querySelector('meta[name="description"]');
    if (!tag) return undefined;

    const previous = tag.getAttribute('content');
    tag.setAttribute('content', description.slice(0, 300));
    return () => tag.setAttribute('content', previous ?? '');
  }, [description]);
}

export default useDocumentTitle;
