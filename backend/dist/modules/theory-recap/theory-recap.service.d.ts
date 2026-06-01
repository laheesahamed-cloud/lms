import { Pool } from 'mysql2/promise';
import { AiService } from '../ai/ai.service';
import { UpsertTheoryRecapDto } from './dto/upsert-theory-recap.dto';
export declare class TheoryRecapService {
    private readonly db;
    private readonly aiService;
    constructor(db: Pool, aiService: AiService);
    getByQuestionId(questionId: number): Promise<{
        id: number;
        questionId: number;
        conceptName: string;
        hierarchy: {
            course: string;
            subject: string;
            topic: string;
            lesson: string;
        };
        etiology: string[];
        pathophysiology: string[];
        clinicalFeatures: string[];
        investigations: string[];
        treatment: string[];
        keyPoints: string[];
        mnemonic: string;
        generatedBy: "ai" | "manual";
        reviewedStatus: "pending" | "approved" | "rejected";
        createdAt: string;
        updatedAt: string;
    } | null>;
    upsert(questionId: number, dto: UpsertTheoryRecapDto, generatedBy?: 'ai' | 'manual'): Promise<{
        id: number;
        questionId: number;
        conceptName: string;
        hierarchy: {
            course: string;
            subject: string;
            topic: string;
            lesson: string;
        };
        etiology: string[];
        pathophysiology: string[];
        clinicalFeatures: string[];
        investigations: string[];
        treatment: string[];
        keyPoints: string[];
        mnemonic: string;
        generatedBy: "ai" | "manual";
        reviewedStatus: "pending" | "approved" | "rejected";
        createdAt: string;
        updatedAt: string;
    } | null>;
    generateForQuestion(questionId: number): Promise<{
        id: number;
        questionId: number;
        conceptName: string;
        hierarchy: {
            course: string;
            subject: string;
            topic: string;
            lesson: string;
        };
        etiology: string[];
        pathophysiology: string[];
        clinicalFeatures: string[];
        investigations: string[];
        treatment: string[];
        keyPoints: string[];
        mnemonic: string;
        generatedBy: "ai" | "manual";
        reviewedStatus: "pending" | "approved" | "rejected";
        createdAt: string;
        updatedAt: string;
    } | null>;
    delete(questionId: number): Promise<{
        success: boolean;
    }>;
    bulkGenerate(questionIds: number[]): Promise<{
        results: {
            questionId: number;
            status: "generated" | "skipped" | "error";
            error?: string;
        }[];
        total: number;
        generated: number;
    }>;
    private loadQuestionContext;
    private mapRow;
    private serializeArray;
    private parseArray;
}
