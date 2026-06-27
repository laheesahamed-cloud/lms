import { apiClient } from './client.js';
import { createTimedApiCache } from './cache.js';
import { claimBootSlice } from './bootChannel.js';

function withEngine(config = {}, engine = 'gemini') {
  return {
    ...config,
    params: {
      ...(config.params || {}),
      engine,
    },
  };
}

const STUDENT_AI_NOTE_ENGINES = ['gemini', 'openai'];

function normalizeStudentNoteRows(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.notes)) return data.notes;
  if (Array.isArray(data?.aiNotes)) return data.aiNotes;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

function orderedStudentEngines(preferredEngine) {
  const preferred = String(preferredEngine || 'gemini').trim() || 'gemini';
  return Array.from(new Set([preferred, ...STUDENT_AI_NOTE_ENGINES]));
}

function tagStudentNoteEngine(note, engine) {
  return {
    ...note,
    engine: note?.engine || engine,
  };
}

export const adminGenerateAiNotes = (text, options = {}) =>
  apiClient.post('/admin/ai-notes/generate', { text }, withEngine({ timeout: 300000 }, options.engine)).then((r) => r.data);
export const adminListAiNotes = (options = {}) =>
  apiClient.get('/admin/ai-notes', withEngine({}, options.engine)).then((r) => r.data);
export const adminGetAiNote = (id, options = {}) =>
  apiClient.get(`/admin/ai-notes/${id}`, withEngine({}, options.engine)).then((r) => r.data);
export const adminCreateAiNote = (payload, options = {}) =>
  apiClient.post('/admin/ai-notes', payload, withEngine({}, options.engine)).then((r) => {
    clearStudentAiNotesCache();
    return r.data;
  });
export const adminUpdateAiNote = (id, payload, config = {}, options = {}) =>
  apiClient.patch(`/admin/ai-notes/${id}`, payload, withEngine(config, options.engine)).then((r) => {
    clearStudentAiNotesCache();
    return r.data;
  });
export const adminDeleteAiNote = (id, options = {}) =>
  apiClient.delete(`/admin/ai-notes/${id}`, withEngine({}, options.engine)).then((r) => {
    clearStudentAiNotesCache();
    return r.data;
  });

export const adminGetCourses = () => apiClient.get('/admin/ai-notes/hierarchy/courses').then((r) => r.data);
export const adminGetTopics = (courseId) =>
  apiClient.get(`/admin/ai-notes/hierarchy/topics${courseId ? `?courseId=${courseId}` : ''}`).then((r) => r.data);
export const adminGetSubtopics = (topicId) =>
  apiClient.get(`/admin/ai-notes/hierarchy/subtopics${topicId ? `?topicId=${topicId}` : ''}`).then((r) => r.data);
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

const studentAiNotesCache = createTimedApiCache({
  ttlMs: 3600000,
  persistKey: 'student.aiNotes',
  key: (options = {}) => options.engine || 'gemini',
  load: async (options = {}) => {
    // the /student/boot batch carries the default engine's list only
    if ((options.engine || 'gemini') === 'gemini') {
      const seeded = await claimBootSlice('aiNotes');
      if (seeded !== undefined) return seeded;
    }
    return apiClient.get('/student/ai-notes', withEngine({}, options.engine)).then((r) => r.data);
  },
});

// Direct DB fetch — only this lesson's approved flashcards (~5KB), never the
// note canvas. No cache, no full-note fallback.
export const getStudentLessonFlashcards = (noteId, options = {}) =>
  apiClient.get(`/student/ai-notes/${noteId}/flashcards`, withEngine({}, options.engine))
    .then((r) => (Array.isArray(r.data?.flashcards) ? r.data.flashcards : []));

export const seedStudentAiNotes = (data, engine = 'gemini') => studentAiNotesCache.seed(data, { engine });

export const listAiNotes = (options = {}) => studentAiNotesCache.get(options);

export const readAiNotesCache = (options = {}) => studentAiNotesCache.peek(options);

function isRateLimited(error) {
  return Number(error?.response?.status) === 429;
}

async function listAiNotesForEngineWithRetry(options, engine, attempts = 2) {
  let lastError = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await listAiNotes({ ...options, engine });
    } catch (error) {
      lastError = error;
      // Only retry true network/timeout failures (no HTTP response). If the
      // server responded — especially a 429 rate-limit — retrying just adds
      // more load and makes the rate-limiting worse.
      if (error?.response || attempt >= attempts - 1) break;
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
  }
  throw lastError;
}

export async function listStudentAiNotesAcrossEngines(options = {}) {
  const { fresh, ...rest } = options;
  // `fresh` bypasses the (native-persistent, stale-while-revalidate) cache and
  // reads straight from the DB. Flashcards/notes screens use this so the app
  // never shows last-session's stale list while the web shows current data.
  if (fresh) studentAiNotesCache.clear();
  const rowsById = new Map();
  const results = await Promise.allSettled(
    orderedStudentEngines(rest.engine).map(async (engine) => {
      // Retry per engine: on native a transient timeout for one engine would
      // otherwise silently drop every course that only exists in that engine.
      const data = await listAiNotesForEngineWithRetry(rest, engine);
      return { engine, rows: normalizeStudentNoteRows(data) };
    })
  );

  for (const result of results) {
    if (result.status !== 'fulfilled') continue;
    for (const note of result.value.rows) {
      const key = String(note?.id ?? `${result.value.engine}:${rowsById.size}`);
      if (!rowsById.has(key)) {
        rowsById.set(key, tagStudentNoteEngine(note, result.value.engine));
      }
    }
  }

  return Array.from(rowsById.values());
}

export function clearStudentAiNotesCache() {
  studentAiNotesCache.clear();
}

export const getAiNote = (id, options = {}) =>
  apiClient.get(`/student/ai-notes/${id}`, withEngine({}, options.engine)).then((r) => r.data);

export async function getLessonAiNote(lessonId, options = {}) {
  return apiClient.get(`/student/ai-notes/lesson/${lessonId}`, withEngine({}, options.engine)).then((r) => r.data);
}

export async function getAiNoteWithFallback(id, options = {}) {
  let lastError = null;
  for (const engine of orderedStudentEngines(options.engine)) {
    try {
      const data = await getAiNote(id, { ...options, engine });
      return tagStudentNoteEngine(data, engine);
    } catch (error) {
      lastError = error;
      // A 429 is not engine-specific — trying the next engine only fires more
      // rate-limited requests. Stop immediately.
      if (isRateLimited(error)) break;
    }
  }
  throw lastError;
}

export async function getLessonAiNoteWithFallback(lessonId, options = {}) {
  let lastError = null;
  for (const engine of orderedStudentEngines(options.engine)) {
    try {
      const data = await getLessonAiNote(lessonId, { ...options, engine });
      return tagStudentNoteEngine(data, engine);
    } catch (error) {
      lastError = error;
      if (isRateLimited(error)) break;
    }
  }
  throw lastError;
}
