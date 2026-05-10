import { apiClient } from './client.js';

export async function fetchQuizzes(params) {
  const response = await apiClient.get('/quizzes', { params });
  return response.data;
}

export async function fetchQuizzesMeta(options = {}) {
  const response = await apiClient.get('/quizzes/meta', {
    params: options.includeQuestions ? { includeQuestions: '1' } : {},
  });
  return response.data;
}

export async function fetchQuiz(id) {
  const response = await apiClient.get(`/quizzes/${id}`);
  return response.data;
}

export async function createQuiz(payload) {
  const response = await apiClient.post('/quizzes', payload);
  return response.data;
}

export async function updateQuiz(id, payload) {
  const response = await apiClient.patch(`/quizzes/${id}`, payload);
  return response.data;
}

export async function deleteQuiz(id) {
  const response = await apiClient.delete(`/quizzes/${id}`);
  return response.data;
}
