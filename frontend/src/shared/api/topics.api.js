import { apiClient } from './client.js';

export async function fetchTopics(courseId) {
  const response = await apiClient.get('/admin/topics', {
    params: courseId ? { courseId } : undefined,
  });
  return response.data;
}

export async function fetchTopic(id) {
  const response = await apiClient.get(`/admin/topics/${id}`);
  return response.data;
}

export async function createTopic(payload) {
  const response = await apiClient.post('/admin/topics', payload);
  return response.data;
}

export async function updateTopic(id, payload) {
  const response = await apiClient.patch(`/admin/topics/${id}`, payload);
  return response.data;
}

export async function deleteTopic(id) {
  const response = await apiClient.delete(`/admin/topics/${id}`);
  return response.data;
}
