import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SystemStatusOverlay } from '../shared/ui/SystemStatusOverlay.jsx';

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

  return <SystemStatusOverlay variant="route" zIndex={12000} />;
}
