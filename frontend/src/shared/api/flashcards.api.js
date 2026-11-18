import { apiClient } from './client.js';
import { fetchSampleDeck, sampleCourses } from './samples.api.js';

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

// ── 10.21: the website shows FREE flashcard decks only, from the sample
// files (no database work); reviews of samples stay in the browser. ──
const slug = (v) => String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');

/** The free decks as the deck tree the page draws (course → subject → topic → lesson). */
export async function getFlashcardDecks() {
  const courses = await sampleCourses();
  const roots = [];
  const index = new Map();
  const node = (siblings, key, label, type, depth) => {
    let n = index.get(key);
    if (!n) {
      n = { key, label, type, depth, noteIds: [], newCount: 0, learningCount: 0, dueCount: 0, cardCount: 0, locked: false, appOnly: false, children: [] };
      index.set(key, n);
      siblings.push(n);
    }
    return n;
  };
  for (const course of courses) {
    for (const l of course.decks || []) {
      const cKey = `c:${course.id}`;
      const sKey = `${cKey}/s:${l.topicId ?? slug(l.topicName)}`;
      const tKey = `${sKey}/t:${l.subtopicId ?? slug(l.subtopicName)}`;
      const c = node(roots, cKey, course.courseTitle, 'course', 0);
      const sub = node(c.children, sKey, l.topicName || 'General subject', 'subject', 1);
      const top = node(sub.children, tKey, l.subtopicName || 'General topic', 'topic', 2);
      const les = node(top.children, `${tKey}/l:${l.id}`, l.lessonTitle || l.title, 'lesson', 3);
      const cards = Number(l.approvedFlashcardCount || 0);
      for (const n of [c, sub, top, les]) {
        n.noteIds.push(Number(l.id));
        n.newCount += cards;
        n.cardCount += cards;
      }
    }
  }
  return { decks: roots, totals: {} };
}

const NEW_CARD_PREVIEWS = [
  { rating: 1, intervalDays: 0, intervalMinutes: 1, label: '1m' },
  { rating: 2, intervalDays: 0, intervalMinutes: 5, label: '5m' },
  { rating: 3, intervalDays: 0, intervalMinutes: 10, label: '10m' },
  { rating: 4, intervalDays: 3, intervalMinutes: 4320, label: '3d' },
];

/** A free deck's cards, all new (samples keep no schedule). */
export async function getFlashcardQueue(noteIds) {
  const now = new Date().toISOString();
  const cards = [];
  for (const id of noteIds || []) {
    const deck = await fetchSampleDeck(id).catch(() => null);
    for (const card of deck?.flashcards || []) {
      cards.push({
        card: { id: card.id, noteId: card.noteId, lessonId: card.lessonId, question: card.question, answer: card.answer, sourceHint: card.sourceHint || '', imageUrls: card.imageUrls || [], imageUrl: card.imageUrl || '', imageFit: card.imageFit || 'contain' },
        state: 'new', due: now, previews: NEW_CARD_PREVIEWS.map((p) => ({ ...p, dueIso: now })),
      });
    }
  }
  return { cards, counts: { new: cards.length, learning: 0, due: 0 } };
}

// Samples are for trying: a review is kept in this browser, nothing is sent.
export const submitFlashcardReviews = async (reviews) => {
  const list = Array.isArray(reviews) ? reviews : [reviews];
  return { results: list.map((r) => ({ cardId: r.cardId, ok: true, local: true })) };
};

export const undoFlashcardReview = (cardId) =>
  apiClient.post('/student/flashcards/reviews/undo', { cardId }).then((r) => r.data);

export const getFlashcardStats = () =>
  apiClient.get('/student/flashcards/stats').then((r) => r.data || {});
