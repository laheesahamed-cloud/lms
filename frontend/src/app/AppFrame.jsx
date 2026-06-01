import { useEffect, useLayoutEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { RouteScrollRestoration } from '../shared/routing/RouteScrollRestoration.jsx';
import { detectPlatform } from '../shared/platform/detect.js';
import { useAuthStore } from '../shared/stores/authStore.js';
import { isStaffUser } from '../shared/auth/roleAccess.js';
import { isSecureContentRoute, useSecureContentMode } from '../shared/security/secureContentMode.js';
import { applyCapacitorStatusBarTheme } from '../shared/utils/capacitorStatusBar.js';
import { getFocusableElements } from '../shared/hooks/useFocusTrap.js';
import { NativeAndroidStatusAnnouncer } from '../shared/platform/native/NativeAndroidStatusAnnouncer.jsx';

const PLATFORM = detectPlatform();
const NATIVE_PUSH_PROMPT_KEY = 'lms_native_push_permission_prompted';
const routeSceneBaseClass = 'relative isolate min-h-dvh overflow-x-hidden';
const authRouteSceneClass = 'auth-route-scene';
let nativeHapticsModulePromise = null;
let componentStateId = 0;

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

function isVisibleElement(element) {
  return Boolean(element && element.getClientRects().length > 0 && window.getComputedStyle(element).visibility !== 'hidden');
}

function ensureElementId(element, prefix) {
  if (!element.id) {
    componentStateId += 1;
    element.id = `${prefix}-${componentStateId}`;
  }
  return element.id;
}

function controlText(element) {
  return (element.textContent || '').replace(/\s+/g, ' ').trim();
}

function controlToken(element) {
  return [
    element.id,
    element.getAttribute('class'),
    element.getAttribute('data-testid'),
    element.getAttribute('data-cy'),
    element.getAttribute('aria-controls'),
    element.getAttribute('title'),
    element.getAttribute('data-tooltip'),
    element.getAttribute('data-label'),
  ].filter(Boolean).join(' ').toLowerCase();
}

function inferIconControlLabel(element) {
  if (element.hasAttribute('aria-label') || element.hasAttribute('aria-labelledby')) return '';
  if (controlText(element)) return '';

  const explicitLabel =
    element.getAttribute('title') ||
    element.getAttribute('data-tooltip') ||
    element.getAttribute('data-label') ||
    element.querySelector('svg title')?.textContent;
  if (explicitLabel?.trim()) return explicitLabel.trim();

  const token = controlToken(element);
  if (/\b(close|dismiss|x-button)\b/.test(token)) return 'Close';
  if (/\b(menu|sidebar|nav|hamburger)\b/.test(token)) return 'Toggle navigation';
  if (/\b(search)\b/.test(token)) return 'Search';
  if (/\b(notification|bell)\b/.test(token)) return 'Notifications';
  if (/\b(profile|avatar|account|user)\b/.test(token)) return 'Open profile menu';
  if (/\b(theme|dark|light)\b/.test(token)) return 'Toggle theme';
  if (/\b(bookmark|saved)\b/.test(token)) return 'Toggle bookmark';
  if (/\b(filter|funnel)\b/.test(token)) return 'Filter';
  if (/\b(sort)\b/.test(token)) return 'Sort';
  if (/\b(back|previous|prev)\b/.test(token)) return 'Go back';
  if (/\b(next|forward)\b/.test(token)) return 'Go forward';
  if (/\b(play)\b/.test(token)) return 'Play';
  if (/\b(pause)\b/.test(token)) return 'Pause';
  if (/\b(delete|trash|remove)\b/.test(token)) return 'Delete';
  if (/\b(download)\b/.test(token)) return 'Download';
  if (/\b(upload)\b/.test(token)) return 'Upload';
  if (/\b(edit|pencil)\b/.test(token)) return 'Edit';
  if (/\b(expand|maximize|fullscreen)\b/.test(token)) return 'Expand';
  if (/\b(collapse|minimize)\b/.test(token)) return 'Collapse';

  return '';
}

function annotateComponentStateSemantics(root = document) {
  if (typeof document === 'undefined') return;
  const scope = root.querySelectorAll ? root : document;

  scope.querySelectorAll('button svg:not([aria-hidden]):not([role="img"]), a svg:not([aria-hidden]):not([role="img"]), [role="button"] svg:not([aria-hidden]):not([role="img"])').forEach((element) => {
    if (!element.querySelector('title')) {
      element.setAttribute('aria-hidden', 'true');
      element.setAttribute('focusable', 'false');
    }
  });

  scope.querySelectorAll('.lms-mobile-bottom-nav__icon, .lms-mobile-top-nav__icon').forEach((element) => {
    if (!element.hasAttribute('aria-hidden')) element.setAttribute('aria-hidden', 'true');
  });

  scope.querySelectorAll('button:not([aria-label]):not([aria-labelledby]), a[href]:not([aria-label]):not([aria-labelledby]), [role="button"]:not([aria-label]):not([aria-labelledby])').forEach((element) => {
    const inferredLabel = inferIconControlLabel(element);
    if (inferredLabel) {
      element.setAttribute('aria-label', inferredLabel);
    }
  });

  scope.querySelectorAll('img:not([alt])').forEach((element) => {
    const isMedicalContentImage = element.closest('.lms-medical-image-frame, .lms-reading-question, .lms-reading-answer');
    element.setAttribute('alt', isMedicalContentImage ? 'Question image: no description provided.' : '');
  });

  scope.querySelectorAll('.lms-alert-error').forEach((element) => {
    if (!element.hasAttribute('role')) element.setAttribute('role', 'alert');
    if (!element.hasAttribute('aria-live')) element.setAttribute('aria-live', 'assertive');
  });

  scope.querySelectorAll('.lms-alert-success, .lms-alert-warning, .lms-alert-info, .lms-toast').forEach((element) => {
    if (!element.hasAttribute('role')) element.setAttribute('role', 'status');
    if (!element.hasAttribute('aria-live')) element.setAttribute('aria-live', 'polite');
  });

  scope.querySelectorAll('.lms-empty-state, .lms-table-empty').forEach((element) => {
    if (!element.hasAttribute('role')) element.setAttribute('role', 'status');
    if (!element.hasAttribute('aria-live')) element.setAttribute('aria-live', 'polite');
  });

  scope.querySelectorAll('.lms-table-shell').forEach((element) => {
    if (!element.hasAttribute('role')) element.setAttribute('role', 'region');
    if (!element.hasAttribute('aria-label')) element.setAttribute('aria-label', 'Scrollable data table');
    if (!element.hasAttribute('tabindex')) element.setAttribute('tabindex', '0');
  });

  scope.querySelectorAll('.lms-modal-panel').forEach((element) => {
    if (PLATFORM.isNative) {
      element.classList.add('lms-native-modal');
    }
    if (!element.hasAttribute('role')) element.setAttribute('role', 'dialog');
    if (!element.hasAttribute('aria-modal')) element.setAttribute('aria-modal', 'true');
    if (!element.hasAttribute('tabindex')) element.setAttribute('tabindex', '-1');
    if (!element.hasAttribute('aria-labelledby') && !element.hasAttribute('aria-label')) {
      const heading = element.querySelector('h1, h2, h3');
      if (heading) {
        element.setAttribute('aria-labelledby', ensureElementId(heading, 'lms-dialog-title'));
      } else {
        element.setAttribute('aria-label', 'Dialog');
      }
    }
    if (!element.hasAttribute('aria-describedby')) {
      const description = element.querySelector('.description, .subtitle, .caption, p');
      if (description && controlText(description)) {
        element.setAttribute('aria-describedby', ensureElementId(description, 'lms-dialog-description'));
      }
    }
  });

  scope.querySelectorAll('[role="progressbar"]').forEach((element) => {
    if (!element.hasAttribute('aria-valuemin')) element.setAttribute('aria-valuemin', '0');
    if (!element.hasAttribute('aria-valuemax')) element.setAttribute('aria-valuemax', '100');
    if (!element.hasAttribute('aria-label') && !element.hasAttribute('aria-labelledby')) {
      element.setAttribute('aria-label', 'Progress');
    }
  });

  scope.querySelectorAll('[role="tablist"]').forEach((tablist) => {
    const tabs = Array.from(tablist.querySelectorAll('[role="tab"]'));
    tabs.forEach((tab) => {
      const selected = tab.getAttribute('aria-selected') === 'true';
      tab.setAttribute('tabindex', selected ? '0' : '-1');
    });
  });

  scope.querySelectorAll('.lms-mobile-bottom-nav__tab').forEach((element) => {
    if (element.classList.contains('is-active')) {
      element.setAttribute('aria-current', 'page');
    } else if (element.getAttribute('aria-current') === 'page') {
      element.removeAttribute('aria-current');
    }
  });
}

function getTopModalDialog() {
  const dialogs = Array.from(document.querySelectorAll('[role="dialog"][aria-modal="true"]'))
    .filter(isVisibleElement);
  return dialogs[dialogs.length - 1] || null;
}

function findDialogDismissButton(dialog) {
  return getFocusableElements(dialog).find((element) => {
    const label = `${element.getAttribute('aria-label') || ''} ${element.textContent || ''}`.trim().toLowerCase();
    return /^(close|cancel|dismiss|not now|maybe later|keep working)\b/.test(label);
  });
}

function handleTablistKeyboard(event) {
  const tab = event.target instanceof Element ? event.target.closest('[role="tab"]') : null;
  const tablist = tab?.closest('[role="tablist"]');
  if (!tab || !tablist) return false;

  const orientation = tablist.getAttribute('aria-orientation') || 'horizontal';
  const forwardKey = orientation === 'vertical' ? 'ArrowDown' : 'ArrowRight';
  const backwardKey = orientation === 'vertical' ? 'ArrowUp' : 'ArrowLeft';
  if (![forwardKey, backwardKey, 'Home', 'End'].includes(event.key)) return false;

  const tabs = Array.from(tablist.querySelectorAll('[role="tab"]'))
    .filter((item) => item.getAttribute('aria-disabled') !== 'true' && !item.disabled);
  const index = tabs.indexOf(tab);
  if (index === -1 || !tabs.length) return false;

  event.preventDefault();
  const nextIndex =
    event.key === 'Home' ? 0 :
    event.key === 'End' ? tabs.length - 1 :
    event.key === forwardKey ? (index + 1) % tabs.length :
    (index - 1 + tabs.length) % tabs.length;
  tabs[nextIndex]?.focus({ preventScroll: true });
  tabs[nextIndex]?.click();
  return true;
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
  const fallbackColor = theme === 'dark' ? '#060d22' : '#dce6f4';
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
    setStyleIfChanged(element, 'background', 'var(--app-bg, var(--page-background, #060d22))');
    setStyleIfChanged(element, 'backgroundColor', 'var(--app-bg-solid, var(--app-bg, #060d22))');
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
    setStyleIfChanged(root, 'background', 'var(--app-bg, var(--page-background, #060d22))');
    setStyleIfChanged(root, 'backgroundColor', 'var(--app-bg-solid, var(--app-bg, #060d22))');
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
    const routeThemeColors = { light: '#dce6f4', dark: '#060d22' };
    const appThemeColors = { light: '#dce6f4', dark: '#060d22' };
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
    if (typeof document === 'undefined' || typeof window === 'undefined') {
      return undefined;
    }

    let annotationFrame = 0;
    function scheduleAnnotation() {
      if (annotationFrame) return;
      annotationFrame = window.requestAnimationFrame(() => {
        annotationFrame = 0;
        annotateComponentStateSemantics(document);
      });
    }

    function handleKeyDown(event) {
      if (handleTablistKeyboard(event)) return;

      const dialog = getTopModalDialog();
      if (!dialog) return;

      if (event.key === 'Escape') {
        const dismissButton = findDialogDismissButton(dialog);
        if (dismissButton) {
          event.preventDefault();
          dismissButton.click();
        }
        return;
      }

      if (event.key !== 'Tab') return;

      const focusable = getFocusableElements(dialog);
      if (!focusable.length) {
        event.preventDefault();
        dialog.focus({ preventScroll: true });
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    }

    function handleFocusIn(event) {
      const dialog = getTopModalDialog();
      if (!dialog || dialog.contains(event.target)) return;
      const focusable = getFocusableElements(dialog);
      (focusable[0] || dialog).focus({ preventScroll: true });
    }

    annotateComponentStateSemantics(document);
    const observer = PLATFORM.isNative ? null : new MutationObserver(scheduleAnnotation);
    observer?.observe(document.body, {
      attributes: true,
      attributeFilter: ['class', 'role', 'aria-selected'],
      childList: true,
      subtree: true,
    });
    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('focusin', handleFocusIn, true);

    return () => {
      observer?.disconnect();
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('focusin', handleFocusIn, true);
      if (annotationFrame) {
        window.cancelAnimationFrame(annotationFrame);
      }
    };
  }, []);

  useLayoutEffect(() => {
    if (!PLATFORM.isNative || typeof document === 'undefined') {
      return undefined;
    }

    const calloutSelector = [
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
    const hapticSelector = [
      '[data-lms-haptic]',
      'button[type="submit"]',
      '[aria-pressed]',
      '[role="tab"][aria-selected="true"]',
      '.button-primary',
      '.primary-cta',
      '.start-practice-button',
      '.lms-assessment-btn--primary',
      '.lms-mobile-quiz-primary',
      '.lms-mobile-bottom-nav__tab',
      '.theme-toggle',
      '.quiz-submit-button',
      '.quiz-complete-button',
    ].join(',');
    const nativeHapticEvent = typeof window !== 'undefined' && 'PointerEvent' in window ? 'pointerup' : 'touchend';
    let lastTapHapticAt = 0;

    function getNativeHapticIntent(element) {
      const explicitIntent = element.getAttribute('data-lms-haptic')?.toLowerCase();
      if (explicitIntent === 'none' || explicitIntent === 'off') return '';
      if (['selection', 'success', 'warning', 'error', 'impact'].includes(explicitIntent)) return explicitIntent;

      const label = `${controlText(element)} ${element.getAttribute('aria-label') || ''} ${controlToken(element)}`.toLowerCase();
      if (/\b(delete|remove|discard|destructive|danger|reset|sign out|logout)\b/.test(label)) return 'warning';
      if (/\b(complete|completed|submit|submitted|finish|finished|save|saved|success)\b/.test(label)) return 'success';
      if (/\b(start|continue|next|previous|back|primary|cta)\b/.test(label)) return 'impact';
      if (element.matches('[role="tab"], .lms-mobile-bottom-nav__tab, [aria-pressed]')) return 'selection';
      if (element.matches('button[type="submit"], .button-primary, .primary-cta, .start-practice-button, .lms-assessment-btn--primary, .lms-mobile-quiz-primary')) return 'impact';
      return 'selection';
    }

    function blockNativeCallout(event) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (target.closest(calloutSelector)) {
        event.preventDefault();
      }
    }

    function playNativeTapHaptic(event) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('input, textarea, select, [contenteditable="true"]')) return;

      const interactiveElement = target.closest(hapticSelector);
      if (!interactiveElement) return;
      if (interactiveElement.closest('[disabled], [aria-disabled="true"]')) return;

      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (now - lastTapHapticAt < 220) return;
      lastTapHapticAt = now;
      const intent = getNativeHapticIntent(interactiveElement);
      if (!intent) return;

      void getNativeHapticsModule()
        .then(({ ImpactStyle, nativeImpact, nativeSelection, nativeSuccess, nativeWarning, nativeError }) => {
          if (intent === 'success') return nativeSuccess();
          if (intent === 'warning') return nativeWarning();
          if (intent === 'error') return nativeError();
          if (intent === 'impact') return nativeImpact(ImpactStyle.Light);
          return nativeSelection();
        })
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
    if (!PLATFORM.isNative || !PLATFORM.isAndroid || typeof window === 'undefined') {
      return undefined;
    }

    const appPlugin = window.Capacitor?.Plugins?.App;
    if (!appPlugin?.addListener) return undefined;

    let listenerHandle = null;
    let removed = false;

    function handleAndroidBack(event = {}) {
      const dialog = getTopModalDialog();
      if (dialog) {
        const dismissButton = findDialogDismissButton(dialog);
        if (dismissButton) {
          dismissButton.click();
          return;
        }
      }

      const backEvent = new CustomEvent('lms:android-back', {
        cancelable: true,
        detail: { canGoBack: Boolean(event?.canGoBack) },
      });
      if (!window.dispatchEvent(backEvent)) return;

      if (event?.canGoBack || window.history.length > 1) {
        navigate(-1);
        return;
      }

      appPlugin.exitApp?.();
    }

    Promise.resolve(appPlugin.addListener('backButton', handleAndroidBack))
      .then((handle) => {
        if (removed) {
          Promise.resolve(handle?.remove?.()).catch(() => {});
        } else {
          listenerHandle = handle;
        }
      })
      .catch(() => {});

    return () => {
      removed = true;
      Promise.resolve(listenerHandle?.remove?.()).catch(() => {});
    };
  }, [navigate]);

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
  const activeAuthRouteSceneClass = isAuthRoute && authRouteSceneClass;

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

    const frameOne = window.requestAnimationFrame(() => {
      syncAppScrollContract();
    });
    const syncDelays = [120];
    const timers = syncDelays.map((delay) => window.setTimeout(syncAppScrollContract, delay));
    const viewport = window.visualViewport;

    window.addEventListener('resize', syncAppScrollContract, { passive: true });
    window.addEventListener('orientationchange', syncAppScrollContract, { passive: true });
    window.addEventListener('pageshow', syncAppScrollContract, { passive: true });
    viewport?.addEventListener('resize', syncAppScrollContract, { passive: true });

    return () => {
      window.cancelAnimationFrame(frameOne);
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
    [140].forEach((delay) => {
      timers.push(window.setTimeout(scheduleSync, delay));
    });

    const observer = typeof MutationObserver === 'function'
      ? new MutationObserver(scheduleSync)
      : null;
    observer?.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
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
      <>
        <a className="lms-skip-link" href="#main-content">Skip to main content</a>
        <div className="lms-app-scroll-root native-app-frame">
          <RouteScrollRestoration />
          <NativeAndroidStatusAnnouncer />
          <div id="main-content" tabIndex={-1}>
            <Outlet />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <a className="lms-skip-link" href="#main-content">Skip to main content</a>
      <div className={cx('lms-app-scroll-root', routeSceneBaseClass, activeAuthRouteSceneClass)}>
        <RouteScrollRestoration />
        <div id="main-content" tabIndex={-1}>
          <Outlet />
        </div>
      </div>
    </>
  );
}
