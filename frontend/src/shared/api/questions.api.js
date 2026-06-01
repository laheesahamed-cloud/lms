import { apiClient } from './client.js';

export async function fetchQuestions(params) {
  const requestParams = { ...(params || {}) };
  if (!requestParams.limit) requestParams.limit = 200;
  const response = await apiClient.get('/admin/questions', { params: requestParams });
  return response.data;
}

export async function fetchQuestionsMeta() {
  const response = await apiClient.get('/admin/questions/meta');
  return response.data;
}

export async function fetchQuestion(id) {
  const response = await apiClient.get(`/admin/questions/${id}`);
  return response.data;
}

export async function exportQuestions(params) {
  const response = await apiClient.get('/admin/questions/export/workbook', {
    params,
    responseType: 'blob',
  });
  return response.data;
}

export async function importQuestions(file) {
  const formData = new FormData();
  formData.append('file', file);
  const response = await apiClient.post('/admin/questions/import/workbook', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
}

export async function createQuestion(payload) {
  const response = await apiClient.post('/admin/questions', payload);
  return response.data;
}

export async function bulkUpdateQuestionKeywords(payload) {
  const response = await apiClient.post('/admin/questions/keywords/bulk', payload);
  return response.data;
}

export async function updateQuestion(id, payload) {
  const response = await apiClient.patch(`/admin/questions/${id}`, payload);
  return response.data;
}

export async function deleteQuestion(id) {
  const response = await apiClient.delete(`/admin/questions/${id}`);
  return response.data;
}

export async function bulkDeleteQuestions(questionIds) {
  const response = await apiClient.post('/admin/questions/bulk-delete', { questionIds });
  return response.data;
}
