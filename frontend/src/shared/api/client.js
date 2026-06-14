import axios from 'axios';
import { clearStoredAuth, getAuthToken } from '../stores/authToken.js';
import { beginNetworkActivity, endNetworkActivity } from '../stores/networkActivityStore.js';
import { clearServerNotResponding, markServerNotResponding } from '../stores/serverStatusStore.js';
import { detectPlatform } from '../platform/detect.js';
import { getLoginPath, resolveApiBaseUrl, resolveApiBaseUrls } from '../platform/config.js';
import { requestSpaNavigation } from '../routing/spaNavigation.js';
import { getCurrentForwardPath } from '../utils/routeForwarding.js';

const LOCAL_API_BASE_URL = 'http://localhost:3000/api';
const DEFAULT_REQUEST_TIMEOUT_MS = detectPlatform().isNative ? 10000 : 30000;
const API_RECOVERY_STORAGE_KEY = 'lms_api_recovery_settings';
let unauthorizedHandler = null;

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = typeof handler === 'function' ? handler : null;
}

function isPrivateLanHost(hostname) {
  return /^(10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)$/i.test(hostname);
}

export const API_BASE_URL = resolveApiBaseUrl();
export const API_BASE_URLS = resolveApiBaseUrls();

function clampNumber(value, fallback, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, numeric));
}

function getStoredApiRecoverySettings() {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    return JSON.parse(window.localStorage.getItem(API_RECOVERY_STORAGE_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

function getEnvNumber(name, fallback) {
  return import.meta.env[name] === undefined ? fallback : Number(import.meta.env[name]);
}

export function getApiRecoverySettings() {
  const stored = getStoredApiRecoverySettings();
  const timeoutMs = clampNumber(
    stored.timeoutMs ?? getEnvNumber('VITE_API_REQUEST_TIMEOUT_MS', DEFAULT_REQUEST_TIMEOUT_MS),
    DEFAULT_REQUEST_TIMEOUT_MS,
    1000,
    120000
  );
  const timeoutRetryCount = clampNumber(
    stored.timeoutRetryCount ?? getEnvNumber('VITE_API_TIMEOUT_RETRY_COUNT', 2),
    2,
    0,
    5
  );
  const retryDelayMs = clampNumber(
    stored.retryDelayMs ?? getEnvNumber('VITE_API_TIMEOUT_RETRY_DELAY_MS', 500),
    500,
    0,
    10000
  );
  const retryWriteRequests =
    stored.retryWriteRequests === undefined
      ? import.meta.env.VITE_API_TIMEOUT_RETRY_WRITES !== 'false'
      : Boolean(stored.retryWriteRequests);

  return {
    timeoutMs,
    timeoutRetryCount,
    retryDelayMs,
    retryWriteRequests,
  };
}

export function saveApiRecoverySettings(settings) {
  if (typeof window === 'undefined') {
    return getApiRecoverySettings();
  }

  const normalized = {
    timeoutMs: clampNumber(settings?.timeoutMs, DEFAULT_REQUEST_TIMEOUT_MS, 1000, 120000),
    timeoutRetryCount: clampNumber(settings?.timeoutRetryCount, 2, 0, 5),
    retryDelayMs: clampNumber(settings?.retryDelayMs, 500, 0, 10000),
    retryWriteRequests: Boolean(settings?.retryWriteRequests),
  };
  window.localStorage.setItem(API_RECOVERY_STORAGE_KEY, JSON.stringify(normalized));
  apiClient.defaults.timeout = normalized.timeoutMs;
  return normalized;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeApiPath(url) {
  return String(url || '')
    .split('?')[0]
    .replace(/^https?:\/\/[^/]+\/api/i, '')
    .replace(/\/\d+(?=\/|$)/g, '/:id');
}

function redactSensitiveValue(value) {
  const text = String(value || '');
  if (!text) return text;

  return text
    .replace(
      /([?&](?:access_?token|api_?key|authorization|code|password|refresh_?token|reset_?token|secret|session_?token|token)=)[^&#\s]+/gi,
      '$1[redacted]'
    )
    .replace(/\b(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi, '$1[redacted]')
    .replace(
      /\b(access_?token|api_?key|authorization|password|refresh_?token|reset_?token|secret|session_?token|token)\b\s*[:=]\s*['"]?[^'",\s&}]+/gi,
      '$1=[redacted]'
    );
}

function shouldClearServerStatusAfterSuccess(response) {
  const path = normalizeApiPath(response?.config?.url || '');
  return path !== '/health' && path !== '/health/client-performance';
}

function canRetryTimeoutRequest(config, settings) {
  if (config?.__skipTimeoutRetry) {
    return false;
  }

  const method = String(config?.method || 'get').toLowerCase();
  return settings.retryWriteRequests || ['get', 'head', 'options'].includes(method);
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: getApiRecoverySettings().timeoutMs,
});

function finalizeNetworkActivity(config) {
  if (!config || config.__networkActivityFinalized || !config.__networkActivityStarted) {
    return;
  }

  config.__networkActivityFinalized = true;
  endNetworkActivity();
}

apiClient.interceptors.request.use((config) => {
  if (config.timeout === DEFAULT_REQUEST_TIMEOUT_MS || config.timeout === apiClient.defaults.timeout) {
    config.timeout = getApiRecoverySettings().timeoutMs;
  }

  if (!config.__skipNetworkActivity) {
    beginNetworkActivity();
    config.__networkActivityStarted = true;
    config.__networkActivityFinalized = false;
  }

  const token = getAuthToken();

  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

function redirectToLoginIfNeeded() {
  if (typeof window === 'undefined') {
    return;
  }

  const publicPath = getNormalizedPublicPathname(window.location.pathname || '');
  if (
    publicPath === '/' ||
    publicPath === '/login' ||
    publicPath === '/register' ||
    publicPath === '/terms' ||
    publicPath === '/privacy-policy' ||
    publicPath.startsWith('/launch-preview/') ||
    publicPath === '/auth/login' ||
    publicPath === '/auth/register' ||
    publicPath === '/auth/forgot-password' ||
    publicPath === '/auth/reset-password'
  ) {
    return;
  }

  const from = getCurrentForwardPath();
  const forwardQuery = from ? `?from=${encodeURIComponent(from)}` : '';
  const loginPath = getLoginPath(detectPlatform());
  requestSpaNavigation(`${loginPath}${forwardQuery}`, { replace: true });
}

function getNormalizedPublicPathname(pathname) {
  return String(pathname || '/')
    .replace(/^\/lms(?:\/frontend\/dist)?(?=\/|$)/, '')
    .replace(/\/+$/, '') || '/';
}

function isApiFreePreviewRoute() {
  if (typeof window === 'undefined') return false;
  const path = getNormalizedPublicPathname(window.location.pathname || '');
  return /^\/lms\/(?:ai\/|auth\/|login|register|terms|privacy-policy|refund-policy|cookie-policy|$)/i.test(path) ||
    /^\/lms\/launch-preview\//i.test(path) ||
    /^\/(?:ai\/|auth\/|login|register|terms|privacy-policy|refund-policy|cookie-policy|$)/i.test(path) ||
    /^\/launch-preview\//i.test(path);
}

function responseHasDatabaseUnavailableSignal(response) {
  const data = response?.data;
  return data?.code === 'DATABASE_UNAVAILABLE' ||
    data?.checks?.database?.ok === false ||
    data?.service === 'lms-api' && data?.checks?.database?.ok === false;
}

function isUnavailableProxyStatus(status) {
  return status === 502 || status === 504;
}

function getNextApiFallbackUrl(currentBaseUrl, triedBaseUrls = []) {
  const tried = new Set([currentBaseUrl, ...triedBaseUrls].map((url) => String(url || '')));
  return API_BASE_URLS.find((url) => !tried.has(url)) || '';
}

function formatApiBaseUrlList() {
  return API_BASE_URLS.map((url) => redactSensitiveValue(url)).join(', ');
}

apiClient.interceptors.response.use(
  (response) => {
    const responseBaseUrl = String(response?.config?.baseURL || '');
    if (responseBaseUrl && API_BASE_URLS.includes(responseBaseUrl) && apiClient.defaults.baseURL !== responseBaseUrl) {
      apiClient.defaults.baseURL = responseBaseUrl;
    }
    finalizeNetworkActivity(response?.config);
    if (shouldClearServerStatusAfterSuccess(response)) {
      clearServerNotResponding();
    }
    return response;
  },
  async (error) => {
    const requestConfig = error?.config;
    const currentBaseUrl = String(requestConfig?.baseURL || API_BASE_URL);
    const currentHost =
      typeof window !== 'undefined' && window.location ? window.location.hostname : '';
    const allowLocalhostRetry =
      !detectPlatform().isNative &&
      (currentHost === 'localhost' || currentHost === '127.0.0.1' || isPrivateLanHost(currentHost));
    const shouldRetryAgainstLocalhost =
      allowLocalhostRetry &&
      (error?.code === 'ERR_NETWORK' || error?.message === 'Network Error') &&
      requestConfig &&
      !requestConfig.__retriedWithLocalhost &&
      currentBaseUrl !== LOCAL_API_BASE_URL;
    const canUseApiBaseFallback =
      error?.code === 'ECONNABORTED' ||
      error?.code === 'ERR_NETWORK' ||
      error?.message === 'Network Error' ||
      !error?.response;
    const nextApiFallbackUrl =
      canUseApiBaseFallback &&
      requestConfig &&
      !requestConfig.__skipApiBaseFallback &&
      getNextApiFallbackUrl(currentBaseUrl, requestConfig.__triedApiBaseUrls);

    finalizeNetworkActivity(requestConfig);

    if (error?.code === 'ECONNABORTED' && requestConfig) {
      const recoverySettings = getApiRecoverySettings();
      const timeoutRetryCount = Number(requestConfig.__timeoutRetryCount || 0);

      if (
        timeoutRetryCount < recoverySettings.timeoutRetryCount &&
        canRetryTimeoutRequest(requestConfig, recoverySettings)
      ) {
        if (recoverySettings.retryDelayMs > 0) {
          await wait(recoverySettings.retryDelayMs);
        }

        return apiClient.request({
          ...requestConfig,
          timeout: Math.min(Number(requestConfig.timeout || recoverySettings.timeoutMs) * 2, 120000),
          __timeoutRetryCount: timeoutRetryCount + 1,
          __networkActivityFinalized: false,
        });
      }
    }

    if (nextApiFallbackUrl) {
      return apiClient.request({
        ...requestConfig,
        baseURL: nextApiFallbackUrl,
        __triedApiBaseUrls: [
          ...(requestConfig.__triedApiBaseUrls || []),
          currentBaseUrl,
        ],
        __networkActivityFinalized: false,
      });
    }

    if (shouldRetryAgainstLocalhost) {
      return apiClient.request({
        ...requestConfig,
        baseURL: LOCAL_API_BASE_URL,
        __retriedWithLocalhost: true,
        __networkActivityFinalized: false,
      });
    }

    const status = error?.response?.status;
    const isDatabaseUnavailable = responseHasDatabaseUnavailableSignal(error?.response);
    const isLikelyServerNotResponding =
      !requestConfig?.__suppressServerStatus &&
      typeof navigator !== 'undefined' &&
      navigator.onLine &&
      (
        error?.code === 'ECONNABORTED' ||
        error?.code === 'ERR_NETWORK' ||
        error?.message === 'Network Error' ||
        !error?.response ||
        isDatabaseUnavailable ||
        isUnavailableProxyStatus(status)
      );

    if (isLikelyServerNotResponding) {
      markServerNotResponding();
    }

    const serverMessage = error?.response?.data?.message;
    const normalizedMessage = Array.isArray(serverMessage)
      ? redactSensitiveValue(serverMessage.join(' '))
      : redactSensitiveValue(serverMessage || '');
    const requestUrl = redactSensitiveValue(error?.config?.url || '');
    const isAuthPageRequest =
      requestUrl.includes('/auth/login') ||
      requestUrl.includes('/auth/register') ||
      requestUrl.includes('/auth/forgot-password') ||
      requestUrl.includes('/auth/reset-password');
    const isRoleScopeMismatch =
      status === 401 &&
      /(?:admin|student) access is required/i.test(normalizedMessage);

    if (status === 401 && !isAuthPageRequest && !isRoleScopeMismatch) {
      clearStoredAuth();
      const handledUnauthorized = !requestConfig?.__suppressUnauthorizedSessionNotice && unauthorizedHandler?.() === true;
      if (!handledUnauthorized) {
        redirectToLoginIfNeeded();
      }
    }

    return Promise.reject(error);
  }
);

export function getErrorMessage(error, fallback = 'Something went wrong') {
  const serverMessage = error?.response?.data?.message;
  const platform = detectPlatform();
  const apiBaseUrl = redactSensitiveValue(API_BASE_URL);
  const nativeApiMessage = () => {
    if (platform.isIos) {
      return `Cannot reach the LMS API at ${apiBaseUrl}. Check your internet connection, then reopen the app.`;
    }
    if (platform.isAndroid) {
      return `Cannot reach the LMS API at ${apiBaseUrl}. On Android, use your computer or server LAN address for local testing, not localhost, then rebuild the app.`;
    }
    return `Cannot reach the LMS API at ${apiBaseUrl}. Check your internet connection, then reopen the app.`;
  };

  if (Array.isArray(serverMessage)) {
    return redactSensitiveValue(serverMessage.join(', '));
  }

  if (typeof serverMessage === 'string' && serverMessage.trim() !== '') {
    return redactSensitiveValue(serverMessage);
  }

  if (error?.code === 'ECONNABORTED') {
    if (platform.isNative) {
      return nativeApiMessage();
    }

    return `The LMS API at ${apiBaseUrl} is taking too long to respond after automatic recovery.`;
  }

  if (error?.code === 'ERR_CANCELED' || error?.name === 'AbortError') {
    return platform.isNative
      ? nativeApiMessage()
      : `The LMS API at ${API_BASE_URL} did not finish the request. Check that the API server is reachable.`;
  }

  if (error?.code === 'ERR_NETWORK' || error?.message === 'Network Error') {
    if (isApiFreePreviewRoute()) {
      return fallback;
    }
    if (platform.isNative) {
      return nativeApiMessage();
    }

    return `Cannot reach the LMS API. Tried: ${formatApiBaseUrlList()}. Make sure the API server is running on port 3000.`;
  }

  return redactSensitiveValue(error?.message || fallback);
}
