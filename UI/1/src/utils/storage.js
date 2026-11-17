/**
 * localStorage access.
 *
 * Purpose: read and write local values without letting a storage failure take
 *          the page down.
 * Inputs:  keys and string values
 * Outputs: strings, or null
 * Deps:    none
 *
 * localStorage throws rather than returning null in private browsing on some
 * browsers and when a quota is exceeded, so every access is guarded. A device
 * that cannot store the poll token still gets a working poll — the answers are
 * simply recorded as a new response instead of a revision.
 */

export function readLocal(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeLocal(key, value) {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export default { readLocal, writeLocal };
