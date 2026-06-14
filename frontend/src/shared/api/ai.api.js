import { apiClient } from './client.js';

const AI_REQUEST_TIMEOUT_MS = 210000;

export async function generateAiQuiz(payload, options = {}) {
  const {
    includeExplanations,
    includeWhyIncorrect,
    ...body
  } = payload || {};

  const response = await apiClient.post('/admin/ai/generate-quiz', body, {
    timeout: AI_REQUEST_TIMEOUT_MS,
    params: {
      engine: options.engine || 'gemini',
      includeExplanations: includeExplanations === undefined ? undefined : String(Boolean(includeExplanations)),
      includeWhyIncorrect: includeWhyIncorrect === undefined ? undefined : String(Boolean(includeWhyIncorrect)),
    },
  });
  return response.data;
}

export async function generateWhyIncorrectExplanations(payload) {
  const {
    questionType,
    ...body
  } = payload || {};

  const response = await apiClient.post('/admin/ai/generate-why-incorrect', body, {
    timeout: AI_REQUEST_TIMEOUT_MS,
    params: {
      questionType,
    },
  });
  return response.data;
}

export async function generateQuestionExplanation(payload) {
  const response = await apiClient.post('/admin/ai/generate-explanation', payload, {
    timeout: AI_REQUEST_TIMEOUT_MS,
  });
  return response.data;
}

export async function generateQuestionTheoryCard(payload) {
  const response = await apiClient.post('/admin/ai/generate-theory-card', payload, {
    timeout: AI_REQUEST_TIMEOUT_MS,
  });
  return response.data;
}
