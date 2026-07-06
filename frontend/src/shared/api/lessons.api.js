import { apiClient } from './client.js';

export async function createLesson(payload) {
  const response = await apiClient.post('/admin/lessons', payload);
  return response.data;
}

export async function updateLesson(id, payload) {
  const response = await apiClient.patch(`/admin/lessons/${id}`, payload);
  return response.data;
}

export async function uploadLessonPdf(id, file) {
  const form = new FormData();
  form.append('file', file);
  const response = await apiClient.post(`/admin/lessons/${id}/pdf`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

export async function removeLessonPdf(id) {
  const response = await apiClient.delete(`/admin/lessons/${id}/pdf`);
  return response.data;
}

export async function uploadLessonVideo(id, file) {
  const form = new FormData();
  form.append('file', file);
  const response = await apiClient.post(`/admin/lessons/${id}/video`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

export async function removeLessonVideo(id) {
  const response = await apiClient.delete(`/admin/lessons/${id}/video`);
  return response.data;
}
