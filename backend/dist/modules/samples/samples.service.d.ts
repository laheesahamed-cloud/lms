import { OnApplicationBootstrap } from '@nestjs/common';
import { Pool } from 'mysql2/promise';
import { LessonsService } from '../lessons/lessons.service';
import { QuizAttemptsService } from '../quiz-attempts/quiz-attempts.service';
import { CourseStructureService } from '../courses/course-structure.service';
type Body = {
    json: string;
    gzip: Buffer;
};
type Bundle = {
    v: number;
    index: Body;
    lessons: Map<number, Body>;
    quizzes: Map<number, Body>;
    decks: Map<number, Body>;
};
export declare class SamplesService implements OnApplicationBootstrap {
    private readonly db;
    private readonly lessons;
    private readonly quizzes;
    private readonly structure;
    private readonly logger;
    private current;
    private building;
    private readonly file;
    constructor(db: Pool, lessons: LessonsService, quizzes: QuizAttemptsService, structure: CourseStructureService);
    onApplicationBootstrap(): void;
    get(): Promise<Bundle>;
    private body;
    private load;
    private fromData;
    private build;
}
export {};
