/**
 * User repository.
 *
 * Purpose: account lookups, including the credential read that has to opt into
 *          the normally-hidden password fields.
 * Inputs:  mobile numbers, ids, filters
 * Outputs: User documents
 * Deps:    models, repositories/BaseRepository
 */
import { User } from '../models/index.js';
import BaseRepository from './BaseRepository.js';

export class UserRepository extends BaseRepository {
  constructor() {
    super(User);
  }

  /**
   * Loads a user for authentication.
   *
   * Returns a hydrated document (not lean) so `verifyPassword()` and the
   * password-hashing pre-save hook are available, and explicitly selects the
   * two hash fields, which the schema hides by default.
   *
   * legacy (admin/.../controllers/UserController.php::actionLogin) instead did
   *   WHERE mobile = '$mobile' AND password = '$password'
   *     AND is_active = 1 AND permission_group_id IS NOT NULL
   *     AND permission_group_id != 0
   * — comparing the SHA-1 hash inside the query. Here the lookup is by identity
   * only and the secret is verified in the service, so a failed password never
   * changes which row is fetched.
   */
  findByMobileForAuth(mobile) {
    return User.findOne({ mobile, isDeleted: false })
      .select('+password +legacyPasswordHash')
      .populate({
        path: 'permissionGroup',
        match: { isDeleted: false },
        populate: { path: 'permissions', match: { isDeleted: false } },
      });
  }

  /** Loads a user with permissions resolved, for the auth middleware. */
  findByIdWithPermissions(id) {
    return User.findOne({ _id: id, isDeleted: false, isActive: true })
      .populate({
        path: 'permissionGroup',
        match: { isDeleted: false },
        populate: { path: 'permissions', match: { isDeleted: false } },
      })
      .lean();
  }

  existsByMobile(mobile, excludeId = null) {
    const filter = { mobile, isDeleted: false };
    if (excludeId) filter._id = { $ne: excludeId };
    return User.exists(filter);
  }

  /**
   * Replaces a user's bcrypt hash and clears any carried-over SHA-1 value.
   * Uses save() so the pre-save hashing hook runs.
   */
  async setPassword(id, plainPassword) {
    const user = await User.findOne({ _id: id, isDeleted: false }).select('+password');
    if (!user) return null;
    user.password = plainPassword;
    user.legacyPasswordHash = null;
    await user.save();
    return user;
  }
}

export const userRepository = new UserRepository();
export default userRepository;
