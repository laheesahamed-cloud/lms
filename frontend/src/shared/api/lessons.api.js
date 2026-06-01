import { apiClient } from './client.js';

export async function fetchLessonMeta() {
  const response = await apiClient.get('/lessons/meta');
  return response.data;
}

export async function fetchAdminLessons(params) {
  const requestParams = { ...(params || {}) };
  if (!requestParams.limit) requestParams.limit = 100;
  const response = await apiClient.get('/admin/lessons', { params: requestParams });
  return response.data;
}

export async function createLesson(payload) {
  const response = await apiClient.post('/admin/lessons', payload);
  return response.data;
}

export async function updateLesson(id, payload) {
  const response = await apiClient.patch(`/admin/lessons/${id}`, payload);
  return response.data;
}

export async function deleteLesson(id) {
  const response = await apiClient.delete(`/admin/lessons/${id}`);
  return response.data;
}

export async function fetchStudentLessons() {
  const response = await apiClient.get('/student/lessons');
  return response.data;
}

export async function fetchStudentLesson(id) {
  const response = await apiClient.get(`/student/lessons/${id}`);
  return response.data;
}

export async function fetchLessonAnnotations(lessonId) {
  const response = await apiClient.get(`/lessons/${lessonId}/annotations`);
  return response.data;
}

export async function createLessonAnnotation(lessonId, payload) {
  const response = await apiClient.post(`/lessons/${lessonId}/annotations`, payload);
  return response.data;
}

export async function updateLessonAnnotation(lessonId, annotationId, payload) {
  const response = await apiClient.patch(`/lessons/${lessonId}/annotations/${annotationId}`, payload);
  return response.data;
}

export async function deleteLessonAnnotation(lessonId, annotationId) {
  const response = await apiClient.delete(`/lessons/${lessonId}/annotations/${annotationId}`);
  return response.data;
}
