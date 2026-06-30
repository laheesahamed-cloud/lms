import { apiClient } from './client.js';

// ── Student ──
export const fetchEcgTopics = () =>
  apiClient.get('/student/ecg/topics').then((r) => r.data);

export const fetchEcgTopic = (id) =>
  apiClient.get(`/student/ecg/topics/${id}`).then((r) => r.data);

export const fetchEcgQuiz = (count = 10) =>
  apiClient.get('/student/ecg/quiz', { params: { count } }).then((r) => r.data);

// ── Admin: topics ──
export const adminListEcgTopics = () =>
  apiClient.get('/admin/ecg/topics').then((r) => r.data);

export const adminCreateEcgTopic = (data) =>
  apiClient.post('/admin/ecg/topics', data).then((r) => r.data);

export const adminUpdateEcgTopic = (id, data) =>
  apiClient.put(`/admin/ecg/topics/${id}`, data).then((r) => r.data);

export const adminToggleEcgTopic = (id) =>
  apiClient.patch(`/admin/ecg/topics/${id}/toggle`).then((r) => r.data);

export const adminDeleteEcgTopic = (id) =>
  apiClient.delete(`/admin/ecg/topics/${id}`).then((r) => r.data);

export const adminReorderEcgTopics = (ids) =>
  apiClient.put('/admin/ecg/topics/reorder', { ids }).then((r) => r.data);

// ── Admin: cards ──
export const adminListEcgCards = (topicId) =>
  apiClient.get(`/admin/ecg/topics/${topicId}/cards`).then((r) => r.data);

export const adminCreateEcgCard = (data) =>
  apiClient.post('/admin/ecg/cards', data).then((r) => r.data);

export const adminUpdateEcgCard = (id, data) =>
  apiClient.put(`/admin/ecg/cards/${id}`, data).then((r) => r.data);

export const adminToggleEcgCard = (id) =>
  apiClient.patch(`/admin/ecg/cards/${id}/toggle`).then((r) => r.data);

export const adminDeleteEcgCard = (id) =>
  apiClient.delete(`/admin/ecg/cards/${id}`).then((r) => r.data);

export const adminReorderEcgCards = (ids) =>
  apiClient.put('/admin/ecg/cards/reorder', { ids }).then((r) => r.data);

// ── Admin: quiz questions ──
export const adminListEcgQuiz = () =>
  apiClient.get('/admin/ecg/quiz').then((r) => r.data);

export const adminGetEcgQuiz = (id) =>
  apiClient.get(`/admin/ecg/quiz/${id}`).then((r) => r.data);

export const adminCreateEcgQuiz = (data) =>
  apiClient.post('/admin/ecg/quiz', data).then((r) => r.data);

export const adminUpdateEcgQuiz = (id, data) =>
  apiClient.put(`/admin/ecg/quiz/${id}`, data).then((r) => r.data);

export const adminToggleEcgQuiz = (id) =>
  apiClient.patch(`/admin/ecg/quiz/${id}/toggle`).then((r) => r.data);

export const adminDeleteEcgQuiz = (id) =>
  apiClient.delete(`/admin/ecg/quiz/${id}`).then((r) => r.data);
