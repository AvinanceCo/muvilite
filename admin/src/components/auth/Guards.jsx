/**
 * Route and element guards.
 *
 * Purpose: keep a signed-out visitor off every screen, and keep an
 *          administrator out of sections their group does not grant.
 * Inputs:  children, a permission page key and action
 * Outputs: the children, a redirect, or an access-denied notice
 * Deps:    react-router-dom, context/AuthContext, hooks/usePermissions
 *
 * Legacy counterpart: each view file opened with a `checkPagePermission` call
 * and echoed `views/users/access_denied.php` when it failed — which the
 * `?@=`-dispatched controllers behind those views bypassed entirely. Here the
 * guard wraps the route, and the server enforces the same rule independently.
 *
 * `RequirePermission` deliberately renders a notice rather than redirecting: an
 * operator who followed a link to a section they cannot see should be told
 * that, not silently bounced somewhere else.
 */
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { usePermissions } from '../../hooks/usePermissions.js';
import { Loader } from '../ui/Feedback.jsx';

/** Blocks everything until the boot session check has settled. */
export function RequireAuth({ children }) {
  const { isAuthenticated, isChecking } = useAuth();
  const location = useLocation();

  if (isChecking) {
    return <Loader label="در حال بررسی نشست" />;
  }

  if (!isAuthenticated) {
    // `from` lets the login screen return the operator where they were headed.
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  return children;
}

/** Shown in place of a section the group does not grant. */
export function AccessDenied({ page, action = 'view' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-panel border border-line bg-panel px-6 py-16 text-center">
      <span aria-hidden="true" className="text-3xl">
        🔒
      </span>
      <h2 className="text-lg font-bold text-paper">دسترسی ندارید</h2>
      <p className="max-w-md text-sm text-muted">
        گروه دسترسی شما اجازهٔ «{ACTION_LABELS[action] ?? action}» برای این بخش را ندارد. در صورت
        نیاز از مدیر سامانه بخواهید دسترسی «{page}» را به گروه شما اضافه کند.
      </p>
    </div>
  );
}

const ACTION_LABELS = { view: 'مشاهده', edit: 'ویرایش', delete: 'حذف' };

/**
 * @param {object} props
 * @param {string} props.page   a PERMISSION_PAGES key
 * @param {'view'|'edit'|'delete'} [props.action='view']
 */
export function RequirePermission({ page, action = 'view', children }) {
  const { can } = usePermissions();
  return can(page, action) ? children : <AccessDenied page={page} action={action} />;
}

/**
 * Hides an element — an "add" button, a delete action — when the permission is
 * absent. Renders `fallback` (nothing by default) instead.
 */
export function Can({ page, action = 'view', fallback = null, children }) {
  const { can } = usePermissions();
  return can(page, action) ? children : fallback;
}

export default RequireAuth;
