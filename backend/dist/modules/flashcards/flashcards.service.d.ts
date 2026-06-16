import { Pool, RowDataPacket } from 'mysql2/promise';
import { AiNotesService } from '../ai-notes/ai-notes.service';
import { CardState, FlashcardFsrsSettings, FlashcardSchedulerService } from './flashcard-scheduler.service';
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
export interface ReviewInput {
    cardId: number;
    rating: number;
    reviewUid: string;
    reviewTime: string;
}
export declare class FlashcardsService {
    private readonly db;
    private readonly scheduler;
    private readonly aiNotes;
    constructor(db: Pool, scheduler: FlashcardSchedulerService, aiNotes: AiNotesService);
    getSettings(): Promise<FlashcardFsrsSettings & {
        newPerDay: number;
        reviewsPerDay: number;
    }>;
    updateSettings(patch: Record<string, unknown>): Promise<{
        requestRetention: number;
        maximumInterval: number;
        enableFuzz: boolean;
        weights: any[] | undefined;
        newPerDay: number;
        reviewsPerDay: number;
    }>;
    private fsrsSettings;
    listDecks(userId: number, token: string): Promise<{
        decks: DeckNode[];
        totals: {
            newCount: number;
            learningCount: number;
            dueCount: number;
        };
    }>;
    getQueue(userId: number, token: string, params: {
        noteIds: number[];
        limit?: number;
        newLimit?: number;
    }): Promise<{
        cards: QueueItem[];
        counts: {
            new: number;
            learning: number;
            due: number;
        };
    }>;
    submitReviews(userId: number, items: ReviewInput[]): Promise<{
        results: {
            cardId: number;
            applied: boolean;
            state: CardState;
            previews: ReturnType<FlashcardSchedulerService["preview"]>;
        }[];
    }>;
    undo(userId: number, cardId: number): Promise<{
        cardId: number;
        reverted: boolean;
        state: null;
    } | {
        cardId: number;
        reverted: boolean;
        state: CardState;
    }>;
    setCardFlags(userId: number, cardId: number, flags: {
        suspended?: boolean;
        buried?: boolean;
    }): Promise<{
        suspended?: boolean;
        buried?: boolean;
        cardId: number;
    }>;
    stats(userId: number): Promise<{
        counts: {
            new: number;
            learning: number;
            review: number;
            relearning: number;
        };
        mature: number;
        young: number;
        totalReviews: number;
        retention: number | null;
        reviewsPerDay: {
            date: string;
            count: number;
        }[];
        dueForecast: {
            date: string;
            count: number;
        }[];
    }>;
    private normalizeRating;
    private loadAccessibleNotes;
    private reviewCountsByNote;
    private loadCards;
    private loadReviewRows;
    private validCardIds;
    private upsertState;
}
export interface QueueItem {
    card: ReturnType<typeof mapCardContent>;
    state: string;
    due: string;
    previews: ReturnType<FlashcardSchedulerService['preview']>;
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
    children: DeckNode[];
}
declare function mapCardContent(row: CardContentRow): {
    id: number;
    noteId: number;
    lessonId: number | null;
    question: string;
    answer: string;
    sourceHint: string;
    imageUrls: string[];
    imageUrl: string;
    imageFit: string;
};
export {};
