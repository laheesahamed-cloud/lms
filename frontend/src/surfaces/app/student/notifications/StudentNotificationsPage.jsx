import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchNotifications, markNotificationRead } from '../../../../shared/api/workspace.api.js';
import { AppHeader } from '../../../../shared/layout/AppHeader.jsx';
import { cx, ui } from '../../../../shared/styles/tailwindClasses.js';
import { getSafeInternalPath } from '../../../../shared/utils/linkSafety.js';

function getNotificationTimestamp(item) {
  const value = item?.publishAt || item?.createdAt || item?.updatedAt || '';
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function sortLatestNotifications(items) {
  return [...items].sort((a, b) => getNotificationTimestamp(b) - getNotificationTimestamp(a));
}

export function StudentNotificationsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  async function load() { setItems(await fetchNotifications()); }

  useEffect(() => {
    load().catch(() => {});
  }, []);

  const unreadItems = useMemo(() => sortLatestNotifications(items.filter((item) => !item.read)), [items]);
  const visibleItems = unreadItems.length ? unreadItems.slice(0, 5) : sortLatestNotifications(items);

  return <main className={ui.screenShell}><section className={ui.managementLayout}>
    <AppHeader title="Notifications" subtitle="Announcements, access updates, and important LMS messages." />
    <section className="grid gap-3">
      {unreadItems.length > 5 ? (
        <div className={ui.infoCard}>Showing the latest 5 unread notifications.</div>
      ) : null}
      {visibleItems.length ? visibleItems.map((item) => {
      const safeActionPath = getSafeInternalPath(item.actionPath);
      return (
        <article key={item.id} className={cx(ui.panelCard, !item.read && 'border-brand-primary/30')}>
          <div className={ui.panelTop}>
            <div>
              <span className={ui.eyebrow}>{item.kind || 'announcement'}</span>
              <h2>{item.title}</h2>
              <p>{item.body}</p>
            </div>
            {!item.read ? <span className={ui.tablePill}>Unread</span> : null}
          </div>
          <div className={ui.buttonRow}>
            {safeActionPath ? <button className={ui.secondaryAction} onClick={() => navigate(safeActionPath)}>Open</button> : null}
            {item.kind === 'announcement' && !item.read ? <button className={ui.secondaryAction} onClick={async () => { await markNotificationRead(item.id); await load(); }}>Mark read</button> : null}
          </div>
        </article>
      );
    }) : <div className={ui.emptyBox}>No notifications yet.</div>}</section>
  </section></main>;
}
