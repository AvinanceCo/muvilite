/**
 * Read-only reporting endpoints.
 *
 * Purpose: the history grids, the analytics trend table and the activity log.
 * Inputs:  filter and pagination params
 * Outputs: `{ items, meta }`, or a summary array
 * Deps:    api/client
 *
 * Legacy counterparts: WatchHistoryController, AdsHistoryController,
 * PollHistoryController and UserLogController, each backing one DataTables
 * grid. Nothing here writes; `UserLogController::actionDelete()` targeted the
 * wrong model and a column that does not exist, and was not ported
 * (backend/MIGRATION.md §6 defect 8) — the log is read-only by design.
 *
 * These routes carry no express-validator middleware, so an unknown filter is
 * ignored rather than rejected — but an unknown `item_sort` still 400s. The
 * allowed sort keys differ per endpoint and are listed on each function.
 *
 * All of them accept `from` and `to` as an inclusive `createdAt` range.
 */
import { request, requestWithMeta } from './client.js';

/** Shared shape: `{ items, meta }` from a paginated list endpoint. */
async function listReport(url, params) {
  const { data, meta } = await requestWithMeta({ url, params });
  return { items: data ?? [], meta };
}

/**
 * Watch sessions. Filters: `movie`, `userIp`, `platform` (0–4), `from`, `to`.
 * Sorts: `created_date`, `id`, `watched_second`.
 */
export function fetchWatchHistory(params = {}) {
  return listReport('/admin/watch-history', params);
}

/**
 * Listen sessions. Filters: `music`, `userIp`, `from`, `to`.
 * Sorts: `created_date`, `id`, `listened_second`.
 *
 * The legacy panel had no screen for this — the table existed and was written
 * to, but nothing displayed it.
 */
export function fetchListenHistory(params = {}) {
  return listReport('/admin/listen-history', params);
}

/**
 * Pre-roll ad telemetry. Filters: `title` (exact), `eventType`
 * (`skipped`|`completed`), `userIp`, `from`, `to`.
 * Sorts: `created_date`, `id`, `watched_second`.
 */
export function fetchAdsHistory(params = {}) {
  return listReport('/admin/ads-history', params);
}

/**
 * Daily watch aggregates, written by the nightly cron. Filters: `movie`,
 * `from`, `to`. Sorts: `created_date`, `id`, `window_start`,
 * `sum_watched_second`, `total_count`.
 *
 * Also new to the UI: the legacy cron wrote this table and no view read it.
 * Rows exist only for days the cron has run — an empty result means the job has
 * not run, not that nobody watched anything.
 */
export function fetchWatchTrends(params = {}) {
  return listReport('/admin/watch-trends', params);
}

/**
 * Individual poll votes. Filters: `poll`, `token`, `vote` (1–4), `from`, `to`.
 * Sorts: `created_date`, `id`.
 *
 * `token` is an anonymous client-generated identifier, not a user: it is what
 * the three-hour revision window keys on. Two rows with the same token are the
 * same visitor answering two different questions.
 */
export function fetchPollHistory(params = {}) {
  return listReport('/admin/poll-history', params);
}

/**
 * Vote totals per question. Takes no parameters and returns no `meta` — it is
 * an aggregate over the whole table, sorted by question order.
 *
 * `answers` contains only votes that actually occurred, so a question nobody
 * rated «ضعیف» has no entry for vote 1. Render against the fixed four-point
 * scale and treat a missing vote as zero.
 *
 * @returns {Promise<{pollId: string, questionFa: string, questionEn: string,
 *                    order: number, total: number,
 *                    answers: {vote: number, count: number}[]}[]>}
 */
export function fetchPollSummary() {
  return request({ url: '/admin/poll-summary' });
}

/**
 * The admin activity log. Filters: `user`, `actionPage`, `actionType` (0/1/2),
 * `actionId`, `userIp`, `from`, `to`. Sorts: `created_date`, `id`.
 *
 * `details` holds a field-level diff as `{ field: { old, new } }` on updates,
 * the created payload on creates, and null otherwise. Authentication events
 * appear under `actionPage: 'auth'` — the legacy log covered entity CRUD only
 * (backend/MIGRATION.md §6 defect 17).
 */
export function fetchUserLogs(params = {}) {
  return listReport('/admin/user-logs', params);
}

export default {
  fetchWatchHistory,
  fetchListenHistory,
  fetchAdsHistory,
  fetchWatchTrends,
  fetchPollHistory,
  fetchPollSummary,
  fetchUserLogs,
};
