const DEFAULT_THEME_COLORS = {
  light: '#dce6f4',
  dark: '#060d22',
};

let statusBarModulePromise = null;
let lastAppliedKey = null;
let resumeInvalidationInstalled = false;

// The OS can reset the status bar when the app returns from the background, so
// the next sync must re-apply even with an unchanged theme/color. Forget the
// memo on resume/visibility so a fresh apply isn't skipped as a no-op.
function installResumeInvalidation() {
  if (resumeInvalidationInstalled || typeof window === 'undefined') return;
  resumeInvalidationInstalled = true;
  const invalidate = () => { lastAppliedKey = null; };
  window.addEventListener('pageshow', invalidate);
  document?.addEventListener?.('resume', invalidate);
  document?.addEventListener?.('visibilitychange', () => {
    if (document.visibilityState === 'visible') invalidate();
  });
}

async function loadStatusBarModule() {
  if (typeof window === 'undefined') return null;

  const capacitor = window.Capacitor;
  const isNative = capacitor?.isNativePlatform?.() === true ||
    window.location?.protocol === 'capacitor:';

  if (!isNative) return null;

  statusBarModulePromise ??= import('@capacitor/status-bar')
    .catch(() => null);

  return statusBarModulePromise;
}

function syncNativeChromeTheme(theme, color) {
  if (typeof window === 'undefined' || !color) return;

  const handler = window.webkit?.messageHandlers?.lmsChromeTheme;
  if (!handler?.postMessage) return;

  try {
    handler.postMessage({ theme, color });
  } catch {
    // Native chrome sync is best-effort; CSS still paints the page shell.
  }
}

export async function applyCapacitorStatusBarTheme(theme, color = DEFAULT_THEME_COLORS[theme]) {
  // Route changes re-run the chrome sync repeatedly, but the status bar only
  // needs the bridge calls when the theme or color actually changes. Skipping
  // no-op reapplications avoids redundant Capacitor/WebKit round-trips per click.
  installResumeInvalidation();
  const appliedKey = `${theme}|${color}`;
  if (appliedKey === lastAppliedKey) return;
  lastAppliedKey = appliedKey;

  syncNativeChromeTheme(theme, color);

  const module = await loadStatusBarModule();
  if (!module?.StatusBar || !color) return;

  const { StatusBar, Style } = module;
  const style = theme === 'dark' ? Style.Dark : Style.Light;

  try {
    await StatusBar.setOverlaysWebView?.({ overlay: true });
    await StatusBar.setStyle({ style });
    await StatusBar.setBackgroundColor({ color });
  } catch {
    // OS support varies; CSS safe-area paint remains the visual fallback. Clear
    // the memo so a later call retries rather than staying stuck on a failure.
    lastAppliedKey = null;
  }
}
