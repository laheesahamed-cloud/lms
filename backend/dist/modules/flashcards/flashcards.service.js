"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FlashcardsService = void 0;
const common_1 = require("@nestjs/common");
const database_tokens_1 = require("../../database/database.tokens");
const lessons_service_1 = require("../lessons/lessons.service");
const flashcard_scheduler_service_1 = require("./flashcard-scheduler.service");
const FSRS_SETTINGS_KEY = 'flashcard_fsrs';
const ENGINE_KEYS = ['gemini', 'openai'];
const DEFAULT_NEW_PER_DAY = 20;
const DEFAULT_REVIEWS_PER_DAY = 200;
const QUEUE_HARD_CAP = 500;
const LOG_RETENTION = 200;
let FlashcardsService = class FlashcardsService {
    constructor(db, scheduler, aiNotes) {
        this.db = db;
        this.scheduler = scheduler;
        this.aiNotes = aiNotes;
    }
    async getSettings() {
        const [rows] = await this.db.execute('SELECT setting_value FROM system_settings WHERE setting_key = ? LIMIT 1', [FSRS_SETTINGS_KEY]);
        let stored = {};
        try {
            stored = rows[0]?.setting_value ? JSON.parse(String(rows[0].setting_value)) : {};
        }
        catch {
            stored = {};
        }
        return {
            requestRetention: clampNumber(stored.requestRetention, 0.7, 0.99, flashcard_scheduler_service_1.DEFAULT_FSRS_SETTINGS.requestRetention),
            maximumInterval: clampNumber(stored.maximumInterval, 1, 36500, flashcard_scheduler_service_1.DEFAULT_FSRS_SETTINGS.maximumInterval),
            enableFuzz: stored.enableFuzz === undefined ? flashcard_scheduler_service_1.DEFAULT_FSRS_SETTINGS.enableFuzz : Boolean(stored.enableFuzz),
            weights: Array.isArray(stored.weights) && stored.weights.length ? stored.weights : undefined,
            newPerDay: clampNumber(stored.newPerDay, 0, 9999, DEFAULT_NEW_PER_DAY),
            reviewsPerDay: clampNumber(stored.reviewsPerDay, 0, 99999, DEFAULT_REVIEWS_PER_DAY),
        };
    }
    async updateSettings(patch) {
        const current = await this.getSettings();
        const next = {
            requestRetention: clampNumber(patch.requestRetention, 0.7, 0.99, current.requestRetention),
            maximumInterval: clampNumber(patch.maximumInterval, 1, 36500, current.maximumInterval),
            enableFuzz: patch.enableFuzz === undefined ? current.enableFuzz : Boolean(patch.enableFuzz),
            weights: Array.isArray(patch.weights) && patch.weights.length ? patch.weights : current.weights,
            newPerDay: clampNumber(patch.newPerDay, 0, 9999, current.newPerDay),
            reviewsPerDay: clampNumber(patch.reviewsPerDay, 0, 99999, current.reviewsPerDay),
        };
        await this.db.execute(`INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`, [FSRS_SETTINGS_KEY, JSON.stringify(next)]);
        return next;
    }
    fsrsSettings(s) {
        return {
            requestRetention: s.requestRetention,
            maximumInterval: s.maximumInterval,
            enableFuzz: s.enableFuzz,
            weights: s.weights,
        };
    }
    async listDecks(userId, token, appClient) {
        const notes = await this.loadAccessibleNotes(token, appClient);
        const reviewByNote = await this.reviewCountsByNote(userId);
        const tree = buildDeckTree(notes, reviewByNote);
        const totals = tree.reduce((acc, node) => {
            acc.newCount += node.newCount;
            acc.learningCount += node.learningCount;
            acc.dueCount += node.dueCount;
            return acc;
        }, { newCount: 0, learningCount: 0, dueCount: 0 });
        return { decks: tree, totals };
    }
    async getQueue(userId, token, params, appClient) {
        const settings = await this.getSettings();
        const fsrs = this.fsrsSettings(settings);
        const accessibleNoteIds = new Set((await this.loadAccessibleNotes(token, appClient)).filter((n) => n.canAccess).map((n) => n.id));
        const noteIds = params.noteIds.filter((id) => accessibleNoteIds.has(id));
        if (!noteIds.length)
            return { cards: [], counts: { new: 0, learning: 0, due: 0 } };
        const cards = await this.loadCards(noteIds);
        const reviews = await this.loadReviewRows(userId, cards.map((c) => c.id));
        const now = new Date();
        const newLimit = params.newLimit ?? settings.newPerDay;
        const reviewLimit = Math.min(params.limit ?? settings.reviewsPerDay, QUEUE_HARD_CAP);
        const buckets = { learning: [], due: [], fresh: [] };
        for (const card of cards) {
            const row = reviews.get(card.id);
            if (row && (row.suspended || row.buried))
                continue;
            const state = row ? rowToState(row) : this.scheduler.emptyState(now);
            const isNew = !row;
            const dueTime = new Date(state.due).getTime();
            const item = {
                card: mapCardContent(card),
                state: isNew ? 'new' : stateName(state.state),
                due: state.due,
                previews: this.scheduler.preview(state, now, fsrs),
            };
            if (isNew)
                buckets.fresh.push(item);
            else if ((state.state === 1 || state.state === 3) && dueTime <= now.getTime())
                buckets.learning.push(item);
            else if (state.state === 2 && dueTime <= endOfDay(now).getTime())
                buckets.due.push(item);
        }
        buckets.learning.sort((a, b) => Date.parse(a.due) - Date.parse(b.due));
        buckets.due.sort((a, b) => Date.parse(a.due) - Date.parse(b.due));
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
    async submitReviews(userId, items) {
        if (!items.length)
            throw new common_1.BadRequestException('No reviews to submit.');
        const settings = await this.getSettings();
        const fsrs = this.fsrsSettings(settings);
        const cardIds = [...new Set(items.map((i) => i.cardId))];
        const validIds = await this.validCardIds(cardIds);
        const results = [];
        const byCard = new Map();
        for (const item of items) {
            if (!validIds.has(item.cardId))
                continue;
            const list = byCard.get(item.cardId) || [];
            list.push(item);
            byCard.set(item.cardId, list);
        }
        for (const [cardId, cardItems] of byCard) {
            cardItems.sort((a, b) => Date.parse(a.reviewTime) - Date.parse(b.reviewTime));
            const existing = (await this.loadReviewRows(userId, [cardId])).get(cardId);
            let state = existing ? rowToState(existing) : this.scheduler.emptyState(new Date(cardItems[0].reviewTime));
            let log = parseLog(existing?.log_json);
            const seen = new Set(log.map((e) => e.uid));
            let applied = false;
            for (const item of cardItems) {
                if (seen.has(item.reviewUid))
                    continue;
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
                if (log.length > LOG_RETENTION)
                    log = log.slice(log.length - LOG_RETENTION);
                await this.upsertState(userId, cardId, state, log);
            }
            results.push({ cardId, applied, state, previews: this.scheduler.preview(state, new Date(), fsrs) });
        }
        return { results };
    }
    async undo(userId, cardId) {
        const existing = (await this.loadReviewRows(userId, [cardId])).get(cardId);
        if (!existing)
            throw new common_1.NotFoundException('Nothing to undo for this card.');
        const log = parseLog(existing.log_json);
        if (!log.length) {
            await this.db.execute('DELETE FROM lesson_flashcard_reviews WHERE user_id = ? AND card_id = ?', [userId, cardId]);
            return { cardId, reverted: true, state: null };
        }
        log.pop();
        if (!log.length) {
            await this.db.execute('DELETE FROM lesson_flashcard_reviews WHERE user_id = ? AND card_id = ?', [userId, cardId]);
            return { cardId, reverted: true, state: null };
        }
        const last = log[log.length - 1];
        const state = {
            state: last.state,
            due: last.due,
            stability: last.stability,
            difficulty: last.difficulty,
            elapsedDays: last.elapsedDays,
            scheduledDays: last.scheduledDays,
            reps: last.reps,
            lapses: last.lapses,
            learningSteps: 0,
            lastReview: last.ts,
        };
        await this.upsertState(userId, cardId, state, log);
        return { cardId, reverted: true, state };
    }
    async setCardFlags(userId, cardId, flags) {
        if (!(await this.validCardIds([cardId])).has(cardId))
            throw new common_1.NotFoundException('Card not found.');
        const existing = (await this.loadReviewRows(userId, [cardId])).get(cardId);
        const state = existing ? rowToState(existing) : this.scheduler.emptyState(new Date());
        const log = parseLog(existing?.log_json);
        await this.upsertState(userId, cardId, state, log, {
            suspended: flags.suspended ?? Boolean(existing?.suspended),
            buried: flags.buried ?? Boolean(existing?.buried),
        });
        return { cardId, ...flags };
    }
    async stats(userId) {
        const [rows] = await this.db.execute(`SELECT lfr.* FROM lesson_flashcard_reviews lfr
       JOIN lesson_flashcards lf ON lf.id = lfr.card_id AND lf.status = 'approved'
       WHERE lfr.user_id = ?`, [userId]);
        const now = new Date();
        const byState = { new: 0, learning: 0, review: 0, relearning: 0 };
        const forecast = {};
        const perDay = {};
        let mature = 0;
        let young = 0;
        let totalReviews = 0;
        let goodOrBetter = 0;
        for (const row of rows) {
            const s = stateName(row.state);
            byState[s] += 1;
            if (row.state === 2) {
                if (Number(row.scheduled_days) >= 21)
                    mature += 1;
                else
                    young += 1;
                const key = dayKey(new Date(row.due));
                forecast[key] = (forecast[key] || 0) + 1;
            }
            for (const entry of parseLog(row.log_json)) {
                totalReviews += 1;
                if (entry.rating >= 3)
                    goodOrBetter += 1;
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
    normalizeRating(rating) {
        const r = Number(rating);
        return r === 1 || r === 2 || r === 4 ? r : 3;
    }
    async loadAccessibleNotes(token, appClient) {
        const lists = await Promise.all(ENGINE_KEYS.map((engine) => this.aiNotes.canvasStudentList(token, engine, appClient)));
        const merged = new Map();
        for (const list of lists) {
            for (const note of list) {
                const normalized = normalizeNote(note);
                if (normalized.approvedFlashcardCount <= 0)
                    continue;
                const prev = merged.get(normalized.id);
                if (!prev || (!prev.canAccess && normalized.canAccess))
                    merged.set(normalized.id, normalized);
            }
        }
        return [...merged.values()];
    }
    async reviewCountsByNote(userId) {
        const [rows] = await this.db.execute(`SELECT lf.note_id AS note_id, lfr.state AS state, lfr.due AS due, lfr.suspended AS suspended, lfr.buried AS buried
       FROM lesson_flashcard_reviews lfr
       JOIN lesson_flashcards lf ON lf.id = lfr.card_id AND lf.status = 'approved'
       WHERE lfr.user_id = ?`, [userId]);
        const now = new Date();
        const eod = endOfDay(now).getTime();
        const map = new Map();
        for (const row of rows) {
            const noteId = Number(row.note_id);
            const entry = map.get(noteId) || { reviewed: 0, learning: 0, due: 0 };
            entry.reviewed += 1;
            if (!row.suspended && !row.buried) {
                const dueTime = Date.parse(String(row.due));
                if ((row.state === 1 || row.state === 3) && dueTime <= now.getTime())
                    entry.learning += 1;
                else if (row.state === 2 && dueTime <= eod)
                    entry.due += 1;
            }
            map.set(noteId, entry);
        }
        return map;
    }
    async loadCards(noteIds) {
        if (!noteIds.length)
            return [];
        const placeholders = noteIds.map(() => '?').join(',');
        const [rows] = await this.db.execute(`SELECT id, note_id, lesson_id, question, answer, source_hint, image_url, image_fit, sort_order
       FROM lesson_flashcards
       WHERE status = 'approved' AND note_id IN (${placeholders})
       ORDER BY sort_order ASC, id ASC`, noteIds);
        return rows;
    }
    async loadReviewRows(userId, cardIds) {
        if (!cardIds.length)
            return new Map();
        const placeholders = cardIds.map(() => '?').join(',');
        const [rows] = await this.db.execute(`SELECT * FROM lesson_flashcard_reviews WHERE user_id = ? AND card_id IN (${placeholders})`, [userId, ...cardIds]);
        return new Map(rows.map((row) => [row.card_id, row]));
    }
    async validCardIds(cardIds) {
        if (!cardIds.length)
            return new Set();
        const placeholders = cardIds.map(() => '?').join(',');
        const [rows] = await this.db.execute(`SELECT id FROM lesson_flashcards WHERE status = 'approved' AND id IN (${placeholders})`, cardIds);
        return new Set(rows.map((r) => Number(r.id)));
    }
    async upsertState(userId, cardId, state, log, flags = {}) {
        await this.db.execute(`INSERT INTO lesson_flashcard_reviews
        (user_id, card_id, state, due, stability, difficulty, elapsed_days, scheduled_days,
         reps, lapses, learning_steps, last_review, suspended, buried, log_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         state = VALUES(state), due = VALUES(due), stability = VALUES(stability),
         difficulty = VALUES(difficulty), elapsed_days = VALUES(elapsed_days),
         scheduled_days = VALUES(scheduled_days), reps = VALUES(reps), lapses = VALUES(lapses),
         learning_steps = VALUES(learning_steps), last_review = VALUES(last_review),
         suspended = VALUES(suspended), buried = VALUES(buried), log_json = VALUES(log_json)`, [
            userId, cardId, state.state, toMysqlDateTime(state.due), state.stability, state.difficulty,
            state.elapsedDays, state.scheduledDays, state.reps, state.lapses, state.learningSteps,
            state.lastReview ? toMysqlDateTime(state.lastReview) : null,
            flags.suspended ? 1 : 0, flags.buried ? 1 : 0, JSON.stringify(log),
        ]);
    }
};
exports.FlashcardsService = FlashcardsService;
exports.FlashcardsService = FlashcardsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_tokens_1.DATABASE_CONNECTION)),
    __metadata("design:paramtypes", [Object, flashcard_scheduler_service_1.FlashcardSchedulerService,
        lessons_service_1.LessonsService])
], FlashcardsService);
function normalizeNote(note) {
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
function buildDeckTree(notes, reviewByNote) {
    const roots = [];
    const index = new Map();
    const getNode = (parent, key, label, type, depth) => {
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
            if (!note.canAccess)
                node.locked = true;
            if (note.appOnly)
                node.appOnly = true;
        }
    }
    index.forEach((node) => { node.noteIds = [...new Set(node.noteIds)]; });
    return roots;
}
function mapCardContent(row) {
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
function rowToState(row) {
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
function parseLog(raw) {
    if (!raw)
        return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    }
    catch {
        return [];
    }
}
function parseImageUrls(value) {
    if (!value)
        return [];
    const trimmed = value.trim();
    if (trimmed.startsWith('[')) {
        try {
            const arr = JSON.parse(trimmed);
            return Array.isArray(arr) ? arr.map(String).filter(Boolean).slice(0, 3) : [];
        }
        catch {
            return [];
        }
    }
    return [trimmed];
}
function stateName(state) {
    if (state === 1)
        return 'learning';
    if (state === 2)
        return 'review';
    if (state === 3)
        return 'relearning';
    return 'new';
}
function slug(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'x';
}
function endOfDay(date) {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
}
function dayKey(date) {
    return date.toISOString().slice(0, 10);
}
function toSeries(map) {
    return Object.entries(map)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => (a.date < b.date ? -1 : 1));
}
function toMysqlDateTime(iso) {
    return new Date(iso).toISOString().slice(0, 19).replace('T', ' ');
}
function clampNumber(value, min, max, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n))
        return fallback;
    return Math.min(max, Math.max(min, n));
}
//# sourceMappingURL=flashcards.service.js.map