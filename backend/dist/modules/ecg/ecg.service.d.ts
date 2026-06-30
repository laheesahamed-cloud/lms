import { Pool, RowDataPacket } from 'mysql2/promise';
export interface EcgTopicInput {
    title: string;
    description?: string | null;
    position?: number | null;
    is_active?: boolean;
}
export interface EcgCardInput {
    topic_id: number;
    title: string;
    image_url?: string | null;
    explanation?: string | null;
    position?: number | null;
    is_active?: boolean;
}
export interface EcgQuizOption {
    text: string;
    correct: boolean;
}
export interface EcgQuizInput {
    question_text?: string;
    image_url?: string | null;
    options?: EcgQuizOption[];
    explanation?: string | null;
    position?: number | null;
    is_active?: boolean;
}
export declare class EcgService {
    private readonly db;
    constructor(db: Pool);
    listTopics(): Promise<{
        id: any;
        title: any;
        description: any;
        position: any;
        cardCount: number;
    }[]>;
    getTopicWithCards(topicId: number): Promise<{
        topic: RowDataPacket;
        cards: RowDataPacket[];
    } | null>;
    getQuizBatch(count: number): Promise<{
        questions: {
            id: any;
            question_text: any;
            image_url: any;
            options: string[];
            answer: string;
            explanation: any;
        }[];
    }>;
    private parseOptions;
    listQuizQuestions(): Promise<{
        id: any;
        question_text: any;
        image_url: any;
        options: EcgQuizOption[];
        explanation: any;
        position: any;
        is_active: any;
        created_at: any;
        updated_at: any;
    }[]>;
    getQuizQuestion(id: number): Promise<any>;
    createQuizQuestion(data: EcgQuizInput): Promise<{
        id: any;
    }>;
    updateQuizQuestion(id: number, data: EcgQuizInput): Promise<void>;
    toggleQuizQuestion(id: number): Promise<void>;
    deleteQuizQuestion(id: number): Promise<void>;
    listTopicsAdmin(): Promise<RowDataPacket[]>;
    getTopic(id: number): Promise<RowDataPacket>;
    createTopic(data: EcgTopicInput): Promise<{
        id: any;
    }>;
    updateTopic(id: number, data: EcgTopicInput): Promise<void>;
    toggleTopic(id: number): Promise<void>;
    reorderTopics(orderedIds: number[]): Promise<void>;
    deleteTopic(id: number): Promise<void>;
    listCards(topicId: number): Promise<RowDataPacket[]>;
    getCard(id: number): Promise<RowDataPacket>;
    createCard(data: EcgCardInput): Promise<{
        id: any;
    }>;
    updateCard(id: number, data: Partial<EcgCardInput>): Promise<void>;
    toggleCard(id: number): Promise<void>;
    reorderCards(orderedIds: number[]): Promise<void>;
    deleteCard(id: number): Promise<void>;
}
