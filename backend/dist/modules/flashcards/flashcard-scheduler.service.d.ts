export interface FlashcardFsrsSettings {
    requestRetention: number;
    maximumInterval: number;
    enableFuzz: boolean;
    weights?: number[];
}
export declare const DEFAULT_FSRS_SETTINGS: FlashcardFsrsSettings;
export interface CardState {
    state: number;
    due: string;
    stability: number;
    difficulty: number;
    elapsedDays: number;
    scheduledDays: number;
    reps: number;
    lapses: number;
    learningSteps: number;
    lastReview: string | null;
}
export interface IntervalPreview {
    rating: number;
    intervalDays: number;
    intervalMinutes: number;
    dueIso: string;
    label: string;
}
export declare class FlashcardSchedulerService {
    private cache;
    private engine;
    emptyState(now?: Date): CardState;
    apply(state: CardState, rating: number, reviewTime: Date, settings?: FlashcardFsrsSettings): CardState;
    preview(state: CardState, now?: Date, settings?: FlashcardFsrsSettings): IntervalPreview[];
    private normalizeRating;
    private toFsrs;
    private fromFsrs;
    private formatInterval;
}
