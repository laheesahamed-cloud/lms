import { apiClient } from './client.js';

export async function fetchTopics(courseId) {
  const response = await apiClient.get('/topics', {
    params: courseId ? { courseId } : undefined,
  });
  return response.data;
}

export async function fetchTopic(id) {
  const response = await apiClient.get(`/topics/${id}`);
  return response.data;
}

export async function createTopic(payload) {
  const response = await apiClient.post('/topics', payload);
  return response.data;
}

export async function updateTopic(id, payload) {
  const response = await apiClient.patch(`/topics/${id}`, payload);
  return response.data;
}

export async function deleteTopic(id) {
  const response = await apiClient.delete(`/topics/${id}`);
  return response.data;
}
