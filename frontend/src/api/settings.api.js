import { apiClient } from './client.js';

export async function fetchAiProviderSettings() {
  const response = await apiClient.get('/settings/ai-providers');
  return response.data;
}

export async function fetchGeneralSettings() {
  const response = await apiClient.get('/settings/general');
  return response.data;
}

export async function fetchPaymentSettings() {
  const response = await apiClient.get('/settings/payments');
  return response.data;
}

export async function fetchSmtpSettings() {
  const response = await apiClient.get('/settings/smtp');
  return response.data;
}

export async function createAiProviderConfig(payload) {
  const response = await apiClient.post('/settings/ai-providers', payload);
  return response.data;
}

export async function testAiProviderConfig(payload) {
  const response = await apiClient.post('/settings/ai-providers/test', payload);
  return response.data;
}

export async function updateGeneralSettings(payload) {
  const response = await apiClient.put('/settings/general', payload);
  return response.data;
}

export async function updatePaymentSettings(payload) {
  const response = await apiClient.put('/settings/payments', payload);
  return response.data;
}

export async function updateSmtpSettings(payload) {
  const response = await apiClient.put('/settings/smtp', payload);
  return response.data;
}

export async function updateAiProviderConfig(id, payload) {
  const response = await apiClient.put(`/settings/ai-providers/${id}`, payload);
  return response.data;
}

export async function activateAiProviderConfig(id) {
  const response = await apiClient.put(`/settings/ai-providers/${id}/activate`);
  return response.data;
}

export async function deleteAiProviderConfig(id) {
  const response = await apiClient.delete(`/settings/ai-providers/${id}`);
  return response.data;
}
