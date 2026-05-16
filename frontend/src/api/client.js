import axios from 'axios';
import { clearStoredAuth, getAuthToken } from '../stores/authToken.js';
import { beginNetworkActivity, endNetworkActivity } from '../stores/networkActivityStore.js';
import { clearServerNotResponding, markServerNotResponding } from '../stores/serverStatusStore.js';
import { detectPlatform } from '../platform/detect.js';
import { getLoginPath, resolveApiBaseUrl, resolveApiBaseUrls } from '../platform/config.js';
import { getCurrentForwardPath } from '../utils/routeForwarding.js';

const LOCAL_API_BASE_URL = 'http://localhost:3000/api';
const REQUEST_TIMEOUT_MS = detectPlatform().isNative ? 3500 : 15000;
let unauthorizedHandler = null;

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = typeof handler === 'function' ? handler : null;
}

function isPrivateLanHost(hostname) {
  return /^(10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)$/i.test(hostname);
}

export const API_BASE_URL = resolveApiBaseUrl();
export const API_BASE_URLS = resolveApiBaseUrls();

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: REQUEST_TIMEOUT_MS,
});

function finalizeNetworkActivity(config) {
  if (!config || config.__networkActivityFinalized || !config.__networkActivityStarted) {
    return;
  }

  config.__networkActivityFinalized = true;
  endNetworkActivity();
}

apiClient.interceptors.request.use((config) => {
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

  const path = window.location.pathname || '';
  const publicPath = path.replace(/^\/lms(?:\/frontend\/dist)?(?=\/|$)/, '') || '/';
  if (
    publicPath === '/' ||
    publicPath === '/login' ||
    publicPath === '/register' ||
    publicPath === '/terms' ||
    publicPath === '/privacy-policy' ||
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
  window.location.href = `${loginPath}${forwardQuery}`;
}

function getNextApiFallbackUrl(currentBaseUrl, triedBaseUrls = []) {
  const tried = new Set([currentBaseUrl, ...triedBaseUrls].map((url) => String(url || '')));
  return API_BASE_URLS.find((url) => !tried.has(url)) || '';
}

apiClient.interceptors.response.use(
  (response) => {
    const responseBaseUrl = String(response?.config?.baseURL || '');
    if (responseBaseUrl && API_BASE_URLS.includes(responseBaseUrl) && apiClient.defaults.baseURL !== responseBaseUrl) {
      apiClient.defaults.baseURL = responseBaseUrl;
    }
    finalizeNetworkActivity(response?.config);
    clearServerNotResponding();
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
    const nextApiFallbackUrl =
      (error?.code === 'ERR_NETWORK' || error?.message === 'Network Error' || !error?.response) &&
      requestConfig &&
      getNextApiFallbackUrl(currentBaseUrl, requestConfig.__triedApiBaseUrls);

    finalizeNetworkActivity(requestConfig);

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

    const isLikelyServerNotResponding =
      !requestConfig?.__suppressServerStatus &&
      typeof navigator !== 'undefined' &&
      navigator.onLine &&
      (
        error?.code === 'ECONNABORTED' ||
        error?.code === 'ERR_NETWORK' ||
        error?.message === 'Network Error' ||
        !error?.response
      );

    if (isLikelyServerNotResponding) {
      markServerNotResponding();
    }

    const status = error?.response?.status;
    const serverMessage = error?.response?.data?.message;
    const normalizedMessage = Array.isArray(serverMessage)
      ? serverMessage.join(' ')
      : String(serverMessage || '');
    const requestUrl = String(error?.config?.url || '');
    const isAuthPageRequest =
      requestUrl.includes('/auth/login') ||
      requestUrl.includes('/auth/register') ||
      requestUrl.includes('/auth/forgot-password') ||
      requestUrl.includes('/auth/reset-password');
    const isRoleScopeMismatch =
      status === 401 &&
      /(?:admin|student) access is required/i.test(normalizedMessage);

    if (status === 401 && !isAuthPageRequest && !isRoleScopeMismatch) {
      console.log('AUTH_CHECK_RESULT', {
        stage: 'api_unauthorized',
        url: requestUrl,
        status,
        message: normalizedMessage,
        hasToken: Boolean(getAuthToken()),
      });
      clearStoredAuth();
      unauthorizedHandler?.();
      redirectToLoginIfNeeded();
    }

    return Promise.reject(error);
  }
);

export function getErrorMessage(error, fallback = 'Something went wrong') {
  const serverMessage = error?.response?.data?.message;

  if (Array.isArray(serverMessage)) {
    return serverMessage.join(', ');
  }

  if (typeof serverMessage === 'string' && serverMessage.trim() !== '') {
    return serverMessage;
  }

  if (error?.code === 'ECONNABORTED') {
    return `The LMS API at ${API_BASE_URL} is taking too long to respond.`;
  }

  if (error?.code === 'ERR_NETWORK' || error?.message === 'Network Error') {
    return `Cannot reach the LMS API at ${API_BASE_URL}. If you opened the site with a LAN IP, make sure port 3000 is reachable or use localhost on this machine.`;
  }

  return error?.message || fallback;
}
