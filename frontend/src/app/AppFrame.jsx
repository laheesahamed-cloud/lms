import { useEffect, useLayoutEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { RouteScrollRestoration } from '../components/routing/RouteScrollRestoration.jsx';
import { detectPlatform } from '../platform/detect.js';
import { useAuthStore } from '../stores/authStore.js';
import { cx, ui } from '../styles/tailwindClasses.js';

const PLATFORM = detectPlatform();
const NATIVE_PUSH_PROMPT_KEY = 'lms_native_push_permission_prompted';

function setStyleIfChanged(element, property, value) {
  if (element.style[property] !== value) {
    element.style[property] = value;
  }
}

export function AppFrame() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isHydrating = useAuthStore((state) => state.isHydrating);

  // Tell the boot overlay that the persistent app frame has mounted. The boot
  // overlay itself owns the app-ready classes so it can wait for the first real
  // route to commit before dissolving.
  useLayoutEffect(() => {
    if (typeof document === 'undefined') return;
    window.__lmsReactReady = true;
    document.dispatchEvent(new Event('lms:react-ready'));
  }, []);

  useLayoutEffect(() => {
    if (!PLATFORM.isNative || typeof document === 'undefined') {
      return undefined;
    }

    const interactiveSelector = [
      'a[href]',
      'button',
      '[role="button"]',
      '.card-interactive',
      '.lms-course-card',
      '.lms-dashboard-card',
      '.lms-mobile-bottom-nav *',
    ].join(',');

    function blockNativeCallout(event) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (target.closest(interactiveSelector)) {
        event.preventDefault();
      }
    }

    document.addEventListener('contextmenu', blockNativeCallout, true);
    document.addEventListener('dragstart', blockNativeCallout, true);
    return () => {
      document.removeEventListener('contextmenu', blockNativeCallout, true);
      document.removeEventListener('dragstart', blockNativeCallout, true);
    };
  }, []);

  useEffect(() => {
    if (!PLATFORM.isNative || isHydrating || !isAuthenticated) return undefined;
    if (typeof window === 'undefined') return undefined;

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const prompted = window.localStorage.getItem(NATIVE_PUSH_PROMPT_KEY);
        const {
          requestNativePushPermission,
          syncNativePushToken,
        } = await import('../platform/native/NotificationDelivery.js');

        if (prompted === 'granted') {
          await syncNativePushToken().catch(() => {});
          return;
        }

        if (prompted) return;

        const result = await requestNativePushPermission();
        if (cancelled) return;

        const permission = result?.permission === 'granted' ? 'granted' : 'denied';
        window.localStorage.setItem(NATIVE_PUSH_PROMPT_KEY, permission);
        if (permission === 'granted') {
          await syncNativePushToken().catch(() => {});
        }
      } catch {
        if (!cancelled) {
          window.localStorage.removeItem(NATIVE_PUSH_PROMPT_KEY);
        }
      }
    }, 700);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isAuthenticated, isHydrating]);

  const isAuthRoute =
    location.pathname.startsWith('/auth/') ||
    location.pathname === '/login' ||
    location.pathname === '/register';

  useLayoutEffect(() => {
    if (isHydrating || !isAuthenticated || !user?.role) return;
    if (user.role === 'student' && user.status === 'active' && location.pathname === '/app/pending') {
      navigate('/dashboard', { replace: true });
      return;
    }

    if (/^\/(?:admin|app|auth)(?:\/|$)/.test(location.pathname)) return;
    if (/^\/(?:login|register|terms|privacy-policy|ai|lesson-notes-demo|headache-notes-demo|pwa-preview|browser-test|gpt|gemini)(?:\/|$)/.test(location.pathname)) return;

    const isLegacyProtectedPath = /^\/(?:dashboard|pending|profile|courses|structure|users|questions|quizzes|exams|subscriptions|billing|bookmarks|notifications|planner|doubts|flashcards|notes|study|ai-notes|results|review|announcements|reports|setup|settings)(?:\/|$)/.test(location.pathname);
    if (!isLegacyProtectedPath) return;

    const cleanPath = location.pathname === '/billing' ? '/subscriptions' : location.pathname;
    const prefix = user.role === 'admin' ? '/admin' : '';
    navigate(`${prefix}${cleanPath}${location.search}${location.hash}`, { replace: true });
  }, [isAuthenticated, isHydrating, location.hash, location.pathname, location.search, navigate, user?.role, user?.status]);

  useLayoutEffect(() => {
    if (typeof document === 'undefined') return;
    if (typeof window.__lmsLockDocumentScroll === 'function') {
      window.__lmsLockDocumentScroll();
    } else if (typeof window.__lmsUnlockScroll === 'function') {
      window.__lmsUnlockScroll();
    }

    const root = document.getElementById('root');
    const documentRoots = [document.documentElement, document.body].filter(Boolean);

    documentRoots.forEach((element) => {
      setStyleIfChanged(element, 'minHeight', '100%');
      setStyleIfChanged(element, 'maxWidth', '100%');
      setStyleIfChanged(element, 'overflowX', 'hidden');
      setStyleIfChanged(element, 'overflowY', PLATFORM.isNative ? 'clip' : '');
      setStyleIfChanged(element, 'overscrollBehavior', 'none');
      setStyleIfChanged(element, 'background', 'var(--app-bg, #05070d)');
      setStyleIfChanged(element, 'backgroundColor', 'var(--app-bg, #05070d)');
      setStyleIfChanged(element, 'color', '');
    });

    setStyleIfChanged(document.body, 'position', 'relative');
    setStyleIfChanged(document.body, 'inset', 'auto');
    setStyleIfChanged(document.body, 'height', PLATFORM.isNative ? '100%' : '');
    setStyleIfChanged(document.body, 'minHeight', '100dvh');
    setStyleIfChanged(document.body, 'paddingLeft', PLATFORM.isNative ? '0px' : 'env(safe-area-inset-left)');
    setStyleIfChanged(document.body, 'paddingRight', PLATFORM.isNative ? '0px' : 'env(safe-area-inset-right)');

    if (root) {
      setStyleIfChanged(root, 'minHeight', '100%');
      setStyleIfChanged(root, 'height', PLATFORM.isNative ? '100%' : '');
      setStyleIfChanged(root, 'maxWidth', '100%');
      setStyleIfChanged(root, 'overflowX', 'hidden');
      setStyleIfChanged(root, 'overflowY', PLATFORM.isNative ? 'clip' : '');
      setStyleIfChanged(root, 'overscrollBehavior', 'none');
      setStyleIfChanged(root, 'touchAction', 'pan-y');
      setStyleIfChanged(root, 'background', 'var(--app-bg, #05070d)');
      setStyleIfChanged(root, 'backgroundColor', 'var(--app-bg, #05070d)');
      setStyleIfChanged(root, 'color', '');
      setStyleIfChanged(root, 'webkitOverflowScrolling', 'touch');
    }

    document.querySelectorAll('.lms-app-scroll-root').forEach((element) => {
      setStyleIfChanged(element, 'width', PLATFORM.isNative ? '100vw' : '');
      setStyleIfChanged(element, 'maxWidth', PLATFORM.isNative ? '100vw' : '100%');
      setStyleIfChanged(element, 'marginLeft', '0px');
      setStyleIfChanged(element, 'marginRight', '0px');
      setStyleIfChanged(element, 'height', PLATFORM.isNative ? '100%' : '');
      setStyleIfChanged(element, 'minHeight', '100dvh');
      setStyleIfChanged(element, 'maxHeight', PLATFORM.isNative ? '100%' : '');
      setStyleIfChanged(element, 'overflowX', 'hidden');
      setStyleIfChanged(element, 'overflowY', 'auto');
      setStyleIfChanged(element, 'overscrollBehaviorX', 'none');
      setStyleIfChanged(element, 'overscrollBehaviorY', PLATFORM.isNative ? 'contain' : 'auto');
      setStyleIfChanged(element, 'touchAction', 'pan-y');
      setStyleIfChanged(element, 'webkitOverflowScrolling', 'touch');
    });

    document.querySelectorAll('.portal-shell, .portal-content, .portal-content__frame, .motion-smooth, .lms-route-page').forEach((element) => {
      setStyleIfChanged(element, 'height', 'auto');
      setStyleIfChanged(element, 'minHeight', '100%');
      setStyleIfChanged(element, 'maxHeight', 'none');
      setStyleIfChanged(element, 'overflowX', 'hidden');
      setStyleIfChanged(element, 'overflowY', 'visible');
      setStyleIfChanged(element, 'overscrollBehavior', 'none');
      setStyleIfChanged(element, 'touchAction', 'pan-y');
      setStyleIfChanged(element, 'webkitOverflowScrolling', 'touch');
    });
  }, [location.pathname, location.search]);

  if (PLATFORM.isNative) {
    return (
      <div className="lms-app-scroll-root native-app-frame">
        <RouteScrollRestoration />
        <Outlet />
      </div>
    );
  }

  return (
    <div className={cx('lms-app-scroll-root', ui.routeScene, isAuthRoute && ui.authRouteScene)}>
      <RouteScrollRestoration />
      <div className="main-glow" aria-hidden="true" />
      <Outlet />
    </div>
  );
}
