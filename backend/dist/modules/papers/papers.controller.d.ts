import { AuthService } from '../auth/auth.service';
import { PapersService } from './papers.service';
import { CreatePaperDto } from './dto/create-paper.dto';
import { UpdatePaperDto } from './dto/update-paper.dto';
export declare class PapersController {
    private readonly papersService;
    private readonly authService;
    constructor(papersService: PapersService, authService: AuthService);
    findAll(search?: string, status?: string): Promise<{
        id: number;
        paperTitle: string;
        year: number;
        examSource: "local" | "erpm";
        keywordsText: string;
        keywords: string[];
        status: "active" | "inactive";
        createdAt: string | null;
        questionCount: number;
    }[]>;
    keywordSuggestions(query?: string): Promise<string[]>;
    findOne(id: number): Promise<{
        id: number;
        paperTitle: string;
        year: number;
        examSource: "local" | "erpm";
        keywordsText: string;
        keywords: string[];
        status: "active" | "inactive";
        createdAt: string | null;
        questionCount: number;
    }>;
    create(authorization: string | undefined, createPaperDto: CreatePaperDto): Promise<{
        ok: boolean;
        id: number;
    }>;
    update(authorization: string | undefined, id: number, updatePaperDto: UpdatePaperDto): Promise<{
        ok: boolean;
        id: number;
    }>;
    remove(authorization: string | undefined, id: number): Promise<{
        ok: boolean;
        id: number;
    }>;
    listVersions(id: number): Promise<{
        id: number;
        versionNumber: number;
        createdBy: number | null;
        createdAt: any;
        snapshot: any;
    }[]>;
    markDraft(authorization: string | undefined, id: number): Promise<{
        ok: boolean;
        id: number;
        status: "active" | "inactive";
        workflowState: "draft" | "in_review" | "published" | "archived";
    }>;
    submitForReview(authorization: string | undefined, id: number): Promise<{
        ok: boolean;
        id: number;
        status: "active" | "inactive";
        workflowState: "draft" | "in_review" | "published" | "archived";
    }>;
    publish(authorization: string | undefined, id: number): Promise<{
        ok: boolean;
        id: number;
        status: "active" | "inactive";
        workflowState: "draft" | "in_review" | "published" | "archived";
    }>;
    rollback(authorization: string | undefined, id: number, versionNumber: number): Promise<{
        ok: boolean;
        id: number;
        rolledBackToVersion: number;
        status: "active" | "inactive";
        workflowState: "draft" | "published";
    }>;
}
