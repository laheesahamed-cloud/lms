import { useEffect, useState, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { AppSidebar, MobileBottomNav, MobileTopNav } from './AppSidebar.jsx';
import { GlobalSearch } from '../search/GlobalSearch.jsx';
import { detectPlatform } from '../platform/detect.js';
import { useAuthStore } from '../stores/authStore.js';
import { preloadRouteByPath } from '../../app/router.jsx';
import { isStaffUser, roleRouteMode } from '../auth/roleAccess.js';
import { getRoutePreloadLimit } from '../utils/performanceProfile.js';
import { cx } from '../styles/tailwindClasses.js';

const PLATFORM = detectPlatform();
const SIDEBAR_MOBILE_QUERY = '(max-width: 900px)';
const SIDEBAR_MOTION_SETTLE_MS = 260;

function shouldUseMobileNavigation(platform = detectPlatform()) {
  if (typeof window === 'undefined') return false;
  const widthIsMobile = window.matchMedia?.(SIDEBAR_MOBILE_QUERY)?.matches || window.innerWidth <= 900;
  return widthIsMobile || ((platform.isPwa || platform.isNative) && platform.isPhone);
}

const shellUi = {
  shell:
    'app app-shell main-layout portal-shell relative isolate block min-h-[100dvh] overflow-x-hidden bg-[#dce6f4] [.theme-transition_&]:!transition-none [.theme-soft-transition_&]:!transition-[background-color,color,border-color] [.theme-soft-transition_&]:!duration-[160ms] [.theme-soft-transition_&]:!ease-[var(--ease-out)] dark:bg-[var(--app-bg-solid)]',
  shellMobile: '',
  shellQuizFocus: '',
  content:
    'main-content app-content page-content portal-content relative z-[1] min-h-[100dvh] min-w-0 overflow-x-hidden overflow-y-visible pb-[var(--lms-mobile-content-bottom)] [-webkit-overflow-scrolling:touch] min-[901px]:ml-[calc(var(--sidebar-w)_+_var(--sidebar-shell-gap))] min-[901px]:w-[calc(100%_-_var(--sidebar-w)_-_var(--sidebar-shell-gap))] min-[901px]:pb-6 max-[900px]:ml-0 max-[900px]:w-full max-[900px]:pt-0',
  contentAiFocus: '',
  contentCompactFocus:
    'min-[901px]:!ml-0 min-[901px]:!w-full',
  contentQuizFocus: '',
  contentSigningOut: 'animate-signoutSoftExit',
  frame: 'portal-content__frame min-h-full',
  frameQuizFocus: '',
  ambient: 'portal-shell-ambient pointer-events-none hidden',
  ambientGlow: 'portal-shell-ambient__glow absolute rounded-full blur-[90px]',
  ambientGlowOne:
    'portal-shell-ambient__glow--one left-[20%] top-[-120px] size-[680px] bg-[radial-gradient(ellipse,rgba(14,165,233,0.042),rgba(37,99,235,0.022)_38%,transparent_72%)] opacity-0 dark:opacity-28',
  ambientGlowTwo:
    'portal-shell-ambient__glow--two bottom-[-160px] right-[8%] size-[560px] bg-[radial-gradient(ellipse,rgba(37,99,235,0.026),transparent_74%)] opacity-0 dark:opacity-24',
  ambientGrid:
    'portal-shell-ambient__grid absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.018)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.014)_1px,transparent_1px)] bg-[length:56px_56px] opacity-70 [mask-image:radial-gradient(ellipse_at_center,rgba(0,0,0,0.20)_0%,transparent_76%)]',
  signoutCurtain:
    'fixed inset-0 z-[80] grid place-items-center bg-[color-mix(in_srgb,var(--surface-0)_65%,transparent)] backdrop-blur-xl animate-signoutCurtainIn',
  signoutCard:
    'grid min-w-[240px] justify-items-center gap-3 rounded-[var(--ds-card-radius-compact)] border border-line-soft bg-surface-glass-strong px-8 py-7 text-center shadow-[var(--ds-card-shadow-raised)]',
  signoutSpinner:
    'size-10 rounded-full border-[3px] border-line-soft border-r-[var(--brand-primary-end)] border-t-brand-primary animate-signoutSpin',
  signoutTitle: 'text-base text-ink-strong',
  signoutText: 'text-[0.85rem] text-ink-soft',
};

const adminWarmRoutes = [
  '/dashboard',
  '/courses',
  '/structure',
  '/questions',
  '/quizzes',
];

const studentWarmRoutes = [
  '/dashboard',
  '/courses',
  '/flashcards',
  '/quizzes',
  '/exams',
  '/results',
  '/ai-notes',
];

export function AppShell({ children, desktopSidebarToggle = false, desktopSidebarHiddenByDefault = false }) {
  const location = useLocation();
  const warmedRouteKeysRef = useRef(new Set());
  const resizeFrameRef = useRef(null);
  const sidebarMotionStateRef = useRef(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [isMobileNav, setIsMobileNav] = useState(() => {
    return shouldUseMobileNavigation();
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return desktopSidebarHiddenByDefault;
  });
  const [sidebarMotionActive, setSidebarMotionActive] = useState(false);
  const isSigningOut = useAuthStore((state) => state.isSigningOut);
  const user = useAuthStore((state) => state.user);
  const routeSearchParams = new URLSearchParams(location.search);
  const isQuizRoute = /^\/(?:app\/)?quizzes\/[^/]+$/.test(location.pathname);
  const quizMode = routeSearchParams.get('mode') || 'practice';
  const isQuizFocusMode = isQuizRoute && (quizMode === 'exam' || quizMode === 'practice');
  const isAiNoteReaderRoute =
    /^\/(?:app\/|admin\/)?ai-notes\/[^/]+$/.test(location.pathname) ||
    /^\/(?:app\/)?study\/lesson\/[^/]+$/.test(location.pathname);
  const isReviewFocusRoute = /^\/(?:app\/)?review\/[^/]+$/.test(location.pathname);
  const isPracticeReviewFocusRoute = /^\/(?:app\/)?quizzes\/[^/]+\/practice-review$/.test(location.pathname);
  const isStudentResultDetailRoute = /^\/(?:app\/)?results\/[^/]+$/.test(location.pathname);
  const isCompactFocusMode = isQuizFocusMode || isReviewFocusRoute || isPracticeReviewFocusRoute;
  const isAssessmentShellRoute = isCompactFocusMode || isStudentResultDetailRoute;
  const isFocusMode = isCompactFocusMode || isAiNoteReaderRoute;
  const isCollapsedDesktop = desktopSidebarToggle && sidebarCollapsed;
  const effectiveSidebarCollapsed = isCollapsedDesktop;
  const hideGlobalSidebar = isFocusMode;
  const useMobileTopNav = isMobileNav && !hideGlobalSidebar;
  const openSearch = useCallback(() => setSearchOpen(true), []);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const previousCollapsed = sidebarMotionStateRef.current;
    sidebarMotionStateRef.current = effectiveSidebarCollapsed;

    if (!desktopSidebarToggle || hideGlobalSidebar || useMobileTopNav) {
      setSidebarMotionActive(false);
      return undefined;
    }

    if (
      previousCollapsed === null ||
      previousCollapsed === effectiveSidebarCollapsed
    ) {
      return undefined;
    }

    setSidebarMotionActive(true);
    const timer = window.setTimeout(() => setSidebarMotionActive(false), SIDEBAR_MOTION_SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [desktopSidebarToggle, effectiveSidebarCollapsed, hideGlobalSidebar, useMobileTopNav]);

  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); openSearch(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openSearch]);

  useEffect(() => {
    function handleOpenSearch() {
      openSearch();
    }
    window.addEventListener('lms:open-search', handleOpenSearch);
    return () => window.removeEventListener('lms:open-search', handleOpenSearch);
  }, [openSearch]);

  useEffect(() => {
    function handleToggleSidebar() {
      if (isFocusMode) {
        setSidebarOpen(false);
        return;
      }

      if (isMobileNav) {
        setSidebarOpen((current) => !current);
        return;
      }

      if (desktopSidebarToggle) {
        setSidebarCollapsed((current) => !current);
      }
    }

    window.addEventListener('lms:toggle-sidebar', handleToggleSidebar);
    return () => window.removeEventListener('lms:toggle-sidebar', handleToggleSidebar);
  }, [desktopSidebarToggle, isFocusMode, isMobileNav]);

  useEffect(() => {
    function syncNavigationMode() {
      const nextIsMobile = shouldUseMobileNavigation();
      setIsMobileNav((current) => (current === nextIsMobile ? current : nextIsMobile));
      if (!nextIsMobile) setSidebarOpen(false);
    }

    function scheduleNavigationModeSync() {
      if (resizeFrameRef.current) {
        return;
      }

      resizeFrameRef.current = window.requestAnimationFrame(() => {
        resizeFrameRef.current = null;
        syncNavigationMode();
      });
    }

    window.addEventListener('resize', scheduleNavigationModeSync, { passive: true });
    window.addEventListener('orientationchange', scheduleNavigationModeSync, { passive: true });
    syncNavigationMode();
    return () => {
      window.removeEventListener('resize', scheduleNavigationModeSync);
      window.removeEventListener('orientationchange', scheduleNavigationModeSync);
      if (resizeFrameRef.current) {
        window.cancelAnimationFrame(resizeFrameRef.current);
        resizeFrameRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!sidebarOpen || hideGlobalSidebar || typeof document === 'undefined') {
      return undefined;
    }
    if (typeof window !== 'undefined' && window.innerWidth <= 900) {
      return undefined;
    }

    function handleOutsidePointer(event) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('.lms-sidebar')) return;
      if (target.closest('.lms-mobile-top-nav')) return;
      if (target.closest('.lms-topbar-menu-button')) return;
      setSidebarOpen(false);
    }

    document.addEventListener('pointerdown', handleOutsidePointer, true);
    return () => document.removeEventListener('pointerdown', handleOutsidePointer, true);
  }, [hideGlobalSidebar, sidebarOpen]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined;
    }

    const classStates = [
      ['student-assessment-screen', user?.role === 'student' && isAssessmentShellRoute],
      ['student-quiz-focus-screen', user?.role === 'student' && isQuizFocusMode],
    ];

    classStates.forEach(([className, enabled]) => {
      document.body.classList.toggle(className, Boolean(enabled));
    });

    return () => {
      classStates.forEach(([className]) => document.body.classList.remove(className));
    };
  }, [isAssessmentShellRoute, isQuizFocusMode, user?.role]);

  useEffect(() => {
    if (!user?.role || typeof window === 'undefined') {
      return;
    }

    const preloadLimit = PLATFORM.isNative ? (PLATFORM.isPhone ? 2 : 6) : getRoutePreloadLimit();
    if (preloadLimit <= 0) {
      return;
    }

    const routeMode = roleRouteMode(user.role);
    const targets = (routeMode === 'admin' ? adminWarmRoutes : studentWarmRoutes)
      .filter((path) => path !== location.pathname)
      .filter((path) => !warmedRouteKeysRef.current.has(`${user.role}:${path}`))
      .slice(0, preloadLimit);

    const timers = [];
    const warm = () => {
      targets.forEach((path, index) => {
        const delay = PLATFORM.isNative
          ? index * (PLATFORM.isPhone ? 260 : 80)
          : index * 160;
        timers.push(window.setTimeout(() => {
          warmedRouteKeysRef.current.add(`${user.role}:${path}`);
          preloadRouteByPath(path, user.role);
        }, delay));
      });
    };

    let cleanup = () => {};

    if (PLATFORM.isNative && window.__lmsBootComplete !== true) {
      const afterBoot = () => {
        timers.push(window.setTimeout(warm, PLATFORM.isPhone ? 900 : 120));
      };
      document.addEventListener('lms:boot-complete', afterBoot, { once: true });
      cleanup = () => document.removeEventListener('lms:boot-complete', afterBoot);
    } else if ('requestIdleCallback' in window) {
      const idleId = window.requestIdleCallback(warm, { timeout: PLATFORM.isNative ? (PLATFORM.isPhone ? 1400 : 300) : 1200 });
      cleanup = () => window.cancelIdleCallback(idleId);
    } else {
      const timer = window.setTimeout(warm, PLATFORM.isNative ? (PLATFORM.isPhone ? 1000 : 180) : 500);
      cleanup = () => window.clearTimeout(timer);
    }

    return () => {
      cleanup();
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [location.pathname, user?.role]);

  return (
    <div
      className={cx(
        shellUi.shell,
        shellUi.shellMobile,
        'group/shell',
        user?.role === 'student' && 'student-app-shell',
        isStaffUser(user) && 'admin-app-shell',
        isSigningOut && 'signing-out',
        sidebarOpen && 'sidebar-open',
        effectiveSidebarCollapsed && 'sidebar-collapsed',
        sidebarMotionActive && 'sidebar-motion-active',
        useMobileTopNav && 'mobile-top-nav-mode',
        hideGlobalSidebar && 'sidebar-hidden',
        isAiNoteReaderRoute && 'exam-focus-mode',
        isAiNoteReaderRoute && 'ai-note-focus-mode',
        isCompactFocusMode && 'compact-focus-mode',
        isQuizFocusMode && 'quiz-focus-mode',
        isQuizFocusMode && shellUi.shellQuizFocus
      )}
    >
      <div className={shellUi.ambient} aria-hidden="true">
        <span className={cx(shellUi.ambientGlow, shellUi.ambientGlowOne)} />
        <span className={cx(shellUi.ambientGlow, shellUi.ambientGlowTwo)} />
        <span className={shellUi.ambientGrid} />
      </div>

      {!hideGlobalSidebar && !useMobileTopNav ? (
        <AppSidebar
          isOpen={sidebarOpen}
          isCollapsed={effectiveSidebarCollapsed}
          isAnimating={sidebarMotionActive}
          isOverlayNav={false}
          isExamFocusMode={isFocusMode}
          onClose={() => setSidebarOpen(false)}
          onSearchOpen={openSearch}
        />
      ) : null}

      <MobileTopNav
        isOpen={useMobileTopNav && sidebarOpen}
        isExamFocusMode={isFocusMode}
        onClose={() => setSidebarOpen(false)}
      />

      <MobileBottomNav isExamFocusMode={isFocusMode} onNavigate={() => setSidebarOpen(false)} />

      {searchOpen && <GlobalSearch onClose={() => setSearchOpen(false)} />}

      <div className="app-safe-top-spacer" aria-hidden="true" />

      <main
        className={cx(
          shellUi.content,
          isAiNoteReaderRoute && shellUi.contentAiFocus,
          (hideGlobalSidebar || useMobileTopNav) && shellUi.contentCompactFocus,
          isQuizFocusMode && shellUi.contentQuizFocus,
          isSigningOut && shellUi.contentSigningOut,
        )}
      >
        <div className={cx(shellUi.frame, isQuizFocusMode && shellUi.frameQuizFocus)}>{children}</div>
      </main>

      {isSigningOut && (
        <div className={shellUi.signoutCurtain} aria-hidden="true">
          <div className={shellUi.signoutCard}>
            <span className={shellUi.signoutSpinner} />
            <strong className={shellUi.signoutTitle}>Signing you out</strong>
            <small className={shellUi.signoutText}>Closing your workspace smoothly...</small>
          </div>
        </div>
      )}
    </div>
  );
}
