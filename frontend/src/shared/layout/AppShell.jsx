import { useEffect, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { AppSidebar, MobileBottomNav, MobileTopNav } from './AppSidebar.jsx';
import { GlobalSearch } from '../search/GlobalSearch.jsx';
import { detectPlatform } from '../platform/detect.js';
import { shouldUseOverlayNavigation } from '../platform/config.js';
import { useAuthStore } from '../stores/authStore.js';
import { preloadRouteByPath } from '../../app/router.jsx';
import { getRoutePreloadLimit } from '../utils/performanceProfile.js';
import { cx } from '../styles/tailwindClasses.js';

const PLATFORM = detectPlatform();
const SIDEBAR_COLLAPSE_STORAGE_KEY = 'lms.sidebar.collapsed';
const shellUi = {
  shell:
    'app app-shell main-layout portal-shell relative isolate block min-h-[100dvh] overflow-x-hidden bg-[#F5F6FF] [.theme-transition_&]:!transition-none [.theme-soft-transition_&]:!transition-[background-color,color,border-color] [.theme-soft-transition_&]:!duration-[160ms] [.theme-soft-transition_&]:!ease-[var(--ease-out)] dark:bg-[#05070d]',
  shellMobile: '',
  shellQuizFocus: '',
  content:
    'main-content app-content page-content portal-content relative z-[1] min-h-[100dvh] min-w-0 overflow-x-hidden overflow-y-visible pb-[var(--lms-mobile-content-bottom)] [-webkit-overflow-scrolling:touch] min-[901px]:ml-[calc(var(--sidebar-w)_+_var(--sidebar-shell-gap))] min-[901px]:w-[calc(100%_-_var(--sidebar-w)_-_var(--sidebar-shell-gap))] min-[901px]:pb-6 max-[900px]:ml-0 max-[900px]:w-full max-[900px]:pt-0',
  contentCollapsed:
    'min-[901px]:ml-[calc(var(--sidebar-w-collapsed)_+_var(--sidebar-shell-gap))] min-[901px]:w-[calc(100%_-_var(--sidebar-w-collapsed)_-_var(--sidebar-shell-gap))]',
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
    'grid min-w-[240px] justify-items-center gap-3 rounded-xl border border-line-soft bg-surface-glass-strong px-8 py-7 text-center shadow-2xl',
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [tabletOverlayNav, setTabletOverlayNav] = useState(() => {
    return shouldUseOverlayNavigation(detectPlatform());
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') {
      return desktopSidebarHiddenByDefault;
    }
    try {
      const saved = window.localStorage.getItem(SIDEBAR_COLLAPSE_STORAGE_KEY);
      if (saved === 'true') return true;
      if (saved === 'false') return false;
    } catch {
      return desktopSidebarHiddenByDefault;
    }
    return desktopSidebarHiddenByDefault;
  });
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
  const isQuestionBankRoute = /^\/questions(?:\/|$)/.test(location.pathname);
  const isQuizBuilderRoute = /^\/quizzes\/new$/.test(location.pathname) || /^\/quizzes\/[^/]+\/edit$/.test(location.pathname);
  const isCompactFocusMode = isQuizFocusMode || isReviewFocusRoute || isPracticeReviewFocusRoute;
  const isFocusMode = isCompactFocusMode || isAiNoteReaderRoute;
  const isCollapsedDesktop = desktopSidebarToggle && sidebarCollapsed && !tabletOverlayNav;
  const effectiveSidebarCollapsed = isCollapsedDesktop;
  const hideGlobalSidebar = isFocusMode;

  const openSearch = useCallback(() => setSearchOpen(true), []);

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

      if (window.innerWidth <= 900 || tabletOverlayNav) {
        setSidebarOpen((current) => !current);
        return;
      }

      if (desktopSidebarToggle) {
        setSidebarCollapsed((current) => !current);
      }
    }

    window.addEventListener('lms:toggle-sidebar', handleToggleSidebar);
    return () => window.removeEventListener('lms:toggle-sidebar', handleToggleSidebar);
  }, [desktopSidebarToggle, isFocusMode, tabletOverlayNav]);

  useEffect(() => {
    function handleResize() {
      if (window.innerWidth > 900 && !tabletOverlayNav) setSidebarOpen(false);
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [tabletOverlayNav]);

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
    if (typeof window === 'undefined') return undefined;
    const tabletMedia = window.matchMedia('(min-width: 901px) and (max-width: 1366px) and (orientation: landscape)');
    const pointerMedia = window.matchMedia('(pointer: coarse), (any-pointer: coarse)');
    const updateTabletOverlay = () => {
      const next = shouldUseOverlayNavigation(detectPlatform());
      setTabletOverlayNav(next);
      if (!next) setSidebarOpen(false);
    };

    updateTabletOverlay();
    tabletMedia.addEventListener?.('change', updateTabletOverlay);
    pointerMedia.addEventListener?.('change', updateTabletOverlay);
    window.addEventListener('resize', updateTabletOverlay);
    window.addEventListener('orientationchange', updateTabletOverlay);

    return () => {
      tabletMedia.removeEventListener?.('change', updateTabletOverlay);
      pointerMedia.removeEventListener?.('change', updateTabletOverlay);
      window.removeEventListener('resize', updateTabletOverlay);
      window.removeEventListener('orientationchange', updateTabletOverlay);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      window.localStorage.setItem(SIDEBAR_COLLAPSE_STORAGE_KEY, String(sidebarCollapsed));
    } catch {
      // Sidebar preference persistence is optional in embedded WebViews.
    }
  }, [sidebarCollapsed]);

  useEffect(() => {
    if ((isQuestionBankRoute || isQuizBuilderRoute) && desktopSidebarToggle) {
      setSidebarCollapsed(true);
    }
  }, [desktopSidebarToggle, isQuestionBankRoute, isQuizBuilderRoute, location.pathname]);

  useEffect(() => {
    if (!user?.role || typeof window === 'undefined') {
      return;
    }

    const preloadLimit = PLATFORM.isNative ? (PLATFORM.isPhone ? 2 : 6) : getRoutePreloadLimit();
    if (preloadLimit <= 0) {
      return;
    }

    const targets = (user.role === 'admin' ? adminWarmRoutes : studentWarmRoutes)
      .filter((path) => path !== location.pathname)
      .slice(0, preloadLimit);

    const timers = [];
    const warm = () => {
      targets.forEach((path, index) => {
        const delay = PLATFORM.isNative
          ? index * (PLATFORM.isPhone ? 260 : 80)
          : index * 160;
        timers.push(window.setTimeout(() => preloadRouteByPath(path, user.role), delay));
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
        user?.role === 'admin' && 'admin-app-shell',
        isSigningOut && 'signing-out',
        effectiveSidebarCollapsed && 'sidebar-collapsed',
        tabletOverlayNav && 'tablet-overlay-nav',
        hideGlobalSidebar && 'sidebar-hidden',
        isAiNoteReaderRoute && 'exam-focus-mode',
        isAiNoteReaderRoute && 'ai-note-focus-mode',
        isCompactFocusMode && 'compact-focus-mode',
        isQuizFocusMode && 'quiz-focus-mode',
        isQuizFocusMode && shellUi.shellQuizFocus
      )}
    >
      <div className={shellUi.ambient} aria-hidden="true">
        <span className="main-glow" />
        <span className={cx(shellUi.ambientGlow, shellUi.ambientGlowOne)} />
        <span className={cx(shellUi.ambientGlow, shellUi.ambientGlowTwo)} />
        <span className={shellUi.ambientGrid} />
      </div>

      {!hideGlobalSidebar ? (
        <AppSidebar
          isOpen={sidebarOpen}
          isCollapsed={effectiveSidebarCollapsed}
          isOverlayNav={tabletOverlayNav}
          isExamFocusMode={isFocusMode}
          onClose={() => setSidebarOpen(false)}
          onSearchOpen={openSearch}
        />
      ) : null}

      <MobileTopNav
        isOpen={sidebarOpen}
        isExamFocusMode={isFocusMode}
        onClose={() => setSidebarOpen(false)}
      />

      <MobileBottomNav isExamFocusMode={isFocusMode} onNavigate={() => setSidebarOpen(false)} />

      {searchOpen && <GlobalSearch onClose={() => setSearchOpen(false)} />}

      <div className="app-safe-top-spacer" aria-hidden="true" />

      <main
        className={cx(
          shellUi.content,
          effectiveSidebarCollapsed && !hideGlobalSidebar && shellUi.contentCollapsed,
          isAiNoteReaderRoute && shellUi.contentAiFocus,
          (hideGlobalSidebar || tabletOverlayNav) && shellUi.contentCompactFocus,
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
