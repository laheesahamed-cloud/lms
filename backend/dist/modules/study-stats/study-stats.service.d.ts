import { Pool, PoolConnection } from 'mysql2/promise';
export declare const MIN_ANSWERED = 10;
export type AreaLevel = 1 | 2 | 3;
export type AnswerStatus = 'correct' | 'wrong' | 'unanswered';
export type MarkedQuestion = {
    course_id: number | null;
    topic_id: number | null;
    subtopic_id?: number | null;
    status: AnswerStatus;
};
export type AreaRow = {
    level: AreaLevel;
    area_id: number;
    course_id: number;
    subject_id: number;
    correct: number;
    wrong: number;
    answered: number;
    wrong_rate: number;
    last_wrong_at: string | null;
};
export type DayRow = {
    day: string;
    exams: number;
    exam_pct_sum: number;
    practice: number;
    lessons: number;
    results_viewed: number;
    subject_ids: string;
    xp: number;
    active: number;
    flashcards?: number;
};
export type StudySummary = {
    attemptsTotal: number;
    passedTotal: number;
    averagePercentage: number;
    streak: number;
    streakGraceActive: boolean;
    today: DayRow;
    todayBits: number;
    totalXp: number;
    recentDays?: DayRow[];
    lastActiveDay: string;
    recentResults: Array<{
        pct: number;
        at: string;
    }>;
};
export declare class StudyStatsService {
    private readonly db;
    private readonly built;
    private readonly building;
    constructor(db: Pool);
    static todayKey(): string;
    ensureBuilt(userId: number): Promise<void>;
    recordExam(conn: PoolConnection, userId: number, exam: {
        quizId?: number;
        attemptId?: number;
        courseId?: number;
        subjectId: number | null;
        percentage: number;
        passed: boolean;
        questions: MarkedQuestion[];
        isGeneral?: boolean;
        eligible?: boolean;
    }): Promise<{
        examAttempts: number;
        xpBase: number;
        xpAwarded: number;
    }>;
    attemptsPruned(_conn: PoolConnection, _userId: number, _quizId: number, _pruned: number): Promise<void>;
    quizProgress(_userId: number): Promise<unknown[]>;
    summary(userId: number): Promise<StudySummary>;
}
