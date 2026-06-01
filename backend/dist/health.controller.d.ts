import { ConfigService } from '@nestjs/config';
import { Pool } from 'mysql2/promise';
export declare class HealthController {
    private readonly db;
    private readonly configService;
    constructor(db: Pool, configService: ConfigService);
    check(): {
        ok: boolean;
        service: string;
        timestamp: string;
        uptimeSeconds: number;
    };
    ready(): Promise<{
        ok: boolean;
        service: string;
        checks: {
            database: {
                ok: boolean;
                latencyMs: number;
            };
        };
        timestamp: string;
    }>;
    metrics(healthToken?: string): Promise<{
        ok: boolean;
        service: string;
        uptimeSeconds: number;
        memory: {
            rss: number;
            heapUsed: number;
            heapTotal: number;
        };
        totals: {
            users: number;
            courses: number;
            lessons: number;
            questions: number;
            quizAttempts: number;
        };
        performance: {
            targets: Record<"authentication" | "dashboard" | "questionFetch" | "answerSave" | "reviewData" | "staticAsset" | "other", number>;
            api: Record<string, unknown>;
            client: {
                sampleCount: number;
                latest: {
                    metric: string;
                    route: string;
                    value: number;
                    target?: number;
                    timestamp: string;
                }[];
            };
        };
        timestamp: string;
    }>;
    clientPerformance(body: unknown): {
        ok: boolean;
    };
    private requireMetricsAccess;
}
