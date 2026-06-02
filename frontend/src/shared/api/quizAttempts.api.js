import { apiClient } from './client.js';

const STUDENT_QUIZZES_CACHE_MS = 30_000;
const studentQuizLoadRequests = new Map();
let studentQuizzesCache = {
  data: null,
  timestamp: 0,
  promise: null,
};

function serializeParams(params = {}) {
  return Object.entries(params || {})
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}:${String(value)}`)
    .join('|');
}

export function clearStudentQuizzesCache() {
  studentQuizzesCache = {
    data: null,
    timestamp: 0,
    promise: null,
  };
}

export async function fetchStudentQuizzes() {
  const now = Date.now();
  if (studentQuizzesCache.data && now - studentQuizzesCache.timestamp < STUDENT_QUIZZES_CACHE_MS) {
    return studentQuizzesCache.data;
  }
  if (studentQuizzesCache.promise) {
    return studentQuizzesCache.promise;
  }

  studentQuizzesCache.promise = apiClient.get('/student/quiz-attempts/quizzes')
    .then((response) => {
      studentQuizzesCache = {
        data: response.data,
        timestamp: Date.now(),
        promise: null,
      };
      return response.data;
    })
    .catch((error) => {
      studentQuizzesCache.promise = null;
      throw error;
    });

  return studentQuizzesCache.promise;
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
  clearStudentQuizzesCache();
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
  clearStudentQuizzesCache();
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

export async function fetchPracticeReview(quizId, params) {
  const response = await apiClient.get(`/student/quiz-attempts/practice-review/${quizId}`, { params });
  return response.data;
}

export async function fetchStudentResults() {
  const response = await apiClient.get('/student/quiz-attempts/results');
  return response.data;
}
