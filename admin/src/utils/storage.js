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
 * browsers and when a quota is exceeded, so every access is guarded. An
 * administrator on a device that cannot store the token still gets a working
 * panel — the session simply ends when the tab closes.
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

export function removeLocal(key) {
  try {
    window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export default { readLocal, writeLocal, removeLocal };
