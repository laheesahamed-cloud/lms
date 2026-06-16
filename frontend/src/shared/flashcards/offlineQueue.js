import { submitFlashcardReviews } from '../api/flashcards.api.js';

/**
 * Offline review buffer for SYNCED lesson cards. When a grade can't reach the
 * server (offline / request failed), it's stored here and flushed on reconnect.
 * The backend dedupes by reviewUid, so a grade is never double-applied even if
 * a flush partially succeeds and retries. Local personal cards don't use this —
 * they're already on-device.
 */

const KEY = 'xfc.offline.reviews.v1';
let flushing = false;

function read() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* quota */ }
}

export function enqueueReview(review) {
  const list = read();
  // de-dupe by reviewUid so a re-enqueue (double tap, retry) stays idempotent
  if (!list.some((r) => r.reviewUid === review.reviewUid)) {
    list.push(review);
    write(list);
  }
}

export function pendingReviewCount() {
  return read().length;
}

export async function flushReviews() {
  if (flushing) return { flushed: 0, pending: read().length };
  const list = read();
  if (!list.length) return { flushed: 0, pending: 0 };
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { flushed: 0, pending: list.length };
  }
  flushing = true;
  try {
    await submitFlashcardReviews(list); // backend is idempotent on reviewUid
    write([]);
    return { flushed: list.length, pending: 0 };
  } catch {
    return { flushed: 0, pending: list.length };
  } finally {
    flushing = false;
  }
}

let started = false;
export function startOfflineSync() {
  if (started || typeof window === 'undefined') return;
  started = true;
  window.addEventListener('online', () => { flushReviews(); });
  // opportunistic flush on load
  flushReviews();
}
