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
  apiClient.post('/ai-notes/generate', { text }, withEngine({ timeout: 300000 }, options.engine)).then((r) => r.data);
export const adminListAiNotes = (options = {}) =>
  apiClient.get('/ai-notes/admin', withEngine({}, options.engine)).then((r) => r.data);
export const adminGetAiNote = (id, options = {}) =>
  apiClient.get(`/ai-notes/admin/${id}`, withEngine({}, options.engine)).then((r) => r.data);
export const adminCreateAiNote = (payload, options = {}) =>
  apiClient.post('/ai-notes/admin', payload, withEngine({}, options.engine)).then((r) => r.data);
export const adminUpdateAiNote = (id, payload, config = {}, options = {}) =>
  apiClient.patch(`/ai-notes/admin/${id}`, payload, withEngine(config, options.engine)).then((r) => r.data);
export const adminDeleteAiNote = (id, options = {}) =>
  apiClient.delete(`/ai-notes/admin/${id}`, withEngine({}, options.engine)).then((r) => r.data);

export const adminGetCourses = () => apiClient.get('/ai-notes/admin/hierarchy/courses').then((r) => r.data);
export const adminGetTopics = (courseId) =>
  apiClient.get(`/ai-notes/admin/hierarchy/topics${courseId ? `?courseId=${courseId}` : ''}`).then((r) => r.data);
export const adminGetSubtopics = (topicId) =>
  apiClient.get(`/ai-notes/admin/hierarchy/subtopics${topicId ? `?topicId=${topicId}` : ''}`).then((r) => r.data);
export const adminGetLessons = (subtopicId) =>
  apiClient.get(`/ai-notes/admin/hierarchy/lessons${subtopicId ? `?subtopicId=${subtopicId}` : ''}`).then((r) => r.data);
export const adminGetLessonCanvases = (options = {}) =>
  apiClient.get('/ai-notes/admin/lesson-canvases', withEngine({}, options.engine)).then((r) => r.data);

export const listAiNotes = (options = {}) =>
  apiClient.get('/ai-notes', withEngine({}, options.engine)).then((r) => r.data);
export const getAiNote = (id, options = {}) =>
  apiClient.get(`/ai-notes/${id}`, withEngine({}, options.engine)).then((r) => r.data);

export async function getLessonAiNote(lessonId, options = {}) {
  return apiClient.get(`/ai-notes/student/lesson/${lessonId}`, withEngine({}, options.engine)).then((r) => r.data);
}
