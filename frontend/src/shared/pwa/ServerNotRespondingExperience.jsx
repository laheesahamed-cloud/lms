import { useEffect, useState } from 'react';
import { getServerNotRespondingState, subscribeToServerStatus } from '../stores/serverStatusStore.js';
import { SystemStatusOverlay } from '../ui/SystemStatusOverlay.jsx';
import { isPublicWebsiteRoute } from '../routing/publicRoutes.js';

function getOnlineState() {
  if (typeof navigator === 'undefined') {
    return true;
  }

  return navigator.onLine;
}

export function ServerNotRespondingExperience() {
  const [visible, setVisible] = useState(() => getServerNotRespondingState());
  const [isOnline, setIsOnline] = useState(getOnlineState);
  const [isPublicRoute, setIsPublicRoute] = useState(() => (
    typeof window !== 'undefined' && isPublicWebsiteRoute(window.location?.pathname || '/')
  ));

  useEffect(() => subscribeToServerStatus(setVisible), []);

  useEffect(() => {
    function handleOnlineStatus() {
      setIsOnline(getOnlineState());
    }

    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOnlineStatus);

    return () => {
      window.removeEventListener('online', handleOnlineStatus);
      window.removeEventListener('offline', handleOnlineStatus);
    };
  }, []);

  useEffect(() => {
    function syncRouteState() {
      setIsPublicRoute(isPublicWebsiteRoute(window.location?.pathname || '/'));
    }

    window.addEventListener('popstate', syncRouteState);
    window.addEventListener('lms:route-location-change', syncRouteState);
    syncRouteState();

    return () => {
      window.removeEventListener('popstate', syncRouteState);
      window.removeEventListener('lms:route-location-change', syncRouteState);
    };
  }, []);

  if (!visible || !isOnline || isPublicRoute) {
    return null;
  }

  return <SystemStatusOverlay variant="server" zIndex={10000} />;
}
