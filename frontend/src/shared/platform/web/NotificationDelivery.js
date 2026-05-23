export function isPushNotificationSupported() {
  return false;
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
  return 'unsupported';
}

export async function enablePhonePushNotifications() {
  throw new Error('Web push is disabled. Notifications are available inside the app or through the native mobile app.');
}

export async function disablePhonePushNotifications() {
  return { ok: true };
}
