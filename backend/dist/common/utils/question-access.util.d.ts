import { Pool } from 'mysql2/promise';
export declare function studentCanReadQuestion(db: Pool, userId: number, questionId: number): Promise<boolean>;
export declare function loadStudentCourseAccess(db: Pool, userId: number): Promise<{
    full: boolean;
    courseIds: Set<number>;
}>;
