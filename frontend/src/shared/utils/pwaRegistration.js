const SW_RELOAD_THROTTLE_KEY = 'lms_sw_reloaded_at';
const SW_RELOAD_THROTTLE_MS = 10_000;
let registrationListenerInstalled = false;
let serviceWorkerRegistrationStarted = false;

function isAuthRoute() {
  const path = window.location.pathname || '';
  return /\/(?:auth\/)?(?:login|register)(?:\/|$)/.test(path) ||
    /\/auth\/(?:forgot-password|reset-password)(?:\/|$)/.test(path);
}

function hasRecentAuthSuccess() {
  try {
    const timestamp = Number(window.sessionStorage.getItem('lms_recent_auth_success') || 0);
    return timestamp > 0 && Date.now() - timestamp < 15_000;
  } catch {
    return false;
  }
}

function wasServiceWorkerReloadRecent() {
  try {
    const timestamp = Number(window.sessionStorage.getItem(SW_RELOAD_THROTTLE_KEY) || 0);
    return timestamp > 0 && Date.now() - timestamp < SW_RELOAD_THROTTLE_MS;
  } catch {
    return false;
  }
}

function markServiceWorkerReload() {
  try {
    window.sessionStorage.setItem(SW_RELOAD_THROTTLE_KEY, String(Date.now()));
  } catch {
    // If storage is unavailable, still allow the reload; controllerchange is rare.
  }
}

// The app entry executes AFTER the window load event (the module graph
// finishes past it), so a bare load listener never fires and the service
// worker was never registered. Run immediately when the document is already
// loaded, otherwise wait for load.
function runOnWindowLoad(callback) {
  if (document.readyState === 'complete') {
    callback();
    return;
  }
  window.addEventListener('load', callback, { once: true });
}

export function installPwaRegistration() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  if (registrationListenerInstalled) {
    return;
  }

  registrationListenerInstalled = true;
  runOnWindowLoad(() => {
    const registerWhenSafe = () => {
      if (serviceWorkerRegistrationStarted || isAuthRoute()) {
        return;
      }

      serviceWorkerRegistrationStarted = true;
      window.removeEventListener('lms:route-location-change', registerWhenSafe);
      import('./pushNotifications.js')
        .then(({ registerLmsServiceWorker }) => registerLmsServiceWorker())
        .then((registration) => registration?.update?.())
        .catch(() => {});
    };

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (wasServiceWorkerReloadRecent()) return;
      if (isAuthRoute() || hasRecentAuthSuccess()) return;
      markServiceWorkerReload();
      window.location.reload();
    });

    if (isAuthRoute()) {
      window.addEventListener('lms:route-location-change', registerWhenSafe);
      return;
    }

    registerWhenSafe();
  });
}

export function uninstallPwaRegistration() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  runOnWindowLoad(() => {
    navigator.serviceWorker.getRegistrations()
      .then((registrations) => Promise.all(
        registrations.map((registration) => registration.unregister())
      ))
      .catch(() => {});

    if ('caches' in window) {
      caches.keys()
        .then((keys) => Promise.all(
          keys
            .filter((key) => key.toLowerCase().includes('lms'))
            .map((key) => caches.delete(key))
        ))
        .catch(() => {});
    }
  });
}
