/**
 * Tracking and poll validators.
 *
 * Purpose: validate every write the public API accepts. The legacy endpoints
 *          took these values straight off the query string, which is how the
 *          poll token reached both a SELECT and an UPDATE unescaped.
 * Inputs:  none
 * Outputs: express-validator chains
 * Deps:    express-validator, config/constants, models
 */
import { body } from 'express-validator';
import { DEVICE_PLATFORM_VALUES } from '../config/constants.js';
import { POLL_ANSWER_VALUES } from '../models/Poll.js';
import { AD_EVENT_TYPES } from '../models/AdsHistory.js';

export const createWatchSessionRules = [
  body('movieId').isMongoId().withMessage('"movieId" must be a valid id'),
  body('platform')
    .optional()
    .isInt()
    .toInt()
    .isIn(DEVICE_PLATFORM_VALUES)
    .withMessage('"platform" is not a known device platform'),
];

export const watchHeartbeatRules = [
  // Playback position, used for the daily trend average. Bounded at 24h so a
  // bad client cannot skew the mean with an absurd value.
  body('lastSecond')
    .optional()
    .isInt({ min: 0, max: 86_400 })
    .withMessage('"lastSecond" must be between 0 and 86400')
    .toInt(),
];

export const createListenSessionRules = [
  body('musicId').isMongoId().withMessage('"musicId" must be a valid id'),
];

export const adEventRules = [
  // Which creative played. Optional, because a legacy or third-party player
  // reporting only a title must still be accepted.
  body('adId').optional({ values: 'falsy' }).isMongoId().withMessage('"adId" must be a valid id'),
  body('title').optional().isString().trim().isLength({ max: 255 }),
  body('watchedSecond')
    .optional()
    .isInt({ min: 0, max: 86_400 })
    .withMessage('"watchedSecond" must be a non-negative integer')
    .toInt(),
  body('eventType')
    .optional()
    .isIn(AD_EVENT_TYPES)
    .withMessage(`"eventType" must be one of: ${AD_EVENT_TYPES.join(', ')}`),
];

export const pollVoteRules = [
  // Anonymous respondent id minted by the client. Constrained in shape so it
  // cannot be used to smuggle anything into a query.
  body('token')
    .isString()
    .trim()
    .isLength({ min: 8, max: 128 })
    .withMessage('"token" must be 8-128 characters')
    .matches(/^[A-Za-z0-9_-]+$/)
    .withMessage('"token" may only contain letters, digits, hyphen and underscore'),

  body('votes')
    .isArray({ min: 1, max: 50 })
    .withMessage('"votes" must contain between 1 and 50 answers'),
  body('votes.*.pollId').isMongoId().withMessage('Each vote needs a valid "pollId"'),
  body('votes.*.vote')
    .isInt()
    .toInt()
    .isIn(POLL_ANSWER_VALUES)
    .withMessage(`Each vote must be one of: ${POLL_ANSWER_VALUES.join(', ')}`),
];

export default {
  createWatchSessionRules,
  watchHeartbeatRules,
  createListenSessionRules,
  adEventRules,
  pollVoteRules,
};
