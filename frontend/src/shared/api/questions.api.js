import { apiClient } from './client.js';

export async function fetchQuestions(params) {
  const requestParams = { ...(params || {}) };
  if (!requestParams.limit) requestParams.limit = 200;
  const response = await apiClient.get('/admin/questions', { params: requestParams });
  return response.data;
}

// options.scope = 'folders': courses, subjects and papers only (the list page).
// Without it: the full editor lists.
export async function fetchQuestionsMeta(options = {}) {
  const response = await apiClient.get('/admin/questions/meta', {
    params: options.scope ? { scope: options.scope } : {},
  });
  return response.data;
}

// One subject's topics and lessons, loaded when that subject is picked.
export async function fetchQuestionSubjectLists(topicId) {
  const response = await apiClient.get('/admin/questions/meta/subject', { params: { topicId } });
  return response.data;
}

// Several subjects' topics and lessons in one request.
export async function fetchQuestionSubjectListsMany(topicIds) {
  const response = await apiClient.get('/admin/questions/meta/subject', { params: { topicIds: topicIds.join(',') } });
  return Array.isArray(response.data?.subjects) ? response.data.subjects : [];
}

// Manual repair of the stored "used in N assessments" numbers: the next 400
// questions after `after` per call (the page calls it one step at a time).
export async function fixQuestionLinkCounts(after = 0) {
  const response = await apiClient.post('/admin/questions/link-counts/fix', { after });
  return response.data;
}

// End of the same fix: each course's question total from the steps' counts.
export async function fixCourseQuestionTotals(counts, expected) {
  const response = await apiClient.post('/admin/questions/course-totals/fix', { counts, expected });
  return response.data;
}

export async function fetchQuestionCounts(params) {
  const response = await apiClient.get('/admin/questions/counts', { params: params || {} });
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
