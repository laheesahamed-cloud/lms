import { fsrs, generatorParameters, createEmptyCard, Rating } from 'ts-fsrs';

/**
 * Client-side FSRS for student-created LOCAL cards (which have no server row).
 * Mirrors the backend FlashcardSchedulerService exactly so local and synced
 * cards behave identically. Synced lesson cards still schedule on the server —
 * this only runs for on-device decks.
 */

const DEFAULTS = { request_retention: 0.9, maximum_interval: 36500, enable_fuzz: true };
let engine = fsrs(generatorParameters(DEFAULTS));

export function configureFsrs(settings = {}) {
  engine = fsrs(generatorParameters({
    request_retention: settings.requestRetention ?? DEFAULTS.request_retention,
    maximum_interval: settings.maximumInterval ?? DEFAULTS.maximum_interval,
    enable_fuzz: settings.enableFuzz ?? DEFAULTS.enable_fuzz,
    ...(Array.isArray(settings.weights) && settings.weights.length ? { w: settings.weights } : {}),
  }));
}

const GRADES = [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy];

function toFsrs(state) {
  return {
    due: new Date(state.due),
    stability: state.stability || 0,
    difficulty: state.difficulty || 0,
    elapsed_days: state.elapsedDays || 0,
    scheduled_days: state.scheduledDays || 0,
    reps: state.reps || 0,
    lapses: state.lapses || 0,
    state: state.state || 0,
    learning_steps: state.learningSteps || 0,
    last_review: state.lastReview ? new Date(state.lastReview) : undefined,
  };
}

function fromFsrs(card) {
  const due = card.due instanceof Date ? card.due : new Date(card.due);
  const last = card.last_review ? (card.last_review instanceof Date ? card.last_review : new Date(card.last_review)) : null;
  return {
    state: Number(card.state) || 0,
    due: due.toISOString(),
    stability: Number(card.stability) || 0,
    difficulty: Number(card.difficulty) || 0,
    elapsedDays: Number(card.elapsed_days) || 0,
    scheduledDays: Number(card.scheduled_days) || 0,
    reps: Number(card.reps) || 0,
    lapses: Number(card.lapses) || 0,
    learningSteps: Number(card.learning_steps) || 0,
    lastReview: last ? last.toISOString() : null,
  };
}

function normalizeRating(rating) {
  const r = Number(rating);
  if (r === 1) return Rating.Again;
  if (r === 2) return Rating.Hard;
  if (r === 4) return Rating.Easy;
  return Rating.Good;
}

function formatInterval(minutes) {
  if (minutes < 60) return `${Math.max(1, minutes)}m`;
  const hours = minutes / 60;
  if (hours < 24) return `${Math.round(hours)}h`;
  const days = hours / 24;
  if (days < 30) return `${Math.round(days)}d`;
  const months = days / 30;
  if (months < 12) return `${Math.round(months)}mo`;
  return `${(days / 365).toFixed(days / 365 < 10 ? 1 : 0)}y`;
}

export function emptyState(now = new Date()) {
  return fromFsrs(createEmptyCard(now));
}

export function applyGrade(state, rating, reviewTime = new Date()) {
  const { card } = engine.next(toFsrs(state), reviewTime, normalizeRating(rating));
  return fromFsrs(card);
}

export function preview(state, now = new Date()) {
  const base = toFsrs(state);
  return GRADES.map((grade) => {
    const { card } = engine.next(base, now, grade);
    const due = card.due instanceof Date ? card.due : new Date(card.due);
    const minutes = Math.max(0, Math.round((due.getTime() - now.getTime()) / 60000));
    return { rating: Number(grade), intervalDays: Number(card.scheduled_days || 0), intervalMinutes: minutes, dueIso: due.toISOString(), label: formatInterval(minutes) };
  });
}
