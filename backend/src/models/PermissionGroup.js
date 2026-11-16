/**
 * PermissionGroup — legacy `permission_group_tbl` + `permission_group_relation_tbl`.
 *
 * Purpose: a named role. A user belongs to exactly one group, and the group
 *          holds the set of AccessPermission documents it grants.
 * Inputs:  admin group editor
 * Outputs: PermissionGroup documents
 * Deps:    plugins/softDelete
 *
 * The legacy join table (`permission_group_relation_tbl`: row, group_id,
 * permission_id, is_delete) collapses into the `permissions` array here. It
 * carried no data of its own beyond the pairing and a delete flag, and it was
 * always rewritten wholesale by the group update screen, so a separate
 * collection buys nothing.
 */
import mongoose from 'mongoose';
import softDeletePlugin from './plugins/softDelete.js';

const permissionGroupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    permissions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'AccessPermission' }],
  },
  { timestamps: true },
);

permissionGroupSchema.plugin(softDeletePlugin);

export const PermissionGroup = mongoose.model('PermissionGroup', permissionGroupSchema);
export default PermissionGroup;
