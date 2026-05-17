function isAuthRoute() {
  const path = window.location.pathname || '';
  return /\/(?:auth\/)?(?:login|register)(?:\/|$)/.test(path) ||
    /\/auth\/(?:forgot-password|reset-password)(?:\/|$)/.test(path);
}

function hasRecentAuthSuccess() {
  const timestamp = Number(window.sessionStorage.getItem('lms_recent_auth_success') || 0);
  return timestamp > 0 && Date.now() - timestamp < 15000;
}

export function installPwaRegistration() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  window.addEventListener('load', () => {
    import('./pushNotifications.js')
      .then(({ registerLmsServiceWorker }) => registerLmsServiceWorker())
      .then((registration) => registration?.update?.())
      .catch(() => {});

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (window.sessionStorage.getItem('lms_sw_reloaded') === '1') return;
      if (isAuthRoute() || hasRecentAuthSuccess()) return;
      window.sessionStorage.setItem('lms_sw_reloaded', '1');
      window.location.reload();
    });
  });
}

export function uninstallPwaRegistration() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  window.addEventListener('load', () => {
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
