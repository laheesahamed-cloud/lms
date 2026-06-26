import { Pool } from 'mysql2/promise';
type EvidenceFilters = {
    entityType?: string;
    entityId?: number;
    workflowState?: string;
    actorId?: number;
};
export declare class ContentGovernanceService {
    private readonly db;
    constructor(db: Pool);
    listEvidence(filters?: EvidenceFilters): Promise<{
        ok: boolean;
        evidence: {
            entityType: string;
            entityId: number;
            workflowState: "draft" | "in_review" | "published" | "archived";
            author: {
                id: number;
                name: string;
            } | null;
            authoredAt: string | Date | null;
            reviewer: {
                id: number;
                name: string;
            } | null;
            approvalDate: string | Date | null;
            version: {
                id: number | null;
                number: number;
                label: string;
                createdAt: string | Date | null;
            } | null;
            rollbackPath: string;
        }[];
        filters: {
            entityType: string;
            entityId: number | null;
            workflowState: string;
        };
    }>;
    exportEvidence(filters?: EvidenceFilters): Promise<Buffer<ArrayBuffer>>;
    private normalizeFilters;
    private loadUserNames;
    private mapEvidence;
    private rollbackPath;
    private logAdminAuditEvent;
    private escapeCsvCell;
}
export {};
