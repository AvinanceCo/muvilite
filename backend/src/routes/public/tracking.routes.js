/**
 * Tracking and poll routes.
 *
 * Purpose: endpoint definitions for the public write paths.
 * Inputs:  none
 * Outputs: an Express router
 * Deps:    controllers/public/tracking, validators, middleware/validate
 *
 * Legacy action -> route:
 *   ?@=watch_add     -> POST  /api/watch-sessions
 *   ?@=watch_update  -> PATCH /api/watch-sessions/:id
 *   ?@=listen_update -> PATCH /api/listen-sessions/:id
 *   ?@=ads_add       -> POST  /api/ads-events
 *   ?@=poll          -> POST  /api/poll/votes
 *
 * The legacy API used GET for all of these, including the ones that wrote rows.
 * They are proper verbs here.
 */
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  createWatchSession,
  heartbeatWatchSession,
  createListenSession,
  heartbeatListenSession,
  createAdEvent,
  getPollQuestions,
  createPollVotes,
} from '../../controllers/public/tracking.controller.js';
import validate from '../../middleware/validate.js';
import { objectIdParam } from '../../validators/common.validators.js';
import {
  createWatchSessionRules,
  watchHeartbeatRules,
  createListenSessionRules,
  adEventRules,
  pollVoteRules,
} from '../../validators/tracking.validators.js';

const router = Router();

/**
 * Heartbeats are frequent by design (one per 30s of video, one per 15s of
 * audio), so this ceiling is generous — it exists to stop a runaway or
 * malicious client inflating watch totals, not to limit normal playback.
 */
const heartbeatLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many heartbeats', errors: [] },
});

router.post('/watch-sessions', validate(createWatchSessionRules), createWatchSession);
router.patch(
  '/watch-sessions/:id',
  heartbeatLimiter,
  validate([objectIdParam(), ...watchHeartbeatRules]),
  heartbeatWatchSession,
);

router.post('/listen-sessions', validate(createListenSessionRules), createListenSession);
router.patch(
  '/listen-sessions/:id',
  heartbeatLimiter,
  validate([objectIdParam()]),
  heartbeatListenSession,
);

router.post('/ads-events', validate(adEventRules), createAdEvent);

router.get('/poll/questions', getPollQuestions);
router.post('/poll/votes', validate(pollVoteRules), createPollVotes);

export default router;
