import { AuthService } from '../auth/auth.service';
import { TheoryRecapService } from './theory-recap.service';
import { UpsertTheoryRecapDto } from './dto/upsert-theory-recap.dto';
export declare class TheoryRecapController {
    private readonly theoryRecapService;
    private readonly authService;
    constructor(theoryRecapService: TheoryRecapService, authService: AuthService);
    getByQuestionId(questionId: number, authorization?: string): Promise<{
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
        reviewedStatus: "rejected" | "pending" | "approved";
        createdAt: string;
        updatedAt: string;
    } | null>;
    upsert(questionId: number, dto: UpsertTheoryRecapDto, authorization?: string): Promise<{
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
        reviewedStatus: "rejected" | "pending" | "approved";
        createdAt: string;
        updatedAt: string;
    } | null>;
    generate(questionId: number, authorization?: string): Promise<{
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
        reviewedStatus: "rejected" | "pending" | "approved";
        createdAt: string;
        updatedAt: string;
    } | null>;
    regenerate(questionId: number, authorization?: string): Promise<{
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
        reviewedStatus: "rejected" | "pending" | "approved";
        createdAt: string;
        updatedAt: string;
    } | null>;
    deleteRecap(questionId: number, authorization?: string): Promise<{
        success: boolean;
    }>;
    bulkGenerate(body: {
        questionIds: number[];
    }, authorization?: string): Promise<{
        results: {
            questionId: number;
            status: "generated" | "skipped" | "error";
            error?: string;
        }[];
        total: number;
        generated: number;
    }>;
}
