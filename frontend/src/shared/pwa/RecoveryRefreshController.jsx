import { useEffect, useRef, useState } from 'react';
import { API_BASE_URL } from '../api/client.js';
import { clearServerNotResponding, getServerNotRespondingState, subscribeToServerStatus } from '../stores/serverStatusStore.js';

const HEALTH_CHECK_INTERVAL_MS = 2200;

function isNoAutoRefreshRoute() {
  if (typeof window === 'undefined') {
    return false;
  }

  const routeText = `${window.location.pathname || ''}${window.location.hash || ''}`;
  return /\/ai-notes(?:\/|$)/.test(routeText) ||
    /\/(?:auth\/)?(?:login|register)(?:\/|$)/.test(routeText) ||
    /\/auth\/(?:forgot-password|reset-password)(?:\/|$)/.test(routeText);
}

function hasRecentAuthSuccess() {
  if (typeof window === 'undefined') {
    return false;
  }

  let timestamp = 0;
  try {
    timestamp = Number(window.sessionStorage.getItem('lms_recent_auth_success') || 0);
  } catch {
    return true;
  }
  return timestamp > 0 && Date.now() - timestamp < 15000;
}

async function pingHealth() {
  const response = await fetch(`${API_BASE_URL}/health`, {
    method: 'GET',
    cache: 'no-store',
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Health check failed');
  }

  return response.json();
}

export function RecoveryRefreshController() {
  const [isOnline, setIsOnline] = useState(() => {
    if (typeof navigator === 'undefined') {
      return true;
    }

    return navigator.onLine;
  });
  const [serverNotResponding, setServerNotResponding] = useState(() => getServerNotRespondingState());
  const recoveryNeededRef = useRef(false);
  const reloadingRef = useRef(false);

  useEffect(() => subscribeToServerStatus(setServerNotResponding), []);

  useEffect(() => {
    function handleOnlineStatus() {
      setIsOnline(navigator.onLine);
    }

    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOnlineStatus);

    return () => {
      window.removeEventListener('online', handleOnlineStatus);
      window.removeEventListener('offline', handleOnlineStatus);
    };
  }, []);

  useEffect(() => {
    if (isNoAutoRefreshRoute()) {
      clearServerNotResponding();
      recoveryNeededRef.current = false;
      return;
    }

    if (!isOnline || serverNotResponding) {
      recoveryNeededRef.current = true;
    }
  }, [isOnline, serverNotResponding]);

  useEffect(() => {
    if (isNoAutoRefreshRoute() || hasRecentAuthSuccess() || !recoveryNeededRef.current || reloadingRef.current) {
      return undefined;
    }

    if (!isOnline) {
      return undefined;
    }

    let cancelled = false;

    async function attemptRecovery() {
      try {
        await pingHealth();

        if (cancelled || reloadingRef.current) {
          return;
        }

        clearServerNotResponding();
        reloadingRef.current = true;
        window.location.reload();
      } catch {
        if (cancelled) {
          return;
        }
      }
    }

    attemptRecovery();
    const intervalId = window.setInterval(attemptRecovery, HEALTH_CHECK_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [isOnline, serverNotResponding]);

  return null;
}
