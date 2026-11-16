/**
 * HTTP client.
 *
 * Purpose: the single place that knows about the backend's response envelope.
 *          Everything above this file receives plain data and plain errors.
 * Inputs:  VITE_API_URL (defaults to the dev proxy at /api)
 * Outputs: `request()` returning `data`, or `requestWithMeta()` returning
 *          `{ data, meta, message }`
 * Deps:    axios
 *
 * Backend envelope (utils/apiResponse.js):
 *   success  { success: true,  message, data, meta? }
 *   failure  { success: false, message, errors: [] }
 *
 * A failure envelope is turned into an ApiRequestError carrying the server's
 * `message` — which is Persian on the poll endpoints and English elsewhere — so
 * a component can display `error.message` without inspecting status codes.
 */
import axios from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_URL ?? '/api';

/** Origin that serves uploaded media. Empty means "same origin as the page". */
export const MEDIA_BASE_URL = import.meta.env.VITE_MEDIA_URL ?? '';

/** An error carrying the server's message and field errors, if any. */
export class ApiRequestError extends Error {
  constructor(message, { status = 0, errors = [] } = {}) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.errors = errors;
  }

  /** True when the resource genuinely does not exist, as opposed to a failure. */
  get isNotFound() {
    return this.status === 404;
  }
}

export const http = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

/**
 * Normalizes anything axios can throw into an ApiRequestError.
 * Network failure is expected on an aircraft, so it gets its own message rather
 * than the raw axios text.
 */
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
    throw toApiError(error);
  }
}

/**
 * Same as `request()`, but keeps `meta` (pagination) and `message` — needed by
 * list endpoints and by the poll, whose confirmation text is the message.
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
    throw toApiError(error);
  }
}

export default { request, requestWithMeta, http, API_BASE_URL, MEDIA_BASE_URL, ApiRequestError };
