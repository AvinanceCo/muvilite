/**
 * Authentication validators.
 *
 * Purpose: validate credential and password-change payloads.
 * Inputs:  none
 * Outputs: express-validator chains
 * Deps:    express-validator
 *
 * The legacy panel enforced only `strlen($password) >= 6` on write and nothing
 * at all on login.
 */
import { body } from 'express-validator';

/** Minimum length. The legacy rule was 6; kept, since it is a real constraint
 *  on existing accounts and raising it would lock people out. */
const MIN_PASSWORD_LENGTH = 6;

export const loginRules = [
  body('mobile')
    .isString()
    .trim()
    .isLength({ min: 10, max: 20 })
    .withMessage('"mobile" must be a valid mobile number'),
  body('password').isString().notEmpty().withMessage('"password" is required'),
];

export const changePasswordRules = [
  body('currentPassword').isString().notEmpty().withMessage('"currentPassword" is required'),
  body('newPassword')
    .isString()
    .isLength({ min: MIN_PASSWORD_LENGTH })
    .withMessage(`"newPassword" must be at least ${MIN_PASSWORD_LENGTH} characters`),
];

export { MIN_PASSWORD_LENGTH };
export default { loginRules, changePasswordRules, MIN_PASSWORD_LENGTH };
