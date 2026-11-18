import { apiClient } from './client.js';
import { createTimedApiCache } from './cache.js';
import { clearDashboardCache } from './dashboard.api.js';
import { claimBootSlice } from './bootChannel.js';
import { useAuthStore } from '../stores/authStore.js';
import { fetchSampleQuiz, freeQuizzes } from './samples.api.js';
import { catalogueQuizzes } from './catalogue.api.js';

const STUDENT_QUIZZES_CACHE_MS = 3600000;
const STUDENT_RESULTS_CACHE_MS = 3600000;
// Shared hosting can cold-boot the Node app on the first request after idle,
// which routinely takes longer than 12s. Allow more headroom (and let the
// client retry) so a cold start doesn't surface as "cannot reach API".
const STUDENT_QUIZ_PAYLOAD_TIMEOUT_MS = 25_000;
const studentQuizLoadRequests = new Map();
const studentQuizzesCache = createTimedApiCache({
  ttlMs: STUDENT_QUIZZES_CACHE_MS,
  persistKey: 'student.quizzes.list',
  // 10.23 W7: every quiz from the app's list (quiz parts only, no database
  // work); locked ones carry a lock and open "Continue in the app".
  load: () => catalogueQuizzes(),
});

export const seedStudentQuizzes = (data) => studentQuizzesCache.seed(data);
const studentResultsCache = createTimedApiCache({
  ttlMs: STUDENT_RESULTS_CACHE_MS,
  persistKey: 'student.results',
  // The account's recent results (phone exams) plus the free samples taken in
  // this browser (10.21: kept in the browser only), newest first.
  // 10.22: the start-up reply carries the account's results; ask the server
  // only when there is no start-up batch to take them from.
  load: async () => mergeResults(
    (await claimBootSlice('results'))
      ?? await apiClient.get('/student/quiz-attempts/results').then((response) => response.data).catch(() => []),
  ),
});

function mergeResults(server) {
  const local = readLocalSampleResults();
  const seen = new Set(local.map((r) => Number(r.quizId)));
  return [...local, ...(Array.isArray(server) ? server.filter((r) => !seen.has(Number(r.quizId))) : [])]
    .sort((a, b) => String(b.submittedAt || '').localeCompare(String(a.submittedAt || '')));
}

/** 10.22: the start-up reply carries the account's results — no separate request. */
export function seedStudentResults(server) {
  const merged = mergeResults(server);
  studentResultsCache.seed(merged);
  return merged;
}

function serializeParams(params = {}) {
  return Object.entries(params || {})
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}:${String(value)}`)
    .join('|');
}

async function fetchStudentQuizPayload(quizId, params) {
  // Loading a quiz is an idempotent GET, so allow the client's automatic retry
  // to ride out a cold-boot timeout instead of failing the whole open.
  const response = await apiClient.get(`/student/quiz-attempts/quiz/${quizId}`, {
    params,
    timeout: STUDENT_QUIZ_PAYLOAD_TIMEOUT_MS,
  });
  return response.data;
}

export function clearStudentQuizzesCache() {
  studentQuizzesCache.clear();
}

export function clearStudentResultsCache() {
  studentResultsCache.clear();
}

function clearStudentQuizOutcomeCaches() {
  clearStudentQuizzesCache();
  clearStudentResultsCache();
  clearDashboardCache();
}

export async function fetchStudentQuizzes() {
  return studentQuizzesCache.get();
}

export function readStudentQuizzesCache() {
  return studentQuizzesCache.peek();
}

function isPracticeQuizParams(params = {}) {
  return String(params?.mode || 'practice').toLowerCase() === 'practice';
}

export async function loadStudentQuiz(quizId, params) {
  if (isPracticeQuizParams(params)) {
    // 10.21: practice opens the free sample file (premium answers "app only").
    const sample = await fetchSampleQuiz(quizId);
    const questionId = Number(params?.questionId || 0);
    return {
      ...sample,
      mode: 'practice',
      questions: questionId ? (sample.questions || []).filter((q) => Number(q.id) === questionId) : (sample.questions || []),
    };
  }
  if (String(params?.mode || '').toLowerCase() === 'exam') {
    return loadExam(quizId);
  }

  const key = `${quizId}:${serializeParams(params)}`;
  if (studentQuizLoadRequests.has(key)) {
    return studentQuizLoadRequests.get(key);
  }

  const request = fetchStudentQuizPayload(quizId, params)
    .finally(() => {
      studentQuizLoadRequests.delete(key);
    });
  studentQuizLoadRequests.set(key, request);
  return request;
}

export function prefetchStudentQuiz(quizId, params) {
  return loadStudentQuiz(quizId, params).catch(() => null);
}

// ── Exams on the progress row (OPTIMIZE 10.16-W, same flow as the phone) ──
// Open = POST start (1 statement, a signed exam token); the reply is kept in
// this browser until it is submitted or out of time, so reopening costs no
// request. Answers stay in the page's local draft (no autosave requests).
// Submit = POST finish (1 statement); its reply carries the result and review.
const EXAM_START_PREFIX = 'lms.exam.start.';
const RECENT_PREFIX = 'lms.exam.recent.';

function userKey() {
  try { return String(useAuthStore.getState()?.user?.id || 'anon'); } catch { return 'anon'; }
}

function readLocal(key) {
  try { return JSON.parse(window.localStorage.getItem(key) || 'null'); } catch { return null; }
}

function writeLocal(key, value) {
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full or blocked */ }
}

function removeLocal(key) {
  try { window.localStorage.removeItem(key); } catch { /* nothing to clear */ }
}

const startKey = (quizId) => `${EXAM_START_PREFIX}${userKey()}.${quizId}`;
const recentKey = (quizId) => `${RECENT_PREFIX}${userKey()}.${quizId}`;

function examPayloadFromStart(start) {
  const deadlineMs = Date.parse(start.deadlineAt);
  const startedMs = Date.parse(start.startedAt) || Date.now();
  return {
    mode: 'exam',
    quiz: start.quiz,
    questions: start.questions || [],
    examToken: start.examToken,
    examSession: {
      id: startedMs,
      status: 'in_progress',
      startedAt: start.startedAt,
      deadlineAt: start.deadlineAt,
      serverTime: new Date().toISOString(),
      secondsRemaining: Number.isFinite(deadlineMs) ? Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000)) : null,
      answers: {},
      flaggedQuestionIds: [],
      lastQuestionIndex: 0,
    },
  };
}

async function loadExam(quizId) {
  const saved = readLocal(startKey(quizId));
  if (saved && Date.parse(saved.deadlineAt) > Date.now()) return examPayloadFromStart(saved);
  if (saved) removeLocal(startKey(quizId));
  // 10.21: the website's exams are the FREE samples, marked in this browser:
  // no start request, no database work (premium answers "app only").
  const sample = await fetchSampleQuiz(quizId);
  const startedAt = Date.now();
  const limitMinutes = Number(sample?.quiz?.timeLimit || 0);
  const start = {
    local: true,
    quiz: sample.quiz,
    questions: (sample.questions || []).map((q) => ({
      id: q.id,
      questionType: q.questionType,
      questionText: q.questionText,
      options: (q.options || []).map((o) => ({ id: o.id, optionLabel: o.optionLabel, optionText: o.optionText })),
    })),
    startedAt: new Date(startedAt).toISOString(),
    deadlineAt: new Date(startedAt + (limitMinutes ? limitMinutes * 60_000 : 3 * 60 * 60 * 1000)).toISOString(),
    timeLimitSeconds: limitMinutes * 60,
  };
  writeLocal(startKey(quizId), start);
  return examPayloadFromStart(start);
}

// ── Marking in the browser (same rules as the server's) ──
const SBA_QUESTION_MARKS = 2;
const TRUE_FALSE_STATEMENT_MARKS = 0.4;
const TRUE_FALSE_STATEMENTS_PER_QUESTION = 5;
const QUIZ_TOTAL_MARKS = 100;
const QUIZ_PASS_MARK = 45;
const isCorrectOption = (o) => Number(o?.isCorrect) === 1;

function answerState(question, raw) {
  if (question.questionType === 'sba') {
    const id = raw === null || raw === undefined || raw === '' ? null : Number(raw);
    return { selectedIds: id ? [id] : [], tfMap: {} };
  }
  const submitted = raw && typeof raw === 'object' ? raw : {};
  const tfMap = {};
  for (const o of question.options || []) {
    const v = submitted[String(o.id)];
    if (v !== 0 && v !== 1 && v !== '0' && v !== '1') continue;
    tfMap[o.id] = Number(v) === 1 ? 1 : 0;
  }
  return { selectedIds: [], tfMap };
}

function answerStatus(question, state) {
  if (question.questionType === 'sba') {
    const correct = (question.options || []).filter(isCorrectOption).map((o) => o.id).sort((a, b) => a - b);
    const selected = [...state.selectedIds].sort((a, b) => a - b);
    if (!selected.length) return 'unanswered';
    return JSON.stringify(selected) === JSON.stringify(correct) ? 'correct' : 'wrong';
  }
  const answered = Object.keys(state.tfMap).length;
  if (!answered) return 'unanswered';
  if (answered < (question.options || []).length) return 'wrong';
  return (question.options || []).every((o) => state.tfMap[o.id] === (isCorrectOption(o) ? 1 : 0)) ? 'correct' : 'wrong';
}

function questionScore(question, state) {
  if (question.questionType === 'sba') return answerStatus(question, state) === 'correct' ? SBA_QUESTION_MARKS : 0;
  let right = 0, wrong = 0;
  for (const o of question.options || []) {
    if (!(o.id in state.tfMap)) continue;
    if (state.tfMap[o.id] === (isCorrectOption(o) ? 1 : 0)) right++; else wrong++;
  }
  const r = Math.max(0, Math.min(TRUE_FALSE_STATEMENTS_PER_QUESTION, right));
  const w = Math.max(0, Math.min(TRUE_FALSE_STATEMENTS_PER_QUESTION - r, wrong));
  return Math.max(0, Math.min(SBA_QUESTION_MARKS, Number((TRUE_FALSE_STATEMENT_MARKS * (r - w)).toFixed(2))));
}

const LOCAL_RESULTS_PREFIX = 'lms.sample.results.';

function readLocalSampleResults() {
  const list = readLocal(`${LOCAL_RESULTS_PREFIX}${userKey()}`);
  return Array.isArray(list) ? list : [];
}

function writeLocalSampleResult(entry) {
  const list = readLocalSampleResults().filter((r) => Number(r.quizId) !== Number(entry.quizId));
  writeLocal(`${LOCAL_RESULTS_PREFIX}${userKey()}`, [entry, ...list].slice(0, 20));
}

async function markSampleExam(quizId, answers) {
  const sample = await fetchSampleQuiz(quizId);
  const item = (await freeQuizzes()).find((q) => Number(q.id) === Number(quizId)) || {};
  const questions = sample.questions || [];
  let raw = 0, correct = 0, wrong = 0, unanswered = 0;
  const reviewed = questions.map((q) => {
    const state = answerState(q, answers?.[String(q.id)]);
    const status = answerStatus(q, state);
    const score = questionScore(q, state);
    raw += score;
    if (status === 'correct') correct++; else if (status === 'wrong') wrong++; else unanswered++;
    return { ...q, answerState: state, answerStatus: status, questionScore: score, maxQuestionScore: SBA_QUESTION_MARKS };
  });
  const score = questions.length ? Number(((raw / (questions.length * SBA_QUESTION_MARKS)) * QUIZ_TOTAL_MARKS).toFixed(2)) : 0;
  const pct = Math.max(0, Math.min(100, Math.round(score)));
  const passingMarks = Number(item.passingMarks || sample?.quiz?.passingMarks || QUIZ_PASS_MARK) || QUIZ_PASS_MARK;
  const passStatus = score >= passingMarks ? 'pass' : 'fail';
  const topicDisplay = item.isGeneral && !item.subjectName ? 'General / Full Course Revision' : (item.subjectName || 'No Topic');
  const quizTitle = item.studentTitle || item.quizTitle || sample?.quiz?.quizTitle || 'Quiz';
  const result = {
    attemptId: Number(quizId), quizId: Number(quizId), quizTitle,
    displayTitleMode: item.displayTitleMode || 'title', quizNumber: item.quizNumber || null,
    courseTitle: item.courseTitle || '', topicDisplay, passStatus,
    totalQuestions: questions.length, totalMarks: QUIZ_TOTAL_MARKS,
    correctAnswers: correct, wrongAnswers: wrong, unansweredQuestions: unanswered,
    score, percentage: pct, passingMarks,
  };
  const review = {
    attempt: { attemptId: Number(quizId), quizId: Number(quizId), lessonId: item.lessonId || null, quizTitle, courseTitle: item.courseTitle || '', topicDisplay, score, percentage: pct, passStatus },
    questions: reviewed,
  };
  writeLocalSampleResult({
    attemptId: Number(quizId), quizId: Number(quizId), quizTitle,
    displayTitleMode: result.displayTitleMode, quizNumber: result.quizNumber, subtopic: item.subtopic || '',
    courseTitle: result.courseTitle, topicDisplay, score: pct, percentage: pct,
    correctAnswers: correct, wrongAnswers: wrong, passStatus,
    submittedAt: new Date().toISOString(), reviewedAt: null, sample: true,
  });
  return { result, review };
}

/** Minimum time before submit (same rule as the phone): first try ÷10, redo of a failed quiz ÷20, passed 1 minute. */
function minExamMs(quiz, limitMinutes) {
  if (!limitMinutes) return 0;
  const total = limitMinutes * 60_000;
  if (quiz?.passed) return 60_000;
  if (quiz && quiz.bestPercentage !== null && quiz.bestPercentage !== undefined) return total / 20;
  return total / 10;
}

export async function submitExam(quizId, payload) {
  const start = readLocal(startKey(quizId));
  if (!start?.examToken && !start?.local) {
    throw new Error('This exam has expired. Open it again to start a new attempt.');
  }
  const deadlineMs = Date.parse(start.deadlineAt);
  const timeUp = Number.isFinite(deadlineMs) && deadlineMs <= Date.now() + 5_000;
  if (!timeUp) {
    const quiz = (readStudentQuizzesCache() || []).find?.((q) => Number(q.id) === Number(quizId));
    const limit = Number(start.quiz?.timeLimit || start.timeLimitSeconds / 60 || 0);
    const wait = minExamMs(quiz, limit) - (Date.now() - (Date.parse(start.startedAt) || Date.now()));
    if (wait > 0) {
      const mins = Math.ceil(wait / 60_000);
      throw new Error(`Not so fast — take your time. You can submit in ${mins} minute${mins === 1 ? '' : 's'}.`);
    }
  }
  // 10.21: free samples are marked here (no request); results stay in the browser.
  const data = start.local
    ? await markSampleExam(quizId, payload?.answers || {})
    : (await apiClient.post(`/student/quiz-attempts/exam/${quizId}/finish`, {
      examToken: start.examToken,
      answers: payload?.answers || {},
    })).data || {};
  removeLocal(startKey(quizId));
  if (data.result || data.review) writeLocal(recentKey(quizId), { result: data.result, review: data.review, savedAt: Date.now() });
  clearStudentQuizOutcomeCaches();
  return { ...data, attemptId: Number(quizId) };
}

/** Answers stay in the page's local draft: nothing is sent (0 requests). */
export async function saveExamProgress(quizId) {
  const start = readLocal(startKey(quizId));
  const deadlineMs = Date.parse(start?.deadlineAt || '');
  return {
    success: true,
    localOnly: true,
    serverTime: new Date().toISOString(),
    deadlineAt: start?.deadlineAt || null,
    secondsRemaining: Number.isFinite(deadlineMs) ? Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000)) : null,
  };
}

/**
 * A recent result's result / review: the copy kept from the submit (or a
 * previous open) when it is still the current one, else ONE request.
 * Stale when the results list shows a newer attempt of the quiz (a redo on
 * the phone).
 */
function keptRecent(quizId, need) {
  const kept = readLocal(recentKey(quizId));
  if (!kept || !kept[need]) return null;
  const listed = (readStudentResultsCache() || []).find?.((r) => Number(r.quizId) === Number(quizId));
  if (listed?.submittedAt && kept.savedAt && Date.parse(listed.submittedAt) > kept.savedAt + 5_000) return null;
  return kept;
}

async function recentPayload(quizId, need) {
  const kept = keptRecent(quizId, need);
  if (kept) return kept;
  const response = await apiClient.get(`/student/quiz-attempts/recent/${quizId}/review`, {
    params: need === 'result' ? { part: 'result' } : undefined,
  });
  const data = response.data || {};
  const merged = { ...(readLocal(recentKey(quizId)) || {}), ...data, savedAt: Date.now() };
  writeLocal(recentKey(quizId), { result: merged.result, review: merged.review, savedAt: merged.savedAt });
  return data;
}

// The id is the quiz id: one recent result per quiz (10.16).
export async function fetchAttemptResult(attemptId) {
  return (await recentPayload(attemptId, 'result')).result;
}

export async function fetchAttemptReview(attemptId) {
  return (await recentPayload(attemptId, 'review')).review;
}

export async function completeAttemptReview(attemptId) {
  const local = readLocalSampleResults();
  if (local.some((r) => Number(r.quizId) === Number(attemptId))) {
    writeLocal(`${LOCAL_RESULTS_PREFIX}${userKey()}`, local.map((r) => (Number(r.quizId) === Number(attemptId) ? { ...r, reviewedAt: new Date().toISOString() } : r)));
    clearStudentResultsCache();
    return { attemptId: Number(attemptId), reviewed: true };
  }
  const response = await apiClient.post(`/student/quiz-attempts/recent/${attemptId}/reviewed`);
  clearStudentResultsCache();
  return { attemptId: Number(attemptId), reviewed: true, ...(response.data || {}) };
}

export async function fetchStudentResults() {
  return studentResultsCache.get();
}

export function readStudentResultsCache() {
  return studentResultsCache.peek();
}
