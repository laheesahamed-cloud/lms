import { detectPlatform, isStandalonePwaDisplay } from './detect.js';

function getDeliveryLoader(platform = detectPlatform()) {
  if (platform.isNative) {
    return () => import('./native/NotificationDelivery.js');
  }

  return () => import('./web/NotificationDelivery.js');
}

export const notificationDelivery = {
  isPushNotificationSupported() {
    return detectPlatform().isNative;
  },

  isIosDevice() {
    return detectPlatform().isNative && detectPlatform().isIos;
  },

  isStandalonePwa() {
    return isStandalonePwaDisplay();
  },

  isIosSafariPwaCapable() {
    return false;
  },

  getNotificationPermission() {
    return detectPlatform().isNative ? 'native' : 'unsupported';
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
