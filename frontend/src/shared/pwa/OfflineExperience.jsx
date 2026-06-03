import { useEffect, useState } from 'react';
import { SystemStatusOverlay } from '../ui/SystemStatusOverlay.jsx';

function getOnlineState() {
  if (typeof navigator === 'undefined') {
    return true;
  }

  return navigator.onLine;
}

export function OfflineExperience() {
  const [isOnline, setIsOnline] = useState(getOnlineState);

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

  if (isOnline) {
    return null;
  }

  return <SystemStatusOverlay variant="offline" zIndex={11000} />;
}
