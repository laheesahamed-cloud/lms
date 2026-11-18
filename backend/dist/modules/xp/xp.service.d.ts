import { StudyStatsService } from '../study-stats/study-stats.service';
import { Pool } from 'mysql2/promise';
export type XpResult = {
    awarded: number;
    capped: boolean;
    reason?: 'low_score' | 'too_fast' | 'unverified' | 'too_soon' | 'nothing_new';
};
export declare class XpService {
    private readonly db;
    private readonly studyStats?;
    private readonly logger;
    constructor(db: Pool, studyStats?: StudyStatsService | undefined);
    onLessonCompleted(userId: number, lessonId: number, readSeconds?: number): Promise<XpResult & {
        progressVersion?: number;
    }>;
    markLessonOpened(_userId: number, _lessonId: number): Promise<void>;
    getSummary(userId: number, xpToday?: number, knownTotalXp?: number): Promise<{
        totalXp: number;
        xpToday: number;
        xpDailyCap: 100;
        level: number;
    }>;
}
