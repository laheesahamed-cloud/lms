import { apiClient } from './client.js';
import { detectPlatform } from '../platform/detect.js';

function nativeAuthHeaders() {
  return detectPlatform().isNative ? { 'X-LMS-Native': '1' } : undefined;
}

function nativeAuthParams() {
  return detectPlatform().isNative ? { native: '1' } : undefined;
}

export async function login(payload) {
  const response = await apiClient.post('/auth/login', payload, {
    headers: nativeAuthHeaders(),
    params: nativeAuthParams(),
  });
  return response.data;
}

export async function register(payload) {
  const response = await apiClient.post('/auth/register', payload, {
    headers: nativeAuthHeaders(),
    params: nativeAuthParams(),
  });
  return response.data;
}

export async function fetchCurrentUser(options = {}) {
  const response = await apiClient.get('/auth/me', {
    __skipNetworkActivity: Boolean(options.silent),
    __suppressServerStatus: Boolean(options.silent),
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
