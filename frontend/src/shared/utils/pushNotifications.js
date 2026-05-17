import {
  deletePushSubscription,
  fetchPushVapidPublicKey,
  savePushSubscription,
  updatePushSettings,
} from '../api/pushNotifications.api.js';
import { detectPlatform, isStandalonePwaDisplay } from '../platform/detect.js';
import { shouldRegisterServiceWorker } from '../platform/config.js';

const DEFAULT_SW_URL = '/lms/sw.js';
const DEFAULT_SW_SCOPE = '/lms/';

export function isPushNotificationSupported() {
  const platform = detectPlatform();
  if (platform.isNative || platform.isDesktopApp) return false;

  return (
    typeof window !== 'undefined' &&
    'Notification' in window
  );
}

export function isIosDevice() {
  return detectPlatform().isIos;
}

export function isStandalonePwa() {
  return isStandalonePwaDisplay();
}

export function getNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

export async function registerLmsServiceWorker() {
  if (!shouldRegisterServiceWorker(detectPlatform()) || typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  const swUrl = import.meta.env.VITE_PWA_SW_URL || DEFAULT_SW_URL;
  const scope = import.meta.env.VITE_PWA_SW_SCOPE || DEFAULT_SW_SCOPE;
  return navigator.serviceWorker.register(swUrl, { scope });
}

export async function getActiveLmsServiceWorkerRegistration() {
  const registration = await registerLmsServiceWorker();
  if (!registration) return null;
  await navigator.serviceWorker.ready;
  return registration;
}

export async function enablePhonePushNotifications({ deliveryMode = 'outside' } = {}) {
  const platform = detectPlatform();
  if (platform.isNative) {
    throw new Error('Native push notifications must be handled by the Capacitor notification service, not Web Push.');
  }

  if (typeof window === 'undefined' || !('Notification' in window)) {
    throw new Error(getUnsupportedPushMessage());
  }

  if (!window.isSecureContext) {
    throw new Error('Push notifications require HTTPS. On iPhone, open the installed Home Screen app from an HTTPS LMS URL.');
  }

  if (isIosDevice() && !isStandalonePwa()) {
    throw new Error('On iPhone/iPad, install the LMS to the Home Screen first, then open the installed app and enable notifications.');
  }

  const permission = await requestNotificationPermissionSafely();
  if (permission !== 'granted') {
    await updatePushSettings({ deliveryMode: 'inside' }).catch(() => {});
    throw new Error(getPermissionHelpMessage(permission));
  }

  if (!('serviceWorker' in navigator)) {
    throw new Error(getUnsupportedPushMessage());
  }

  const registration = await getActiveLmsServiceWorkerRegistration();
  if (!registration) {
    throw new Error('Service worker registration failed.');
  }
  if (!registration.pushManager) {
    if (isIosDevice()) {
      throw new Error('Safari can send web push from the installed Home Screen app. Add the LMS to your Home Screen, open it from the app icon, then enable notifications.');
    }
    throw new Error('Push subscriptions are not available in this browser.');
  }

  const vapid = await fetchPushVapidPublicKey();
  if (!vapid?.enabled || !vapid?.publicKey) {
    throw new Error('Push notifications are not configured on the server.');
  }

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapid.publicKey),
    });
  }

  await savePushSubscription({
    subscription: subscription.toJSON(),
    deliveryMode,
  });

  return subscription;
}

export async function disablePhonePushNotifications({ deliveryMode = 'inside' } = {}) {
  const platform = detectPlatform();
  if (platform.isNative) {
    await updatePushSettings({ deliveryMode });
    return { ok: true };
  }

  if (!isPushNotificationSupported()) {
    await updatePushSettings({ deliveryMode });
    return { ok: true };
  }

  const registration = await getActiveLmsServiceWorkerRegistration();
  if (!registration?.pushManager) {
    await updatePushSettings({ deliveryMode });
    return { ok: true };
  }
  const subscription = await registration?.pushManager.getSubscription();

  if (subscription) {
    await deletePushSubscription({ endpoint: subscription.endpoint }).catch(() => {});
    await subscription.unsubscribe().catch(() => false);
  }

  await updatePushSettings({ deliveryMode });
  return { ok: true };
}

export function isIosSafariPwaCapable() {
  return isIosDevice() && !isStandalonePwa();
}

function requestNotificationPermissionSafely() {
  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    return Promise.resolve(Notification.permission);
  }

  return new Promise((resolve) => {
    let settled = false;

    function finish(value) {
      if (settled) return;
      settled = true;
      resolve(value || Notification.permission || 'default');
    }

    try {
      if (Notification.requestPermission.length > 0) {
        Notification.requestPermission((result) => finish(result));
        window.setTimeout(() => finish(Notification.permission), 8000);
        return;
      }

      const request = Notification.requestPermission();
      if (request && typeof request.then === 'function') {
        request.then(finish).catch(() => finish(Notification.permission));
      } else {
        finish(Notification.permission);
      }
    } catch (error) {
      finish(Notification.permission);
    }

    window.setTimeout(() => finish(Notification.permission), 8000);
  });
}

function getPermissionHelpMessage(permission) {
  if (permission === 'denied') {
    return 'Notification permission is blocked. In Safari, allow notifications for this site/app from Safari Settings, then try again.';
  }
  if (isIosDevice() && !isStandalonePwa()) {
    return 'On iPhone/iPad, install the LMS to the Home Screen first, then open the installed app and enable notifications.';
  }
  return 'Notification permission was not granted. Please choose Allow when Safari asks for permission.';
}

function getUnsupportedPushMessage() {
  if (isIosDevice()) {
    return 'Safari Web Push works from the installed Home Screen app on iOS 16.4+. Add the HTTPS LMS site to Home Screen, open it from the app icon, then enable notifications.';
  }
  return 'Push notifications are not supported in this browser.';
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = `${base64String}${padding}`.replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}
