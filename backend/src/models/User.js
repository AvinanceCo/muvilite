/**
 * User — legacy `users_tbl`.
 *
 * Purpose: a person with an account. The legacy schema used ONE table for both
 *          end users and administrators: an administrator is simply a row whose
 *          `permission_group_id` is set and non-zero
 *          (admin/.../controllers/UserController.php::actionLogin).
 *          That modelling is preserved — `permissionGroup` being set is what
 *          makes an account an admin.
 * Inputs:  admin user management, login
 * Outputs: User documents
 * Deps:    bcrypt, plugins/softDelete, config/env
 *
 * Legacy columns (admin/.../models/UserModel.php): id, firstname, lastname,
 * password, comment, mobile, display_name, email, birth_date, province_id,
 * permission_group_id, city_id, user_ip, created_date, modified_date,
 * is_active, is_delete — plus asiatech_sub, asiatech_username and source seen
 * in queries.
 *
 * SECURITY — deliberate divergence: the legacy app stored `sha1($password)`,
 * unsalted, and interpolated the hash into the login SQL. Passwords are bcrypt
 * here. `legacyPasswordHash` exists so that if a real database is ever
 * imported, a user's first successful login can verify the old SHA-1 value and
 * transparently upgrade them to bcrypt (see services/auth.service.js).
 */
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import softDeletePlugin from './plugins/softDelete.js';
import env from '../config/env.js';

const userSchema = new mongoose.Schema(
  {
    /** Normalized to +98XXXXXXXXXX. The login identifier. */
    mobile: { type: String, required: true, trim: true, unique: true },
    password: { type: String, required: true, select: false },
    /** Unsalted SHA-1 carried from the legacy table; cleared on upgrade. */
    legacyPasswordHash: { type: String, default: null, select: false },

    firstname: { type: String, trim: true, default: '' },
    lastname: { type: String, trim: true, default: '' },
    displayName: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, lowercase: true, default: '' },
    /**
     * RETIRED FIELD. The users panel no longer collects or edits a birth date,
     * and the admin API neither accepts nor assigns it. It stays on the schema
     * only so values carried over from `users_tbl.birth_date` survive — dropping
     * it would delete data on the next save.
     */
    birthDate: { type: Date, default: null },

    /** Free-text admin note. legacy: users_tbl.comment */
    comment: { type: String, default: '' },

    provinceId: { type: Number, default: null },
    cityId: { type: Number, default: null },

    /** Set => this account is an administrator. */
    permissionGroup: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PermissionGroup',
      default: null,
      index: true,
    },

    /** Segmentation tags used for push targeting. legacy: user_categories_relations_tbl */
    categories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'UserCategory' }],

    /** Last-seen IP, recorded at signup/login. legacy: users_tbl.user_ip */
    userIp: { type: String, default: null },
    /** Acquisition channel. legacy: users_tbl.source */
    source: { type: String, trim: true, default: '' },

    /** Carried from the legacy ISP integration columns. */
    asiatechSub: { type: String, trim: true, default: '' },
    asiatechUsername: { type: String, trim: true, default: '' },

    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true },
);

userSchema.plugin(softDeletePlugin);

/** Hash on create and on any password change. */
userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, env.bcryptRounds);
  return next();
});

userSchema.methods.verifyPassword = function verifyPassword(plain) {
  return bcrypt.compare(plain, this.password);
};

/** True when the account is an administrator. */
userSchema.methods.isAdmin = function isAdmin() {
  return Boolean(this.permissionGroup);
};

export const User = mongoose.model('User', userSchema);
export default User;
