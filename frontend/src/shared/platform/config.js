import { detectPlatform } from './detect.js';

const APP_BASENAME = '/lms';
const LEGACY_BUILD_BASENAME = '/lms/frontend/dist';
const LOCAL_API_BASE_URL = 'http://localhost:3000/api';
const LOOPBACK_API_BASE_URL = 'http://127.0.0.1:3000/api';
const NATIVE_DEFAULT_API_BASE_URL = LOCAL_API_BASE_URL;
const SAME_ORIGIN_API_BASE_URL = '/api';

function splitCsv(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function splitUrlList(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeApiBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function isPrivateLanHost(hostname) {
  return /^(10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)$/i.test(hostname);
}

function getLocation() {
  return typeof window !== 'undefined' ? window.location : null;
}

export function getRouterBasename(platform = detectPlatform()) {
  const location = getLocation();
  if (!location) return APP_BASENAME;
  if (platform.isNative || platform.isDesktopApp) return '/';

  const configured = import.meta.env.VITE_ROUTER_BASENAME;
  if (configured) return configured;

  const { pathname } = location;
  return import.meta.env.DEV && (pathname === LEGACY_BUILD_BASENAME || pathname.startsWith(`${LEGACY_BUILD_BASENAME}/`))
    ? LEGACY_BUILD_BASENAME
    : APP_BASENAME;
}

export function withRouterBasename(path, platform = detectPlatform()) {
  const basename = getRouterBasename(platform);
  return basename === '/' ? path : `${basename}${path}`;
}

export function normalizeLegacyBuildPath(platform = detectPlatform()) {
  const location = getLocation();
  if (!location || platform.isNative || platform.isDesktopApp) return;

  const { pathname, search, hash } = location;
  if (hash.startsWith('#/')) {
    window.history.replaceState(null, '', `${withRouterBasename(hash.slice(1), platform)}${search}`);
  } else if (!import.meta.env.DEV && (pathname === LEGACY_BUILD_BASENAME || pathname.startsWith(`${LEGACY_BUILD_BASENAME}/`))) {
    const cleanPath = pathname.slice(LEGACY_BUILD_BASENAME.length) || '/';
    window.history.replaceState(null, '', `${APP_BASENAME}${cleanPath}${search}${hash}`);
  }
}

export function isAppOnlyHost() {
  const hostname = getLocation()?.hostname?.toLowerCase() || '';
  if (!hostname) return false;

  const explicitHosts = splitCsv(import.meta.env.VITE_APP_ONLY_HOSTS);
  if (explicitHosts.includes(hostname)) return true;

  const pattern = import.meta.env.VITE_APP_ONLY_HOST_PATTERN || '^(app|app-lms)\\.';
  try {
    return new RegExp(pattern, 'i').test(hostname);
  } catch {
    return /^(app|app-lms)\./i.test(hostname);
  }
}

export function shouldBlockDirectAppHost(platform = detectPlatform()) {
  return isAppOnlyHost() && !platform.isNativeShell;
}

export function shouldRegisterServiceWorker(platform = detectPlatform()) {
  if (platform.isNative || platform.isDesktopApp) return false;
  return import.meta.env.VITE_ENABLE_PWA !== 'false';
}

export function shouldMountPwaExperiences(platform = detectPlatform()) {
  return !platform.isNative && !platform.isDesktopApp;
}

export function shouldShowPwaInstallPrompt(platform = detectPlatform()) {
  if (platform.isNative || platform.isDesktopApp) return false;
  return import.meta.env.VITE_ENABLE_PWA !== 'false';
}

export function shouldUseNativeRepaintFix(platform = detectPlatform()) {
  return platform.isNative && platform.isIos;
}

export function shouldUseOverlayNavigation(platform = detectPlatform()) {
  if (typeof window === 'undefined') return false;

  if (window.innerWidth <= 900) return true;
  return Boolean(platform.isPhone && (platform.isPwa || platform.isNative));
}

export function resolveApiBaseUrl() {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }

  const platform = detectPlatform();
  if (platform.isNative) {
    return NATIVE_DEFAULT_API_BASE_URL;
  }

  const location = getLocation();
  if (location) {
    const protocol = location.protocol || 'http:';
    const hostname = location.hostname || 'localhost';
    if (hostname === 'localhost') return LOCAL_API_BASE_URL;
    if (hostname === '127.0.0.1') return LOOPBACK_API_BASE_URL;
    if (isPrivateLanHost(hostname)) return `${protocol}//${hostname}:3000/api`;
    return SAME_ORIGIN_API_BASE_URL;
  }

  return LOCAL_API_BASE_URL;
}

export function resolveApiBaseUrls() {
  const configuredUrls = splitUrlList(import.meta.env.VITE_API_BASE_URLS).map(normalizeApiBaseUrl);
  const primaryUrl = normalizeApiBaseUrl(resolveApiBaseUrl());
  const platform = detectPlatform();
  const fallbackUrls = [];

  if (!platform.isNative) {
    const location = getLocation();
    const protocol = location?.protocol || 'http:';
    const hostname = location?.hostname || '';
    const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1';

    if (isPrivateLanHost(hostname)) {
      fallbackUrls.push(normalizeApiBaseUrl(`${protocol}//${hostname}:3000/api`));
    }

    if (import.meta.env.DEV || isLocalHost || isPrivateLanHost(hostname)) {
      fallbackUrls.push(LOOPBACK_API_BASE_URL, LOCAL_API_BASE_URL);
    }
  }

  return Array.from(new Set([primaryUrl, ...configuredUrls, ...fallbackUrls].filter(Boolean)));
}

export function getLoginPath(platform = detectPlatform()) {
  return platform.isNative || platform.isDesktopApp ? '/auth/login' : '/lms/auth/login';
}

export function getPlatformConfig(platform = detectPlatform()) {
  return {
    platform,
    apiBaseUrl: resolveApiBaseUrl(),
    routerBasename: getRouterBasename(platform),
    appOnlyHost: isAppOnlyHost(),
    blockDirectAppHost: shouldBlockDirectAppHost(platform),
    registerServiceWorker: shouldRegisterServiceWorker(platform),
    mountPwaExperiences: shouldMountPwaExperiences(platform),
    showPwaInstallPrompt: shouldShowPwaInstallPrompt(platform),
    useNativeRepaintFix: shouldUseNativeRepaintFix(platform),
    useOverlayNavigation: shouldUseOverlayNavigation(platform),
  };
}
