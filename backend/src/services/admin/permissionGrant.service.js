/**
 * Permission grant resolution.
 *
 * Purpose: turn the section x action matrix the group editor submits into the
 *          AccessPermission documents a group actually references, and read an
 *          existing group back as that same matrix.
 * Inputs:  a `grants` object, `{ movies: {view, edit, delete}, … }`
 * Outputs: an array of AccessPermission ids
 * Deps:    repositories/accessPermission, config/constants
 *
 * WHY THIS EXISTS. A group's access is stored the legacy way — as a set of
 * references to `access_permission_tbl` rows, each row naming one section and
 * the actions allowed on it — and the seeded rows grant all three actions at
 * once ("Full access: movies"). So the group editor could only ever hand out a
 * whole section: there was no way to give a group VIEW on movies without also
 * giving it EDIT and DELETE, because no row expressed that combination.
 *
 * The editor now submits the matrix directly and this resolves each row of it:
 *
 *   1. a section with no action ticked contributes nothing;
 *   2. otherwise an existing, non-deleted permission row granting EXACTLY that
 *      combination is reused — which keeps the seeded "Full access: …" rows in
 *      use whenever all three boxes are ticked;
 *   3. only when no such row exists is one created.
 *
 * Reuse before creation is what stops the access-permission list from filling
 * up with near-duplicates: there are at most seven useful combinations per
 * section, and in practice a deployment uses two or three.
 *
 * Effective access is unchanged by any of this — `resolvePermissions` in
 * services/auth.service.js ORs the flags of every row a group holds, so a group
 * that used to hold one all-three row and now holds one all-three row resolves
 * identically.
 */
import { accessPermissionRepository } from '../../repositories/index.js';
import { PERMISSION_PAGES, PERMISSION_ACTIONS } from '../../config/constants.js';

/** Matrix action -> the AccessPermission field that stores it. */
const FLAG_FIELD = Object.freeze({
  view: 'actionView',
  edit: 'actionEdit',
  delete: 'actionDelete',
});

/**
 * The display name given to a row this service has to create.
 * Deliberately mechanical — "movies: view, edit" — so a generated row is
 * recognisable as such next to the hand-named ones an operator creates on the
 * access-permission screen.
 */
function describe(page, actions) {
  return `${page}: ${actions.join(', ')}`;
}

/**
 * Flattens the permission rows a group holds into the editor's matrix.
 *
 * The same OR the authorization resolver applies, so overlapping rows — two
 * rows for one section, which the legacy panel allowed — show up as the single
 * effective grant rather than as a puzzle.
 *
 * @param {object[]} permissions populated AccessPermission documents
 * @returns {Record<string, {view: boolean, edit: boolean, delete: boolean}>}
 */
export function grantsFromPermissions(permissions = []) {
  const grants = {};

  for (const permission of permissions) {
    const page = permission?.actionPage;
    if (!page) continue;

    grants[page] ??= { view: false, edit: false, delete: false };
    for (const action of PERMISSION_ACTIONS) {
      grants[page][action] ||= Boolean(permission[FLAG_FIELD[action]]);
    }
  }

  return grants;
}

/**
 * Resolves the editor's matrix to the permission ids a group should reference,
 * creating rows for combinations that do not exist yet.
 *
 * @param {Record<string, {view?: boolean, edit?: boolean, delete?: boolean}>} grants
 * @returns {Promise<string[]>} AccessPermission ids
 */
export async function resolveGrants(grants = {}) {
  const ids = [];

  // Driven by PERMISSION_PAGES rather than by the payload's own keys, so an
  // unknown section cannot smuggle a row in past the validator.
  for (const page of PERMISSION_PAGES) {
    const wanted = grants[page];
    if (!wanted) continue;

    const actions = PERMISSION_ACTIONS.filter((action) => wanted[action] === true);
    if (actions.length === 0) continue;

    // The exact combination, expressed as the row's own fields — every flag is
    // pinned, so a row granting MORE than was asked for is not a match.
    const flags = Object.fromEntries(
      PERMISSION_ACTIONS.map((action) => [FLAG_FIELD[action], actions.includes(action)]),
    );

    const existing = await accessPermissionRepository.findOne(
      accessPermissionRepository.adminScope({ actionPage: page, ...flags }),
    );

    if (existing) {
      ids.push(existing._id);
      continue;
    }

    const created = await accessPermissionRepository.create({
      displayName: describe(page, actions),
      actionPage: page,
      ...flags,
    });

    ids.push(created._id);
  }

  return ids;
}

export default { resolveGrants, grantsFromPermissions };
