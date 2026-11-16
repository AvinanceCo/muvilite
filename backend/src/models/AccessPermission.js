/**
 * AccessPermission — legacy `access_permission_tbl`.
 *
 * Purpose: one grantable permission: a page plus the actions allowed on it.
 * Inputs:  reference data (seeded), admin management
 * Outputs: AccessPermission documents
 * Deps:    plugins/softDelete, config/constants
 *
 * Legacy columns: id, display_name, action_view, action_edit, action_delete,
 * action_page, is_delete (admin/.../models/AccessPermissionModel.php).
 *
 * BUG FIXED — the legacy resolver aggregated a user's permissions with
 *   `sum(action_view) AS action_view ... GROUP BY action_page`
 * and then compared the result with `== 1`. When two permission rows in a group
 * granted the same flag for the same page the sum was 2, the equality check
 * failed, and access was silently denied. These are booleans here and the
 * resolver ORs them.
 */
import mongoose from 'mongoose';
import softDeletePlugin from './plugins/softDelete.js';
import { PERMISSION_PAGES } from '../config/constants.js';

const accessPermissionSchema = new mongoose.Schema(
  {
    /** Human-readable label shown in the group editor. */
    displayName: { type: String, required: true, trim: true },
    /** The guarded section, e.g. 'movies'. legacy: action_page */
    actionPage: { type: String, required: true, trim: true, enum: PERMISSION_PAGES, index: true },
    actionView: { type: Boolean, default: false },
    actionEdit: { type: Boolean, default: false },
    actionDelete: { type: Boolean, default: false },
  },
  { timestamps: true },
);

accessPermissionSchema.plugin(softDeletePlugin);

export const AccessPermission = mongoose.model('AccessPermission', accessPermissionSchema);
export default AccessPermission;
