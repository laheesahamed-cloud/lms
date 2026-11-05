import { SetupService } from './setup.service';
export declare class SetupController {
    private readonly setupService;
    constructor(setupService: SetupService);
    getSetupStatus(): Promise<{
        overall: "warning" | "ok" | "error";
        generatedAt: string;
        database: {
            status: "warning" | "ok";
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
                status: "warning" | "ok" | "error";
                value: string;
                detail: string;
            }[];
        } | {
            status: "warning" | "ok" | "error";
            connected: boolean;
            message: string;
            tables: never[];
            configuration: never[];
        };
        storage: {
            status: "warning" | "ok" | "error";
            message: string;
        };
    }>;
}
