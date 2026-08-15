import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
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
};
export declare class DrugsService implements OnModuleInit, OnModuleDestroy {
    private readonly db;
    private readonly logger;
    private settingsCache;
    private refreshTimer;
    constructor(db: Pool);
    onModuleInit(): void;
    onModuleDestroy(): void;
    private refreshSettings;
    getSettings(): DrugsSettings;
    getBatch(userId: number, count: number): Promise<{
        drugs: {
            drug: DrugRow;
            distractors: string[];
            questionType: "drug_class";
        }[];
        useCount: number;
        freeLimit: number;
        enabled: boolean;
    }>;
    checkSubscription(userId: number): Promise<boolean>;
    getSpinCount(userId: number): Promise<number>;
    recordSpin(userId: number): Promise<void>;
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
    importDrugs(buffer: Buffer, filename: string): Promise<{
        inserted: number;
        skipped: number;
    }>;
    deleteDrug(id: number): Promise<void>;
    updateFeatureSettings(enabled: boolean, freeLimit: number): Promise<void>;
}
export {};
