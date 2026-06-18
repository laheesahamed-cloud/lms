import { apiClient } from './client.js';
import { createTimedApiCache } from './cache.js';
import { claimBootSlice } from './bootChannel.js';
import { clearDashboardCache } from './dashboard.api.js';

const STUDENT_QUIZZES_CACHE_MS = 30_000;
const STUDENT_RESULTS_CACHE_MS = 15_000;
const STUDENT_PRACTICE_QUIZ_PAYLOAD_CACHE_MS = 60_000;
// Shared hosting can cold-boot the Node app on the first request after idle,
// which routinely takes longer than 12s. Allow more headroom (and let the
// client retry) so a cold start doesn't surface as "cannot reach API".
const STUDENT_QUIZ_PAYLOAD_TIMEOUT_MS = 25_000;
const studentQuizLoadRequests = new Map();
const studentQuizzesCache = createTimedApiCache({
  ttlMs: STUDENT_QUIZZES_CACHE_MS,
  persistKey: 'student.quizzes',
  load: async () =>
    (await claimBootSlice('quizzes')) ??
    apiClient.get('/student/quiz-attempts/quizzes').then((response) => response.data),
});

export const seedStudentQuizzes = (data) => studentQuizzesCache.seed(data);
const studentResultsCache = createTimedApiCache({
  ttlMs: STUDENT_RESULTS_CACHE_MS,
  persistKey: 'student.results',
  load: () => apiClient.get('/student/quiz-attempts/results').then((response) => response.data),
});

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

function hasUsefulValue(value) {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number' || typeof value === 'boolean') return true;
  if (Array.isArray(value)) return value.some(hasUsefulValue);
  if (typeof value === 'object') return Object.values(value).some(hasUsefulValue);
  return false;
}

function hasQuestionLearningPayload(question) {
  if (!question || typeof question !== 'object') return false;
  const answerKey = question.answerKey || question.answer_key || {};
  const hasAnswerPayload = hasUsefulValue(
    answerKey.correctOptions ||
    answerKey.correct_options ||
    answerKey.correctOptionIds ||
    answerKey.correct_option_ids ||
    answerKey.correctAnswer ||
    answerKey.correct_answer ||
    answerKey.answers ||
    answerKey.answer ||
    answerKey.statements ||
    question.correctOptions ||
    question.correct_options ||
    question.correctAnswer ||
    question.correct_answer
  ) ||
    (Array.isArray(question.options) ? question.options : []).some((option) => {
      if (!option || typeof option !== 'object') return false;
      return hasUsefulValue(
        option.isCorrect ??
        option.is_correct ??
        option.correct ??
        option.isCorrectAnswer ??
        option.is_correct_answer ??
        option.isAnswer ??
        option.is_answer ??
        option.correctAnswer ??
        option.correct_answer
      );
    });
  const hasLearningDetail = hasUsefulValue(question.explanation || question.explanationHtml || question.explanation_html || question.answerExplanation || question.answer_explanation) ||
    hasUsefulValue(question.answerRationale || question.answer_rationale || question.reviewExplanation || question.review_explanation || question.rationale) ||
    hasUsefulValue(question.solution || question.solutionText || question.solution_text || question.correctExplanation || question.correct_explanation) ||
    hasUsefulValue(question.theoryRecap || question.theory_recap || question.quickTheoryRecap || question.quick_theory_recap || question.recap || question.recapCard || question.recap_card) ||
    hasUsefulValue(question.keyPoints || question.key_points) ||
    (Array.isArray(question.options) ? question.options : []).some((option) => {
      if (!option || typeof option !== 'object') return false;
      return hasUsefulValue(
        option.whyIncorrect ||
        option.why_incorrect ||
        option.incorrectExplanation ||
        option.incorrect_explanation ||
        option.distractorExplanation ||
        option.distractor_explanation ||
        option.explanation ||
        option.rationale ||
        option.whyNot ||
        option.why_not ||
        option.reason
      );
    });
  return hasAnswerPayload && hasLearningDetail;
}

function isStrippedPracticeQuizPayload(payload) {
  const questions = Array.isArray(payload?.questions) ? payload.questions : [];
  if (!questions.length) return false;
  return questions.some((question) => !hasQuestionLearningPayload(question));
}

function isPracticeQuizParams(params = {}) {
  return String(params?.mode || 'practice').toLowerCase() === 'practice';
}

function normalizePracticeQuizParams(params = {}) {
  return { ...params, mode: 'practice' };
}

const studentPracticeQuizPayloadCache = createTimedApiCache({
  ttlMs: STUDENT_PRACTICE_QUIZ_PAYLOAD_CACHE_MS,
  persistKey: 'student.practiceQuizPayloads.v7',
  key: (quizId, params) => `${quizId}:${serializeParams(params)}`,
  load: fetchStudentQuizPayload,
  shouldStore: (payload) => !isStrippedPracticeQuizPayload(payload),
});

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

export async function loadStudentQuiz(quizId, params) {
  if (isPracticeQuizParams(params)) {
    const normalizedParams = normalizePracticeQuizParams(params);
    if (normalizedParams.refresh) {
      return fetchStudentQuizPayload(quizId, normalizedParams);
    }
    return studentPracticeQuizPayloadCache.get(quizId, normalizedParams);
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

export async function submitExam(quizId, payload) {
  const response = await apiClient.post(`/student/quiz-attempts/exam/${quizId}/submit`, payload);
  clearStudentQuizOutcomeCaches();
  return response.data;
}

export async function saveExamProgress(quizId, payload) {
  const response = await apiClient.post(`/student/quiz-attempts/exam/${quizId}/save`, payload, {
    __skipNetworkActivity: true,
    __suppressServerStatus: true,
  });
  return response.data;
}

export async function fetchAttemptResult(attemptId) {
  const response = await apiClient.get(`/student/quiz-attempts/result/${attemptId}`);
  return response.data;
}

export async function fetchAttemptReview(attemptId) {
  const response = await apiClient.get(`/student/quiz-attempts/review/${attemptId}`);
  return response.data;
}

export async function completeAttemptReview(attemptId) {
  const response = await apiClient.post(`/student/quiz-attempts/review/${attemptId}/complete`);
  clearStudentResultsCache();
  return response.data;
}

export async function fetchStudentResults() {
  return studentResultsCache.get();
}

export function readStudentResultsCache() {
  return studentResultsCache.peek();
}
