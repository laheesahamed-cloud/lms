import { Injectable } from '@nestjs/common';
import {
  fsrs,
  generatorParameters,
  createEmptyCard,
  Rating,
  State,
  type Card as FsrsCard,
  type FSRS,
  type FSRSParameters,
  type Grade,
} from 'ts-fsrs';

/**
 * Thin wrapper around the official `ts-fsrs` library. The FSRS math is NEVER
 * hand-rolled here — we only translate between our DB row shape and the
 * library's Card object, and expose the two operations the API needs:
 *   - preview()  → the next interval for all four grades (for the buttons)
 *   - apply()    → the new memory state after a grade is submitted
 *
 * Rating  : 1 Again · 2 Hard · 3 Good · 4 Easy  (matches ts-fsrs Rating enum)
 * State   : 0 New · 1 Learning · 2 Review · 3 Relearning  (matches ts-fsrs State)
 */

export interface FlashcardFsrsSettings {
  requestRetention: number; // desired retention, default 0.90
  maximumInterval: number;  // cap in days, default 36500
  enableFuzz: boolean;      // spread due dates, default true
  weights?: number[];       // FSRS params; undefined → library defaults
}

export const DEFAULT_FSRS_SETTINGS: FlashcardFsrsSettings = {
  requestRetention: 0.9,
  maximumInterval: 36500,
  enableFuzz: true,
};

/** Serializable card-memory state — mirrors the lesson_flashcard_reviews columns. */
export interface CardState {
  state: number;          // State enum
  due: string;            // ISO datetime
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  learningSteps: number;
  lastReview: string | null; // ISO datetime
}

export interface IntervalPreview {
  rating: number;         // 1..4
  intervalDays: number;   // scheduled days (0 for sub-day learning steps)
  intervalMinutes: number;// for sub-day steps
  dueIso: string;         // resulting due datetime
  label: string;          // e.g. "<10m", "4d", "3mo"
}

const GRADES: Grade[] = [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy];

@Injectable()
export class FlashcardSchedulerService {
  private cache = new Map<string, FSRS>();

  private engine(settings: FlashcardFsrsSettings): FSRS {
    const key = JSON.stringify(settings);
    let f = this.cache.get(key);
    if (!f) {
      const params: FSRSParameters = generatorParameters({
        request_retention: settings.requestRetention,
        maximum_interval: settings.maximumInterval,
        enable_fuzz: settings.enableFuzz,
        ...(settings.weights && settings.weights.length ? { w: settings.weights } : {}),
      });
      f = fsrs(params);
      this.cache.set(key, f);
    }
    return f;
  }

  /** Fresh, never-reviewed card state. */
  emptyState(now: Date = new Date()): CardState {
    return this.fromFsrs(createEmptyCard(now));
  }

  /** Apply one grade and return the new memory state. */
  apply(state: CardState, rating: number, reviewTime: Date, settings = DEFAULT_FSRS_SETTINGS): CardState {
    const grade = this.normalizeRating(rating);
    const { card } = this.engine(settings).next(this.toFsrs(state), reviewTime, grade);
    return this.fromFsrs(card);
  }

  /** Next interval for all four grades, computed from the card's CURRENT state. */
  preview(state: CardState, now: Date = new Date(), settings = DEFAULT_FSRS_SETTINGS): IntervalPreview[] {
    const f = this.engine(settings);
    const base = this.toFsrs(state);
    return GRADES.map((grade) => {
      const { card } = f.next(base, now, grade);
      const due = card.due instanceof Date ? card.due : new Date(card.due);
      const minutes = Math.max(0, Math.round((due.getTime() - now.getTime()) / 60000));
      return {
        rating: grade,
        intervalDays: Number(card.scheduled_days || 0),
        intervalMinutes: minutes,
        dueIso: due.toISOString(),
        label: this.formatInterval(minutes),
      };
    });
  }

  // ── translation helpers ───────────────────────────────────

  private normalizeRating(rating: number): Grade {
    const r = Number(rating);
    if (r === 1) return Rating.Again;
    if (r === 2) return Rating.Hard;
    if (r === 4) return Rating.Easy;
    return Rating.Good;
  }

  private toFsrs(state: CardState): FsrsCard {
    return {
      due: new Date(state.due),
      stability: Number(state.stability) || 0,
      difficulty: Number(state.difficulty) || 0,
      elapsed_days: Number(state.elapsedDays) || 0,
      scheduled_days: Number(state.scheduledDays) || 0,
      reps: Number(state.reps) || 0,
      lapses: Number(state.lapses) || 0,
      state: (Number(state.state) || 0) as State,
      learning_steps: Number(state.learningSteps) || 0,
      last_review: state.lastReview ? new Date(state.lastReview) : undefined,
    } as FsrsCard;
  }

  private fromFsrs(card: FsrsCard): CardState {
    const due = card.due instanceof Date ? card.due : new Date(card.due);
    const last = card.last_review
      ? (card.last_review instanceof Date ? card.last_review : new Date(card.last_review))
      : null;
    return {
      state: Number(card.state) || 0,
      due: due.toISOString(),
      stability: Number(card.stability) || 0,
      difficulty: Number(card.difficulty) || 0,
      elapsedDays: Number(card.elapsed_days) || 0,
      scheduledDays: Number(card.scheduled_days) || 0,
      reps: Number(card.reps) || 0,
      lapses: Number(card.lapses) || 0,
      learningSteps: Number((card as { learning_steps?: number }).learning_steps) || 0,
      lastReview: last ? last.toISOString() : null,
    };
  }

  /** Human label for a grade button: "<10m", "4d", "3mo", "2y". */
  private formatInterval(minutes: number): string {
    if (minutes < 60) return `${Math.max(1, minutes)}m`;
    const hours = minutes / 60;
    if (hours < 24) return `${Math.round(hours)}h`;
    const days = hours / 24;
    if (days < 30) return `${Math.round(days)}d`;
    const months = days / 30;
    if (months < 12) return `${Math.round(months)}mo`;
    return `${(days / 365).toFixed(days / 365 < 10 ? 1 : 0)}y`;
  }
}
