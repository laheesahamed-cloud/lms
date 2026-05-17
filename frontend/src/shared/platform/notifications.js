import { detectPlatform, isStandalonePwaDisplay } from './detect.js';

function getDeliveryLoader(platform = detectPlatform()) {
  if (platform.isNative) {
    return () => import('./native/NotificationDelivery.js');
  }

  if (platform.isPwa) {
    return () => import('./pwa/NotificationDelivery.js');
  }

  return () => import('./web/NotificationDelivery.js');
}

function isWebPushRuntime(platform = detectPlatform()) {
  return !platform.isNative && !platform.isDesktopApp;
}

export const notificationDelivery = {
  isPushNotificationSupported() {
    const platform = detectPlatform();
    if (platform.isNative) return true;
    return isWebPushRuntime(platform) && typeof window !== 'undefined' && 'Notification' in window;
  },

  isIosDevice() {
    const platform = detectPlatform();
    return isWebPushRuntime(platform) && platform.isIos;
  },

  isStandalonePwa() {
    return isStandalonePwaDisplay();
  },

  isIosSafariPwaCapable() {
    const platform = detectPlatform();
    return isWebPushRuntime(platform) && platform.isIos && !isStandalonePwaDisplay();
  },

  getNotificationPermission() {
    if (!isWebPushRuntime()) return 'native';
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    return Notification.permission;
  },

  async enablePhonePushNotifications(options) {
    const delivery = await getDeliveryLoader()();
    return delivery.enablePhonePushNotifications(options);
  },

  async disablePhonePushNotifications(options) {
    const delivery = await getDeliveryLoader()();
    return delivery.disablePhonePushNotifications(options);
  },
};
