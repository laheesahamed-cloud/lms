import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore.js';
import { useThemeStore } from '../stores/themeStore.js';
import { preloadRouteByPath } from '../../app/router.jsx';
import { cx } from '../styles/tailwindClasses.js';

/* ── Icon Set (16×16) — standard stroke-based icons ──────────── */
const Icons = {
  Dashboard: () => (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
      <rect x="3" y="3" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="11" y="3" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="3" y="11" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="11" y="11" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  ),
  Courses: () => (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
      <path d="M3.5 5C5.5 5 8 5.5 10 7C12 5.5 14.5 5 16.5 5V15.5C14.5 15.5 12 16 10 17.5C8 16 5.5 15.5 3.5 15.5V5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M10 7V17.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  ),
  Structure: () => (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
      <rect x="7.5" y="2" width="5" height="4" rx="1.25" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="2" y="14" width="5" height="4" rx="1.25" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="13" y="14" width="5" height="4" rx="1.25" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M10 6V9.5M10 9.5H4.5V14M10 9.5H15.5V14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Lessons: () => (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
      <rect x="2" y="4.5" width="12" height="11" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M14 8L18 6V14L14 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Questions: () => (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M8 8.5C8 7.12 8.9 6.25 10 6.25C11.1 6.25 12 7.12 12 8.5C12 9.75 10.75 10.25 10.25 11C10.1 11.25 10 11.5 10 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="10" cy="14.25" r="0.9" fill="currentColor"/>
    </svg>
  ),
  Quizzes: () => (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
      <path d="M7.5 2.5H7C5.9 2.5 5 3.4 5 4.5V16C5 17.1 5.9 18 7 18H13C14.1 18 15 17.1 15 16V4.5C15 3.4 14.1 2.5 13 2.5H12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <rect x="7.5" y="1.5" width="5" height="3" rx="1.25" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M7.5 9.5L9.5 11.5L13 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M7.5 14.5H12.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  ),
  Exams: () => (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
      <path d="M11.5 2.5H7C5.9 2.5 5 3.4 5 4.5V15.5C5 16.6 5.9 17.5 7 17.5H10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M11.5 2.5L14.5 5.5M11.5 2.5V5.5H14.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M7 9H10M7 12H9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      <circle cx="15" cy="15.5" r="3" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M15 14V15.5L16 16.25" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Users: () => (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
      <circle cx="7.5" cy="6.5" r="3" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M1.5 17.5C1.5 14.46 4.19 12 7.5 12C10.81 12 13.5 14.46 13.5 17.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="14.5" cy="7" r="2.25" stroke="currentColor" strokeWidth="1.35"/>
      <path d="M16.5 17.5C16.5 15.56 15.64 14 14.5 14C13.75 14 13.1 14.5 12.75 15.25" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round"/>
    </svg>
  ),
  Settings: () => (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="2.75" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M10 3.5V5M10 15V16.5M16.5 10H15M5 10H3.5M14.6 5.4L13.54 6.46M6.46 13.54L5.4 14.6M14.6 14.6L13.54 13.54M6.46 6.46L5.4 5.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  Setup: () => (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
      <path d="M3.5 6.5H16.5M3.5 10H16.5M3.5 13.5H16.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="7" cy="6.5" r="2" stroke="currentColor" strokeWidth="1.4"/>
      <circle cx="13" cy="10" r="2" stroke="currentColor" strokeWidth="1.4"/>
      <circle cx="7" cy="13.5" r="2" stroke="currentColor" strokeWidth="1.4"/>
    </svg>
  ),
  Bell: () => (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
      <path d="M5 9C5 6.24 7.24 4 10 4C12.76 4 15 6.24 15 9V12.5L17 15H3L5 12.5V9Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M10 2.5V4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M8 16.5C8.45 17.38 9.17 18 10 18C10.83 18 11.55 17.38 12 16.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  ),
  Mission: () => (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
      <path d="M10 3L18 7.5L10 12L2 7.5L10 3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M5 10V14.5C7 16 13 16 15 14.5V10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M18 7.5V12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  ),
  Notes: () => (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
      <path d="M5 2.5H15C15.83 2.5 16.5 3.17 16.5 4V14L12.5 17.5H5C4.17 17.5 3.5 16.83 3.5 16V4C3.5 3.17 4.17 2.5 5 2.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M12.5 14V17.5L16.5 14" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
      <path d="M7 8H13M7 11H10.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  ),
  Results: () => (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
      <path d="M3 17H17" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      <rect x="3.5" y="12" width="3" height="5" rx="0.75" stroke="currentColor" strokeWidth="1.4"/>
      <rect x="8.5" y="8" width="3" height="9" rx="0.75" stroke="currentColor" strokeWidth="1.4"/>
      <rect x="13.5" y="4.5" width="3" height="12.5" rx="0.75" stroke="currentColor" strokeWidth="1.4"/>
    </svg>
  ),
  AI: () => (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
      <path d="M10 2.5L11.5 7H16.5L12.5 9.75L14 14.25L10 11.5L6 14.25L7.5 9.75L3.5 7H8.5L10 2.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M16 16L16.75 17.75L18.5 16.75L16.75 15.75L16 14L15.25 15.75L13.5 16.75L15.25 17.75L16 16Z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round"/>
    </svg>
  ),
  Billing: () => (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
      <rect x="2" y="5" width="16" height="10.5" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M2 9H18" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M5 13H9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      <circle cx="15" cy="13" r="1.25" stroke="currentColor" strokeWidth="1.3"/>
    </svg>
  ),
  Bookmarks: () => (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
      <path d="M5 2.5H15C15.55 2.5 16 2.95 16 3.5V17.5L10 14.25L4 17.5V3.5C4 2.95 4.45 2.5 5 2.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
    </svg>
  ),
  AiNotes: () => (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
      <path d="M11.5 2.5H6C5.17 2.5 4.5 3.17 4.5 4V16C4.5 16.83 5.17 17.5 6 17.5H14C14.83 17.5 15.5 16.83 15.5 16V6.5L11.5 2.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M11.5 2.5V6.5H15.5" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
      <path d="M7 11H9.5M7 13.5H8.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      <path d="M13 9L13.75 11L15.5 10.5L13.75 12L13 14L12.25 12L10.5 10.5L12.25 11L13 9Z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round"/>
    </svg>
  ),
  Flashcards: () => (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
      <rect x="4.5" y="7" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="2" y="4.5" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M5.5 10.5H11M5.5 13H8.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  ),
};

function ChevronIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M3 5L7 9L11 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

/* ── Nav data ─────────────────────────────────────────────────── */
const adminLinks = [
  { to: '/dashboard',     label: 'Command',       icon: 'Dashboard' },
  { to: '/courses',       label: 'Courses',       icon: 'Courses'   },
  { to: '/structure',     label: 'Structure',     icon: 'Structure' },
  { to: '/questions',     label: 'Questions',     icon: 'Questions' },
  { to: '/questions/review', label: 'Review Queue', icon: 'Questions' },
  { to: '/quizzes',       label: 'Assessments',   icon: 'Quizzes'   },
  {
    label: 'AI Tools',
    icon: 'AI',
    group: true,
    children: [
      { to: '/ai/gemini',   label: 'Gemini AI'  },
      { to: '/ai/chatgpt',  label: 'ChatGPT AI' },
    ],
  },
  { to: '/subscriptions', label: 'Subscriptions', icon: 'Billing'   },
  { to: '/ai-notes',      label: 'Lessons',       icon: 'AiNotes'   },
  { to: '/users',         label: 'Students',      icon: 'Users'     },
  { to: '/announcements', label: 'Announcements', icon: 'Bell'      },
  { to: '/reports',       label: 'Reports',       icon: 'Results'   },
  { to: '/doubts',        label: 'Doubts',        icon: 'Notes'     },
  { to: '/setup',         label: 'Setup',         icon: 'Setup'     },
  { to: '/settings',      label: 'Settings',      icon: 'Settings'  },
];

const studentLinks = [
  { to: '/dashboard',     label: 'Study Hub',     icon: 'Mission'    },
  { to: '/courses',       label: 'Courses',       icon: 'Courses'    },
  { to: '/planner',       label: 'Planner',       icon: 'Results'    },
  { to: '/ai-notes',      label: 'Lessons',       icon: 'AiNotes'    },
  { to: '/doubts',        label: 'Doubts',        icon: 'Notes'      },
  { to: '/flashcards',    label: 'Flashcards',    icon: 'Flashcards' },
  { to: '/quizzes',       label: 'Q-Bank',        icon: 'Quizzes'    },
  { to: '/exams',         label: 'Exams',         icon: 'Exams'      },
  { to: '/results',       label: 'Results',       icon: 'Results'    },
  { to: '/bookmarks',     label: 'Saved',         icon: 'Bookmarks'  },
  { to: '/subscriptions', label: 'Subscriptions', icon: 'Billing'    },
];

const END_EXACT = new Set([
  '/dashboard',
  '/bookmarks', '/subscriptions', '/exams', '/flashcards',
  '/structure', '/users', '/setup', '/settings', '/announcements',
  '/reports', '/doubts', '/notifications', '/planner', '/questions/review',
  '/ai/gemini', '/ai/chatgpt',
]);

function isExactNavPath(path) {
  const cleanPath = path.replace(/^\/(?:admin|app|student)(?=\/|$)/, '') || '/dashboard';
  return END_EXACT.has(cleanPath);
}

function getInitials(user) {
  const name = user?.fullName || user?.email || 'Student';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.slice(0, 1).toUpperCase())
    .join('') || 'S';
}

const sidebarUi = {
  shell:
    'app-drawer fixed inset-y-0 left-0 z-[820] flex w-[var(--sidebar-w)] flex-col overflow-hidden rounded-none border-r border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] transition-[transform,width,box-shadow,border-color] duration-[300ms] ease-[var(--ease-smooth)] [height:100dvh] [min-height:100dvh] will-change-[transform,width] shadow-[1px_0_0_var(--line-soft),var(--shadow-sm)] before:pointer-events-none before:absolute before:inset-0 before:bg-[linear-gradient(180deg,rgba(37,99,235,0.035),transparent_36%)] before:content-[""] max-[900px]:w-[min(var(--sidebar-w),88%)] max-[900px]:rounded-r-[22px]',
  shellLight:
    '',
  open: 'max-[900px]:translate-x-0',
  collapsed: 'min-[901px]:w-[var(--sidebar-w-collapsed)]',
  mobileClose:
    'ml-auto hidden size-9 min-h-9 items-center justify-center rounded-full border border-line-soft bg-surface-2 p-0 text-ink-soft shadow-none transition-[transform,background,color] duration-150 ease-[var(--ease-out)] hover:bg-surface-3 hover:text-ink-strong active:scale-[0.97] max-[900px]:inline-flex',
  logoRow:
    'relative flex min-h-[var(--admin-header-h)] items-center gap-3 border-b border-[var(--line-soft)] px-4 py-3',
  logoRowCollapsed:
    'min-[901px]:flex-col min-[901px]:justify-center min-[901px]:gap-2 min-[901px]:px-0 min-[901px]:py-3',
  brandIcon:
    'grid size-[38px] shrink-0 place-items-center rounded-xl bg-[linear-gradient(135deg,#0B1220_0%,#2563EB_55%,#38BDF8_100%)] shadow-[0_8px_20px_rgba(37,99,235,0.16)]',
  brandIconCollapsed: 'min-[901px]:size-[36px]',
  wordmark: 'grid min-w-0 gap-0.5',
  wordmarkName: 'truncate text-[14.5px] font-extrabold tracking-[-0.01em] text-ink-strong',
  wordmarkRole: 'truncate text-[10.5px] font-semibold text-ink-soft',
  navLabel:
    'mx-5 mb-1.5 mt-3 text-[9.5px] font-extrabold uppercase tracking-[0.18em] text-ink-muted transition-[opacity,transform] duration-200 ease-out',
  nav:
    'flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden overscroll-contain px-3 py-1.5 [scrollbar-width:none] [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden',
  navCollapsed:
    'min-[901px]:overflow-visible min-[901px]:gap-2 min-[901px]:px-2 min-[901px]:py-3',
  group:
    'relative flex flex-col gap-1',
  link:
    'group relative flex h-[42px] min-h-[42px] items-center gap-2.5 rounded-xl border border-transparent px-3 text-[13.5px] font-semibold text-ink-soft no-underline shadow-none transition-[background,border-color,color,box-shadow,transform] duration-150 ease-[var(--ease-out)] hover:-translate-y-px hover:bg-surface-2 hover:text-ink-strong active:translate-y-0 active:scale-[0.985]',
  linkActive:
    'nav-active-glow border-transparent text-brand-primary shadow-sm hover:translate-y-0 hover:bg-transparent',
  linkCollapsed: 'min-[901px]:h-[48px] min-[901px]:min-h-[48px] min-[901px]:justify-center min-[901px]:px-0',
  icon:
    'grid size-[30px] min-h-[30px] min-w-[30px] shrink-0 place-items-center rounded-[10px] text-ink-soft transition-[background,color] duration-150 group-hover:bg-[var(--color-primary-light)] group-hover:text-brand-primary',
  iconActive:
    '!bg-[var(--color-primary-light)] !text-brand-primary shadow-[0_2px_10px_color-mix(in_srgb,var(--color-primary)_16%,transparent)]',
  iconCollapsed:
    'min-[901px]:size-[42px] min-[901px]:min-h-[42px] min-[901px]:min-w-[42px] min-[901px]:rounded-[14px]',
  label: 'min-w-0 truncate text-[13.5px] font-semibold transition-[opacity,transform] duration-200 ease-out',
  collapsedTag: 'hidden',
  collapsedTagActive: '',
  arrow: 'ml-auto flex shrink-0 items-center text-ink-muted transition-transform duration-200',
  arrowOpen: 'rotate-180 text-brand-primary',
  tooltip:
    'lms-floating-panel pointer-events-none absolute left-[calc(100%+12px)] top-1/2 z-[900] hidden -translate-y-1/2 translate-x-[-6px] scale-95 whitespace-nowrap rounded-full border border-line-soft bg-surface-card-elevated px-3.5 py-2 text-[12px] font-extrabold text-ink-strong opacity-0 shadow-xl transition-[transform,opacity] duration-150 before:absolute before:left-[-5px] before:top-1/2 before:size-2.5 before:-translate-y-1/2 before:rotate-45 before:border-b before:border-l before:border-line-soft before:bg-surface-card-elevated before:content-[""] group-hover:translate-x-0 group-hover:scale-100 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:scale-100 group-focus-visible:opacity-100 min-[901px]:group-[.is-collapsed]/sidebar:block',
  submenu:
    'ml-4 mt-0.5 flex flex-col gap-0.5 border-l border-brand-primary/18 py-1.5 pl-3',
  submenuItem:
    'flex min-h-[36px] items-center gap-2.5 rounded-[10px] px-3 py-1.5 text-[13px] font-medium text-ink-soft no-underline transition-[background,color] duration-150 hover:bg-[var(--color-primary-light)] hover:text-ink-strong',
  submenuItemActive:
    'bg-[linear-gradient(90deg,var(--color-primary-light),color-mix(in_srgb,var(--color-secondary)_8%,transparent))] font-bold text-brand-primary',
  submenuDot:
    'size-[5px] shrink-0 rounded-full bg-ink-muted/50',
  flyout:
    'lms-floating-panel motion-smooth absolute left-[calc(100%+10px)] top-[-2px] z-[600] min-w-[186px] origin-top-left rounded-[var(--radius-lg)] border border-line-soft bg-surface-card-elevated p-2 shadow-2xl animate-dropdownIn',
  flyoutHead:
    'px-2.5 pb-2 pt-1 text-[10px] font-extrabold uppercase tracking-[0.11em] text-ink-muted',
  flyoutItem:
    'flex min-h-[38px] items-center whitespace-nowrap rounded-[10px] px-3 py-1.5 text-[13px] font-medium text-ink-soft no-underline transition-[background,color] duration-150 hover:bg-[var(--color-primary-light)] hover:text-ink-strong',
  flyoutItemActive:
    'bg-[linear-gradient(90deg,var(--color-primary-light),color-mix(in_srgb,var(--color-secondary)_8%,transparent))] font-bold text-brand-primary',
  searchButton:
    'mx-3 mt-2 flex min-h-[38px] items-center gap-2 rounded-xl border border-line-soft bg-[var(--btn-secondary-bg)] px-3 text-[13px] font-semibold text-ink-soft shadow-xs transition-[background,border-color,color,transform,box-shadow] duration-150 ease-[var(--ease-out)] hover:-translate-y-px hover:bg-surface-2 hover:border-line-medium hover:text-ink-strong active:translate-y-0 active:scale-[0.98]',
  kbd:
    'ml-auto rounded-[8px] border border-brand-primary/14 bg-[var(--color-primary-light)] px-1.5 py-0.5 text-[10.5px] font-bold text-brand-primary',
  studyCard:
    'relative mx-3 mt-2.5 mb-3 grid min-h-[128px] shrink-0 overflow-hidden rounded-xl border border-line-soft bg-[linear-gradient(145deg,color-mix(in_srgb,#0ea5e9_9%,var(--surface-card)),color-mix(in_srgb,var(--color-primary)_7%,var(--surface-card)))] p-3 shadow-sm before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_82%_16%,color-mix(in_srgb,var(--color-primary)_18%,transparent),transparent_34%),radial-gradient(circle_at_10%_100%,color-mix(in_srgb,#0ea5e9_14%,transparent),transparent_38%)] before:content-[""] dark:border-white/10 dark:bg-[linear-gradient(145deg,rgba(14,165,233,0.10),rgba(37,99,235,0.08),rgba(255,255,255,0.04))] max-[900px]:hidden',
  studyIcon:
    'absolute right-2 top-1 grid h-[82px] w-[92px] place-items-center text-[var(--color-teal)]',
  studyCopy:
    'relative z-[1] mt-auto grid max-w-[150px] gap-1 [&_p]:m-0 [&_p]:line-clamp-3 [&_p]:text-[10.5px] [&_p]:leading-snug [&_p]:text-ink-soft [&_strong]:text-[13px] [&_strong]:font-extrabold [&_strong]:text-ink-strong',
};

/* ── Flyout panel (collapsed mode submenu) ─────────────────────── */
function FlyoutPanel({ group, onClose }) {
  const panelRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div className={sidebarUi.flyout} ref={panelRef}>
      <div className={sidebarUi.flyoutHead}>{group.label}</div>
      {group.children.map((child) => (
        <NavLink
          key={child.to}
          to={child.to}
          end={isExactNavPath(child.to)}
          className={({ isActive }) => cx(sidebarUi.flyoutItem, isActive && sidebarUi.flyoutItemActive)}
          onClick={onClose}
        >
          {child.label}
        </NavLink>
      ))}
    </div>
  );
}

/* ── Group nav item (expandable submenu) ───────────────────────── */
function GroupNavItem({ item, index, role, isCollapsed, isGroupOpen, onToggle, onClose }) {
  const location = useLocation();
  const IconComp = Icons[item.icon] || Icons.AI;
  const isActive = item.children.some((c) => location.pathname.startsWith(c.to));
  const [flyoutOpen, setFlyoutOpen] = useState(false);

  const itemRef = useRef(null);

  function handleMouseEnter() {
    item.children?.forEach((child) => preloadRouteByPath(child.to, role));
    if (isCollapsed) setFlyoutOpen(true);
  }
  function handleMouseLeave(e) {
    if (isCollapsed) {
      if (itemRef.current?.contains(e.relatedTarget)) return;
      setFlyoutOpen(false);
    }
  }

  return (
    <div
      className={sidebarUi.group}
      style={{ '--li': index }}
      ref={itemRef}
      onMouseLeave={handleMouseLeave}
    >
      <button className={cx(
          'group',
          'lms-sidebar-link',
          sidebarUi.link,
          isActive && sidebarUi.linkActive,
          isCollapsed && sidebarUi.linkCollapsed
        )}
        type="button"
       
        onClick={() => {
          if (isCollapsed) {
            setFlyoutOpen((v) => !v);
          } else {
            onToggle(item.label);
          }
        }}
        onMouseEnter={handleMouseEnter}
        onFocus={handleMouseEnter}
        aria-expanded={isGroupOpen || flyoutOpen}
      >
        <span className={cx('lms-sidebar-link-icon', sidebarUi.icon, isActive && sidebarUi.iconActive, isCollapsed && sidebarUi.iconCollapsed)}><IconComp /></span>
        <span className={cx('lms-sidebar-link-text', sidebarUi.label, isCollapsed && 'min-[901px]:hidden')}>{item.label}</span>
        <span className={cx(sidebarUi.arrow, isGroupOpen && !isCollapsed && sidebarUi.arrowOpen, isCollapsed && 'min-[901px]:hidden')} aria-hidden="true"><ChevronIcon /></span>
        <span className={sidebarUi.tooltip} aria-hidden="true">{item.label}</span>
      </button>

      {/* Expanded mode: inline accordion */}
      {!isCollapsed && isGroupOpen && (
        <div className={sidebarUi.submenu}>
          {item.children.map((child) => (
            <NavLink
              key={child.to}
              to={child.to}
              end={isExactNavPath(child.to)}
              className={({ isActive: a }) => cx(sidebarUi.submenuItem, a && sidebarUi.submenuItemActive)}
              onMouseEnter={() => preloadRouteByPath(child.to, role)}
              onFocus={() => preloadRouteByPath(child.to, role)}
              onClick={onClose}
            >
              <span className={sidebarUi.submenuDot} aria-hidden="true" />
              <span>{child.label}</span>
            </NavLink>
          ))}
        </div>
      )}

      {/* Collapsed mode: flyout panel */}
      {isCollapsed && flyoutOpen && (
        <FlyoutPanel group={item} onClose={() => setFlyoutOpen(false)} />
      )}
    </div>
  );
}

/* ── Student accent picker (blue / violet) ────────────────────── */
function StudentAccentPicker() {
  const studentAccent = useThemeStore((state) => state.studentAccent);
  const setStudentAccent = useThemeStore((state) => state.setStudentAccent);

  const options = [
    {
      key: 'blue',
      label: 'Study Blue',
      swatch: 'linear-gradient(135deg, #2563eb 0%, #38bdf8 100%)',
    },
    {
      key: 'violet',
      label: 'Violet',
      swatch: 'linear-gradient(135deg, #3d5afe 0%, #8b5cf6 100%)',
    },
  ];

  return (
    <div className="lms-student-accent-picker" role="radiogroup" aria-label="Sidebar color theme">
      <span className="lms-student-accent-picker__label">Theme</span>
      <div className="lms-student-accent-picker__row">
        {options.map((opt) => {
          const isActive = studentAccent === opt.key;
          return (
            <button
              key={opt.key}
              type="button"
              role="radio"
              aria-checked={isActive}
              aria-label={`Switch to ${opt.label} theme`}
              title={opt.label}
              className={cx(
                'lms-student-accent-swatch',
                isActive && 'is-active'
              )}
              onClick={() => setStudentAccent(opt.key)}
            >
              <span
                className="lms-student-accent-swatch__color"
                style={{ background: opt.swatch }}
                aria-hidden="true"
              />
              <span className="lms-student-accent-swatch__text">{opt.label}</span>
              {isActive && (
                <svg
                  className="lms-student-accent-swatch__check"
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                  aria-hidden="true"
                >
                  <path d="M2.5 6.2 5 8.7l4.5-5.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Main sidebar ──────────────────────────────────────────────── */
export function AppSidebar({
  isOpen = false,
  isCollapsed = false,
  isOverlayNav = false,
  isExamFocusMode = false,
  onClose = () => {},
  onSearchOpen = () => {},
}) {
  const user = useAuthStore((state) => state.user);
  const location = useLocation();
  const links = prefixLinks(user?.role === 'admin' ? adminLinks : studentLinks, user?.role);
  const isStudent = user?.role === 'student';
  const studentName = user?.fullName || 'Student';

  const [openGroups, setOpenGroups] = useState(() => {
    return links
      .filter((l) => l.group && l.children?.some((c) => location.pathname.startsWith(c.to)))
      .map((l) => l.label);
  });

  function toggleGroup(label) {
    setOpenGroups((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    );
  }

  const sidebar = (
    <aside
      className={cx(
        'lms-sidebar',
        isStudent && 'lms-sidebar--student-model',
        sidebarUi.shell,
        sidebarUi.shellLight,
        isOpen && sidebarUi.open,
        isOpen && 'is-open',
        isCollapsed && sidebarUi.collapsed,
        isCollapsed && 'is-collapsed',
        isOverlayNav && 'is-overlay-nav',
        isExamFocusMode && 'exam-focus',
        isCollapsed && 'min-[901px]:overflow-visible group/sidebar is-collapsed',
      )}
    >
      {/* ── Logo row ──────────────────────────────────────────────── */}
      <div className={cx('lms-sidebar-brand', sidebarUi.logoRow, isCollapsed && sidebarUi.logoRowCollapsed)}>
        <div className={cx('lms-sidebar-brand-mark', sidebarUi.brandIcon, isCollapsed && sidebarUi.brandIconCollapsed)} aria-hidden="true">
          <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
            <rect width="30" height="30" rx="9" fill="url(#sb-logo-g)"/>
            <path d="M9 10.5h12M9 15h8M9 19.5h12" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
            <defs>
              <linearGradient id="sb-logo-g" x1="0" y1="0" x2="30" y2="30" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#2563EB"/>
                <stop offset="100%" stopColor="#0EA5E9"/>
              </linearGradient>
            </defs>
          </svg>
        </div>

        <div className={cx('lms-sidebar-wordmark', sidebarUi.wordmark, isCollapsed && 'min-[901px]:hidden')}>
          <span className={cx('lms-sidebar-brand-name', sidebarUi.wordmarkName)}>ERPM LMS</span>
          <span className={cx('lms-sidebar-brand-sub', sidebarUi.wordmarkRole)}>
            {user?.role === 'admin' ? 'Admin Console' : 'Student Portal'}
          </span>
        </div>

        <button className={sidebarUi.mobileClose}
          type="button"
          onClick={onClose}
          aria-label="Close navigation"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M1.5 1.5L12.5 12.5M12.5 1.5L1.5 12.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        </button>

      </div>

      {/* ── Section label ─────────────────────────────────────────── */}
      <p className={cx('lms-sidebar-section-label', sidebarUi.navLabel, isCollapsed && 'min-[901px]:hidden')}>
        {user?.role === 'admin' ? 'Navigation' : 'Study'}
      </p>

      {/* ── Nav ───────────────────────────────────────────────────── */}
      <nav className={cx('lms-sidebar-nav', sidebarUi.nav, isCollapsed && sidebarUi.navCollapsed)}>
        {links.map((item, i) => {
          if (item.group) {
            return (
              <GroupNavItem
                key={item.label}
                item={item}
                index={i}
                role={user?.role}
                isCollapsed={isCollapsed}
                isGroupOpen={openGroups.includes(item.label)}
                onToggle={toggleGroup}
                onClose={onClose}
              />
            );
          }

          const IconComp = Icons[item.icon] || Icons.Dashboard;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={isExactNavPath(item.to)}
              style={{ '--li': i }}
              className={({ isActive }) => cx(
                'group',
                'lms-sidebar-link',
                sidebarUi.link,
                isActive && sidebarUi.linkActive,
                isCollapsed && sidebarUi.linkCollapsed
              )}
              onMouseEnter={() => preloadRouteByPath(item.to, user?.role)}
              onFocus={() => preloadRouteByPath(item.to, user?.role)}
              onClick={onClose}
            >
              {({ isActive }) => (
                <>
                  <span className={cx('lms-sidebar-link-icon', sidebarUi.icon, isActive && sidebarUi.iconActive, isCollapsed && sidebarUi.iconCollapsed)}><IconComp /></span>
                  <span className={cx('lms-sidebar-link-text', sidebarUi.label, isCollapsed && 'min-[901px]:hidden')}>{item.label}</span>
                  <span className={sidebarUi.tooltip} aria-hidden="true">{item.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {isStudent && !isCollapsed && <StudentAccentPicker />}

      {isStudent && !isCollapsed && (
        <div className="lms-sidebar-student-footer">
          <div className="lms-sidebar-student-avatar" aria-hidden="true">{getInitials(user)}</div>
          <div className="lms-sidebar-student-copy">
            <strong>{studentName}</strong>
            <span>Medical Student</span>
          </div>
        </div>
      )}

    </aside>
  );

  if (typeof document === 'undefined') {
    return sidebar;
  }

  return createPortal(sidebar, document.body);
}

/* ── Mobile bottom navigation bar (students only, ≤900px) ──────── */
const mobileNavItems = [
  { to: '/courses',   label: 'Courses', icon: 'Courses'   },
  { to: '/quizzes',   label: 'Q-Bank',  icon: 'Quizzes'   },
  { to: '/dashboard', label: 'Home',    icon: 'Mission'   },
  { to: '/ai-notes',  label: 'Lessons', icon: 'AiNotes'   },
  { to: '/results',   label: 'Results', icon: 'Results'   },
];

const mobileNavPrimaryPaths = new Set(mobileNavItems.map((item) => item.to));
mobileNavPrimaryPaths.delete('/dashboard');
const MOBILE_TOP_NAV_EXIT_MS = 620;

function withRolePrefix(path, role) {
  if (!path || path.startsWith('/admin') || path.startsWith('/app')) return path;
  if (path.startsWith('/ai/')) return path;
  return `${role === 'admin' ? '/admin' : '/app'}${path}`;
}

function prefixLinks(items, role) {
  return items.map((item) => {
    if (item.children) {
      return {
        ...item,
        children: item.children.map((child) => ({
          ...child,
          to: withRolePrefix(child.to, role),
        })),
      };
    }

    return {
      ...item,
      to: withRolePrefix(item.to, role),
    };
  });
}

export function MobileTopNav({ isOpen = false, isExamFocusMode = false, onClose = () => {} }) {
  const user = useAuthStore((state) => state.user);
  const [shouldRender, setShouldRender] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [geometry, setGeometry] = useState(null);
  const isVisible = Boolean(isOpen && !isExamFocusMode && user);

  useEffect(() => {
    if (isVisible) {
      setShouldRender(true);
      setIsClosing(false);
      return undefined;
    }

    if (!shouldRender) return undefined;

    setIsClosing(true);
    const timer = window.setTimeout(() => {
      setShouldRender(false);
      setIsClosing(false);
    }, MOBILE_TOP_NAV_EXIT_MS);

    return () => window.clearTimeout(timer);
  }, [isVisible, shouldRender]);

  useLayoutEffect(() => {
    if (!shouldRender || typeof window === 'undefined' || typeof document === 'undefined') return undefined;

    function syncGeometry() {
      const trigger = document.querySelector('.student-app-shell .lms-topbar-menu-button, .study-hub-topbar .lms-topbar-menu-button');
      if (!trigger) return;

      const triggerRect = trigger.getBoundingClientRect();
      const shell = trigger.closest('.study-hub-shell, .management-layout, .lms-route-page, .student-app-shell');
      const shellRect = shell?.getBoundingClientRect();
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 390;
      const viewportPadding = viewportWidth <= 380 ? 9 : 12;
      const left = Math.max(viewportPadding, Math.round(triggerRect.left));
      const maxWidth = Math.max(triggerRect.width, viewportWidth - left - viewportPadding);
      const shellWidth = shellRect?.width ? Math.round(shellRect.width) : maxWidth;
      const menuWidth = Math.min(shellWidth, maxWidth, Math.max(230, Math.round(viewportWidth * 0.64)));
      const styles = window.getComputedStyle(trigger);
      const radius = parseFloat(styles.borderTopLeftRadius) || 14;

      setGeometry({
        left,
        top: Math.max(0, Math.round(triggerRect.top)),
        width: menuWidth,
        size: Math.round(Math.max(triggerRect.width, triggerRect.height)),
        radius: Math.round(radius),
      });
    }

    syncGeometry();
    window.addEventListener('resize', syncGeometry);
    window.addEventListener('orientationchange', syncGeometry);

    return () => {
      window.removeEventListener('resize', syncGeometry);
      window.removeEventListener('orientationchange', syncGeometry);
    };
  }, [shouldRender]);

  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return undefined;

    function handleEscape(event) {
      if (event.key === 'Escape') onClose();
    }

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!shouldRender || !user) return null;

  const role = user.role;
  const sourceLinks = role === 'admin' ? adminLinks : studentLinks;
  const menuLinks =
    role === 'student'
      ? sourceLinks.filter((item) => item.group || !mobileNavPrimaryPaths.has(item.to))
      : sourceLinks;
  const items = prefixLinks(menuLinks, role);
  const isStudentMenu = role === 'student';
  const title = role === 'admin' ? 'Admin Console' : 'Student Portal';
  const geometryStyle = geometry
    ? {
        '--mobile-top-nav-left': `${geometry.left}px`,
        '--mobile-top-nav-top': `${geometry.top}px`,
        '--mobile-top-nav-width': `${geometry.width}px`,
        '--mobile-top-nav-trigger-size': `${geometry.size}px`,
        '--mobile-top-nav-trigger-radius': `${geometry.radius}px`,
      }
    : undefined;

  const panel = (
    <div
      className={cx('lms-mobile-top-nav-layer min-[901px]:hidden', isClosing && 'is-closing')}
      style={geometryStyle}
    >
      <button
        type="button"
        className="lms-mobile-top-nav-backdrop"
        onClick={onClose}
        aria-label="Close navigation"
      />

      <section
        className={cx('lms-mobile-top-nav', isStudentMenu && 'lms-mobile-top-nav--plain')}
        role="dialog"
        aria-modal="true"
        aria-label="Mobile navigation"
      >
        {!isStudentMenu && (
          <header className="lms-mobile-top-nav__head">
            <span className="lms-mobile-top-nav__mark" aria-hidden="true">
              <svg width="28" height="28" viewBox="0 0 30 30" fill="none">
                <rect width="30" height="30" rx="9" fill="url(#mobile-nav-logo-g)" />
                <path d="M9 10.5h12M9 15h8M9 19.5h12" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
                <defs>
                  <linearGradient id="mobile-nav-logo-g" x1="0" y1="0" x2="30" y2="30" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#2563EB" />
                    <stop offset="100%" stopColor="#0EA5E9" />
                  </linearGradient>
                </defs>
              </svg>
            </span>

            <div className="lms-mobile-top-nav__brand">
              <strong>ERPM LMS</strong>
              <span>{title}</span>
            </div>

            <button
              type="button"
              className="lms-mobile-top-nav__close"
              onClick={onClose}
              aria-label="Close navigation"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M4.5 4.5 11.5 11.5M11.5 4.5 4.5 11.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          </header>
        )}

        {isStudentMenu && (
          <button
            type="button"
            className="lms-mobile-top-nav__plain-close"
            onClick={onClose}
            aria-label="Close navigation"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M4.5 4.5 11.5 11.5M11.5 4.5 4.5 11.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        )}

        <nav className="lms-mobile-top-nav__list">
          {items.map((item) => {
            if (item.group) {
              const ParentIcon = Icons[item.icon] || Icons.AI;
              return (
                <div className="lms-mobile-top-nav__group" key={item.label}>
                  <span className="lms-mobile-top-nav__group-label">
                    <ParentIcon />
                    {item.label}
                  </span>
                  {item.children.map((child) => (
                    <NavLink
                      key={child.to}
                      to={child.to}
                      end={isExactNavPath(child.to)}
                      onPointerDown={() => preloadRouteByPath(child.to, role)}
                      onFocus={() => preloadRouteByPath(child.to, role)}
                      onClick={onClose}
                      className={({ isActive }) => cx('lms-mobile-top-nav__item is-child', isActive && 'is-active')}
                    >
                      <span className="lms-mobile-top-nav__child-dot" aria-hidden="true" />
                      <span>{child.label}</span>
                    </NavLink>
                  ))}
                </div>
              );
            }

            const IconComp = Icons[item.icon] || Icons.Dashboard;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={isExactNavPath(item.to)}
                onPointerDown={() => preloadRouteByPath(item.to, role)}
                onFocus={() => preloadRouteByPath(item.to, role)}
                onClick={onClose}
                className={({ isActive }) => cx('lms-mobile-top-nav__item', isActive && 'is-active')}
              >
                <span className="lms-mobile-top-nav__icon" aria-hidden="true">
                  <IconComp />
                </span>
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </section>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(panel, document.body);
}

export function MobileBottomNav({ isExamFocusMode = false, onNavigate = () => {} }) {
  const user = useAuthStore((s) => s.user);

  if (user?.role !== 'student' || isExamFocusMode) return null;

  const items = prefixLinks(mobileNavItems, user?.role);

  const nav = (
    <nav
      className="lms-mobile-bottom-nav lms-mobile-bottom-nav--app3 fixed inset-x-0 bottom-0 z-[9999] isolate pointer-events-none min-[901px]:hidden"
      aria-label="Mobile navigation"
    >
      <div className="lms-mobile-bottom-nav__inner pointer-events-auto">
        {items.map((item) => {
          const IconComp = Icons[item.icon] || Icons.Mission;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={isExactNavPath(item.to)}
              onPointerDown={() => preloadRouteByPath(item.to, user?.role)}
              onTouchStart={() => preloadRouteByPath(item.to, user?.role)}
              onClick={onNavigate}
              aria-label={item.label}
              className={({ isActive }) => cx('lms-mobile-bottom-nav__tab', isActive && 'is-active')}
            >
              {() => (
                <>
                  <span className="lms-mobile-bottom-nav__icon">
                    <IconComp />
                  </span>
                  <span className="lms-mobile-bottom-nav__label">{item.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(nav, document.body);
}
