import { useEffect } from 'react';
import { useAuthStore } from '../shared/stores/authStore.js';
import { clearServerNotResponding } from '../shared/stores/serverStatusStore.js';

function isApiFreePreviewRoute() {
  if (typeof window === 'undefined') {
    return false;
  }

  const routeText = `${window.location.pathname || ''}${window.location.hash || ''}`;
  return /\/mascot-animation-lab(?:\/|$)/.test(routeText);
}

export function AuthBootstrap({ children }) {
  useEffect(() => {
    if (isApiFreePreviewRoute()) {
      clearServerNotResponding();
      if (useAuthStore.getState().isHydrating) {
        useAuthStore.setState({ isHydrating: false });
      }
      return;
    }

    useAuthStore.getState().hydrate();
  }, []);

  return children;
}
