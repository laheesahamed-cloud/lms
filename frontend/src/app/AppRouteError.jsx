import { Suspense, lazy, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const SystemStatusOverlay = lazy(() =>
  import('../shared/ui/SystemStatusOverlay.jsx').then((module) => ({
    default: module.SystemStatusOverlay,
  }))
);

export function AppRouteError() {
  const navigate = useNavigate();

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      navigate('/dashboard', { replace: true });
    }, 1400);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [navigate]);

  return (
    <Suspense fallback={null}>
      <SystemStatusOverlay variant="route" zIndex={12000} />
    </Suspense>
  );
}
