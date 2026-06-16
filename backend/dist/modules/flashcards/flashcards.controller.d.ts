import { AuthService } from '../auth/auth.service';
import { FlashcardsService } from './flashcards.service';
import { SubmitReviewsDto } from './dto/submit-reviews.dto';
export declare class FlashcardsController {
    private readonly svc;
    private readonly authService;
    constructor(svc: FlashcardsService, authService: AuthService);
    decks(auth?: string): Promise<{
        decks: import("./flashcards.service").DeckNode[];
        totals: {
            newCount: number;
            learningCount: number;
            dueCount: number;
        };
    }>;
    queue(noteIds: string, limit: string, newLimit: string, auth?: string): Promise<{
        cards: import("./flashcards.service").QueueItem[];
        counts: {
            new: number;
            learning: number;
            due: number;
        };
    }>;
    submit(dto: SubmitReviewsDto, auth?: string): Promise<{
        results: {
            cardId: number;
            applied: boolean;
            state: import("./flashcard-scheduler.service").CardState;
            previews: ReturnType<import("./flashcard-scheduler.service").FlashcardSchedulerService["preview"]>;
        }[];
    }>;
    undo(cardId: number, auth?: string): Promise<{
        cardId: number;
        reverted: boolean;
        state: null;
    } | {
        cardId: number;
        reverted: boolean;
        state: import("./flashcard-scheduler.service").CardState;
    }>;
    flags(cardId: number, body: {
        suspended?: boolean;
        buried?: boolean;
    }, auth?: string): Promise<{
        suspended?: boolean;
        buried?: boolean;
        cardId: number;
    }>;
    stats(auth?: string): Promise<{
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
    getSettings(auth?: string): Promise<import("./flashcard-scheduler.service").FlashcardFsrsSettings & {
        newPerDay: number;
        reviewsPerDay: number;
    }>;
    patchSettings(body: Record<string, unknown>, auth?: string): Promise<{
        requestRetention: number;
        maximumInterval: number;
        enableFuzz: boolean;
        weights: any[] | undefined;
        newPerDay: number;
        reviewsPerDay: number;
    }>;
}
