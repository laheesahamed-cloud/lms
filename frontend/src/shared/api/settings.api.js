import { apiClient } from './client.js';

const PUBLIC_SETTINGS_CACHE_TTL_MS = 15_000;
const PUBLIC_SETTINGS_TIMEOUT_MS = 2000;
const PUBLIC_AVAILABILITY_TIMEOUT_MS = 2500;
let publicSettingsCache = null;
let publicSettingsPromise = null;

export async function fetchAiProviderSettings() {
  const response = await apiClient.get('/admin/settings/ai-providers');
  return response.data;
}

export async function fetchGeneralSettings() {
  const response = await apiClient.get('/admin/settings/general');
  return response.data;
}

export async function fetchLandingPageSettings() {
  const response = await apiClient.get('/admin/settings/landing-page');
  return response.data;
}

export async function fetchAvailabilitySettings() {
  const response = await apiClient.get('/admin/settings/availability');
  return response.data;
}

export async function fetchPaymentSettings() {
  const response = await apiClient.get('/admin/settings/payments');
  return response.data;
}

export async function fetchSmtpSettings() {
  const response = await apiClient.get('/admin/settings/smtp');
  return response.data;
}

export async function fetchPopupAlertSettings() {
  const response = await apiClient.get('/admin/settings/popup-alert');
  return response.data;
}

export async function fetchApnsSettings() {
  const response = await apiClient.get('/admin/settings/apns');
  return response.data;
}

export async function fetchFcmSettings() {
  const response = await apiClient.get('/admin/settings/fcm');
  return response.data;
}

export async function fetchPublicSettings({ force = false } = {}) {
  const now = Date.now();
  if (!force && publicSettingsCache && publicSettingsCache.expiresAt > now) {
    return publicSettingsCache.data;
  }

  if (!force && publicSettingsPromise) {
    return publicSettingsPromise;
  }

  publicSettingsPromise = apiClient
    .get('/settings/public', {
      __suppressServerStatus: true,
      __skipNetworkActivity: true,
      __skipTimeoutRetry: true,
      __skipApiBaseFallback: true,
      timeout: PUBLIC_SETTINGS_TIMEOUT_MS,
    })
    .then((response) => {
      publicSettingsCache = {
        expiresAt: Date.now() + PUBLIC_SETTINGS_CACHE_TTL_MS,
        data: response.data,
      };
      return response.data;
    })
    .finally(() => {
      publicSettingsPromise = null;
    });

  return publicSettingsPromise;
}

export async function fetchPublicAvailabilitySettings() {
  const response = await apiClient.get('/settings/public/availability', {
    __suppressServerStatus: true,
    __skipNetworkActivity: true,
    __skipTimeoutRetry: true,
    __skipApiBaseFallback: true,
    timeout: PUBLIC_AVAILABILITY_TIMEOUT_MS,
  });
  return response.data;
}

export async function verifyAvailabilityUnlockCode(payload) {
  const response = await apiClient.post('/settings/availability/unlock', payload, {
    __suppressServerStatus: true,
    __skipNetworkActivity: true,
  });
  return response.data;
}

export async function createAiProviderConfig(payload) {
  const response = await apiClient.post('/admin/settings/ai-providers', payload);
  return response.data;
}

export async function testAiProviderConfig(payload) {
  const response = await apiClient.post('/admin/settings/ai-providers/test', payload);
  return response.data;
}

export async function updateGeneralSettings(payload) {
  const response = await apiClient.put('/admin/settings/general', payload);
  return response.data;
}

export async function updateLandingPageSettings(payload) {
  const response = await apiClient.put('/admin/settings/landing-page', payload);
  return response.data;
}

export async function updateAvailabilitySettings(payload) {
  const response = await apiClient.put('/admin/settings/availability', payload);
  return response.data;
}

export async function updatePaymentSettings(payload) {
  const response = await apiClient.put('/admin/settings/payments', payload);
  return response.data;
}

export async function updateSmtpSettings(payload) {
  const response = await apiClient.put('/admin/settings/smtp', payload);
  return response.data;
}

export async function sendSmtpTestEmail(payload) {
  const response = await apiClient.post('/admin/settings/smtp/test', payload);
  return response.data;
}

export async function updatePopupAlertSettings(payload) {
  const response = await apiClient.put('/admin/settings/popup-alert', payload);
  return response.data;
}

export async function updateApnsSettings(payload) {
  const response = await apiClient.put('/admin/settings/apns', payload);
  return response.data;
}

export async function updateFcmSettings(payload) {
  const response = await apiClient.put('/admin/settings/fcm', payload);
  return response.data;
}

export async function updateAiProviderConfig(id, payload) {
  const response = await apiClient.put(`/admin/settings/ai-providers/${id}`, payload);
  return response.data;
}

export async function activateAiProviderConfig(id) {
  const response = await apiClient.put(`/admin/settings/ai-providers/${id}/activate`);
  return response.data;
}

export async function deleteAiProviderConfig(id) {
  const response = await apiClient.delete(`/admin/settings/ai-providers/${id}`);
  return response.data;
}
