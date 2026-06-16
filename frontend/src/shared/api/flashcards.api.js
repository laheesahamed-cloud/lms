import { apiClient } from './client.js';

/**
 * Anki-style FSRS flashcards. The server (lesson_flashcards content +
 * lesson_flashcard_reviews per-user state) is the source of truth for
 * scheduling. These helpers all hit the `/student/flashcards/*` gateway
 * routes, which authenticate and rewrite to the backend flashcards module.
 */

export function newReviewUid() {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch {
    /* fall through */
  }
  return `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export const getFlashcardDecks = () =>
  apiClient.get('/student/flashcards/decks').then((r) => r.data || { decks: [], totals: {} });

export const getFlashcardQueue = (noteIds, opts = {}) => {
  const params = { noteIds: (noteIds || []).join(',') };
  if (opts.limit != null) params.limit = opts.limit;
  if (opts.newLimit != null) params.newLimit = opts.newLimit;
  return apiClient.get('/student/flashcards/queue', { params }).then((r) => r.data || { cards: [], counts: {} });
};

// Accepts a single review object or an array. Each item:
// { cardId, rating (1-4), reviewUid, reviewTime (ISO) }.
export const submitFlashcardReviews = (reviews) => {
  const list = Array.isArray(reviews) ? reviews : [reviews];
  return apiClient.post('/student/flashcards/reviews', { reviews: list }).then((r) => r.data || { results: [] });
};

export const undoFlashcardReview = (cardId) =>
  apiClient.post('/student/flashcards/reviews/undo', { cardId }).then((r) => r.data);

export const setFlashcardFlags = (cardId, flags) =>
  apiClient.post(`/student/flashcards/cards/${cardId}/flags`, flags).then((r) => r.data);

export const getFlashcardStats = () =>
  apiClient.get('/student/flashcards/stats').then((r) => r.data || {});

export const getFlashcardSettings = () =>
  apiClient.get('/student/flashcards/settings').then((r) => r.data || {});

export const updateFlashcardSettings = (patch) =>
  apiClient.patch('/student/flashcards/settings', patch).then((r) => r.data || {});
