import { useEffect } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore.js';
import { canonicalizeForwardPathForUser, getSafeForwardPath } from '../utils/routeForwarding.js';
import { isStaffUser, userHasPermissions } from './roleAccess.js';
import { SystemStatusOverlay } from '../ui/SystemStatusOverlay.jsx';

function SessionExpiredLock({ lock }) {
  const location = useLocation();
  const navigate = useNavigate();
  const clearSessionExpiredLock = useAuthStore((state) => state.clearSessionExpiredLock);
  const from = getSafeForwardPath(
    lock?.from || `${location.pathname}${location.search}${location.hash}`,
    `${location.pathname}${location.search}${location.hash}`
  );
  const loginTarget = `/auth/login?from=${encodeURIComponent(from || '/')}`;

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      clearSessionExpiredLock();
      navigate(loginTarget, { replace: true });
    }, 1200);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [clearSessionExpiredLock, loginTarget, navigate]);

  return <SystemStatusOverlay variant="session" zIndex={12000} />;
}

function getSafeFromPath(location) {
  const from = new URLSearchParams(location.search).get('from');
  return getSafeForwardPath(from);
}

function getRoleHome(user) {
  if (isStaffUser(user)) return '/admin/dashboard';
  if (user?.role === 'student' && user.status !== 'active') return '/pending';
  return '/dashboard';
}

export function ProtectedRoute({ children, role, allowPending = false, requiredFeature = '', requiredPermissions = [] }) {
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isHydrating = useAuthStore((state) => state.isHydrating);
  const sessionExpiredLock = useAuthStore((state) => state.sessionExpiredLock);

  if (isHydrating) {
    return <SystemStatusOverlay variant="auth" zIndex={9000} />;
  }

  if (!isAuthenticated || !user) {
    if (sessionExpiredLock) {
      return <SessionExpiredLock lock={sessionExpiredLock} />;
    }

    const from = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/auth/login?from=${encodeURIComponent(from)}`} replace />;
  }

  if (role === 'admin' && !isStaffUser(user)) {
    return <Navigate to={getRoleHome(user)} replace />;
  }

  if (role && role !== 'admin' && user.role !== role && !isStaffUser(user)) {
    return <Navigate to={getRoleHome(user)} replace />;
  }

  if (role === 'admin' && requiredPermissions.length && !userHasPermissions(user, requiredPermissions)) {
    return <Navigate to={getRoleHome(user)} replace />;
  }

  if (user.role === 'student' && !allowPending && user.status !== 'active') {
    return <Navigate to="/pending" replace />;
  }

  if (user.role === 'student' && allowPending && user.status === 'active' && location.pathname === '/pending') {
    return <Navigate to="/dashboard" replace />;
  }

  if (user.role === 'student') {
    if (requiredFeature && !user.featureAccess?.[requiredFeature]) {
      return <Navigate to="/subscriptions" replace state={{ lockedFeature: requiredFeature, from: location.pathname }} />;
    }
  }

  return children;
}

export function PublicOnlyRoute({ children }) {
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isHydrating = useAuthStore((state) => state.isHydrating);

  if (isHydrating && (isAuthenticated || user)) {
    return <SystemStatusOverlay variant="auth" zIndex={9000} />;
  }

  if (isAuthenticated && user) {
    const requestedPath = canonicalizeForwardPathForUser(getSafeFromPath(location), user);
    const nextPath = requestedPath || getRoleHome(user);
    return <Navigate to={nextPath} replace />;
  }

  return children;
}
