import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchNotifications, markNotificationRead } from '../../../../shared/api/workspace.api.js';
import { AppHeader } from '../../../../shared/layout/AppHeader.jsx';
import { cx, ui } from '../../../../shared/styles/tailwindClasses.js';
import { getSafeInternalPath } from '../../../../shared/utils/linkSafety.js';

const notificationCardClass =
  'grid min-h-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-[var(--radius-sm)] border border-line-soft bg-surface-card px-3.5 py-2.5 shadow-none max-[640px]:grid-cols-1 max-[640px]:items-start';
const notificationCopyClass =
  'min-w-0 [&_h2]:m-0 [&_h2]:line-clamp-1 [&_h2]:text-[13.5px] [&_h2]:font-extrabold [&_h2]:leading-snug [&_h2]:text-ink-strong [&_p]:m-0 [&_p]:mt-0.5 [&_p]:line-clamp-2 [&_p]:text-[12px] [&_p]:leading-snug [&_p]:text-ink-soft';
const notificationActionsClass =
  'flex shrink-0 items-center justify-end gap-2 max-[640px]:w-full max-[640px]:justify-between';

function getNotificationTimestamp(item) {
  const value = item?.publishAt || item?.createdAt || item?.updatedAt || '';
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function sortLatestNotifications(items) {
  return [...items].sort((a, b) => getNotificationTimestamp(b) - getNotificationTimestamp(a));
}

function formatNotificationTime(item) {
  const value = item?.publishAt || item?.createdAt || item?.updatedAt || '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
}

export function StudentNotificationsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  async function load() { setItems(await fetchNotifications()); }

  useEffect(() => {
    load().catch(() => {});
  }, []);

  const visibleItems = useMemo(() => sortLatestNotifications(items), [items]);

  return <main className="dashboard-page study-hub-page student-notifications-page"><section className="study-hub-shell">
    <AppHeader title="Notifications" subtitle="Message Inbox" />
    <section className="grid gap-2">
      {visibleItems.length ? visibleItems.map((item) => {
      const safeActionPath = getSafeInternalPath(item.actionPath);
      return (
        <article key={item.id} className={cx(notificationCardClass, !item.read && 'border-brand-primary/30 bg-[var(--color-primary-light)]')}>
          <div className={notificationCopyClass}>
            <div className="mb-1 flex min-w-0 flex-wrap items-center gap-2">
              <span className="rounded-full border border-line-soft bg-surface-1 px-2 py-0.5 text-[10.5px] font-extrabold uppercase tracking-[0.05em] text-ink-muted">{item.kind || 'announcement'}</span>
              {!item.read ? <span className={ui.tablePill}>Unread</span> : null}
              <span className="text-[11px] font-semibold text-ink-muted">{formatNotificationTime(item)}</span>
            </div>
            <h2>{item.title}</h2>
            <p>{item.body}</p>
          </div>
          <div className={notificationActionsClass}>
            {safeActionPath ? <button className={cx(ui.ghostSmall, 'max-[520px]:w-auto')} onClick={() => navigate(safeActionPath)}>Open</button> : <span />}
            {item.kind === 'announcement' && !item.read ? <button className={cx(ui.secondaryAction, 'max-[520px]:w-auto')} onClick={async () => { await markNotificationRead(item.id); await load(); }}>Mark read</button> : null}
          </div>
        </article>
      );
    }) : <div className={ui.emptyBox}>No notifications yet.</div>}</section>
  </section></main>;
}
