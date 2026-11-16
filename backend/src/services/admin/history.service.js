/**
 * History and audit read service.
 *
 * Purpose: paginated, filterable reads over the analytics collections and the
 *          admin activity log. All read-only — nothing writes these from the
 *          admin side.
 * Inputs:  filter/pagination queries
 * Outputs: paginated lists
 * Deps:    repositories, utils/pagination
 *
 * Legacy counterparts: WatchHistoryController, AdsHistoryController,
 * PollHistoryController and UserLogController — each exposing `?@=index` to a
 * DataTables grid. Their filters were concatenated into SQL
 * (`order by $order limit $limit offset $offset`), so every one of them was
 * injectable. Filters are declared and bound here.
 */
import {
  watchHistoryRepository,
  listenHistoryRepository,
  adsHistoryRepository,
  pollHistoryRepository,
  userLogRepository,
  watchTrendDailyRepository,
} from '../../repositories/index.js';
import { resolvePagination, resolveSort, buildMeta } from '../../utils/pagination.js';

const TIME_SORTS = Object.freeze({ created_date: 'createdAt', id: '_id' });

/** Applies an optional inclusive created-at range. */
function applyDateRange(filter, { from, to }) {
  if (!from && !to) return filter;
  filter.createdAt = {};
  if (from) filter.createdAt.$gte = new Date(from);
  if (to) filter.createdAt.$lte = new Date(to);
  return filter;
}

/** Builds a standard paginated reader over one history collection. */
function buildReader({ repository, sortFields = TIME_SORTS, buildFilter, populate = [] }) {
  return async function read(query = {}) {
    const { page, limit, skip } = resolvePagination(query);
    const sort = resolveSort(query.item_sort, query.sort_type, {
      allowed: sortFields,
      defaultField: 'created_date',
    });

    const filter = applyDateRange(
      { isDeleted: false, ...(buildFilter ? buildFilter(query) : {}) },
      query,
    );

    const { items, total } = await repository.paginate(filter, { sort, skip, limit, populate });
    return { items, meta: buildMeta({ page, limit, total }) };
  };
}

export const listWatchHistory = buildReader({
  repository: watchHistoryRepository,
  sortFields: { ...TIME_SORTS, watched_second: 'watchedSecond' },
  populate: ['movie'],
  buildFilter: (query) => {
    const filter = {};
    if (query.movie) filter.movie = query.movie;
    if (query.userIp) filter.userIp = query.userIp;
    if (query.platform !== undefined) filter.userPlatform = Number(query.platform);
    return filter;
  },
});

export const listListenHistory = buildReader({
  repository: listenHistoryRepository,
  sortFields: { ...TIME_SORTS, listened_second: 'listenedSecond' },
  populate: ['music'],
  buildFilter: (query) => {
    const filter = {};
    if (query.music) filter.music = query.music;
    if (query.userIp) filter.userIp = query.userIp;
    return filter;
  },
});

export const listAdsHistory = buildReader({
  repository: adsHistoryRepository,
  sortFields: { ...TIME_SORTS, watched_second: 'watchedSecond' },
  // `ad` is null on every legacy row and on anything a third-party player
  // reports, so the stored `title` remains the column the report displays.
  populate: ['ad'],
  buildFilter: (query) => {
    const filter = {};
    if (query.ad) filter.ad = query.ad;
    if (query.title) filter.title = query.title;
    if (query.eventType) filter.eventType = query.eventType;
    if (query.userIp) filter.userIp = query.userIp;
    return filter;
  },
});

export const listPollHistory = buildReader({
  repository: pollHistoryRepository,
  populate: ['poll'],
  buildFilter: (query) => {
    const filter = {};
    if (query.poll) filter.poll = query.poll;
    if (query.token) filter.token = query.token;
    if (query.vote !== undefined) filter.vote = Number(query.vote);
    return filter;
  },
});

export const listUserLogs = buildReader({
  repository: userLogRepository,
  populate: ['user'],
  buildFilter: (query) => {
    const filter = {};
    if (query.user) filter.user = query.user;
    if (query.actionPage) filter.actionPage = query.actionPage;
    if (query.actionType !== undefined) filter.actionType = Number(query.actionType);
    if (query.actionId) filter.actionId = query.actionId;
    if (query.userIp) filter.userIp = query.userIp;
    return filter;
  },
});

export const listWatchTrends = buildReader({
  repository: watchTrendDailyRepository,
  sortFields: {
    ...TIME_SORTS,
    window_start: 'windowStart',
    sum_watched_second: 'sumWatchedSecond',
    total_count: 'totalCount',
  },
  populate: ['movie'],
  buildFilter: (query) => (query.movie ? { movie: query.movie } : {}),
});

/**
 * Aggregated poll results: response counts per answer value, per question.
 * The legacy panel listed raw rows only and had no summary view.
 */
export async function summarizePoll() {
  return pollHistoryRepository.model.aggregate([
    { $match: { isDeleted: false } },
    { $group: { _id: { poll: '$poll', vote: '$vote' }, count: { $sum: 1 } } },
    {
      $group: {
        _id: '$_id.poll',
        total: { $sum: '$count' },
        answers: { $push: { vote: '$_id.vote', count: '$count' } },
      },
    },
    { $lookup: { from: 'polls', localField: '_id', foreignField: '_id', as: 'poll' } },
    { $unwind: '$poll' },
    {
      $project: {
        _id: 0,
        pollId: '$_id',
        questionFa: '$poll.questionFa',
        questionEn: '$poll.questionEn',
        order: '$poll.order',
        total: 1,
        answers: 1,
      },
    },
    { $sort: { order: 1 } },
  ]);
}

export default {
  listWatchHistory,
  listListenHistory,
  listAdsHistory,
  listPollHistory,
  listUserLogs,
  listWatchTrends,
  summarizePoll,
};
