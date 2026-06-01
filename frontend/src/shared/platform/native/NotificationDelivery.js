import { Capacitor } from '@capacitor/core';
import { deleteNativePushToken, saveNativePushToken } from '../../api/pushNotifications.api.js';

let nativeHandlersInstalled = false;
let androidChannelsPromise = null;
const NATIVE_PUSH_TOKEN_KEY = 'lms_native_push_token';
const ANDROID_NOTIFICATION_CHANNELS = [
  {
    id: 'default',
    name: 'Learning updates',
    description: 'General xyndrome learning notifications.',
    importance: 3,
    visibility: 0,
    vibration: true,
    lights: false,
  },
  {
    id: 'exam_reminders',
    name: 'Exam reminders',
    description: 'Timed exam reminders, deadlines, and active assessment alerts.',
    importance: 4,
    visibility: 0,
    vibration: true,
    lights: true,
    lightColor: '#2563EB',
  },
  {
    id: 'course_updates',
    name: 'Course updates',
    description: 'Lessons, course content, announcements, and study plan updates.',
    importance: 3,
    visibility: 0,
    vibration: true,
    lights: false,
  },
  {
    id: 'account_alerts',
    name: 'Account alerts',
    description: 'Account, subscription, privacy, and security notifications.',
    importance: 4,
    visibility: 0,
    vibration: true,
    lights: true,
    lightColor: '#0F766E',
  },
];

function isNativePushEnabled() {
  return import.meta.env.VITE_NATIVE_PUSH_ENABLED === 'true';
}

function isNativePushRuntime() {
  return Capacitor.isNativePlatform() && isNativePushEnabled();
}

function rememberNativePushToken(token) {
  const cleanToken = String(token || '').trim();
  if (!cleanToken || typeof window === 'undefined') return '';
  window.localStorage.setItem(NATIVE_PUSH_TOKEN_KEY, cleanToken);
  return cleanToken;
}

function getRememberedNativePushToken() {
  if (typeof window === 'undefined') return '';
  return String(window.localStorage.getItem(NATIVE_PUSH_TOKEN_KEY) || '').trim();
}

async function saveRememberedNativePushToken(token = getRememberedNativePushToken()) {
  const cleanToken = rememberNativePushToken(token);
  if (!cleanToken) return { ok: false, token: '' };

  await saveNativePushToken({
    token: cleanToken,
    platform: Capacitor.getPlatform(),
    deliveryMode: 'outside',
  });

  return { ok: true, token: cleanToken };
}

async function ensureAndroidNotificationChannels(PushNotifications) {
  if (!isNativePushRuntime() || Capacitor.getPlatform() !== 'android' || typeof PushNotifications?.createChannel !== 'function') {
    return;
  }

  androidChannelsPromise ??= Promise.all(
    ANDROID_NOTIFICATION_CHANNELS.map((channel) => PushNotifications.createChannel(channel).catch(() => null))
  );
  await androidChannelsPromise;
}

export function isPushNotificationSupported() {
  return isNativePushRuntime();
}

export function isIosDevice() {
  return false;
}

export function isStandalonePwa() {
  return false;
}

export function isIosSafariPwaCapable() {
  return false;
}

export function getNotificationPermission() {
  return isNativePushRuntime() ? 'native' : 'unsupported';
}

export async function enablePhonePushNotifications() {
  if (!Capacitor.isNativePlatform()) {
    throw new Error('Native notifications are only available inside the installed app.');
  }
  if (!isNativePushEnabled()) {
    throw new Error('Native push notifications are not configured for this app build.');
  }

  await installNativePushNotificationHandlers();

  const { PushNotifications } = await import('@capacitor/push-notifications');
  await ensureAndroidNotificationChannels(PushNotifications);
  const permission = await PushNotifications.requestPermissions();
  if (permission.receive !== 'granted') {
    throw new Error('Notification permission was not granted for this device.');
  }

  const token = await new Promise((resolve, reject) => {
    let settled = false;
    let registrationHandle;
    let errorHandle;

    function finish(callback, value) {
      if (settled) return;
      settled = true;
      Promise.resolve(registrationHandle?.remove?.()).catch(() => {});
      Promise.resolve(errorHandle?.remove?.()).catch(() => {});
      callback(value);
    }

    PushNotifications.addListener('registration', (registration) => {
      finish(resolve, registration.value);
    }).then((handle) => {
      registrationHandle = handle;
    }).catch(reject);

    PushNotifications.addListener('registrationError', (error) => {
      finish(reject, new Error(error?.error || 'Native push registration failed.'));
    }).then((handle) => {
      errorHandle = handle;
    }).catch(reject);

    PushNotifications.register().catch((error) => finish(reject, error));
    window.setTimeout(() => finish(reject, new Error('Native push registration timed out.')), 12000);
  });

  await saveRememberedNativePushToken(token);

  return { ok: true, token };
}

export async function disablePhonePushNotifications() {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(NATIVE_PUSH_TOKEN_KEY);
  }
  await deleteNativePushToken().catch(() => {});
  return { ok: true };
}

export async function requestNativePushPermission() {
  if (!Capacitor.isNativePlatform()) {
    throw new Error('Native notifications are only available inside the installed app.');
  }
  if (!isNativePushEnabled()) {
    return { ok: false, permission: 'unsupported' };
  }

  await installNativePushNotificationHandlers();

  const { PushNotifications } = await import('@capacitor/push-notifications');
  await ensureAndroidNotificationChannels(PushNotifications);
  const permission = await PushNotifications.requestPermissions();
  if (permission.receive !== 'granted') {
    return { ok: false, permission: 'denied' };
  }

  await PushNotifications.register();
  return { ok: true, permission: 'granted' };
}

export async function syncNativePushToken() {
  if (!isNativePushRuntime()) return { ok: false, token: '' };
  return saveRememberedNativePushToken();
}

export async function installNativePushNotificationHandlers() {
  if (!isNativePushRuntime() || nativeHandlersInstalled) return;
  nativeHandlersInstalled = true;

  const { PushNotifications } = await import('@capacitor/push-notifications');
  await ensureAndroidNotificationChannels(PushNotifications);

  await PushNotifications.addListener('registration', (registration) => {
    const token = rememberNativePushToken(registration?.value);
    if (!token) return;
    saveRememberedNativePushToken(token).catch(() => {});
  });

  await PushNotifications.addListener('pushNotificationActionPerformed', (event) => {
    const targetUrl = normalizeNativeNotificationUrl(event?.notification?.data?.url);
    if (!targetUrl) return;
    window.location.href = targetUrl;
  });
}

function normalizeNativeNotificationUrl(url) {
  const value = String(url || '/notifications').trim();
  if (!value.startsWith('/') || value.startsWith('//')) return '/notifications';
  return value;
}
