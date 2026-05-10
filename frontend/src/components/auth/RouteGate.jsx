import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore.js';
import { ui } from '../../styles/tailwindClasses.js';

function GateShell({ label }) {
  return (
    <main className={ui.screenShell}>
      <section className="mx-auto grid w-[min(560px,100%)] gap-3 rounded-xl border border-line-soft bg-surface-glass-strong p-8 text-center shadow-xl backdrop-blur-[18px]">
        <span className={ui.eyebrow}>Auth</span>
        <h1 className="m-0 text-xl font-extrabold text-ink-strong">{label}</h1>
      </section>
    </main>
  );
}

export function ProtectedRoute({ children, role, allowPending = false, requiredFeature = '' }) {
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isHydrating = useAuthStore((state) => state.isHydrating);

  if (isHydrating) {
    return <GateShell label="Checking your session..." />;
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/auth/login" replace />;
  }

  if (role && user.role !== role) {
    return <Navigate to={user.role === 'admin' ? '/dashboard' : user.status === 'active' ? '/dashboard' : '/pending'} replace />;
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
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isHydrating = useAuthStore((state) => state.isHydrating);

  if (isHydrating) {
    return <GateShell label="Loading authentication..." />;
  }

  if (isAuthenticated && user) {
    const nextPath = user.role === 'admin' ? '/dashboard' : user.status === 'active' ? '/dashboard' : '/pending';
    return <Navigate to={nextPath} replace />;
  }

  return children;
}
