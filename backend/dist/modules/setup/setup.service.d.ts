import { ConfigService } from '@nestjs/config';
import { Pool } from 'mysql2/promise';
type SetupStatus = 'ok' | 'warning' | 'error';
type TableCheck = {
    name: string;
    label: string;
    present: boolean;
    count: number | null;
};
export declare class SetupService {
    private readonly db;
    private readonly configService;
    constructor(db: Pool, configService: ConfigService);
    getSetupStatus(): Promise<{
        overall: SetupStatus;
        generatedAt: string;
        database: {
            status: "ok" | "warning";
            connected: boolean;
            message: string;
            tables: TableCheck[];
            configuration: {
                key: string;
                label: string;
                status: SetupStatus;
                value: string;
                detail: string;
            }[];
        } | {
            status: SetupStatus;
            connected: boolean;
            message: string;
            tables: never[];
            configuration: never[];
        };
        storage: {
            status: SetupStatus;
            message: string;
        };
    }>;
    private getDatabaseStatus;
    private getTableCheck;
    private getConfigurationChecks;
    private getSettingsMap;
    private countAiProviders;
    private countActiveAdmins;
    private getStorageStatus;
}
export {};
