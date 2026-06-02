import { detectPlatform } from '../platform/detect.js';
import { getRouterBasename } from '../platform/config.js';

const SPA_NAVIGATION_EVENT = 'lms:spa-navigate';

function normalizeBasename(value) {
  const basename = String(value || '/').replace(/\/+$/, '');
  return basename || '/';
}

function getSameOriginUrl(to) {
  if (typeof window === 'undefined') return null;

  try {
    const url = new URL(String(to || '/'), window.location.origin);
    return url.origin === window.location.origin ? url : null;
  } catch {
    return null;
  }
}

export function getRouterPathFromBrowserPath(to, platform = detectPlatform()) {
  const url = getSameOriginUrl(to);
  if (!url) return '';

  const basename = normalizeBasename(getRouterBasename(platform));
  let pathname = url.pathname || '/';

  if (basename !== '/') {
    if (pathname === basename) {
      pathname = '/';
    } else if (pathname.startsWith(`${basename}/`)) {
      pathname = pathname.slice(basename.length) || '/';
    }
  }

  return `${pathname}${url.search}${url.hash}` || '/';
}

export function getBrowserPathFromRouterPath(to, platform = detectPlatform()) {
  const url = getSameOriginUrl(to);
  if (!url) return '';

  const basename = normalizeBasename(getRouterBasename(platform));
  let pathname = url.pathname || '/';

  if (basename !== '/' && pathname !== basename && !pathname.startsWith(`${basename}/`)) {
    pathname = `${basename}${pathname === '/' ? '' : pathname}`;
  }

  return `${pathname || '/'}${url.search}${url.hash}`;
}

export function requestSpaNavigation(to, { replace = false, state = null } = {}) {
  if (typeof window === 'undefined') return false;

  const browserPath = getBrowserPathFromRouterPath(to);
  const routerPath = getRouterPathFromBrowserPath(browserPath);
  if (!browserPath || !routerPath) return false;

  const event = new CustomEvent(SPA_NAVIGATION_EVENT, {
    cancelable: true,
    detail: {
      to: routerPath,
      replace: Boolean(replace),
      state,
    },
  });

  window.dispatchEvent(event);
  if (event.defaultPrevented) return true;

  const historyMethod = replace ? 'replaceState' : 'pushState';
  window.history?.[historyMethod]?.(state, '', browserPath);
  const popStateEvent = typeof PopStateEvent === 'function'
    ? new PopStateEvent('popstate', { state })
    : new Event('popstate');
  window.dispatchEvent(popStateEvent);
  return true;
}

export function installSpaNavigationHandler(navigate) {
  if (typeof window === 'undefined' || typeof navigate !== 'function') {
    return () => {};
  }

  function handleSpaNavigation(event) {
    const routerPath = getRouterPathFromBrowserPath(event?.detail?.to || '/');
    if (!routerPath) return;

    event.preventDefault();
    navigate(routerPath, {
      replace: Boolean(event.detail?.replace),
      state: event.detail?.state ?? undefined,
    });
  }

  window.addEventListener(SPA_NAVIGATION_EVENT, handleSpaNavigation);
  return () => window.removeEventListener(SPA_NAVIGATION_EVENT, handleSpaNavigation);
}
