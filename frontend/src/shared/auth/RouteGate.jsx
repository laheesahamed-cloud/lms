import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore.js';
import { canonicalizeForwardPathForUser, getSafeForwardPath } from '../utils/routeForwarding.js';
import { isStaffUser, userHasPermissions } from './roleAccess.js';

const gateUi = {
  screenShell:
    'lms-route-page page page-wrapper page-content app-content w-full max-w-full min-w-0 overflow-x-hidden px-page-x pb-page-y pt-page-y text-ink-strong max-[520px]:px-3.5 max-[520px]:pb-[var(--lms-mobile-content-bottom)] max-[520px]:pt-3.5',
  eyebrow:
    'inline-block text-[11px] font-extrabold uppercase tracking-[0.13em] text-brand-primary opacity-90',
};

function GateShell({ label }) {
  return (
    <main className={gateUi.screenShell}>
      <section className="mx-auto grid w-[min(560px,100%)] gap-3 rounded-xl border border-line-soft bg-surface-glass-strong p-8 text-center shadow-xl backdrop-blur-[18px]">
        <span className={gateUi.eyebrow}>Auth</span>
        <h1 className="m-0 text-xl font-extrabold text-ink-strong">{label}</h1>
      </section>
    </main>
  );
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

  if (isHydrating) {
    return <GateShell label="Checking your session..." />;
  }

  if (!isAuthenticated || !user) {
    const from = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/auth/login?from=${encodeURIComponent(from)}`} replace />;
  }

  if (role === 'admin' && !isStaffUser(user)) {
    return <Navigate to={getRoleHome(user)} replace />;
  }

  if (role && role !== 'admin' && user.role !== role) {
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

  if (isHydrating) {
    return <GateShell label="Loading authentication..." />;
  }

  if (isAuthenticated && user) {
    const requestedPath = canonicalizeForwardPathForUser(getSafeFromPath(location), user);
    const nextPath = requestedPath || getRoleHome(user);
    return <Navigate to={nextPath} replace />;
  }

  return children;
}
