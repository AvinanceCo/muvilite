/**
 * BaseRepository — shared database access.
 *
 * Purpose: the only layer that talks to Mongoose. It centralises the two things
 *          every legacy query repeated by hand — the soft-delete/active filter
 *          and the offset pagination — so no caller can forget either.
 * Inputs:  a Mongoose model
 * Outputs: query results and counts
 * Deps:    mongoose
 *
 * Per CLAUDE.md the layering is routes -> controllers -> services ->
 * repositories -> database. Repositories hold no business logic; they only
 * shape queries.
 *
 * Legacy counterpart: `api/v2/models/__model.php` and
 * `admin/3P1z05m4n4Gm3nt/models/AdminModel.php`, both of which built WHERE,
 * ORDER BY and LIMIT clauses by string concatenation. Every value here is
 * passed as a query object, so the injection surface is gone by construction.
 */
export class BaseRepository {
  /** @param {import('mongoose').Model} model */
  constructor(model) {
    this.model = model;
  }

  /**
   * Public-facing scope: excludes deleted AND inactive documents.
   * legacy: `WHERE is_delete = 0 AND is_active = 1`
   */
  publicScope(filter = {}) {
    return { isDeleted: false, isActive: true, ...filter };
  }

  /**
   * Admin scope: excludes deleted only, so deactivated rows remain editable.
   * legacy: `WHERE is_delete = 0`
   */
  adminScope(filter = {}) {
    return { isDeleted: false, ...filter };
  }

  async findById(id, { scope = 'public', populate = [], select } = {}) {
    const filter = scope === 'admin' ? this.adminScope({ _id: id }) : this.publicScope({ _id: id });
    let query = this.model.findOne(filter);
    if (select) query = query.select(select);
    for (const path of populate) query = query.populate(path);
    return query.lean();
  }

  async findOne(filter, { populate = [], select } = {}) {
    let query = this.model.findOne(filter);
    if (select) query = query.select(select);
    for (const path of populate) query = query.populate(path);
    return query.lean();
  }

  async find(filter, { sort, skip = 0, limit, populate = [], select } = {}) {
    let query = this.model.find(filter);
    if (sort) query = query.sort(sort);
    if (skip) query = query.skip(skip);
    if (limit) query = query.limit(limit);
    if (select) query = query.select(select);
    for (const path of populate) query = query.populate(path);
    return query.lean();
  }

  count(filter) {
    return this.model.countDocuments(filter);
  }

  /**
   * List + total in one call, for endpoints that return pagination metadata.
   * @returns {Promise<{items: object[], total: number}>}
   */
  async paginate(filter, { sort, skip = 0, limit, populate = [], select } = {}) {
    const [items, total] = await Promise.all([
      this.find(filter, { sort, skip, limit, populate, select }),
      this.count(filter),
    ]);
    return { items, total };
  }

  create(payload) {
    return this.model.create(payload);
  }

  insertMany(payloads) {
    return this.model.insertMany(payloads);
  }

  /** Updates a non-deleted document and returns the new version. */
  updateById(id, payload) {
    return this.model
      .findOneAndUpdate({ _id: id, isDeleted: false }, { $set: payload }, { new: true, runValidators: true })
      .lean();
  }

  /** Atomic field increment — used by the playback heartbeats. */
  incrementById(id, increments, extraSet = {}) {
    return this.model
      .findOneAndUpdate(
        { _id: id, isDeleted: false },
        { $inc: increments, $set: extraSet },
        { new: true },
      )
      .lean();
  }

  /** Soft delete. legacy: `Model::delete()` set is_delete = 1. */
  softDeleteById(id) {
    return this.model
      .findOneAndUpdate(
        { _id: id, isDeleted: false },
        { $set: { isDeleted: true, deletedAt: new Date() } },
        { new: true },
      )
      .lean();
  }

  /** Visibility toggle behind the admin "status" actions. */
  setActiveById(id, isActive) {
    return this.updateById(id, { isActive });
  }

  /** Hard delete. legacy: `Model::real_delete()`, used only for join rows. */
  hardDeleteById(id) {
    return this.model.deleteOne({ _id: id });
  }

  exists(filter) {
    return this.model.exists(filter);
  }
}

export default BaseRepository;
