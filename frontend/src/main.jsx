import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './app/App.jsx';
import { applyPlatformAttributes, installPlatformAttributeSync } from './shared/platform/detect.js';
import { shouldRegisterServiceWorker } from './shared/platform/config.js';
import { applyPerformanceProfile } from './shared/utils/performanceProfile.js';
import { installPwaRegistration, uninstallPwaRegistration } from './shared/utils/pwaRegistration.js';
import { installNativeErrorOverlay } from './shared/utils/nativeErrorOverlay.js';
import './shared/styles/index.css';

installNativeErrorOverlay();

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
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
);
