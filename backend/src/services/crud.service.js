/**
 * Generic admin CRUD service factory.
 *
 * Purpose: the legacy admin panel repeated the same list/create/update/delete/
 *          status-toggle shape across ~20 controllers. This builds that shape
 *          once, with auditing and soft-delete handled consistently.
 * Inputs:  a repository plus a per-entity configuration
 * Outputs: an object of service functions
 * Deps:    repositories, services/auditLog, utils/{pagination,ApiError}
 *
 * Legacy counterparts: admin/.../controllers/*Controller.php, each exposing
 * `?@=index|new|update|delete|status` over AdminModel. Those built their
 * filters by string concatenation (`" and movies_tbl.title_fa like '%"
 * . $request['title_fa_filter'] . "%'"`), so every list filter was injectable.
 * Filters here are declared per entity and turned into query objects.
 */
import { resolvePagination, resolveSort, buildMeta } from '../utils/pagination.js';
import { buildDiff, logCreate, logUpdate, logDelete } from './auditLog.service.js';
import ApiError from '../utils/ApiError.js';

/**
 * @param {object} config
 * @param {import('../repositories/BaseRepository.js').BaseRepository} config.repository
 * @param {string} config.page          permission/audit identifier, e.g. 'movies'
 * @param {string} config.label         human name used in error messages
 * @param {Record<string,string>} config.sortFields  request key -> schema path
 * @param {string} config.defaultSort   default request key
 * @param {(query: object) => object} [config.buildFilter]  extra list filters
 * @param {string[]} [config.populate]  paths to populate on list/get
 * @param {(payload: object) => object} [config.transformWrite]  normalize input
 */
export function createCrudService({
  repository,
  page,
  label,
  sortFields,
  defaultSort,
  buildFilter,
  populate = [],
  transformWrite,
}) {
  const prepare = (payload) => (transformWrite ? transformWrite(payload) : payload);

  /** Paginated admin listing. Includes deactivated rows, excludes deleted. */
  async function list(query = {}) {
    const { page: pageNumber, limit, skip } = resolvePagination(query);
    const sort = resolveSort(query.item_sort, query.sort_type, {
      allowed: sortFields,
      defaultField: defaultSort,
      defaultDirection: 'DESC',
    });

    const filter = repository.adminScope(buildFilter ? buildFilter(query) : {});

    const { items, total } = await repository.paginate(filter, { sort, skip, limit, populate });

    return { items, meta: buildMeta({ page: pageNumber, limit, total }) };
  }

  async function getById(id) {
    const document = await repository.findById(id, { scope: 'admin', populate });
    if (!document) {
      throw ApiError.notFound(`${label} not found`);
    }
    return document;
  }

  async function create(payload, context) {
    const created = await repository.create(prepare(payload));

    await logCreate({
      user: context.userId,
      userIp: context.userIp,
      page,
      targetId: created._id,
      details: buildDiff({}, created.toObject ? created.toObject() : created),
    });

    return created;
  }

  async function update(id, payload, context) {
    const before = await repository.findById(id, { scope: 'admin' });
    if (!before) {
      throw ApiError.notFound(`${label} not found`);
    }

    const after = await repository.updateById(id, prepare(payload));

    await logUpdate({
      user: context.userId,
      userIp: context.userIp,
      page,
      targetId: id,
      details: buildDiff(before, after),
    });

    return after;
  }

  /** Visibility toggle. legacy: the `?@=status` action. */
  async function setStatus(id, isActive, context) {
    const before = await repository.findById(id, { scope: 'admin' });
    if (!before) {
      throw ApiError.notFound(`${label} not found`);
    }

    const after = await repository.setActiveById(id, isActive);

    await logUpdate({
      user: context.userId,
      userIp: context.userIp,
      page,
      targetId: id,
      details: { isActive: { old: before.isActive, new: isActive } },
    });

    return after;
  }

  /** Soft delete. legacy: `Model::delete()` set is_delete = 1. */
  async function remove(id, context) {
    const removed = await repository.softDeleteById(id);
    if (!removed) {
      throw ApiError.notFound(`${label} not found`);
    }

    await logDelete({
      user: context.userId,
      userIp: context.userIp,
      page,
      targetId: id,
      details: null,
    });

    return { id, deleted: true };
  }

  return { list, getById, create, update, setStatus, remove };
}

export default createCrudService;
