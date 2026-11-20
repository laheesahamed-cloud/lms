import { apiClient } from './client.js';
import { fetchSampleLesson } from './samples.api.js';
import { catalogueLessons } from './catalogue.api.js';
import { createTimedApiCache } from './cache.js';

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
  apiClient.post('/admin/ai-notes/generate', { text, sourceFormat: options.sourceFormat || 'text' }, withEngine({ timeout: 300000 }, options.engine)).then((r) => r.data);

// Progress-log variant: starts generation in the background and returns a job
// id to poll, so the UI can show a running log of stages instead of one long
// blocking wait — see adminGetAiNoteGenerationStatus.
export const adminStartAiNoteGeneration = (text, options = {}) =>
  apiClient.post('/admin/ai-notes/generate/start', { text, sourceFormat: options.sourceFormat || 'text' }, withEngine({}, options.engine)).then((r) => r.data);
// What the model will actually be handed, and what that means — length after
// HTML cleaning, how many passes it will take, and whether the tail falls past
// the completeness check.
export const adminPreviewAiNoteSource = (text, options = {}) =>
  apiClient.post('/admin/ai-notes/source/preview', { text, sourceFormat: options.sourceFormat || 'text' }, withEngine({}, options.engine)).then((r) => r.data);

// Rewrites a single card from the lesson's own saved source.
export const adminRegenerateAiNoteSection = (noteId, heading, options = {}) =>
  apiClient.post(`/admin/ai-notes/${noteId}/section/regenerate`, { heading }, withEngine({ timeout: 300000 }, options.engine)).then((r) => r.data);

export const adminGetAiNoteGenerationStatus = (jobId, options = {}) =>
  apiClient.get(`/admin/ai-notes/generate/status/${jobId}`, withEngine({}, options.engine)).then((r) => r.data);
// Admin search (header search box, Structure lesson search): a few matches
// per group from the server. `only: 'lessons'` returns up to 10 lessons.
export const adminSearch = (q, { only, signal } = {}) =>
  apiClient.get('/admin/dashboard/search', { params: only ? { q, only } : { q }, signal }).then((r) => r.data);
// Structure page: one subject's lessons (titles only, no lesson body). The
// counts it shows come with the course and subject lists (stored counts).
export const adminListStructureLessons = (topicId) =>
  apiClient.get('/admin/ai-notes/structure', { params: { topicId } }).then((r) => r.data);
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

// Structure page: move one course, subject, topic or lesson between two
// neighbours (aboveId / belowId; null at the top or bottom). One row changes.
export const adminMoveStructureItem = ({ kind, id, aboveId = null, belowId = null }) =>
  apiClient.post('/admin/ai-notes/structure/move', { kind, id, aboveId, belowId }).then((r) => {
    if (kind !== 'course') clearStudentAiNotesCache();
    return r.data;
  });
// Structure page "Fix counts": request 1 = plan + first set; each next request
// one set, the last one also finishing. One request at a time, with a pause.
// 10.60: quick fix (default) — only rows changed since the last check, one request.
export const adminFixCountsQuick = (bumpStamps = false) =>
  apiClient.post('/admin/ai-notes/structure/counts/fix/quick', bumpStamps ? { bumpStamps: true } : {}).then((r) => r.data);
export const adminFixCountsStart = (courseId = null, bumpStamps = false) =>
  apiClient.post('/admin/ai-notes/structure/counts/fix/start', {
    ...(courseId ? { courseId } : {}),
    ...(bumpStamps ? { bumpStamps: true } : {}),
  }).then((r) => r.data);
export const adminFixCountsSet = (runId, subjectIds, finish = null) =>
  apiClient.post('/admin/ai-notes/structure/counts/fix/set', finish ? { runId, subjectIds, finish } : { runId, subjectIds }).then((r) => r.data);
export const adminFixCountsFinish = (runId, courses) =>
  apiClient.post('/admin/ai-notes/structure/counts/fix/finish', { runId, courses }).then((r) => r.data);

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
  persistKey: 'student.aiNotes.list',
  key: (options = {}) => options.engine || 'gemini',
  load: async (options = {}) => {
    // 10.23 W7: every ready lesson from the app's list (lesson parts only, no
    // database work); locked ones carry a lock and open "Continue in the app".
    if ((options.engine || 'gemini') !== 'gemini') return [];
    return catalogueLessons();
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

// 10.21: the website opens FREE lessons only, from the sample files (no
// database work); a premium lesson answers "app only" (the page shows the
// "open in the app" lock). A lesson's note id is its lesson id.
export const getAiNote = (id) => fetchSampleLesson(id).then((data) => ({ ...data }));

export async function getLessonAiNote(lessonId) {
  return fetchSampleLesson(lessonId).then((data) => ({ ...data }));
}

export async function getAiNoteWithFallback(id, options = {}) {
  return tagStudentNoteEngine(await getAiNote(id, options), 'gemini');
}

export async function getLessonAiNoteWithFallback(lessonId, options = {}) {
  return tagStudentNoteEngine(await getLessonAiNote(lessonId, options), 'gemini');
}
