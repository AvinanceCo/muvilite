/**
 * UserCategory — legacy `user_categories_tbl`.
 *
 * Purpose: marketing/segmentation tag on an end user. NOT a permission concept —
 *          the legacy code used these purely to target Firebase Cloud Messaging
 *          topics (admin/.../controllers/UserCategoryController.php::createFCMTopic).
 * Inputs:  admin CRUD
 * Outputs: UserCategory documents
 * Deps:    plugins/softDelete
 *
 * Legacy columns: id, name, description, topic_name, created_date,
 * modified_date, is_active, is_delete.
 *
 * The membership join (`user_categories_relations_tbl`) is represented as the
 * `categories` array on User, since the legacy update path rewrote all of a
 * user's relations in one go.
 */
import mongoose from 'mongoose';
import softDeletePlugin from './plugins/softDelete.js';

const userCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    /** FCM topic this segment subscribes to. legacy: topic_name */
    topicName: { type: String, trim: true, default: '' },
  },
  { timestamps: true },
);

userCategorySchema.plugin(softDeletePlugin);

export const UserCategory = mongoose.model('UserCategory', userCategorySchema);
export default UserCategory;
