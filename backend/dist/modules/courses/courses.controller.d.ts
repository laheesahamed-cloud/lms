import { AuthService } from '../auth/auth.service';
import { CoursesService } from './courses.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { UpdateStudentLessonProgressDto } from './dto/update-student-lesson-progress.dto';
export declare class CoursesController {
    private readonly coursesService;
    private readonly authService;
    constructor(coursesService: CoursesService, authService: AuthService);
    findStudentCourses(authorization?: string): Promise<{
        subjectCount: any;
        progressPercent: any;
        completedLessonsCount: any;
        totalLessonsCount: any;
        actionLabel: string;
        id: number;
        courseTitle: string;
        courseCode: string;
        description: string;
        examType: string;
        status: "active" | "inactive";
        createdAt: string | null;
    }[]>;
    findStudentCourseDetail(id: number, authorization?: string): Promise<{
        course: {
            progressPercent: any;
            completedSubjectsCount: any;
            totalSubjectsCount: any;
            completedLessonsCount: any;
            totalLessonsCount: any;
            id: number;
            courseTitle: string;
            courseCode: string;
            description: string;
            examType: string;
            status: "active" | "inactive";
            createdAt: string | null;
        };
        subjects: any;
    }>;
    updateStudentLessonProgress(lessonId: number, dto: UpdateStudentLessonProgressDto, authorization?: string): Promise<{
        ok: boolean;
        lessonId: number;
        status: "in_progress" | "completed" | "not_started";
        progressPercent: number;
        actionLabel: string;
    }>;
    findAll(): Promise<{
        id: number;
        courseTitle: string;
        courseCode: string;
        description: string;
        examType: string;
        status: "active" | "inactive";
        createdAt: string | null;
    }[]>;
    create(authorization: string | undefined, createCourseDto: CreateCourseDto): Promise<{
        ok: boolean;
        id: number;
    }>;
    update(authorization: string | undefined, id: number, updateCourseDto: UpdateCourseDto): Promise<{
        ok: boolean;
        id: number;
    }>;
    remove(authorization: string | undefined, id: number): Promise<{
        ok: boolean;
        id: number;
    }>;
    listVersions(id: number): Promise<{
        id: number;
        versionNumber: number;
        createdBy: number | null;
        createdAt: any;
        snapshot: any;
    }[]>;
    markDraft(authorization: string | undefined, id: number): Promise<{
        ok: boolean;
        id: number;
        status: "active" | "inactive";
        workflowState: "draft" | "in_review" | "published" | "archived";
    }>;
    submitForReview(authorization: string | undefined, id: number): Promise<{
        ok: boolean;
        id: number;
        status: "active" | "inactive";
        workflowState: "draft" | "in_review" | "published" | "archived";
    }>;
    publish(authorization: string | undefined, id: number): Promise<{
        ok: boolean;
        id: number;
        status: "active" | "inactive";
        workflowState: "draft" | "in_review" | "published" | "archived";
    }>;
    rollback(authorization: string | undefined, id: number, versionNumber: number): Promise<{
        ok: boolean;
        id: number;
        rolledBackToVersion: number;
        status: "active" | "inactive";
        workflowState: "draft" | "published";
    }>;
}
