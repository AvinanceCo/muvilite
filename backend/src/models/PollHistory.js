/**
 * PollHistory — legacy `poll_history_tbl`.
 *
 * Purpose: one recorded answer: this token said `vote` to this question.
 * Inputs:  public poll endpoint
 * Outputs: PollHistory documents
 * Deps:    plugins/softDelete, models/Poll
 *
 * Legacy behaviour (api/v2/index.php::poll) — this is real business logic and
 * is preserved exactly:
 *
 *   SELECT id FROM poll_history_tbl
 *    WHERE created_date BETWEEN DATE_SUB(now(), INTERVAL 3 HOUR) AND now()
 *      AND token = '$token'
 *
 *   -- rows found  -> UPDATE poll_history_tbl SET vote = ?
 *   --                 WHERE poll_id = ? AND token = '$token'
 *   -- no rows     -> INSERT (user_ip, poll_id, vote, token)
 *
 * So a respondent may revise their answers for three hours, after which a
 * resubmission is counted as a new response.
 *
 * `token` is minted client-side (`Math.random().toString(36)` stored in
 * localStorage) and is anonymous — it is an identity for deduplication only and
 * is not authentication. The legacy code concatenated it straight into both the
 * SELECT and the UPDATE; here it is a bound value.
 */
import mongoose from 'mongoose';
import softDeletePlugin from './plugins/softDelete.js';
import { POLL_ANSWER_VALUES } from './Poll.js';

const pollHistorySchema = new mongoose.Schema(
  {
    poll: { type: mongoose.Schema.Types.ObjectId, ref: 'Poll', required: true, index: true },
    /** Anonymous client-generated respondent id. NOT an auth token. */
    token: { type: String, required: true, trim: true, index: true },
    vote: { type: Number, required: true, enum: POLL_ANSWER_VALUES },
    userIp: { type: String, default: null },
  },
  { timestamps: true },
);

pollHistorySchema.plugin(softDeletePlugin);

// Supports the "has this token answered in the last 3 hours" lookup.
pollHistorySchema.index({ token: 1, createdAt: -1 });
// Locates the row to revise during the 3-hour window. Deliberately NOT unique:
// once the window lapses, a resubmission inserts a fresh row for the same
// (token, poll) pair, which is how the legacy code recorded a new response.
pollHistorySchema.index({ token: 1, poll: 1, createdAt: -1 });

export const PollHistory = mongoose.model('PollHistory', pollHistorySchema);
export default PollHistory;
