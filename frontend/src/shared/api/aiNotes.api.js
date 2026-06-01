import { apiClient } from './client.js';

function withEngine(config = {}, engine = 'gemini') {
  return {
    ...config,
    params: {
      ...(config.params || {}),
      engine,
    },
  };
}

export const adminGenerateAiNotes = (text, options = {}) =>
  apiClient.post('/admin/ai-notes/generate', { text }, withEngine({ timeout: 300000 }, options.engine)).then((r) => r.data);
export const adminListAiNotes = (options = {}) =>
  apiClient.get('/admin/ai-notes', withEngine({}, options.engine)).then((r) => r.data);
export const adminGetAiNote = (id, options = {}) =>
  apiClient.get(`/admin/ai-notes/${id}`, withEngine({}, options.engine)).then((r) => r.data);
export const adminCreateAiNote = (payload, options = {}) =>
  apiClient.post('/admin/ai-notes', payload, withEngine({}, options.engine)).then((r) => r.data);
export const adminUpdateAiNote = (id, payload, config = {}, options = {}) =>
  apiClient.patch(`/admin/ai-notes/${id}`, payload, withEngine(config, options.engine)).then((r) => r.data);
export const adminDeleteAiNote = (id, options = {}) =>
  apiClient.delete(`/admin/ai-notes/${id}`, withEngine({}, options.engine)).then((r) => r.data);

export const adminGetCourses = () => apiClient.get('/admin/ai-notes/hierarchy/courses').then((r) => r.data);
export const adminGetTopics = (courseId) =>
  apiClient.get(`/admin/ai-notes/hierarchy/topics${courseId ? `?courseId=${courseId}` : ''}`).then((r) => r.data);
export const adminGetSubtopics = (topicId) =>
  apiClient.get(`/admin/ai-notes/hierarchy/subtopics${topicId ? `?topicId=${topicId}` : ''}`).then((r) => r.data);
export const adminGetLessons = (subtopicId) =>
  apiClient.get(`/admin/ai-notes/hierarchy/lessons${subtopicId ? `?subtopicId=${subtopicId}` : ''}`).then((r) => r.data);
export const adminGetLessonCanvases = (options = {}) =>
  apiClient.get('/admin/ai-notes/lesson-canvases', withEngine({}, options.engine)).then((r) => r.data);
export const adminListLessonFlashcards = (noteId, options = {}) =>
  apiClient.get(`/admin/ai-notes/${noteId}/flashcards`, withEngine({}, options.engine)).then((r) => r.data);
export const adminGenerateLessonFlashcards = (noteId, payload = {}, options = {}) =>
  apiClient.post(`/admin/ai-notes/${noteId}/flashcards/generate`, payload, withEngine({ timeout: 240000 }, options.engine)).then((r) => r.data);
export const adminCreateLessonFlashcard = (noteId, payload, options = {}) =>
  apiClient.post(`/admin/ai-notes/${noteId}/flashcards`, payload, withEngine({}, options.engine)).then((r) => r.data);
export const adminUpdateLessonFlashcard = (noteId, cardId, payload, options = {}) =>
  apiClient.patch(`/admin/ai-notes/${noteId}/flashcards/${cardId}`, payload, withEngine({}, options.engine)).then((r) => r.data);
export const adminDeleteLessonFlashcard = (noteId, cardId, options = {}) =>
  apiClient.delete(`/admin/ai-notes/${noteId}/flashcards/${cardId}`, withEngine({}, options.engine)).then((r) => r.data);

export const listAiNotes = (options = {}) =>
  apiClient.get('/student/ai-notes', withEngine({}, options.engine)).then((r) => r.data);
export const getAiNote = (id, options = {}) =>
  apiClient.get(`/student/ai-notes/${id}`, withEngine({}, options.engine)).then((r) => r.data);

export async function getLessonAiNote(lessonId, options = {}) {
  return apiClient.get(`/student/ai-notes/lesson/${lessonId}`, withEngine({}, options.engine)).then((r) => r.data);
}
