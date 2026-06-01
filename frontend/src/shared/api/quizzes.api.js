import { apiClient } from './client.js';

export async function fetchQuizzes(params) {
  const requestParams = { ...(params || {}) };
  if (!requestParams.limit) requestParams.limit = 100;
  const response = await apiClient.get('/admin/quizzes', { params: requestParams });
  return response.data;
}

export async function fetchQuizzesMeta(options = {}) {
  const response = await apiClient.get('/admin/quizzes/meta', {
    params: options.includeQuestions ? { includeQuestions: '1' } : {},
  });
  return response.data;
}

export async function fetchQuiz(id) {
  const response = await apiClient.get(`/admin/quizzes/${id}`);
  return response.data;
}

export async function createQuiz(payload) {
  const response = await apiClient.post('/admin/quizzes', payload);
  return response.data;
}

export async function updateQuiz(id, payload) {
  const response = await apiClient.patch(`/admin/quizzes/${id}`, payload);
  return response.data;
}

export async function deleteQuiz(id) {
  const response = await apiClient.delete(`/admin/quizzes/${id}`);
  return response.data;
}
