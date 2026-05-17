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
  const nativeRuntime = root.dataset.lmsRuntime === 'native';
  const lowSpec = isLowSpecDevice();
  const balancedEffects = nativeRuntime ? false : shouldUseBalancedVisualEffects();
  const browserProfile = getBrowserPerformanceProfile();
  root.toggleAttribute('data-low-spec', !nativeRuntime && lowSpec);
  root.dataset.visualEffects = balancedEffects ? 'balanced' : 'full';
  root.dataset.browserEngine = browserProfile.isSafari || browserProfile.isIOS
    ? 'webkit'
    : browserProfile.isChromium
      ? 'chromium'
      : 'other';
  return lowSpec;
}

export function shouldPreloadRoutes() {
  return !isLowSpecDevice() && !getBrowserPerformanceProfile().saveData;
}

export function getRoutePreloadLimit() {
  if (!shouldPreloadRoutes()) return 0;
  return shouldUseBalancedVisualEffects() ? 2 : 4;
}
