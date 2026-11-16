/**
 * UserLog — legacy `user_log_tbl`.
 *
 * Purpose: admin activity trail. Every create/update/delete performed through
 *          the admin panel writes one row.
 * Inputs:  admin services
 * Outputs: UserLog documents
 * Deps:    plugins/softDelete, config/constants
 *
 * Legacy columns (admin/.../models/UserLogModel.php::insertLog): row, user_id,
 * user_ip, action_page, action_type, action_id, created_date, details.
 *
 * `details` holds a field-level diff — the legacy movie update screen compared
 * each submitted field against the stored row and recorded
 * `{ field: { old, new } }` (views/movies/update.php:68-74). That shape is kept.
 *
 * Coverage gap carried over knowingly: the legacy panel logged entity CRUD only.
 * Logins, logouts, failed logins and permission changes were never recorded.
 * Auth events ARE logged here — see services/auth.service.js — because an audit
 * trail without them is not much of an audit trail.
 */
import mongoose from 'mongoose';
import softDeletePlugin from './plugins/softDelete.js';
import { USER_LOG_ACTIONS } from '../config/constants.js';

const userLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    userIp: { type: String, default: null },
    /** Section acted on, e.g. 'movies'. legacy: action_page */
    actionPage: { type: String, required: true, trim: true, index: true },
    /** 0 = create, 1 = update, 2 = delete. legacy: USER_LOG_ACTIONS */
    actionType: { type: Number, required: true, enum: Object.values(USER_LOG_ACTIONS) },
    /** Id of the affected document. legacy: action_id */
    actionId: { type: String, default: null, index: true },
    /** Field-level diff: { field: { old, new } }. */
    details: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true },
);

userLogSchema.plugin(softDeletePlugin);
userLogSchema.index({ createdAt: -1 });

export const UserLog = mongoose.model('UserLog', userLogSchema);
export default UserLog;
