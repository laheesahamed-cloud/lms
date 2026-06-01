import { AiNotesService } from './ai-notes.service';
declare class GenerateDto {
    text: string;
}
declare class CreateNoteDto {
    title: string;
    rawText?: string;
    courseId?: number;
    topicId?: number;
    subtopicId?: number;
    lessonId?: number;
    isFree?: number;
    videoUrl?: string;
}
declare class UpdateNoteDto {
    title?: string;
    rawText?: string;
    noteData?: unknown;
    status?: string;
    courseId?: number | null;
    topicId?: number | null;
    subtopicId?: number | null;
    lessonId?: number | null;
    videoUrl?: string | null;
    isFree?: number | null;
}
declare class GenerateLessonFlashcardsDto {
    count?: number;
}
declare class CreateLessonFlashcardDto {
    question: string;
    answer: string;
    sourceHint?: string;
    status?: 'draft' | 'approved' | 'rejected';
}
declare class UpdateLessonFlashcardDto {
    question?: string;
    answer?: string;
    sourceHint?: string;
    status?: 'draft' | 'approved' | 'rejected';
    sortOrder?: number;
}
export declare class AiNotesController {
    private readonly svc;
    constructor(svc: AiNotesService);
    generate(dto: GenerateDto, engineKey: string, auth: string): Promise<import("./ai-notes.service").NoteCanvas>;
    adminList(engineKey: string, auth: string): Promise<{
        id: number;
        title: string;
        rawText: string | null;
        noteData: unknown;
        engineKey: "openai" | "gemini";
        courseId: number | null;
        topicId: number | null;
        subtopicId: number | null;
        lessonId: number | null;
        videoUrl: string;
        isFree: boolean;
        status: "active" | "inactive";
        courseTitle: string | null;
        topicName: string | null;
        subtopicName: string | null;
        lessonTitle: string | null;
        lessonProgressStatus: "not_started" | "in_progress" | "completed";
        lessonProgressPercent: number;
        lessonCompletedAt: string | null;
        lessonCompleted: boolean;
        createdAt: string;
        updatedAt: string;
    }[]>;
    adminCreate(dto: CreateNoteDto, engineKey: string, auth: string): Promise<{
        id: number;
        title: string;
    }>;
    getLessonCanvases(engineKey: string, auth: string): Promise<import("mysql2").RowDataPacket[]>;
    adminListFlashcards(id: number, engineKey: string, auth: string): Promise<{
        id: number;
        noteId: number;
        lessonId: number | null;
        question: string;
        answer: string;
        sourceHint: string;
        status: "draft" | "approved" | "rejected";
        sortOrder: number;
        generatedBy: "ai" | "manual";
        reviewedBy: number | null;
        createdAt: string;
        updatedAt: string;
    }[]>;
    adminCreateFlashcard(id: number, dto: CreateLessonFlashcardDto, engineKey: string, auth: string): Promise<{
        id: number;
        noteId: number;
        lessonId: number | null;
        question: string;
        answer: string;
        sourceHint: string;
        status: "draft" | "approved" | "rejected";
        sortOrder: number;
        generatedBy: "ai" | "manual";
        reviewedBy: number | null;
        createdAt: string;
        updatedAt: string;
    }>;
    adminGenerateFlashcards(id: number, dto: GenerateLessonFlashcardsDto, engineKey: string, auth: string): Promise<{
        ok: boolean;
        createdCount: number;
        provider: {
            key: "openai" | "gemini" | "claude" | "openrouter";
            label: string;
            model: string;
        };
        items: {
            id: number;
            noteId: number;
            lessonId: number | null;
            question: string;
            answer: string;
            sourceHint: string;
            status: "draft" | "approved" | "rejected";
            sortOrder: number;
            generatedBy: "ai" | "manual";
            reviewedBy: number | null;
            createdAt: string;
            updatedAt: string;
        }[];
    }>;
    adminUpdateFlashcard(id: number, cardId: number, dto: UpdateLessonFlashcardDto, engineKey: string, auth: string): Promise<{
        id: number;
        noteId: number;
        lessonId: number | null;
        question: string;
        answer: string;
        sourceHint: string;
        status: "draft" | "approved" | "rejected";
        sortOrder: number;
        generatedBy: "ai" | "manual";
        reviewedBy: number | null;
        createdAt: string;
        updatedAt: string;
    }>;
    adminRemoveFlashcard(id: number, cardId: number, engineKey: string, auth: string): Promise<{
        ok: boolean;
        id: number;
    }>;
    getCourses(auth: string): Promise<(import("mysql2").RowDataPacket & {
        id: number;
        name: string;
    })[]>;
    getTopics(courseId: string, auth: string): Promise<(import("mysql2").RowDataPacket & {
        id: number;
        name: string;
    })[]>;
    getSubtopics(topicId: string, auth: string): Promise<(import("mysql2").RowDataPacket & {
        id: number;
        name: string;
    })[]>;
    getLessons(subtopicId: string, auth: string): Promise<(import("mysql2").RowDataPacket & {
        id: number;
        name: string;
    })[]>;
    adminFindOne(id: number, engineKey: string, auth: string): Promise<{
        id: number;
        title: string;
        rawText: string | null;
        noteData: unknown;
        engineKey: "openai" | "gemini";
        courseId: number | null;
        topicId: number | null;
        subtopicId: number | null;
        lessonId: number | null;
        videoUrl: string;
        isFree: boolean;
        status: "active" | "inactive";
        courseTitle: string | null;
        topicName: string | null;
        subtopicName: string | null;
        lessonTitle: string | null;
        lessonProgressStatus: "not_started" | "in_progress" | "completed";
        lessonProgressPercent: number;
        lessonCompletedAt: string | null;
        lessonCompleted: boolean;
        createdAt: string;
        updatedAt: string;
    }>;
    adminUpdate(id: number, dto: UpdateNoteDto, engineKey: string, auth: string): Promise<{
        id: number;
    }>;
    adminRemove(id: number, engineKey: string, auth: string): Promise<{
        deleted: boolean;
    }>;
    studentList(engineKey: string, auth: string): Promise<{
        approvedFlashcardCount: number;
        cardCount: number;
        canAccess: boolean;
        accessLocked: boolean;
        upgradeLabel: string;
        lockReason: string;
        noteData: unknown;
        id: number;
        title: string;
        rawText: string | null;
        engineKey: "openai" | "gemini";
        courseId: number | null;
        topicId: number | null;
        subtopicId: number | null;
        lessonId: number | null;
        videoUrl: string;
        isFree: boolean;
        status: "active" | "inactive";
        courseTitle: string | null;
        topicName: string | null;
        subtopicName: string | null;
        lessonTitle: string | null;
        lessonProgressStatus: "not_started" | "in_progress" | "completed";
        lessonProgressPercent: number;
        lessonCompletedAt: string | null;
        lessonCompleted: boolean;
        createdAt: string;
        updatedAt: string;
    }[]>;
    studentFindByLesson(lessonId: number, engineKey: string, auth: string): Promise<{
        flashcards: {
            id: number;
            noteId: number;
            lessonId: number | null;
            question: string;
            answer: string;
            sourceHint: string;
            status: "draft" | "approved" | "rejected";
            sortOrder: number;
            generatedBy: "ai" | "manual";
            reviewedBy: number | null;
            createdAt: string;
            updatedAt: string;
        }[];
        approvedFlashcardCount: number;
        cardCount: number;
        canAccess: boolean;
        accessLocked: boolean;
        upgradeLabel: string;
        lockReason: string;
        noteData: unknown;
        id: number;
        title: string;
        rawText: string | null;
        engineKey: "openai" | "gemini";
        courseId: number | null;
        topicId: number | null;
        subtopicId: number | null;
        lessonId: number | null;
        videoUrl: string;
        isFree: boolean;
        status: "active" | "inactive";
        courseTitle: string | null;
        topicName: string | null;
        subtopicName: string | null;
        lessonTitle: string | null;
        lessonProgressStatus: "not_started" | "in_progress" | "completed";
        lessonProgressPercent: number;
        lessonCompletedAt: string | null;
        lessonCompleted: boolean;
        createdAt: string;
        updatedAt: string;
    }>;
    studentFindOne(id: number, engineKey: string, auth: string): Promise<{
        flashcards: {
            id: number;
            noteId: number;
            lessonId: number | null;
            question: string;
            answer: string;
            sourceHint: string;
            status: "draft" | "approved" | "rejected";
            sortOrder: number;
            generatedBy: "ai" | "manual";
            reviewedBy: number | null;
            createdAt: string;
            updatedAt: string;
        }[];
        approvedFlashcardCount: number;
        cardCount: number;
        canAccess: boolean;
        accessLocked: boolean;
        upgradeLabel: string;
        lockReason: string;
        noteData: unknown;
        id: number;
        title: string;
        rawText: string | null;
        engineKey: "openai" | "gemini";
        courseId: number | null;
        topicId: number | null;
        subtopicId: number | null;
        lessonId: number | null;
        videoUrl: string;
        isFree: boolean;
        status: "active" | "inactive";
        courseTitle: string | null;
        topicName: string | null;
        subtopicName: string | null;
        lessonTitle: string | null;
        lessonProgressStatus: "not_started" | "in_progress" | "completed";
        lessonProgressPercent: number;
        lessonCompletedAt: string | null;
        lessonCompleted: boolean;
        createdAt: string;
        updatedAt: string;
    }>;
}
export {};
