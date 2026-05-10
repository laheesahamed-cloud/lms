import axios from 'axios';
import { clearStoredAuth, getAuthToken, useAuthStore } from '../stores/authStore.js';
import { beginNetworkActivity, endNetworkActivity } from '../stores/networkActivityStore.js';
import { clearServerNotResponding, markServerNotResponding } from '../stores/serverStatusStore.js';

const LOCAL_API_BASE_URL = 'http://localhost:3000/api';
const APP_BASENAME = import.meta.env.VITE_APP_BASENAME || '';

function toAppPath(path) {
  if (!APP_BASENAME || APP_BASENAME === '/') {
    return path;
  }

  return `${APP_BASENAME}${path}`.replace(/\/{2,}/g, '/');
}

function isPrivateLanHost(hostname) {
  return /^(10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)$/i.test(hostname);
}

function resolveApiBaseUrl() {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }

  if (typeof window !== 'undefined' && window.location) {
    const protocol = window.location.protocol || 'http:';
    const hostname = window.location.hostname || 'localhost';
    if (hostname === 'localhost') {
      return LOCAL_API_BASE_URL;
    }

    if (hostname === '127.0.0.1') {
      return 'http://127.0.0.1:3000/api';
    }

    if (isPrivateLanHost(hostname)) {
      return `${protocol}//${hostname}:3000/api`;
    }

    return `${protocol}//${hostname}:3000/api`;
  }

  return LOCAL_API_BASE_URL;
}

export const API_BASE_URL = resolveApiBaseUrl();

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: 15000,
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
  if (
    path.endsWith('/login') ||
    path.endsWith('/register') ||
    path.endsWith('/auth/login') ||
    path.endsWith('/auth/register') ||
    path.endsWith('/auth/forgot-password') ||
    path.endsWith('/auth/reset-password')
  ) {
    return;
  }

  window.location.href = toAppPath('/auth/login');
}

apiClient.interceptors.response.use(
  (response) => {
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
      currentHost === 'localhost' || currentHost === '127.0.0.1' || isPrivateLanHost(currentHost);
    const shouldRetryAgainstLocalhost =
      allowLocalhostRetry &&
      (error?.code === 'ERR_NETWORK' || error?.message === 'Network Error') &&
      requestConfig &&
      !requestConfig.__retriedWithLocalhost &&
      currentBaseUrl !== LOCAL_API_BASE_URL;

    finalizeNetworkActivity(requestConfig);

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
    const requestUrl = String(error?.config?.url || '');
    const isAuthPageRequest =
      requestUrl.includes('/auth/login') ||
      requestUrl.includes('/auth/register') ||
      requestUrl.includes('/auth/forgot-password') ||
      requestUrl.includes('/auth/reset-password');

    if (status === 401 && !isAuthPageRequest) {
      clearStoredAuth();
      useAuthStore.getState().forceSignOut();
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
