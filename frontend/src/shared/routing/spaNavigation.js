import { getSafeForwardPath } from '../utils/routeForwarding.js';
import { withRouterBasename } from '../platform/config.js';

export const SPA_NAVIGATION_EVENT = 'lms:spa-navigate';

export function normalizeSpaNavigationPath(path, fallback = '') {
  return getSafeForwardPath(path, fallback);
}

export function requestSpaNavigation(path, { replace = false } = {}) {
  if (typeof window === 'undefined') return false;

  const target = normalizeSpaNavigationPath(path);
  if (!target) return false;

  const event = new CustomEvent(SPA_NAVIGATION_EVENT, {
    cancelable: true,
    detail: {
      to: target,
      replace: Boolean(replace),
    },
  });
  window.dispatchEvent(event);
  if (event.defaultPrevented) return true;

  const browserTarget = withRouterBasename(target);
  const currentPath = `${window.location.pathname || '/'}${window.location.search || ''}${window.location.hash || ''}`;
  if (currentPath !== browserTarget) {
    window.history?.[replace ? 'replaceState' : 'pushState']?.(window.history.state, '', browserTarget);
    const popStateEvent = typeof PopStateEvent === 'function'
      ? new PopStateEvent('popstate', { state: window.history.state })
      : new Event('popstate');
    window.dispatchEvent(popStateEvent);
  }

  return true;
}
