import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchNotifications, markNotificationRead } from '../api/workspace.api.js';
import { useAuthStore } from '../stores/authStore.js';
import { ProfileAvatar } from '../ui/ProfileAvatar.jsx';
import { ThemeToggle } from './ThemeToggle.jsx';
import { HeaderInstallAction } from './HeaderInstallAction.jsx';
import { cx, ui } from '../styles/tailwindClasses.js';

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

function MenuIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M3 5h12M3 9h12M3 13h12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4.5 4.5 11.5 11.5M11.5 4.5 4.5 11.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
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

function useOutsideDismiss(ref, onDismiss) {
  useEffect(() => {
    function handlePointerDown(event) {
      if (!ref.current || ref.current.contains(event.target)) {
        return;
      }
      onDismiss();
    }

    function handleEscape(event) {
      if (event.key === 'Escape') {
        onDismiss();
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [ref, onDismiss]);
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

const topbarUi = {
  header:
    'lms-topbar glass-card sticky top-3 z-50 mb-3 flex min-h-[66px] min-w-0 flex-wrap items-center justify-between gap-3 overflow-visible rounded-xl px-4 py-2.5 max-[900px]:top-2 max-[900px]:min-h-[58px] max-[900px]:rounded-[16px] max-[900px]:p-2.5 max-[760px]:grid max-[760px]:grid-cols-[minmax(0,1fr)_auto] max-[760px]:items-center max-[760px]:gap-x-2 max-[760px]:gap-y-2 max-[520px]:min-h-[54px] max-[520px]:rounded-[14px] max-[520px]:px-2.5 max-[520px]:py-2',
  left: 'flex min-w-[180px] flex-1 items-center gap-2.5 self-center max-[760px]:min-w-0 max-[520px]:gap-1',
  titleBlock: 'grid min-w-0 max-w-full gap-0.5',
  title: 'gradient-text m-0 truncate text-[clamp(15px,1.7vw,21px)] font-extrabold leading-[1.15] max-[420px]:text-[15px]',
  subtitle: 'm-0 max-w-[min(420px,36vw)] truncate text-[11px] font-semibold leading-tight text-ink-soft max-[900px]:hidden',
  center: 'flex min-w-0 w-full max-w-[260px] justify-center max-[1280px]:hidden',
  search:
    'flex h-10 min-h-10 w-full max-w-[232px] items-center gap-2 rounded-lg border border-line-soft bg-[var(--btn-secondary-bg)] px-3 text-ink-soft shadow-none transition-[background,border-color,color] duration-150 ease-[var(--ease-out)] hover:border-brand-primary/22 hover:bg-surface-2 hover:text-ink-strong',
  searchIcon: 'grid shrink-0 place-items-center text-brand-primary',
  searchCopy: 'min-w-0 flex-1 truncate text-left text-[12.5px] font-semibold',
  searchShortcut: 'shrink-0 rounded-md bg-brand-primary-light px-1.5 py-0.5 text-[10px] font-bold text-brand-primary max-[1360px]:hidden',
  right: 'flex min-w-0 shrink-0 items-center justify-end gap-2 self-center max-[760px]:w-auto max-[760px]:justify-end max-[520px]:gap-1',
  mobileMenuButton:
    'lms-topbar-menu-button hidden size-9 min-h-9 shrink-0 items-center justify-center rounded-lg border border-line-soft bg-[var(--btn-secondary-bg)] p-0 text-ink-medium shadow-none transition-[background,border-color,color] duration-150 ease-out hover:border-brand-primary/24 hover:bg-brand-primary/10 hover:text-brand-primary max-[900px]:inline-flex max-[520px]:size-8 max-[520px]:min-h-8 max-[520px]:min-w-8 group-[.sidebar-hidden]/shell:!hidden',
  actionsSlot: 'flex min-w-0 flex-wrap items-center justify-end gap-2 max-[760px]:col-span-2 max-[760px]:w-full max-[760px]:justify-start max-[760px]:border-t max-[760px]:border-line-soft max-[760px]:pt-2 max-[520px]:grid max-[520px]:grid-cols-1 max-[520px]:[&>*]:w-full',
  utility: 'lms-topbar-utility flex min-w-0 shrink-0 items-center gap-2 max-[520px]:grid max-[520px]:grid-flow-col max-[520px]:auto-cols-[32px] max-[520px]:gap-1 [&_.lms-profile-avatar]:max-[520px]:size-6 [&_.lms-profile-avatar]:max-[520px]:rounded-lg [&_.lms-profile-avatar]:max-[520px]:justify-self-center',
  iconButton:
    'relative inline-flex size-9 min-h-9 shrink-0 items-center justify-center rounded-lg border border-line-soft bg-[var(--btn-secondary-bg)] p-0 text-ink-medium shadow-none transition-[background,border-color,color] duration-150 ease-[var(--ease-out)] hover:border-brand-primary/24 hover:bg-brand-primary/10 hover:text-brand-primary max-[520px]:size-8 max-[520px]:min-h-8 max-[520px]:min-w-8',
  countBadge:
    'absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full border-2 border-surface-card bg-brand-error px-1 text-[10px] font-extrabold leading-4 text-white',
  profileButton:
    'inline-flex size-9 min-h-9 min-w-9 shrink-0 items-center justify-center rounded-lg border border-line-soft bg-[var(--btn-secondary-bg)] p-1 text-left shadow-none transition-[background,border-color,color] duration-150 ease-[var(--ease-out)] hover:border-brand-primary/24 hover:bg-brand-primary/10 max-[520px]:size-8 max-[520px]:min-h-8 max-[520px]:min-w-8',
  menuWrap: 'relative z-[60]',
  dropdown:
    'lms-floating-panel motion-smooth absolute right-0 top-[calc(100%+8px)] z-[1200] w-[min(360px,calc(100vw_-_24px))] origin-top-right overflow-hidden rounded-[var(--radius-lg)] border border-line-soft bg-surface-card-elevated shadow-2xl animate-dropdownIn max-[520px]:fixed max-[520px]:inset-x-3 max-[520px]:top-[70px] max-[520px]:w-auto max-[520px]:origin-top max-[520px]:rounded-[18px]',
  profileDropdown:
    'lms-profile-menu w-[min(320px,calc(100vw_-_24px))] max-[520px]:top-[calc(var(--lms-safe-top,0px)+68px)]',
  notificationDropdown:
    'max-[520px]:fixed max-[520px]:inset-x-3 max-[520px]:top-[70px] max-[520px]:max-h-[calc(100dvh-86px)] max-[520px]:w-auto max-[520px]:origin-top max-[520px]:rounded-[18px]',
  dropdownHead:
    'flex min-w-0 items-center justify-between gap-3 border-b border-line-soft px-4 py-3.5 max-[520px]:px-3.5 max-[520px]:py-3 [&_div]:min-w-0 [&_small]:mt-1 [&_small]:block [&_small]:truncate [&_small]:text-xs [&_small]:font-medium [&_small]:text-ink-soft [&_strong]:block [&_strong]:truncate [&_strong]:text-sm [&_strong]:font-extrabold [&_strong]:text-ink-strong',
  dropdownClose:
    'inline-flex size-8 min-h-8 min-w-8 shrink-0 items-center justify-center rounded-lg border border-line-soft bg-[var(--btn-secondary-bg)] p-0 text-ink-soft transition-[background,border-color,color] duration-150 ease-[var(--ease-out)] hover:border-brand-primary/24 hover:bg-brand-primary/10 hover:text-brand-primary',
  dropdownSection: 'grid gap-1 border-t border-line-soft p-2 first:border-t-0',
  notificationList: 'grid max-h-[min(420px,calc(100dvh-210px))] gap-1 overflow-y-auto p-2 [-webkit-overflow-scrolling:touch] max-[520px]:max-h-[calc(100dvh-224px)] max-[520px]:p-1.5',
  notificationItem:
    'grid min-h-14 w-full grid-cols-[10px_minmax(0,1fr)] items-start gap-2.5 rounded-xl border-0 bg-transparent px-3 py-3 text-left transition-colors duration-150 hover:bg-surface-2 active:bg-surface-2 max-[520px]:min-h-[60px] max-[520px]:gap-2 max-[520px]:rounded-[14px] max-[520px]:px-2.5 max-[520px]:py-2.5',
  notificationItemRead: 'opacity-80',
  notificationDot: 'mt-1.5 size-2 rounded-full bg-brand-primary max-[520px]:mt-2',
  notificationDotRead: 'bg-ink-muted/35',
  notificationCopy: 'grid min-w-0 gap-1 [&_p]:m-0 [&_p]:break-words [&_p]:text-xs [&_p]:leading-relaxed [&_p]:text-ink-soft [&_small]:text-[11px] [&_small]:font-semibold [&_small]:text-ink-muted [&_strong]:break-words [&_strong]:text-sm [&_strong]:leading-snug [&_strong]:text-ink-strong',
  dropdownFoot: 'border-t border-line-soft p-2 max-[520px]:p-1.5',
  menuItem:
    'flex min-h-10 w-full items-center justify-start gap-2.5 rounded-xl border-0 bg-transparent px-3 py-2 text-sm font-semibold text-ink-medium shadow-none transition-[background,color,transform] duration-150 ease-[var(--ease-out)] hover:bg-surface-2 hover:text-ink-strong hover:shadow-none active:scale-[0.98]',
  dangerItem: 'text-brand-error hover:bg-brand-error/10 hover:text-brand-error',
  emptyState: 'grid gap-1 px-5 py-8 text-center [&_p]:m-0 [&_p]:text-xs [&_p]:text-ink-soft [&_strong]:text-sm [&_strong]:text-ink-strong',
  mobileCopy: 'hidden',
};

function rolePath(path, role) {
  if (!path) return '';
  if (path.startsWith('/admin') || path.startsWith('/app')) return path;
  return `${role === 'admin' ? '/admin' : '/app'}${path}`;
}

export function AppHeader({ title, subtitle, actions = null, className = '' }) {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);
  const isSigningOut = useAuthStore((state) => state.isSigningOut);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const notificationRef = useRef(null);
  const profileRef = useRef(null);

  useOutsideDismiss(notificationRef, () => setNotificationsOpen(false));
  useOutsideDismiss(profileRef, () => setProfileOpen(false));

  const unreadNotifications = useMemo(() => sortLatestNotifications(notifications.filter((item) => !item.read)), [notifications]);
  const visibleUnreadNotifications = useMemo(() => unreadNotifications.slice(0, 5), [unreadNotifications]);

  const settingsPath = user?.role === 'admin' ? rolePath('/settings', user?.role) : '';
  const profilePath = rolePath('/profile', user?.role);

  async function handleLogout() {
    setProfileOpen(false);
    await signOut();
    navigate('/auth/login');
  }

  async function loadNotifications() {
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
  }

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
    setProfileOpen(false);
    navigate(path);
  }

  function openSearch() {
    window.dispatchEvent(new CustomEvent('lms:open-search'));
  }

  function toggleSidebar() {
    window.dispatchEvent(new CustomEvent('lms:toggle-sidebar'));
  }

  useEffect(() => {
    loadNotifications();
  }, [user?.id]);

  if (user?.role === 'student') {
    return (
      <>
        <header className={cx('study-hub-topbar', className)}>
          <button type="button" className="study-icon-button lms-topbar-menu-button" aria-label="Toggle navigation" onClick={toggleSidebar}>
            <MenuIcon />
          </button>

          <div className="study-topbar-title">
            {subtitle ? <span>{subtitle}</span> : null}
            <h1>{title}</h1>
          </div>

          <div className="study-topbar-actions">
            <button type="button" className="study-icon-button" aria-label="Search lessons and exams" onClick={openSearch}>
              <SearchIcon />
            </button>

            <div className={topbarUi.menuWrap} ref={profileRef}>
              <button
                type="button"
                className="study-avatar study-avatar--profile"
                aria-label="Open profile menu"
                aria-expanded={profileOpen ? 'true' : 'false'}
                onClick={() => {
                  setProfileOpen((current) => !current);
                  setNotificationsOpen(false);
                }}
              >
                <ProfileAvatar user={user} />
              </button>

              {profileOpen ? (
                <div className={cx(topbarUi.dropdown, topbarUi.profileDropdown)}>
                  <div className={topbarUi.dropdownHead}>
                    <ProfileAvatar user={user} size="lg" />
                    <div>
                      <strong>{user?.fullName || 'Signed in user'}</strong>
                      <small>Medical Student</small>
                    </div>
                  </div>

                  <div className={topbarUi.dropdownSection}>
                    <button type="button" className={topbarUi.menuItem} onClick={() => handleNavigate(profilePath)}>
                      <ProfileIcon />
                      <span>Profile</span>
                    </button>
                  </div>

                  <div className={topbarUi.dropdownSection}>
                    <button className={topbarUi.menuItem} type="button" onClick={handleLogout} disabled={isSigningOut}>
                      <LogoutIcon />
                      <span>{isSigningOut ? 'Signing out…' : 'Log out'}</span>
                    </button>
                  </div>
                </div>
              ) : null}
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

  return (
    <>
      <header className={cx(topbarUi.header, className)}>
        <div className={cx('lms-topbar-left', topbarUi.left)}>
          <button className={topbarUi.mobileMenuButton}
            type="button"
            onClick={toggleSidebar}
            aria-label="Open navigation"
          >
            <MenuIcon />
          </button>

          <div className={topbarUi.titleBlock}>
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
            <div className={topbarUi.menuWrap} ref={notificationRef}>
              <button className={topbarUi.iconButton}
                type="button"
               
                aria-label="Notifications"
                aria-expanded={notificationsOpen ? 'true' : 'false'}
                onClick={() => {
                  setNotificationsOpen((current) => {
                    if (!current) {
                      loadNotifications();
                    }
                    return !current;
                  });
                  setProfileOpen(false);
                }}
              >
                <BellIcon />
                {unreadNotifications.length ? <span className={topbarUi.countBadge}>{unreadNotifications.length}</span> : null}
              </button>

              {notificationsOpen ? (
                <div className={cx(topbarUi.dropdown, topbarUi.notificationDropdown)}>
                  <div className={topbarUi.dropdownHead}>
                    <div>
                      <strong>Unread notifications</strong>
                      <small>
                        {unreadNotifications.length
                          ? unreadNotifications.length > 5
                            ? `Showing latest 5 of ${unreadNotifications.length}`
                            : `${unreadNotifications.length} waiting for you`
                          : 'You are all caught up'}
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
                  ) : unreadNotifications.length ? (
                    <div className={topbarUi.notificationList}>
                      {visibleUnreadNotifications.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className={topbarUi.notificationItem}
                          onClick={() => handleNotificationRead(item)}
                        >
                          <span className={topbarUi.notificationDot} aria-hidden="true" />
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
                      <strong>No unread notifications</strong>
                      <p>New unread updates will appear here.</p>
                    </div>
                  )}

                  {unreadNotifications.length ? (
                    <div className={topbarUi.dropdownFoot}>
                      <button type="button" className={topbarUi.menuItem} onClick={() => navigate(rolePath('/notifications', user?.role))}>
                        <span>Open notifications page</span>
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
            ) : null}

            <button className={topbarUi.iconButton}
              type="button"
             
              aria-label="Search"
              onClick={openSearch}
            >
              <SearchIcon />
            </button>

            <div className={topbarUi.menuWrap} ref={profileRef}>
              <button className={topbarUi.profileButton}
                type="button"
               
                aria-label="Open profile menu"
                aria-expanded={profileOpen ? 'true' : 'false'}
                onClick={() => {
                  setProfileOpen((current) => !current);
                  setNotificationsOpen(false);
                }}
              >
                <ProfileAvatar user={user} />
              </button>

              {profileOpen ? (
                <div className={cx(topbarUi.dropdown, topbarUi.profileDropdown)}>
                  <div className={topbarUi.dropdownHead}>
                    <ProfileAvatar user={user} size="lg" />
                    <div>
                      <strong>{user?.fullName || 'Signed in user'}</strong>
                      <small>{user?.role === 'admin' ? 'Administrator' : 'Medical Student'}</small>
                    </div>
                  </div>

                  <div className={topbarUi.dropdownSection}>
                    <button type="button" className={topbarUi.menuItem} onClick={() => handleNavigate(profilePath)}>
                      <ProfileIcon />
                      <span>Profile</span>
                    </button>

                    {settingsPath ? (
                      <button type="button" className={topbarUi.menuItem} onClick={() => handleNavigate(settingsPath)}>
                        <SettingsIcon />
                        <span>Settings</span>
                      </button>
                    ) : null}
                  </div>

                  <div className={topbarUi.dropdownSection}>
                    <button className={topbarUi.menuItem}
                      type="button"
                     
                      onClick={handleLogout}
                      disabled={isSigningOut}
                    >
                      <LogoutIcon />
                      <span>{isSigningOut ? 'Signing out…' : 'Log out'}</span>
                    </button>
                  </div>
                </div>
              ) : null}
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
