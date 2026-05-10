import { apiClient } from './client.js';

const AI_REQUEST_TIMEOUT_MS = 210000;

export async function generateAiQuiz(payload, options = {}) {
  const response = await apiClient.post('/ai/generate-quiz', payload, {
    timeout: AI_REQUEST_TIMEOUT_MS,
    params: {
      engine: options.engine || 'gemini',
    },
  });
  return response.data;
}

export async function beautifyLessonNotes(payload) {
  const response = await apiClient.post('/ai/beautify-lesson', payload, {
    timeout: AI_REQUEST_TIMEOUT_MS,
  });
  return response.data;
}

export async function generateWhyIncorrectExplanations(payload) {
  const response = await apiClient.post('/ai/generate-why-incorrect', payload, {
    timeout: AI_REQUEST_TIMEOUT_MS,
  });
  return response.data;
}

export async function generateQuestionExplanation(payload) {
  const response = await apiClient.post('/ai/generate-explanation', payload, {
    timeout: AI_REQUEST_TIMEOUT_MS,
  });
  return response.data;
}

export async function generateQuestionTheoryCard(payload) {
  const response = await apiClient.post('/ai/generate-theory-card', payload, {
    timeout: AI_REQUEST_TIMEOUT_MS,
  });
  return response.data;
}
