import { fetchNotifications } from '../api/workspace.api.js';
import { showLocalNotification, getLocalNotificationPermission } from '../platform/native/LocalNotifications.js';

/**
 * Bridges the admin-authored, DB-backed notifications into on-device LOCAL notifications.
 *
 * Flow: admin sends -> stored in `announcements` -> served from `/student/notifications`
 *       -> this poller fetches, finds unseen items, and shows them as LOCAL notifications.
 *
 * De-dupes via a high-water-mark of the largest notification id already shown, persisted
 * in localStorage so the same announcement is never surfaced twice.
 */

const LAST_SEEN_KEY = 'lms_local_notif_last_seen_id';
const DEFAULT_INTERVAL_MS = 60_000;

let timer = null;
let running = false;

function readLastSeenId() {
  if (typeof window === 'undefined') return 0;
  const raw = Number(window.localStorage.getItem(LAST_SEEN_KEY) || 0);
  return Number.isFinite(raw) && raw > 0 ? raw : 0;
}

function writeLastSeenId(id) {
  if (typeof window === 'undefined') return;
  const numeric = Number(id);
  if (Number.isFinite(numeric) && numeric > 0) {
    window.localStorage.setItem(LAST_SEEN_KEY, String(numeric));
  }
}

function notificationId(item) {
  const id = Number(item?.id);
  return Number.isFinite(id) && id > 0 ? id : 0;
}

/**
 * Fetch notifications and surface any unseen ones as local notifications.
 * @param {object} [opts]
 * @param {boolean} [opts.silent] When true (first run / priming), record ids without showing.
 */
export async function syncAnnouncementsToLocal({ silent = false } = {}) {
  if (running) return { ok: false, shown: 0, reason: 'busy' };
  running = true;
  try {
    const permission = await getLocalNotificationPermission();
    if (permission !== 'granted') {
      return { ok: false, shown: 0, reason: 'permission' };
    }

    const fetched = await fetchNotifications().catch(() => []);
    const items = Array.isArray(fetched) ? fetched : [];
    const lastSeen = readLastSeenId();
    let maxId = lastSeen;
    let shown = 0;

    // Oldest-first so notifications appear in chronological order.
    const fresh = items
      .filter((item) => notificationId(item) > lastSeen && !item.read)
      .sort((a, b) => notificationId(a) - notificationId(b));

    for (const item of fresh) {
      const id = notificationId(item);
      maxId = Math.max(maxId, id);
      if (silent) continue;
      await showLocalNotification({
        id,
        title: item.title || 'xyndrome',
        body: item.body || 'You have a new notification.',
        url: item.actionPath || '/notifications',
      });
      shown += 1;
    }

    // Even when nothing is shown, advance the marker past any seen ids so reads/old
    // items don't re-trigger later.
    const highest = items.reduce((acc, item) => Math.max(acc, notificationId(item)), maxId);
    writeLastSeenId(highest);

    return { ok: true, shown };
  } catch (error) {
    return { ok: false, shown: 0, reason: error?.message || 'error' };
  } finally {
    running = false;
  }
}

/** Begin periodic syncing. Primes silently on first run so history isn't replayed. */
export function startAnnouncementLocalSync({ intervalMs = DEFAULT_INTERVAL_MS } = {}) {
  if (typeof window === 'undefined' || timer) return;

  // Prime: record current ids without firing a burst of historical notifications.
  syncAnnouncementsToLocal({ silent: true }).catch(() => {});

  timer = window.setInterval(() => {
    syncAnnouncementsToLocal().catch(() => {});
  }, Math.max(15_000, intervalMs));

  // Re-check promptly when the app returns to the foreground.
  document.addEventListener('visibilitychange', handleVisibility);
}

function handleVisibility() {
  if (document.visibilityState === 'visible') {
    syncAnnouncementsToLocal().catch(() => {});
  }
}

export function stopAnnouncementLocalSync() {
  if (timer) {
    window.clearInterval(timer);
    timer = null;
  }
  document.removeEventListener('visibilitychange', handleVisibility);
}
