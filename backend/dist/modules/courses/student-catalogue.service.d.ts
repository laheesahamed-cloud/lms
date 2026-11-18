import { OnApplicationBootstrap, OnModuleInit } from '@nestjs/common';
import { Pool } from 'mysql2/promise';
import { CourseStructureService } from './course-structure.service';
export declare const CATALOGUE_FORMAT = 4;
export declare const PARTS_FORMAT = 5;
export type DeckLesson = {
    id: number;
    courseId: number;
    topicId: number | null;
    subtopicId: number | null;
    isFree: boolean;
    courseTitle: string;
    topicName: string;
    subtopicName: string;
    lessonTitle: string;
    approvedFlashcardCount: number;
    stamp?: number;
};
export type StudentCatalogue = {
    v: number;
    courses: Array<[number, string, string, string, string]>;
    subjects: Array<[number, number, string]>;
    topics: Array<[number, number, string]>;
    lessons: Array<[number, number, number, number, string, 0 | 1, 0 | 1, 0 | 1, 0 | 1, number, number, number]>;
    quizzes: Array<[number, number, number, number, number, 0 | 1, 0 | 1, 0 | 1, string, string, 0 | 1, number, number, number, number, 0 | 1, number]>;
};
export type ProgressOptions = {
    bits?: boolean;
    haveVersion?: number;
    haveUser?: number;
};
export declare function progressOptions(format: unknown, version: unknown): ProgressOptions;
export declare class StudentCatalogueService implements OnModuleInit, OnApplicationBootstrap {
    private readonly db;
    private readonly structure;
    private readonly logger;
    private current;
    private building;
    constructor(db: Pool, structure: CourseStructureService);
    onModuleInit(): void;
    onApplicationBootstrap(): void;
    private rebuildTimer;
    progressFor(userId: number, studyStats: {
        quizProgress(userId: number): Promise<unknown[]>;
        ensureBuilt(userId: number): Promise<void>;
    }, opts?: ProgressOptions): Promise<{
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
    get(): Promise<{
        v: number;
        json: string;
        gzip: Buffer;
        decks: DeckLesson[];
        quizCount: number;
        index: {
            json: string;
            gzip: Buffer;
        };
        parts: Map<number, {
            hash: string;
            json: string;
        }>;
        lessonParts: Map<number, {
            hash: string;
            json: string;
        }>;
        quizParts: Map<number, {
            hash: string;
            json: string;
        }>;
    }>;
    private build;
    private finish;
    private readonly file;
    private saveFile;
    private loadFile;
    private namesCache;
    names(): Promise<{
        v: number;
        quiz: Map<number, any[]>;
        lesson: Map<number, any[]>;
        course: Map<number, string>;
        subject: Map<number, string>;
        topic: Map<number, any[]>;
    }>;
    partsFor(courseIds: number[], kind?: string): Promise<{
        v: number;
        json: string;
        gzip: NonSharedBuffer;
    }>;
    private slices;
}
