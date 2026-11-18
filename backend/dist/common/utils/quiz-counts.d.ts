import { Pool, PoolConnection } from 'mysql2/promise';
type Executor = Pick<Pool, 'execute' | 'query'> | Pick<PoolConnection, 'execute' | 'query'>;
export type QuizState = {
    id: number;
    course_id: number | null;
    topic_id: number | null;
    is_general: number;
    status: string;
};
export declare function readQuizStates(conn: Executor, ids: number[], lock: boolean): Promise<QuizState[]>;
export declare function readSubjectQuizStates(conn: Executor, topicId: number): Promise<QuizState[]>;
export declare function applyQuizCountChanges(conn: Executor, before: QuizState[], after: QuizState[]): Promise<void>;
export declare function recountQuizCounts(db: Executor): Promise<void>;
export declare function recountCourseQuizTotals(db: Executor): Promise<void>;
export type QuestionCourse = {
    id: number;
    course_id: number;
};
export declare function readQuestionCourses(conn: Executor, ids: number[]): Promise<QuestionCourse[]>;
export declare function applyQuestionTotalChanges(conn: Executor, before: QuestionCourse[], after: QuestionCourse[]): Promise<void>;
export declare function recountCourseQuestionTotals(db: Executor): Promise<void>;
export declare function linkCountsForQuizzes(conn: Executor, quizIds: number[]): Promise<Map<number, number>>;
export declare function bumpQuestionLinkCounts(conn: Executor, changes: Array<[number, number]>): Promise<void>;
export declare function recountQuestionLinks(db: Executor): Promise<void>;
export declare const LINK_FIX_BATCH = 400;
export declare function fixQuestionLinkCounts(db: Executor, after: number): Promise<{
    lastId: number;
    done: boolean;
    maxId: number;
    fixed: {
        id: number;
        stored: number;
        actual: number;
    }[];
    changed: {
        id: number;
        stored: number;
        actual: number;
    }[];
    courseCounts: Record<number, number>;
    courseTotals: Record<number, number> | undefined;
}>;
export declare function fixCourseQuestionTotals(db: Executor, counts: Record<string, number>, expected: Record<string, number>): Promise<{
    fixed: {
        id: number;
        name: string;
        stored: number;
        actual: number;
    }[];
    changed: {
        id: number;
        name: string;
        stored: number;
        actual: number;
    }[];
}>;
export {};
