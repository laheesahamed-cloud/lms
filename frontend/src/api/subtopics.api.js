import { apiClient } from './client.js';

export async function fetchSubtopics(topicId) {
  const response = await apiClient.get('/subtopics', {
    params: topicId ? { topicId } : undefined,
  });
  return response.data;
}

export async function createSubtopic(payload) {
  const response = await apiClient.post('/subtopics', payload);
  return response.data;
}

export async function updateSubtopic(id, payload) {
  const response = await apiClient.patch(`/subtopics/${id}`, payload);
  return response.data;
}

export async function deleteSubtopic(id) {
  const response = await apiClient.delete(`/subtopics/${id}`);
  return response.data;
}
