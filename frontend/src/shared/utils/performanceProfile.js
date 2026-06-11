let motionResourceGuardCleanup = null;

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

  // User-idle pause (M5): decorative loops stop after IDLE_PAUSE_MS without
  // input and resume on the next interaction. Only animation-play-state is
  // affected (see performance.css) so the resuming interaction never glitches.
  const IDLE_PAUSE_MS = 12000;
  const IDLE_RESET_THROTTLE_MS = 1000;
  let idleTimer = 0;
  let lastIdleReset = 0;
  const setIdlePaused = (paused) => {
    document.documentElement.toggleAttribute('data-idle-paused', paused);
  };
  const scheduleIdlePause = () => {
    window.clearTimeout(idleTimer);
    idleTimer = window.setTimeout(() => setIdlePaused(true), IDLE_PAUSE_MS);
  };
  const onUserActivity = () => {
    const now = Date.now();
    if (now - lastIdleReset < IDLE_RESET_THROTTLE_MS) return;
    lastIdleReset = now;
    setIdlePaused(false);
    scheduleIdlePause();
  };
  const IDLE_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll'];
  for (const evt of IDLE_EVENTS) {
    window.addEventListener(evt, onUserActivity, { passive: true, capture: true });
  }
  scheduleIdlePause();

  motionResourceGuardCleanup = () => {
    document.removeEventListener('visibilitychange', syncMotionPauseState);
    document.removeEventListener('resume', resumeMotion);
    document.removeEventListener('freeze', pauseMotion);
    window.removeEventListener('pagehide', pauseMotion);
    window.removeEventListener('pageshow', resumeMotion);
    window.removeEventListener('focus', resumeMotion);
    for (const evt of IDLE_EVENTS) {
      window.removeEventListener(evt, onUserActivity, { capture: true });
    }
    window.clearTimeout(idleTimer);
    document.documentElement.removeAttribute('data-motion-paused');
    document.documentElement.removeAttribute('data-idle-paused');
    document.body?.classList.remove('lms-motion-paused');
    motionResourceGuardCleanup = null;
  };

  return motionResourceGuardCleanup;
}

export function shouldPreloadRoutes() {
  return !getBrowserPerformanceProfile().saveData;
}

export function getRoutePreloadLimit() {
  if (!shouldPreloadRoutes()) return 0;
  const root = typeof document !== 'undefined' ? document.documentElement : null;
  const isPhone = root?.dataset.lmsFormFactor === 'phone';
  if (isLowSpecDevice()) return isPhone ? 1 : 2;
  return isPhone ? 2 : 3;
}
