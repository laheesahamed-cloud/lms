import { useEffect, useState } from 'react';
import { getServerNotRespondingState, subscribeToServerStatus } from '../stores/serverStatusStore.js';
import { SystemStatusOverlay } from '../ui/SystemStatusOverlay.jsx';

function getOnlineState() {
  if (typeof navigator === 'undefined') {
    return true;
  }

  return navigator.onLine;
}

export function ServerNotRespondingExperience() {
  const [visible, setVisible] = useState(() => getServerNotRespondingState());
  const [isOnline, setIsOnline] = useState(getOnlineState);

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

  if (!visible || !isOnline) {
    return null;
  }

  return <SystemStatusOverlay variant="server" zIndex={10000} />;
}
