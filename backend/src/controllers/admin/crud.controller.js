/**
 * Generic admin CRUD controller factory.
 *
 * Purpose: bind a CRUD service to the standard set of REST handlers.
 * Inputs:  a service produced by createCrudService
 * Outputs: Express handlers
 * Deps:    express-validator, utils/{apiResponse,asyncHandler,clientInfo}
 */
import { matchedData } from 'express-validator';
import { sendSuccess, sendCreated } from '../../utils/apiResponse.js';
import asyncHandler from '../../utils/asyncHandler.js';
import { getClientIp } from '../../utils/clientInfo.js';

/** Actor details attached to every audited write. */
export const auditContext = (req) => ({
  userId: req.user.id,
  userIp: getClientIp(req),
});

/**
 * The request body, cut down to the fields this route's rules DECLARE.
 *
 * A write is `$set` from whatever the service is handed, so handing it
 * `req.body` whole meant a save could carry any path the schema has — a movie's
 * `videoPath` or `visitCount`, any record's `isDeleted` — whether or not a rule
 * existed for it. The rules were only ever checking the fields they named; this
 * makes them the list of fields that can be written at all, which is what the
 * comments beside several of them (services/admin/registry.js, validators/
 * admin.validators.js) already said they were.
 *
 * WHICH fields comes from the validators; the VALUES still come from `req.body`.
 * That distinction is deliberate. `matchedData()`'s values leave out an optional
 * field that was sent empty, so using them would turn "clear this field" — an
 * empty string in a PUT — into "leave it alone", and every form in the panel
 * clears fields that way. Sanitizers have already written their coerced values
 * back into `req.body`, so nothing is lost by reading it there.
 *
 * Only top-level keys are filtered. The nested shapes these routes accept
 * (`platform.*`, `categories.*`, `permissions.*`, `grants`) are each validated
 * element by element by their own rules.
 *
 * A NEW FIELD THEREFORE NEEDS A RULE, or it will be dropped here without a
 * word. That is the intended failure: a field with no rule is a field nobody
 * decided an administrator may set.
 *
 * @param {import('express').Request} req after `validate()` has run
 * @returns {object}
 */
export function declaredBody(req) {
  const declared = Object.keys(matchedData(req, { locations: ['body'], includeOptionals: true }));
  const body = req.body ?? {};

  return Object.fromEntries(
    declared.filter((field) => Object.hasOwn(body, field)).map((field) => [field, body[field]]),
  );
}

export function createCrudController(service) {
  return {
    /** GET / */
    list: asyncHandler(async (req, res) => {
      const { items, meta } = await service.list(req.query);
      return sendSuccess(res, items, { meta });
    }),

    /** GET /:id */
    get: asyncHandler(async (req, res) => sendSuccess(res, await service.getById(req.params.id))),

    /** POST / */
    create: asyncHandler(async (req, res) =>
      sendCreated(res, await service.create(declaredBody(req), auditContext(req))),
    ),

    /** PUT /:id */
    update: asyncHandler(async (req, res) =>
      sendSuccess(res, await service.update(req.params.id, declaredBody(req), auditContext(req)), {
        message: 'Updated',
      }),
    ),

    /** PATCH /:id/status */
    setStatus: asyncHandler(async (req, res) =>
      sendSuccess(res, await service.setStatus(req.params.id, req.body.isActive, auditContext(req)), {
        message: 'Status updated',
      }),
    ),

    /** DELETE /:id */
    remove: asyncHandler(async (req, res) =>
      sendSuccess(res, await service.remove(req.params.id, auditContext(req)), {
        message: 'Deleted',
      }),
    ),
  };
}

export default createCrudController;
