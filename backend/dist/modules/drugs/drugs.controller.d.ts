import { AuthService } from '../auth/auth.service';
import { DrugsService } from './drugs.service';
export declare class DrugsController {
    private readonly svc;
    private readonly authService;
    constructor(svc: DrugsService, authService: AuthService);
    batch(count?: string, auth?: string): Promise<{
        blocked: boolean;
        reason: string;
    } | {
        hasSubscription: boolean;
        drugs: {
            drug: import("mysql2").RowDataPacket & {
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
    record(auth?: string): Promise<{
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
