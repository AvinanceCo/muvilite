/**
 * Authentication state.
 *
 * Purpose: hold the signed-in administrator and their permissions for the
 *          lifetime of the tab, and be the only place that starts or ends a
 *          session.
 * Inputs:  children
 * Outputs: `{ user, permissions, status, signIn, signOut }` via context
 * Deps:    api/auth, api/client, @tanstack/react-query
 *
 * The token lives in localStorage so a reload does not sign the operator out.
 * On boot the session is CONFIRMED against `GET /admin/auth/me` rather than
 * trusted: a stored token may be expired, or belong to an account that has
 * since been deactivated or had its group changed. Until that call settles the
 * status is `checking`, and the router shows nothing — rendering a route first
 * and correcting afterwards would flash the panel at someone signed out.
 *
 * Permissions come from the server on every check, never from the token: the
 * JWT carries only `sub` and `mobile`. That is what lets a group change take
 * effect on an existing session, which the legacy panel could not do.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import * as authApi from '../api/auth.js';
import { clearToken, getToken, setToken, setUnauthenticatedHandler } from '../api/client.js';

const AuthContext = createContext(null);

/** `checking` -> boot request in flight; then `authenticated` | `anonymous`. */
const STATUS = Object.freeze({
  checking: 'checking',
  authenticated: 'authenticated',
  anonymous: 'anonymous',
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState(getToken() ? STATUS.checking : STATUS.anonymous);
  const queryClient = useQueryClient();

  /**
   * Drops all local session state. Every cached query is discarded too — the
   * next administrator to sign in on this tab must not see the previous one's
   * data, which may include sections they cannot access.
   */
  const forgetSession = useCallback(() => {
    clearToken();
    setUser(null);
    setStatus(STATUS.anonymous);
    queryClient.clear();
  }, [queryClient]);

  // A 401 from anywhere in the app ends the session. Registered once, before
  // the boot request below can fire.
  useEffect(() => {
    setUnauthenticatedHandler(forgetSession);
    return () => setUnauthenticatedHandler(null);
  }, [forgetSession]);

  // Confirm a stored token on boot.
  useEffect(() => {
    if (!getToken()) return undefined;

    let cancelled = false;

    authApi
      .fetchMe()
      .then((me) => {
        if (cancelled) return;
        setUser(me);
        setStatus(STATUS.authenticated);
      })
      .catch(() => {
        // A 401 has already cleared the token through the interceptor; any
        // other failure (the API being down) is treated the same way, because
        // an unverifiable session cannot be trusted.
        if (!cancelled) forgetSession();
      });

    return () => {
      cancelled = true;
    };
  }, [forgetSession]);

  const signIn = useCallback(async (credentials) => {
    const result = await authApi.login(credentials);
    setToken(result.token);
    setUser(result.user);
    setStatus(STATUS.authenticated);
    return result.user;
  }, []);

  const signOut = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // The token is stateless: the server call is only an audit record, so a
      // failure here must not keep the operator signed in.
    }
    forgetSession();
  }, [forgetSession]);

  /** Re-reads the permission set — after changing one's own group, say. */
  const refresh = useCallback(async () => {
    const me = await authApi.fetchMe();
    setUser(me);
    return me;
  }, []);

  const value = useMemo(
    () => ({
      user,
      permissions: user?.permissions ?? {},
      status,
      isAuthenticated: status === STATUS.authenticated,
      isChecking: status === STATUS.checking,
      signIn,
      signOut,
      refresh,
    }),
    [user, status, signIn, signOut, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** @returns {{user: object|null, permissions: object, status: string,
 *             isAuthenticated: boolean, isChecking: boolean,
 *             signIn: Function, signOut: Function, refresh: Function}} */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return context;
}

export { STATUS as AUTH_STATUS };
export default AuthProvider;
