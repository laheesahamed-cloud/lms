import { AuthService } from '../auth/auth.service';
import { DrugsService } from './drugs.service';
export declare class DrugsController {
    private readonly svc;
    private readonly authService;
    constructor(svc: DrugsService, authService: AuthService);
    spin(auth?: string): Promise<{
        blocked: boolean;
        reason: string;
        useCount?: undefined;
        freeLimit?: undefined;
        drug?: undefined;
        distractors?: undefined;
        questionType?: undefined;
        hasSubscription?: undefined;
    } | {
        blocked: boolean;
        reason: string;
        useCount: number;
        freeLimit: number;
        drug?: undefined;
        distractors?: undefined;
        questionType?: undefined;
        hasSubscription?: undefined;
    } | {
        blocked: boolean;
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
            use_count: number;
        };
        distractors: string[];
        questionType: string;
        useCount: number;
        freeLimit: number;
        hasSubscription: boolean;
        reason?: undefined;
    }>;
    usage(auth?: string): Promise<{
        useCount: number;
        freeLimit: number;
        enabled: boolean;
        hasSubscription: boolean;
    }>;
}
