const DEFAULT_THEME_COLORS = {
  light: '#dce6f4',
  dark: '#060d22',
};

let statusBarModulePromise = null;

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
  syncNativeChromeTheme(theme, color);

  const module = await loadStatusBarModule();
  if (!module?.StatusBar || !color) return;

  const { StatusBar, Style } = module;
  const style = theme === 'dark' ? Style.Dark : Style.Light;

  try {
    await StatusBar.setStyle({ style });
    await StatusBar.setBackgroundColor({ color });
  } catch {
    // OS support varies; CSS safe-area paint remains the visual fallback.
  }
}
