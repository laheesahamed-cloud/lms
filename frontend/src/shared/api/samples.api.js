import { apiClient } from './client.js';

/**
 * Free samples for the light student website (OPTIMIZE 10.21). The server
 * builds them as files once per content version and serves them without any
 * database work or sign-in:
 *   /samples/index        free lessons, quizzes and decks per course, plus
 *                         how many more each course has in the app
 *   /samples/lesson/:id   one free lesson
 *   /samples/quiz/:id     one free quiz (questions, answer key, explanations)
 *   /samples/deck/:id     one free flashcard deck (by lesson id)
 * Premium content is never in them; asking for it answers "app only".
 * The browser keeps each reply (Cache-Control + ETag), and this module keeps
 * them in memory for the visit.
 */
const memory = new Map();

function load(path) {
  if (!memory.has(path)) {
    const request = apiClient.get(path, { __skipNetworkActivity: true }).then((r) => r.data);
    request.catch(() => memory.delete(path));
    memory.set(path, request);
  }
  return memory.get(path);
}

export const fetchSamplesIndex = () => load('/samples/index');

/**
 * Premium content is answered "continue in the app" right here, from the free
 * list the browser already holds — no request is made for it (user, 10.21).
 * Same shape as the server's app-only answer, so every page shows its usual
 * "Open in the app" screen.
 */
function appOnly() {
  const error = new Error('This content is only available in the Xyndrome mobile app.');
  error.response = { status: 403, data: { statusCode: 403, code: 'APP_ONLY_CONTENT', message: error.message } };
  return error;
}

async function freeIds(kind) {
  const index = await fetchSamplesIndex();
  return new Set((index?.courses || []).flatMap((c) => c[kind] || []).map((x) => Number(x.id)));
}

async function loadFree(kind, path, id) {
  if (!(await freeIds(kind)).has(Number(id))) throw appOnly();
  return load(`/samples/${path}/${Number(id)}`);
}

export const fetchSampleLesson = (id) => loadFree('lessons', 'lesson', id);
export const fetchSampleQuiz = (id) => loadFree('quizzes', 'quiz', id);
export const fetchSampleDeck = (id) => loadFree('decks', 'deck', id);

/** Every free lesson, in course order (the website lessons list shape). */
export async function freeLessons() {
  const index = await fetchSamplesIndex();
  // Finished on this browser (samples keep no progress on the server).
  let done = new Set();
  try { done = new Set((JSON.parse(window.localStorage.getItem('lms.sample.lessonsDone') || '[]') || []).map(Number)); } catch { /* none */ }
  return (index?.courses || []).flatMap((c) => c.lessons || []).map((l) => (done.has(Number(l.id))
    ? { ...l, lessonCompleted: true, lessonProgressStatus: 'completed', lessonProgressPercent: 100 }
    : l));
}

/** Every free quiz (the website Q-Bank list shape). */
export async function freeQuizzes() {
  const index = await fetchSamplesIndex();
  return (index?.courses || []).flatMap((c) => c.quizzes || []);
}

/** True when the quiz is a free sample (marked in the browser). */
export async function isFreeSampleQuiz(quizId) {
  return (await freeQuizzes()).some((q) => Number(q.id) === Number(quizId));
}

/** Courses as the samples index lists them (for courses with no free items). */
export async function sampleCourses() {
  const index = await fetchSamplesIndex();
  return index?.courses || [];
}

/**
 * The Study Hub's question of the day (10.22), picked in the browser by date
 * and account from the free questions already inside the index — no extra
 * file, no database work. Same shape the Study Hub card already draws.
 */
export async function pickQuestionOfDay(userId) {
  const index = await fetchSamplesIndex();
  const pool = Array.isArray(index?.dailyQuestions) ? index.dailyQuestions : [];
  if (!pool.length) return null;
  const d = new Date();
  const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}:${userId || ''}`;
  let seed = 0;
  for (let i = 0; i < key.length; i += 1) seed = (seed * 31 + key.charCodeAt(i)) >>> 0;
  return pool[seed % pool.length];
}
