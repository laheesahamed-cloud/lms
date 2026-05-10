import { apiClient } from './client.js';

export async function fetchQuestions(params) {
  const response = await apiClient.get('/questions', { params });
  return response.data;
}

export async function fetchQuestionsMeta() {
  const response = await apiClient.get('/questions/meta');
  return response.data;
}

export async function fetchQuestion(id) {
  const response = await apiClient.get(`/questions/${id}`);
  return response.data;
}

export async function exportQuestions(params) {
  const response = await apiClient.get('/questions/export/workbook', {
    params,
    responseType: 'blob',
  });
  return response.data;
}

export async function importQuestions(file) {
  const formData = new FormData();
  formData.append('file', file);
  const response = await apiClient.post('/questions/import/workbook', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
}

export async function createQuestion(payload) {
  const response = await apiClient.post('/questions', payload);
  return response.data;
}

export async function bulkUpdateQuestionKeywords(payload) {
  const response = await apiClient.post('/questions/keywords/bulk', payload);
  return response.data;
}

export async function updateQuestion(id, payload) {
  const response = await apiClient.patch(`/questions/${id}`, payload);
  return response.data;
}

export async function deleteQuestion(id) {
  const response = await apiClient.delete(`/questions/${id}`);
  return response.data;
}

export async function bulkDeleteQuestions(questionIds) {
  const response = await apiClient.post('/questions/bulk-delete', { questionIds });
  return response.data;
}
