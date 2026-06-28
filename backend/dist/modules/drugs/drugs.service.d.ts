import { OnModuleInit } from '@nestjs/common';
import { Pool, RowDataPacket } from 'mysql2/promise';
export interface DrugsSettings {
    enabled: boolean;
    freeLimit: number;
}
type DrugRow = RowDataPacket & {
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
export declare class DrugsService implements OnModuleInit {
    private readonly db;
    private readonly logger;
    private settingsCache;
    private refreshTimer;
    constructor(db: Pool);
    onModuleInit(): void;
    private refreshSettings;
    getSettings(): DrugsSettings;
    spin(userId: number): Promise<{
        drug: DrugRow;
        useCount: number;
        freeLimit: number;
        enabled: boolean;
        distractors: string[];
        questionType: string;
    }>;
    listDrugs(page: number, limit: number, search: string): Promise<{
        drugs: RowDataPacket[];
        total: number;
        page: number;
        limit: number;
    }>;
    getDrug(id: number): Promise<RowDataPacket>;
    createDrug(data: Record<string, any>): Promise<{
        id: any;
    }>;
    updateDrug(id: number, data: Record<string, any>): Promise<void>;
    toggleDrug(id: number): Promise<void>;
    getUsageCount(userId: number): Promise<number>;
    deleteDrug(id: number): Promise<void>;
    updateFeatureSettings(enabled: boolean, freeLimit: number): Promise<void>;
}
export {};
