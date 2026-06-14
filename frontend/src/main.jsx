import ReactDOM from 'react-dom/client';
import { App } from './app/App.jsx';
import { applyPlatformAttributes, installPlatformAttributeSync } from './shared/platform/detect.js';
import { shouldRegisterServiceWorker } from './shared/platform/config.js';
import { requestSpaNavigation } from './shared/routing/spaNavigation.js';
import { applyPerformanceProfile, installMotionResourceGuards } from './shared/utils/performanceProfile.js';
import { installPwaRegistration, uninstallPwaRegistration } from './shared/utils/pwaRegistration.js';
import './shared/styles/index.css';

const NATIVE_RECOVERY_LINK_HOSTS = new Set(['xyndrome.lk', 'www.xyndrome.lk']);
const NATIVE_RECOVERY_ROUTE_PATTERN = /^\/auth\/(?:forgot-password|reset-password)(?:\/|$)/;
const NATIVE_RECOVERY_LINK_SCHEMES = new Set(['xyndrome:']);

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

function getNativeRecoveryRoute(rawUrl) {
  if (typeof window === 'undefined' || !rawUrl) return '';

  try {
    const url = new URL(String(rawUrl), window.location.origin);
    if (NATIVE_RECOVERY_LINK_SCHEMES.has(url.protocol)) {
      const routePath = `${url.hostname ? `/${url.hostname}` : ''}${url.pathname || ''}` || '/';
      const normalizedRoutePath = routePath === '/reset-password'
        ? '/auth/reset-password'
        : routePath === '/forgot-password'
          ? '/auth/forgot-password'
          : routePath;
      if (!NATIVE_RECOVERY_ROUTE_PATTERN.test(normalizedRoutePath)) return '';
      return `${normalizedRoutePath}${url.search}${url.hash}`;
    }

    const currentHost = window.location.hostname.toLowerCase();
    const linkHost = url.hostname.toLowerCase();
    const trustedHost = linkHost === currentHost || NATIVE_RECOVERY_LINK_HOSTS.has(linkHost);
    if (!trustedHost) return '';

    const pathname = (url.pathname || '/').replace(/^\/lms(?:\/frontend\/dist)?(?=\/|$)/, '') || '/';
    if (!NATIVE_RECOVERY_ROUTE_PATTERN.test(pathname)) return '';

    return `${pathname}${url.search}${url.hash}`;
  } catch {
    return '';
  }
}

function routeNativeRecoveryLink(rawUrl, options = {}) {
  const route = getNativeRecoveryRoute(rawUrl);
  if (!route) return false;
  return requestSpaNavigation(route, { replace: Boolean(options.replace) });
}

async function installNativeRecoveryLinkHandler() {
  try {
    const { App: CapacitorApp } = await import('@capacitor/app');
    const launchUrl = await CapacitorApp.getLaunchUrl?.().catch(() => null);
    routeNativeRecoveryLink(launchUrl?.url, { replace: true });
    await CapacitorApp.addListener?.('appUrlOpen', (event) => {
      routeNativeRecoveryLink(event?.url);
    });
  } catch {
    // The native route is optional; normal app boot should continue if Capacitor is unavailable.
  }
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
  installNativeRecoveryLinkHandler();

  // Native-only stylesheet bundle (Round-2 Task 16): every rule is scoped to
  // html[data-lms-runtime="native"], so the web build never ships it. Inside
  // the Capacitor shell this resolves from local files immediately.
  import('./shared/styles/native-platforms.css').catch(() => {});
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
