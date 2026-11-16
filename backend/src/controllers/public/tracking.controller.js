/**
 * Tracking and poll controllers.
 *
 * Purpose: expose the playback heartbeat, ad telemetry and poll endpoints.
 * Inputs:  Express req/res
 * Outputs: JSON responses
 * Deps:    services/{tracking,poll}, utils/{apiResponse,asyncHandler,clientInfo}
 */
import {
  startWatchSession,
  recordWatchHeartbeat,
  startListenSession,
  recordListenHeartbeat,
  recordAdEvent,
} from '../../services/tracking.service.js';
import { listQuestions, submitVotes } from '../../services/poll.service.js';
import { sendSuccess, sendCreated } from '../../utils/apiResponse.js';
import asyncHandler from '../../utils/asyncHandler.js';
import { getClientIp } from '../../utils/clientInfo.js';

/** POST /api/watch-sessions — legacy `?@=watch_add` */
export const createWatchSession = asyncHandler(async (req, res) => {
  const data = await startWatchSession({
    movieId: req.body.movieId,
    userIp: getClientIp(req),
    platform: req.body.platform,
  });
  return sendCreated(res, data);
});

/** PATCH /api/watch-sessions/:id — legacy `?@=watch_update` */
export const heartbeatWatchSession = asyncHandler(async (req, res) => {
  const data = await recordWatchHeartbeat(req.params.id, { lastSecond: req.body.lastSecond });
  return sendSuccess(res, data);
});

/** POST /api/listen-sessions — split out of the legacy `?@=music` side effect */
export const createListenSession = asyncHandler(async (req, res) => {
  const data = await startListenSession({
    musicId: req.body.musicId,
    userIp: getClientIp(req),
  });
  return sendCreated(res, data);
});

/** PATCH /api/listen-sessions/:id — legacy `?@=listen_update` */
export const heartbeatListenSession = asyncHandler(async (req, res) => {
  const data = await recordListenHeartbeat(req.params.id);
  return sendSuccess(res, data);
});

/** POST /api/ads-events — legacy `?@=ads_add` */
export const createAdEvent = asyncHandler(async (req, res) => {
  const data = await recordAdEvent({
    adId: req.body.adId,
    title: req.body.title,
    watchedSecond: req.body.watchedSecond,
    eventType: req.body.eventType,
    userIp: getClientIp(req),
  });
  return sendCreated(res, data);
});

/** GET /api/poll/questions — served from poll_tbl instead of hardcoded markup */
export const getPollQuestions = asyncHandler(async (_req, res) =>
  sendSuccess(res, await listQuestions()),
);

/** POST /api/poll/votes — legacy `?@=poll` */
export const createPollVotes = asyncHandler(async (req, res) => {
  const { updated, count } = await submitVotes({
    token: req.body.token,
    userIp: getClientIp(req),
    votes: req.body.votes,
  });

  // Mirrors the two distinct legacy confirmations.
  return sendSuccess(
    res,
    { updated, count },
    {
      message: updated ? 'نظرات شما با موفقیت بروزرسانی شد.' : 'نظرات شما با موفقیت ثبت شد.',
      statusCode: updated ? 200 : 201,
    },
  );
});

export default {
  createWatchSession,
  heartbeatWatchSession,
  createListenSession,
  heartbeatListenSession,
  createAdEvent,
  getPollQuestions,
  createPollVotes,
};
