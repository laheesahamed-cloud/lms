import { useEffect, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { AppSidebar } from './AppSidebar.jsx';
import { GlobalSearch } from '../search/GlobalSearch.jsx';
import { useAuthStore } from '../../stores/authStore.js';
import { preloadRouteByPath } from '../../app/router.jsx';
import { getRoutePreloadLimit } from '../../utils/performanceProfile.js';
import { cx, ui } from '../../styles/tailwindClasses.js';

const SIDEBAR_COLLAPSE_STORAGE_KEY = 'lms.sidebar.collapsed';
const sidebarOverlayClass =
  'fixed inset-0 z-[810] border-0 bg-slate-950/55 backdrop-blur-lg animate-overlayIn max-[900px]:block min-[901px]:hidden';
const shellUi = {
  shell:
    'portal-shell relative isolate block min-h-dvh overflow-x-hidden overflow-y-visible bg-[var(--page-background)] [.theme-transition_&]:!transition-none [.theme-soft-transition_&]:!transition-[background-color,color,border-color] [.theme-soft-transition_&]:!duration-[160ms] [.theme-soft-transition_&]:!ease-[var(--ease-out)]',
  shellMobile: '',
  shellQuizFocus: '',
  content:
    'portal-content relative z-[1] min-h-dvh min-w-0 overflow-x-hidden overflow-y-visible pb-6 [-webkit-overflow-scrolling:touch] min-[901px]:ml-[calc(var(--sidebar-w)_+_var(--sidebar-shell-gap))] min-[901px]:w-[calc(100%_-_var(--sidebar-w)_-_var(--sidebar-shell-gap))] max-[900px]:ml-0 max-[900px]:w-full max-[900px]:pt-0',
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
    'portal-shell-ambient__glow--one left-[20%] top-[-120px] size-[680px] bg-[radial-gradient(ellipse,rgba(20,184,166,0.042),rgba(37,99,235,0.022)_38%,transparent_72%)] opacity-0 dark:opacity-28',
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') {
      return desktopSidebarHiddenByDefault;
    }
    const saved = window.localStorage.getItem(SIDEBAR_COLLAPSE_STORAGE_KEY);
    if (saved === 'true') return true;
    if (saved === 'false') return false;
    return desktopSidebarHiddenByDefault;
  });
  const isSigningOut = useAuthStore((state) => state.isSigningOut);
  const user = useAuthStore((state) => state.user);
  const routeSearchParams = new URLSearchParams(location.search);
  const isQuizRoute = /^\/quizzes\/[^/]+$/.test(location.pathname);
  const quizMode = routeSearchParams.get('mode') || 'practice';
  const isQuizFocusMode = isQuizRoute && (quizMode === 'exam' || quizMode === 'practice');
  const isAiNoteReaderRoute = /^\/ai-notes\/[^/]+$/.test(location.pathname);
  const isReviewFocusRoute = /^\/review\/[^/]+$/.test(location.pathname);
  const isPracticeReviewFocusRoute = /^\/quizzes\/[^/]+\/practice-review$/.test(location.pathname);
  const isQuestionBankRoute = /^\/questions(?:\/|$)/.test(location.pathname);
  const isQuizBuilderRoute = /^\/quizzes\/new$/.test(location.pathname) || /^\/quizzes\/[^/]+\/edit$/.test(location.pathname);
  const isCompactFocusMode = isQuizFocusMode || isReviewFocusRoute || isPracticeReviewFocusRoute;
  const isFocusMode = isCompactFocusMode || isAiNoteReaderRoute;

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

      if (window.innerWidth <= 900) {
        setSidebarOpen((current) => !current);
        return;
      }

      if (desktopSidebarToggle) {
        setSidebarCollapsed((current) => !current);
      }
    }

    window.addEventListener('lms:toggle-sidebar', handleToggleSidebar);
    return () => window.removeEventListener('lms:toggle-sidebar', handleToggleSidebar);
  }, [desktopSidebarToggle, isFocusMode]);

  useEffect(() => {
    function handleResize() {
      if (window.innerWidth > 900) setSidebarOpen(false);
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(SIDEBAR_COLLAPSE_STORAGE_KEY, String(sidebarCollapsed));
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

    const preloadLimit = getRoutePreloadLimit();
    if (preloadLimit <= 0) {
      return;
    }

    const targets = (user.role === 'admin' ? adminWarmRoutes : studentWarmRoutes)
      .filter((path) => path !== location.pathname)
      .slice(0, preloadLimit);

    const timers = [];
    const warm = () => {
      targets.forEach((path, index) => {
        timers.push(window.setTimeout(() => preloadRouteByPath(path, user.role), index * 160));
      });
    };

    let cleanup = () => {};

    if ('requestIdleCallback' in window) {
      const idleId = window.requestIdleCallback(warm, { timeout: 1200 });
      cleanup = () => window.cancelIdleCallback(idleId);
    } else {
      const timer = window.setTimeout(warm, 500);
      cleanup = () => window.clearTimeout(timer);
    }

    return () => {
      cleanup();
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [location.pathname, user?.role]);

  const isCollapsedDesktop = desktopSidebarToggle && sidebarCollapsed;
  const effectiveSidebarCollapsed = isCollapsedDesktop;
  const hideGlobalSidebar = isFocusMode;

  return (
    <div
      className={cx(
        shellUi.shell,
        shellUi.shellMobile,
        'group/shell',
        isSigningOut && 'signing-out',
        effectiveSidebarCollapsed && 'sidebar-collapsed',
        hideGlobalSidebar && 'sidebar-hidden',
        isAiNoteReaderRoute && 'exam-focus-mode',
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

      {/* Mobile overlay */}
      {sidebarOpen && !hideGlobalSidebar && (
        <button className={sidebarOverlayClass}
          type="button"
         
          onClick={() => setSidebarOpen(false)}
          aria-label="Close navigation"
        />
      )}

      {!hideGlobalSidebar ? (
        <AppSidebar
          isOpen={sidebarOpen}
          isCollapsed={effectiveSidebarCollapsed}
          isExamFocusMode={isFocusMode}
          onClose={() => setSidebarOpen(false)}
          onSearchOpen={openSearch}
          onToggleCollapse={desktopSidebarToggle ? () => setSidebarCollapsed((c) => !c) : undefined}
        />
      ) : null}

      {searchOpen && <GlobalSearch onClose={() => setSearchOpen(false)} />}

      <main
        className={cx(
          shellUi.content,
          effectiveSidebarCollapsed && !hideGlobalSidebar && shellUi.contentCollapsed,
          isAiNoteReaderRoute && shellUi.contentAiFocus,
          hideGlobalSidebar && shellUi.contentCompactFocus,
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
