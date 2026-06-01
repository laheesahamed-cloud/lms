import { SetupService } from './setup.service';
export declare class SetupController {
    private readonly setupService;
    constructor(setupService: SetupService);
    getSetupStatus(): Promise<{
        overall: "ok" | "warning" | "error";
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
                status: "ok" | "warning" | "error";
                value: string;
                detail: string;
            }[];
        } | {
            status: "ok" | "warning" | "error";
            connected: boolean;
            message: string;
            tables: never[];
            configuration: never[];
        };
        storage: {
            status: "ok" | "warning" | "error";
            message: string;
        };
    }>;
}
