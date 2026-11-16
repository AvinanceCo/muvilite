/**
 * ListenHistory — legacy `listen_history_tbl`.
 *
 * Purpose: one row per music listening session, incremented by a heartbeat.
 * Inputs:  public listen-session endpoints
 * Outputs: ListenHistory documents
 * Deps:    plugins/softDelete
 *
 * Legacy behaviour (api/v2/index.php::music / ::listen_update):
 *   INSERT INTO listen_history_tbl (music_id, user_ip) VALUES (?, ?)
 *   UPDATE listen_history_tbl
 *      SET modified_date = ?, listened_second = listened_second + 15
 *    WHERE id = ?
 *
 * The legacy heartbeat interval was 15 seconds, but sound.php emitted
 * `setInterval(..., 15)` without the ×1000 conversion, so the client fired
 * every 15 MILLIseconds. That is a client bug; the server contract is 15
 * seconds per call and is preserved as such.
 */
import mongoose from 'mongoose';
import softDeletePlugin from './plugins/softDelete.js';

const listenHistorySchema = new mongoose.Schema(
  {
    music: { type: mongoose.Schema.Types.ObjectId, ref: 'Music', required: true, index: true },
    userIp: { type: String, default: null },
    listenedSecond: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

listenHistorySchema.plugin(softDeletePlugin);
listenHistorySchema.index({ createdAt: -1 });

export const ListenHistory = mongoose.model('ListenHistory', listenHistorySchema);
export default ListenHistory;
