/**
 * Anonymous poll token.
 *
 * Purpose: mint and persist the respondent id the poll endpoint deduplicates on.
 * Inputs:  none
 * Outputs: a stable token string
 * Deps:    utils/constants, utils/storage
 *
 * The legacy page built this as `Math.random().toString(36).substr(2)` twice
 * concatenated, and kept it in localStorage under `token`. The same key is
 * reused so a passenger who answered on the old site is still recognised within
 * their three-hour revision window.
 *
 * The API constrains it to 8–128 characters of [A-Za-z0-9_-], which the legacy
 * generator can technically undershoot (Math.random() occasionally yields a
 * short base-36 string), so the value is padded to a guaranteed length here.
 *
 * This is a deduplication key, NOT authentication. Nothing of value is gated on
 * it, and the server treats it as untrusted input.
 */
import { useState } from 'react';
import { POLL_TOKEN_KEY } from '../utils/constants.js';
import { readLocal, writeLocal } from '../utils/storage.js';

const MIN_LENGTH = 16;

/** Legacy generator: base-36 fraction with the leading `0.` removed. */
function randomChunk() {
  return Math.random().toString(36).slice(2);
}

function mintToken() {
  let token = randomChunk() + randomChunk();
  while (token.length < MIN_LENGTH) {
    token += randomChunk();
  }
  return token.slice(0, 64);
}

/** Only characters the API accepts, and long enough to pass validation. */
function isUsable(token) {
  return typeof token === 'string' && /^[A-Za-z0-9_-]{8,128}$/.test(token);
}

/**
 * @returns {string} the persisted token, minted on first use
 */
export function usePollToken() {
  const [token] = useState(() => {
    const existing = readLocal(POLL_TOKEN_KEY);
    if (isUsable(existing)) return existing;

    const minted = mintToken();
    writeLocal(POLL_TOKEN_KEY, minted);
    return minted;
  });

  return token;
}

export default usePollToken;
