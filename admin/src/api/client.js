/**
 * HTTP client.
 *
 * Purpose: the single place that knows about the backend's response envelope
 *          and about the bearer token. Everything above this file receives
 *          plain data and plain errors.
 * Inputs:  VITE_API_URL (defaults to the dev proxy at /api)
 * Outputs: `request()` returning `data`, `requestWithMeta()` returning
 *          `{ data, meta, message }`, and the token accessors
 * Deps:    axios, utils/storage
 *
 * Backend envelope (backend/src/utils/apiResponse.js):
 *   success  { success: true,  message, data, meta? }
 *   failure  { success: false, message, errors: [] }
 *
 * A failure envelope becomes an ApiRequestError carrying the server's message
 * and its field errors, so a form can map `errors[].field` onto its inputs and
 * anything else can display `error.message` without inspecting status codes.
 *
 * The 401/403 distinction matters and is easy to get wrong:
 *   401 — the token is missing, expired or belongs to a disabled account. The
 *         session is over; the token is discarded and the app returns to login.
 *   403 — the token is fine, this administrator simply lacks the permission.
 *         The session must SURVIVE, or a single mis-click would sign them out.
 */
import axios from 'axios';
import { readLocal, writeLocal, removeLocal } from '../utils/storage.js';

export const API_BASE_URL = import.meta.env.VITE_API_URL ?? '/api';

/** Origin that serves uploaded media. Empty means "same origin as the page". */
export const MEDIA_BASE_URL = import.meta.env.VITE_MEDIA_URL ?? '';

const TOKEN_KEY = 'muvilite.admin.token';

/** An error carrying the server's message and its per-field validation errors. */
export class ApiRequestError extends Error {
  constructor(message, { status = 0, errors = [] } = {}) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.errors = errors;
  }

  get isNotFound() {
    return this.status === 404;
  }

  /** The session is gone — as opposed to merely lacking a permission. */
  get isUnauthenticated() {
    return this.status === 401;
  }

  /** Authenticated, but not allowed. The session stays. */
  get isForbidden() {
    return this.status === 403;
  }

  get isConflict() {
    return this.status === 409;
  }

  /** Field errors keyed by field name, for react-hook-form's setError. */
  get fieldErrors() {
    const map = {};
    for (const item of this.errors) {
      if (item?.field && !map[item.field]) {
        map[item.field] = item.message;
      }
    }
    return map;
  }
}

/* ------------------------------------------------------------------ token --- */

/**
 * The keys the token was kept under before the product was renamed (MediaWifi →
 * Muvimedia → MuviLite, 2026-11), newest first. The first one found is moved to
 * the current key, so an administrator who was signed in before the update
 * stays signed in after it.
 */
const LEGACY_TOKEN_KEYS = ['muvimedia.admin.token', 'mediawifi.admin.token'];

const removeLegacyTokens = () => LEGACY_TOKEN_KEYS.forEach((key) => removeLocal(key));

export const getToken = () => {
  const token = readLocal(TOKEN_KEY);
  if (token) return token;
  const legacy = LEGACY_TOKEN_KEYS.map((key) => readLocal(key)).find(Boolean);
  if (!legacy) return token;
  writeLocal(TOKEN_KEY, legacy);
  removeLegacyTokens();
  return legacy;
};
export const setToken = (token) => writeLocal(TOKEN_KEY, token);
export const clearToken = () => {
  removeLocal(TOKEN_KEY);
  removeLegacyTokens();
};

/**
 * Called when a 401 comes back, so AuthContext can drop its state and the
 * router can show the login screen. Registered once at app start; a plain
 * callback rather than a redirect so the client stays framework-agnostic.
 */
let onUnauthenticated = null;
export function setUnauthenticatedHandler(handler) {
  onUnauthenticated = handler;
}

/* ----------------------------------------------------------------- client --- */

/** How long an ordinary request may take before it is abandoned. */
const REQUEST_TIMEOUT_MS = 30_000;

export const http = axios.create({
  baseURL: API_BASE_URL,
  timeout: REQUEST_TIMEOUT_MS,
});

http.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // AN UPLOAD HAS NO DEADLINE. In a browser axios's `timeout` covers the whole
  // exchange, sending included, so thirty seconds — right for a JSON call —
  // aborted any upload that took longer and reported it as «پاسخی دریافت نشد».
  // A two-gigabyte film takes minutes on a good link; so does a hundred-megabyte
  // game on a poor one. Every multipart body in this panel is a file on its way
  // up, which makes the body type the reliable test, and one rule here covers
  // uploads added later without each having to remember it.
  //
  // Lifted only when the caller left the default in place, so a request that
  // asks for a specific timeout still gets it. A connection that genuinely dies
  // is still noticed: the browser fails the request, and nginx gives up on a
  // body that stops arriving (`client_body_timeout`).
  if (config.data instanceof FormData && config.timeout === REQUEST_TIMEOUT_MS) {
    config.timeout = 0;
  }

  // Multipart bodies must keep the boundary axios generates, so only JSON gets
  // an explicit content type.
  if (!(config.data instanceof FormData) && !config.headers['Content-Type']) {
    config.headers['Content-Type'] = 'application/json';
  }
  return config;
});

/** Normalizes anything axios can throw into an ApiRequestError. */
function toApiError(error) {
  const response = error?.response;

  if (response) {
    const body = response.data ?? {};
    return new ApiRequestError(body.message || 'درخواست ناموفق بود.', {
      status: response.status,
      errors: body.errors ?? [],
    });
  }

  if (error?.code === 'ECONNABORTED') {
    return new ApiRequestError('پاسخی دریافت نشد. دوباره تلاش کنید.', { status: 0 });
  }

  return new ApiRequestError('ارتباط با سرور برقرار نشد.', { status: 0 });
}

/**
 * Ends the session on 401 and rethrows. Note the deliberate absence of 403
 * here — see the file header.
 */
function handle(error) {
  const apiError = toApiError(error);

  if (apiError.isUnauthenticated) {
    clearToken();
    onUnauthenticated?.();
  }

  throw apiError;
}

/**
 * Performs a request and returns the envelope's `data`.
 *
 * @param {import('axios').AxiosRequestConfig} config
 * @returns {Promise<unknown>}
 */
export async function request(config) {
  try {
    const response = await http.request(config);
    return response.data?.data ?? null;
  } catch (error) {
    return handle(error);
  }
}

/**
 * Same as `request()`, but keeps `meta` (pagination) and `message`.
 *
 * @param {import('axios').AxiosRequestConfig} config
 * @returns {Promise<{data: unknown, meta: object|null, message: string}>}
 */
export async function requestWithMeta(config) {
  try {
    const response = await http.request(config);
    const body = response.data ?? {};
    return {
      data: body.data ?? null,
      meta: body.meta ?? null,
      message: body.message ?? '',
    };
  } catch (error) {
    return handle(error);
  }
}

/**
 * Fetches a binary payload — the xlsx exports.
 *
 * An error response here still arrives as a JSON failure envelope, but with
 * `responseType: 'blob'` axios hands it back as a Blob, so it has to be read as
 * text before it can be understood.
 *
 * @returns {Promise<Blob>}
 */
export async function requestBlob(config) {
  try {
    const response = await http.request({ ...config, responseType: 'blob' });
    return response.data;
  } catch (error) {
    const blob = error?.response?.data;
    if (blob instanceof Blob) {
      try {
        const body = JSON.parse(await blob.text());
        throw new ApiRequestError(body.message || 'دریافت خروجی ناموفق بود.', {
          status: error.response.status,
          errors: body.errors ?? [],
        });
      } catch (parseError) {
        if (parseError instanceof ApiRequestError) {
          if (parseError.isUnauthenticated) {
            clearToken();
            onUnauthenticated?.();
          }
          throw parseError;
        }
      }
    }
    return handle(error);
  }
}

export default {
  request,
  requestWithMeta,
  requestBlob,
  http,
  API_BASE_URL,
  MEDIA_BASE_URL,
  ApiRequestError,
  getToken,
  setToken,
  clearToken,
  setUnauthenticatedHandler,
};
