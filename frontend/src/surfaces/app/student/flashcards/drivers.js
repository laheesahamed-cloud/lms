import {
  getFlashcardQueue,
  submitFlashcardReviews,
  undoFlashcardReview,
  newReviewUid,
} from '../../../../shared/api/flashcards.api.js';
import { buildLocalQueue, gradeLocalCard, undoLocalCard } from '../../../../shared/flashcards/localStore.js';
import { enqueueReview } from '../../../../shared/flashcards/offlineQueue.js';

/**
 * A driver abstracts where review state lives, so ReviewSessionView is identical
 * for synced lesson decks and on-device personal decks.
 *   loadQueue() → Promise<card[]>
 *   grade(card, rating) → Promise (may resolve offline)
 *   undo(card) → Promise
 */

export function serverDriver(scope) {
  return {
    kind: 'server',
    async loadQueue() {
      const data = await getFlashcardQueue(scope.noteIds);
      return Array.isArray(data.cards) ? data.cards : [];
    },
    async grade(card, rating) {
      const review = { cardId: card.id, rating, reviewUid: newReviewUid(), reviewTime: new Date().toISOString() };
      try {
        await submitFlashcardReviews(review);
      } catch {
        // Offline / failed → queue for later sync; never block the study flow.
        enqueueReview(review);
      }
    },
    async undo(card) {
      try { await undoFlashcardReview(card.id); } catch { /* best effort */ }
    },
  };
}

export function localDriver(scope) {
  return {
    kind: 'local',
    async loadQueue() {
      return buildLocalQueue(scope.deckId);
    },
    async grade(card, rating) {
      gradeLocalCard(card.id, rating, new Date());
    },
    async undo(card) {
      undoLocalCard(card.id);
    },
  };
}
