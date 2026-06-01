import { useLayoutEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';

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

function scrollToTop(target, behavior) {
  const safeBehavior = normalizeScrollBehavior(behavior);
  try {
    target.scrollTo({ top: 0, left: 0, behavior: safeBehavior });
    return true;
  } catch {
    try {
      target.scrollTo(0, 0);
      return true;
    } catch {
      return false;
    }
  }
}

function scrollElementToTop(element, behavior) {
  if (!element) return;

  const safeBehavior = normalizeScrollBehavior(behavior);
  if (typeof element.scrollTo === 'function') {
    const didScroll = scrollToTop(element, safeBehavior);
    if (didScroll && safeBehavior === 'smooth') return;
  }

  element.scrollTop = 0;
  element.scrollLeft = 0;
}

function scrollDocumentToTop(behavior = getScrollBehavior()) {
  const safeBehavior = normalizeScrollBehavior(behavior);
  const appScrollRoots = document.querySelectorAll('.lms-app-scroll-root, .portal-content, .portal-content__frame');
  const root = document.getElementById('root');

  appScrollRoots.forEach((element) => {
    scrollElementToTop(element, safeBehavior);
  });

  scrollElementToTop(root, safeBehavior);

  scrollToTop(window, safeBehavior);
  if (safeBehavior === 'smooth') return;

  // Keep browser/document scroll roots in sync for iOS/PWA and nested shell layouts.
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

function scheduleScrollToTop() {
  const nativePhone = document.documentElement?.dataset?.lmsRuntime === 'native' &&
    document.documentElement?.dataset?.lmsFormFactor === 'phone';
  const frameIds = [];
  const timeoutIds = [];
  const scrollNow = () => scrollDocumentToTop('auto');

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

export function RouteScrollRestoration({
  excludedRoutes = DEFAULT_SCROLL_RESTORATION_EXCLUDED_ROUTES,
}) {
  const { key, pathname, search } = useLocation();
  const excludedRouteSet = useMemo(() => excludedRoutes, [excludedRoutes]);

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;
    if (isExcludedRoute(pathname, excludedRouteSet)) return;

    // Run before paint and again after route content mounts. WKWebView can apply
    // the previous scroll position after the first layout pass on heavier pages.
    return scheduleScrollToTop();
  }, [key, pathname, search, excludedRouteSet]);

  return null;
}
