import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

export { ImpactStyle, NotificationType };

const HAPTIC_TIMEOUT_MS = 90;

function getNativeHapticBridge() {
  return typeof window !== 'undefined'
    ? window.webkit?.messageHandlers?.lmsHaptics
    : null;
}

function postNativeHaptic(payload) {
  const handler = getNativeHapticBridge();
  if (!handler?.postMessage) return false;

  try {
    handler.postMessage(payload);
    return true;
  } catch {
    return false;
  }
}

function normalizeImpactStyle(style) {
  return String(style || ImpactStyle.Light).toLowerCase();
}

function fallbackVibrate(pattern = 10) {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(pattern);
  }
}

export function webVibrate(pattern = 10) {
  fallbackVibrate(pattern);
}

function runHaptic(effect, fallbackPattern = 10) {
  return new Promise((resolve) => {
    let settled = false;
    let timeoutId = 0;

    const finish = (useFallback = false) => {
      if (settled) return;
      settled = true;
      globalThis.clearTimeout(timeoutId);
      if (useFallback) {
        fallbackVibrate(fallbackPattern);
      }
      resolve();
    };

    timeoutId = globalThis.setTimeout(() => finish(true), HAPTIC_TIMEOUT_MS);

    try {
      Promise.resolve(effect())
        .then(() => finish(false))
        .catch(() => finish(true));
    } catch {
      finish(true);
    }
  });
}

export async function nativeImpact(style = ImpactStyle.Light) {
  if (postNativeHaptic({ type: 'impact', style: normalizeImpactStyle(style) })) {
    return;
  }

  await runHaptic(() => Haptics.impact({ style }), style === ImpactStyle.Heavy ? 22 : 10);
}

export async function nativeTransientHaptic({ intensity = 0.45, sharpness = 0.75 } = {}) {
  if (postNativeHaptic({ type: 'transient', intensity, sharpness })) {
    return;
  }

  await nativeImpact(intensity > 0.5 ? ImpactStyle.Medium : ImpactStyle.Light);
}

export async function nativeSelection() {
  if (postNativeHaptic({ type: 'selection' })) {
    return;
  }

  await runHaptic(() => Haptics.selectionChanged(), 8);
}

export async function nativeSuccess() {
  if (postNativeHaptic({ type: 'notification', notificationType: 'success' })) {
    return;
  }

  await runHaptic(() => Haptics.notification({ type: NotificationType.Success }), [12, 35, 18]);
}
