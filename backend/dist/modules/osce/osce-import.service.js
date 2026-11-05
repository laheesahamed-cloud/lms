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
Object.defineProperty(exports, "__esModule", { value: true });
exports.OsceImportService = void 0;
const common_1 = require("@nestjs/common");
const database_tokens_1 = require("../../database/database.tokens");
const osce_service_1 = require("./osce.service");
const DIFFICULTIES = ['core', 'intermediate', 'advanced'];
const CATEGORIES = ['inspection', 'palpation', 'percussion', 'auscultation', 'symptom'];
const MODALITIES = ['ecg', 'cxr', 'echo', 'labs', 'other'];
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const MAX_CASES = 200;
const slugify = (v) => String(v ?? '').toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const str = (v) => (v == null ? '' : String(v));
const strList = (v) => (Array.isArray(v) ? v.map(str).filter(Boolean) : v ? [str(v)] : []);
let OsceImportService = class OsceImportService {
    constructor(db, osce) {
        this.db = db;
        this.osce = osce;
    }
    assertSafe(node, path = '$', depth = 0) {
        if (depth > 24)
            throw new common_1.BadRequestException(`JSON is nested too deeply at ${path}`);
        if (Array.isArray(node)) {
            node.forEach((n, i) => this.assertSafe(n, `${path}[${i}]`, depth + 1));
        }
        else if (node && typeof node === 'object') {
            for (const k of Object.keys(node)) {
                if (FORBIDDEN_KEYS.has(k))
                    throw new common_1.BadRequestException(`Disallowed key "${k}" at ${path}`);
                this.assertSafe(node[k], `${path}.${k}`, depth + 1);
            }
        }
    }
    cases(pkg) {
        if (!pkg || typeof pkg !== 'object' || Array.isArray(pkg)) {
            throw new common_1.BadRequestException('The file must be a JSON object with a "cases" list.');
        }
        this.assertSafe(pkg);
        if (!Array.isArray(pkg.cases) || !pkg.cases.length) {
            throw new common_1.BadRequestException('No cases found — expected a "cases" array.');
        }
        if (pkg.cases.length > MAX_CASES) {
            throw new common_1.BadRequestException(`Too many cases in one file (max ${MAX_CASES}).`);
        }
        return pkg.cases;
    }
    adaptCase(raw) {
        const errors = [];
        const warnings = [];
        const cd = raw?.case_data && typeof raw.case_data === 'object' ? raw.case_data : {};
        const isLong = raw?.station_type === 'long' || cd.stationType === 'long' || Array.isArray(cd.sections) && cd.sections.length > 0;
        const signs = (Array.isArray(cd.signs) ? cd.signs : []).map((s, i) => {
            const id = slugify(s?.id || s?.name) || `sign-${i + 1}`;
            const rawCat = str(s?.category || s?.method).toLowerCase();
            const mapped = CATEGORIES.includes(rawCat) ? rawCat
                : rawCat.startsWith('inspect') ? 'inspection'
                    : rawCat.startsWith('palpat') ? 'palpation'
                        : rawCat.startsWith('percuss') ? 'percussion'
                            : rawCat.startsWith('auscult') ? 'auscultation' : '';
            if (rawCat && !mapped)
                warnings.push(`Finding "${str(s?.name)}": unknown method "${rawCat}", set to inspection.`);
            const category = mapped || 'inspection';
            return {
                id,
                name: str(s?.name) || 'Untitled finding',
                category,
                region: s?.region ? str(s.region) : null,
                media: str(s?.media || s?.media_slot) || `sign:${id}`,
                short: str(s?.short ?? s?.what),
                how: str(s?.how),
                body: str(s?.body ?? s?.why),
                brief: str(s?.brief),
                sound: s?.sound ? str(s.sound) : null,
                compare: s?.compare?.media
                    ? { label: str(s.compare.label) || 'Normal', media: str(s.compare.media) }
                    : null,
            };
        });
        const signIds = new Set(signs.map((s) => s.id));
        const rawScenes = Array.isArray(cd.scenes) ? cd.scenes : [];
        const sceneIds = new Set(rawScenes.map((sc, i) => slugify(sc?.id || sc?.title || sc?.label) || `scene-${i + 1}`));
        const parentOf = new Map();
        const scenes = rawScenes.map((sc, i) => {
            const id = slugify(sc?.id || sc?.title || sc?.label) || `scene-${i + 1}`;
            const hotspots = (Array.isArray(sc?.hotspots) ? sc.hotspots : []).map((h) => {
                const x = Number(h?.x);
                const y = Number(h?.y);
                if (!(x >= 0 && x <= 1 && y >= 0 && y <= 1)) {
                    errors.push(`Scene "${id}": hotspot "${str(h?.label)}" is outside 0–1 (x=${h?.x}, y=${h?.y}).`);
                }
                let action = h?.action;
                if (!action) {
                    const tt = str(h?.target_type);
                    const tid = slugify(h?.target_id);
                    action = tt === 'sign' || tt === 'scene' ? { type: tt, id: tid } : { type: 'label' };
                }
                if (action.type === 'sign' && !signIds.has(action.id)) {
                    errors.push(`Scene "${id}": hotspot "${str(h?.label)}" points at unknown finding "${action.id}".`);
                }
                if (action.type === 'scene') {
                    if (!sceneIds.has(action.id))
                        errors.push(`Scene "${id}": hotspot "${str(h?.label)}" points at unknown scene "${action.id}".`);
                    else if (!parentOf.has(action.id))
                        parentOf.set(action.id, id);
                }
                return { x, y, label: str(h?.label), action };
            });
            return {
                id,
                title: str(sc?.title ?? sc?.label) || id,
                parent: sc?.parent === undefined ? null : sc.parent ? slugify(sc.parent) : null,
                media: str(sc?.media ?? sc?.slot_key) || (id === 'body' ? 'scene:body' : `scene:${id}`),
                hotspots,
                _explicitParent: sc?.parent !== undefined,
            };
        });
        for (const sc of scenes) {
            if (!sc._explicitParent && parentOf.has(sc.id))
                sc.parent = parentOf.get(sc.id);
            delete sc._explicitParent;
        }
        if (!isLong && scenes.length && !scenes.some((s) => !s.parent)) {
            warnings.push('No root scene — one scene should have no parent.');
        }
        const chain = (Array.isArray(cd.chain) ? cd.chain : []).map((c, i) => {
            const step = Number(c?.step) || i + 1;
            return { step, title: str(c?.title) || `Step ${step}`, body: str(c?.body), media: str(c?.media) || `chain:${step}` };
        });
        const steps = new Set(chain.map((c) => c.step));
        const usedIx = new Set();
        const investigations = (Array.isArray(cd.investigations) ? cd.investigations : []).map((ix) => {
            const label = str(ix?.modality).toLowerCase();
            const modality = MODALITIES.includes(label) ? label
                : /ecg|electrocardio/.test(label) ? 'ecg'
                    : /echo/.test(label) ? 'echo'
                        : /chest|x-?ray|cxr|radiograph/.test(label) ? 'cxr'
                            : /blood|lab|fbc|urea|test/.test(label) ? 'labs' : 'other';
            if (modality === 'other' && label)
                warnings.push(`Investigation "${str(ix?.modality)}" is filed as ${modality.toUpperCase()}.`);
            let media = ix?.ref ? null : str(ix?.media) || `ix:${modality}`;
            if (media) {
                if (usedIx.has(media))
                    media = null;
                else
                    usedIx.add(media);
            }
            const findings = Array.isArray(ix?.findings) ? ix.findings.map(str) : ix?.findings ? [str(ix.findings)] : [];
            return { modality, ref: ix?.ref ?? null, media, findings };
        });
        const sounds = (Array.isArray(cd.sounds) ? cd.sounds : []).map((s, i) => ({
            id: str(s?.id) || `sound-${i + 1}`,
            title: str(s?.title) || 'Sound',
            ref: s?.ref ?? null,
            compareWith: s?.compareWith ?? null,
            markers: (Array.isArray(s?.markers) ? s.markers : []).map((m) => ({
                label: str(m?.label), from: Number(m?.from) || 0, to: Number(m?.to) || 0,
            })),
        }));
        const connectRaw = cd.summary?.connect;
        const edges = Array.isArray(connectRaw)
            ? connectRaw.map((e) => ({ from: str(e?.from), to: Number(e?.to) }))
            : connectRaw && typeof connectRaw === 'object'
                ? Object.entries(connectRaw).map(([k, v]) => ({ from: slugify(k), to: Number(v) }))
                : [];
        const connect = edges.filter((e) => signIds.has(e.from) && steps.has(e.to));
        if (edges.length !== connect.length) {
            warnings.push(`${edges.length - connect.length} sign-to-mechanism link(s) pointed at a finding or step that doesn't exist and were dropped.`);
        }
        const treatment = (Array.isArray(cd.treatment) ? cd.treatment : [])
            .map((g) => ({ group: str(g?.group), items: strList(g?.items) }))
            .filter((g) => g.items.length);
        const related = (Array.isArray(cd.related) ? cd.related : [])
            .map((r) => ({
            rel: ['cause', 'complication', 'differential'].includes(str(r?.rel)) ? r.rel : 'differential',
            case: slugify(r?.case), note: r?.note ? str(r.note) : undefined,
        })).filter((r) => r.case);
        const practice = {
            checklist: (Array.isArray(cd.practice?.checklist) ? cd.practice.checklist : []).map((c) => ({
                section: str(c?.section) || 'General',
                items: (Array.isArray(c?.items) ? c.items : [])
                    .map((it) => (typeof it === 'string' ? it : str(it?.text ?? it?.label))).filter(Boolean),
            })),
            questions: (Array.isArray(cd.practice?.questions) ? cd.practice.questions : [])
                .map((q) => ({ q: str(q?.q ?? q?.question), a: str(q?.a ?? q?.answer) })),
        };
        const doc = {
            version: 1,
            scenes, signs, chain, investigations, sounds,
            summary: { keyPoints: strList(cd.summary?.keyPoints), osceTips: strList(cd.summary?.osceTips), connect },
            treatment, related, practice,
        };
        if (isLong) {
            const p = cd.patient || {};
            doc.stationType = 'long';
            doc.patient = {
                name: str(p.name) || 'The patient',
                age: Number(p.age) || null,
                sex: str(p.sex),
                occupation: str(p.occupation),
                opening: str(p.opening ?? p.presenting_complaint),
            };
            doc.sections = (Array.isArray(cd.sections) ? cd.sections : []).map((sec, i) => ({
                id: slugify(sec?.id || sec?.title) || `section-${i + 1}`,
                title: str(sec?.title) || `Section ${i + 1}`,
                purpose: str(sec?.purpose),
                exchanges: (Array.isArray(sec?.exchanges) ? sec.exchanges : []).map((ex) => ({
                    ask: str(ex?.ask ?? ex?.question), reply: str(ex?.reply ?? ex?.answer), note: str(ex?.note),
                })).filter((ex) => ex.ask || ex.reply),
            }));
            doc.differentials = (Array.isArray(cd.differentials) ? cd.differentials : []).map((d) => typeof d === 'string'
                ? { diagnosis: d, supporting: '', against: '' }
                : { diagnosis: str(d?.diagnosis), supporting: str(d?.supporting), against: str(d?.against) });
            doc.initialManagement = strList(cd.initialManagement);
            if (!doc.sections.length)
                errors.push('A long case needs at least one history section.');
        }
        else if (!scenes.length && !signs.length) {
            errors.push('A short case needs scenes and findings.');
        }
        if (cd.simulation && typeof cd.simulation === 'object')
            doc.simulation = cd.simulation;
        const cr = raw?.clinical_review ?? cd.clinical_review;
        if (cr && typeof cr === 'object')
            doc.clinical_review = cr;
        return { doc, errors, warnings };
    }
    async existing(slugs) {
        if (!slugs.length)
            return new Map();
        const [rows] = await this.db.query('SELECT id, slug, status, station_type FROM osce_cases WHERE slug IN (?)', [slugs]);
        return new Map(rows.map((r) => [String(r.slug), { id: Number(r.id), status: String(r.status), type: String(r.station_type) }]));
    }
    plan(pkg) {
        const list = this.cases(pkg);
        return Promise.all([this.existing(list.map((c) => slugify(c?.slug)).filter(Boolean))]).then(([found]) => {
            const seen = new Set();
            return list.map((raw, index) => {
                const slug = slugify(raw?.slug);
                const { doc, errors, warnings } = this.adaptCase(raw);
                const type = doc.stationType === 'long' ? 'long' : 'short';
                if (!slug)
                    errors.push('Missing "slug".');
                else if (seen.has(slug))
                    errors.push(`Slug "${slug}" appears twice in this file.`);
                seen.add(slug);
                if (!str(raw?.title).trim())
                    errors.push('Missing "title".');
                if (raw?.station_type && !['short', 'long'].includes(raw.station_type))
                    errors.push(`station_type must be short or long.`);
                if (raw?.difficulty && !DIFFICULTIES.includes(raw.difficulty)) {
                    warnings.push(`difficulty "${raw.difficulty}" isn't core/intermediate/advanced — using core.`);
                }
                if (raw?.is_public)
                    warnings.push('"is_public" ignored — imports are always drafts.');
                const courseRef = str(raw?.course_ref);
                const topicRef = str(raw?.topic_ref);
                const ex = found.get(slug);
                let action = ex ? 'update' : 'create';
                if (ex?.status === 'published') {
                    action = 'skip';
                    warnings.push('Already published — left untouched. Unpublish it first if you want to replace it.');
                }
                else if (ex && ex.type !== type) {
                    errors.push(`Existing draft is a ${ex.type} case; the file says ${type}. Delete the draft first.`);
                }
                if (errors.length)
                    action = 'error';
                const slots = this.osce.declaredSlots(doc).length;
                const row = {
                    index, slug, title: str(raw?.title), stationType: type, courseRef, topicRef,
                    refKey: `${courseRef}|${topicRef}`, action, existingId: ex?.id, errors, warnings, slots,
                };
                return { row, raw, doc };
            });
        });
    }
    async preview(pkg) {
        const planned = await this.plan(pkg);
        const refs = new Map();
        for (const { row } of planned) {
            if (row.action === 'skip' || row.action === 'update')
                continue;
            const r = refs.get(row.refKey) || { key: row.refKey, courseRef: row.courseRef, topicRef: row.topicRef, cases: 0 };
            r.cases += 1;
            refs.set(row.refKey, r);
        }
        const rows = planned.map((p) => p.row);
        return {
            format: str(pkg?.format_id) || null,
            rows,
            refs: [...refs.values()],
            totals: {
                cases: rows.length,
                create: rows.filter((r) => r.action === 'create').length,
                update: rows.filter((r) => r.action === 'update').length,
                skip: rows.filter((r) => r.action === 'skip').length,
                error: rows.filter((r) => r.action === 'error').length,
            },
        };
    }
    async commit(pkg, mapping, adminId) {
        const planned = await this.plan(pkg);
        const results = [];
        for (const { row, raw, doc } of planned) {
            const base = { slug: row.slug, title: row.title };
            if (row.action === 'skip') {
                results.push({ ...base, status: 'skipped', id: row.existingId, message: row.warnings[row.warnings.length - 1] });
                continue;
            }
            if (row.action === 'error') {
                results.push({ ...base, status: 'failed', message: row.errors.join(' ') });
                continue;
            }
            try {
                const difficulty = DIFFICULTIES.includes(raw?.difficulty) ? raw.difficulty : 'core';
                if (row.action === 'update') {
                    await this.osce.updateCase(row.existingId, {
                        title: row.title, summary: str(raw?.summary), difficulty, caseData: doc,
                        isFree: raw?.is_free === undefined ? undefined : !!raw.is_free,
                    });
                    results.push({ ...base, status: 'updated', id: row.existingId });
                    continue;
                }
                const categoryId = Number(mapping?.[row.refKey]);
                if (!categoryId) {
                    results.push({ ...base, status: 'failed', message: `No category chosen for "${row.courseRef}" / "${row.topicRef}".` });
                    continue;
                }
                const created = await this.osce.createCase({
                    categoryId, title: row.title, summary: str(raw?.summary), difficulty,
                    stationType: row.stationType, caseData: doc, createdBy: adminId, slug: row.slug,
                });
                if (raw?.is_free)
                    await this.osce.updateCase(created.id, { isFree: true });
                results.push({ ...base, status: 'created', id: created?.id });
            }
            catch (err) {
                results.push({ ...base, status: 'failed', message: err instanceof Error ? err.message : String(err) });
            }
        }
        return {
            results,
            totals: {
                created: results.filter((r) => r.status === 'created').length,
                updated: results.filter((r) => r.status === 'updated').length,
                skipped: results.filter((r) => r.status === 'skipped').length,
                failed: results.filter((r) => r.status === 'failed').length,
            },
        };
    }
    async exportCases(slugs) {
        const [rows] = await this.db.query(`SELECT c.id, c.slug, c.title, c.summary, c.difficulty, c.station_type, c.is_free, c.case_data,
              cat.name AS category_name, co.course_title
         FROM osce_cases c
         LEFT JOIN osce_categories cat ON cat.id = c.category_id
         LEFT JOIN courses co ON co.id = c.course_id
        ${slugs?.length ? 'WHERE c.slug IN (?)' : ''}
        ORDER BY c.id`, slugs?.length ? [slugs] : []);
        const cases = rows.map((r) => {
            let doc = {};
            try {
                doc = JSON.parse(String(r.case_data || '{}'));
            }
            catch { }
            return {
                slug: r.slug, title: r.title, summary: r.summary || '', station_type: r.station_type,
                difficulty: r.difficulty, course_ref: r.course_title || '', topic_ref: r.category_name || '',
                is_free: Number(r.is_free) === 1,
                case_data: doc,
                media_slots: this.osce.declaredSlots(doc).map((s) => s.slot),
            };
        });
        return { format_id: 'osce.bulk-import', format_version: '1.0.0', exported_at: new Date().toISOString(), cases };
    }
};
exports.OsceImportService = OsceImportService;
exports.OsceImportService = OsceImportService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_tokens_1.DATABASE_CONNECTION)),
    __metadata("design:paramtypes", [Object, osce_service_1.OsceService])
], OsceImportService);
//# sourceMappingURL=osce-import.service.js.map