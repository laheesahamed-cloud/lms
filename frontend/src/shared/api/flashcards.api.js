import { apiClient } from './client.js';

export async function fetchQuizCards(quizId) {
  const response = await apiClient.get(`/student/quizzes/${quizId}/cards`);
  return response.data;
}
