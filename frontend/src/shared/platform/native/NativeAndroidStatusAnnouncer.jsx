import { useEffect, useRef, useState } from 'react';
import { detectPlatform } from '../detect.js';

const PLATFORM = detectPlatform();
const RESTORE_CLEAR_MS = 3200;

function getNetworkState() {
  if (typeof navigator === 'undefined') return 'online';
  return navigator.onLine ? 'online' : 'offline';
}

export function NativeAndroidStatusAnnouncer() {
  const [networkState, setNetworkState] = useState(getNetworkState);
  const clearTimerRef = useRef(0);

  useEffect(() => {
    if (!PLATFORM.isNative || !PLATFORM.isAndroid || typeof window === 'undefined' || typeof document === 'undefined') {
      return undefined;
    }

    function clearRestoreTimer() {
      if (!clearTimerRef.current) return;
      window.clearTimeout(clearTimerRef.current);
      clearTimerRef.current = 0;
    }

    function syncNetworkState() {
      clearRestoreTimer();
      const nextState = getNetworkState();
      document.documentElement.dataset.lmsNetwork = nextState;

      if (nextState === 'offline') {
        setNetworkState('offline');
        window.dispatchEvent(new CustomEvent('lms:native-network-state', { detail: { online: false } }));
        return;
      }

      setNetworkState((current) => (current === 'offline' ? 'restored' : 'online'));
      window.dispatchEvent(new CustomEvent('lms:native-network-state', { detail: { online: true } }));
      clearTimerRef.current = window.setTimeout(() => {
        clearTimerRef.current = 0;
        setNetworkState('online');
      }, RESTORE_CLEAR_MS);
    }

    syncNetworkState();
    window.addEventListener('online', syncNetworkState);
    window.addEventListener('offline', syncNetworkState);

    return () => {
      clearRestoreTimer();
      window.removeEventListener('online', syncNetworkState);
      window.removeEventListener('offline', syncNetworkState);
      delete document.documentElement.dataset.lmsNetwork;
    };
  }, []);

  if (!PLATFORM.isNative || !PLATFORM.isAndroid || networkState === 'online') {
    return null;
  }

  const message = networkState === 'offline'
    ? 'Offline - active work saves on this device'
    : 'Back online - syncing saved work';

  return (
    <div className={`lms-native-network-status is-${networkState}`} role="status" aria-live="polite">
      {message}
    </div>
  );
}
