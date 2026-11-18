import { apiClient } from './client.js';

export async function fetchQuizzes(params) {
  const requestParams = { ...(params || {}) };
  if (!requestParams.limit) requestParams.limit = 100;
  const response = await apiClient.get('/admin/quizzes', { params: requestParams });
  return response.data;
}

export async function previewBulkDeleteQuizzes(quizIds) {
  const response = await apiClient.post('/admin/quizzes/bulk-delete/preview', { quizIds });
  return response.data;
}

export async function bulkDeleteQuizzes(quizIds, deleteQuestions) {
  const response = await apiClient.post('/admin/quizzes/bulk-delete', { quizIds, deleteQuestions: Boolean(deleteQuestions) }, { timeout: 120000 });
  return response.data;
}

/** Approve many drafts at once ('active') or move them back to draft ('inactive'). */
export async function bulkSetQuizStatus(quizIds, status) {
  const response = await apiClient.post('/admin/quizzes/bulk-status', { quizIds, status }, { timeout: 120000 });
  return response.data;
}

export async function fetchQuizzesSummary(params) {
  const response = await apiClient.get('/admin/quizzes/summary', { params: params || {} });
  return response.data;
}

// options.scope = 'folders': courses and subjects only (the Assessments list page).
export async function fetchQuizzesMeta(options = {}) {
  const params = {};
  if (options.includeQuestions) params.includeQuestions = '1';
  if (options.scope) params.scope = options.scope;
  const response = await apiClient.get('/admin/quizzes/meta', { params });
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
