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
var CourseStructureService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CourseStructureService = void 0;
const common_1 = require("@nestjs/common");
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const database_tokens_1 = require("../../database/database.tokens");
const content_version_1 = require("../../common/utils/content-version");
const general_ci_sort_1 = require("../../common/utils/general-ci-sort");
const SLICE = 1000;
const FORMAT = 3;
const PAUSE_MS = 250;
let CourseStructureService = CourseStructureService_1 = class CourseStructureService {
    constructor(db) {
        this.db = db;
        this.logger = new common_1.Logger(CourseStructureService_1.name);
        this.snapshot = null;
        this.building = null;
        this.again = false;
        this.file = (0, node_path_1.join)(process.env.CACHE_DIR || (0, node_path_1.join)(process.cwd(), 'storage', 'cache'), 'course-structure.json');
        this.readsInBuild = 0;
    }
    onModuleInit() {
        (0, content_version_1.onContentVersionChange)(() => { this.rebuild(); });
    }
    async get() {
        const version = await (0, content_version_1.getContentVersion)(this.db);
        if (!this.snapshot)
            await this.loadFile(version);
        if (this.snapshot && this.snapshot.format === FORMAT && this.snapshot.version === version)
            return this.snapshot;
        const build = this.rebuild();
        return this.snapshot ?? build;
    }
    rebuild() {
        if (this.building) {
            this.again = true;
            return this.building;
        }
        this.building = (async () => {
            try {
                let built;
                do {
                    this.again = false;
                    built = await this.build();
                    this.snapshot = built;
                    await this.saveFile(built);
                } while (this.again);
                return built;
            }
            finally {
                this.building = null;
            }
        })();
        this.building.catch((error) => this.logger.warn(`Course structure rebuild failed: ${error?.message || error}`));
        return this.building;
    }
    async build() {
        this.readsInBuild = 0;
        const version = await (0, content_version_1.getContentVersion)(this.db);
        const courses = (await this.slices('SELECT id, course_title, course_code, description, exam_type, status, created_at FROM courses')).filter((c) => c.status === 'active');
        (0, general_ci_sort_1.sortByName)(courses, (c) => String(c.course_title));
        const allSubjects = await this.slices('SELECT id, course_id, topic_name, status, sort_order FROM topics');
        const subjectCourse = new Map(allSubjects.map((s) => [Number(s.id), Number(s.course_id)]));
        const subjects = allSubjects.filter((s) => s.status === 'active').sort(bySortThenId);
        const topics = (await this.slices('SELECT id, topic_id, subtopic_name, status, sort_order FROM subtopics'))
            .filter((t) => t.status === 'active' && subjectCourse.has(Number(t.topic_id)))
            .map((t) => ({ ...t, course_id: subjectCourse.get(Number(t.topic_id)) }))
            .sort(bySortThenId);
        const lessons = (await this.slices(`SELECT id, course_id, topic_id, subtopic_id, lesson_title, video_url, is_free, status, sort_order, is_public,
              (note_data IS NOT NULL) AS has_note, (pdf_url IS NOT NULL AND pdf_url <> '') AS has_pdf, engine_key,
              UNIX_TIMESTAMP(updated_at) AS updated_ts,
              (note_data IS NOT NULL OR pdf_url IS NOT NULL) AS ready
       FROM lessons`))
            .filter((l) => l.status === 'active' && Number(l.is_public) === 1 && Number(l.ready) === 1)
            .sort(bySortThenId)
            .map(({ is_public: _p, ready: _r, ...l }) => ({ ...l, has_note: Number(l.has_note), has_pdf: Number(l.has_pdf), updated_ts: Math.floor(Number(l.updated_ts) || 0) }));
        this.logger.log(`Course structure v${version}: ${courses.length} courses, ${subjects.length} subjects, ${topics.length} topics, ${lessons.length} lessons`);
        return { format: FORMAT, version, builtAt: new Date().toISOString(), courses, subjects, topics, lessons };
    }
    async slices(select) {
        const out = [];
        let after = 0;
        if (this.readsInBuild++ > 0)
            await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
        for (;;) {
            const [rows] = await this.db.query(`${select} WHERE id > ? ORDER BY id LIMIT ${SLICE}`, [after]);
            out.push(...rows);
            if (rows.length < SLICE)
                return out;
            after = Number(rows[rows.length - 1].id);
            await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
        }
    }
    async loadFile(version) {
        try {
            const saved = JSON.parse(await (0, promises_1.readFile)(this.file, 'utf8'));
            if (saved && saved.format === FORMAT && saved.version === version && Array.isArray(saved.lessons))
                this.snapshot = saved;
        }
        catch { }
    }
    async saveFile(structure) {
        try {
            await (0, promises_1.mkdir)((0, node_path_1.join)(this.file, '..'), { recursive: true });
            const tmp = `${this.file}.${process.pid}.tmp`;
            await (0, promises_1.writeFile)(tmp, JSON.stringify(structure));
            await (0, promises_1.rename)(tmp, this.file);
        }
        catch (error) {
            this.logger.warn(`Course structure file not saved: ${error?.message || error}`);
        }
    }
};
exports.CourseStructureService = CourseStructureService;
exports.CourseStructureService = CourseStructureService = CourseStructureService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_tokens_1.DATABASE_CONNECTION)),
    __metadata("design:paramtypes", [Object])
], CourseStructureService);
function bySortThenId(a, b) {
    return Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0) || Number(a.id) - Number(b.id);
}
//# sourceMappingURL=course-structure.service.js.map