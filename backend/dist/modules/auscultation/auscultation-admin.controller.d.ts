import { AuthService } from '../auth/auth.service';
import { AuscultationService, AuscTopicInput, AuscCardInput, AuscQuizInput } from './auscultation.service';
export declare class AuscultationAdminController {
    private readonly svc;
    private readonly authService;
    constructor(svc: AuscultationService, authService: AuthService);
    private requireAdmin;
    private cat;
    listTopics(category?: string, auth?: string): Promise<{
        topics: import("mysql2").RowDataPacket[];
    }>;
    createTopic(body: AuscTopicInput, auth?: string): Promise<{
        id: any;
    }>;
    getTopic(id: number, auth?: string): Promise<import("mysql2").RowDataPacket>;
    updateTopic(id: number, body: AuscTopicInput, auth?: string): Promise<{
        ok: boolean;
    }>;
    toggleTopic(id: number, auth?: string): Promise<{
        ok: boolean;
    }>;
    deleteTopic(id: number, auth?: string): Promise<{
        ok: boolean;
    }>;
    listCards(id: number, auth?: string): Promise<{
        cards: {
            hasAudio: boolean;
            constructor: {
                name: "RowDataPacket";
            };
        }[];
    }>;
    listAllSounds(category?: string, auth?: string): Promise<{
        sounds: {
            id: any;
            title: any;
            topicId: any;
            topicTitle: any;
            category: any;
        }[];
    }>;
    createCard(body: AuscCardInput, auth?: string): Promise<{
        id: any;
    }>;
    updateCard(id: number, body: AuscCardInput, auth?: string): Promise<{
        ok: boolean;
    }>;
    toggleCard(id: number, auth?: string): Promise<{
        ok: boolean;
    }>;
    deleteCard(id: number, auth?: string): Promise<{
        ok: boolean;
    }>;
    listQuiz(category?: string, auth?: string): Promise<{
        questions: {
            id: any;
            category: any;
            question_text: any;
            hasAudio: boolean;
            source_card_id: any;
            options: import("./auscultation.service").AuscQuizOption[];
            explanation: any;
            position: any;
            is_active: any;
            created_at: any;
            updated_at: any;
        }[];
    }>;
    createQuiz(body: AuscQuizInput, auth?: string): Promise<{
        id: any;
    }>;
    updateQuiz(id: number, body: AuscQuizInput, auth?: string): Promise<{
        ok: boolean;
    }>;
    toggleQuiz(id: number, auth?: string): Promise<{
        ok: boolean;
    }>;
    deleteQuiz(id: number, auth?: string): Promise<{
        ok: boolean;
    }>;
    private validateQuiz;
}
