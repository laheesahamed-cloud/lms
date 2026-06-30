import type { Response } from 'express';
import { AuthService } from '../auth/auth.service';
import { AuscultationService } from './auscultation.service';
export declare class AuscultationController {
    private readonly svc;
    private readonly authService;
    constructor(svc: AuscultationService, authService: AuthService);
    private cat;
    topics(category?: string, auth?: string): Promise<{
        topics: {
            id: any;
            category: any;
            title: any;
            description: any;
            position: any;
            cardCount: number;
        }[];
    }>;
    topic(id: number, auth?: string): Promise<{
        topic: import("mysql2").RowDataPacket;
        cards: {
            id: any;
            topic_id: any;
            title: any;
            explanation: any;
            position: any;
            hasAudio: boolean;
        }[];
    } | {
        topic: null;
        cards: never[];
    }>;
    quiz(category?: string, count?: string, auth?: string): Promise<{
        questions: {
            id: any;
            question_text: any;
            hasAudio: boolean;
            options: string[];
            answer: string;
            explanation: any;
        }[];
    }>;
    cardAudio(id: number, res: Response, auth?: string): Promise<void>;
    quizAudio(id: number, res: Response, auth?: string): Promise<void>;
    private sendAudio;
}
