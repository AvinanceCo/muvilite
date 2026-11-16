/**
 * Admin user management service.
 *
 * Purpose: user CRUD, which needs more than the generic factory offers —
 *          mobile normalization, password hashing, and category membership.
 * Inputs:  admin payloads
 * Outputs: User documents (never including a password hash)
 * Deps:    repositories, services/auditLog, utils/*
 *
 * Legacy counterpart: admin/.../controllers/UserController.php
 * (`?@=index|new|update`) plus views/users/*.
 *
 * Differences from the legacy implementation:
 *   - passwords are bcrypt, hashed by the model's pre-save hook, instead of
 *     `sha1($request['password'])` written straight into the SQL;
 *   - `UserController::update()` required `models/UserTokenModel.php` on a
 *     password change, and that file does not exist — a password change through
 *     the legacy panel was a guaranteed fatal error. There is no such
 *     dependency here;
 *   - category membership was maintained by soft-deleting every relation row
 *     and re-inserting; it is an array on the user here, replaced atomically.
 */
import { userRepository, permissionGroupRepository } from '../../repositories/index.js';
import { buildDiff, logCreate, logUpdate, logDelete } from '../auditLog.service.js';
import { resolvePagination, resolveSort, buildMeta } from '../../utils/pagination.js';
import { normalizeMobile } from '../../utils/mobile.js';
import ApiError from '../../utils/ApiError.js';

const PAGE = 'users';

const SORT_FIELDS = Object.freeze({
  created_date: 'createdAt',
  modified_date: 'updatedAt',
  id: '_id',
  mobile: 'mobile',
  display_name: 'displayName',
  last_login: 'lastLoginAt',
});

const like = (value) => new RegExp(String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

/** Never leak either hash, even though both are `select: false`. */
const PUBLIC_SELECT = '-password -legacyPasswordHash';

export async function list(query = {}) {
  const { page, limit, skip } = resolvePagination(query);
  const sort = resolveSort(query.item_sort, query.sort_type, {
    allowed: SORT_FIELDS,
    defaultField: 'created_date',
  });

  const filter = userRepository.adminScope();
  if (query.mobile) filter.mobile = like(query.mobile);
  if (query.displayName) filter.displayName = like(query.displayName);
  if (query.isActive !== undefined) filter.isActive = query.isActive;
  if (query.permissionGroup) filter.permissionGroup = query.permissionGroup;

  const { items, total } = await userRepository.paginate(filter, {
    sort,
    skip,
    limit,
    select: PUBLIC_SELECT,
    populate: ['permissionGroup', 'categories'],
  });

  return { items, meta: buildMeta({ page, limit, total }) };
}

export async function getById(id) {
  const user = await userRepository.findById(id, {
    scope: 'admin',
    select: PUBLIC_SELECT,
    populate: ['permissionGroup', 'categories'],
  });
  if (!user) throw ApiError.notFound('User not found');
  return user;
}

/** Rejects a permissionGroup that does not exist, rather than silently nulling it. */
async function assertGroupExists(permissionGroup) {
  if (!permissionGroup) return;
  const group = await permissionGroupRepository.findById(permissionGroup, { scope: 'admin' });
  if (!group) throw ApiError.badRequest('The specified permission group does not exist');
}

export async function create(payload, context) {
  const mobile = normalizeMobile(payload.mobile);
  if (!mobile) throw ApiError.badRequest('"mobile" is not a valid mobile number');

  if (await userRepository.existsByMobile(mobile)) {
    throw ApiError.conflict('A user with this mobile number already exists');
  }

  await assertGroupExists(payload.permissionGroup);

  // create() rather than the repository helper, so the password-hashing
  // pre-save hook runs.
  const attributes = { ...payload, mobile };
  // The panel dropped the birth date; the whole body is spread here, so it is
  // dropped explicitly rather than relying on the client not to send it.
  delete attributes.birthDate;

  const created = await userRepository.model.create(attributes);

  const safe = created.toObject();
  delete safe.password;
  delete safe.legacyPasswordHash;

  await logCreate({
    user: context.userId,
    userIp: context.userIp,
    page: PAGE,
    targetId: created._id,
    details: buildDiff({}, safe),
  });

  return safe;
}

export async function update(id, payload, context) {
  const before = await userRepository.findById(id, { scope: 'admin' });
  if (!before) throw ApiError.notFound('User not found');

  const document = await userRepository.model.findById(id).select('+password');
  if (!document) throw ApiError.notFound('User not found');

  if (payload.mobile !== undefined) {
    const mobile = normalizeMobile(payload.mobile);
    if (!mobile) throw ApiError.badRequest('"mobile" is not a valid mobile number');
    if (await userRepository.existsByMobile(mobile, id)) {
      throw ApiError.conflict('A user with this mobile number already exists');
    }
    document.mobile = mobile;
  }

  await assertGroupExists(payload.permissionGroup);

  // An omitted or empty password leaves the existing one untouched.
  if (payload.password) {
    document.password = payload.password;
    document.legacyPasswordHash = null;
  }

  // `birthDate` is not here: the users panel no longer collects it, so a write
  // must not be able to change it. Existing values stay on the document.
  const assignable = [
    'firstname',
    'lastname',
    'displayName',
    'email',
    'comment',
    'permissionGroup',
    'categories',
    'isActive',
    'source',
  ];

  for (const field of assignable) {
    if (payload[field] !== undefined) {
      document[field] = payload[field];
    }
  }

  await document.save();

  const safe = document.toObject();
  delete safe.password;
  delete safe.legacyPasswordHash;

  await logUpdate({
    user: context.userId,
    userIp: context.userIp,
    page: PAGE,
    targetId: id,
    details: buildDiff(before, safe),
  });

  return safe;
}

export async function setStatus(id, isActive, context) {
  const before = await userRepository.findById(id, { scope: 'admin' });
  if (!before) throw ApiError.notFound('User not found');

  const after = await userRepository.setActiveById(id, isActive);

  await logUpdate({
    user: context.userId,
    userIp: context.userIp,
    page: PAGE,
    targetId: id,
    details: { isActive: { old: before.isActive, new: isActive } },
  });

  return after;
}

export async function remove(id, context) {
  // An administrator deleting themselves would lock them out mid-session.
  if (String(id) === String(context.userId)) {
    throw ApiError.badRequest('You cannot delete your own account');
  }

  const removed = await userRepository.softDeleteById(id);
  if (!removed) throw ApiError.notFound('User not found');

  await logDelete({
    user: context.userId,
    userIp: context.userIp,
    page: PAGE,
    targetId: id,
  });

  return { id, deleted: true };
}

/** Administrative password reset — no current-password challenge. */
export async function resetPassword(id, newPassword, context) {
  const user = await userRepository.setPassword(id, newPassword);
  if (!user) throw ApiError.notFound('User not found');

  await logUpdate({
    user: context.userId,
    userIp: context.userIp,
    page: PAGE,
    targetId: id,
    details: { password: { old: null, new: 'reset' } },
  });

  return { id, passwordReset: true };
}

export default { list, getById, create, update, setStatus, remove, resetPassword };
