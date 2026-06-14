import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { fetchNotifications, markNotificationRead } from '../api/workspace.api.js';
import { useAuthStore } from '../stores/authStore.js';
import { ProfileAvatar } from '../ui/ProfileAvatar.jsx';
import { ThemeToggle } from './ThemeToggle.jsx';
import { HeaderInstallAction } from './HeaderInstallAction.jsx';
import { getStaffRoleLabel, isStaffUser, roleRouteMode, userHasPermission } from '../auth/roleAccess.js';
import { cx } from '../styles/tailwindClasses.js';
import { getAdminUserIdentifier, getAdminUserSecondaryIdentifier } from '../utils/userIdentity.js';
import { preloadRouteByPath } from '../../app/routePreloading.js';
import { headerRouteIsFocus } from '../routing/isChevronRoute.js';
import { useHeaderStore } from '../stores/headerStore.js';
import { resolveStudentHeader } from './studentHeaderConfig.js';
import { detectPlatform } from '../platform/detect.js';

const PROFILE_MENU_EXIT_MS = 180;
const PROFILE_MENU_ID = 'lms-profile-menu';
const NOTIFICATION_MENU_ID = 'lms-notification-menu';
const PLATFORM = detectPlatform();

function areStyleObjectsEqual(current, next) {
  if (current === next) return true;
  if (!current || !next) return false;
  const currentKeys = Object.keys(current);
  const nextKeys = Object.keys(next);
  if (currentKeys.length !== nextKeys.length) return false;
  return currentKeys.every((key) => current[key] === next[key]);
}

function updateStyleIfChanged(ref, setter, nextStyle) {
  if (areStyleObjectsEqual(ref.current, nextStyle)) {
    return;
  }

  ref.current = nextStyle;
  setter(nextStyle);
}

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M9 2.75a3.5 3.5 0 0 0-3.5 3.5v1.1c0 .82-.2 1.63-.6 2.35L3.85 11.6a1 1 0 0 0 .87 1.5h8.56a1 1 0 0 0 .87-1.5L13.1 9.7a4.83 4.83 0 0 1-.6-2.35v-1.1A3.5 3.5 0 0 0 9 2.75Z"
        stroke="currentColor"
        strokeWidth="1.55"
        strokeLinejoin="round"
      />
      <path d="M7.2 14.2a1.95 1.95 0 0 0 3.6 0" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="4.75" stroke="currentColor" strokeWidth="1.55" />
      <path d="M11.5 11.5 15 15" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" />
    </svg>
  );
}

function NavToggleIcon() {
  return (
    <span className="lms-nav-toggle-icon" aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4.5 4.5 11.5 11.5M11.5 4.5 4.5 11.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function BackChevronIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M8 2.2v1.4M8 12.4v1.4M13.8 8h-1.4M3.6 8H2.2M12.1 3.9l-1 1M4.9 11.1l-1 1M12.1 12.1l-1-1M4.9 4.9l-1-1"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="5.25" r="2.35" stroke="currentColor" strokeWidth="1.4" />
      <path d="M3.5 13.25c.62-2.25 2.28-3.55 4.5-3.55s3.88 1.3 4.5 3.55" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M6 2.75H4.75A1.75 1.75 0 0 0 3 4.5v7a1.75 1.75 0 0 0 1.75 1.75H6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M9.25 5.25 12 8l-2.75 2.75" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.5 8H12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function useOutsideDismiss(ref, onDismiss, enabled = true) {
  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    function handlePointerDown(event) {
      const refs = Array.isArray(ref) ? ref : [ref];
      const activeRefs = refs.filter((item) => item.current);
      if (!activeRefs.length || activeRefs.some((item) => item.current.contains(event.target))) {
        return;
      }
      onDismiss();
    }

    function handleEscape(event) {
      if (event.key === 'Escape') {
        onDismiss();
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [enabled, ref, onDismiss]);
}

function formatNotificationTime(value) {
  if (!value) {
    return 'Just now';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Recently';
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function getNotificationTimestamp(item) {
  const value = item?.publishAt || item?.createdAt || item?.updatedAt || '';
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function sortLatestNotifications(items) {
  return [...items].sort((a, b) => getNotificationTimestamp(b) - getNotificationTimestamp(a));
}

// Immersive/reading student routes that use the compact header only (no large
// title) come from the shared chevron-route helper, so the header and the
// native route transition share one source of truth.

const topbarUi = {
  header:
    'lms-topbar glass-card sticky top-3 z-50 mb-3 flex min-h-[66px] min-w-0 flex-wrap items-center justify-between gap-3 overflow-visible rounded-xl px-4 py-2.5 max-[900px]:top-2 max-[900px]:min-h-[58px] max-[900px]:rounded-[16px] max-[900px]:p-2.5 max-[760px]:grid max-[760px]:grid-cols-[minmax(0,1fr)_auto] max-[760px]:items-center max-[760px]:gap-x-2 max-[760px]:gap-y-2 max-[520px]:min-h-[54px] max-[520px]:rounded-[14px] max-[520px]:px-2.5 max-[520px]:py-2',
  left: 'flex min-w-[180px] flex-1 items-center gap-2.5 self-center max-[760px]:min-w-0 max-[520px]:gap-1',
  titleBlock: 'grid min-w-0 max-w-full gap-0.5',
  title: 'gradient-text m-0 truncate text-[var(--type-size-xl)] font-bold leading-[var(--type-leading-tight)]',
  subtitle: 'm-0 max-w-[min(420px,36vw)] truncate text-[11px] font-semibold leading-tight text-ink-soft max-[900px]:hidden',
  center: 'flex min-w-0 w-full max-w-[260px] justify-center max-[1280px]:hidden',
  search:
    'flex h-10 min-h-10 w-full max-w-[232px] items-center gap-2 rounded-lg border border-line-soft bg-[var(--btn-secondary-bg)] px-3 text-ink-soft shadow-none transition-[background,border-color,color] duration-150 ease-[var(--ease-out)] hover:border-brand-primary/22 hover:bg-surface-2 hover:text-ink-strong',
  searchIcon: 'grid shrink-0 place-items-center text-brand-primary',
  searchCopy: 'min-w-0 flex-1 truncate text-left text-[12.5px] font-semibold',
  searchShortcut: 'shrink-0 rounded-md bg-brand-primary-light px-1.5 py-0.5 text-[11px] font-bold text-brand-primary max-[1360px]:hidden',
  right: 'flex min-w-0 shrink-0 items-center justify-end gap-2 self-center max-[760px]:w-auto max-[760px]:justify-end max-[520px]:gap-1',
  mobileMenuButton:
    'lms-topbar-menu-button hidden size-9 min-h-9 shrink-0 items-center justify-center rounded-lg border border-line-soft bg-[var(--btn-secondary-bg)] p-0 text-ink-medium shadow-none transition-[background,border-color,color] duration-150 ease-out hover:border-brand-primary/24 hover:bg-brand-primary/10 hover:text-brand-primary max-[900px]:inline-flex max-[520px]:size-11 max-[520px]:min-h-11 max-[520px]:min-w-11 group-[.sidebar-hidden]/shell:!hidden',
  actionsSlot: 'flex min-w-0 flex-wrap items-center justify-end gap-2 max-[760px]:col-span-2 max-[760px]:w-full max-[760px]:justify-start max-[760px]:border-t max-[760px]:border-line-soft max-[760px]:pt-2 max-[520px]:grid max-[520px]:grid-cols-1 max-[520px]:[&>*]:w-full',
  utility: 'lms-topbar-utility flex min-w-0 shrink-0 items-center gap-2 max-[520px]:grid max-[520px]:grid-flow-col max-[520px]:auto-cols-[44px] max-[520px]:gap-1 [&_.lms-profile-avatar]:max-[520px]:size-7 [&_.lms-profile-avatar]:max-[520px]:rounded-lg [&_.lms-profile-avatar]:max-[520px]:justify-self-center',
  iconButton:
    'relative inline-flex size-9 min-h-9 shrink-0 items-center justify-center rounded-lg border border-line-soft bg-[var(--btn-secondary-bg)] p-0 text-ink-medium shadow-none transition-[background,border-color,color] duration-150 ease-[var(--ease-out)] hover:border-brand-primary/24 hover:bg-brand-primary/10 hover:text-brand-primary max-[520px]:size-11 max-[520px]:min-h-11 max-[520px]:min-w-11',
  countBadge:
    'absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full border-2 border-surface-card bg-[#991b1b] px-1 text-[11px] font-extrabold leading-4 text-white',
  profileButton:
    'inline-flex size-9 min-h-9 min-w-9 shrink-0 items-center justify-center rounded-lg border border-line-soft bg-[var(--btn-secondary-bg)] p-1 text-left shadow-none transition-[background,border-color,color] duration-150 ease-[var(--ease-out)] hover:border-brand-primary/24 hover:bg-brand-primary/10 max-[520px]:size-11 max-[520px]:min-h-11 max-[520px]:min-w-11',
  menuWrap: 'lms-topbar-menu-wrap',
  dropdown:
    'lms-floating-panel motion-smooth absolute right-0 top-[calc(100%+8px)] z-[1200] w-[min(360px,calc(100vw_-_24px))] origin-top-right overflow-hidden rounded-[var(--radius-lg)] border border-line-soft bg-surface-card-elevated shadow-[var(--ds-floating-shadow)] animate-overlayIn',
  profileDropdown:
    'lms-profile-menu w-[min(320px,calc(100vw_-_24px))]',
  notificationDropdown:
    'w-[min(330px,calc(100vw_-_24px))] max-[520px]:max-h-[calc(100dvh-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)-76px)]',
  dropdownHead:
    'flex min-w-0 items-center justify-between gap-3 border-b border-line-soft px-4 py-3.5 max-[520px]:px-3.5 max-[520px]:py-3 [&_div]:min-w-0 [&_small]:mt-1 [&_small]:block [&_small]:truncate [&_small]:text-xs [&_small]:font-medium [&_small]:text-ink-soft [&_strong]:block [&_strong]:truncate [&_strong]:text-sm [&_strong]:font-extrabold [&_strong]:text-ink-strong',
  dropdownClose:
    'inline-flex size-8 min-h-8 min-w-8 shrink-0 items-center justify-center rounded-lg border border-line-soft bg-[var(--btn-secondary-bg)] p-0 text-ink-soft transition-[background,border-color,color,transform] duration-150 ease-[var(--ease-out)] hover:border-brand-primary/24 hover:bg-brand-primary/10 hover:text-brand-primary active:scale-[0.96] max-[520px]:size-10 max-[520px]:min-h-10 max-[520px]:min-w-10',
  dropdownSection: 'grid gap-1 border-t border-line-soft p-2 first:border-t-0',
  notificationList: 'grid max-h-[min(320px,calc(100dvh-210px))] gap-1 overflow-y-auto overscroll-contain p-2 [-webkit-overflow-scrolling:touch] max-[520px]:max-h-[calc(100dvh-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)-178px)] max-[520px]:p-1.5 max-[380px]:max-h-[calc(100dvh-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)-168px)]',
  notificationItem:
    'grid min-h-0 w-full grid-cols-[8px_minmax(0,1fr)] items-start gap-2 rounded-[var(--radius-sm)] border-0 bg-transparent px-2.5 py-2 text-left transition-colors duration-150 hover:bg-surface-2 active:bg-surface-2 max-[520px]:min-h-12 max-[520px]:gap-2 max-[380px]:px-2',
  notificationItemRead: 'opacity-80',
  notificationDot: 'mt-1.5 size-2 rounded-full bg-brand-primary max-[520px]:mt-2',
  notificationDotRead: 'bg-ink-muted/35',
  notificationCopy: 'grid min-w-0 gap-0.5 [&_p]:m-0 [&_p]:line-clamp-2 [&_p]:break-words [&_p]:text-[11.5px] [&_p]:leading-snug [&_p]:text-ink-soft [&_small]:text-[10.5px] [&_small]:font-semibold [&_small]:text-ink-muted [&_strong]:line-clamp-1 [&_strong]:break-words [&_strong]:text-[12.5px] [&_strong]:leading-snug [&_strong]:text-ink-strong',
  dropdownFoot: 'border-t border-line-soft p-2 max-[520px]:p-1.5',
  notificationPageLink:
    'inline-flex min-h-8 w-full items-center justify-center rounded-[var(--radius-sm)] bg-transparent px-2 text-[12.5px] font-extrabold text-brand-primary underline-offset-4 hover:underline',
  menuItem:
    'flex min-h-10 w-full items-center justify-start gap-2.5 rounded-xl border-0 bg-transparent px-3 py-2 text-sm font-semibold text-ink-medium shadow-none transition-[background,color] duration-150 ease-[var(--ease-out)] hover:bg-surface-2 hover:text-ink-strong hover:shadow-none active:shadow-none',
  dangerItem: 'text-brand-error',
  emptyState: 'grid gap-1 px-5 py-8 text-center [&_p]:m-0 [&_p]:text-xs [&_p]:text-ink-soft [&_strong]:text-sm [&_strong]:text-ink-strong',
  mobileCopy: 'hidden',
};

const breadcrumbUi = {
  nav: 'lms-route-breadcrumbs min-w-0 overflow-hidden',
  list:
    'm-0 flex min-w-0 list-none items-center gap-1 p-0 text-[11px] font-bold leading-tight text-ink-muted',
  item: 'flex min-w-0 items-center gap-1',
  button:
    'min-w-0 max-w-[12rem] truncate rounded-md px-1 py-0.5 text-ink-muted transition-colors duration-150 hover:text-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/25',
  plain: 'min-w-0 max-w-[12rem] truncate text-ink-muted',
  current: 'min-w-0 max-w-[16rem] truncate px-1 py-0.5 text-ink-soft',
  currentPlain: 'min-w-0 max-w-[16rem] truncate text-ink-soft',
  separator: 'text-ink-muted/55',
};

const breadcrumbHomeLabels = {
  admin: 'Admin Hub',
  student: 'Study Hub',
};

const breadcrumbRouteLabels = {
  admin: {
    '/dashboard': 'Admin Hub',
    '/profile': 'Profile',
    '/courses': 'Courses',
    '/structure': 'Structure',
    '/questions': 'Questions',
    '/questions/bulk': 'Bulk Question Input',
    '/question-reports': 'Question Reports',
    '/quizzes': 'Assessments',
    '/quizzes/new': 'Create Assessment',
    '/subscriptions': 'Subscriptions',
    '/finance': 'Finance',
    '/ai-notes': 'Lessons',
    '/announcements': 'Announcements',
    '/reports': 'Reports',
    '/setup': 'Setup',
    '/settings': 'Settings',
    '/users': 'Users',
  },
  student: {
    '/dashboard': 'Study Hub',
    '/profile': 'Profile',
    '/courses': 'Courses',
    '/quizzes': 'Q-Bank',
    '/exams': 'Exams',
    '/subscriptions': 'Subscriptions',
    '/subscriptions/checkout': 'Checkout',
    '/bookmarks': 'Saved',
    '/notifications': 'Notifications',
    '/planner': 'Planner',
    '/flashcards': 'Flashcards',
    '/notes': 'Notes',
    '/study': 'Lessons',
    '/ai-notes': 'Lessons',
    '/results': 'Results',
    '/review': 'Review',
  },
};

const breadcrumbSegmentLabels = {
  ai: 'AI Tools',
  bulk: 'Bulk Question Input',
  checkout: 'Checkout',
  edit: 'Edit',
  lesson: 'Lesson',
  new: 'Create Assessment',
  practiceReview: 'Practice Review',
  'practice-review': 'Practice Review',
  review: 'Review',
  study: 'Lessons',
};

function normalizeRoutePath(pathname) {
  const cleanPath = String(pathname || '/')
    .replace(/^\/(?:admin|app|student)(?=\/|$)/, '')
    .replace(/\/+$/, '');
  return cleanPath || '/dashboard';
}

function resolveBreadcrumbMode(pathname, user) {
  if (pathname?.startsWith('/admin')) return 'admin';
  if (pathname?.startsWith('/app') || pathname?.startsWith('/student')) return 'student';
  return roleRouteMode(user?.role);
}

function titleCaseSegment(segment) {
  if (!segment) return '';
  if (/^\d+$/.test(segment) || /^[0-9a-f-]{12,}$/i.test(segment)) return 'Detail';
  return String(segment)
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getBreadcrumbLabel(mode, cleanPath, fallback = '') {
  const labels = breadcrumbRouteLabels[mode] || breadcrumbRouteLabels.student;
  if (labels[cleanPath]) return labels[cleanPath];
  const parts = cleanPath.split('/').filter(Boolean);
  const last = parts.at(-1) || '';
  return breadcrumbSegmentLabels[last] || fallback || titleCaseSegment(last);
}

function buildBreadcrumbItems(pathname, user, title) {
  const mode = resolveBreadcrumbMode(pathname, user);
  const cleanPath = normalizeRoutePath(pathname);
  const parts = cleanPath.split('/').filter(Boolean);
  if (parts.length < 2) return [];

  const prefix = mode === 'admin' ? '/admin' : '/app';
  const home = {
    label: breadcrumbHomeLabels[mode] || breadcrumbHomeLabels.student,
    to: `${prefix}/dashboard`,
  };
  const baseCleanPath = `/${parts[0]}`;
  const base = {
    label: getBreadcrumbLabel(mode, baseCleanPath, titleCaseSegment(parts[0])),
    to: `${prefix}${baseCleanPath}`,
  };
  const current = {
    label: getBreadcrumbLabel(mode, cleanPath, title),
  };

  if (current.label === base.label) {
    current.label = title || titleCaseSegment(parts.at(-1));
  }

  return [home, base, current].filter((item, index, items) => {
    return index === 0 || item.label !== items[index - 1]?.label;
  });
}

function RouteBreadcrumbs({ items, onNavigate, className = '', interactive = true, uppercaseCurrent = false }) {
  if (!items.length) return null;

  return (
    <nav className={cx(breadcrumbUi.nav, className)} aria-label="Breadcrumb">
      <ol className={breadcrumbUi.list}>
        {items.map((item, index) => {
          const isCurrent = index === items.length - 1;
          const label = uppercaseCurrent && isCurrent ? item.label.toUpperCase() : item.label;
          return (
            <li className={breadcrumbUi.item} key={`${item.label}-${index}`}>
              {index > 0 ? <span className={breadcrumbUi.separator} aria-hidden="true">/</span> : null}
              {isCurrent || !item.to || !interactive ? (
                <span
                  className={interactive ? (isCurrent ? breadcrumbUi.current : breadcrumbUi.button) : (isCurrent ? breadcrumbUi.currentPlain : breadcrumbUi.plain)}
                  aria-current={isCurrent ? 'page' : undefined}
                >
                  {label}
                </span>
              ) : (
                <button type="button" className={breadcrumbUi.button} onClick={() => onNavigate(item.to)}>
                  {label}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function rolePath(path, role) {
  if (!path) return '';
  if (path.startsWith('/admin') || path.startsWith('/app')) return path;
  return `${roleRouteMode(role) === 'admin' ? '/admin' : '/app'}${path}`;
}

export function AppHeader({ title, subtitle, actions = null, className = '', breadcrumbPlacement = 'above', breadcrumbInteractive = true, breadcrumbUppercaseCurrent = false, back = false, backTo = null, compact = false, surface = 'page' }) {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  // surface === 'shell' is the single persistent bar rendered once by AppShell
  // (like MobileBottomNav); surface === 'page' is what each page renders — it now
  // only publishes its descriptor + renders the in-flow large title/spacer.
  const isShellSurface = surface === 'shell';
  const headerOverride = useHeaderStore((state) => state.override);
  const setHeaderOverride = useHeaderStore((state) => state.setOverride);
  const signOut = useAuthStore((state) => state.signOut);
  const isSigningOut = useAuthStore((state) => state.isSigningOut);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileClosing, setProfileClosing] = useState(false);
  const notificationRef = useRef(null);
  const notificationButtonRef = useRef(null);
  const notificationButtonLayerRef = useRef(null);
  const notificationMenuRef = useRef(null);
  const notificationPositionFrameRef = useRef(null);
  const notificationMenuStyleRef = useRef(null);
  const notificationButtonStyleRef = useRef(null);
  const profileRef = useRef(null);
  const profileButtonRef = useRef(null);
  const profileAvatarLayerRef = useRef(null);
  const profileMenuRef = useRef(null);
  const barRef = useRef(null);
  const largeTitleRef = useRef(null);
  const profileCloseTimerRef = useRef(null);
  const profilePositionFrameRef = useRef(null);
  const profileMenuStyleRef = useRef(null);
  const profileAvatarStyleRef = useRef(null);
  const previousPathRef = useRef(location.pathname);
  const [profileMenuStyle, setProfileMenuStyle] = useState(null);
  const [profileAvatarStyle, setProfileAvatarStyle] = useState(null);
  const [notificationMenuStyle, setNotificationMenuStyle] = useState(null);
  const [notificationButtonStyle, setNotificationButtonStyle] = useState(null);
  const profileVisible = profileOpen || profileClosing;
  // iOS large-title header (student): a compact bar is portaled to <body> on
  // ALL platforms (the route wrapper keeps a residual transform that would
  // break position:sticky/fixed for in-page descendants), while the large
  // title sits in the normal scroll flow and collapses on scroll.
  const isStudent = user?.role === 'student';
  // The persistent shell bar is data-driven: it reads the active page's published
  // descriptor (or the per-route default on first paint / hard refresh), so it
  // never depends on a page actually being mounted. A page surface uses its own
  // props. Everything below derives from these "effective" values.
  // The per-route default decides WHETHER a bar shows on this route; a published
  // override (tagged with its own path) only refines the CONTENT, and only when
  // it belongs to the current route — so a stale override from the previous page
  // can never leak a bar onto an immersive/no-bar route.
  const isNativeRuntime = PLATFORM.isNative;
  const shellRouteDefault = isNativeRuntime && isStudent && isShellSurface ? resolveStudentHeader(location.pathname) : null;
  const shellDescriptor = shellRouteDefault
    ? (headerOverride && headerOverride.path === location.pathname ? headerOverride : shellRouteDefault)
    : null;
  const effectiveTitle = isShellSurface ? (shellDescriptor?.title ?? title) : title;
  const effectiveSubtitle = isShellSurface ? (shellDescriptor?.subtitle ?? subtitle) : subtitle;
  const effectiveCompact = isShellSurface ? Boolean(shellDescriptor?.compact) : compact;
  const effectiveBack = isShellSurface ? Boolean(shellDescriptor?.back) : back;
  const effectiveBackTo = isShellSurface ? (shellDescriptor?.backTo ?? null) : backTo;
  const effectiveBreadcrumbPlacement = isShellSurface ? (shellDescriptor?.breadcrumbPlacement ?? 'above') : breadcrumbPlacement;
  const effectiveBreadcrumbInteractive = isShellSurface ? (shellDescriptor?.breadcrumbInteractive ?? true) : breadcrumbInteractive;
  const effectiveBreadcrumbUppercaseCurrent = isShellSurface ? Boolean(shellDescriptor?.breadcrumbUppercaseCurrent) : breadcrumbUppercaseCurrent;
  // Immersive/reading routes show the compact bar only (no large title). Detect
  // from the pathname so there is no first-paint flicker (AppShell's body-class
  // effect runs after this component mounts). Mirrors AppShell's focus flags.
  const isFocusHeaderRoute = isStudent && headerRouteIsFocus(location.pathname);
  // "Compact" pages keep a permanently-pinned bar with a back chevron and NO
  // large title (no scroll fade) — used by immersive/reading routes and by
  // pages that opt in via the `compact` prop (AI notes, planner, flashcards).
  const compactBar = isFocusHeaderRoute || (isStudent && effectiveCompact);
  const headerMode = compactBar ? 'compact' : effectiveBack ? 'detail' : 'tab';
  const showLargeTitle = isStudent && !compactBar;
  const showBackButton = isStudent && (compactBar || effectiveBack);
  // On a student page surface this is the single side-effect: publish the page's
  // descriptor so the persistent shell bar shows the right title/mode, then
  // clear it on unmount so the next route falls back to its per-route default.
  const pageDescriptorKey = isNativeRuntime && isStudent && !isShellSurface
    ? JSON.stringify({
      path: location.pathname,
      title: title ?? null,
      subtitle: subtitle ?? null,
      compact: Boolean(compact),
      back: Boolean(back),
      backTo: backTo ?? null,
      breadcrumbPlacement,
      breadcrumbInteractive: breadcrumbInteractive !== false,
      breadcrumbUppercaseCurrent: Boolean(breadcrumbUppercaseCurrent),
    })
    : null;
  // Publish on mount/update. We do NOT clear on unmount: during a native route
  // transition the incoming page mounts before the outgoing one unmounts, so a
  // clear would wipe the new descriptor. Staleness is handled by the path tag.
  useLayoutEffect(() => {
    if (pageDescriptorKey == null) return;
    setHeaderOverride(JSON.parse(pageDescriptorKey));
  }, [pageDescriptorKey, setHeaderOverride]);

  const unreadNotifications = useMemo(() => sortLatestNotifications(notifications.filter((item) => !item.read)), [notifications]);
  const recentNotifications = useMemo(() => sortLatestNotifications(notifications), [notifications]);
  // Dropdown surfaces unread only — once an item is marked read it drops off here.
  const visibleRecentNotifications = useMemo(() => unreadNotifications.slice(0, 3), [unreadNotifications]);
  const isStaff = isStaffUser(user);
  const breadcrumbs = useMemo(
    () => buildBreadcrumbItems(location.pathname, user, effectiveTitle),
    [location.pathname, effectiveTitle, user]
  );

  const settingsPath = isStaff && userHasPermission(user, 'settings.manage') ? rolePath('/settings', user?.role) : '';
  const profilePath = rolePath('/profile', user?.role);
  const profilePrimary = isStaff
    ? getAdminUserIdentifier(user, 'Signed in user')
    : user?.fullName || 'Signed in user';
  const profileSecondary = isStaff
    ? getAdminUserSecondaryIdentifier(user) || getStaffRoleLabel(user?.role)
    : 'Medical Student';

  const closeProfileMenu = useCallback(() => {
    if (!profileOpen && !profileClosing) {
      return;
    }

    const shouldRestoreFocus =
      typeof document !== 'undefined'
      && profileMenuRef.current
      && profileMenuRef.current.contains(document.activeElement);

    window.clearTimeout(profileCloseTimerRef.current);
    setProfileOpen(false);
    setProfileClosing(true);
    profileCloseTimerRef.current = window.setTimeout(() => {
      setProfileClosing(false);
      if (shouldRestoreFocus) {
        profileButtonRef.current?.focus({ preventScroll: true });
      }
    }, PROFILE_MENU_EXIT_MS);
  }, [profileClosing, profileOpen]);

  const openProfileMenu = useCallback(() => {
    window.clearTimeout(profileCloseTimerRef.current);
    setProfileClosing(false);
    setProfileOpen(true);
    setNotificationsOpen(false);
  }, []);

  const closeNotificationsMenu = useCallback(() => {
    setNotificationsOpen(false);
  }, []);

  const profileDismissRefs = useMemo(
    () => [profileRef, profileAvatarLayerRef, profileMenuRef],
    []
  );
  const dismissProfileMenu = useCallback(() => {
    closeProfileMenu();
  }, [closeProfileMenu]);

  const notificationDismissRefs = useMemo(
    () => [notificationRef, notificationMenuRef, notificationButtonLayerRef],
    []
  );
  useOutsideDismiss(notificationDismissRefs, closeNotificationsMenu, notificationsOpen);
  useOutsideDismiss(profileDismissRefs, dismissProfileMenu, profileVisible);

  const toggleProfileMenu = useCallback(() => {
    if (profileOpen) {
      closeProfileMenu();
      return;
    }

    openProfileMenu();
  }, [closeProfileMenu, openProfileMenu, profileOpen]);

  const handleProfileMenuKeyDown = useCallback((event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeProfileMenu();
      return;
    }

    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      return;
    }

    const items = Array.from(profileMenuRef.current?.querySelectorAll('[role="menuitem"]:not(:disabled)') || []);
    if (!items.length) {
      return;
    }

    event.preventDefault();
    const activeIndex = items.indexOf(document.activeElement);
    let nextIndex = 0;

    if (event.key === 'End') {
      nextIndex = items.length - 1;
    } else if (event.key === 'ArrowUp') {
      nextIndex = activeIndex <= 0 ? items.length - 1 : activeIndex - 1;
    } else if (event.key === 'ArrowDown') {
      nextIndex = activeIndex === -1 || activeIndex >= items.length - 1 ? 0 : activeIndex + 1;
    }

    items[nextIndex]?.focus({ preventScroll: true });
  }, [closeProfileMenu]);

  async function handleLogout() {
    closeProfileMenu();
    await signOut();
    navigate('/auth/login');
  }

  const loadNotifications = useCallback(async () => {
    if (!user?.id || user.role !== 'student') {
      setNotifications([]);
      return;
    }

    setNotificationsLoading(true);
    try {
      const items = await fetchNotifications();
      setNotifications(Array.isArray(items) ? items : []);
    } catch {
      setNotifications([]);
    } finally {
      setNotificationsLoading(false);
    }
  }, [user?.id, user?.role]);

  async function handleNotificationRead(item) {
    if (!item?.id || item.read) {
      return;
    }

    setNotifications((current) => current.map((entry) => (entry.id === item.id ? { ...entry, read: true } : entry)));
    try {
      await markNotificationRead(item.id);
    } catch {
      setNotifications((current) => current.map((entry) => (entry.id === item.id ? { ...entry, read: false } : entry)));
    }
  }

  function handleNavigate(path) {
    closeProfileMenu();
    closeNotificationsMenu();
    navigate(path);
  }

  function openSearch() {
    window.dispatchEvent(new CustomEvent('lms:open-search'));
  }

  function toggleSidebar() {
    window.dispatchEvent(new CustomEvent('lms:toggle-sidebar'));
  }

  useEffect(() => {
    if (previousPathRef.current !== location.pathname) {
      setNotificationsOpen(false);
      setProfileOpen(false);
      setProfileClosing(false);
      window.clearTimeout(profileCloseTimerRef.current);
      previousPathRef.current = location.pathname;
    }
  }, [location.pathname]);

  useEffect(() => {
    // Only the persistent shell bar owns the bell — don't double-fetch from each
    // page surface that mounts/unmounts during navigation.
    if (isNativeRuntime && isStudent && !isShellSurface) return;
    loadNotifications();
  }, [loadNotifications, isNativeRuntime, isStudent, isShellSurface]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    function handleAndroidBack(event) {
      if (profileVisible) {
        event.preventDefault();
        closeProfileMenu();
        return;
      }

      if (notificationsOpen) {
        event.preventDefault();
        closeNotificationsMenu();
      }
    }

    window.addEventListener('lms:android-back', handleAndroidBack);
    return () => window.removeEventListener('lms:android-back', handleAndroidBack);
  }, [closeNotificationsMenu, closeProfileMenu, notificationsOpen, profileVisible]);

  // useLayoutEffect (not useEffect) so the body class lands BEFORE the first
  // paint of the menu — otherwise the first open paints a frame without the
  // class and the old staggered/popover animation flashes once before the
  // unified drop-in takes over (regression: "from-down on first click only").
  useLayoutEffect(() => {
    if (typeof document === 'undefined') return undefined;
    document.body.classList.toggle('lms-profile-menu-open', profileVisible);
    document.body.classList.toggle('lms-profile-menu-closing', profileClosing);
    return () => {
      document.body.classList.remove('lms-profile-menu-open');
      document.body.classList.remove('lms-profile-menu-closing');
    };
  }, [profileClosing, profileVisible]);

  // Mirror the profile-menu body class for the notification dropdown so it gets
  // the same iOS-safe compositing treatment (see launch-responsive.css).
  useLayoutEffect(() => {
    if (typeof document === 'undefined') return undefined;
    document.body.classList.toggle('lms-notification-menu-open', notificationsOpen);
    return () => {
      document.body.classList.remove('lms-notification-menu-open');
    };
  }, [notificationsOpen]);

  useEffect(() => {
    if (!profileOpen || typeof window === 'undefined' || typeof document === 'undefined') {
      return undefined;
    }

    const frame = window.requestAnimationFrame(() => {
      const activeElement = document.activeElement;
      const openedFromTrigger =
        profileButtonRef.current?.contains(activeElement)
        || profileAvatarLayerRef.current?.contains(activeElement)
        || activeElement === document.body;

      if (!openedFromTrigger) {
        return;
      }

      profileMenuRef.current
        ?.querySelector('[role="menuitem"]:not(:disabled)')
        ?.focus({ preventScroll: true });
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [profileOpen]);

  useEffect(() => {
    return () => {
      window.clearTimeout(profileCloseTimerRef.current);
      if (profilePositionFrameRef.current) {
        window.cancelAnimationFrame(profilePositionFrameRef.current);
      }
    };
  }, []);

  useLayoutEffect(() => {
    if (!profileVisible || typeof window === 'undefined') {
      return undefined;
    }

    function updateProfileMenuPosition() {
      const trigger = profileButtonRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const gap = 8;
      const edge = 12;
      const width = Math.min(320, Math.max(240, viewportWidth - edge * 2));
      const compact = viewportWidth <= 520;
      const triggerSize = Math.round(Math.max(rect.width, rect.height));
      const triggerRadius = parseFloat(window.getComputedStyle(trigger).borderTopLeftRadius) || 12;
      const top = Math.min(rect.bottom + gap, viewportHeight - edge);

      updateStyleIfChanged(profileAvatarStyleRef, setProfileAvatarStyle, {
        position: 'fixed',
        top: `${Math.round(rect.top)}px`,
        left: `${Math.round(rect.left)}px`,
        width: `${triggerSize}px`,
        height: `${triggerSize}px`,
        borderRadius: `${Math.round(triggerRadius)}px`,
        zIndex: 10082,
      });
      updateStyleIfChanged(profileMenuStyleRef, setProfileMenuStyle, {
        position: 'fixed',
        top: `${Math.max(edge, top)}px`,
        left: compact ? `${edge}px` : 'auto',
        right: compact ? `${edge}px` : `${Math.max(edge, viewportWidth - rect.right)}px`,
        width: compact ? 'auto' : `${width}px`,
        '--profile-menu-trigger-size': `${triggerSize}px`,
        '--profile-menu-trigger-radius': `${Math.round(triggerRadius)}px`,
        zIndex: 10080,
      });
    }

    function scheduleProfileMenuPositionUpdate() {
      if (profilePositionFrameRef.current) {
        return;
      }

      profilePositionFrameRef.current = window.requestAnimationFrame(() => {
        profilePositionFrameRef.current = null;
        updateProfileMenuPosition();
      });
    }

    updateProfileMenuPosition();
    window.addEventListener('resize', scheduleProfileMenuPositionUpdate, { passive: true });
    window.addEventListener('scroll', scheduleProfileMenuPositionUpdate, { capture: true, passive: true });
    return () => {
      window.removeEventListener('resize', scheduleProfileMenuPositionUpdate);
      window.removeEventListener('scroll', scheduleProfileMenuPositionUpdate, true);
      if (profilePositionFrameRef.current) {
        window.cancelAnimationFrame(profilePositionFrameRef.current);
        profilePositionFrameRef.current = null;
      }
    };
  }, [profileVisible]);

  // Notification dropdown is portaled to <body> and positioned with fixed
  // coords (same pattern as the profile menu) so it isn't clipped/mispositioned
  // inside the portaled native (Capacitor) topbar layer.
  useLayoutEffect(() => {
    if (!notificationsOpen || typeof window === 'undefined') {
      return undefined;
    }

    function updateNotificationMenuPosition() {
      const trigger = notificationButtonRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const gap = 8;
      const edge = 12;
      const width = Math.min(330, Math.max(260, viewportWidth - edge * 2));
      const compact = viewportWidth <= 520;
      const top = Math.min(rect.bottom + gap, viewportHeight - edge);
      const triggerSize = Math.round(Math.max(rect.width, rect.height));
      const triggerRadius = parseFloat(window.getComputedStyle(trigger).borderTopLeftRadius) || 12;

      // Floating clone of the bell — mirrors the profile avatar mechanism so the
      // trigger lifts onto the same top compositing layer as the menu.
      updateStyleIfChanged(notificationButtonStyleRef, setNotificationButtonStyle, {
        position: 'fixed',
        top: `${Math.round(rect.top)}px`,
        left: `${Math.round(rect.left)}px`,
        width: `${triggerSize}px`,
        height: `${triggerSize}px`,
        borderRadius: `${Math.round(triggerRadius)}px`,
        zIndex: 10082,
      });
      updateStyleIfChanged(notificationMenuStyleRef, setNotificationMenuStyle, {
        position: 'fixed',
        top: `${Math.max(edge, top)}px`,
        left: compact ? `${edge}px` : 'auto',
        right: compact ? `${edge}px` : `${Math.max(edge, viewportWidth - rect.right)}px`,
        width: compact ? 'auto' : `${width}px`,
        zIndex: 10080,
      });
    }

    function scheduleNotificationMenuPositionUpdate() {
      if (notificationPositionFrameRef.current) {
        return;
      }

      notificationPositionFrameRef.current = window.requestAnimationFrame(() => {
        notificationPositionFrameRef.current = null;
        updateNotificationMenuPosition();
      });
    }

    updateNotificationMenuPosition();
    window.addEventListener('resize', scheduleNotificationMenuPositionUpdate, { passive: true });
    window.addEventListener('scroll', scheduleNotificationMenuPositionUpdate, { capture: true, passive: true });
    return () => {
      window.removeEventListener('resize', scheduleNotificationMenuPositionUpdate);
      window.removeEventListener('scroll', scheduleNotificationMenuPositionUpdate, true);
      if (notificationPositionFrameRef.current) {
        window.cancelAnimationFrame(notificationPositionFrameRef.current);
        notificationPositionFrameRef.current = null;
      }
    };
  }, [notificationsOpen]);

  // Publish the fixed compact-bar height so page content (and the in-flow large
  // title) can clear it. Measured live (safe-area insets included) and kept in
  // sync via ResizeObserver. Cross-platform — the bar is portaled to <body> for
  // every student page.
  useLayoutEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return undefined;
    // The bar only lives on the shell surface now — that instance measures it.
    if (!isNativeRuntime || !isStudent || !isShellSurface) return undefined;
    const root = document.documentElement;

    const measure = () => {
      const height = Math.ceil(barRef.current?.getBoundingClientRect?.().height || 0);
      if (height) root.style.setProperty('--lms-header-bar-height', `${height}px`);
    };

    // Measure on the next frame (one rAF, not two) so --lms-header-bar-height is
    // written a frame earlier — the spacer no longer sizes off the stale fallback
    // after a transition settles. The ResizeObserver below still catches later
    // resizes (orientation, font load).
    let frameId = window.requestAnimationFrame(measure);

    let observer = null;
    if (barRef.current && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(measure);
      observer.observe(barRef.current);
    }
    document.fonts?.ready?.then(measure).catch(() => {});

    return () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      observer?.disconnect();
    };
  }, [isNativeRuntime, isStudent, isShellSurface, headerMode]);

  // Scroll-driven collapse: write --lms-header-collapse (0->1) on the document
  // root so BOTH the portaled bar and the in-flow large title (separate DOM
  // subtrees) can read it. rAF-throttled, imperative (no React re-render per
  // scroll frame). Disabled in focus mode (bar is permanently compact).
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return undefined;
    const root = document.documentElement;
    // The large title lives on the page surface — that instance drives collapse.
    if (isShellSurface || !isNativeRuntime) {
      root.style.removeProperty('--lms-header-collapse');
      return undefined;
    }
    if (!isStudent || headerMode === 'compact') {
      root.style.removeProperty('--lms-header-collapse');
      return undefined;
    }

    let frame = null;
    const apply = () => {
      frame = null;
      const range = Math.max(36, Math.round(largeTitleRef.current?.getBoundingClientRect?.().height || 52));
      const p = Math.min(1, Math.max(0, window.scrollY / range));
      root.style.setProperty('--lms-header-collapse', p.toFixed(3));
    };

    const onScroll = () => {
      if (frame == null) frame = window.requestAnimationFrame(apply);
    };

    // Reset to expanded on each new route, then sync to the (reset) scroll pos.
    root.style.setProperty('--lms-header-collapse', '0');
    apply();

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      if (frame != null) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [isNativeRuntime, isStudent, isShellSurface, headerMode, location.pathname]);

  const profileAvatarLayer = profileVisible ? (
    <button
      ref={profileAvatarLayerRef}
      type="button"
      className={cx('lms-profile-avatar-floating', profileClosing && 'is-closing')}
      style={profileAvatarStyle || undefined}
      aria-label="Close profile menu"
      aria-controls={PROFILE_MENU_ID}
      aria-expanded={profileOpen ? 'true' : 'false'}
      aria-haspopup="menu"
      onClick={toggleProfileMenu}
    >
      <ProfileAvatar user={user} />
    </button>
  ) : null;
  const profileAvatarPortal =
    profileAvatarLayer && typeof document !== 'undefined'
      ? createPortal(profileAvatarLayer, document.body)
      : profileAvatarLayer;
  const profileMenu = profileVisible ? (
    <div
      id={PROFILE_MENU_ID}
      ref={profileMenuRef}
      className={cx(topbarUi.dropdown, topbarUi.profileDropdown, profileClosing && 'is-closing')}
      style={profileMenuStyle || undefined}
      role="menu"
      aria-label="Profile menu"
      onKeyDown={handleProfileMenuKeyDown}
    >
      <div className={topbarUi.dropdownHead}>
        <div className="lms-profile-menu-head-copy">
          <strong>{profilePrimary}</strong>
          <small>{profileSecondary}</small>
        </div>
      </div>

      <div className={topbarUi.dropdownSection}>
        <button
          type="button"
          role="menuitem"
          className={topbarUi.menuItem}
          onPointerDown={() => preloadRouteByPath(profilePath, user?.role)}
          onTouchStart={() => preloadRouteByPath(profilePath, user?.role)}
          onFocus={() => preloadRouteByPath(profilePath, user?.role)}
          onClick={() => handleNavigate(profilePath)}
        >
          <ProfileIcon />
          <span>Profile</span>
        </button>

        {settingsPath ? (
          <button type="button" role="menuitem" className={topbarUi.menuItem} onClick={() => handleNavigate(settingsPath)}>
            <SettingsIcon />
            <span>Settings</span>
          </button>
        ) : null}
      </div>

      <div className={topbarUi.dropdownSection}>
        <button className={cx(topbarUi.menuItem, topbarUi.dangerItem, 'lms-profile-menu-logout')} type="button" role="menuitem" onClick={handleLogout} disabled={isSigningOut}>
          <LogoutIcon />
          <span>{isSigningOut ? 'Signing out...' : 'Log out'}</span>
        </button>
      </div>
    </div>
  ) : null;
  const profileMenuLayer =
    profileMenu && typeof document !== 'undefined'
      ? createPortal(profileMenu, document.body)
      : profileMenu;
  const notificationButtonLayer = notificationsOpen ? (
    <button
      ref={notificationButtonLayerRef}
      type="button"
      className="lms-notification-bell-floating"
      style={notificationButtonStyle || undefined}
      aria-label="Close notifications"
      aria-controls={NOTIFICATION_MENU_ID}
      aria-expanded="true"
      aria-haspopup="dialog"
      onClick={() => setNotificationsOpen(false)}
    >
      <BellIcon />
      {unreadNotifications.length ? <span className={topbarUi.countBadge}>{unreadNotifications.length}</span> : null}
    </button>
  ) : null;
  const notificationButtonPortal =
    notificationButtonLayer && typeof document !== 'undefined'
      ? createPortal(notificationButtonLayer, document.body)
      : notificationButtonLayer;
  const notificationMenu = notificationsOpen ? (
    <div
      id={NOTIFICATION_MENU_ID}
      ref={notificationMenuRef}
      className={cx(topbarUi.dropdown, topbarUi.notificationDropdown)}
      style={notificationMenuStyle || undefined}
      role="region"
      aria-label="Recent notifications"
    >
      <div className={topbarUi.dropdownHead}>
        <div>
          <strong>Recent notifications</strong>
          <small>
            {recentNotifications.length
              ? unreadNotifications.length
                ? `${unreadNotifications.length} unread`
                : 'You are all caught up'
              : 'No notifications yet'}
          </small>
        </div>
        <button
          type="button"
          className={topbarUi.dropdownClose}
          onClick={() => setNotificationsOpen(false)}
          aria-label="Close notifications"
        >
          <CloseIcon />
        </button>
      </div>

      {notificationsLoading ? (
        <div className={topbarUi.emptyState}>
          <strong>Loading notifications</strong>
          <p>Checking recent LMS updates...</p>
        </div>
      ) : visibleRecentNotifications.length ? (
        <div className={topbarUi.notificationList}>
          {visibleRecentNotifications.map((item) => (
            <button
              key={item.id}
              type="button"
              className={cx(topbarUi.notificationItem, item.read && topbarUi.notificationItemRead)}
              onClick={() => handleNotificationRead(item)}
            >
              <span className={cx(topbarUi.notificationDot, item.read && topbarUi.notificationDotRead)} aria-hidden="true" />
              <div className={topbarUi.notificationCopy}>
                <strong>{item.title}</strong>
                <p>{item.body}</p>
                <small>{formatNotificationTime(item.publishAt || item.createdAt)}</small>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className={topbarUi.emptyState}>
          <strong>No notifications</strong>
          <p>New updates will appear here.</p>
        </div>
      )}

      <div className={topbarUi.dropdownFoot}>
        <button
          type="button"
          className={topbarUi.notificationPageLink}
          onClick={() => handleNavigate(rolePath('/notifications', user?.role))}
        >
          View all notifications
        </button>
      </div>
    </div>
  ) : null;
  const notificationMenuLayer =
    notificationMenu && typeof document !== 'undefined'
      ? createPortal(notificationMenu, document.body)
      : notificationMenu;

  if (user?.role === 'student') {
    // ── Persistent shell bar ──────────────────────────────────────────────
    // Rendered ONCE by AppShell (like MobileBottomNav). It never unmounts on
    // navigation and is present on a hard refresh before any page chunk loads,
    // so the top bar behaves like native app chrome. Data comes from the active
    // page's published descriptor, falling back to the per-route default.
    if (isShellSurface) {
      // Routes with no descriptor (immersive/reader/quiz/review/result-detail/
      // profile) show no shell bar — they keep their own chrome, as before.
      if (!shellDescriptor) return null;

      const leadingControl = showBackButton ? (
        <button
          key="back"
          type="button"
          className="study-icon-button study-topbar__back"
          aria-label="Go back"
          onClick={() => navigate(effectiveBackTo ?? -1)}
        >
          <BackChevronIcon />
        </button>
      ) : (
        <button
          key="menu"
          type="button"
          className="study-icon-button lms-topbar-menu-button study-sidebar-toggle"
          aria-label="Hide or show sidebar"
          onClick={toggleSidebar}
        >
          <NavToggleIcon />
        </button>
      );

      // Pinned compact bar — portaled to <body> so the route wrapper's residual
      // transform can't break its fixed positioning. The compact title fades in
      // as the large title collapses (driven by --lms-header-collapse).
      const compactBar = (
        <header
          ref={barRef}
          data-mode={headerMode}
          className={cx(
            'study-hub-topbar',
            'study-topbar__bar',
            profileVisible && 'is-profile-menu-open',
            className
          )}
        >
          <span className="study-topbar__hairline" aria-hidden="true" />
          {leadingControl}
          <h2 key={effectiveTitle} className="study-topbar__compact-title" aria-hidden={showLargeTitle ? 'true' : undefined}>{effectiveTitle}</h2>

          <div className="study-topbar-actions study-topbar__actions">
            <div className={cx(topbarUi.menuWrap, notificationsOpen && 'is-notification-menu-open')} ref={notificationRef}>
              <button
                ref={notificationButtonRef}
                type="button"
                className={cx('study-icon-button relative', notificationsOpen && 'is-notification-bell-open')}
                aria-label={unreadNotifications.length ? `${unreadNotifications.length} unread notifications` : 'Notifications'}
                aria-controls={NOTIFICATION_MENU_ID}
                aria-expanded={notificationsOpen ? 'true' : 'false'}
                aria-haspopup="dialog"
                onClick={() => {
                  setNotificationsOpen((current) => {
                    if (!current) loadNotifications();
                    return !current;
                  });
                  closeProfileMenu();
                }}
              >
                <BellIcon />
                {unreadNotifications.length ? <span className={topbarUi.countBadge}>{unreadNotifications.length}</span> : null}
              </button>
            </div>

            <button type="button" className="study-icon-button" aria-label="Search lessons and exams" onClick={openSearch}>
              <SearchIcon />
            </button>

            <div className={cx(topbarUi.menuWrap, profileVisible && 'is-profile-menu-open')} ref={profileRef}>
              <button
                ref={profileButtonRef}
                type="button"
                className={cx('study-avatar study-avatar--profile', profileVisible && 'is-profile-avatar-open')}
                aria-label="Open profile menu"
                aria-controls={PROFILE_MENU_ID}
                aria-expanded={profileOpen ? 'true' : 'false'}
                aria-haspopup="menu"
                onClick={toggleProfileMenu}
              >
                <ProfileAvatar user={user} />
              </button>
            </div>
          </div>
        </header>
      );

      return (
        <>
          {profileAvatarPortal}
          {profileMenuLayer}
          {notificationButtonPortal}
          {notificationMenuLayer}
          {typeof document !== 'undefined'
            ? createPortal(
                <div className="lms-header-bar-layer" data-lms-header-bar-layer="student">
                  {compactBar}
                </div>,
                document.body
              )
            : compactBar}
        </>
      );
    }

    const breadcrumbNode = breadcrumbs.length ? (
      <RouteBreadcrumbs
        items={breadcrumbs}
        onNavigate={navigate}
        interactive={effectiveBreadcrumbInteractive}
        uppercaseCurrent={effectiveBreadcrumbUppercaseCurrent}
      />
    ) : null;

    if (!isNativeRuntime) {
      const studentHeader = (
        <header
          ref={barRef}
          className={cx(
            'study-hub-topbar',
            'study-hub-topbar--side-nav-toggle',
            profileVisible && 'is-profile-menu-open',
            className
          )}
        >
          <button
            type="button"
            className="study-icon-button lms-topbar-menu-button study-sidebar-toggle"
            aria-label="Hide or show sidebar"
            onClick={toggleSidebar}
          >
            <NavToggleIcon />
          </button>

          <div className="study-topbar-title">
            {effectiveBreadcrumbPlacement !== 'below' && breadcrumbNode ? breadcrumbNode : effectiveSubtitle ? (
              <span>{effectiveSubtitle}</span>
            ) : null}
            <h1>{effectiveTitle}</h1>
            {effectiveBreadcrumbPlacement === 'below' ? breadcrumbNode : null}
          </div>

          <div className="study-topbar-actions">
            <div className={cx(topbarUi.menuWrap, notificationsOpen && 'is-notification-menu-open')} ref={notificationRef}>
              <button
                ref={notificationButtonRef}
                type="button"
                className={cx('study-icon-button relative', notificationsOpen && 'is-notification-bell-open')}
                aria-label={unreadNotifications.length ? `${unreadNotifications.length} unread notifications` : 'Notifications'}
                aria-controls={NOTIFICATION_MENU_ID}
                aria-expanded={notificationsOpen ? 'true' : 'false'}
                aria-haspopup="dialog"
                onClick={() => {
                  setNotificationsOpen((current) => {
                    if (!current) loadNotifications();
                    return !current;
                  });
                  closeProfileMenu();
                }}
              >
                <BellIcon />
                {unreadNotifications.length ? <span className={topbarUi.countBadge}>{unreadNotifications.length}</span> : null}
              </button>
            </div>

            <button type="button" className="study-icon-button" aria-label="Search lessons and exams" onClick={openSearch}>
              <SearchIcon />
            </button>

            <div className={cx(topbarUi.menuWrap, profileVisible && 'is-profile-menu-open')} ref={profileRef}>
              <button
                ref={profileButtonRef}
                type="button"
                className={cx('study-avatar study-avatar--profile', profileVisible && 'is-profile-avatar-open')}
                aria-label="Open profile menu"
                aria-controls={PROFILE_MENU_ID}
                aria-expanded={profileOpen ? 'true' : 'false'}
                aria-haspopup="menu"
                onClick={toggleProfileMenu}
              >
                <ProfileAvatar user={user} />
              </button>
            </div>
          </div>

          {actions ? <div className={cx('lms-topbar-actions', topbarUi.actionsSlot)}>{actions}</div> : null}
        </header>
      );

      return (
        <>
          {profileAvatarPortal}
          {profileMenuLayer}
          {notificationButtonPortal}
          {notificationMenuLayer}
          {studentHeader}
          <div className={topbarUi.mobileCopy}>
            <div>{effectiveTitle}</div>
          </div>
        </>
      );
    }

    // ── Native page surface ───────────────────────────────────────────────
    // Capacitor keeps the shell-owned compact bar; page headers only publish
    // descriptors and render the in-flow large title/spacer.
    return (
      <>
        {/* In-flow spacer clears the fixed bar; the large title scrolls away. */}
        <div className="study-topbar__spacer" aria-hidden="true" />
        {showLargeTitle ? (
          <div key={effectiveTitle} ref={largeTitleRef} className="study-topbar__large" data-mode={headerMode}>
            {effectiveBreadcrumbPlacement !== 'below' && breadcrumbNode ? breadcrumbNode : effectiveSubtitle ? (
              <span className="study-topbar__eyebrow">{effectiveSubtitle}</span>
            ) : null}
            <h1 className="study-topbar__large-title">{effectiveTitle}</h1>
            {effectiveBreadcrumbPlacement === 'below' ? breadcrumbNode : null}
          </div>
        ) : null}
      </>
    );
  }

  return (
    <>
      {profileAvatarPortal}
      {profileMenuLayer}
      {notificationButtonPortal}
          {notificationMenuLayer}

      <header className={cx(topbarUi.header, profileVisible && 'is-profile-menu-open', className)}>
        <div className={cx('lms-topbar-left', topbarUi.left)}>
          <button className={topbarUi.mobileMenuButton}
            type="button"
            onClick={toggleSidebar}
            aria-label="Toggle navigation"
          >
            <NavToggleIcon />
          </button>

          <div className={topbarUi.titleBlock}>
            <RouteBreadcrumbs items={breadcrumbs} onNavigate={navigate} />
            <h1 className={topbarUi.title}>{title}</h1>
            {subtitle ? <p className={topbarUi.subtitle}>{subtitle}</p> : null}
          </div>
        </div>

        <div className={cx('lms-topbar-center', topbarUi.center)}>
          <button type="button" className={topbarUi.search} onClick={openSearch} aria-label="Search the LMS">
            <span className={topbarUi.searchIcon} aria-hidden="true">
              <SearchIcon />
            </span>
            <span className={topbarUi.searchCopy}>
              Search...
            </span>
            <span className={topbarUi.searchShortcut}>⌘K</span>
          </button>
        </div>

        <div className={cx('lms-topbar-right', topbarUi.right)}>
          <div className={topbarUi.utility}>
            <HeaderInstallAction />
            <ThemeToggle />

            {user?.role === 'student' ? (
            <div className={cx(topbarUi.menuWrap, notificationsOpen && 'is-notification-menu-open')} ref={notificationRef}>
              <button className={cx(topbarUi.iconButton, notificationsOpen && 'is-notification-bell-open')}
                ref={notificationButtonRef}
                type="button"

                aria-label="Notifications"
                aria-controls={NOTIFICATION_MENU_ID}
                aria-expanded={notificationsOpen ? 'true' : 'false'}
                aria-haspopup="dialog"
                onClick={() => {
                  setNotificationsOpen((current) => {
                    if (!current) {
                      loadNotifications();
                    }
                    return !current;
                  });
                  closeProfileMenu();
                }}
              >
                <BellIcon />
                {unreadNotifications.length ? <span className={topbarUi.countBadge}>{unreadNotifications.length}</span> : null}
              </button>
            </div>
            ) : null}

            <button className={topbarUi.iconButton}
              type="button"
             
              aria-label="Search"
              onClick={openSearch}
            >
              <SearchIcon />
            </button>

            <div className={cx(topbarUi.menuWrap, profileVisible && 'is-profile-menu-open')} ref={profileRef}>
              <button ref={profileButtonRef}
                className={cx(topbarUi.profileButton, profileVisible && 'is-profile-avatar-open')}
                type="button"
               
                aria-label="Open profile menu"
                aria-controls={PROFILE_MENU_ID}
                aria-expanded={profileOpen ? 'true' : 'false'}
                aria-haspopup="menu"
                onClick={toggleProfileMenu}
              >
                <ProfileAvatar user={user} />
              </button>

            </div>
          </div>
        </div>

        {actions ? <div className={cx('lms-topbar-actions', topbarUi.actionsSlot)}>{actions}</div> : null}
      </header>

      <div className={topbarUi.mobileCopy}>
        <div>{title}</div>
      </div>
    </>
  );
}
