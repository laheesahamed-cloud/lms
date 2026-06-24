import { apiClient } from './client.js';

export async function createLesson(payload) {
  const response = await apiClient.post('/admin/lessons', payload);
  return response.data;
}

export async function updateLesson(id, payload) {
  const response = await apiClient.patch(`/admin/lessons/${id}`, payload);
  return response.data;
}
