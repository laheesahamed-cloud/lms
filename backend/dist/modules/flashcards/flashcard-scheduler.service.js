"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FlashcardSchedulerService = exports.DEFAULT_FSRS_SETTINGS = void 0;
const common_1 = require("@nestjs/common");
const ts_fsrs_1 = require("ts-fsrs");
exports.DEFAULT_FSRS_SETTINGS = {
    requestRetention: 0.9,
    maximumInterval: 36500,
    enableFuzz: true,
};
const GRADES = [ts_fsrs_1.Rating.Again, ts_fsrs_1.Rating.Hard, ts_fsrs_1.Rating.Good, ts_fsrs_1.Rating.Easy];
let FlashcardSchedulerService = class FlashcardSchedulerService {
    constructor() {
        this.cache = new Map();
    }
    engine(settings) {
        const key = JSON.stringify(settings);
        let f = this.cache.get(key);
        if (!f) {
            const params = (0, ts_fsrs_1.generatorParameters)({
                request_retention: settings.requestRetention,
                maximum_interval: settings.maximumInterval,
                enable_fuzz: settings.enableFuzz,
                ...(settings.weights && settings.weights.length ? { w: settings.weights } : {}),
            });
            f = (0, ts_fsrs_1.fsrs)(params);
            this.cache.set(key, f);
        }
        return f;
    }
    emptyState(now = new Date()) {
        return this.fromFsrs((0, ts_fsrs_1.createEmptyCard)(now));
    }
    apply(state, rating, reviewTime, settings = exports.DEFAULT_FSRS_SETTINGS) {
        const grade = this.normalizeRating(rating);
        const { card } = this.engine(settings).next(this.toFsrs(state), reviewTime, grade);
        return this.fromFsrs(card);
    }
    preview(state, now = new Date(), settings = exports.DEFAULT_FSRS_SETTINGS) {
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
    normalizeRating(rating) {
        const r = Number(rating);
        if (r === 1)
            return ts_fsrs_1.Rating.Again;
        if (r === 2)
            return ts_fsrs_1.Rating.Hard;
        if (r === 4)
            return ts_fsrs_1.Rating.Easy;
        return ts_fsrs_1.Rating.Good;
    }
    toFsrs(state) {
        return {
            due: new Date(state.due),
            stability: Number(state.stability) || 0,
            difficulty: Number(state.difficulty) || 0,
            elapsed_days: Number(state.elapsedDays) || 0,
            scheduled_days: Number(state.scheduledDays) || 0,
            reps: Number(state.reps) || 0,
            lapses: Number(state.lapses) || 0,
            state: (Number(state.state) || 0),
            learning_steps: Number(state.learningSteps) || 0,
            last_review: state.lastReview ? new Date(state.lastReview) : undefined,
        };
    }
    fromFsrs(card) {
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
            learningSteps: Number(card.learning_steps) || 0,
            lastReview: last ? last.toISOString() : null,
        };
    }
    formatInterval(minutes) {
        if (minutes < 60)
            return `${Math.max(1, minutes)}m`;
        const hours = minutes / 60;
        if (hours < 24)
            return `${Math.round(hours)}h`;
        const days = hours / 24;
        if (days < 30)
            return `${Math.round(days)}d`;
        const months = days / 30;
        if (months < 12)
            return `${Math.round(months)}mo`;
        return `${(days / 365).toFixed(days / 365 < 10 ? 1 : 0)}y`;
    }
};
exports.FlashcardSchedulerService = FlashcardSchedulerService;
exports.FlashcardSchedulerService = FlashcardSchedulerService = __decorate([
    (0, common_1.Injectable)()
], FlashcardSchedulerService);
//# sourceMappingURL=flashcard-scheduler.service.js.map