import { apiClient } from './client.js';
import { detectPlatform } from '../platform/detect.js';

const NATIVE_AUTH_TIMEOUT_MS = 7000;
const WEB_AUTH_TIMEOUT_MS = 8000;

function nativeAuthHeaders() {
  return detectPlatform().isNative ? { 'X-LMS-Native': '1' } : undefined;
}

function nativeAuthParams() {
  return detectPlatform().isNative ? { native: '1' } : undefined;
}

export async function login(payload) {
  const native = detectPlatform().isNative;
  const response = await apiClient.post('/auth/login', payload, {
    headers: nativeAuthHeaders(),
    params: nativeAuthParams(),
    timeout: native ? NATIVE_AUTH_TIMEOUT_MS : WEB_AUTH_TIMEOUT_MS,
    __skipApiBaseFallback: native,
    __skipTimeoutRetry: true,
  });
  return response.data;
}

export async function register(payload) {
  const native = detectPlatform().isNative;
  const response = await apiClient.post('/auth/register', payload, {
    headers: nativeAuthHeaders(),
    params: nativeAuthParams(),
    timeout: native ? NATIVE_AUTH_TIMEOUT_MS : WEB_AUTH_TIMEOUT_MS,
    __skipApiBaseFallback: native,
    __skipTimeoutRetry: true,
  });
  return response.data;
}

export async function loginWithGoogle(payload) {
  const native = detectPlatform().isNative;
  const response = await apiClient.post('/auth/google', payload, {
    headers: nativeAuthHeaders(),
    params: nativeAuthParams(),
    timeout: native ? NATIVE_AUTH_TIMEOUT_MS : WEB_AUTH_TIMEOUT_MS,
    __skipApiBaseFallback: native,
    __skipTimeoutRetry: true,
  });
  return response.data;
}

export async function loginWithGoogleCode(payload) {
  const native = detectPlatform().isNative;
  const response = await apiClient.post('/auth/google/code', payload, {
    headers: {
      ...(nativeAuthHeaders() || {}),
      'X-Requested-With': 'XmlHttpRequest',
    },
    params: nativeAuthParams(),
    timeout: native ? NATIVE_AUTH_TIMEOUT_MS : WEB_AUTH_TIMEOUT_MS,
    __skipApiBaseFallback: native,
    __skipTimeoutRetry: true,
  });
  return response.data;
}

export async function fetchCurrentUser(options = {}) {
  const response = await apiClient.get('/auth/me', {
    __skipNetworkActivity: Boolean(options.silent),
    __suppressServerStatus: Boolean(options.silent),
    __suppressUnauthorizedSessionNotice: Boolean(options.silent),
    __skipTimeoutRetry: Boolean(options.silent),
    __skipApiBaseFallback: Boolean(options.silent),
    timeout: options.timeout ?? 5000,
  });
  return response.data;
}

export async function logout() {
  const response = await apiClient.post('/auth/logout');
  return response.data;
}

export async function requestPasswordReset(payload) {
  const response = await apiClient.post('/auth/forgot-password', payload);
  return response.data;
}

export async function resetPassword(payload) {
  const response = await apiClient.post('/auth/reset-password', payload);
  return response.data;
}

export async function updateProfile(payload) {
  const response = await apiClient.patch('/auth/profile', payload);
  return response.data;
}

export async function changePassword(payload) {
  const response = await apiClient.patch('/auth/password', payload);
  return response.data;
}
