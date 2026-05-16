import { apiClient } from './client.js';

export async function fetchAiProviderSettings() {
  const response = await apiClient.get('/admin/settings/ai-providers');
  return response.data;
}

export async function fetchGeneralSettings() {
  const response = await apiClient.get('/admin/settings/general');
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

export async function fetchPublicSettings() {
  const response = await apiClient.get('/settings/public', { __suppressServerStatus: true });
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

export async function updatePaymentSettings(payload) {
  const response = await apiClient.put('/admin/settings/payments', payload);
  return response.data;
}

export async function updateSmtpSettings(payload) {
  const response = await apiClient.put('/admin/settings/smtp', payload);
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
