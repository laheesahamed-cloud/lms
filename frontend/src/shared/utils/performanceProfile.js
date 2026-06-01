import { resolveApiBaseUrl } from '../platform/config.js';

let motionResourceGuardCleanup = null;
let performanceMonitoringCleanup = null;

const PERFORMANCE_TARGETS = {
  firstRouteReady: 2000,
  routeReady: 1500,
  lcp: 2500,
  inp: 200,
  cls: 0.1,
};
const ENABLE_CLIENT_PERFORMANCE_BEACONS = import.meta.env.VITE_ENABLE_CLIENT_PERFORMANCE_BEACONS === 'true';

export function isLowSpecDevice() {
  if (typeof navigator === 'undefined') return false;
  const memory = Number(navigator.deviceMemory || 0);
  const cores = Number(navigator.hardwareConcurrency || 0);
  const saveData = Boolean(navigator.connection?.saveData);
  return saveData || (memory > 0 && memory <= 4) || (cores > 0 && cores <= 4);
}

export function getBrowserPerformanceProfile() {
  if (typeof navigator === 'undefined') {
    return {
      isSafari: false,
      isChromium: false,
      isIOS: false,
      isMac: false,
      saveData: false,
      constrainedHardware: false,
      paintSensitive: false,
    };
  }

  const ua = navigator.userAgent || '';
  const vendor = navigator.vendor || '';
  const platform = navigator.platform || '';
  const memory = Number(navigator.deviceMemory || 0);
  const cores = Number(navigator.hardwareConcurrency || 0);
  const saveData = Boolean(navigator.connection?.saveData);
  const isIOS = /iPad|iPhone|iPod/i.test(ua) || (platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isMac = /Mac/i.test(platform);
  const isChromium = /(?:Chrome|CriOS|Chromium|Edg|OPR)\//i.test(ua);
  const isFirefox = /Firefox|FxiOS/i.test(ua);
  const isSafari = !isChromium && !isFirefox && /Safari/i.test(ua) && /Apple/i.test(vendor);
  const constrainedHardware = saveData || (memory > 0 && memory <= 8) || (cores > 0 && cores <= 8);
  const paintSensitive = isSafari || isIOS || (isChromium && (isMac || constrainedHardware));

  return {
    isSafari,
    isChromium,
    isIOS,
    isMac,
    saveData,
    constrainedHardware,
    paintSensitive,
  };
}

export function shouldUseBalancedVisualEffects() {
  if (isLowSpecDevice()) return true;
  return getBrowserPerformanceProfile().paintSensitive;
}

export function applyPerformanceProfile() {
  if (typeof document === 'undefined') return false;
  const root = document.documentElement;
  const runtime = root.dataset.lmsRuntime || 'web';
  const nativeRuntime = runtime === 'native';
  const installedRuntime = nativeRuntime || runtime === 'pwa';
  const lowSpec = isLowSpecDevice();
  const balancedEffects = nativeRuntime || (!installedRuntime && shouldUseBalancedVisualEffects());
  const browserProfile = getBrowserPerformanceProfile();
  root.toggleAttribute('data-low-spec', lowSpec);
  root.dataset.visualEffects = balancedEffects ? 'balanced' : 'full';
  root.dataset.browserEngine = browserProfile.isSafari || browserProfile.isIOS
    ? 'webkit'
    : browserProfile.isChromium
      ? 'chromium'
      : 'other';
  return lowSpec;
}

export function installMotionResourceGuards() {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return () => {};
  }

  if (motionResourceGuardCleanup) return motionResourceGuardCleanup;

  const isPageHidden = () => document.hidden || document.visibilityState === 'hidden';

  const setMotionPauseState = (shouldPause) => {
    document.documentElement.toggleAttribute('data-motion-paused', shouldPause);
    document.body?.classList.toggle('lms-motion-paused', shouldPause);
  };

  const syncMotionPauseState = () => {
    setMotionPauseState(isPageHidden());
  };

  const pauseMotion = () => {
    setMotionPauseState(true);
  };

  const resumeMotion = () => {
    if (!isPageHidden()) {
      setMotionPauseState(false);
    }

    window.requestAnimationFrame(() => {
      if (!isPageHidden()) {
        setMotionPauseState(false);
      }
    });

    window.setTimeout(() => {
      if (!isPageHidden()) {
        setMotionPauseState(false);
      }
    }, 120);
  };

  document.addEventListener('visibilitychange', syncMotionPauseState, { passive: true });
  document.addEventListener('resume', resumeMotion, { passive: true });
  document.addEventListener('freeze', pauseMotion, { passive: true });
  window.addEventListener('pagehide', pauseMotion, { passive: true });
  window.addEventListener('pageshow', resumeMotion, { passive: true });
  window.addEventListener('focus', resumeMotion, { passive: true });
  syncMotionPauseState();

  motionResourceGuardCleanup = () => {
    document.removeEventListener('visibilitychange', syncMotionPauseState);
    document.removeEventListener('resume', resumeMotion);
    document.removeEventListener('freeze', pauseMotion);
    window.removeEventListener('pagehide', pauseMotion);
    window.removeEventListener('pageshow', resumeMotion);
    window.removeEventListener('focus', resumeMotion);
    document.documentElement.removeAttribute('data-motion-paused');
    document.body?.classList.remove('lms-motion-paused');
    motionResourceGuardCleanup = null;
  };

  return motionResourceGuardCleanup;
}

function sendClientPerformanceMetric(metric) {
  if (typeof window === 'undefined' || !ENABLE_CLIENT_PERFORMANCE_BEACONS) return;
  const payload = JSON.stringify({
    ...metric,
    timestamp: new Date().toISOString(),
  });
  const url = `${resolveApiBaseUrl()}/health/client-performance`;

  try {
    if (navigator.sendBeacon?.(url, new Blob([payload], { type: 'application/json' }))) {
      return;
    }
  } catch {
    // Beacon delivery is best-effort.
  }

  try {
    fetch(url, {
      method: 'POST',
      body: payload,
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Ignore unsupported keepalive/fetch environments.
  }
}

function recordClientPerformanceMetric(metric) {
  if (typeof window === 'undefined') return;
  const record = {
    route: window.location?.pathname || '',
    ...metric,
  };

  window.__lmsClientPerformance = Array.isArray(window.__lmsClientPerformance)
    ? window.__lmsClientPerformance
    : [];
  window.__lmsClientPerformance.push(record);
  if (window.__lmsClientPerformance.length > 120) {
    window.__lmsClientPerformance.splice(0, window.__lmsClientPerformance.length - 120);
  }

  sendClientPerformanceMetric(record);
}

export function installPerformanceMonitoring() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return () => {};
  }

  if (document.documentElement.dataset.lmsRuntime === 'native') {
    return () => {};
  }

  if (performanceMonitoringCleanup) return performanceMonitoringCleanup;

  let firstRouteRecorded = false;
  let cumulativeLayoutShift = 0;
  const observers = [];

  const handleRouteReady = (event) => {
    const value = Math.round(performance.now());
    const route = `${event?.detail?.pathname || window.location.pathname || ''}${event?.detail?.search || ''}`;
    recordClientPerformanceMetric({
      metric: firstRouteRecorded ? 'routeReady' : 'firstRouteReady',
      route,
      value,
      target: firstRouteRecorded ? PERFORMANCE_TARGETS.routeReady : PERFORMANCE_TARGETS.firstRouteReady,
    });
    firstRouteRecorded = true;
  };

  document.addEventListener('lms:route-ready', handleRouteReady);

  if ('PerformanceObserver' in window) {
    try {
      const lcpObserver = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        const latest = entries[entries.length - 1];
        if (!latest) return;
        recordClientPerformanceMetric({
          metric: 'lcp',
          value: Math.round(latest.startTime),
          target: PERFORMANCE_TARGETS.lcp,
        });
      });
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
      observers.push(lcpObserver);
    } catch {
      // LCP observer is unavailable in older WebViews.
    }

    try {
      const clsObserver = new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          if (!entry.hadRecentInput) cumulativeLayoutShift += Number(entry.value || 0);
        }
        recordClientPerformanceMetric({
          metric: 'cls',
          value: Number(cumulativeLayoutShift.toFixed(3)),
          target: PERFORMANCE_TARGETS.cls,
        });
      });
      clsObserver.observe({ type: 'layout-shift', buffered: true });
      observers.push(clsObserver);
    } catch {
      // CLS observer is unavailable in older WebViews.
    }

    try {
      const inpObserver = new PerformanceObserver((entryList) => {
        const slowest = entryList.getEntries().reduce((max, entry) => Math.max(max, Number(entry.duration || 0)), 0);
        if (!slowest) return;
        recordClientPerformanceMetric({
          metric: 'inp',
          value: Math.round(slowest),
          target: PERFORMANCE_TARGETS.inp,
        });
      });
      inpObserver.observe({ type: 'event', buffered: true, durationThreshold: 40 });
      observers.push(inpObserver);
    } catch {
      // INP/event timing is not universally supported.
    }
  }

  performanceMonitoringCleanup = () => {
    document.removeEventListener('lms:route-ready', handleRouteReady);
    observers.forEach((observer) => observer.disconnect());
    performanceMonitoringCleanup = null;
  };

  return performanceMonitoringCleanup;
}

export function shouldPreloadRoutes() {
  if (typeof document !== 'undefined' && document.documentElement.dataset.lmsRuntime === 'native') {
    return false;
  }
  return !getBrowserPerformanceProfile().saveData;
}

export function getRoutePreloadLimit() {
  if (!shouldPreloadRoutes()) return 0;
  if (isLowSpecDevice()) return 1;
  return shouldUseBalancedVisualEffects() ? 2 : 4;
}
