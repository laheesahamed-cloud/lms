import { SetupService } from './setup.service';
export declare class SetupController {
    private readonly setupService;
    constructor(setupService: SetupService);
    getSetupStatus(): Promise<{
        overall: "error" | "ok" | "warning";
        generatedAt: string;
        database: {
            status: "ok" | "warning";
            connected: boolean;
            message: string;
            tables: {
                name: string;
                label: string;
                present: boolean;
                count: number | null;
            }[];
            configuration: {
                key: string;
                label: string;
                status: "error" | "ok" | "warning";
                value: string;
                detail: string;
            }[];
        } | {
            status: "error" | "ok" | "warning";
            connected: boolean;
            message: string;
            tables: never[];
            configuration: never[];
        };
        storage: {
            status: "error" | "ok" | "warning";
            message: string;
        };
    }>;
}
