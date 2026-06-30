import { AuthService } from '../auth/auth.service';
import { EcgService } from './ecg.service';
export declare class EcgController {
    private readonly svc;
    private readonly authService;
    constructor(svc: EcgService, authService: AuthService);
    topics(auth?: string): Promise<{
        topics: {
            id: any;
            title: any;
            description: any;
            position: any;
            cardCount: number;
        }[];
    }>;
    topic(id: number, auth?: string): Promise<{
        topic: import("mysql2").RowDataPacket;
        cards: import("mysql2").RowDataPacket[];
    } | {
        topic: null;
        cards: never[];
    }>;
    quiz(count?: string, auth?: string): Promise<{
        questions: {
            id: any;
            question_text: any;
            image_url: any;
            options: string[];
            answer: string;
            explanation: any;
        }[];
    }>;
}
