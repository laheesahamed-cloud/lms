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
var OsceService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OsceService = exports.GLOBAL_SLOTS = exports.GLOBAL_CASE_ID = exports.SLOT_SPECS = exports.STANDARD_SPEC = exports.BODY_SPEC = void 0;
exports.specForSlot = specForSlot;
exports.slotToFileBase = slotToFileBase;
const common_1 = require("@nestjs/common");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const database_tokens_1 = require("../../database/database.tokens");
const AUSCULTATION_AUDIO_DIR = () => (0, path_1.join)(process.cwd(), 'uploads', 'sound-clips');
exports.BODY_SPEC = { ratio: '3:4', width: 1536, height: 2048 };
exports.STANDARD_SPEC = { ratio: '4:3', width: 1536, height: 1152 };
exports.SLOT_SPECS = {
    cover: exports.STANDARD_SPEC,
    'scene:body': exports.BODY_SPEC,
    scene: exports.STANDARD_SPEC,
    sign: exports.STANDARD_SPEC,
    chain: exports.STANDARD_SPEC,
    'ix:ecg': exports.STANDARD_SPEC,
    'ix:cxr': exports.STANDARD_SPEC,
    'ix:echo': exports.STANDARD_SPEC,
};
function specForSlot(slotKey) {
    if (slotKey.startsWith('scene:body'))
        return exports.BODY_SPEC;
    if (exports.SLOT_SPECS[slotKey])
        return exports.SLOT_SPECS[slotKey];
    return exports.STANDARD_SPEC;
}
exports.GLOBAL_CASE_ID = 0;
exports.GLOBAL_SLOTS = ['global:doctor', 'global:patient'];
const REGION_ORDER = [
    'head', 'neck', 'chest', 'abdomen', 'groin', 'hands', 'legs', 'general',
];
const REGION_LABELS = {
    head: 'Head and face',
    neck: 'Neck',
    chest: 'Chest',
    abdomen: 'Abdomen',
    groin: 'Groin',
    hands: 'Hands and arms',
    legs: 'Legs and feet',
    general: 'Whole patient',
};
const REGION_SYNONYMS = {
    face: 'head', lips: 'head', mouth: 'head', eyes: 'head', eye: 'head',
    tongue: 'head', scalp: 'head', ear: 'head', ears: 'head', head: 'head',
    neck: 'neck', thyroid: 'neck', jvp: 'neck',
    chest: 'chest', praecordium: 'chest', precordium: 'chest', heart: 'chest',
    lungs: 'chest', lung: 'chest', back: 'chest', apex: 'chest',
    abdomen: 'abdomen', liver: 'abdomen', spleen: 'abdomen', flank: 'abdomen',
    groin: 'groin', genital: 'groin', genitalia: 'groin', scrotum: 'groin',
    inguinal: 'groin', testis: 'groin',
    hands: 'hands', hand: 'hands', nails: 'hands', arms: 'hands', arm: 'hands',
    fingers: 'hands', wrist: 'hands',
    legs: 'legs', leg: 'legs', feet: 'legs', foot: 'legs', ankles: 'legs',
    ankle: 'legs', calf: 'legs',
};
function normalizeRegion(raw) {
    const key = String(raw || '').trim().toLowerCase();
    return REGION_SYNONYMS[key] || 'general';
}
const MEDIA_ROOT = () => (0, path_1.join)(process.cwd(), 'uploads', 'osce');
const INBOX_DIR = () => (0, path_1.join)(MEDIA_ROOT(), '_inbox');
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const MAX_VIDEO_BYTES = 60 * 1024 * 1024;
const EMPTY_DOC = {
    version: 1,
    scenes: [],
    signs: [],
    chain: [],
    investigations: [],
    sounds: [],
    summary: {},
    related: [],
    practice: { checklist: [], questions: [] },
};
function slotToFileBase(slotKey) {
    return slotKey.replace(/:/g, '-').replace(/[^A-Za-z0-9._-]/g, '-');
}
let OsceService = OsceService_1 = class OsceService {
    constructor(db) {
        this.db = db;
    }
    async listSystems(publishedOnly = false, userId) {
        const [rows] = await this.db.execute(`SELECT t.id AS topic_id, t.topic_name, t.sort_order,
              co.id AS course_id, co.course_title,
              COUNT(c.id) AS case_count,
              SUM(CASE WHEN c.is_free = 1 THEN 1 ELSE 0 END) AS free_count
         FROM topics t
         JOIN courses co ON co.id = t.course_id
         LEFT JOIN osce_cases c ON c.topic_id = t.id
              ${publishedOnly ? "AND c.status = 'published' AND c.is_public = 1" : ''}
        WHERE t.status = 'active' AND co.status = 'active'
        GROUP BY t.id, t.topic_name, t.sort_order, co.id, co.course_title
        ${publishedOnly ? 'HAVING case_count > 0' : ''}
        ORDER BY co.id, t.sort_order, t.topic_name`);
        return rows
            .map((r) => ({
            id: Number(r.topic_id),
            key: String(r.topic_id),
            name: String(r.topic_name),
            courseId: Number(r.course_id),
            courseTitle: String(r.course_title),
            iconKey: null,
            sortOrder: Number(r.sort_order),
            isActive: true,
            caseCount: Number(r.case_count || 0),
            locked: false,
        }));
    }
    async listRegions(baseUrl, userId) {
        const cases = await this.listCases({ publishedOnly: true, userId, baseUrl });
        const profile = userId ? await this.accessProfile(userId) : null;
        const buckets = new Map();
        for (const key of REGION_ORDER)
            buckets.set(key, []);
        for (const item of cases) {
            if (String(item.stationType) === 'long')
                continue;
            const full = await this.getCaseById(Number(item.id));
            if (!full)
                continue;
            const regions = new Set();
            for (const sign of full.caseData?.signs || []) {
                regions.add(normalizeRegion(sign.region));
            }
            if (!regions.size)
                regions.add('general');
            for (const region of regions) {
                buckets.get(region).push({
                    id: item.id,
                    title: item.title,
                    slug: item.slug,
                    summary: item.summary,
                    stationType: item.stationType,
                    cover: item.cover,
                    favourite: item.favourite,
                    locked: profile ? !this.caseInScope(full, profile) : false,
                });
            }
        }
        return REGION_ORDER.map((key) => ({
            key,
            label: REGION_LABELS[key],
            caseCount: buckets.get(key).length,
            cases: buckets.get(key),
        })).filter((r) => r.caseCount > 0);
    }
    async listLinkableContent(query, baseUrl = '') {
        const like = `%${String(query || '').trim()}%`;
        const hasQuery = String(query || '').trim().length > 0;
        const root = String(baseUrl || '').replace(/\/+$/, '');
        const [ecg] = await this.db.execute(`SELECT e.id, e.title, t.title AS topic_title
         FROM ecg_cards e
         LEFT JOIN ecg_topics t ON t.id = e.topic_id
        WHERE e.is_active = 1 ${hasQuery ? 'AND e.title LIKE ?' : ''}
        ORDER BY e.position, e.id LIMIT 100`, hasQuery ? [like] : []);
        const [sounds] = await this.db.execute(`SELECT a.id, a.title, a.audio_file, t.title AS topic_title, t.category
         FROM auscultation_cards a
         LEFT JOIN auscultation_topics t ON t.id = a.topic_id
        WHERE a.is_active = 1 ${hasQuery ? 'AND a.title LIKE ?' : ''}
        ORDER BY a.position, a.id LIMIT 100`, hasQuery ? [like] : []);
        return {
            ecgCards: ecg.map((r) => ({
                id: Number(r.id),
                title: String(r.title),
                group: r.topic_title ? String(r.topic_title) : '',
                image: root ? `${root}/api/osce/ecg/${Number(r.id)}/image` : null,
            })),
            auscultationCards: sounds.map((r) => ({
                id: Number(r.id),
                title: String(r.title),
                group: r.topic_title ? String(r.topic_title) : '',
                category: r.category ? String(r.category) : '',
                hasAudio: !!r.audio_file,
                audio: r.audio_file && root
                    ? `${root}/api/osce/sound/${Number(r.id)}/audio`
                    : null,
            })),
        };
    }
    async globalMedia(baseUrl) {
        const [rows] = await this.db.execute('SELECT slot_key, storage_key, thumb_key, UNIX_TIMESTAMP(updated_at) AS stamp '
            + 'FROM osce_media WHERE case_id = ?', [exports.GLOBAL_CASE_ID]);
        const root = (baseUrl || '').replace(/\/+$/, '');
        const out = {
            doctor: null, patient: null,
        };
        for (const r of rows) {
            const key = String(r.slot_key).replace('global:', '');
            if (!Object.prototype.hasOwnProperty.call(out, key))
                continue;
            out[key] = {
                full: `${root}/api/osce/media/${r.storage_key}?v=${r.stamp || 0}`,
                thumb: `${root}/api/osce/media/${r.thumb_key || r.storage_key}?v=${r.stamp || 0}`,
            };
        }
        return out;
    }
    async saveGlobalImage(slotKey, file) {
        if (!exports.GLOBAL_SLOTS.includes(slotKey))
            throw new common_1.BadRequestException('Unknown global slot');
        if (!file?.buffer?.length)
            throw new common_1.BadRequestException('No file received');
        const ext = this.extForMime(file.mimetype);
        if (!ext)
            throw new common_1.BadRequestException('Unsupported image type');
        const dir = (0, path_1.join)(MEDIA_ROOT(), '_global');
        await (0, promises_1.mkdir)(dir, { recursive: true });
        const base = slotToFileBase(slotKey);
        const fileName = `${base}.${ext}`;
        const [prior] = await this.db.execute('SELECT storage_key FROM osce_media WHERE case_id = ? AND slot_key = ? LIMIT 1', [exports.GLOBAL_CASE_ID, slotKey]);
        const priorKey = prior?.[0]?.storage_key ? String(prior[0].storage_key) : '';
        if (priorKey && priorKey !== `_global/${fileName}`) {
            await (0, promises_1.unlink)((0, path_1.join)(MEDIA_ROOT(), priorKey)).catch(() => undefined);
        }
        await (0, promises_1.writeFile)((0, path_1.join)(dir, fileName), file.buffer);
        await this.db.execute(`INSERT INTO osce_media (case_id, slot_key, storage_key, mime, source, bytes)
       VALUES (?, ?, ?, ?, 'upload', ?)
       ON DUPLICATE KEY UPDATE storage_key = VALUES(storage_key), mime = VALUES(mime),
                               bytes = VALUES(bytes)`, [exports.GLOBAL_CASE_ID, slotKey, `_global/${fileName}`, file.mimetype, file.buffer.length]);
        return { slot: slotKey, storageKey: `_global/${fileName}` };
    }
    async listCategories(opts = {}) {
        const [rows] = await this.db.execute(`SELECT cat.id, cat.course_id, cat.name, cat.sort_order, cat.is_active,
              co.course_title,
              COUNT(c.id) AS case_count,
              SUM(CASE WHEN c.is_free = 1 THEN 1 ELSE 0 END) AS free_count
         FROM osce_categories cat
         JOIN courses co ON co.id = cat.course_id
         LEFT JOIN osce_cases c ON c.category_id = cat.id
              ${opts.publishedOnly ? "AND c.status = 'published' AND c.is_public = 1" : ''}
        WHERE cat.is_active = 1 ${opts.courseId ? 'AND cat.course_id = ?' : ''}
        GROUP BY cat.id, cat.course_id, cat.name, cat.sort_order, cat.is_active,
                 co.course_title
        ${opts.publishedOnly ? 'HAVING case_count > 0' : ''}
        ORDER BY cat.sort_order, cat.name`, opts.courseId ? [opts.courseId] : []);
        return rows
            .map((r) => ({
            id: Number(r.id),
            key: String(r.id),
            name: String(r.name),
            courseId: Number(r.course_id),
            courseTitle: String(r.course_title),
            sortOrder: Number(r.sort_order),
            isActive: true,
            iconKey: null,
            caseCount: Number(r.case_count || 0),
            locked: false,
        }));
    }
    async createCategory(courseId, name) {
        const clean = String(name || '').trim();
        if (!clean)
            throw new common_1.BadRequestException('Give the category a name');
        const course = Number(courseId);
        if (!Number.isInteger(course) || course <= 0) {
            throw new common_1.BadRequestException('Pick a course before adding a category');
        }
        const [courseRows] = await this.db.execute('SELECT id FROM courses WHERE id = ? LIMIT 1', [course]);
        if (!courseRows.length) {
            throw new common_1.BadRequestException('That course no longer exists');
        }
        const [max] = await this.db.execute('SELECT COALESCE(MAX(sort_order), 0) AS n FROM osce_categories WHERE course_id = ?', [course]);
        const [res] = await this.db.execute('INSERT INTO osce_categories (course_id, name, sort_order) VALUES (?, ?, ?)', [course, clean, Number(max?.[0]?.n || 0) + 1]);
        return { id: Number(res.insertId), courseId: course, name: clean };
    }
    async updateCategory(id, patch) {
        const sets = [];
        const params = [];
        if (patch.name !== undefined) {
            sets.push('name = ?');
            params.push(String(patch.name).trim());
        }
        if (patch.isActive !== undefined) {
            sets.push('is_active = ?');
            params.push(patch.isActive ? 1 : 0);
        }
        if (!sets.length)
            return { updated: false };
        params.push(id);
        await this.db.execute(`UPDATE osce_categories SET ${sets.join(', ')} WHERE id = ?`, params);
        return { updated: true };
    }
    async deleteCategory(id) {
        const [rows] = await this.db.execute('SELECT COUNT(*) AS n FROM osce_cases WHERE category_id = ?', [id]);
        if (Number(rows?.[0]?.n || 0) > 0) {
            throw new common_1.BadRequestException('Move or delete the stations in this category first.');
        }
        await this.db.execute('DELETE FROM osce_categories WHERE id = ?', [id]);
        return { deleted: true };
    }
    async reorderCategories(ids) {
        for (let i = 0; i < ids.length; i++) {
            await this.db.execute('UPDATE osce_categories SET sort_order = ? WHERE id = ?', [i + 1, Number(ids[i])]);
        }
        return { ordered: ids.length };
    }
    async reorderCases(ids) {
        for (let i = 0; i < ids.length; i++) {
            await this.db.execute('UPDATE osce_cases SET sort_order = ? WHERE id = ?', [i + 1, Number(ids[i])]);
        }
        return { ordered: ids.length };
    }
    async getImageModel() {
        const [rows] = await this.db.execute("SELECT setting_value FROM system_settings WHERE setting_key = 'osce_image_model' LIMIT 1");
        return rows.length ? String(rows[0].setting_value || '').trim() : '';
    }
    async setImageModel(model) {
        await this.db.execute(`INSERT INTO system_settings (setting_key, setting_value) VALUES ('osce_image_model', ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`, [String(model || '').trim()]);
        return { model: String(model || '').trim() };
    }
    canGenerateSlot(slotKey) {
        return !slotKey.startsWith('ix:');
    }
    async categoryName(categoryId) {
        const [rows] = await this.db.execute('SELECT name FROM osce_categories WHERE id = ? LIMIT 1', [categoryId]);
        return rows.length ? String(rows[0].name) : 'General medicine';
    }
    async listStudentCourses(userId) {
        const [rows] = await this.db.execute(`SELECT co.id, co.course_title,
              COUNT(c.id) AS case_count,
              COUNT(DISTINCT c.topic_id) AS subject_count,
              SUM(CASE WHEN c.is_free = 1 THEN 1 ELSE 0 END) AS free_count
         FROM courses co
         JOIN osce_cases c ON c.course_id = co.id
              AND c.status = 'published' AND c.is_public = 1
        WHERE co.status = 'active'
        GROUP BY co.id, co.course_title
        ORDER BY co.id`);
        return rows
            .map((r) => ({
            id: Number(r.id),
            title: String(r.course_title),
            caseCount: Number(r.case_count || 0),
            subjectCount: Number(r.subject_count || 0),
            locked: false,
        }));
    }
    async listCourses() {
        const [rows] = await this.db.execute(`SELECT co.id, co.course_title, COUNT(t.id) AS subject_count
         FROM courses co
         LEFT JOIN topics t ON t.course_id = co.id AND t.status = 'active'
        WHERE co.status = 'active'
        GROUP BY co.id, co.course_title ORDER BY co.id`);
        return rows.map((r) => ({
            id: Number(r.id),
            title: String(r.course_title),
            subjectCount: Number(r.subject_count || 0),
        }));
    }
    async listCases(opts = {}) {
        const where = [];
        const params = [];
        if (opts.categoryId) {
            where.push('c.category_id = ?');
            params.push(opts.categoryId);
        }
        if (opts.publishedOnly)
            where.push("c.status = 'published' AND c.is_public = 1");
        const [rows] = await this.db.execute(`SELECT c.id, c.title, c.slug, c.summary, c.difficulty, c.status, c.is_public,
              c.is_free, c.course_id, c.category_id, c.station_type, c.sort_order, c.updated_at,
              cat.name AS category_name, co.course_title,
              m.storage_key AS cover_key, m.thumb_key AS cover_thumb,
              UNIX_TIMESTAMP(m.updated_at) AS cover_stamp,
              p.is_favourite, p.completed_at AS progress_done
         FROM osce_cases c
         LEFT JOIN osce_categories cat ON cat.id = c.category_id
         LEFT JOIN courses co ON co.id = c.course_id
         LEFT JOIN osce_media m ON m.case_id = c.id AND m.slot_key = 'cover'
         LEFT JOIN osce_progress p ON p.case_id = c.id AND p.user_id = ?
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY c.sort_order, c.title`, [opts.userId ?? 0, ...params]);
        const profile = opts.publishedOnly && opts.userId ? await this.accessProfile(opts.userId) : null;
        const root = (opts.baseUrl || '').replace(/\/+$/, '');
        return rows.map((r) => ({
            ...this.mapCaseRow(r),
            favourite: Number(r.is_favourite) === 1,
            completed: !!r.progress_done,
            locked: profile ? !this.caseInScope(r, profile) : false,
            cover: r.cover_key && root
                ? {
                    full: `${root}/api/osce/media/${r.cover_key}?v=${r.cover_stamp || 0}`,
                    thumb: `${root}/api/osce/media/${r.cover_thumb || r.cover_key}?v=${r.cover_stamp || 0}`,
                }
                : null,
        }));
    }
    mapCaseRow(r) {
        return {
            id: Number(r.id),
            title: String(r.title),
            slug: String(r.slug),
            summary: r.summary ? String(r.summary) : '',
            difficulty: String(r.difficulty || 'core'),
            status: String(r.status || 'draft'),
            isPublic: Number(r.is_public) === 1,
            isFree: Number(r.is_free) === 1,
            courseId: Number(r.course_id || 0),
            categoryId: Number(r.category_id || 0),
            stationType: String(r.station_type || 'short'),
            sortOrder: Number(r.sort_order || 0),
            systemKey: r.category_id ? String(r.category_id) : null,
            systemName: r.category_name ? String(r.category_name) : null,
            courseTitle: r.course_title ? String(r.course_title) : null,
            updatedAt: r.updated_at,
        };
    }
    async accessProfile(userId) {
        const [rows] = await this.db.execute(`SELECT us.access_scope, us.course_ids_json
         FROM user_subscriptions us
        WHERE us.user_id = ? AND us.status = 'active'
          AND us.start_date <= CURDATE() AND us.end_date >= CURDATE()`, [userId]);
        const profile = { hasAny: rows.length > 0, full: false, courseIds: new Set() };
        for (const row of rows) {
            const ids = this.parseIdList(row.course_ids_json);
            const scope = String(row.access_scope || '').toLowerCase();
            if (!ids.length && (scope === 'all' || scope === ''))
                profile.full = true;
            else
                ids.forEach((id) => profile.courseIds.add(id));
        }
        return profile;
    }
    parseIdList(raw) {
        if (!raw)
            return [];
        try {
            const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
            return Array.isArray(parsed) ? parsed.map((v) => Number(v)).filter(Boolean) : [];
        }
        catch {
            return [];
        }
    }
    courseInScope(courseId, profile) {
        if (!profile.hasAny)
            return false;
        if (profile.full)
            return true;
        return profile.courseIds.has(courseId);
    }
    caseInScope(row, profile) {
        if (Number(row.is_free) === 1)
            return true;
        return this.courseInScope(Number(row.course_id || 0), profile);
    }
    async createCase(input) {
        const title = String(input.title || '').trim();
        if (!title)
            throw new common_1.BadRequestException('Title is required');
        const [catRows] = await this.db.execute('SELECT id, course_id FROM osce_categories WHERE id = ? LIMIT 1', [Number(input.categoryId)]);
        if (!catRows.length) {
            throw new common_1.BadRequestException('Pick a category to file this station under');
        }
        const categoryId = Number(catRows[0].id);
        const courseId = Number(catRows[0].course_id);
        const slug = await this.uniqueSlug(title);
        const doc = input.caseData ?? EMPTY_DOC;
        const [res] = await this.db.execute(`INSERT INTO osce_cases (course_id, topic_id, category_id, title, slug, summary,
                               difficulty, station_type, case_data, created_by)
       VALUES (?, 0, ?, ?, ?, ?, ?, ?, ?, ?)`, [
            courseId,
            categoryId,
            title,
            slug,
            input.summary ?? null,
            ['core', 'intermediate', 'advanced'].includes(String(input.difficulty)) ? String(input.difficulty) : 'core',
            input.stationType === 'long' ? 'long' : 'short',
            JSON.stringify(doc),
            input.createdBy ?? null,
        ]);
        return this.getCaseById(Number(res.insertId));
    }
    async uniqueSlug(title) {
        const base = title.toLowerCase().trim()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 160) || 'case';
        for (let i = 0; i < 50; i++) {
            const candidate = i === 0 ? base : `${base}-${i + 1}`;
            const [rows] = await this.db.execute('SELECT id FROM osce_cases WHERE slug = ? LIMIT 1', [candidate]);
            if (!rows.length)
                return candidate;
        }
        return `${base}-${Date.now()}`;
    }
    async getCaseById(id) {
        const [rows] = await this.db.execute(`SELECT c.*, cat.name AS category_name, co.course_title
         FROM osce_cases c
         LEFT JOIN osce_categories cat ON cat.id = c.category_id
         LEFT JOIN courses co ON co.id = c.course_id
        WHERE c.id = ? LIMIT 1`, [id]);
        if (!rows.length)
            return null;
        return { ...this.mapCaseRow(rows[0]), caseData: this.parseDoc(rows[0].case_data) };
    }
    async getCaseBySlug(slug, publishedOnly = false) {
        const [rows] = await this.db.execute(`SELECT c.*, cat.name AS category_name, co.course_title
         FROM osce_cases c
         LEFT JOIN osce_categories cat ON cat.id = c.category_id
         LEFT JOIN courses co ON co.id = c.course_id
        WHERE c.slug = ? ${publishedOnly ? "AND c.status = 'published' AND c.is_public = 1" : ''}
        LIMIT 1`, [slug]);
        if (!rows.length)
            return null;
        return { ...this.mapCaseRow(rows[0]), caseData: this.parseDoc(rows[0].case_data) };
    }
    parseDoc(raw) {
        if (!raw)
            return { ...EMPTY_DOC };
        try {
            const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
            return { ...EMPTY_DOC, ...parsed };
        }
        catch {
            return { ...EMPTY_DOC };
        }
    }
    async updateCase(id, patch) {
        const existing = await this.getCaseById(id);
        if (!existing)
            throw new common_1.NotFoundException('Case not found');
        const sets = [];
        const params = [];
        if (patch.title !== undefined) {
            sets.push('title = ?');
            params.push(String(patch.title).trim());
        }
        if (patch.summary !== undefined) {
            sets.push('summary = ?');
            params.push(patch.summary ?? null);
        }
        if (patch.difficulty !== undefined) {
            sets.push('difficulty = ?');
            params.push(patch.difficulty);
        }
        if (patch.isPublic !== undefined) {
            sets.push('is_public = ?');
            params.push(patch.isPublic ? 1 : 0);
        }
        if (patch.caseData !== undefined) {
            sets.push('case_data = ?');
            params.push(JSON.stringify(patch.caseData));
        }
        if (patch.isFree !== undefined) {
            sets.push('is_free = ?');
            params.push(patch.isFree ? 1 : 0);
        }
        if (patch.stationType !== undefined) {
            sets.push('station_type = ?');
            params.push(patch.stationType === 'long' ? 'long' : 'short');
        }
        if (patch.categoryId !== undefined) {
            const [catRows] = await this.db.execute('SELECT id, course_id FROM osce_categories WHERE id = ? LIMIT 1', [Number(patch.categoryId)]);
            if (catRows.length) {
                sets.push('category_id = ?');
                params.push(Number(catRows[0].id));
                sets.push('course_id = ?');
                params.push(Number(catRows[0].course_id));
            }
        }
        if (!sets.length)
            return existing;
        params.push(id);
        await this.db.execute(`UPDATE osce_cases SET ${sets.join(', ')} WHERE id = ?`, params);
        return this.getCaseById(id);
    }
    async deleteCase(id) {
        await this.db.execute('DELETE FROM osce_media WHERE case_id = ?', [id]);
        await this.db.execute('DELETE FROM osce_progress WHERE case_id = ?', [id]);
        await this.db.execute('DELETE FROM osce_cases WHERE id = ?', [id]);
        return { deleted: true };
    }
    declaredSlots(doc) {
        const out = [];
        const push = (slot, label, brief = '') => {
            if (slot && !out.some((s) => s.slot === slot))
                out.push({ slot, label, brief });
        };
        push('cover', 'Case cover', 'Representative image for the station card.');
        for (const scene of doc.scenes || []) {
            push(scene.media, `Scene — ${scene.title || scene.id}`, '');
            push(scene.flip?.media, `Scene — ${scene.title || scene.id} (${scene.flip?.label || 'alternate'})`, '');
            push(scene.compare?.media, `Compare — ${scene.compare?.label || 'normal'}`, '');
        }
        for (const sign of doc.signs || []) {
            push(sign.media, `Sign — ${sign.name}`, sign.brief || '');
            push(sign.compare?.media, `Compare — ${sign.compare?.label || 'normal'}`, '');
        }
        for (const step of doc.chain || []) {
            push(step.media, `Pathophysiology ${step.step} — ${step.title}`, '');
        }
        for (const ix of doc.investigations || []) {
            if (!ix.ref)
                push(ix.media, `Investigation — ${ix.modality.toUpperCase()}`, '');
        }
        return out;
    }
    async listMedia(caseId) {
        const [rows] = await this.db.execute('SELECT slot_key, storage_key, thumb_key, mime, source, bytes, width, height, updated_at FROM osce_media WHERE case_id = ?', [caseId]);
        return rows.map((r) => ({
            slot: String(r.slot_key),
            storageKey: String(r.storage_key),
            thumbKey: r.thumb_key ? String(r.thumb_key) : null,
            mime: String(r.mime),
            source: String(r.source || 'upload'),
            bytes: Number(r.bytes || 0),
            width: r.width ? Number(r.width) : null,
            height: r.height ? Number(r.height) : null,
            updatedAt: r.updated_at,
        }));
    }
    async shotList(caseId) {
        const found = await this.getCaseById(caseId);
        if (!found)
            throw new common_1.NotFoundException('Case not found');
        const media = await this.listMedia(caseId);
        const bySlot = new Map(media.map((m) => [m.slot, m]));
        return this.declaredSlots(found.caseData).map((entry) => {
            const spec = specForSlot(entry.slot);
            const filled = bySlot.get(entry.slot) || null;
            return {
                ...entry,
                ...spec,
                fileName: `${found.slug}/${slotToFileBase(entry.slot)}.webp`,
                filled: !!filled,
                media: filled,
            };
        });
    }
    async saveSlotImage(caseId, slotKey, file, meta = {}) {
        const found = await this.getCaseById(caseId);
        if (!found)
            throw new common_1.NotFoundException('Case not found');
        if (!/^[A-Za-z0-9:_-]{1,120}$/.test(slotKey))
            throw new common_1.BadRequestException('Invalid slot key');
        if (!file?.buffer?.length)
            throw new common_1.BadRequestException('No file received');
        const ext = this.extForMime(file.mimetype);
        if (!ext)
            throw new common_1.BadRequestException('Unsupported file type — images or MP4/WebM video');
        const isVideo = OsceService_1.isVideoMime(file.mimetype);
        const ceiling = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
        if (file.buffer.length > ceiling) {
            throw new common_1.BadRequestException(isVideo ? 'Video is too large (max 60 MB)' : 'Image is too large (max 6 MB)');
        }
        const dir = (0, path_1.join)(MEDIA_ROOT(), found.slug);
        await (0, promises_1.mkdir)(dir, { recursive: true });
        const base = slotToFileBase(slotKey);
        const fileName = `${base}.${ext}`;
        const [prior] = await this.db.execute('SELECT storage_key, thumb_key FROM osce_media WHERE case_id = ? AND slot_key = ? LIMIT 1', [caseId, slotKey]);
        for (const key of [prior?.[0]?.storage_key, prior?.[0]?.thumb_key]) {
            if (key && String(key) !== `${found.slug}/${fileName}`) {
                await (0, promises_1.unlink)((0, path_1.join)(MEDIA_ROOT(), String(key))).catch(() => undefined);
            }
        }
        await (0, promises_1.writeFile)((0, path_1.join)(dir, fileName), file.buffer);
        const storageKey = `${found.slug}/${fileName}`;
        let thumbKey = null;
        if (meta.thumbBuffer?.length) {
            const thumbName = `${base}@480.${ext}`;
            await (0, promises_1.writeFile)((0, path_1.join)(dir, thumbName), meta.thumbBuffer);
            thumbKey = `${found.slug}/${thumbName}`;
        }
        await this.db.execute(`INSERT INTO osce_media (case_id, slot_key, storage_key, thumb_key, mime, source, bytes, width, height)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE storage_key = VALUES(storage_key), thumb_key = VALUES(thumb_key),
                               mime = VALUES(mime), source = VALUES(source), bytes = VALUES(bytes),
                               width = VALUES(width), height = VALUES(height)`, [caseId, slotKey, storageKey, thumbKey, file.mimetype, meta.source ?? 'upload',
            file.buffer.length, meta.width ?? null, meta.height ?? null]);
        return { slot: slotKey, storageKey, thumbKey, bytes: file.buffer.length };
    }
    async promptForSlot(caseId, slotKey) {
        const found = await this.getCaseById(caseId);
        if (!found)
            throw new common_1.NotFoundException('Case not found');
        const doc = found.caseData;
        const spec = specForSlot(slotKey);
        const shape = `Framed ${spec.ratio}, filling the frame edge to edge with no letterboxing.`;
        const clean = 'No text, no letters, no numbers, no labels, no arrows, no watermarks, no borders.';
        if (slotKey === 'cover') {
            return `Photographic cover image for a clinical examination station on ${found.title}. `
                + `A patient in a hospital gown in a calm clinical setting, shallow depth of field. `
                + `${clean} ${shape}`;
        }
        if (slotKey.startsWith('sign:')) {
            const sign = (doc.signs || []).find((s) => s.media === slotKey);
            const detail = sign?.brief?.trim()
                || `The clinical sign "${sign?.name || slotKey.slice(5).replace(/-/g, ' ')}" as seen on examination.`;
            return `Clinical photograph for a medical teaching app, as it would appear in a real `
                + `examination. ${detail} Realistic skin tones and lighting, the finding clearly visible `
                + `and correctly located, nothing else emphasised. ${clean} ${shape}`;
        }
        if (slotKey.startsWith('scene:')) {
            const scene = (doc.scenes || []).find((s) => s.media === slotKey || s.flip?.media === slotKey || s.compare?.media === slotKey);
            const what = scene?.title || slotKey.slice(6).replace(/-/g, ' ');
            if (slotKey.startsWith('scene:body')) {
                return `Full-length clinical photograph of a standing patient, front on, in a hospital `
                    + `gown, whole body head to toe inside the frame, plain neutral background, even `
                    + `lighting. ${clean} ${shape}`;
            }
            return `Medical illustration of the ${what}, textbook anatomical accuracy, clean neutral `
                + `background, even lighting, centred in frame. ${clean} ${shape}`;
        }
        if (slotKey.startsWith('chain:')) {
            const step = (doc.chain || []).find((c) => c.media === slotKey);
            return `Simple medical illustration of a single concept: ${step?.title || ''}. `
                + `${step?.body || ''} One clear subject, clean neutral background. ${clean} ${shape}`;
        }
        if (slotKey.startsWith('ix:')) {
            const modality = slotKey.slice(3).toUpperCase();
            const ix = (doc.investigations || []).find((i) => i.media === slotKey);
            const single = ix?.findings?.[0];
            return `A real ${modality} as it would appear in ${found.title}`
                + `${single ? `, showing ${single}` : ''}. Photographed straight on, filling the frame. ${shape}`;
        }
        return `Medical illustration for ${found.title}. ${clean} ${shape}`;
    }
    async saveGeneratedSlot(caseId, slotKey, dataUrl) {
        const match = String(dataUrl).match(/^data:([^;,]+);base64,(.+)$/s);
        if (!match)
            throw new common_1.BadRequestException('The image service returned nothing usable');
        const buffer = Buffer.from(match[2], 'base64');
        return this.saveSlotImage(caseId, slotKey, { buffer, mimetype: match[1] }, { source: 'ai' });
    }
    async clearSlot(caseId, slotKey) {
        const [rows] = await this.db.execute('SELECT storage_key, thumb_key FROM osce_media WHERE case_id = ? AND slot_key = ? LIMIT 1', [caseId, slotKey]);
        for (const key of [rows?.[0]?.storage_key, rows?.[0]?.thumb_key]) {
            if (key)
                await (0, promises_1.unlink)((0, path_1.join)(MEDIA_ROOT(), String(key))).catch(() => undefined);
        }
        await this.db.execute('DELETE FROM osce_media WHERE case_id = ? AND slot_key = ?', [caseId, slotKey]);
        return { cleared: true };
    }
    async listInbox() {
        await (0, promises_1.mkdir)(INBOX_DIR(), { recursive: true });
        const names = await (0, promises_1.readdir)(INBOX_DIR()).catch(() => []);
        return names
            .filter((n) => /\.(jpe?g|png|webp)$/i.test(n))
            .map((n) => ({ fileName: n, slot: this.slotFromFileName(n) }));
    }
    slotFromFileName(fileName) {
        const stem = fileName.replace(/\.[^.]+$/, '');
        if (stem === 'cover')
            return 'cover';
        const m = stem.match(/^(scene|sign|chain|ix)-(.+)$/);
        return m ? `${m[1]}:${m[2]}` : null;
    }
    async takeFromInbox(fileName) {
        if (!/^[A-Za-z0-9._-]+\.(?:jpe?g|png|webp)$/i.test(fileName)) {
            throw new common_1.BadRequestException('Invalid inbox file name');
        }
        const path = (0, path_1.join)(INBOX_DIR(), fileName);
        const { readFile } = await Promise.resolve().then(() => require('fs/promises'));
        const buffer = await readFile(path).catch(() => null);
        if (!buffer)
            throw new common_1.NotFoundException('Inbox file not found');
        return { buffer, path };
    }
    async discardInbox(fileName) {
        if (!/^[A-Za-z0-9._-]+\.(?:jpe?g|png|webp)$/i.test(fileName)) {
            throw new common_1.BadRequestException('Invalid inbox file name');
        }
        await (0, promises_1.unlink)((0, path_1.join)(INBOX_DIR(), fileName)).catch(() => undefined);
        return { discarded: true };
    }
    async archiveInbox(fileName) {
        const doneDir = (0, path_1.join)(INBOX_DIR(), '_used');
        await (0, promises_1.mkdir)(doneDir, { recursive: true });
        await (0, promises_1.rename)((0, path_1.join)(INBOX_DIR(), fileName), (0, path_1.join)(doneDir, fileName)).catch(() => undefined);
    }
    extForMime(mime) {
        const map = {
            'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png',
            'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov', 'video/ogg': 'ogv',
        };
        return map[String(mime).toLowerCase()] || null;
    }
    static isVideoMime(mime) {
        return String(mime || '').toLowerCase().startsWith('video/');
    }
    async publishCase(id) {
        const shots = await this.shotList(id);
        const missing = shots.filter((s) => !s.filled);
        if (missing.length) {
            throw new common_1.BadRequestException(`${missing.length} image slot${missing.length === 1 ? '' : 's'} still empty: ` +
                missing.slice(0, 5).map((m) => m.slot).join(', ') + (missing.length > 5 ? '…' : ''));
        }
        await this.db.execute("UPDATE osce_cases SET status = 'published' WHERE id = ?", [id]);
        return this.getCaseById(id);
    }
    async unpublishCase(id) {
        await this.db.execute("UPDATE osce_cases SET status = 'draft' WHERE id = ?", [id]);
        return this.getCaseById(id);
    }
    async getProgress(userId) {
        const [rows] = await this.db.execute(`SELECT p.case_id, c.slug, p.checklist_json, p.seen_json, p.is_favourite, p.completed_at, p.updated_at
         FROM osce_progress p JOIN osce_cases c ON c.id = p.case_id
        WHERE p.user_id = ?`, [userId]);
        return rows.map((r) => ({
            caseId: Number(r.case_id),
            slug: String(r.slug),
            checklist: this.safeJson(r.checklist_json, {}),
            favourite: Number(r.is_favourite) === 1,
            seen: this.safeJson(r.seen_json, []),
            completedAt: r.completed_at,
            updatedAt: r.updated_at,
        }));
    }
    async saveProgress(userId, caseId, body) {
        await this.db.execute(`INSERT INTO osce_progress
         (user_id, case_id, checklist_json, seen_json, completed_at, is_favourite)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         checklist_json = COALESCE(VALUES(checklist_json), checklist_json),
         seen_json      = COALESCE(VALUES(seen_json), seen_json),
         completed_at   = COALESCE(VALUES(completed_at), completed_at),
         is_favourite   = COALESCE(VALUES(is_favourite), is_favourite)`, [
            userId, caseId,
            body.checklist === undefined ? null : JSON.stringify(body.checklist),
            body.seen === undefined ? null : JSON.stringify(body.seen),
            body.completed ? new Date() : null,
            body.favourite === undefined ? null : (body.favourite ? 1 : 0),
        ]);
        return { saved: true };
    }
    safeJson(raw, fallback) {
        if (raw == null)
            return fallback;
        if (typeof raw === 'object')
            return raw;
        try {
            return JSON.parse(String(raw));
        }
        catch {
            return fallback;
        }
    }
    async hydrateCase(slug, baseUrl, publishedOnly = true, userId) {
        const found = await this.getCaseBySlug(slug, publishedOnly);
        if (!found)
            return null;
        if (publishedOnly && userId) {
            const profile = await this.accessProfile(userId);
            const open = found.isFree || this.courseInScope(found.courseId, profile);
            if (!open) {
                throw new common_1.ForbiddenException('This station is part of a course your subscription does not cover.');
            }
        }
        const media = await this.listMedia(found.id);
        const bySlot = new Map(media.map((m) => [m.slot, m]));
        const root = baseUrl.replace(/\/+$/, '');
        const url = (slot) => {
            if (!slot)
                return null;
            const hit = bySlot.get(slot);
            if (!hit)
                return null;
            const stamp = hit.updatedAt ? new Date(hit.updatedAt).getTime() : 0;
            const video = OsceService_1.isVideoMime(hit.mime);
            return {
                full: `${root}/api/osce/media/${hit.storageKey}?v=${stamp}`,
                thumb: hit.thumbKey ? `${root}/api/osce/media/${hit.thumbKey}?v=${stamp}` : null,
                width: hit.width, height: hit.height,
                kind: video ? 'video' : 'image',
                mime: hit.mime || null,
            };
        };
        const doc = found.caseData;
        const scenes = (doc.scenes || []).map((s) => ({
            ...s,
            image: url(s.media),
            flip: s.flip ? { label: s.flip.label, image: url(s.flip.media) } : null,
            compare: s.compare ? { label: s.compare.label, image: url(s.compare.media) } : null,
        }));
        const signs = (doc.signs || []).map((s) => ({
            ...s,
            image: url(s.media),
            compare: s.compare ? { label: s.compare.label, image: url(s.compare.media) } : null,
        }));
        const chain = (doc.chain || []).map((c) => ({ ...c, image: url(c.media) }));
        const investigations = await Promise.all((doc.investigations || []).map(async (ix) => {
            if (ix.ref?.type === 'ecg_card') {
                const card = await this.ecgCardSummary(ix.ref.id, root);
                return { ...ix, title: card?.title ?? ix.modality.toUpperCase(), image: card?.image ?? null };
            }
            return { ...ix, image: url(ix.media) };
        }));
        const sounds = await Promise.all((doc.sounds || []).map(async (snd) => ({
            ...snd,
            audio: snd.ref ? await this.auscultationAudio(snd.ref.id, root) : null,
            compareAudio: snd.compareWith ? await this.auscultationAudio(snd.compareWith.id, root) : null,
        })));
        const isLong = String(found.stationType || '') === 'long'
            || doc.stationType === 'long';
        const related = await this.resolveRelated(doc.related, publishedOnly, found.slug);
        const signById = new Map((doc.signs || []).map((s) => [s.id, s]));
        const edges = Array.isArray(doc.summary?.connect) ? doc.summary.connect : [];
        const connect = (doc.chain || [])
            .map((step) => ({
            step: Number(step.step),
            title: String(step.title || ''),
            body: String(step.body || ''),
            signs: edges
                .filter((e) => Number(e.to) === Number(step.step))
                .map((e) => signById.get(String(e.from)))
                .filter(Boolean)
                .map((s) => ({
                id: s.id,
                name: s.name,
                short: s.short || '',
                category: s.category || '',
            })),
        }))
            .filter((row) => row.signs.length > 0);
        return {
            ...found,
            caseData: {
                ...doc,
                scenes, signs, chain, investigations, sounds, related,
                summary: { ...(doc.summary || {}), connect: doc.summary?.connect || [], graph: connect },
                ...(isLong ? { cast: await this.globalMedia(baseUrl) } : {}),
            },
            cover: url('cover'),
        };
    }
    async resolveRelated(related, publishedOnly, selfSlug) {
        const list = Array.isArray(related) ? related : [];
        if (!list.length)
            return [];
        const slugs = [...new Set(list.map((r) => String(r?.case || '').trim()).filter(Boolean))];
        if (!slugs.length)
            return [];
        const [rows] = await this.db.execute(`SELECT slug, title, status, station_type, is_free
         FROM osce_cases WHERE slug IN (${slugs.map(() => '?').join(',')})`, slugs);
        const bySlug = new Map(rows.map((r) => [String(r.slug), r]));
        const out = [];
        for (const item of list) {
            const slug = String(item?.case || '').trim();
            if (!slug || slug === selfSlug)
                continue;
            const hit = bySlug.get(slug);
            const openable = !!hit && (!publishedOnly || String(hit.status) === 'published');
            if (!openable && publishedOnly)
                continue;
            out.push({
                rel: String(item?.rel || 'differential'),
                case: slug,
                note: String(item?.note || ''),
                title: hit ? String(hit.title) : '',
                stationType: hit ? String(hit.station_type || 'short') : '',
                missing: !hit,
                unpublished: !!hit && String(hit.status) !== 'published',
            });
        }
        return out;
    }
    async ecgCardSummary(cardId, root) {
        const [rows] = await this.db.execute('SELECT id, title FROM ecg_cards WHERE id = ? AND is_active = 1 LIMIT 1', [cardId]);
        if (!rows.length)
            return null;
        return {
            title: String(rows[0].title),
            image: { full: `${root}/api/osce/ecg/${cardId}/image`, thumb: null, width: null, height: null },
        };
    }
    async auscultationAudio(cardId, root) {
        const [rows] = await this.db.execute('SELECT id, title FROM auscultation_cards WHERE id = ? AND is_active = 1 LIMIT 1', [cardId]);
        if (!rows.length)
            return null;
        return {
            title: String(rows[0].title),
            url: `${root}/api/osce/sound/${cardId}/audio`,
        };
    }
    async auscultationAudioBytes(cardId) {
        const [rows] = await this.db.execute('SELECT audio_file, audio_mime FROM auscultation_cards WHERE id = ? AND is_active = 1 LIMIT 1', [cardId]);
        const file = String(rows?.[0]?.audio_file || '').trim();
        if (!file)
            return null;
        const buffer = await (0, promises_1.readFile)((0, path_1.join)(AUSCULTATION_AUDIO_DIR(), (0, path_1.basename)(file)))
            .catch(() => null);
        if (!buffer?.length)
            return null;
        return { buffer, mime: String(rows[0].audio_mime || 'audio/mpeg') };
    }
    async ecgImageBytes(cardId) {
        const [rows] = await this.db.execute('SELECT image_url FROM ecg_cards WHERE id = ? AND is_active = 1 LIMIT 1', [cardId]);
        const raw = rows?.[0]?.image_url ? String(rows[0].image_url) : '';
        const match = raw.match(/^data:([^;,]+);base64,(.+)$/s);
        if (!match)
            return null;
        return { mime: match[1], buffer: Buffer.from(match[2], 'base64') };
    }
};
exports.OsceService = OsceService;
exports.OsceService = OsceService = OsceService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_tokens_1.DATABASE_CONNECTION)),
    __metadata("design:paramtypes", [Object])
], OsceService);
//# sourceMappingURL=osce.service.js.map