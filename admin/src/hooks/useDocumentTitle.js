/**
 * Document title.
 *
 * Purpose: name the current screen in the browser tab and history.
 * Inputs:  a screen title
 * Outputs: sets document.title
 * Deps:    react
 *
 * The panel is `noindex` and its titles matter only for tab identification —
 * an operator with the panel, the passenger site and a database tool open needs
 * to tell them apart.
 */
import { useEffect } from 'react';

const SUFFIX = 'پنل مدیریت MuviLite';

export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} — ${SUFFIX}` : SUFFIX;
  }, [title]);
}

export default useDocumentTitle;
