import { AuthService } from '../auth/auth.service';
import { EcgService, EcgTopicInput, EcgCardInput, EcgQuizInput } from './ecg.service';
export declare class EcgAdminController {
    private readonly svc;
    private readonly authService;
    constructor(svc: EcgService, authService: AuthService);
    private requireAdmin;
    listTopics(auth?: string): Promise<{
        topics: import("mysql2").RowDataPacket[];
    }>;
    createTopic(body: EcgTopicInput, auth?: string): Promise<{
        id: any;
    }>;
    reorderTopics(body: {
        ids: number[];
    }, auth?: string): Promise<{
        ok: boolean;
    }>;
    getTopic(id: number, auth?: string): Promise<import("mysql2").RowDataPacket>;
    updateTopic(id: number, body: EcgTopicInput, auth?: string): Promise<{
        ok: boolean;
    }>;
    toggleTopic(id: number, auth?: string): Promise<{
        ok: boolean;
    }>;
    deleteTopic(id: number, auth?: string): Promise<{
        ok: boolean;
    }>;
    listCards(id: number, auth?: string): Promise<{
        cards: import("mysql2").RowDataPacket[];
    }>;
    createCard(body: EcgCardInput, auth?: string): Promise<{
        id: any;
    }>;
    reorderCards(body: {
        ids: number[];
    }, auth?: string): Promise<{
        ok: boolean;
    }>;
    getCard(id: number, auth?: string): Promise<import("mysql2").RowDataPacket>;
    updateCard(id: number, body: Partial<EcgCardInput>, auth?: string): Promise<{
        ok: boolean;
    }>;
    toggleCard(id: number, auth?: string): Promise<{
        ok: boolean;
    }>;
    deleteCard(id: number, auth?: string): Promise<{
        ok: boolean;
    }>;
    listQuiz(auth?: string): Promise<{
        questions: {
            id: any;
            question_text: any;
            image_url: any;
            options: import("./ecg.service").EcgQuizOption[];
            explanation: any;
            position: any;
            is_active: any;
            created_at: any;
            updated_at: any;
        }[];
    }>;
    createQuiz(body: EcgQuizInput, auth?: string): Promise<{
        id: any;
    }>;
    getQuiz(id: number, auth?: string): Promise<any>;
    updateQuiz(id: number, body: EcgQuizInput, auth?: string): Promise<{
        ok: boolean;
    }>;
    toggleQuiz(id: number, auth?: string): Promise<{
        ok: boolean;
    }>;
    deleteQuiz(id: number, auth?: string): Promise<{
        ok: boolean;
    }>;
}
