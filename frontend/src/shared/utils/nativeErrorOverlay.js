function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function redactSensitiveValue(value) {
  return String(value || '')
    .replace(/([?&](?:token|session|password|secret|api[_-]?key|authorization)=)[^&#\s]+/gi, '$1[redacted]')
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [redacted]');
}

function isNativeRuntime() {
  if (typeof window === 'undefined') return false;
  return window.location?.protocol === 'capacitor:' ||
    window.location?.protocol === 'ionic:' ||
    window.Capacitor?.isNativePlatform?.() === true ||
    import.meta.env.VITE_LMS_BUILD_TARGET === 'native' ||
    import.meta.env.MODE === 'capacitor';
}

function shouldShowOverlay() {
  return isNativeRuntime();
}

function showOverlay(title, body) {
  if (!shouldShowOverlay() || typeof document === 'undefined') return;

  const content = redactSensitiveValue(`${title}:\n${body}`);
  const existing = document.getElementById('lms-native-error-overlay');
  const overlay = existing || document.createElement('pre');
  overlay.id = 'lms-native-error-overlay';
  overlay.setAttribute('role', 'alert');
  overlay.style.cssText = [
    'white-space:pre-wrap',
    'margin:0',
    'padding:calc(env(safe-area-inset-top,0px) + 16px) 16px calc(env(safe-area-inset-bottom,0px) + 16px)',
    'color:#fecaca',
    'background:#05070d',
    'z-index:2147483647',
    'position:fixed',
    'inset:0',
    'overflow:auto',
    'font:13px/1.45 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace',
    '-webkit-overflow-scrolling:touch',
  ].join(';');
  overlay.innerHTML = escapeHtml(content);

  if (!existing) {
    document.body.appendChild(overlay);
  }
}

export function installNativeErrorOverlay() {
  if (typeof window === 'undefined' || window.__lmsNativeErrorOverlayInstalled) return;
  window.__lmsNativeErrorOverlayInstalled = true;

  window.onerror = function (message, source, lineno, colno, error) {
    showOverlay('JS ERROR', `${message}\n\n${source}:${lineno}:${colno}\n\n${error?.stack || ''}`);
  };

  window.onunhandledrejection = function (event) {
    showOverlay('PROMISE ERROR', event.reason?.stack || event.reason);
  };

  const originalConsoleError = console.error.bind(console);
  console.error = (...args) => {
    originalConsoleError(...args);
  };
}
