import { apiClient } from './client.js';

export async function fetchQuizCards(quizId) {
  const response = await apiClient.get(`/quizzes/${quizId}/cards`);
  return response.data;
}
