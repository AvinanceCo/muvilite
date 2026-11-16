/**
 * Authorization middleware.
 *
 * Purpose: enforce a permission-group grant before an admin route runs.
 * Inputs:  req.user.permissions (set by middleware/auth.js)
 * Outputs: calls next() or throws 403
 * Deps:    config/constants, utils/ApiError
 *
 * Legacy counterpart: `UserSessionModel::checkActionPermission($page, $type)`,
 * invoked at the top of each admin VIEW file, e.g.
 *   admin/.../views/movies/index.php:26
 * and denying by redirecting to views/users/access_denied.php.
 *
 * Two defects that are not reproduced:
 *
 * 1. The check lived in views only. The `?@=`-dispatched controllers ran with
 *    no authorization at all, so `controllers/UserController.php?@=update` was
 *    reachable by anyone who knew the URL. Mounting the guard on the route
 *    removes that bypass.
 *
 * 2. Some views checked the wrong identifier — views/polls/* checked 'banners',
 *    and views/music-categories/* checked 'categories'/'musics'. Each admin
 *    route here names the section it actually guards.
 */
import { PERMISSION_ACTIONS } from '../config/constants.js';
import ApiError from '../utils/ApiError.js';

/**
 * @param {string} page    an `action_page` identifier, e.g. 'movies'
 * @param {'view'|'edit'|'delete'} action
 */
export const requirePermission = (page, action) => {
  if (!PERMISSION_ACTIONS.includes(action)) {
    // A wiring mistake, caught at startup rather than at request time.
    throw new Error(`Unknown permission action "${action}" for page "${page}"`);
  }

  return (req, _res, next) => {
    const granted = req.user?.permissions?.[page]?.[action];

    if (!granted) {
      return next(ApiError.forbidden(`You do not have "${action}" permission for "${page}"`));
    }

    return next();
  };
};

export default { requirePermission };
