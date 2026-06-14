import { apiClient } from './client.js';
import { createTimedApiCache } from './cache.js';
import { claimBootSlice } from './bootChannel.js';
import { clearDashboardCache } from './dashboard.api.js';

const STUDENT_QUIZZES_CACHE_MS = 30_000;
const STUDENT_RESULTS_CACHE_MS = 15_000;
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
  const key = `${quizId}:${serializeParams(params)}`;
  if (studentQuizLoadRequests.has(key)) {
    return studentQuizLoadRequests.get(key);
  }

  const request = apiClient.get(`/student/quiz-attempts/quiz/${quizId}`, { params })
    .then((response) => response.data)
    .finally(() => {
      studentQuizLoadRequests.delete(key);
    });
  studentQuizLoadRequests.set(key, request);
  return request;
}

export async function savePracticeAnswer(quizId, payload) {
  const response = await apiClient.post(`/student/quiz-attempts/practice/${quizId}/save`, payload);
  clearStudentQuizzesCache();
  return response.data;
}

export async function savePracticeDraft(quizId, payload) {
  const response = await apiClient.post(`/student/quiz-attempts/practice/${quizId}/draft`, payload);
  clearStudentQuizzesCache();
  return response.data;
}

export async function finishPracticeAttempt(quizId, payload) {
  const response = await apiClient.post(`/student/quiz-attempts/practice/${quizId}/finish`, payload);
  clearStudentQuizOutcomeCaches();
  return response.data;
}

export async function prewarmPracticeAnswer(quizId, questionId) {
  const response = await apiClient.post(`/student/quiz-attempts/practice/${quizId}/answer/${questionId}/prewarm`);
  return response.data;
}

export async function revealPracticeAnswer(quizId, questionId) {
  const response = await apiClient.get(`/student/quiz-attempts/practice/${quizId}/answer/${questionId}/reveal`);
  return response.data;
}

export async function submitExam(quizId, payload) {
  const response = await apiClient.post(`/student/quiz-attempts/exam/${quizId}/submit`, payload);
  clearStudentQuizOutcomeCaches();
  return response.data;
}

export async function saveExamProgress(quizId, payload) {
  const response = await apiClient.post(`/student/quiz-attempts/exam/${quizId}/save`, payload);
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

export async function fetchPracticeReview(quizId, params) {
  const response = await apiClient.get(`/student/quiz-attempts/practice-review/${quizId}`, { params });
  return response.data;
}

export async function fetchStudentResults() {
  return studentResultsCache.get();
}

export function readStudentResultsCache() {
  return studentResultsCache.peek();
}
