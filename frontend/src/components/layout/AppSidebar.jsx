import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore.js';
import { preloadRouteByPath } from '../../app/router.jsx';
import { cx } from '../../styles/tailwindClasses.js';

/* ── Icon Set (20×20) ─────────────────────────────────────────── */
const Icons = {
  Dashboard: () => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect x="2" y="2" width="7.5" height="7.5" rx="2.5" fill="currentColor"/>
      <rect x="10.5" y="2" width="7.5" height="7.5" rx="2.5" fill="currentColor" opacity="0.42"/>
      <rect x="2" y="10.5" width="7.5" height="7.5" rx="2.5" fill="currentColor" opacity="0.42"/>
      <rect x="10.5" y="10.5" width="7.5" height="7.5" rx="2.5" fill="currentColor" opacity="0.68"/>
    </svg>
  ),
  Courses: () => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M10 6C8.4 5 6.3 4.5 4.5 4.5C3.67 4.5 3 5.17 3 6V14.5C3 15.33 3.67 16 4.5 16C6.3 16 8.4 16.5 10 17.5" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M10 6C11.6 5 13.7 4.5 15.5 4.5C16.33 4.5 17 5.17 17 6V14.5C17 15.33 16.33 16 15.5 16C13.7 16 11.6 16.5 10 17.5" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round"/>
      <line x1="10" y1="6" x2="10" y2="17.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  ),
  Structure: () => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect x="7.5" y="2" width="5" height="4" rx="1.5" fill="currentColor"/>
      <rect x="2" y="14" width="5" height="4" rx="1.5" fill="currentColor" opacity="0.65"/>
      <rect x="13" y="14" width="5" height="4" rx="1.5" fill="currentColor" opacity="0.65"/>
      <path d="M10 6V9.5M10 9.5H5M10 9.5H15M5 9.5V14M15 9.5V14" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round"/>
    </svg>
  ),
  Lessons: () => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect x="2" y="3.5" width="16" height="11" rx="2.5" stroke="currentColor" strokeWidth="1.55" fill="none"/>
      <path d="M8.5 7.5L13.5 9.5L8.5 11.5V7.5Z" fill="currentColor"/>
      <path d="M7 17H13" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round"/>
    </svg>
  ),
  Questions: () => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.55" fill="none"/>
      <path d="M8.25 8.25A2 2 0 0 1 12 8.5C12 10.25 10 10.5 10 12.25" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round"/>
      <circle cx="10" cy="14.5" r="0.9" fill="currentColor"/>
    </svg>
  ),
  Quizzes: () => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M7.5 2.5H6A1.5 1.5 0 0 0 4.5 4V16A1.5 1.5 0 0 0 6 17.5H14A1.5 1.5 0 0 0 15.5 16V4A1.5 1.5 0 0 0 14 2.5H12.5" stroke="currentColor" strokeWidth="1.45" fill="none"/>
      <rect x="7.5" y="2" width="5" height="2.5" rx="1.25" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M7 9.5L9 11.5L13.5 7" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M7 14.5H13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.4"/>
    </svg>
  ),
  Exams: () => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect x="3" y="3" width="14" height="14" rx="3" stroke="currentColor" strokeWidth="1.55" fill="none"/>
      <path d="M7 7H13M7 10H11" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round"/>
      <path d="M6.75 13.25L8.25 14.75L13.25 11.25" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Users: () => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="7.5" cy="6.5" r="2.75" stroke="currentColor" strokeWidth="1.55" fill="none"/>
      <path d="M2 17C2 14.1 4.46 11.75 7.5 11.75C10.54 11.75 13 14.1 13 17" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" fill="none"/>
      <circle cx="14.5" cy="7" r="2.2" stroke="currentColor" strokeWidth="1.3" opacity="0.58" fill="none"/>
      <path d="M16.5 17C16.5 15.34 15.36 14 14 14C13.34 14 12.76 14.27 12.36 14.7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.58"/>
    </svg>
  ),
  Settings: () => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="2.75" stroke="currentColor" strokeWidth="1.55" fill="none"/>
      <path d="M10 3.25V5M10 15V16.75M16.75 10H15M5 10H3.25M15.07 4.93L13.82 6.18M6.18 13.82L4.93 15.07M15.07 15.07L13.82 13.82M6.18 6.18L4.93 4.93" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  Mission: () => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.55" fill="none"/>
      <circle cx="10" cy="10" r="4.5" stroke="currentColor" strokeWidth="1.3" opacity="0.52" fill="none"/>
      <circle cx="10" cy="10" r="1.75" fill="currentColor"/>
      <path d="M10 2.5V4.5M10 15.5V17.5M2.5 10H4.5M15.5 10H17.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.32"/>
    </svg>
  ),
  Notes: () => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M5 2.5H12.5L17 7V17A1.5 1.5 0 0 1 15.5 18.5H5A1.5 1.5 0 0 1 3.5 17V4A1.5 1.5 0 0 1 5 2.5Z" stroke="currentColor" strokeWidth="1.5" fill="none"/>
      <path d="M12.5 2.5V7H17" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
      <path d="M7 11H13M7 13.5H11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  ),
  Results: () => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect x="2.5" y="12" width="3.5" height="5.5" rx="1" fill="currentColor" opacity="0.42"/>
      <rect x="8.25" y="8" width="3.5" height="9.5" rx="1" fill="currentColor" opacity="0.68"/>
      <rect x="14" y="4.5" width="3.5" height="13" rx="1" fill="currentColor"/>
      <path d="M2 19H18" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.3"/>
    </svg>
  ),
  AI: () => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M10 2.5L12 8.5H18L13 12.25L15 18.25L10 14.5L5 18.25L7 12.25L2 8.5H8L10 2.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none"/>
    </svg>
  ),
  Billing: () => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect x="2" y="4.5" width="16" height="11" rx="2.5" stroke="currentColor" strokeWidth="1.55" fill="none"/>
      <path d="M2 8.5H18" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="4" y="11.5" width="4.5" height="2.5" rx="0.75" fill="currentColor" opacity="0.42"/>
      <circle cx="15.75" cy="12.75" r="1.25" fill="currentColor" opacity="0.62"/>
    </svg>
  ),
  Bookmarks: () => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M5.5 2.5H14.5C15.05 2.5 15.5 2.95 15.5 3.5V17.5L10 14L4.5 17.5V3.5C4.5 2.95 4.95 2.5 5.5 2.5Z" stroke="currentColor" strokeWidth="1.55" strokeLinejoin="round" fill="none"/>
    </svg>
  ),
  AiNotes: () => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M4.5 2.5H12L16 6.5V17C16 17.55 15.55 18 15 18H4.5C3.95 18 3.5 17.55 3.5 17V3.5C3.5 2.95 3.95 2.5 4.5 2.5Z" stroke="currentColor" strokeWidth="1.4" fill="none"/>
      <path d="M12 2.5V6.5H16" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M6 11H9.5M6 13.5H8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <path d="M13.5 9.25L14.75 11.75L17 11.25L14.75 13L13.5 15.5L12.25 13L10 11.25L12.25 11.75L13.5 9.25Z" fill="currentColor" opacity="0.62"/>
    </svg>
  ),
  Flashcards: () => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect x="1.5" y="7" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.55" fill="none"/>
      <rect x="4.5" y="4.5" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.35" opacity="0.38" fill="none"/>
      <path d="M5 12H8.5M5 14.5H10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
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
  { to: '/settings',      label: 'Settings',      icon: 'Settings'  },
];

const studentLinks = [
  { to: '/dashboard',     label: 'Study Hub',     icon: 'Mission'    },
  { to: '/courses',       label: 'Courses',       icon: 'Courses'    },
  { to: '/ai-notes',      label: 'Lessons',       icon: 'AiNotes'    },
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
  '/structure', '/users', '/settings',
  '/ai/gemini', '/ai/chatgpt',
]);

const sidebarUi = {
  shell:
    'fixed inset-y-0 left-0 z-[820] flex h-screen min-h-screen w-[var(--sidebar-w)] flex-col overflow-hidden rounded-none border-r border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] transition-[transform,width,box-shadow,border-color] duration-[300ms] ease-[var(--ease-smooth)] [height:100dvh] [min-height:100dvh] will-change-[transform,width] shadow-[1px_0_0_var(--line-soft),var(--shadow-sm)] before:pointer-events-none before:absolute before:inset-0 before:bg-[linear-gradient(180deg,rgba(37,99,235,0.035),transparent_36%)] before:content-[""] max-[900px]:w-[min(var(--sidebar-w),88vw)] max-[900px]:-translate-x-full max-[900px]:rounded-r-[22px] max-[900px]:shadow-2xl',
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
    'grid size-[38px] shrink-0 place-items-center rounded-xl bg-[linear-gradient(135deg,#0B1220_0%,#0F766E_44%,#2563EB_100%)] shadow-[0_8px_20px_rgba(20,184,166,0.14)]',
  brandIconCollapsed: 'min-[901px]:size-[36px]',
  wordmark: 'grid min-w-0 gap-0.5',
  wordmarkName: 'truncate text-[14.5px] font-extrabold tracking-[-0.01em] text-ink-strong',
  wordmarkRole: 'truncate text-[10.5px] font-semibold text-ink-soft',
  collapseButton:
    'ml-auto inline-flex size-8 min-h-8 items-center justify-center rounded-full border border-line-soft bg-surface-2 p-0 text-ink-soft opacity-80 shadow-xs transition-[background,color,opacity,box-shadow,transform] duration-150 ease-[var(--ease-out)] hover:bg-surface-3 hover:text-brand-primary hover:opacity-100 hover:shadow-sm hover:-translate-y-px active:translate-y-0 active:scale-[0.97] max-[900px]:hidden',
  collapseButtonLight:
    '',
  collapseButtonCollapsed:
    'min-[901px]:ml-0',
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
    'relative mx-3 mt-2.5 mb-3 grid min-h-[128px] shrink-0 overflow-hidden rounded-xl border border-line-soft bg-[linear-gradient(145deg,color-mix(in_srgb,var(--color-teal)_11%,var(--surface-card)),color-mix(in_srgb,var(--color-primary)_7%,var(--surface-card)))] p-3 shadow-sm before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_82%_16%,color-mix(in_srgb,var(--color-primary)_18%,transparent),transparent_34%),radial-gradient(circle_at_10%_100%,color-mix(in_srgb,var(--color-teal)_16%,transparent),transparent_38%)] before:content-[""] dark:border-white/10 dark:bg-[linear-gradient(145deg,rgba(20,184,166,0.12),rgba(37,99,235,0.08),rgba(255,255,255,0.04))] max-[900px]:hidden',
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
          end={END_EXACT.has(child.to)}
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
        <span className={cx(sidebarUi.icon, isActive && sidebarUi.iconActive, isCollapsed && sidebarUi.iconCollapsed)}><IconComp /></span>
        <span className={cx(sidebarUi.label, isCollapsed && 'min-[901px]:hidden')}>{item.label}</span>
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
              end={END_EXACT.has(child.to)}
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

/* ── Main sidebar ──────────────────────────────────────────────── */
export function AppSidebar({
  isOpen = false,
  isCollapsed = false,
  isExamFocusMode = false,
  onClose = () => {},
  onSearchOpen = () => {},
  onToggleCollapse,
}) {
  const user = useAuthStore((state) => state.user);
  const location = useLocation();
  const links = user?.role === 'admin' ? adminLinks : studentLinks;

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
        sidebarUi.shell,
        sidebarUi.shellLight,
        isOpen && sidebarUi.open,
        isCollapsed && sidebarUi.collapsed,
        isCollapsed && 'is-collapsed',
        isExamFocusMode && 'exam-focus',
        isCollapsed && 'min-[901px]:overflow-visible group/sidebar is-collapsed',
      )}
    >
      {/* ── Logo row ──────────────────────────────────────────────── */}
      <div className={cx(sidebarUi.logoRow, isCollapsed && sidebarUi.logoRowCollapsed)}>
        <div className={cx(sidebarUi.brandIcon, isCollapsed && sidebarUi.brandIconCollapsed)} aria-hidden="true">
          <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
            <rect width="30" height="30" rx="9" fill="url(#sb-logo-g)"/>
            <path d="M9 10.5h12M9 15h8M9 19.5h12" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
            <defs>
              <linearGradient id="sb-logo-g" x1="0" y1="0" x2="30" y2="30" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#2563EB"/>
                <stop offset="100%" stopColor="#14B8A6"/>
              </linearGradient>
            </defs>
          </svg>
        </div>

        <div className={cx(sidebarUi.wordmark, isCollapsed && 'min-[901px]:hidden')}>
          <span className={sidebarUi.wordmarkName}>ERPM LMS</span>
          <span className={sidebarUi.wordmarkRole}>
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

        {onToggleCollapse ? (
          <button className={cx(
              sidebarUi.collapseButton,
              sidebarUi.collapseButtonLight,
              isCollapsed && sidebarUi.collapseButtonCollapsed
            )}
            type="button"
           
            onClick={onToggleCollapse}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <span
              aria-hidden="true"
              className={cx(
                'inline-flex size-full items-center justify-center leading-none transition-transform',
                isCollapsed && 'rotate-180'
              )}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M10 4 6 8l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </button>
        ) : null}
      </div>

      {/* ── Section label ─────────────────────────────────────────── */}
      <p className={cx(sidebarUi.navLabel, isCollapsed && 'min-[901px]:hidden')}>
        {user?.role === 'admin' ? 'Navigation' : 'Study'}
      </p>

      {/* ── Nav ───────────────────────────────────────────────────── */}
      <nav className={cx(sidebarUi.nav, isCollapsed && sidebarUi.navCollapsed)}>
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
              end={END_EXACT.has(item.to)}
              style={{ '--li': i }}
              className={({ isActive }) => cx(
                'group',
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
                  <span className={cx(sidebarUi.icon, isActive && sidebarUi.iconActive, isCollapsed && sidebarUi.iconCollapsed)}><IconComp /></span>
                  <span className={cx(sidebarUi.label, isCollapsed && 'min-[901px]:hidden')}>{item.label}</span>
                  <span className={sidebarUi.tooltip} aria-hidden="true">{item.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* ── Search (students only) ────────────────────────────────── */}
      {user?.role === 'student' && (
        <button className={cx(sidebarUi.searchButton, isCollapsed && 'min-[901px]:hidden')}
          type="button"
         
          onClick={() => { onClose(); onSearchOpen(); }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M9 9L11.5 11.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <span>Search…</span>
          <kbd className={sidebarUi.kbd}>⌘K</kbd>
        </button>
      )}

      {user?.role === 'student' && !isCollapsed && (
        <div className={sidebarUi.studyCard}>
          <div className={sidebarUi.studyIcon} aria-hidden="true">
            <svg width="92" height="82" viewBox="0 0 92 82" fill="none">
              <defs>
                <linearGradient id="sbChest" x1="18" y1="44" x2="74" y2="82" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#D97706" />
                  <stop offset="1" stopColor="#92400E" />
                </linearGradient>
                <linearGradient id="sbLid" x1="18" y1="28" x2="74" y2="46" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#F59E0B" />
                  <stop offset="1" stopColor="#D97706" />
                </linearGradient>
              </defs>
              {/* Glow atmosphere */}
              <circle cx="46" cy="48" r="28" fill="rgba(251,191,36,0.12)" />
              {/* Chest body */}
              <rect x="18" y="46" width="56" height="32" rx="7" fill="url(#sbChest)" />
              <rect x="18" y="46" width="56" height="32" rx="7" stroke="#92400E" strokeWidth="1.5" fill="none" />
              {/* Chest straps */}
              <rect x="38" y="46" width="16" height="32" rx="0" fill="#92400E" opacity=".45" />
              {/* Chest lock */}
              <rect x="40" y="56" width="12" height="10" rx="3" fill="#FACC15" stroke="#D97706" strokeWidth="1.2" />
              <path d="M43 56 Q43 51 46 51 Q49 51 49 56" stroke="#D97706" strokeWidth="1.8" strokeLinecap="round" fill="none" />
              <circle cx="46" cy="61" r="1.5" fill="#D97706" />
              {/* Chest lid */}
              <path d="M17 46 Q18 30 46 28 Q74 30 75 46 Z" fill="url(#sbLid)" stroke="#92400E" strokeWidth="1.5" />
              {/* Lid hinge */}
              <rect x="40" y="43" width="12" height="5" rx="2.5" fill="#D97706" />
              {/* Glowing contents spilling out */}
              <circle cx="34" cy="36" r="5" fill="#FACC15" opacity=".9" />
              <circle cx="46" cy="28" r="6" fill="#FDE68A" opacity=".85" />
              <circle cx="58" cy="34" r="5" fill="#FACC15" opacity=".9" />
              {/* Medical cross book */}
              <rect x="27" y="30" width="14" height="18" rx="3" fill="#14B8A6" transform="rotate(-14 34 39)" />
              <path d="M31 38 H39 M35 34 V42" stroke="white" strokeWidth="1.8" strokeLinecap="round" transform="rotate(-14 34 39)" />
              {/* Pink star */}
              <path d="M60 26 L61.2 30 L65 31 L61.2 32 L60 36 L58.8 32 L55 31 L58.8 30 Z" fill="#FDA4AF" stroke="#BE185D" strokeWidth="1" />
              {/* Sparkle dots */}
              <circle cx="76" cy="38" r="2.5" fill="#67E8F9" opacity=".8" />
              <circle cx="16" cy="42" r="2" fill="#A78BFA" opacity=".8" />
              <circle cx="82" cy="54" r="2" fill="#FACC15" opacity=".7" />
              {/* Doctor mini figure */}
              <circle cx="74" cy="22" r="7" fill="#F6B48F" stroke="#E8956A" strokeWidth="1" />
              <path d="M67 20 Q70 14 74 14 Q78 14 81 20 Q78 16 74 16 Z" fill="#2D1810" />
              <circle cx="71" cy="21" r="1.2" fill="#1E293B" />
              <circle cx="77" cy="21" r="1.2" fill="#1E293B" />
              <path d="M71 26 Q74 28 77 26" stroke="#C05621" strokeWidth="1.2" strokeLinecap="round" fill="none" />
              {/* Mini coat */}
              <path d="M67 29 Q66 40 66 46 Q70 44 74 46 Q78 44 82 46 Q82 40 81 29 Z" fill="white" stroke="#BFDBFE" strokeWidth="1" />
              <path d="M70 29 L69 46 H79 L78 29 Z" fill="#14B8A6" opacity=".7" />
            </svg>
          </div>
          <div className={sidebarUi.studyCopy}>
            <strong>Keep Learning</strong>
            <p>Open your saved notes, quizzes, and course topics faster from one place.</p>
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
