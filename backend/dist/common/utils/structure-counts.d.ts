import { Pool, PoolConnection } from 'mysql2/promise';
type Executor = Pick<Pool, 'execute' | 'query'> | Pick<PoolConnection, 'execute' | 'query'>;
export declare const COUNTED_LESSON = "is_public = 1 AND engine_key = 'gemini'";
export declare function isCountedLesson(row: Record<string, any> | null | undefined): boolean;
export declare function bumpCounts(conn: Executor, table: 'courses' | 'topics' | 'questions', column: 'lesson_count' | 'subject_count' | 'subtopic_count' | 'quiz_total' | 'quiz_active' | 'quiz_general_total' | 'quiz_general_active' | 'quiz_unfiled_total' | 'quiz_unfiled_active' | 'quiz_count' | 'question_total', changes: Array<[number | null | undefined, number]>): Promise<void>;
export declare function moveLessonCounts(conn: Executor, before: {
    course_id: unknown;
    topic_id: unknown;
    counted: boolean;
}, after: {
    course_id: unknown;
    topic_id: unknown;
    counted: boolean;
}): Promise<void>;
export declare function recountStructure(db: Executor): Promise<void>;
export type CountIssue = {
    level: 'course' | 'subject';
    id: number;
    name: string;
    field: 'lesson_count' | 'subject_count' | 'subtopic_count' | 'quiz_total' | 'quiz_active' | 'quiz_general_total' | 'quiz_general_active' | 'quiz_unfiled_total' | 'quiz_unfiled_active';
    stored: number;
    actual: number;
};
export declare function checkStructureCounts(db: Executor): Promise<CountIssue[]>;
export declare const FIX_REQUEST_ROW_BUDGET = 980;
export declare class CountFixBusyError extends Error {
}
type FixCourse = {
    id: number;
    name: string;
    lessonCount: number;
    subjectCount: number;
};
type SetOutcome = {
    fixed: CountIssue[];
    changed: CountIssue[];
    courseLessons: Record<number, number>;
    rowsRead: number;
};
type FinishTotals = Array<{
    id: number;
    lessons: number;
    expectedLessons: number;
    expectedSubjects: number;
}>;
export declare const COUNTS_CHECKED_AT_KEY = "structure_counts_checked_at";
export declare function quickCountFix(db: Executor, opts?: {
    bumpStamps?: boolean;
}): Promise<{
    needFull: boolean;
    reason: "first-run";
    changedSubjects?: undefined;
    done?: undefined;
    since?: undefined;
    subjectsChecked?: undefined;
    coursesChecked?: undefined;
    rowsRead?: undefined;
    fixed?: undefined;
    changed?: undefined;
} | {
    needFull: boolean;
    reason: "too-many-changes";
    changedSubjects: number;
    done?: undefined;
    since?: undefined;
    subjectsChecked?: undefined;
    coursesChecked?: undefined;
    rowsRead?: undefined;
    fixed?: undefined;
    changed?: undefined;
} | {
    needFull: boolean;
    done: boolean;
    since: string;
    subjectsChecked: number;
    coursesChecked: number;
    rowsRead: number;
    fixed: CountIssue[];
    changed: CountIssue[];
    reason?: undefined;
    changedSubjects?: undefined;
}>;
export declare function startCountFix(db: Executor, courseId?: number, opts?: {
    bumpStamps?: boolean;
}): Promise<{
    runId: string;
    courses: FixCourse[];
    first: SetOutcome;
    remaining: number[][];
    finishWithLast: boolean;
    done: boolean;
    bumpedStamps: boolean;
    finish: {
        fixed: CountIssue[];
        changed: CountIssue[];
    } | null;
}>;
export declare function runCountFixSet(db: Executor, runId: string, subjectIds: number[], finish?: FinishTotals): Promise<{
    done: boolean;
    finish: null;
    fixed: CountIssue[];
    changed: CountIssue[];
    courseLessons: Record<number, number>;
    rowsRead: number;
} | {
    done: boolean;
    finish: {
        fixed: CountIssue[];
        changed: CountIssue[];
    };
    bumpedStamps: boolean;
    fixed: CountIssue[];
    changed: CountIssue[];
    courseLessons: Record<number, number>;
    rowsRead: number;
}>;
export declare function finishCountFix(db: Executor, runId: string, totals: FinishTotals): Promise<{
    done: boolean;
    bumpedStamps: boolean;
    fixed: CountIssue[];
    changed: CountIssue[];
}>;
export {};
