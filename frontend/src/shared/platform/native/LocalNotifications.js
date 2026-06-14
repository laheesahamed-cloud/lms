import { Capacitor } from '@capacitor/core';
import { requestSpaNavigation } from '../../routing/spaNavigation.js';

/**
 * Unified local-notification layer.
 *
 * Primary target is the installed Capacitor app via `@capacitor/local-notifications`.
 * On the web (e.g. the admin panel running in a browser) it transparently falls back
 * to the Notification API / service worker so the same calls still surface a banner
 * and the admin test console remains usable without a device.
 *
 * Local notifications are generated ON the device — they do not depend on FCM/APNs,
 * VAPID keys, or any developer-account push setup.
 */

const ANDROID_LOCAL_CHANNEL = {
  id: 'local_reminders',
  name: 'Study reminders',
  description: 'On-device study reminders and locally shown announcements.',
  importance: 4,
  visibility: 1,
  vibration: true,
  lights: true,
  lightColor: '#2563EB',
};

let nativeHandlersInstalled = false;
let androidChannelPromise = null;

function isNative() {
  return Capacitor.isNativePlatform();
}

function webNotificationsAvailable() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/** Coarse capability descriptor for UI/status panels. */
export function getLocalNotificationSupport() {
  if (isNative()) {
    return { supported: true, channel: 'native', platform: Capacitor.getPlatform() };
  }
  if (webNotificationsAvailable()) {
    return { supported: true, channel: 'web', platform: 'web', permission: Notification.permission };
  }
  return { supported: false, channel: 'none', platform: 'unsupported' };
}

async function ensureAndroidChannel(LocalNotifications) {
  if (Capacitor.getPlatform() !== 'android' || typeof LocalNotifications?.createChannel !== 'function') {
    return;
  }
  androidChannelPromise ??= LocalNotifications.createChannel(ANDROID_LOCAL_CHANNEL).catch(() => null);
  await androidChannelPromise;
}

/** Request permission to show local notifications. Returns 'granted' | 'denied' | 'unsupported'. */
export async function requestLocalNotificationPermission() {
  if (isNative()) {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    await ensureAndroidChannel(LocalNotifications);
    const result = await LocalNotifications.requestPermissions();
    return result?.display === 'granted' ? 'granted' : 'denied';
  }

  if (!webNotificationsAvailable()) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  try {
    const result = await Notification.requestPermission();
    return result === 'granted' ? 'granted' : 'denied';
  } catch {
    return Notification.permission === 'granted' ? 'granted' : 'denied';
  }
}

export async function getLocalNotificationPermission() {
  if (isNative()) {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const result = await LocalNotifications.checkPermissions().catch(() => null);
    return result?.display === 'granted' ? 'granted' : (result?.display || 'denied');
  }
  if (!webNotificationsAvailable()) return 'unsupported';
  return Notification.permission;
}

function normalizeUrl(url) {
  const value = String(url || '/notifications').trim();
  if (!value.startsWith('/') || value.startsWith('//')) return '/notifications';
  return value;
}

function coerceId(id) {
  const numeric = Number(id);
  if (Number.isInteger(numeric) && numeric > 0) return numeric;
  // Local-notification ids must be 32-bit ints on native; derive a stable-ish one.
  return Math.floor(Math.random() * 2_000_000_000) + 1;
}

/**
 * Show or schedule a local notification.
 *
 * @param {object} opts
 * @param {number} [opts.id]      Stable id (for cancel / de-dupe).
 * @param {string} opts.title
 * @param {string} opts.body
 * @param {string} [opts.url]     Deep link opened on tap.
 * @param {Date}   [opts.at]      When to fire. Omit/now = immediate.
 */
export async function showLocalNotification({ id, title, body, url, at } = {}) {
  const safeUrl = normalizeUrl(url);
  const fireAt = at instanceof Date && at.getTime() > Date.now() ? at : null;

  if (isNative()) {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    await ensureAndroidChannel(LocalNotifications);
    await LocalNotifications.schedule({
      notifications: [
        {
          id: coerceId(id),
          title: title || 'xyndrome',
          body: body || 'You have a new notification.',
          channelId: ANDROID_LOCAL_CHANNEL.id,
          schedule: fireAt ? { at: fireAt, allowWhileIdle: true } : undefined,
          extra: { url: safeUrl },
        },
      ],
    });
    return { ok: true, channel: 'native' };
  }

  // Web fallback.
  if (!webNotificationsAvailable() || Notification.permission !== 'granted') {
    return { ok: false, channel: 'web', reason: 'permission' };
  }

  const fire = () => spawnWebNotification({ title, body, url: safeUrl });
  if (fireAt) {
    const delay = Math.max(0, fireAt.getTime() - Date.now());
    window.setTimeout(fire, delay);
    return { ok: true, channel: 'web', scheduled: true };
  }
  await fire();
  return { ok: true, channel: 'web' };
}

async function spawnWebNotification({ title, body, url }) {
  const options = {
    body: body || 'You have a new notification.',
    data: { url },
    icon: '/lms/pwa-icon-192.png',
    badge: '/lms/favicon-light-192.png',
    tag: `local-${url}`,
  };

  // Prefer the service worker (supports actions + reliable click routing).
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg?.showNotification) {
        await reg.showNotification(title || 'xyndrome', options);
        return;
      }
    }
  } catch {
    /* fall through to direct Notification */
  }

  const notification = new Notification(title || 'xyndrome', options);
  notification.onclick = () => {
    window.focus?.();
    requestSpaNavigation(url);
    notification.close();
  };
}

/** Cancel a previously scheduled local notification by id (native only). */
export async function cancelLocalNotification(id) {
  if (!isNative()) return;
  const numeric = Number(id);
  if (!Number.isInteger(numeric) || numeric <= 0) return;
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  await LocalNotifications.cancel({ notifications: [{ id: numeric }] }).catch(() => {});
}

/** Cancel several scheduled local notifications. */
export async function cancelLocalNotifications(ids = []) {
  if (!isNative()) return;
  const notifications = ids
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0)
    .map((id) => ({ id }));
  if (!notifications.length) return;
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  await LocalNotifications.cancel({ notifications }).catch(() => {});
}

/** Ids of notifications currently scheduled on the device (native only). */
export async function getPendingLocalNotificationIds() {
  if (!isNative()) return [];
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  const pending = await LocalNotifications.getPending().catch(() => null);
  return (pending?.notifications || []).map((n) => Number(n.id)).filter((id) => Number.isInteger(id));
}

/** Install the tap handler that deep-links into the SPA. Idempotent. */
export async function installLocalNotificationHandlers() {
  if (!isNative() || nativeHandlersInstalled) return;
  nativeHandlersInstalled = true;

  const { LocalNotifications } = await import('@capacitor/local-notifications');
  await ensureAndroidChannel(LocalNotifications);

  await LocalNotifications.addListener('localNotificationActionPerformed', (event) => {
    const targetUrl = normalizeUrl(event?.notification?.extra?.url);
    requestSpaNavigation(targetUrl);
  });
}
