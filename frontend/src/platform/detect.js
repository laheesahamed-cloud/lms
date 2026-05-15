const PHONE_MAX_WIDTH = 767;
const TABLET_MIN_WIDTH = 768;

function getWindow() {
  return typeof window !== 'undefined' ? window : null;
}

function getNavigator() {
  return typeof navigator !== 'undefined' ? navigator : null;
}

function getDocument() {
  return typeof document !== 'undefined' ? document : null;
}

function matchesMedia(query) {
  const win = getWindow();
  return Boolean(win?.matchMedia?.(query)?.matches);
}

function getCapacitorPlatform() {
  const win = getWindow();
  const platform = win?.Capacitor?.getPlatform?.();
  return typeof platform === 'string' ? platform : '';
}

export function isNativeShell() {
  const win = getWindow();
  if (!win) return false;

  return win.location.protocol === 'capacitor:' ||
    win.location.protocol === 'ionic:' ||
    win.Capacitor?.isNativePlatform?.() === true;
}

export function isStandalonePwaDisplay() {
  const win = getWindow();
  if (!win) return false;

  return matchesMedia('(display-mode: standalone)') ||
    matchesMedia('(display-mode: window-controls-overlay)') ||
    win.navigator?.standalone === true;
}

function getOs() {
  const nav = getNavigator();
  const ua = nav?.userAgent || '';
  const platform = nav?.platform || '';
  const capacitorPlatform = getCapacitorPlatform();

  if (capacitorPlatform === 'ios') return 'ios';
  if (capacitorPlatform === 'android') return 'android';
  if (/Android/i.test(ua)) return 'android';
  if (/iPad|iPhone|iPod/i.test(ua)) return 'ios';
  if (platform === 'MacIntel' && (nav?.maxTouchPoints || 0) > 1) return 'ios';
  if (/Win/i.test(platform)) return 'windows';
  if (/Mac/i.test(platform)) return 'macos';
  if (/Linux/i.test(platform)) return 'linux';
  return 'unknown';
}

function getViewport() {
  const win = getWindow();
  const doc = getDocument();
  const width = win?.innerWidth || doc?.documentElement?.clientWidth || 0;
  const height = win?.innerHeight || doc?.documentElement?.clientHeight || 0;
  return { width, height };
}

function getFormFactor(os) {
  const nav = getNavigator();
  const ua = nav?.userAgent || '';
  const { width, height } = getViewport();
  const shortest = Math.min(width || 0, height || 0);
  const longest = Math.max(width || 0, height || 0);
  const coarsePointer = matchesMedia('(hover: none) and (pointer: coarse)');
  const explicitTabletUa = /iPad|Tablet|PlayBook|Silk/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua));
  const iosTablet = os === 'ios' && nav?.platform === 'MacIntel' && (nav?.maxTouchPoints || 0) > 1;

  if (explicitTabletUa || iosTablet || (coarsePointer && shortest >= TABLET_MIN_WIDTH)) {
    return 'tablet';
  }

  if (coarsePointer || shortest <= PHONE_MAX_WIDTH || (longest > 0 && longest <= 932)) {
    return 'phone';
  }

  return 'desktop';
}

function getRuntimeKind(buildTarget) {
  if (isNativeShell()) return 'native';
  if (buildTarget === 'native') return 'native';
  if (buildTarget === 'desktop') return 'desktop';
  if (buildTarget === 'pwa') return 'pwa';
  if (isStandalonePwaDisplay()) return 'pwa';
  return 'web';
}

function getTargetKey({ runtime, os, formFactor }) {
  if (runtime === 'native') {
    if (os === 'ios') return formFactor === 'tablet' ? 'native-ios-tablet' : 'native-ios-phone';
    if (os === 'android') return formFactor === 'tablet' ? 'native-android-tablet' : 'native-android-phone';
    return `native-${formFactor}`;
  }

  if (runtime === 'desktop') {
    if (os === 'windows') return 'desktop-windows';
    if (os === 'macos') return 'desktop-macos';
    return 'desktop';
  }

  if (runtime === 'pwa') {
    if (formFactor === 'tablet') return 'web-pwa-tablet';
    if (formFactor === 'phone') return 'web-pwa-phone';
    return 'web-pwa-desktop';
  }

  if (formFactor === 'tablet') return 'web-tablet';
  if (formFactor === 'phone') return 'web-mobile';
  return 'web-desktop';
}

export function detectPlatform() {
  const buildTarget = import.meta.env.VITE_LMS_BUILD_TARGET || (import.meta.env.MODE === 'capacitor' ? 'native' : 'web');
  const nativeShell = isNativeShell();
  const runtime = getRuntimeKind(buildTarget);
  const os = getOs();
  const formFactor = getFormFactor(os);
  const target = getTargetKey({ runtime, os, formFactor });

  return {
    buildTarget,
    runtime,
    os,
    formFactor,
    target,
    isNativeShell: nativeShell,
    isNative: runtime === 'native',
    isPwa: runtime === 'pwa',
    isWebsite: runtime === 'web',
    isDesktopApp: runtime === 'desktop',
    isPhone: formFactor === 'phone',
    isTablet: formFactor === 'tablet',
    isDesktop: formFactor === 'desktop',
    isIos: os === 'ios',
    isAndroid: os === 'android',
    isWindows: os === 'windows',
    isMac: os === 'macos',
  };
}

export function applyPlatformAttributes(platform = detectPlatform()) {
  const doc = getDocument();
  if (!doc) return platform;

  const root = doc.documentElement;
  root.dataset.lmsRuntime = platform.runtime;
  root.dataset.lmsOs = platform.os;
  root.dataset.lmsFormFactor = platform.formFactor;
  root.dataset.lmsTarget = platform.target;
  root.dataset.lmsPwa = platform.isPwa ? 'true' : 'false';
  return platform;
}

export function installPlatformAttributeSync(onChange) {
  const win = getWindow();
  if (!win) return () => {};

  let frame = 0;
  const sync = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const platform = applyPlatformAttributes();
      onChange?.(platform);
    });
  };

  sync();
  win.addEventListener('resize', sync);
  win.addEventListener('orientationchange', sync);
  win.addEventListener('pageshow', sync);
  win.matchMedia?.('(display-mode: standalone)')?.addEventListener?.('change', sync);
  win.matchMedia?.('(display-mode: window-controls-overlay)')?.addEventListener?.('change', sync);

  return () => {
    cancelAnimationFrame(frame);
    win.removeEventListener('resize', sync);
    win.removeEventListener('orientationchange', sync);
    win.removeEventListener('pageshow', sync);
    win.matchMedia?.('(display-mode: standalone)')?.removeEventListener?.('change', sync);
    win.matchMedia?.('(display-mode: window-controls-overlay)')?.removeEventListener?.('change', sync);
  };
}
