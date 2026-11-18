import { AuthService } from '../auth/auth.service';
import { CoursesService } from './courses.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { UpdateStudentLessonProgressDto } from './dto/update-student-lesson-progress.dto';
export declare class CoursesController {
    private readonly coursesService;
    private readonly authService;
    constructor(coursesService: CoursesService, authService: AuthService);
    getLandingSummary(): Promise<{
        topics: {
            id: number;
            name: string;
            questionCount: number;
        }[];
        courses: {
            id: number;
            title: string;
        }[];
    }>;
    findStudentCourses(authorization?: string): Promise<{
        subjectCount: any;
        progressPercent: any;
        completedLessonsCount: any;
        totalLessonsCount: any;
        actionLabel: string;
        lessonCount?: number | undefined;
        sortOrder?: number | undefined;
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
            subjectCount?: number | undefined;
            lessonCount?: number | undefined;
            sortOrder?: number | undefined;
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
        progressVersion?: number | undefined;
        ok: boolean;
        lessonId: number;
        status: "completed";
        progressPercent: number;
        actionLabel: string;
        xp: {
            awarded: number;
            capped: boolean;
            reason?: "low_score" | "too_fast" | "unverified" | "too_soon" | "nothing_new";
        };
    } | {
        ok: boolean;
        lessonId: number;
        status: "completed" | "not_started" | "in_progress";
        progressPercent: number;
        actionLabel: string;
    }>;
    markStudentLessonOpened(lessonId: number, authorization?: string): Promise<{
        ok: boolean;
    }>;
    findAll(): Promise<{
        subjectCount?: number | undefined;
        lessonCount?: number | undefined;
        sortOrder?: number | undefined;
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
    listVersions(id: number): Promise<never[]>;
    markDraft(authorization: string | undefined, id: number): Promise<{
        ok: boolean;
        id: number;
        status: "active" | "inactive";
        workflowState: "published" | "draft" | "in_review" | "archived";
    }>;
    submitForReview(authorization: string | undefined, id: number): Promise<{
        ok: boolean;
        id: number;
        status: "active" | "inactive";
        workflowState: "published" | "draft" | "in_review" | "archived";
    }>;
    publish(authorization: string | undefined, id: number): Promise<{
        ok: boolean;
        id: number;
        status: "active" | "inactive";
        workflowState: "published" | "draft" | "in_review" | "archived";
    }>;
    rollback(authorization: string | undefined, id: number, versionNumber: number): Promise<void>;
}
