/**
 * Audit log service.
 *
 * Purpose: record every admin create/update/delete, including a field-level
 *          diff on updates.
 * Inputs:  actor, section, action, target id, before/after documents
 * Outputs: UserLog documents
 * Deps:    repositories, config/constants, utils/logger
 *
 * Legacy counterpart: `UserLogModel::insertLog($action_page, $action_type,
 * $action_id, $details)`, called explicitly from each admin controller.
 *
 * The diff shape comes from admin/.../views/movies/update.php:68-74, which
 * compared each submitted field against the stored row and recorded
 * `{ field: { old, new } }`. That is reproduced here and applied to every
 * entity, not just movies — the legacy panel only diffed the movie form and
 * logged a bare id everywhere else.
 */
import { userLogRepository } from '../repositories/index.js';
import { USER_LOG_ACTIONS } from '../config/constants.js';
import logger from '../utils/logger.js';

/** Values that are never worth diffing or are unsafe to record. */
const IGNORED_FIELDS = new Set([
  '_id',
  '__v',
  'createdAt',
  'updatedAt',
  'password',
  'legacyPasswordHash',
]);

const normalize = (value) => {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(String).join(',');
  if (typeof value === 'object') return String(value);
  return value;
};

/**
 * Field-level difference between two documents.
 * @returns {object|null} `{ field: { old, new } }`, or null when nothing changed
 */
export function buildDiff(before = {}, after = {}) {
  const diff = {};

  for (const key of Object.keys(after)) {
    if (IGNORED_FIELDS.has(key)) continue;

    const oldValue = normalize(before?.[key]);
    const newValue = normalize(after[key]);

    if (oldValue !== newValue) {
      diff[key] = { old: oldValue, new: newValue };
    }
  }

  return Object.keys(diff).length > 0 ? diff : null;
}

/**
 * Writes one audit entry.
 *
 * Logging must never break the operation it describes, so a failure here is
 * logged and swallowed rather than propagated.
 */
export async function recordAction({ user, userIp, page, action, targetId, details = null }) {
  try {
    await userLogRepository.create({
      user,
      userIp,
      actionPage: page,
      actionType: action,
      actionId: targetId ? String(targetId) : null,
      details,
    });
  } catch (error) {
    logger.error(`Failed to write audit log for ${page}/${action}`, error);
  }
}

export const logCreate = (context) =>
  recordAction({ ...context, action: USER_LOG_ACTIONS.CREATE });

export const logUpdate = (context) =>
  recordAction({ ...context, action: USER_LOG_ACTIONS.UPDATE });

export const logDelete = (context) =>
  recordAction({ ...context, action: USER_LOG_ACTIONS.DELETE });

export default { buildDiff, recordAction, logCreate, logUpdate, logDelete };
