import { apiClient } from './client.js';

// ── Student ──
export const fetchAuscTopics = (category = 'heart') =>
  apiClient.get('/student/auscultation/topics', { params: { category } }).then((r) => r.data);

export const fetchAuscTopic = (id) =>
  apiClient.get(`/student/auscultation/topics/${id}`).then((r) => r.data);

export const fetchAuscQuiz = (category = 'heart', count = 10) =>
  apiClient.get('/student/auscultation/quiz', { params: { category, count } }).then((r) => r.data);

/** Fetch an audio clip as an object URL (authenticated via the shared client). */
export const fetchAuscAudioUrl = (kind, id) =>
  apiClient
    .get(`/student/auscultation/${kind}/${id}/audio`, { responseType: 'blob' })
    .then((r) => URL.createObjectURL(r.data));

// ── Admin: topics ──
export const adminListAuscTopics = (category) =>
  apiClient.get('/admin/auscultation/topics', { params: category ? { category } : {} }).then((r) => r.data);

export const adminCreateAuscTopic = (data) =>
  apiClient.post('/admin/auscultation/topics', data).then((r) => r.data);

export const adminUpdateAuscTopic = (id, data) =>
  apiClient.put(`/admin/auscultation/topics/${id}`, data).then((r) => r.data);

export const adminToggleAuscTopic = (id) =>
  apiClient.patch(`/admin/auscultation/topics/${id}/toggle`).then((r) => r.data);

export const adminDeleteAuscTopic = (id) =>
  apiClient.delete(`/admin/auscultation/topics/${id}`).then((r) => r.data);

// ── Admin: cards ──
export const adminListAuscCards = (topicId) =>
  apiClient.get(`/admin/auscultation/topics/${topicId}/cards`).then((r) => r.data);

export const adminCreateAuscCard = (data) =>
  apiClient.post('/admin/auscultation/cards', data).then((r) => r.data);

export const adminUpdateAuscCard = (id, data) =>
  apiClient.put(`/admin/auscultation/cards/${id}`, data).then((r) => r.data);

export const adminToggleAuscCard = (id) =>
  apiClient.patch(`/admin/auscultation/cards/${id}/toggle`).then((r) => r.data);

export const adminDeleteAuscCard = (id) =>
  apiClient.delete(`/admin/auscultation/cards/${id}`).then((r) => r.data);

// ── Admin: all sounds (for quiz "reuse existing" picker) ──
export const adminListAuscSounds = (category) =>
  apiClient.get('/admin/auscultation/sounds', { params: category ? { category } : {} }).then((r) => r.data);

// ── Admin: quiz ──
export const adminListAuscQuiz = (category) =>
  apiClient.get('/admin/auscultation/quiz', { params: category ? { category } : {} }).then((r) => r.data);

export const adminCreateAuscQuiz = (data) =>
  apiClient.post('/admin/auscultation/quiz', data).then((r) => r.data);

export const adminUpdateAuscQuiz = (id, data) =>
  apiClient.put(`/admin/auscultation/quiz/${id}`, data).then((r) => r.data);

export const adminToggleAuscQuiz = (id) =>
  apiClient.patch(`/admin/auscultation/quiz/${id}/toggle`).then((r) => r.data);

export const adminDeleteAuscQuiz = (id) =>
  apiClient.delete(`/admin/auscultation/quiz/${id}`).then((r) => r.data);
