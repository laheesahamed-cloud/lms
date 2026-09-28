import { ConfigService } from '@nestjs/config';
import { Pool } from 'mysql2/promise';
export declare class OsceGeneratorService {
    private readonly db;
    private readonly config;
    private readonly logger;
    constructor(db: Pool, config: ConfigService);
    generateCase(condition: string, systemKey: string, notes?: string, stationType?: 'short' | 'long'): Promise<{
        summary: string;
        document: any;
        warnings: string[];
    }>;
    private buildLongCasePrompt;
    private normalizeLongCase;
    generateImage(prompt: string, preferredModel?: string): Promise<string | null>;
    listImageModels(): Promise<Array<{
        name: string;
        label: string;
        description?: string;
    }>>;
    private buildPrompt;
    private normalize;
    private clamp01;
    private resolveProvider;
    private decrypt;
    private callProvider;
    private callGemini;
    private callChat;
    private parseJson;
}
