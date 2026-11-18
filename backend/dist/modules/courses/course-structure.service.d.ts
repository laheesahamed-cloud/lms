import { OnModuleInit } from '@nestjs/common';
import { Pool, RowDataPacket } from 'mysql2/promise';
export type StructureCourse = RowDataPacket & {
    id: number;
    course_title: string;
    course_code: string;
    description: string | null;
    exam_type: string;
    status: 'active' | 'inactive';
    created_at?: string | null;
};
export type StructureSubject = RowDataPacket & {
    id: number;
    course_id: number;
    topic_name: string;
    status?: string | null;
};
export type StructureTopic = RowDataPacket & {
    id: number;
    topic_id: number;
    subtopic_name: string;
    status?: string | null;
    course_id: number;
};
export type StructureLesson = RowDataPacket & {
    id: number;
    course_id: number;
    topic_id: number;
    subtopic_id: number | null;
    lesson_title: string;
    video_url: string | null;
    is_free: number;
    status: 'active' | 'inactive';
    has_note?: number;
    has_pdf?: number;
    engine_key?: string;
    updated_ts?: number;
};
export type CourseStructure = {
    format?: number;
    version: number;
    builtAt: string;
    courses: StructureCourse[];
    subjects: StructureSubject[];
    topics: StructureTopic[];
    lessons: StructureLesson[];
};
export declare class CourseStructureService implements OnModuleInit {
    private readonly db;
    private readonly logger;
    private snapshot;
    private building;
    private again;
    private readonly file;
    constructor(db: Pool);
    onModuleInit(): void;
    get(): Promise<CourseStructure>;
    rebuild(): Promise<CourseStructure>;
    private readsInBuild;
    private build;
    private slices;
    private loadFile;
    private saveFile;
}
