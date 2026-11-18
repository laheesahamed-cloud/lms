import { Pool, PoolConnection } from 'mysql2/promise';
type Db = Pick<Pool, 'execute' | 'query'> | Pick<PoolConnection, 'execute' | 'query'>;
export type RecentResult = {
    userId: number;
    quizId: number;
    pct: number;
    passed: boolean;
    reviewed: boolean;
    at: string;
    day: string;
    questionCount: number;
    answers: Record<string, unknown>;
    correct: number | null;
    wrong: number | null;
};
export declare function parseRecentResults(userId: number, raw: unknown): RecentResult[];
export declare function loadRecentResults(db: Db, userId?: number | null): Promise<RecentResult[]>;
export type QuizInfo = {
    id: number;
    course_id: number | null;
    topic_id: number | null;
    quiz_title: string;
    student_title: string | null;
    quiz_number: number | null;
    display_title_mode: string | null;
    course_title: string | null;
};
export declare function loadQuizInfo(db: Db, quizIds: number[]): Promise<Map<number, QuizInfo>>;
export declare function mostMissedQuestions(db: Db, results: RecentResult[], limit?: number): Promise<{
    id: number;
    text: string;
    wrongCount: number;
}[]>;
export {};
