import { Pool } from 'mysql2/promise';
import { CaseDocument, OsceService } from './osce.service';
export interface ImportRow {
    index: number;
    slug: string;
    title: string;
    stationType: 'short' | 'long';
    courseRef: string;
    topicRef: string;
    refKey: string;
    action: 'create' | 'update' | 'skip' | 'error';
    existingId?: number;
    errors: string[];
    warnings: string[];
    slots: number;
}
export declare class OsceImportService {
    private readonly db;
    private readonly osce;
    constructor(db: Pool, osce: OsceService);
    private assertSafe;
    private cases;
    adaptCase(raw: any): {
        doc: CaseDocument;
        errors: string[];
        warnings: string[];
    };
    private existing;
    private plan;
    preview(pkg: any): Promise<{
        format: string | null;
        rows: ImportRow[];
        refs: {
            key: string;
            courseRef: string;
            topicRef: string;
            cases: number;
        }[];
        totals: {
            cases: number;
            create: number;
            update: number;
            skip: number;
            error: number;
        };
    }>;
    commit(pkg: any, mapping: Record<string, number>, adminId: number | null): Promise<{
        results: {
            slug: string;
            title: string;
            status: "created" | "updated" | "skipped" | "failed";
            id?: number;
            message?: string;
        }[];
        totals: {
            created: number;
            updated: number;
            skipped: number;
            failed: number;
        };
    }>;
    exportCases(slugs?: string[]): Promise<{
        format_id: string;
        format_version: string;
        exported_at: string;
        cases: {
            slug: any;
            title: any;
            summary: any;
            station_type: any;
            difficulty: any;
            course_ref: any;
            topic_ref: any;
            is_free: boolean;
            case_data: any;
            media_slots: string[];
        }[];
    }>;
}
