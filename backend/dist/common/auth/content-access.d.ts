export type ScopeRowLike = {
    plan_slug: string | null;
    access_scope: string | null;
    course_ids_json: string | null;
    lesson_ids_json?: string | null;
};
export type ContentAccess = {
    paid: boolean;
    full: boolean;
    courseIds: Set<number>;
    lessonIds: Set<number>;
    quizFull: boolean;
    quizCourseIds: Set<number>;
};
export declare function buildContentAccess(rows: ScopeRowLike[]): ContentAccess;
export declare function canOpenLesson(a: ContentAccess, lesson: {
    id: number;
    courseId: number;
    isFree: boolean;
}, appOnlyBlocked?: boolean): boolean;
