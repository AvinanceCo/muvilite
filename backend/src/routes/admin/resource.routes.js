/**
 * Generic admin resource router factory.
 *
 * Purpose: mount the standard CRUD endpoints for an entity, each behind the
 *          permission its section requires.
 * Inputs:  a controller, a permission page name, and validator chains
 * Outputs: an Express router
 * Deps:    middleware/{permission,validate}, validators/common
 *
 * Permission mapping mirrors access_permission_tbl:
 *   GET    -> action_view
 *   POST   -> action_edit
 *   PUT    -> action_edit
 *   PATCH  -> action_edit
 *   DELETE -> action_delete
 *
 * The legacy panel checked these inside view files only, leaving the
 * `?@=`-dispatched controllers unguarded. Mounting them here removes that gap.
 */
import { Router } from 'express';
import { requirePermission } from '../../middleware/permission.js';
import validate from '../../middleware/validate.js';
import {
  objectIdParam,
  paginationQuery,
  sortQuery,
} from '../../validators/common.validators.js';
import { statusRules } from '../../validators/common.write.validators.js';

/**
 * @param {object} config
 * @param {string} config.page        permission identifier, e.g. 'movies'
 * @param {object} config.controller  produced by createCrudController
 * @param {import('express-validator').ValidationChain[]} [config.createRules]
 * @param {import('express-validator').ValidationChain[]} [config.updateRules]
 * @param {import('express-validator').ValidationChain[]} [config.listRules]
 */
export function createResourceRouter({
  page,
  controller,
  createRules = [],
  updateRules = [],
  listRules = [],
}) {
  const router = Router();

  router.get(
    '/',
    requirePermission(page, 'view'),
    validate([...paginationQuery, ...sortQuery, ...listRules]),
    controller.list,
  );

  router.get('/:id', requirePermission(page, 'view'), validate([objectIdParam()]), controller.get);

  router.post('/', requirePermission(page, 'edit'), validate(createRules), controller.create);

  router.put(
    '/:id',
    requirePermission(page, 'edit'),
    validate([objectIdParam(), ...updateRules]),
    controller.update,
  );

  router.patch(
    '/:id/status',
    requirePermission(page, 'edit'),
    validate([objectIdParam(), ...statusRules]),
    controller.setStatus,
  );

  router.delete(
    '/:id',
    requirePermission(page, 'delete'),
    validate([objectIdParam()]),
    controller.remove,
  );

  return router;
}

export default createResourceRouter;
