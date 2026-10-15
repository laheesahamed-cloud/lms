import { AuthService } from '../auth/auth.service';
import { ContentGovernanceService } from './content-governance.service';
export declare class ContentGovernanceController {
    private readonly contentGovernanceService;
    private readonly authService;
    constructor(contentGovernanceService: ContentGovernanceService, authService: AuthService);
    exportEvidence(authorization: string | undefined, entityType?: string, entityId?: string, workflowState?: string, response?: any): Promise<void>;
    listEvidence(authorization: string | undefined, entityType?: string, entityId?: string, workflowState?: string): Promise<{
        ok: boolean;
        evidence: {
            entityType: string;
            entityId: number;
            workflowState: "published" | "draft" | "in_review" | "archived";
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
}
