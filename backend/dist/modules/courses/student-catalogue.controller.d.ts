import { Pool } from 'mysql2/promise';
import { AuthService } from '../auth/auth.service';
import { StudyStatsService } from '../study-stats/study-stats.service';
import { StudentCatalogueService } from './student-catalogue.service';
export declare class StudentCatalogueController {
    private readonly db;
    private readonly authService;
    private readonly catalogue;
    private readonly studyStats;
    constructor(db: Pool, authService: AuthService, catalogue: StudentCatalogueService, studyStats: StudyStatsService);
    student(authorization: string | undefined, ifNoneMatch: string | undefined, acceptEncoding: string | undefined, res: any): Promise<void>;
    index(authorization: string | undefined, ifNoneMatch: string | undefined, acceptEncoding: string | undefined, res: any): Promise<void>;
    parts(authorization: string | undefined, courses: string | undefined, acceptEncoding: string | undefined, res: any, kind?: string): Promise<void>;
    private send;
    progress(authorization?: string, format?: string, version?: string): Promise<{
        quizzes?: unknown[] | undefined;
        access: {
            paid: boolean;
            full: boolean;
            courseIds: number[];
            lessonIds: number[];
            quizFull: boolean;
            quizCourseIds: number[];
            features: boolean;
            paidPlan: boolean;
        };
    }>;
}
