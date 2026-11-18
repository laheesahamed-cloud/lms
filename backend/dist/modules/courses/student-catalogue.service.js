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
var StudentCatalogueService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.StudentCatalogueService = exports.PARTS_FORMAT = exports.CATALOGUE_FORMAT = void 0;
exports.progressOptions = progressOptions;
const lesson_bits_1 = require("../../common/utils/lesson-bits");
const common_1 = require("@nestjs/common");
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const node_crypto_1 = require("node:crypto");
const node_zlib_1 = require("node:zlib");
const streak_1 = require("../xp/streak");
const database_tokens_1 = require("../../database/database.tokens");
const content_version_1 = require("../../common/utils/content-version");
const course_structure_service_1 = require("./course-structure.service");
const subscription_scope_1 = require("../../common/auth/subscription-scope");
const content_access_1 = require("../../common/auth/content-access");
const QUIZ_PASS_MARK = 45;
const FILE_FORMAT = 2;
exports.CATALOGUE_FORMAT = 4;
exports.PARTS_FORMAT = 5;
const SLICE = 1000;
function gapIds(rows) {
    let previous = 0;
    return rows.map((row) => {
        const id = Number(row[0]);
        const out = [id - previous, ...row.slice(1)];
        previous = id;
        return out;
    });
}
function shortQuizRow(q) {
    return [q[0], q[1], q[2], q[3], q[4], q[5], q[6], q[7], q[8] || q[9], q[12], q[13], q[14], q[15], Number(q[16]) || 1];
}
const PAUSE_MS = 250;
function progressOptions(format, version) {
    if (String(format || '') !== 'bits')
        return {};
    const m = String(version ?? '').match(/^(\d+):(\d+)$/);
    if (!m)
        return { bits: true };
    return { bits: true, haveUser: Number(m[1]), haveVersion: Number(m[2]) };
}
let StudentCatalogueService = StudentCatalogueService_1 = class StudentCatalogueService {
    constructor(db, structure) {
        this.db = db;
        this.structure = structure;
        this.logger = new common_1.Logger(StudentCatalogueService_1.name);
        this.current = null;
        this.building = null;
        this.rebuildTimer = null;
        this.file = (0, node_path_1.join)(process.env.CACHE_DIR || (0, node_path_1.join)(process.cwd(), 'storage', 'cache'), 'student-catalogue.json');
        this.namesCache = null;
    }
    onModuleInit() {
        (0, content_version_1.onContentVersionChange)(() => {
            if (this.rebuildTimer)
                clearTimeout(this.rebuildTimer);
            this.rebuildTimer = setTimeout(() => { this.get().catch(() => { }); }, 3000);
            this.rebuildTimer.unref?.();
        });
    }
    onApplicationBootstrap() {
        setTimeout(() => { this.get().catch((e) => this.logger.warn(`Catalogue warm-up failed: ${e?.message || e}`)); }, 1500).unref?.();
    }
    async progressFor(userId, studyStats, opts = {}) {
        const scopeRows = await (0, subscription_scope_1.getScopeRows)(this.db, userId);
        const access = (0, content_access_1.buildContentAccess)(scopeRows);
        const paidPlan = scopeRows.some((r) => String(r.plan_slug || '') !== 'free');
        let lessonsPart;
        if (opts.bits) {
            await studyStats.ensureBuilt(userId);
            const known = (0, subscription_scope_1.summaryRowFromRequest)(userId);
            const today = (0, streak_1.localDateKey)(new Date());
            const rows = known && 'lessons_done' in known && 'practice_seq' in known ? [known] : (await this.db.execute(`SELECT lessons_done, quiz_marks, recent_results, progress_version, practice_seq,
                IF(last_active_day <=> ?, 15, 0) AS today_bits
           FROM student_study_summary WHERE user_id = ? LIMIT 1`, [today, userId]))[0];
            const rowExtras = { todayBits: Number(rows[0]?.today_bits || 0), practiceSeq: Number(rows[0]?.practice_seq || 0) };
            const version = Number(rows[0]?.progress_version || 0);
            let recent = [];
            try {
                recent = rows[0]?.recent_results ? JSON.parse(String(rows[0].recent_results)) : [];
            }
            catch {
                recent = [];
            }
            lessonsPart = opts.haveUser === userId && opts.haveVersion === version && version > 0
                ? { lessonsVersion: version, lessonsUnchanged: true, ...rowExtras }
                : {
                    ...rowExtras,
                    lessonsVersion: version,
                    lessonsBits: rows[0]?.lessons_done ? Buffer.from(rows[0].lessons_done).toString('base64') : '',
                    quizMarks: rows[0]?.quiz_marks ? Buffer.from(rows[0].quiz_marks).toString('base64') : '',
                    recentResults: recent,
                };
        }
        else {
            const done = await (0, lesson_bits_1.finishedLessons)(this.db, userId);
            lessonsPart = { lessons: [...done].map((id) => [id, 2, 100]) };
        }
        return {
            access: {
                paid: access.paid,
                full: access.full,
                courseIds: [...access.courseIds],
                lessonIds: [...access.lessonIds],
                quizFull: access.quizFull,
                quizCourseIds: [...access.quizCourseIds],
                features: access.paid,
                paidPlan,
            },
            ...lessonsPart,
            ...(opts.bits ? {} : { quizzes: await studyStats.quizProgress(userId) }),
        };
    }
    async get() {
        const snapshot = await this.structure.get();
        if (this.current && this.current.v === snapshot.version)
            return this.current;
        if (!this.building) {
            this.building = (async () => {
                if (!(await this.loadFile(snapshot.version)))
                    await this.build();
            })().finally(() => { this.building = null; });
        }
        if (this.current)
            return this.current;
        await this.building;
        return this.current;
    }
    async build() {
        const snapshot = await this.structure.get();
        const courseIds = new Set(snapshot.courses.map((c) => Number(c.id)));
        const subjectName = new Map(snapshot.subjects.map((s) => [Number(s.id), String(s.topic_name)]));
        const courseOrder = new Map(snapshot.courses.map((c, i) => [Number(c.id), i]));
        const subjectOrder = new Map(snapshot.subjects.map((s, i) => [Number(s.id), i]));
        const topicOrder = new Map(snapshot.topics.map((t, i) => [Number(t.id), i]));
        const [cardRows] = await this.db.query(`SELECT lesson_id, COUNT(*) AS n, UNIX_TIMESTAMP(MAX(updated_at)) AS stamp
         FROM lesson_flashcards WHERE status = 'approved' GROUP BY lesson_id`);
        const cardsByLesson = new Map(cardRows.map((r) => [Number(r.lesson_id), Number(r.n)]));
        const cardStamp = new Map(cardRows.map((r) => [Number(r.lesson_id), Math.floor(Number(r.stamp) || 0)]));
        const lessons = snapshot.lessons
            .filter((l) => (l.engine_key || 'gemini') === 'gemini' && courseIds.has(Number(l.course_id)))
            .map((l, i) => ({ l, i }))
            .sort((a, b) => (courseOrder.get(Number(a.l.course_id)) ?? 1e9) - (courseOrder.get(Number(b.l.course_id)) ?? 1e9)
            || (subjectOrder.get(Number(a.l.topic_id)) ?? 1e9) - (subjectOrder.get(Number(b.l.topic_id)) ?? 1e9)
            || (topicOrder.get(Number(a.l.subtopic_id)) ?? -1) - (topicOrder.get(Number(b.l.subtopic_id)) ?? -1)
            || a.i - b.i)
            .map(({ l }) => [
            Number(l.id), Number(l.course_id), Number(l.topic_id) || 0, Number(l.subtopic_id) || 0,
            String(l.lesson_title || ''), Number(l.is_free) === 1 ? 1 : 0,
            Number(l.has_note) === 1 ? 1 : 0, Number(l.has_pdf) === 1 ? 1 : 0, l.video_url ? 1 : 0,
            cardsByLesson.get(Number(l.id)) || 0, cardStamp.get(Number(l.id)) || 0, Number(l.updated_ts) || 0,
        ]);
        const quizRows = await this.slices(`SELECT id, course_id, topic_id, subtopic_id, NULL AS lesson_id, is_general, 0 AS exam_mode_only, is_free,
              quiz_title AS student_title, quiz_title, 'title' AS display_title_mode, quiz_number, total_questions, time_limit,
              passing_marks, status, content_stamp
         FROM quizzes`);
        const quizzes = quizRows
            .filter((q) => q.status === 'active' && courseIds.has(Number(q.course_id)))
            .sort((a, b) => Number(b.id) - Number(a.id))
            .map((q) => [
            Number(q.id), Number(q.course_id), Number(q.topic_id) || 0, Number(q.subtopic_id) || 0, Number(q.lesson_id) || 0,
            Number(q.is_general) === 1 ? 1 : 0, Number(q.exam_mode_only) === 1 ? 1 : 0, Number(q.is_free) === 1 ? 1 : 0,
            String(q.student_title || q.quiz_title || ''), String(q.student_title || q.quiz_title || ''),
            0, Number(q.quiz_number) || 0,
            Number(q.total_questions) || 0, Number(q.time_limit) || 0,
            Number(q.passing_marks) > 0 ? Number(q.passing_marks) : QUIZ_PASS_MARK,
            0,
            Number(q.content_stamp) || 1,
        ]);
        const courseTitle = new Map(snapshot.courses.map((c) => [Number(c.id), String(c.course_title)]));
        const topicName = new Map(snapshot.topics.map((t) => [Number(t.id), String(t.subtopic_name)]));
        const decks = lessons
            .filter((l) => (cardsByLesson.get(l[0]) || 0) > 0)
            .map((l) => ({
            id: l[0], courseId: l[1], topicId: l[2] || null, subtopicId: l[3] || null, isFree: l[5] === 1,
            courseTitle: courseTitle.get(l[1]) || 'General',
            topicName: subjectName.get(l[2]) || 'General subject',
            subtopicName: topicName.get(l[3]) || 'General topic',
            lessonTitle: l[4] || 'Untitled lesson',
            approvedFlashcardCount: cardsByLesson.get(l[0]) || 0,
            stamp: Number(l[10]) || 0,
        }));
        const catalogue = {
            v: snapshot.version,
            courses: snapshot.courses.map((c) => [Number(c.id), String(c.course_title), String(c.course_code || ''), String(c.exam_type || ''), String(c.description || '')]),
            subjects: snapshot.subjects.filter((s) => courseIds.has(Number(s.course_id)))
                .map((s) => [Number(s.id), Number(s.course_id), String(s.topic_name)]),
            topics: snapshot.topics.filter((t) => subjectName.has(Number(t.topic_id)))
                .map((t) => [Number(t.id), Number(t.topic_id), String(t.subtopic_name)]),
            lessons,
            quizzes,
        };
        this.finish(catalogue, decks);
        await this.saveFile(catalogue, decks);
        this.logger.log(`Student catalogue v${snapshot.version}: ${lessons.length} lessons, ${quizzes.length} quizzes`);
    }
    finish(catalogue, decks) {
        const json = JSON.stringify({ f: exports.CATALOGUE_FORMAT, ...catalogue });
        const gzip = (0, node_zlib_1.gzipSync)(Buffer.from(json), { level: 9 });
        const parts = new Map();
        const lessonParts = new Map();
        const quizParts = new Map();
        const hashOf = (text) => (0, node_crypto_1.createHash)('sha1').update(text).digest('hex').slice(0, 12);
        for (const c of catalogue.courses) {
            const id = c[0];
            const subjectIds = new Set(catalogue.subjects.filter((x) => x[1] === id).map((x) => x[0]));
            const part = {
                course: id,
                subjects: catalogue.subjects.filter((x) => x[1] === id),
                topics: catalogue.topics.filter((x) => subjectIds.has(x[1])),
                lessons: catalogue.lessons.filter((x) => x[1] === id),
                quizzes: catalogue.quizzes.filter((x) => x[1] === id),
            };
            const partJson = JSON.stringify(part);
            parts.set(id, { hash: hashOf(partJson), json: partJson });
            const lessonsJson = JSON.stringify({ course: id, kind: 'lessons', subjects: part.subjects, topics: part.topics, lessons: gapIds(part.lessons) });
            const linked = new Set(part.quizzes.map((q) => q[4]).filter((v) => v > 0));
            const usedTopics = new Set(part.quizzes.map((q) => q[3]).filter((v) => v > 0));
            const quizRows = [...part.quizzes].sort((a, b) => a[0] - b[0]).map(shortQuizRow);
            const quizzesJson = JSON.stringify({
                course: id, kind: 'quizzes', subjects: part.subjects,
                topics: part.topics.filter((t) => usedTopics.has(t[0])),
                quizzes: gapIds(quizRows),
                lessons: gapIds(part.lessons.filter((l) => linked.has(l[0]))),
            });
            lessonParts.set(id, { hash: hashOf(lessonsJson), json: lessonsJson });
            quizParts.set(id, { hash: hashOf(quizzesJson), json: quizzesJson });
        }
        const indexJson = JSON.stringify({
            f: exports.CATALOGUE_FORMAT,
            v: catalogue.v,
            courses: catalogue.courses,
            parts: Object.fromEntries([...parts.entries()].map(([id, p]) => [id, p.hash])),
            lessonParts: Object.fromEntries([...lessonParts.entries()].map(([id, p]) => [id, p.hash])),
            quizParts: Object.fromEntries([...quizParts.entries()].map(([id, p]) => [id, p.hash])),
        });
        const index = { json: indexJson, gzip: (0, node_zlib_1.gzipSync)(Buffer.from(indexJson), { level: 9 }) };
        this.current = { v: catalogue.v, json, gzip, decks, index, parts, lessonParts, quizParts, quizCount: catalogue.quizzes.length };
    }
    async saveFile(catalogue, decks) {
        try {
            await (0, promises_1.mkdir)((0, node_path_1.join)(this.file, '..'), { recursive: true });
            const tmp = `${this.file}.${process.pid}.tmp`;
            await (0, promises_1.writeFile)(tmp, JSON.stringify({ format: FILE_FORMAT, catalogue, decks }));
            await (0, promises_1.rename)(tmp, this.file);
        }
        catch (error) {
            this.logger.warn(`Student catalogue file not saved: ${error?.message || error}`);
        }
    }
    async loadFile(version) {
        try {
            const saved = JSON.parse(await (0, promises_1.readFile)(this.file, 'utf8'));
            if (saved?.format === FILE_FORMAT && saved.catalogue?.v === version) {
                this.finish(saved.catalogue, saved.decks || []);
                return true;
            }
        }
        catch { }
        return false;
    }
    async names() {
        const current = await this.get();
        if (this.namesCache && this.namesCache.v === current.v)
            return this.namesCache;
        const cat = JSON.parse(current.json);
        this.namesCache = {
            v: current.v,
            quiz: new Map(cat.quizzes.map((q) => [Number(q[0]), q])),
            lesson: new Map(cat.lessons.map((l) => [Number(l[0]), l])),
            course: new Map(cat.courses.map((c) => [Number(c[0]), String(c[1])])),
            subject: new Map(cat.subjects.map((x) => [Number(x[0]), String(x[2])])),
            topic: new Map(cat.topics.map((t) => [Number(t[0]), t])),
        };
        return this.namesCache;
    }
    async partsFor(courseIds, kind) {
        const current = await this.get();
        const source = kind === 'lessons' ? current.lessonParts : kind === 'quizzes' ? current.quizParts : current.parts;
        const parts = courseIds.map((id) => source.get(id)).filter((p) => !!p);
        const format = kind === 'lessons' || kind === 'quizzes' ? exports.PARTS_FORMAT : exports.CATALOGUE_FORMAT;
        const json = `{"f":${format},"v":${current.v},"parts":[${parts.map((p) => p.json).join(',')}]}`;
        return { v: current.v, json, gzip: (0, node_zlib_1.gzipSync)(Buffer.from(json), { level: 9 }) };
    }
    async slices(select) {
        const out = [];
        let after = 0;
        for (;;) {
            const [rows] = await this.db.query(`${select} WHERE id > ? ORDER BY id LIMIT ${SLICE}`, [after]);
            out.push(...rows);
            if (rows.length < SLICE)
                return out;
            after = Number(rows[rows.length - 1].id);
            await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
        }
    }
};
exports.StudentCatalogueService = StudentCatalogueService;
exports.StudentCatalogueService = StudentCatalogueService = StudentCatalogueService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_tokens_1.DATABASE_CONNECTION)),
    __metadata("design:paramtypes", [Object, course_structure_service_1.CourseStructureService])
], StudentCatalogueService);
//# sourceMappingURL=student-catalogue.service.js.map