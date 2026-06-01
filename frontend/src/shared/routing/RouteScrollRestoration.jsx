import { useLayoutEffect, useMemo } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

const scrollPositions = new Map();
const MAX_SAVED_SCROLL_POSITIONS = 80;

export const DEFAULT_SCROLL_RESTORATION_EXCLUDED_ROUTES = [
  '/quiz',
  '/question',
  '/exam',
  '/quizzes/:quizId',
  '/quizzes/:quizId/practice-review',
  '/review/:attemptId',
  '/questions/:questionId',
];

function normalizePath(pathname) {
  if (!pathname || pathname === '/') return '/';
  return pathname.replace(/\/+$/, '') || '/';
}

function routePatternToRegExp(pattern) {
  const normalizedPattern = normalizePath(pattern);
  const source = normalizedPattern
    .split('/')
    .filter(Boolean)
    .map((segment) => (segment.startsWith(':') ? '[^/]+' : segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    .join('/');

  return new RegExp(`^/${source}(?:/.*)?$`);
}

function isExcludedRoute(pathname, excludedRoutes) {
  const normalizedPathname = normalizePath(pathname);

  return excludedRoutes.some((route) => {
    const normalizedRoute = normalizePath(route);

    if (normalizedRoute.includes('/:')) {
      return routePatternToRegExp(normalizedRoute).test(normalizedPathname);
    }

    return normalizedPathname === normalizedRoute || normalizedPathname.startsWith(`${normalizedRoute}/`);
  });
}

function getScrollBehavior() {
  const root = typeof document !== 'undefined' ? document.documentElement : null;
  if (root?.dataset?.lmsRuntime === 'native' && root?.dataset?.lmsFormFactor === 'phone') {
    return 'auto';
  }
  const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  return prefersReducedMotion ? 'auto' : 'smooth';
}

function normalizeScrollBehavior(behavior) {
  return behavior === 'auto' || behavior === 'smooth' || behavior === 'instant'
    ? behavior
    : getScrollBehavior();
}

function scrollToPosition(target, { top = 0, left = 0 } = {}, behavior) {
  const safeBehavior = normalizeScrollBehavior(behavior);
  try {
    target.scrollTo({ top, left, behavior: safeBehavior });
    return true;
  } catch {
    try {
      target.scrollTo(left, top);
      return true;
    } catch {
      return false;
    }
  }
}

function scrollElementToPosition(element, position, behavior) {
  if (!element) return;

  const safeBehavior = normalizeScrollBehavior(behavior);
  if (typeof element.scrollTo === 'function') {
    const didScroll = scrollToPosition(element, position, safeBehavior);
    if (didScroll && safeBehavior === 'smooth') return;
  }

  element.scrollTop = position.top || 0;
  element.scrollLeft = position.left || 0;
}

function scrollDocumentToPosition(position = { top: 0, left: 0 }, behavior = getScrollBehavior()) {
  const safeBehavior = normalizeScrollBehavior(behavior);
  const appScrollRoots = document.querySelectorAll('.lms-app-scroll-root, .portal-content, .portal-content__frame');
  const root = document.getElementById('root');

  appScrollRoots.forEach((element) => {
    scrollElementToPosition(element, position, safeBehavior);
  });

  scrollElementToPosition(root, position, safeBehavior);

  scrollToPosition(window, position, safeBehavior);
  if (safeBehavior === 'smooth') return;

  // Keep browser/document scroll roots in sync for iOS/PWA and nested shell layouts.
  document.documentElement.scrollTop = position.top || 0;
  document.documentElement.scrollLeft = position.left || 0;
  document.body.scrollTop = position.top || 0;
  document.body.scrollLeft = position.left || 0;
}

function getPrimaryScrollTarget() {
  const candidates = [
    document.querySelector('.lms-app-scroll-root'),
    document.querySelector('.portal-content__frame'),
    document.querySelector('.portal-content'),
    document.scrollingElement,
    document.documentElement,
    document.body,
  ].filter(Boolean);

  return candidates.find((element) => element.scrollHeight > element.clientHeight) ||
    document.scrollingElement ||
    document.documentElement;
}

function getScrollPosition() {
  const target = getPrimaryScrollTarget();
  if (target === document.body || target === document.documentElement || target === document.scrollingElement) {
    return {
      top: window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0,
      left: window.scrollX || document.documentElement.scrollLeft || document.body.scrollLeft || 0,
    };
  }

  return {
    top: target?.scrollTop || 0,
    left: target?.scrollLeft || 0,
  };
}

function scheduleScrollPosition(position, behavior = 'auto') {
  const nativePhone = document.documentElement?.dataset?.lmsRuntime === 'native' &&
    document.documentElement?.dataset?.lmsFormFactor === 'phone';
  const frameIds = [];
  const timeoutIds = [];
  const scrollNow = () => scrollDocumentToPosition(position, behavior);

  scrollNow();

  const frameOne = window.requestAnimationFrame(() => {
    scrollNow();
    if (!nativePhone) {
      const frameTwo = window.requestAnimationFrame(scrollNow);
      frameIds.push(frameTwo);
    }
  });
  frameIds.push(frameOne);
  timeoutIds.push(window.setTimeout(scrollNow, nativePhone ? 80 : 120));

  return () => {
    frameIds.forEach((frameId) => window.cancelAnimationFrame(frameId));
    timeoutIds.forEach((timerId) => window.clearTimeout(timerId));
  };
}

function scheduleScrollToTop() {
  return scheduleScrollPosition({ top: 0, left: 0 }, 'auto');
}

function pruneScrollPositions() {
  while (scrollPositions.size > MAX_SAVED_SCROLL_POSITIONS) {
    const oldestKey = scrollPositions.keys().next().value;
    scrollPositions.delete(oldestKey);
  }
}

export function RouteScrollRestoration({
  excludedRoutes = DEFAULT_SCROLL_RESTORATION_EXCLUDED_ROUTES,
}) {
  const { key, pathname, search } = useLocation();
  const navigationType = useNavigationType();
  const excludedRouteSet = useMemo(() => excludedRoutes, [excludedRoutes]);

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;
    const routeKey = key || `${pathname}${search}`;
    const savedPosition = scrollPositions.get(routeKey);
    const excludedRoute = isExcludedRoute(pathname, excludedRouteSet);
    let cancelScheduledScroll = () => {};

    if (navigationType === 'POP' && savedPosition) {
      cancelScheduledScroll = scheduleScrollPosition(savedPosition, 'auto');
    } else if (!excludedRoute && navigationType !== 'POP') {
      // Run before paint and again after route content mounts. WKWebView can apply
      // the previous scroll position after the first layout pass on heavier pages.
      cancelScheduledScroll = scheduleScrollToTop();
    }

    return () => {
      cancelScheduledScroll();
      scrollPositions.set(routeKey, getScrollPosition());
      pruneScrollPositions();
    };
  }, [key, navigationType, pathname, search, excludedRouteSet]);

  return null;
}
