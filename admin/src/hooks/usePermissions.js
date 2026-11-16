/**
 * Permission checks.
 *
 * Purpose: answer "may this administrator do X to Y" in one place, correctly.
 * Inputs:  a permission page key and an action
 * Outputs: booleans
 * Deps:    context/AuthContext
 *
 * THE MAP IS SPARSE. A section the administrator has no grant for is absent
 * from `permissions` entirely — it is not present with `{view: false}`. So
 * `permissions[page].view` throws on exactly the accounts that must be denied,
 * and `!permissions[page].view` would look like a passing check while actually
 * being a crash. Always go through these helpers.
 *
 * These gates are a courtesy to the operator, not a security boundary. Every
 * admin route is guarded server-side (backend/MIGRATION.md §6 defect 3 — the
 * legacy controllers checked nothing and were reachable directly), so hiding a
 * button here only spares someone a 403 they would otherwise discover by
 * clicking.
 */
import { useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

/**
 * @returns {{can: (page: string, action?: string) => boolean,
 *            canView: (page: string) => boolean,
 *            canEdit: (page: string) => boolean,
 *            canDelete: (page: string) => boolean,
 *            permissions: object}}
 */
export function usePermissions() {
  const { permissions } = useAuth();

  const can = useCallback(
    (page, action = 'view') => permissions?.[page]?.[action] === true,
    [permissions],
  );

  return useMemo(
    () => ({
      can,
      canView: (page) => can(page, 'view'),
      canEdit: (page) => can(page, 'edit'),
      canDelete: (page) => can(page, 'delete'),
      permissions: permissions ?? {},
    }),
    [can, permissions],
  );
}

export default usePermissions;
