"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var SamplesService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SamplesService = void 0;
const common_1 = require("@nestjs/common");
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const node_zlib_1 = require("node:zlib");
const database_tokens_1 = require("../../database/database.tokens");
const content_version_1 = require("../../common/utils/content-version");
const lessons_service_1 = require("../lessons/lessons.service");
const quiz_attempts_service_1 = require("../quiz-attempts/quiz-attempts.service");
const course_structure_service_1 = require("../courses/course-structure.service");
const FILE_FORMAT = 3;
let SamplesService = SamplesService_1 = class SamplesService {
    constructor(db, lessons, quizzes, structure) {
        this.db = db;
        this.lessons = lessons;
        this.quizzes = quizzes;
        this.structure = structure;
        this.logger = new common_1.Logger(SamplesService_1.name);
        this.current = null;
        this.building = null;
        this.file = (0, node_path_1.join)(process.env.CACHE_DIR || (0, node_path_1.join)(process.cwd(), 'storage', 'cache'), 'public-samples.json');
    }
    onApplicationBootstrap() {
        (0, content_version_1.onContentVersionChange)(() => { this.current = null; });
    }
    async get() {
        const version = await (0, content_version_1.getContentVersion)(this.db);
        if (this.current && this.current.v === version)
            return this.current;
        if (!this.building) {
            this.building = this.load(version).finally(() => { this.building = null; });
        }
        return this.building;
    }
    body(value) {
        const json = JSON.stringify(value);
        return { json, gzip: (0, node_zlib_1.gzipSync)(Buffer.from(json), { level: 9 }) };
    }
    async load(version) {
        try {
            const saved = JSON.parse(await (0, promises_1.readFile)(this.file, 'utf8'));
            if (saved?.format === FILE_FORMAT && Number(saved.v) === version) {
                this.current = this.fromData(version, saved.data);
                return this.current;
            }
        }
        catch { }
        const data = await this.build(version);
        this.current = this.fromData(version, data);
        try {
            await (0, promises_1.mkdir)((0, node_path_1.join)(this.file, '..'), { recursive: true });
            const tmp = `${this.file}.tmp`;
            await (0, promises_1.writeFile)(tmp, JSON.stringify({ format: FILE_FORMAT, v: version, data }));
            await (0, promises_1.rename)(tmp, this.file);
        }
        catch (e) {
            this.logger.warn(`Samples file not written: ${e?.message || e}`);
        }
        return this.current;
    }
    fromData(version, data) {
        return {
            v: version,
            index: this.body(data.index),
            lessons: new Map(Object.entries(data.lessons || {}).map(([id, v]) => [Number(id), this.body(v)])),
            quizzes: new Map(Object.entries(data.quizzes || {}).map(([id, v]) => [Number(id), this.body(v)])),
            decks: new Map(Object.entries(data.decks || {}).map(([id, v]) => [Number(id), this.body(v)])),
        };
    }
    async build(version) {
        const snapshot = await this.structure.get();
        const freeLessons = await this.lessons.freeSamples();
        const freeQuizzes = await this.quizzes.freeSamples();
        const deckIds = new Set(freeLessons.decks.map((d) => d.lessonId));
        const courses = snapshot.courses.map((c) => {
            const id = Number(c.id);
            const lessons = freeLessons.lessons.filter((l) => Number(l.item.courseId) === id).map((l) => l.item);
            const quizzes = freeQuizzes.quizzes.filter((q) => Number(q.item.courseId) === id).map((q) => q.item);
            const decks = lessons.filter((l) => deckIds.has(Number(l.id)));
            return {
                id,
                courseTitle: String(c.course_title || ''),
                examType: String(c.exam_type || ''),
                lessons,
                quizzes,
                decks,
            };
        });
        this.logger.log(`Public samples v${version}: ${freeLessons.lessons.length} lessons, ${freeQuizzes.quizzes.length} quizzes, ${freeLessons.decks.length} decks`);
        const dailyQuestions = freeQuizzes.quizzes.flatMap((q) => {
            const question = (q.full.questions || []).find((x) => x.questionType === 'sba');
            if (!question)
                return [];
            return [{
                    id: Number(question.id),
                    questionType: question.questionType,
                    questionText: question.questionText,
                    courseTitle: String(q.item.courseTitle || ''),
                    subjectName: String(q.item.subjectName || ''),
                    topicName: String(q.item.topicName || q.item.subjectName || ''),
                    options: (question.options || []).map((o) => ({
                        id: Number(o.id), optionLabel: o.optionLabel, optionText: o.optionText, isCorrect: Number(o.isCorrect) === 1,
                    })),
                }];
        });
        return {
            index: { v: version, courses, dailyQuestions },
            lessons: Object.fromEntries(freeLessons.lessons.map((l) => [Number(l.item.id), l.full])),
            quizzes: Object.fromEntries(freeQuizzes.quizzes.map((q) => [Number(q.item.id), q.full])),
            decks: Object.fromEntries(freeLessons.decks.map((d) => [d.lessonId, { lessonId: d.lessonId, flashcards: d.flashcards }])),
        };
    }
};
exports.SamplesService = SamplesService;
exports.SamplesService = SamplesService = SamplesService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_tokens_1.DATABASE_CONNECTION)),
    __metadata("design:paramtypes", [Object, lessons_service_1.LessonsService,
        quiz_attempts_service_1.QuizAttemptsService,
        course_structure_service_1.CourseStructureService])
], SamplesService);
//# sourceMappingURL=samples.service.js.map