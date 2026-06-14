// Boot script (theme/platform detection, splash gate, auth preload).
// Externalized from index.html (R3 Task 27): hash-based CSP misbehaves in
// Chrome on ServiceWorker-served navigations, and script-src 'self' makes
// the policy independent of this file's content.
(function () {
  var theme = 'light';
  var accentTheme = 'codeforge';
  try {
    var requestedTheme = new URLSearchParams(window.location.search).get('theme');
    var savedTheme = window.localStorage.getItem('lms_theme_mode');
    var savedAccent = window.localStorage.getItem('lms_accent_theme');
    if (requestedTheme === 'light' || requestedTheme === 'dark') theme = requestedTheme;
    else if (savedTheme === 'light' || savedTheme === 'dark') theme = savedTheme;
    if (savedAccent === 'erpm' || savedAccent === 'codeforge') accentTheme = savedAccent;
  } catch (error) {}
  var root = document.documentElement;
  var isNativeShell = window.location.protocol === 'capacitor:' || window.location.protocol === 'ionic:' || window.Capacitor?.isNativePlatform?.() === true;
  // Dark-first native app: on first launch (nothing saved) default to dark
  // so the boot screen isn't the light #dce6f4 (the "white screen on first
  // open" bug). The user can still explicitly choose light.
  if (isNativeShell && theme === 'light' && savedTheme !== 'light' && requestedTheme !== 'light') {
    theme = 'dark';
  }
  var isStandalonePwa = false;
  try {
    isStandalonePwa = window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator?.standalone === true;
  } catch (error) {}

  function positiveNumber(value) {
    var number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : 0;
  }

  function smallestPositive(values) {
    var candidates = values.map(positiveNumber).filter(Boolean);
    return candidates.length ? Math.round(Math.min.apply(Math, candidates)) : 0;
  }

  function detectOs() {
    var ua = window.navigator?.userAgent || '';
    var platform = window.navigator?.platform || '';
    if (window.Capacitor?.getPlatform?.() === 'ios' || /iPad|iPhone|iPod/i.test(ua)) return 'ios';
    if (window.Capacitor?.getPlatform?.() === 'android' || /Android/i.test(ua)) return 'android';
    if (platform === 'MacIntel' && (window.navigator?.maxTouchPoints || 0) > 1) return 'ios';
    if (/Win/i.test(platform)) return 'windows';
    if (/Mac/i.test(platform)) return 'macos';
    if (/Linux/i.test(platform)) return 'linux';
    return 'unknown';
  }

  function detectFormFactor(runtime, os) {
    var width = smallestPositive([window.visualViewport?.width, window.innerWidth, document.documentElement.clientWidth]);
    var height = smallestPositive([window.visualViewport?.height, window.innerHeight, document.documentElement.clientHeight]);
    var shortest = Math.min(width || 0, height || 0);
    var longest = Math.max(width || 0, height || 0);
    var screenShortest = smallestPositive([window.screen?.width, window.screen?.height]);
    var ua = window.navigator?.userAgent || '';
    var coarse = false;
    try {
      coarse = window.matchMedia?.('(hover: none) and (pointer: coarse)')?.matches === true;
    } catch (error) {}
    var explicitTablet = /iPad|Tablet|PlayBook|Silk/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua));
    var iosTablet = os === 'ios' && window.navigator?.platform === 'MacIntel' && (window.navigator?.maxTouchPoints || 0) > 1;

    if (shortest <= 767 || (screenShortest > 0 && screenShortest <= 767)) return 'phone';
    if (runtime === 'native' && longest > 0 && longest <= 932) return 'phone';
    if (explicitTablet || iosTablet || (coarse && shortest >= 768 && (screenShortest === 0 || screenShortest >= 768))) return 'tablet';
    if (coarse || (longest > 0 && longest <= 932)) return 'phone';
    return 'desktop';
  }

  var runtime = isNativeShell ? 'native' : isStandalonePwa ? 'pwa' : 'web';
  var os = detectOs();
  var formFactor = detectFormFactor(runtime, os);
  var target = runtime + '-' + formFactor;
  if (runtime === 'native' && (os === 'ios' || os === 'android')) target = 'native-' + os + '-' + formFactor;
  else if (runtime === 'web' && formFactor === 'phone') target = 'web-mobile';
  else if (runtime === 'web') target = 'web-' + formFactor;

  root.dataset.theme = theme;
  root.dataset.accentTheme = accentTheme;
  root.dataset.lmsRuntime = runtime;
  root.dataset.lmsOs = os;
  root.dataset.lmsFormFactor = formFactor;
  root.dataset.lmsTarget = target;
  root.dataset.lmsPwa = isStandalonePwa ? 'true' : 'false';
  if (isNativeShell) {
    var viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
      viewport.setAttribute('content', 'width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1, user-scalable=no');
    }
  }
  root.style.colorScheme = theme;
  root.style.backgroundColor = isNativeShell ? (theme === 'dark' ? '#02030a' : '#dce6f4') : '#05070d';

  // App-shell prerender + API preload (M6/M7): only on signed-in app
  // surfaces. The splash carries NO user data (the shell is cached and
  // shared, see report sec 13.4); the preload merely warms the same
  // /auth/me request the app fires first, with matching credentials.
  var appPath = /^\/lms\/(?:app|admin|dashboard|login)(?:\/|$)/.test(window.location.pathname);
  // The native shell boots from the scheme root ("/"), so the /lms/ web-path
  // test never matches there. Without the splash gate the cold first launch
  // (slow WKWebView JS compile, nothing cached) shows a bare dark screen until
  // React mounts — the "blank screen on first open" bug. Always gate it on
  // native so the branded splash covers that gap on every route.
  if (appPath || isNativeShell) {
    root.dataset.lmsBootSplash = 'on';
  }
  if (appPath && window.location.pathname !== '/lms/login') {
    try {
      var apiHost = window.location.hostname;
      var apiBase = (apiHost === 'localhost' || apiHost === '127.0.0.1' || /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(apiHost))
        ? window.location.protocol + '//' + apiHost + ':3000/api'
        : '/api';
      var preload = document.createElement('link');
      preload.rel = 'preload';
      preload.as = 'fetch';
      preload.href = apiBase + '/auth/me';
      preload.crossOrigin = 'use-credentials';
      document.head.appendChild(preload);
    } catch (error) {}
  }
})();
