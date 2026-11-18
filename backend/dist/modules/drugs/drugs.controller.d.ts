import { AuthService } from '../auth/auth.service';
import { DrugsService } from './drugs.service';
import { Pool } from 'mysql2/promise';
export declare class DrugsController {
    private readonly svc;
    private readonly authService;
    private readonly db;
    constructor(svc: DrugsService, authService: AuthService, db: Pool);
    private paidPlan;
    list(auth?: string, have?: string): Promise<{
        blocked: boolean;
        reason: string;
    } | {
        useCount: number;
        freeLimit: number;
        hasSubscription: boolean;
        unchanged: boolean;
        v: number;
        blocked?: undefined;
        reason?: undefined;
    } | {
        useCount: number;
        freeLimit: number;
        hasSubscription: boolean;
        drugs: [number, string, string][];
        v: number;
        blocked?: undefined;
        reason?: undefined;
    }>;
    item(id: number, auth?: string): Promise<{
        blocked: boolean;
        reason: string;
        drug?: undefined;
    } | {
        drug: Record<string, unknown>;
        blocked?: undefined;
        reason?: undefined;
    }>;
    batch(count?: string, auth?: string): Promise<{
        blocked: boolean;
        reason: string;
    } | {
        hasSubscription: boolean;
        drugs: {
            drug: import("mysql2/promise").RowDataPacket & {
                id: number;
                name: string;
                drug_class: string | null;
                uses: string | null;
                dosage_adult: string | null;
                dosage_pediatric: string | null;
                side_effects: string | null;
                warnings: string | null;
                drug_interactions: string | null;
                pregnancy_info: string | null;
                sl_brand_names: string | null;
                is_active: number;
            };
            distractors: string[];
            questionType: "drug_class";
        }[];
        useCount: number;
        freeLimit: number;
        enabled: boolean;
        blocked?: undefined;
        reason?: undefined;
    }>;
    record(auth?: string, body?: {
        count?: number;
    }): Promise<{
        ok: boolean;
        reason?: undefined;
        useCount?: undefined;
        freeLimit?: undefined;
    } | {
        ok: boolean;
        reason: string;
        useCount: number;
        freeLimit: number;
    } | {
        ok: boolean;
        useCount: number;
        freeLimit: number;
        reason?: undefined;
    }>;
}
