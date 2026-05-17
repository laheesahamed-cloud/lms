import { apiClient } from './client.js';

export async function fetchStudentQuizzes() {
  const response = await apiClient.get('/student/quiz-attempts/quizzes');
  return response.data;
}

export async function loadStudentQuiz(quizId, params) {
  const response = await apiClient.get(`/student/quiz-attempts/quiz/${quizId}`, { params });
  return response.data;
}

export async function savePracticeAnswer(quizId, payload) {
  const response = await apiClient.post(`/student/quiz-attempts/practice/${quizId}/save`, payload);
  return response.data;
}

export async function submitExam(quizId, payload) {
  const response = await apiClient.post(`/student/quiz-attempts/exam/${quizId}/submit`, payload);
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
