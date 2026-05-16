import { apiClient } from './client.js';

const AI_RECAP_TIMEOUT_MS = 210000;

export async function fetchTheoryRecap(questionId) {
  const response = await apiClient.get(`/admin/theory-recap/question/${questionId}`);
  return response.data;
}

export async function generateTheoryRecap(questionId) {
  const response = await apiClient.post(`/admin/theory-recap/question/${questionId}/generate`, null, {
    timeout: AI_RECAP_TIMEOUT_MS,
  });
  return response.data;
}

export async function regenerateTheoryRecap(questionId) {
  const response = await apiClient.post(`/admin/theory-recap/question/${questionId}/regenerate`, null, {
    timeout: AI_RECAP_TIMEOUT_MS,
  });
  return response.data;
}

export async function upsertTheoryRecap(questionId, data) {
  const response = await apiClient.put(`/admin/theory-recap/question/${questionId}`, data);
  return response.data;
}

export async function deleteTheoryRecap(questionId) {
  const response = await apiClient.delete(`/admin/theory-recap/question/${questionId}`);
  return response.data;
}
