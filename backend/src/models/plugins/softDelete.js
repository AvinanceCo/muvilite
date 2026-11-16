/**
 * Soft-delete + visibility plugin.
 *
 * Purpose: give every content collection the two flags the legacy schema put on
 *          nearly every table, plus a consistent way to filter on them.
 * Inputs:  a Mongoose schema
 * Outputs: adds `isActive` / `isDeleted` paths, an index, and helper statics
 * Deps:    none
 *
 * Legacy mapping:
 *   `is_delete` -> isDeleted   (Model::delete() set is_delete = 1 rather than
 *                               removing the row; real_delete() was the hard
 *                               delete and was used almost nowhere)
 *   `is_active` -> isActive    (public visibility toggle, flipped by the admin
 *                               "status" actions)
 *
 * Every public read in the legacy app carried `is_delete = 0 AND is_active = 1`.
 * Admin reads carried only `is_delete = 0`, so deactivated rows stay editable.
 */
export function softDeletePlugin(schema) {
  schema.add({
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  });

  schema.index({ isDeleted: 1, isActive: 1 });

  /** Filter for public reads: not deleted AND active. */
  schema.statics.publicFilter = function publicFilter(extra = {}) {
    return { isDeleted: false, isActive: true, ...extra };
  };

  /** Filter for admin reads: not deleted, regardless of active state. */
  schema.statics.adminFilter = function adminFilter(extra = {}) {
    return { isDeleted: false, ...extra };
  };

  /** Soft delete, mirroring the legacy `Model::delete()`. */
  schema.statics.softDeleteById = function softDeleteById(id) {
    return this.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: { isDeleted: true, deletedAt: new Date() } },
      { new: true },
    );
  };
}

export default softDeletePlugin;
