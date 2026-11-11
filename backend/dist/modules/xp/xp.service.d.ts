import { Pool } from 'mysql2/promise';
export type XpResult = {
    awarded: number;
    capped: boolean;
    reason?: 'low_score' | 'too_fast' | 'unverified' | 'too_soon' | 'nothing_new';
};
export declare class XpService {
    private readonly db;
    private readonly logger;
    constructor(db: Pool);
    onExamSubmitted(userId: number, attemptId: number): Promise<XpResult>;
    onLessonCompleted(userId: number, lessonId: number): Promise<XpResult>;
    markLessonOpened(userId: number, lessonId: number): Promise<void>;
    getSummary(userId: number): Promise<{
        totalXp: number;
        xpToday: number;
        xpDailyCap: 100;
        level: number;
    }>;
    private streakEntries;
    private award;
}
