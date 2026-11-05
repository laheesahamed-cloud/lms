import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { Pool, RowDataPacket } from 'mysql2/promise';
import { DATABASE_CONNECTION } from '../../database/database.tokens';
import { CaseDocument, OsceService } from './osce.service';

/**
 * JSON bulk import.
 *
 * The package format (see OSCE_BULK_IMPORT_SAMPLE.json) is friendlier to write
 * than the stored `CaseDocument`: findings carry what / how / why, hotspots name
 * their target, `connect` is a map. `adaptCase()` translates it into the stored
 * shape, and passes an already-native document through untouched, so exporting
 * and re-importing keeps working.
 *
 * Rules that keep this safe:
 *  - everything lands as a DRAFT, never public;
 *  - a slug that is already PUBLISHED is skipped and reported, never touched;
 *  - a draft with the same slug has its content replaced; its category, order
 *    and uploaded images (osce_media) are left alone;
 *  - images are never part of the JSON — slots are declared, the admin uploads.
 */

const DIFFICULTIES = ['core', 'intermediate', 'advanced'];
const CATEGORIES = ['inspection', 'palpation', 'percussion', 'auscultation', 'symptom'];
const MODALITIES = ['ecg', 'cxr', 'echo', 'labs', 'other'];
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const MAX_CASES = 200;

export interface ImportRow {
  index: number;
  slug: string;
  title: string;
  stationType: 'short' | 'long';
  courseRef: string;
  topicRef: string;
  refKey: string;
  action: 'create' | 'update' | 'skip' | 'error';
  existingId?: number;
  errors: string[];
  warnings: string[];
  slots: number;
}

const slugify = (v: any) => String(v ?? '').toLowerCase().trim()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const str = (v: any) => (v == null ? '' : String(v));
const strList = (v: any): string[] => (Array.isArray(v) ? v.map(str).filter(Boolean) : v ? [str(v)] : []);

@Injectable()
export class OsceImportService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Pool,
    private readonly osce: OsceService,
  ) {}

  /* ───────────────────────── validation ───────────────────────── */

  private assertSafe(node: any, path = '$', depth = 0) {
    if (depth > 24) throw new BadRequestException(`JSON is nested too deeply at ${path}`);
    if (Array.isArray(node)) {
      node.forEach((n, i) => this.assertSafe(n, `${path}[${i}]`, depth + 1));
    } else if (node && typeof node === 'object') {
      for (const k of Object.keys(node)) {
        if (FORBIDDEN_KEYS.has(k)) throw new BadRequestException(`Disallowed key "${k}" at ${path}`);
        this.assertSafe(node[k], `${path}.${k}`, depth + 1);
      }
    }
  }

  private cases(pkg: any): any[] {
    if (!pkg || typeof pkg !== 'object' || Array.isArray(pkg)) {
      throw new BadRequestException('The file must be a JSON object with a "cases" list.');
    }
    this.assertSafe(pkg);
    if (!Array.isArray(pkg.cases) || !pkg.cases.length) {
      throw new BadRequestException('No cases found — expected a "cases" array.');
    }
    if (pkg.cases.length > MAX_CASES) {
      throw new BadRequestException(`Too many cases in one file (max ${MAX_CASES}).`);
    }
    return pkg.cases;
  }

  /* ───────────────────────── the adapter ───────────────────────── */

  /** Translate one package case into the stored document. Never throws. */
  adaptCase(raw: any): { doc: CaseDocument; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const cd = raw?.case_data && typeof raw.case_data === 'object' ? raw.case_data : {};
    const isLong = raw?.station_type === 'long' || cd.stationType === 'long' || Array.isArray(cd.sections) && cd.sections.length > 0;

    // ── findings ──
    const signs = (Array.isArray(cd.signs) ? cd.signs : []).map((s: any, i: number) => {
      const id = slugify(s?.id || s?.name) || `sign-${i + 1}`;
      const rawCat = str(s?.category || s?.method).toLowerCase();
      const mapped = CATEGORIES.includes(rawCat) ? rawCat
        : rawCat.startsWith('inspect') ? 'inspection'
        : rawCat.startsWith('palpat') ? 'palpation'
        : rawCat.startsWith('percuss') ? 'percussion'
        : rawCat.startsWith('auscult') ? 'auscultation' : '';
      if (rawCat && !mapped) warnings.push(`Finding "${str(s?.name)}": unknown method "${rawCat}", set to inspection.`);
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
        // A "normal" picture shown beside the abnormal one. Optional.
        compare: s?.compare?.media
          ? { label: str(s.compare.label) || 'Normal', media: str(s.compare.media) }
          : null,
      } as any;
    });
    const signIds = new Set(signs.map((s: any) => s.id));

    // ── scenes: hotspots name a target; a child's parent is whoever points at it ──
    const rawScenes: any[] = Array.isArray(cd.scenes) ? cd.scenes : [];
    const sceneIds = new Set(rawScenes.map((sc, i) => slugify(sc?.id || sc?.title || sc?.label) || `scene-${i + 1}`));
    const parentOf = new Map<string, string>();
    const scenes = rawScenes.map((sc, i) => {
      const id = slugify(sc?.id || sc?.title || sc?.label) || `scene-${i + 1}`;
      const hotspots = (Array.isArray(sc?.hotspots) ? sc.hotspots : []).map((h: any) => {
        const x = Number(h?.x); const y = Number(h?.y);
        if (!(x >= 0 && x <= 1 && y >= 0 && y <= 1)) {
          errors.push(`Scene "${id}": hotspot "${str(h?.label)}" is outside 0–1 (x=${h?.x}, y=${h?.y}).`);
        }
        let action: any = h?.action;
        if (!action) {
          const tt = str(h?.target_type); const tid = slugify(h?.target_id);
          action = tt === 'sign' || tt === 'scene' ? { type: tt, id: tid } : { type: 'label' };
        }
        if (action.type === 'sign' && !signIds.has(action.id)) {
          errors.push(`Scene "${id}": hotspot "${str(h?.label)}" points at unknown finding "${action.id}".`);
        }
        if (action.type === 'scene') {
          if (!sceneIds.has(action.id)) errors.push(`Scene "${id}": hotspot "${str(h?.label)}" points at unknown scene "${action.id}".`);
          else if (!parentOf.has(action.id)) parentOf.set(action.id, id);
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
      } as any;
    });
    for (const sc of scenes) {
      if (!sc._explicitParent && parentOf.has(sc.id)) sc.parent = parentOf.get(sc.id);
      delete sc._explicitParent;
    }
    if (!isLong && scenes.length && !scenes.some((s: any) => !s.parent)) {
      warnings.push('No root scene — one scene should have no parent.');
    }

    // ── mechanism ──
    const chain = (Array.isArray(cd.chain) ? cd.chain : []).map((c: any, i: number) => {
      const step = Number(c?.step) || i + 1;
      return { step, title: str(c?.title) || `Step ${step}`, body: str(c?.body), media: str(c?.media) || `chain:${step}` };
    });
    const steps = new Set(chain.map((c: any) => c.step));

    // ── investigations ──
    const usedIx = new Set<string>();
    const investigations = (Array.isArray(cd.investigations) ? cd.investigations : []).map((ix: any) => {
      const label = str(ix?.modality).toLowerCase();
      const modality = MODALITIES.includes(label) ? label
        : /ecg|electrocardio/.test(label) ? 'ecg'
        : /echo/.test(label) ? 'echo'
        : /chest|x-?ray|cxr|radiograph/.test(label) ? 'cxr'
        : /blood|lab|fbc|urea|test/.test(label) ? 'labs' : 'other';
      if (modality === 'other' && label) warnings.push(`Investigation "${str(ix?.modality)}" is filed as ${modality.toUpperCase()}.`);
      let media: string | null = ix?.ref ? null : str(ix?.media) || `ix:${modality}`;
      if (media) {
        if (usedIx.has(media)) media = null; else usedIx.add(media);
      }
      const findings = Array.isArray(ix?.findings) ? ix.findings.map(str) : ix?.findings ? [str(ix.findings)] : [];
      return { modality, ref: ix?.ref ?? null, media, findings };
    });

    const sounds = (Array.isArray(cd.sounds) ? cd.sounds : []).map((s: any, i: number) => ({
      id: str(s?.id) || `sound-${i + 1}`,
      title: str(s?.title) || 'Sound',
      ref: s?.ref ?? null,
      compareWith: s?.compareWith ?? null,
      markers: (Array.isArray(s?.markers) ? s.markers : []).map((m: any) => ({
        label: str(m?.label), from: Number(m?.from) || 0, to: Number(m?.to) || 0,
      })),
    }));

    // ── summary: connect may be a { signId: step } map ──
    const connectRaw = cd.summary?.connect;
    const edges: Array<{ from: string; to: number }> = Array.isArray(connectRaw)
      ? connectRaw.map((e: any) => ({ from: str(e?.from), to: Number(e?.to) }))
      : connectRaw && typeof connectRaw === 'object'
        ? Object.entries(connectRaw).map(([k, v]) => ({ from: slugify(k), to: Number(v) }))
        : [];
    const connect = edges.filter((e) => signIds.has(e.from) && steps.has(e.to));
    if (edges.length !== connect.length) {
      warnings.push(`${edges.length - connect.length} sign-to-mechanism link(s) pointed at a finding or step that doesn't exist and were dropped.`);
    }

    const treatment = (Array.isArray(cd.treatment) ? cd.treatment : [])
      .map((g: any) => ({ group: str(g?.group), items: strList(g?.items) }))
      .filter((g: any) => g.items.length);

    const related = (Array.isArray(cd.related) ? cd.related : [])
      .map((r: any) => ({
        rel: ['cause', 'complication', 'differential'].includes(str(r?.rel)) ? r.rel : 'differential',
        case: slugify(r?.case), note: r?.note ? str(r.note) : undefined,
      })).filter((r: any) => r.case);

    // ── practice: items may be strings or { id, text, marks } ──
    const practice = {
      checklist: (Array.isArray(cd.practice?.checklist) ? cd.practice.checklist : []).map((c: any) => ({
        section: str(c?.section) || 'General',
        items: (Array.isArray(c?.items) ? c.items : [])
          .map((it: any) => (typeof it === 'string' ? it : str(it?.text ?? it?.label))).filter(Boolean),
      })),
      questions: (Array.isArray(cd.practice?.questions) ? cd.practice.questions : [])
        .map((q: any) => ({ q: str(q?.q ?? q?.question), a: str(q?.a ?? q?.answer) })),
    };

    const doc: any = {
      version: 1,
      scenes, signs, chain, investigations, sounds,
      summary: { keyPoints: strList(cd.summary?.keyPoints), osceTips: strList(cd.summary?.osceTips), connect },
      treatment, related, practice,
    };

    // ── long case ──
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
      doc.sections = (Array.isArray(cd.sections) ? cd.sections : []).map((sec: any, i: number) => ({
        id: slugify(sec?.id || sec?.title) || `section-${i + 1}`,
        title: str(sec?.title) || `Section ${i + 1}`,
        purpose: str(sec?.purpose),
        exchanges: (Array.isArray(sec?.exchanges) ? sec.exchanges : []).map((ex: any) => ({
          ask: str(ex?.ask ?? ex?.question), reply: str(ex?.reply ?? ex?.answer), note: str(ex?.note),
        })).filter((ex: any) => ex.ask || ex.reply),
      }));
      doc.differentials = (Array.isArray(cd.differentials) ? cd.differentials : []).map((d: any) =>
        typeof d === 'string'
          ? { diagnosis: d, supporting: '', against: '' }
          : { diagnosis: str(d?.diagnosis), supporting: str(d?.supporting), against: str(d?.against) });
      doc.initialManagement = strList(cd.initialManagement);
      if (!doc.sections.length) errors.push('A long case needs at least one history section.');
    } else if (!scenes.length && !signs.length) {
      errors.push('A short case needs scenes and findings.');
    }

    // Passed through for later phases (Random OSCE authoring, review sign-off).
    if (cd.simulation && typeof cd.simulation === 'object') doc.simulation = cd.simulation;
    const cr = raw?.clinical_review ?? cd.clinical_review;
    if (cr && typeof cr === 'object') doc.clinical_review = cr;

    return { doc, errors, warnings };
  }

  /* ───────────────────────── preview / commit ───────────────────────── */

  private async existing(slugs: string[]) {
    if (!slugs.length) return new Map<string, { id: number; status: string; type: string }>();
    const [rows] = await this.db.query<RowDataPacket[]>(
      'SELECT id, slug, status, station_type FROM osce_cases WHERE slug IN (?)', [slugs]
    );
    return new Map(rows.map((r) => [String(r.slug), { id: Number(r.id), status: String(r.status), type: String(r.station_type) }]));
  }

  private plan(pkg: any) {
    const list = this.cases(pkg);
    return Promise.all([this.existing(list.map((c) => slugify(c?.slug)).filter(Boolean))]).then(([found]) => {
      const seen = new Set<string>();
      return list.map((raw, index) => {
        const slug = slugify(raw?.slug);
        const { doc, errors, warnings } = this.adaptCase(raw);
        const type: 'short' | 'long' = (doc as any).stationType === 'long' ? 'long' : 'short';
        if (!slug) errors.push('Missing "slug".');
        else if (seen.has(slug)) errors.push(`Slug "${slug}" appears twice in this file.`);
        seen.add(slug);
        if (!str(raw?.title).trim()) errors.push('Missing "title".');
        if (raw?.station_type && !['short', 'long'].includes(raw.station_type)) errors.push(`station_type must be short or long.`);
        if (raw?.difficulty && !DIFFICULTIES.includes(raw.difficulty)) {
          warnings.push(`difficulty "${raw.difficulty}" isn't core/intermediate/advanced — using core.`);
        }
        if (raw?.is_public) warnings.push('"is_public" ignored — imports are always drafts.');

        const courseRef = str(raw?.course_ref); const topicRef = str(raw?.topic_ref);
        const ex = found.get(slug);
        let action: ImportRow['action'] = ex ? 'update' : 'create';
        if (ex?.status === 'published') {
          action = 'skip';
          warnings.push('Already published — left untouched. Unpublish it first if you want to replace it.');
        } else if (ex && ex.type !== type) {
          errors.push(`Existing draft is a ${ex.type} case; the file says ${type}. Delete the draft first.`);
        }
        if (errors.length) action = 'error';
        const slots = this.osce.declaredSlots(doc).length;
        const row: ImportRow = {
          index, slug, title: str(raw?.title), stationType: type, courseRef, topicRef,
          refKey: `${courseRef}|${topicRef}`, action, existingId: ex?.id, errors, warnings, slots,
        };
        return { row, raw, doc };
      });
    });
  }

  async preview(pkg: any) {
    const planned = await this.plan(pkg);
    const refs = new Map<string, { key: string; courseRef: string; topicRef: string; cases: number }>();
    for (const { row } of planned) {
      if (row.action === 'skip' || row.action === 'update') continue;
      const r = refs.get(row.refKey) || { key: row.refKey, courseRef: row.courseRef, topicRef: row.topicRef, cases: 0 };
      r.cases += 1; refs.set(row.refKey, r);
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

  /**
   * `mapping` maps "course_ref|topic_ref" to an OSCE category id. A case whose
   * pair isn't mapped is reported, not guessed at.
   */
  async commit(pkg: any, mapping: Record<string, number>, adminId: number | null) {
    const planned = await this.plan(pkg);
    const results: Array<{ slug: string; title: string; status: 'created' | 'updated' | 'skipped' | 'failed'; id?: number; message?: string }> = [];

    for (const { row, raw, doc } of planned) {
      const base = { slug: row.slug, title: row.title };
      if (row.action === 'skip') { results.push({ ...base, status: 'skipped', id: row.existingId, message: row.warnings[row.warnings.length - 1] }); continue; }
      if (row.action === 'error') { results.push({ ...base, status: 'failed', message: row.errors.join(' ') }); continue; }
      try {
        const difficulty = DIFFICULTIES.includes(raw?.difficulty) ? raw.difficulty : 'core';
        if (row.action === 'update') {
          // Content only. Category, order, publish state and osce_media rows stay.
          await this.osce.updateCase(row.existingId!, {
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
        const created: any = await this.osce.createCase({
          categoryId, title: row.title, summary: str(raw?.summary), difficulty,
          stationType: row.stationType, caseData: doc, createdBy: adminId, slug: row.slug,
        });
        if (raw?.is_free) await this.osce.updateCase(created.id, { isFree: true });
        results.push({ ...base, status: 'created', id: created?.id });
      } catch (err) {
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

  /** Export: stored documents, newest format, slot manifest only — never images. */
  async exportCases(slugs?: string[]) {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT c.id, c.slug, c.title, c.summary, c.difficulty, c.station_type, c.is_free, c.case_data,
              cat.name AS category_name, co.course_title
         FROM osce_cases c
         LEFT JOIN osce_categories cat ON cat.id = c.category_id
         LEFT JOIN courses co ON co.id = c.course_id
        ${slugs?.length ? 'WHERE c.slug IN (?)' : ''}
        ORDER BY c.id`,
      slugs?.length ? [slugs] : []
    );
    const cases = rows.map((r) => {
      let doc: any = {};
      try { doc = JSON.parse(String(r.case_data || '{}')); } catch { /* leave empty */ }
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
}
