import { Pool, RowDataPacket } from 'mysql2/promise';
export type SoundCategory = 'heart' | 'lung';
export interface AuscTopicInput {
    category?: SoundCategory;
    title: string;
    description?: string | null;
    position?: number | null;
    is_active?: boolean;
}
export interface AuscCardInput {
    topic_id: number;
    title: string;
    audio_data_url?: string | null;
    explanation?: string | null;
    position?: number | null;
    is_active?: boolean;
}
export interface AuscQuizOption {
    text: string;
    correct: boolean;
}
export interface AuscQuizInput {
    category?: SoundCategory;
    question_text?: string;
    audio_data_url?: string | null;
    source_card_id?: number | null;
    options?: AuscQuizOption[];
    explanation?: string | null;
    position?: number | null;
    is_active?: boolean;
}
export declare class AuscultationService {
    private readonly db;
    constructor(db: Pool);
    private parseAudioDataUrl;
    private saveAudio;
    private deleteAudio;
    getCardAudio(id: number): Promise<{
        buffer: Buffer;
        mime: string;
    } | null>;
    getQuizAudio(id: number): Promise<{
        buffer: Buffer;
        mime: string;
    } | null>;
    private readAudioRow;
    private parseOptions;
    private normCategory;
    listTopics(category: SoundCategory): Promise<{
        id: any;
        category: any;
        title: any;
        description: any;
        position: any;
        cardCount: number;
    }[]>;
    getTopicWithCards(topicId: number): Promise<{
        topic: RowDataPacket;
        cards: {
            id: any;
            topic_id: any;
            title: any;
            explanation: any;
            position: any;
            hasAudio: boolean;
        }[];
    } | null>;
    getQuizBatch(category: SoundCategory, count: number): Promise<{
        questions: {
            id: any;
            question_text: any;
            hasAudio: boolean;
            options: string[];
            answer: string;
            explanation: any;
        }[];
    }>;
    listTopicsAdmin(category?: SoundCategory): Promise<RowDataPacket[]>;
    getTopic(id: number): Promise<RowDataPacket>;
    createTopic(data: AuscTopicInput): Promise<{
        id: any;
    }>;
    updateTopic(id: number, data: AuscTopicInput): Promise<void>;
    toggleTopic(id: number): Promise<void>;
    deleteTopic(id: number): Promise<void>;
    listCards(topicId: number): Promise<{
        hasAudio: boolean;
        constructor: {
            name: "RowDataPacket";
        };
    }[]>;
    createCard(data: AuscCardInput): Promise<{
        id: any;
    }>;
    updateCard(id: number, data: AuscCardInput): Promise<void>;
    toggleCard(id: number): Promise<void>;
    deleteCard(id: number): Promise<void>;
    listQuizQuestions(category?: SoundCategory): Promise<{
        id: any;
        category: any;
        question_text: any;
        hasAudio: boolean;
        source_card_id: any;
        options: AuscQuizOption[];
        explanation: any;
        position: any;
        is_active: any;
        created_at: any;
        updated_at: any;
    }[]>;
    createQuizQuestion(data: AuscQuizInput): Promise<{
        id: any;
    }>;
    updateQuizQuestion(id: number, data: AuscQuizInput): Promise<void>;
    listAllCards(category?: SoundCategory): Promise<{
        id: any;
        title: any;
        topicId: any;
        topicTitle: any;
        category: any;
    }[]>;
    toggleQuizQuestion(id: number): Promise<void>;
    deleteQuizQuestion(id: number): Promise<void>;
}
