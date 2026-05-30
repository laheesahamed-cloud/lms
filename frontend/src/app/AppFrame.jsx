import { useEffect, useLayoutEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { RouteScrollRestoration } from '../shared/routing/RouteScrollRestoration.jsx';
import { detectPlatform } from '../shared/platform/detect.js';
import { useAuthStore } from '../shared/stores/authStore.js';
import { isStaffUser } from '../shared/auth/roleAccess.js';
import { isSecureContentRoute, useSecureContentMode } from '../shared/security/secureContentMode.js';
import { applyCapacitorStatusBarTheme } from '../shared/utils/capacitorStatusBar.js';

const PLATFORM = detectPlatform();
const NATIVE_PUSH_PROMPT_KEY = 'lms_native_push_permission_prompted';
const routeSceneClass = 'relative isolate min-h-dvh overflow-x-hidden animate-routeFade';
const authRouteSceneClass = 'auth-route-scene animate-authRouteFade';
let nativeHapticsModulePromise = null;

const nativeChromeSourceSelector = [
  '.dashboard-page.study-hub-page',
  '.student-route-page',
  '.lms-exam-page',
  '.practice-review-page',
  '.lms-review-page',
  '.student-app-shell',
  '.app-shell',
  '.native-app-frame',
].join(',');

const studentStudyHubPathPattern =
  /^\/(?:app\/)?(?:dashboard|courses|notifications|planner|ai-notes|flashcards|quizzes|exams|results|bookmarks|subscriptions|billing|profile)(?:\/|$)/;

function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}

function setStyleIfChanged(element, property, value) {
  if (element.style[property] !== value) {
    element.style[property] = value;
  }
}

function setCssPropertyIfChanged(element, property, value, priority = '') {
  if (
    element.style.getPropertyValue(property) !== value ||
    element.style.getPropertyPriority(property) !== priority
  ) {
    element.style.setProperty(property, value, priority);
  }
}

function expandHexColor(value) {
  const hex = value.trim();
  if (!/^#[0-9a-f]{3,8}$/i.test(hex)) return '';

  if (hex.length === 4 || hex.length === 5) {
    return `#${hex.slice(1, 4).split('').map((part) => `${part}${part}`).join('')}`;
  }

  return hex.slice(0, 7);
}

function clampRgb(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function parseRgbChannel(value) {
  const part = value.trim();
  if (part.endsWith('%')) {
    return clampRgb((Number.parseFloat(part) / 100) * 255);
  }

  return clampRgb(Number.parseFloat(part));
}

function rgbToHex(red, green, blue) {
  return `#${[red, green, blue]
    .map((channel) => clampRgb(channel).toString(16).padStart(2, '0'))
    .join('')}`;
}

function cssColorToHex(value) {
  if (!value) return '';

  const color = value.trim();
  const hex = expandHexColor(color);
  if (hex) return hex;

  const rgbMatch = color.match(/^rgba?\(([^)]+)\)$/i);
  if (rgbMatch) {
    const channels = rgbMatch[1].split(/[\s,\/]+/).filter(Boolean).slice(0, 3);
    if (channels.length === 3) {
      return rgbToHex(...channels.map(parseRgbChannel));
    }
  }

  if (typeof document === 'undefined' || !document.body) return '';

  const probe = document.createElement('span');
  probe.style.color = color;
  probe.style.display = 'none';
  document.body.appendChild(probe);
  const computed = window.getComputedStyle(probe).color;
  probe.remove();

  if (!computed || computed === color) return '';
  return cssColorToHex(computed);
}

function readCssVariable(styles, property) {
  return styles.getPropertyValue(property).trim();
}

function syncNativeChromeSurface() {
  if (!PLATFORM.isNative || typeof document === 'undefined' || typeof window === 'undefined') {
    return;
  }

  const source = document.querySelector(nativeChromeSourceSelector) || document.documentElement;
  const sourceStyles = window.getComputedStyle(source);
  const rootStyles = window.getComputedStyle(document.documentElement);
  const theme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
  const fallbackColor = theme === 'dark' ? '#151c24' : '#dce6f4';
  const routeBackground =
    readCssVariable(sourceStyles, '--app-bg') ||
    readCssVariable(sourceStyles, '--page-background') ||
    readCssVariable(rootStyles, '--app-bg') ||
    readCssVariable(rootStyles, '--page-background') ||
    fallbackColor;
  const routeSolidBackground =
    cssColorToHex(readCssVariable(sourceStyles, '--app-bg-solid')) ||
    cssColorToHex(readCssVariable(sourceStyles, '--surface-0')) ||
    cssColorToHex(readCssVariable(rootStyles, '--app-bg-solid')) ||
    fallbackColor;
  const chromeBackground = routeBackground.includes('var(')
    ? routeSolidBackground
    : routeBackground;

  [
    document.documentElement,
    document.body,
    document.querySelector('.native-app-frame'),
  ].filter(Boolean).forEach((element) => {
    setCssPropertyIfChanged(element, '--lms-native-chrome-bg', chromeBackground);
    setCssPropertyIfChanged(element, '--lms-native-chrome-bg-solid', routeSolidBackground);
  });

  applyCapacitorStatusBarTheme(theme, routeSolidBackground);
}

function isStudentStudyHubPath(pathname = '') {
  return studentStudyHubPathPattern.test(pathname);
}

function getNativeHapticsModule() {
  nativeHapticsModulePromise ??= import('../shared/utils/nativeHaptics.js');
  return nativeHapticsModulePromise;
}

function syncAppScrollContract() {
  if (typeof document === 'undefined') return;

  const appTouchAction = PLATFORM.isNative ? 'auto' : 'pan-y';
  const appViewportHeight = PLATFORM.isNative ? '100dvh' : '100%';
  const appScrollHeight = '100dvh';

  if (typeof window.__lmsLockDocumentScroll === 'function') {
    window.__lmsLockDocumentScroll();
  } else if (typeof window.__lmsUnlockScroll === 'function') {
    window.__lmsUnlockScroll();
  }

  const root = document.getElementById('root');
  const documentRoots = [document.documentElement, document.body].filter(Boolean);

  documentRoots.forEach((element) => {
    setCssPropertyIfChanged(element, 'height', appViewportHeight, 'important');
    setCssPropertyIfChanged(element, 'min-height', appViewportHeight, 'important');
    setStyleIfChanged(element, 'maxWidth', '100%');
    setCssPropertyIfChanged(element, 'overflow-x', 'hidden', 'important');
    setCssPropertyIfChanged(element, 'overflow-y', 'hidden', 'important');
    setStyleIfChanged(element, 'overscrollBehavior', 'none');
    setStyleIfChanged(element, 'background', 'var(--app-bg, var(--page-background, #151c24))');
    setStyleIfChanged(element, 'backgroundColor', 'var(--app-bg-solid, var(--app-bg, #151c24))');
    setStyleIfChanged(element, 'color', '');
  });

  setStyleIfChanged(document.body, 'position', 'relative');
  setStyleIfChanged(document.body, 'inset', 'auto');
  setStyleIfChanged(document.body, 'height', appViewportHeight);
  setStyleIfChanged(document.body, 'minHeight', '100dvh');
  setStyleIfChanged(document.body, 'paddingLeft', PLATFORM.isNative ? '0px' : 'env(safe-area-inset-left)');
  setStyleIfChanged(document.body, 'paddingRight', PLATFORM.isNative ? '0px' : 'env(safe-area-inset-right)');

  if (root) {
    setCssPropertyIfChanged(root, 'height', appViewportHeight, 'important');
    setCssPropertyIfChanged(root, 'min-height', appViewportHeight, 'important');
    setStyleIfChanged(root, 'maxWidth', '100%');
    setCssPropertyIfChanged(root, 'overflow-x', 'hidden', 'important');
    setCssPropertyIfChanged(root, 'overflow-y', 'hidden', 'important');
    setStyleIfChanged(root, 'overscrollBehavior', 'none');
    setStyleIfChanged(root, 'touchAction', appTouchAction);
    setStyleIfChanged(root, 'background', 'var(--app-bg, var(--page-background, #151c24))');
    setStyleIfChanged(root, 'backgroundColor', 'var(--app-bg-solid, var(--app-bg, #151c24))');
    setStyleIfChanged(root, 'color', '');
    setStyleIfChanged(root, 'webkitOverflowScrolling', 'touch');
  }

  document.querySelectorAll('.lms-app-scroll-root').forEach((element) => {
    setStyleIfChanged(element, 'width', PLATFORM.isNative ? '100vw' : '');
    setStyleIfChanged(element, 'maxWidth', PLATFORM.isNative ? '100vw' : '100%');
    setStyleIfChanged(element, 'marginLeft', '0px');
    setStyleIfChanged(element, 'marginRight', '0px');
    setCssPropertyIfChanged(element, 'height', appScrollHeight, 'important');
    setCssPropertyIfChanged(element, 'min-height', appScrollHeight, 'important');
    setCssPropertyIfChanged(element, 'max-height', appScrollHeight, 'important');
    setCssPropertyIfChanged(element, 'overflow-x', 'hidden', 'important');
    setCssPropertyIfChanged(element, 'overflow-y', 'auto', 'important');
    setStyleIfChanged(element, 'overscrollBehaviorX', 'none');
    setStyleIfChanged(element, 'overscrollBehaviorY', PLATFORM.isNative ? 'contain' : 'auto');
    setStyleIfChanged(element, 'touchAction', appTouchAction);
    setStyleIfChanged(element, 'webkitOverflowScrolling', 'touch');
  });

  document.querySelectorAll('.portal-shell, .portal-content, .portal-content__frame, .motion-smooth, .lms-route-page, .student-route-page').forEach((element) => {
    setStyleIfChanged(element, 'height', 'auto');
    setStyleIfChanged(element, 'minHeight', '100%');
    setStyleIfChanged(element, 'maxHeight', 'none');
    setCssPropertyIfChanged(element, 'overflow-x', PLATFORM.isNative ? 'hidden' : 'visible', 'important');
    setCssPropertyIfChanged(element, 'overflow-y', 'visible', 'important');
    setStyleIfChanged(element, 'overscrollBehavior', 'none');
    setStyleIfChanged(element, 'touchAction', appTouchAction);
    setStyleIfChanged(element, 'webkitOverflowScrolling', 'touch');
  });
}

export function AppFrame() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isHydrating = useAuthStore((state) => state.isHydrating);
  const secureContentActive = isSecureContentRoute(location);

  useSecureContentMode(secureContentActive);

  useLayoutEffect(() => {
    if (typeof document === 'undefined') return undefined;

    const body = document.body;
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    const root = document.documentElement;
    const isStudyHubScreen = user?.role === 'student' && isStudentStudyHubPath(location.pathname);
    const routeThemeColors = { light: '#dce6f4', dark: '#151c24' };
    const appThemeColors = { light: '#dce6f4', dark: '#151c24' };
    const getTheme = () => (root.dataset.theme === 'dark' ? 'dark' : 'light');
    const syncThemeColor = () => {
      const theme = getTheme();
      const color = isStudyHubScreen ? routeThemeColors[theme] : appThemeColors[theme];
      metaThemeColor?.setAttribute('content', color);
      applyCapacitorStatusBarTheme(theme, color);
    };

    body.classList.toggle('study-hub-screen', isStudyHubScreen);
    syncThemeColor();

    const observer = typeof MutationObserver === 'function'
      ? new MutationObserver(syncThemeColor)
      : null;
    observer?.observe(root, { attributes: true, attributeFilter: ['data-theme'] });

    return () => {
      observer?.disconnect();
      body.classList.remove('study-hub-screen');
      const theme = getTheme();
      metaThemeColor?.setAttribute('content', appThemeColors[theme]);
      applyCapacitorStatusBarTheme(theme, appThemeColors[theme]);
    };
  }, [location.pathname, user?.role]);

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
      '[role="tab"]',
      '[role="menuitem"]',
      '.card-interactive',
      '.lms-course-card',
      '.lms-dashboard-card',
      '.lms-mobile-bottom-nav__tab',
      '.lms-mobile-bottom-nav *',
    ].join(',');
    const nativeHapticEvent = typeof window !== 'undefined' && 'PointerEvent' in window ? 'pointerup' : 'touchend';
    let lastTapHapticAt = 0;

    function blockNativeCallout(event) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (target.closest(interactiveSelector)) {
        event.preventDefault();
      }
    }

    function playNativeTapHaptic(event) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('input, textarea, select, [contenteditable="true"]')) return;

      const interactiveElement = target.closest(interactiveSelector);
      if (!interactiveElement) return;
      if (interactiveElement.closest('[disabled], [aria-disabled="true"]')) return;

      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (now - lastTapHapticAt < 90) return;
      lastTapHapticAt = now;

      void getNativeHapticsModule()
        .then(({ nativeSelection }) => nativeSelection())
        .catch(() => {});
    }

    document.addEventListener('contextmenu', blockNativeCallout, true);
    document.addEventListener('dragstart', blockNativeCallout, true);
    document.addEventListener(nativeHapticEvent, playNativeTapHaptic, { capture: true, passive: true });
    return () => {
      document.removeEventListener('contextmenu', blockNativeCallout, true);
      document.removeEventListener('dragstart', blockNativeCallout, true);
      document.removeEventListener(nativeHapticEvent, playNativeTapHaptic, true);
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
        } = await import('../shared/platform/native/NotificationDelivery.js');

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
    if (/^\/(?:login|register|terms|privacy-policy|ai)(?:\/|$)/.test(location.pathname)) return;

    const isLegacyProtectedPath = /^\/(?:dashboard|pending|profile|courses|structure|users|questions|question-reports|quizzes|exams|subscriptions|finance|billing|bookmarks|notifications|planner|flashcards|notes|study|ai-notes|results|review|announcements|reports|setup|settings)(?:\/|$)/.test(location.pathname);
    if (!isLegacyProtectedPath) return;

    const cleanPath = location.pathname === '/billing' ? '/subscriptions' : location.pathname;
    const prefix = isStaffUser(user) ? '/admin' : '';
    navigate(`${prefix}${cleanPath}${location.search}${location.hash}`, { replace: true });
  }, [isAuthenticated, isHydrating, location.hash, location.pathname, location.search, navigate, user?.role, user?.status]);

  useLayoutEffect(() => {
    if (typeof document === 'undefined') return;

    syncAppScrollContract();

    let frameTwo = 0;
    const frameOne = window.requestAnimationFrame(() => {
      syncAppScrollContract();
      frameTwo = window.requestAnimationFrame(syncAppScrollContract);
    });
    const timers = [80, 220, 520].map((delay) => window.setTimeout(syncAppScrollContract, delay));
    const viewport = window.visualViewport;

    window.addEventListener('resize', syncAppScrollContract, { passive: true });
    window.addEventListener('orientationchange', syncAppScrollContract, { passive: true });
    window.addEventListener('pageshow', syncAppScrollContract, { passive: true });
    viewport?.addEventListener('resize', syncAppScrollContract, { passive: true });

    return () => {
      window.cancelAnimationFrame(frameOne);
      if (frameTwo) window.cancelAnimationFrame(frameTwo);
      timers.forEach((timer) => window.clearTimeout(timer));
      window.removeEventListener('resize', syncAppScrollContract);
      window.removeEventListener('orientationchange', syncAppScrollContract);
      window.removeEventListener('pageshow', syncAppScrollContract);
      viewport?.removeEventListener('resize', syncAppScrollContract);
    };
  }, [location.pathname, location.search]);

  useLayoutEffect(() => {
    if (!PLATFORM.isNative || typeof document === 'undefined' || typeof window === 'undefined') {
      return undefined;
    }

    let frame = 0;
    const timers = [];
    const scheduleSync = () => {
      if (frame) {
        window.cancelAnimationFrame(frame);
      }

      frame = window.requestAnimationFrame(() => {
        frame = 0;
        syncNativeChromeSurface();
      });
    };

    scheduleSync();
    [40, 140, 360].forEach((delay) => {
      timers.push(window.setTimeout(scheduleSync, delay));
    });

    const observer = typeof MutationObserver === 'function'
      ? new MutationObserver(scheduleSync)
      : null;
    observer?.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme', 'style'],
    });
    observer?.observe(document.body, {
      attributes: true,
      attributeFilter: ['class', 'style'],
    });

    window.addEventListener('pageshow', scheduleSync, { passive: true });
    window.addEventListener('resize', scheduleSync, { passive: true });
    window.addEventListener('orientationchange', scheduleSync, { passive: true });

    return () => {
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
      timers.forEach((timer) => window.clearTimeout(timer));
      observer?.disconnect();
      window.removeEventListener('pageshow', scheduleSync);
      window.removeEventListener('resize', scheduleSync);
      window.removeEventListener('orientationchange', scheduleSync);
    };
  }, [location.pathname, location.search]);

  if (PLATFORM.isNative) {
    return (
      <div className="lms-app-scroll-root native-app-frame">
        <a className="lms-skip-link" href="#main-content">Skip to main content</a>
        <RouteScrollRestoration />
        <div id="main-content" tabIndex={-1}>
          <Outlet />
        </div>
      </div>
    );
  }

  return (
    <div className={cx('lms-app-scroll-root', routeSceneClass, isAuthRoute && authRouteSceneClass)}>
      <a className="lms-skip-link" href="#main-content">Skip to main content</a>
      <RouteScrollRestoration />
      <div className="main-glow" aria-hidden="true" />
      <div id="main-content" tabIndex={-1}>
        <Outlet />
      </div>
    </div>
  );
}
