import ReactDOM from 'react-dom/client';
import { App } from './app/App.jsx';
import { applyPlatformAttributes, installPlatformAttributeSync } from './shared/platform/detect.js';
import { shouldRegisterServiceWorker } from './shared/platform/config.js';
import { applyPerformanceProfile, installMotionResourceGuards } from './shared/utils/performanceProfile.js';
import { installPwaRegistration, uninstallPwaRegistration } from './shared/utils/pwaRegistration.js';
import './shared/styles/index.css';

function isPwaMode() {
  return document.documentElement.dataset.lmsPwa === 'true';
}

function isEditableTarget(target) {
  return Boolean(target?.closest?.('input, textarea, select, [contenteditable="true"]'));
}

function installPwaTouchGuards() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  document.addEventListener('contextmenu', (event) => {
    if (!isPwaMode() || isEditableTarget(event.target)) return;
    if (event.target?.closest?.('a, button, [role="button"]')) {
      event.preventDefault();
    }
  }, { capture: true });
}

const initialPlatform = applyPlatformAttributes();
if (typeof window !== 'undefined') {
  installMotionResourceGuards();
  installPwaTouchGuards();
  installPlatformAttributeSync(() => applyPerformanceProfile());
}

// Start user/session hydration while the boot loader is still covering the app.
applyPerformanceProfile();
if (shouldRegisterServiceWorker(initialPlatform)) {
  installPwaRegistration();
} else {
  uninstallPwaRegistration();
}

if (initialPlatform.isNative) {
  import('./shared/platform/native/NotificationDelivery.js')
    .then((module) => module.installNativePushNotificationHandlers?.())
    .catch(() => {});

  // Native-only: register the local-notification tap handler that deep-links into the SPA.
  import('./shared/platform/native/LocalNotifications.js')
    .then((module) => module.installLocalNotificationHandlers?.())
    .catch(() => {});
}

// DB-announcement -> local notification bridge and study reminders run on web + native.
// (The poller no-ops unless notification permission is granted, so it's safe everywhere.)
import('./shared/notifications/announcementLocalSync.js')
  .then((module) => module.startAnnouncementLocalSync?.())
  .catch(() => {});

import('./shared/notifications/studyReminders.js')
  .then((module) => module.reconcileStudyReminders?.())
  .catch(() => {});

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
);
