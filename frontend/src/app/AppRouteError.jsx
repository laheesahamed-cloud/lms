import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

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

  return null;
}
