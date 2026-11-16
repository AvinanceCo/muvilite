/**
 * Shared write-side validation chains.
 *
 * Purpose: fragments reused across the admin entity validators.
 * Inputs:  none
 * Outputs: express-validator chains and builders
 * Deps:    express-validator
 */
import { body, query } from 'express-validator';

/** PATCH /:id/status body. legacy: the `?@=status` toggle. */
export const statusRules = [
  body('isActive').isBoolean().withMessage('"isActive" must be a boolean').toBoolean(),
];

/** A required, trimmed, length-bounded string field. */
export const requiredText = (field, { max = 255, label = field } = {}) =>
  body(field)
    .isString()
    .trim()
    .isLength({ min: 1, max })
    .withMessage(`"${label}" is required and must be at most ${max} characters`);

/** An optional, trimmed, length-bounded string field. */
export const optionalText = (field, { max = 255, label = field } = {}) =>
  body(field)
    .optional({ values: 'falsy' })
    .isString()
    .trim()
    .isLength({ max })
    .withMessage(`"${label}" must be at most ${max} characters`);

/** An optional long-form text field. */
export const optionalLongText = (field, { max = 20_000 } = {}) =>
  body(field).optional({ values: 'falsy' }).isString().isLength({ max });

/** An optional ObjectId reference; empty string and null both mean "unset". */
export const optionalObjectId = (field) =>
  body(field)
    .optional({ values: 'null' })
    .custom((value) => value === '' || value === null || /^[0-9a-fA-F]{24}$/.test(value))
    .withMessage(`"${field}" must be a valid id`)
    .customSanitizer((value) => (value === '' ? null : value));

/** A required ObjectId reference. */
export const requiredObjectId = (field) =>
  body(field).isMongoId().withMessage(`"${field}" must be a valid id`);

/** An optional non-negative integer. Empty input coerces to 0, as the legacy
 *  movie form did for price, price_discount and movie_length. */
export const optionalNonNegativeInt = (field, { max = 1_000_000_000 } = {}) =>
  body(field)
    .optional({ values: 'falsy' })
    .isInt({ min: 0, max })
    .withMessage(`"${field}" must be a non-negative integer`)
    .toInt();

/** A free-text list filter. */
export const textFilter = (name) => query(name).optional().isString().trim().isLength({ max: 200 });

/** An active/inactive list filter. */
export const statusFilter = query('isActive').optional().isBoolean().toBoolean();

export default {
  statusRules,
  requiredText,
  optionalText,
  optionalLongText,
  optionalObjectId,
  requiredObjectId,
  optionalNonNegativeInt,
  textFilter,
  statusFilter,
};
