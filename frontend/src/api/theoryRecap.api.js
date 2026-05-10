import { apiClient } from './client.js';

export async function fetchTheoryRecap(questionId) {
  const response = await apiClient.get(`/theory-recap/question/${questionId}`);
  return response.data;
}

export async function generateTheoryRecap(questionId) {
  const response = await apiClient.post(`/theory-recap/question/${questionId}/generate`);
  return response.data;
}

export async function regenerateTheoryRecap(questionId) {
  const response = await apiClient.post(`/theory-recap/question/${questionId}/regenerate`);
  return response.data;
}

export async function upsertTheoryRecap(questionId, data) {
  const response = await apiClient.put(`/theory-recap/question/${questionId}`, data);
  return response.data;
}

export async function deleteTheoryRecap(questionId) {
  const response = await apiClient.delete(`/theory-recap/question/${questionId}`);
  return response.data;
}
