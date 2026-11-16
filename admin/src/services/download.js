/**
 * Browser file download.
 *
 * Purpose: save a Blob the API returned as a file on the operator's machine.
 * Inputs:  a Blob and a filename
 * Outputs: a download; nothing returned
 * Deps:    none
 *
 * The filename must be supplied by the caller. The exports set
 * `Content-Disposition`, but the backend configures no `exposedHeaders` on its
 * CORS middleware, so that header is unreadable from JavaScript — the names are
 * fixed at the call site instead (`movies.xlsx`, `users.xlsx`).
 */

/**
 * @param {Blob} blob
 * @param {string} filename
 */
export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  // Revoking immediately can cancel the download in some browsers; one tick is
  // enough for the click to have been dispatched.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export default { saveBlob };
