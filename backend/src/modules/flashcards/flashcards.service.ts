import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { BadRequestException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { StudentCatalogueService } from '../courses/student-catalogue.service';
import { getScopeRows } from '../../common/auth/subscription-scope';
import { buildContentAccess, canOpenLesson, ScopeRowLike } from '../../common/auth/content-access';
import { isMobileAppClient } from '../../common/utils/mobile-client.util';
import { applyProgress, TODAY } from '../../common/utils/progress-write';
import { localDateKey } from '../xp/streak';
import { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { DATABASE_CONNECTION } from '../../database/database.tokens';
import { LessonsService } from '../lessons/lessons.service';
import {
  CardState,
  DEFAULT_FSRS_SETTINGS,
  FlashcardFsrsSettings,
  FlashcardSchedulerService,
} from './flashcard-scheduler.service';

const FSRS_SETTINGS_KEY = 'flashcard_fsrs';
const ENGINE_KEYS = ['gemini', 'openai'] as const;
const DEFAULT_NEW_PER_DAY = 20;
const DEFAULT_REVIEWS_PER_DAY = 200;
const QUEUE_HARD_CAP = 500;
const LOG_RETENTION = 200; // keep last N review-log entries per card in log_json

type ReviewRow = RowDataPacket & {
  id: number;
  user_id: number;
  card_id: number;
  state: number;
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  learning_steps: number;
  last_review: string | null;
  suspended: number;
  buried: number;
  log_json: string | null;
};

type CardContentRow = RowDataPacket & {
  id: number;
  note_id: number;
  lesson_id: number | null;
  question: string;
  answer: string;
  source_hint: string | null;
  image_url: string | null;
  image_fit: 'contain' | 'cover';
  sort_order: number;
};

interface LogEntry {
  uid: string;
  rating: number;
  ts: string;            // review_time ISO
  priorState: number;
  state: number;
  due: string;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
}

export interface ReviewInput {
  cardId: number;
  rating: number;        // 1..4
  reviewUid: string;     // client-generated idempotency key
  reviewTime: string;    // ISO; offline-safe (client clock)
}

@Injectable()
export class FlashcardsService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Pool,
    private readonly scheduler: FlashcardSchedulerService,
    private readonly aiNotes: LessonsService,
    @Optional() private readonly catalogue?: StudentCatalogueService,
  ) {}

  // ── settings (stored in system_settings, no new table) ─────

  // 10.23 F5/F7: the settings change only from the admin page — kept in memory
  // (cleared on save), so the cards request and the start-up reply read none.
  private settingsCache: (FlashcardFsrsSettings & { newPerDay: number; reviewsPerDay: number }) | null = null;

  async getSettings(): Promise<FlashcardFsrsSettings & { newPerDay: number; reviewsPerDay: number }> {
    if (this.settingsCache) return this.settingsCache;
    this.settingsCache = await this.readSettings();
    return this.settingsCache;
  }

  private async readSettings(): Promise<FlashcardFsrsSettings & { newPerDay: number; reviewsPerDay: number }> {
    const [rows] = await this.db.execute<RowDataPacket[]>(
      'SELECT setting_value FROM system_settings WHERE setting_key = ? LIMIT 1',
      [FSRS_SETTINGS_KEY],
    );
    let stored: Record<string, unknown> = {};
    try { stored = rows[0]?.setting_value ? JSON.parse(String(rows[0].setting_value)) : {}; } catch { stored = {}; }
    return {
      requestRetention: clampNumber(stored.requestRetention, 0.7, 0.99, DEFAULT_FSRS_SETTINGS.requestRetention),
      maximumInterval: clampNumber(stored.maximumInterval, 1, 36500, DEFAULT_FSRS_SETTINGS.maximumInterval),
      enableFuzz: stored.enableFuzz === undefined ? DEFAULT_FSRS_SETTINGS.enableFuzz : Boolean(stored.enableFuzz),
      weights: Array.isArray(stored.weights) && stored.weights.length ? (stored.weights as number[]) : undefined,
      newPerDay: clampNumber(stored.newPerDay, 0, 9999, DEFAULT_NEW_PER_DAY),
      reviewsPerDay: clampNumber(stored.reviewsPerDay, 0, 99999, DEFAULT_REVIEWS_PER_DAY),
    };
  }

  async updateSettings(patch: Record<string, unknown>) {
    this.settingsCache = null;
    const current = await this.readSettings();
    const next = {
      requestRetention: clampNumber(patch.requestRetention, 0.7, 0.99, current.requestRetention),
      maximumInterval: clampNumber(patch.maximumInterval, 1, 36500, current.maximumInterval),
      enableFuzz: patch.enableFuzz === undefined ? current.enableFuzz : Boolean(patch.enableFuzz),
      weights: Array.isArray(patch.weights) && patch.weights.length ? patch.weights : current.weights,
      newPerDay: clampNumber(patch.newPerDay, 0, 9999, current.newPerDay),
      reviewsPerDay: clampNumber(patch.reviewsPerDay, 0, 99999, current.reviewsPerDay),
    };
    await this.db.execute(
      `INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [FSRS_SETTINGS_KEY, JSON.stringify(next)],
    );
    return next;
  }

  private fsrsSettings(s: Awaited<ReturnType<FlashcardsService['getSettings']>>): FlashcardFsrsSettings {
    return {
      requestRetention: s.requestRetention,
      maximumInterval: s.maximumInterval,
      enableFuzz: s.enableFuzz,
      weights: s.weights,
    };
  }

  // ── deck list with live New / Learning / Due counts ────────

  async listDecks(userId: number, token: string, appClient?: string) {
    const notes = await this.loadAccessibleNotes(token, appClient, userId);
    const reviewByNote = await this.reviewCountsByNote(userId);
    const tree = buildDeckTree(notes, reviewByNote);
    const totals = tree.reduce(
      (acc, node) => {
        acc.newCount += node.newCount;
        acc.learningCount += node.learningCount;
        acc.dueCount += node.dueCount;
        return acc;
      },
      { newCount: 0, learningCount: 0, dueCount: 0 },
    );
    return { decks: tree, totals };
  }

  // ── phone-side flashcards (OPTIMIZE 10 step 5) ──────────────
  // The app keeps decks, cards and its own review progress on the phone. It
  // downloads a lesson's cards once (and again only when they change) and
  // imports the student's existing review history once.

  /** Cards of up to 50 lessons the student may open, with the current FSRS settings. */
  async cardsForLessons(userId: number, lessonIds: number[], appClient?: string) {
    const settings = await this.getSettings();
    const wanted = [...new Set(lessonIds.filter((id) => Number.isInteger(id) && id > 0))].slice(0, 50);
    if (!wanted.length || !this.catalogue) return { cards: [], settings };
    const [{ decks }, scopeRows] = await Promise.all([this.catalogue.get(), getScopeRows<ScopeRowLike>(this.db, userId)]);
    const access = buildContentAccess(scopeRows);
    const appOnlyBlocked = !isMobileAppClient(appClient);
    const deckById = new Map(decks.map((d) => [d.id, d]));
    const open = wanted.filter((id) => {
      const d = deckById.get(id);
      return d && canOpenLesson(access, { id: d.id, courseId: d.courseId, isFree: d.isFree }, appOnlyBlocked);
    });
    if (!open.length) return { cards: [], settings };
    // 10.23 F5: each lesson's cards are kept in memory and in a file, keyed by
    // the lesson's card stamp from the catalogue — a batch costs no database
    // work. Only lessons whose cards changed are read (one statement, by id).
    const cards: unknown[][] = [];
    const missing: number[] = [];
    for (const id of open) {
      const stamp = Number(deckById.get(id)?.stamp || 0);
      const kept = await this.keptCards(id, stamp);
      if (kept) cards.push(...kept);
      else missing.push(id);
    }
    if (missing.length) {
      const [rows] = await this.db.query<RowDataPacket[]>(
        `SELECT id, lesson_id, question, answer, source_hint, image_url, image_fit, sort_order
           FROM lesson_flashcards
          WHERE status = 'approved' AND lesson_id IN (?)`,
        [missing],
      );
      const byLesson = new Map<number, unknown[][]>(missing.map((id) => [id, []]));
      for (const r of rows) {
        // [id, lessonId, question, answer, sourceHint, imageUrls, imageFit, sortOrder]
        byLesson.get(Number(r.lesson_id))?.push([
          Number(r.id), Number(r.lesson_id), String(r.question || ''), String(r.answer || ''), String(r.source_hint || ''),
          parseImageUrls(r.image_url), r.image_fit === 'cover' ? 'cover' : 'contain', Number(r.sort_order) || 0,
        ]);
      }
      for (const [id, list] of byLesson) {
        cards.push(...list);
        await this.keepCards(id, Number(deckById.get(id)?.stamp || 0), list);
      }
    }
    return { settings, cards, lessonIds: open };
  }

  private readonly cardsMemory = new Map<number, { stamp: number; cards: unknown[][] }>();
  private readonly cardsDir = join(process.env.CACHE_DIR || join(process.cwd(), 'storage', 'cache'), 'flashcards');

  private async keptCards(lessonId: number, stamp: number): Promise<unknown[][] | null> {
    const hit = this.cardsMemory.get(lessonId);
    if (hit && hit.stamp === stamp) return hit.cards;
    try {
      const saved = JSON.parse(await readFile(join(this.cardsDir, `${lessonId}.json`), 'utf8'));
      if (Number(saved?.stamp) === stamp && Array.isArray(saved.cards)) {
        this.cardsMemory.set(lessonId, { stamp, cards: saved.cards });
        return saved.cards;
      }
    } catch { /* not kept yet */ }
    return null;
  }

  private async keepCards(lessonId: number, stamp: number, cards: unknown[][]) {
    this.cardsMemory.set(lessonId, { stamp, cards });
    try {
      await mkdir(this.cardsDir, { recursive: true });
      const file = join(this.cardsDir, `${lessonId}.json`);
      await writeFile(`${file}.tmp`, JSON.stringify({ stamp, cards }));
      await rename(`${file}.tmp`, file);
    } catch { /* memory copy still serves */ }
  }

  /** The student's existing review states, read by user id (imported once by the app). */
  /** 10.37: progress is phone-only; older app builds get an empty history. */
  async exportReviews(_userId: number) {
    return { settings: await this.getSettings(), reviews: [] as unknown[] };
  }

  // ── review queue for a deck scope ──────────────────────────

  async getQueue(userId: number, token: string, params: { noteIds: number[]; limit?: number; newLimit?: number }, appClient?: string) {
    const settings = await this.getSettings();
    const fsrs = this.fsrsSettings(settings);
    const accessibleNoteIds = new Set((await this.loadAccessibleNotes(token, appClient, userId)).filter((n) => n.canAccess).map((n) => n.id));
    const noteIds = params.noteIds.filter((id) => accessibleNoteIds.has(id));
    if (!noteIds.length) return { cards: [], counts: { new: 0, learning: 0, due: 0 } };

    const cards = await this.loadCards(noteIds);
    const reviews = await this.loadReviewRows(userId, cards.map((c) => c.id));
    const now = new Date();
    const newLimit = params.newLimit ?? settings.newPerDay;
    const reviewLimit = Math.min(params.limit ?? settings.reviewsPerDay, QUEUE_HARD_CAP);

    const buckets = { learning: [] as QueueItem[], due: [] as QueueItem[], fresh: [] as QueueItem[] };
    for (const card of cards) {
      const row = reviews.get(card.id);
      if (row && (row.suspended || row.buried)) continue;
      const state = row ? rowToState(row) : this.scheduler.emptyState(now);
      const isNew = !row;
      const dueTime = new Date(state.due).getTime();
      const item: QueueItem = {
        card: mapCardContent(card),
        state: isNew ? 'new' : stateName(state.state),
        due: state.due,
        previews: this.scheduler.preview(state, now, fsrs),
      };
      if (isNew) buckets.fresh.push(item);
      else if ((state.state === 1 || state.state === 3) && dueTime <= now.getTime()) buckets.learning.push(item);
      // Due = Review-state cards only (state 2), matching reviewCountsByNote so
      // the deck-list "Due" count and the actual session queue never disagree.
      else if (state.state === 2 && dueTime <= endOfDay(now).getTime()) buckets.due.push(item);
    }

    buckets.learning.sort((a, b) => Date.parse(a.due) - Date.parse(b.due));
    buckets.due.sort((a, b) => Date.parse(a.due) - Date.parse(b.due));
    // ordering: learning due → review due → new (Anki-style)
    const queue = [
      ...buckets.learning,
      ...buckets.due.slice(0, reviewLimit),
      ...buckets.fresh.slice(0, Math.max(0, newLimit)),
    ];
    return {
      cards: queue,
      counts: { new: buckets.fresh.length, learning: buckets.learning.length, due: buckets.due.length },
    };
  }

  // ── submit reviews (single or batch, idempotent) ───────────

  async submitReviews(userId: number, items: ReviewInput[]) {
    if (!items.length) throw new BadRequestException('No reviews to submit.');
    const settings = await this.getSettings();
    const fsrs = this.fsrsSettings(settings);
    const cardIds = [...new Set(items.map((i) => i.cardId))];
    const validIds = await this.validCardIds(cardIds);
    const results: Array<{ cardId: number; applied: boolean; state: CardState; previews: ReturnType<FlashcardSchedulerService['preview']> }> = [];

    // group by card so multiple offline grades on one card apply in order
    const byCard = new Map<number, ReviewInput[]>();
    for (const item of items) {
      if (!validIds.has(item.cardId)) continue;
      const list = byCard.get(item.cardId) || [];
      list.push(item);
      byCard.set(item.cardId, list);
    }

    for (const [cardId, cardItems] of byCard) {
      cardItems.sort((a, b) => Date.parse(a.reviewTime) - Date.parse(b.reviewTime));
      const existing = (await this.loadReviewRows(userId, [cardId])).get(cardId);
      let state = existing ? rowToState(existing) : this.scheduler.emptyState(new Date(cardItems[0].reviewTime));
      let log: LogEntry[] = parseLog(existing?.log_json);
      const seen = new Set(log.map((e) => e.uid));
      let applied = false;

      for (const item of cardItems) {
        if (seen.has(item.reviewUid)) continue; // idempotent — never double-apply
        const reviewTime = new Date(item.reviewTime);
        const prior = state.state;
        state = this.scheduler.apply(state, item.rating, reviewTime, fsrs);
        log.push({
          uid: item.reviewUid,
          rating: this.normalizeRating(item.rating),
          ts: reviewTime.toISOString(),
          priorState: prior,
          state: state.state,
          due: state.due,
          stability: state.stability,
          difficulty: state.difficulty,
          elapsedDays: state.elapsedDays,
          scheduledDays: state.scheduledDays,
          reps: state.reps,
          lapses: state.lapses,
        });
        seen.add(item.reviewUid);
        applied = true;
      }

      if (applied) {
        if (log.length > LOG_RETENTION) log = log.slice(log.length - LOG_RETENTION);
        await this.upsertState(userId, cardId, state, log);
      }
      results.push({ cardId, applied, state, previews: this.scheduler.preview(state, new Date(), fsrs) });
    }

    // 10.30: today's goals are counted on the phone; anything that rode along
    // (practices, a day-done mark) is applied in one statement.
    await applyProgress(this.db, userId, localDateKey(new Date()));
    return { results };
  }

  // ── undo last review for a card ────────────────────────────

  async undo(_userId: number, cardId: number) {
    // 10.37: nothing is stored on the server, so there is nothing to undo here.
    return { cardId, reverted: false, state: null };
  }

  // ── suspend / bury / reset ─────────────────────────────────

  async setCardFlags(userId: number, cardId: number, flags: { suspended?: boolean; buried?: boolean }) {
    if (!(await this.validCardIds([cardId])).has(cardId)) throw new NotFoundException('Card not found.');
    const existing = (await this.loadReviewRows(userId, [cardId])).get(cardId);
    const state = existing ? rowToState(existing) : this.scheduler.emptyState(new Date());
    const log = parseLog(existing?.log_json);
    await this.upsertState(userId, cardId, state, log, {
      suspended: flags.suspended ?? Boolean(existing?.suspended),
      buried: flags.buried ?? Boolean(existing?.buried),
    });
    return { cardId, ...flags };
  }

  // ── stats ──────────────────────────────────────────────────

  async stats(userId: number) {
    void userId; // 10.37: no server-side review history any more
    const rows: ReviewRow[] = [];
    const now = new Date();
    const byState = { new: 0, learning: 0, review: 0, relearning: 0 };
    const forecast: Record<string, number> = {};
    const perDay: Record<string, number> = {};
    let mature = 0;
    let young = 0;
    let totalReviews = 0;
    let goodOrBetter = 0;

    for (const row of rows) {
      const s = stateName(row.state);
      byState[s] += 1;
      if (row.state === 2) {
        if (Number(row.scheduled_days) >= 21) mature += 1; else young += 1;
        const key = dayKey(new Date(row.due));
        forecast[key] = (forecast[key] || 0) + 1;
      }
      for (const entry of parseLog(row.log_json)) {
        totalReviews += 1;
        if (entry.rating >= 3) goodOrBetter += 1;
        const k = dayKey(new Date(entry.ts));
        perDay[k] = (perDay[k] || 0) + 1;
      }
    }

    return {
      counts: byState,
      mature,
      young,
      totalReviews,
      retention: totalReviews ? Math.round((goodOrBetter / totalReviews) * 1000) / 10 : null,
      reviewsPerDay: toSeries(perDay),
      dueForecast: toSeries(forecast).filter((d) => d.date >= dayKey(now)).slice(0, 30),
    };
  }

  // ── private data helpers ───────────────────────────────────

  private normalizeRating(rating: number) {
    const r = Number(rating);
    return r === 1 || r === 2 || r === 4 ? r : 3;
  }

  /**
   * Lessons with approved flashcards and whether this student may open them.
   * From the shared catalogue (built once per content version, with the card
   * counts) and the student's plan scope (from the signed token): 0 rows here.
   * It used to build the whole lesson list for two engines (≈ 9,000 rows).
   */
  private async loadAccessibleNotes(token: string, appClient?: string, userId?: number) {
    if (this.catalogue && userId) {
      const [{ decks }, scopeRows] = await Promise.all([
        this.catalogue.get(),
        getScopeRows<ScopeRowLike>(this.db, userId),
      ]);
      const access = buildContentAccess(scopeRows);
      const appOnlyBlocked = !isMobileAppClient(appClient);
      return decks.map((d) => {
        const canAccess = canOpenLesson(access, { id: d.id, courseId: d.courseId, isFree: d.isFree }, appOnlyBlocked);
        return normalizeNote({
          id: d.id, engineKey: 'gemini', courseId: d.courseId, topicId: d.topicId, subtopicId: d.subtopicId, lessonId: d.id,
          courseTitle: d.courseTitle, topicName: d.topicName, subtopicName: d.subtopicName, lessonTitle: d.lessonTitle,
          approvedFlashcardCount: d.approvedFlashcardCount, canAccess,
          appOnly: !canAccess && !d.isFree && appOnlyBlocked,
        });
      });
    }
    const lists = await Promise.all(ENGINE_KEYS.map((engine) => this.aiNotes.canvasStudentList(token, engine, appClient)));
    const merged = new Map<number, ReturnType<typeof normalizeNote>>();
    for (const list of lists) {
      for (const note of list) {
        const normalized = normalizeNote(note);
        if (normalized.approvedFlashcardCount <= 0) continue;
        const prev = merged.get(normalized.id);
        if (!prev || (!prev.canAccess && normalized.canAccess)) merged.set(normalized.id, normalized);
      }
    }
    return [...merged.values()];
  }

  private async reviewCountsByNote(_userId: number) {
    return new Map<number, { reviewed: number; learning: number; due: number }>();
  }

  private async loadCards(noteIds: number[]): Promise<CardContentRow[]> {
    if (!noteIds.length) return [];
    const placeholders = noteIds.map(() => '?').join(',');
    const [rows] = await this.db.execute<CardContentRow[]>(
      `SELECT id, note_id, lesson_id, question, answer, source_hint, image_url, image_fit, sort_order
       FROM lesson_flashcards
       WHERE status = 'approved' AND note_id IN (${placeholders})
       ORDER BY sort_order ASC, id ASC`,
      noteIds,
    );
    return rows;
  }

  // 10.37: card progress lives on the phone only; the old per-card review
  // table is gone. Endpoints still answered for older app builds / the website
  // behave as if nothing was reviewed yet, and nothing is stored.
  private async loadReviewRows(_userId: number, _cardIds: number[]): Promise<Map<number, ReviewRow>> {
    return new Map();
  }

  private async validCardIds(cardIds: number[]): Promise<Set<number>> {
    if (!cardIds.length) return new Set();
    const placeholders = cardIds.map(() => '?').join(',');
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT id FROM lesson_flashcards WHERE status = 'approved' AND id IN (${placeholders})`,
      cardIds,
    );
    return new Set(rows.map((r) => Number(r.id)));
  }

  private async upsertState(
    _userId: number,
    _cardId: number,
    _state: CardState,
    _log: LogEntry[],
    _flags: { suspended?: boolean; buried?: boolean } = {},
  ) {
    // 10.37: not stored on the server any more.
  }
}

// ── module-level pure helpers ────────────────────────────────

export interface QueueItem {
  card: ReturnType<typeof mapCardContent>;
  state: string;
  due: string;
  previews: ReturnType<FlashcardSchedulerService['preview']>;
}

function normalizeNote(note: any) {
  return {
    id: Number(note.id),
    engineKey: String(note.engineKey || 'gemini'),
    courseId: note.courseId ?? null,
    topicId: note.topicId ?? null,
    subtopicId: note.subtopicId ?? null,
    lessonId: note.lessonId ?? null,
    courseTitle: String(note.courseTitle || 'General'),
    topicName: String(note.topicName || note.subjectTitle || 'General subject'),
    subtopicName: String(note.subtopicName || 'General topic'),
    lessonTitle: String(note.lessonTitle || note.title || 'Untitled lesson'),
    approvedFlashcardCount: Math.max(0, Number(note.approvedFlashcardCount || 0)),
    canAccess: Boolean(note.canAccess),
    appOnly: Boolean(note.appOnly),
  };
}

export interface DeckNode {
  key: string;
  label: string;
  type: 'course' | 'subject' | 'topic' | 'lesson';
  depth: number;
  noteIds: number[];
  newCount: number;
  learningCount: number;
  dueCount: number;
  cardCount: number;
  locked: boolean;
  appOnly: boolean;
  children: DeckNode[];
}

function buildDeckTree(notes: ReturnType<typeof normalizeNote>[], reviewByNote: Map<number, { reviewed: number; learning: number; due: number }>): DeckNode[] {
  const roots: DeckNode[] = [];
  const index = new Map<string, DeckNode>();

  const getNode = (parent: DeckNode[] | DeckNode, key: string, label: string, type: DeckNode['type'], depth: number) => {
    const siblings = Array.isArray(parent) ? parent : parent.children;
    let node = index.get(key);
    if (!node) {
      node = { key, label, type, depth, noteIds: [], newCount: 0, learningCount: 0, dueCount: 0, cardCount: 0, locked: false, appOnly: false, children: [] };
      index.set(key, node);
      siblings.push(node);
    }
    return node;
  };

  for (const note of notes) {
    const review = reviewByNote.get(note.id) || { reviewed: 0, learning: 0, due: 0 };
    const newCount = Math.max(0, note.approvedFlashcardCount - review.reviewed);
    const cKey = `c:${note.courseId ?? slug(note.courseTitle)}`;
    const sKey = `${cKey}/s:${note.topicId ?? slug(note.topicName)}`;
    const tKey = `${sKey}/t:${note.subtopicId ?? slug(note.subtopicName)}`;
    const lKey = `${tKey}/l:${note.lessonId ?? note.id}`;
    const course = getNode(roots, cKey, note.courseTitle, 'course', 0);
    const subject = getNode(course, sKey, note.topicName, 'subject', 1);
    const topic = getNode(subject, tKey, note.subtopicName, 'topic', 2);
    const lesson = getNode(topic, lKey, note.lessonTitle, 'lesson', 3);

    for (const node of [course, subject, topic, lesson]) {
      node.noteIds.push(note.id);
      node.newCount += newCount;
      node.learningCount += review.learning;
      node.dueCount += review.due;
      node.cardCount += note.approvedFlashcardCount;
      if (!note.canAccess) node.locked = true;
      if (note.appOnly) node.appOnly = true;
    }
  }

  // de-dupe noteIds collected at each level
  index.forEach((node) => { node.noteIds = [...new Set(node.noteIds)]; });
  return roots;
}

function mapCardContent(row: CardContentRow) {
  const imageUrls = parseImageUrls(row.image_url);
  return {
    id: row.id,
    noteId: row.note_id,
    lessonId: row.lesson_id ?? null,
    question: row.question,
    answer: row.answer,
    sourceHint: row.source_hint || '',
    imageUrls,
    imageUrl: imageUrls[0] || '',
    imageFit: row.image_fit === 'cover' ? 'cover' : 'contain',
  };
}

function rowToState(row: ReviewRow): CardState {
  return {
    state: Number(row.state) || 0,
    due: new Date(row.due).toISOString(),
    stability: Number(row.stability) || 0,
    difficulty: Number(row.difficulty) || 0,
    elapsedDays: Number(row.elapsed_days) || 0,
    scheduledDays: Number(row.scheduled_days) || 0,
    reps: Number(row.reps) || 0,
    lapses: Number(row.lapses) || 0,
    learningSteps: Number(row.learning_steps) || 0,
    lastReview: row.last_review ? new Date(row.last_review).toISOString() : null,
  };
}

function parseLog(raw: string | null | undefined): LogEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseImageUrls(value: string | null): string[] {
  if (!value) return [];
  const trimmed = value.trim();
  if (trimmed.startsWith('[')) {
    try {
      const arr = JSON.parse(trimmed);
      return Array.isArray(arr) ? arr.map(String).filter(Boolean).slice(0, 3) : [];
    } catch {
      return [];
    }
  }
  return [trimmed];
}

function stateName(state: number): 'new' | 'learning' | 'review' | 'relearning' {
  if (state === 1) return 'learning';
  if (state === 2) return 'review';
  if (state === 3) return 'relearning';
  return 'new';
}

function slug(value: string) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'x';
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toSeries(map: Record<string, number>) {
  return Object.entries(map)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

function toMysqlDateTime(iso: string): string {
  return new Date(iso).toISOString().slice(0, 19).replace('T', ' ');
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
