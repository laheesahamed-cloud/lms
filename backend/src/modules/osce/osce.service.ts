import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Pool, RowDataPacket } from 'mysql2/promise';
import { mkdir, writeFile, unlink, readdir, rename, readFile } from 'fs/promises';
import { join, basename } from 'path';
import { DATABASE_CONNECTION } from '../../database/database.tokens';

/** Where the Auscultation library keeps its clips (AuscultationService.AUDIO_DIR). */
const AUSCULTATION_AUDIO_DIR = () => join(process.cwd(), 'uploads', 'sound-clips');

/* ─────────────────────────── types ─────────────────────────── */

export type HotspotAction =
  | { type: 'sign'; id: string }
  | { type: 'scene'; id: string }
  | { type: 'label' };

export interface Hotspot {
  x: number;            // 0–1 fraction of image width
  y: number;            // 0–1 fraction of image height
  label: string;
  action: HotspotAction;
}

export interface Scene {
  id: string;
  title?: string;
  parent?: string | null;
  media?: string | null;                                  // slot key
  flip?: { label: string; media: string } | null;         // front/back body
  compare?: { label: string; media: string } | null;      // normal vs abnormal
  hotspots?: Hotspot[];
}

export interface Sign {
  id: string;
  name: string;
  category: 'inspection' | 'palpation' | 'percussion' | 'auscultation' | 'symptom';
  region?: string | null;
  media?: string | null;
  compare?: { label: string; media: string } | null;
  short?: string;
  body?: string;
  brief?: string;                                         // what the image should show
}

export interface ContentRef { type: 'ecg_card' | 'auscultation_card'; id: number }

export interface CaseDocument {
  version: number;
  scenes: Scene[];
  signs: Sign[];
  chain: Array<{ step: number; title: string; media?: string | null; body?: string }>;
  investigations: Array<{
    modality: 'ecg' | 'cxr' | 'echo' | 'labs' | 'other';
    ref?: ContentRef | null;
    media?: string | null;
    findings?: string[];
  }>;
  sounds: Array<{
    title: string;
    ref?: ContentRef | null;
    compareWith?: ContentRef | null;
    markers?: Array<{ label: string; from: number; to: number }>;
  }>;
  summary: {
    keyPoints?: string[];
    osceTips?: string[];
    // from = a sign id, to = a chain step number.
    connect?: Array<{ from: string; to: number }>;
  };
  related?: Array<{ rel: 'cause' | 'complication' | 'differential'; case: string; note?: string }>;
  practice: {
    checklist: Array<{ section: string; items: string[] }>;
    questions: Array<{ q: string; a: string }>;
  };
}

/**
 * Two ratios, deliberately.
 *
 * Every scene in a zoom chain shares ONE shape so the frame never resizes as you
 * move body → chest → heart; a box that changed shape per image is what made the
 * transition between them jump. Everything you look at away from the body shares
 * the other. Investigations keep their own shape because a chest film forced
 * into a landscape crop stops being a chest film.
 */
// One rule: 4:3 for everything, portrait only for the whole patient. Both are
// canonical ratios, so the image model renders them natively instead of
// approximating — which is what went wrong with 3:2 and 2:1.
export const BODY_SPEC = { ratio: '3:4', width: 1536, height: 2048 };
export const STANDARD_SPEC = { ratio: '4:3', width: 1536, height: 1152 };

export const SLOT_SPECS: Record<string, { ratio: string; width: number; height: number }> = {
  cover: STANDARD_SPEC,
  'scene:body': BODY_SPEC,
  scene: STANDARD_SPEC,
  sign: STANDARD_SPEC,
  chain: STANDARD_SPEC,
  'ix:ecg': STANDARD_SPEC,
  'ix:cxr': STANDARD_SPEC,
  'ix:echo': STANDARD_SPEC,
};

export function specForSlot(slotKey: string) {
  // Only the full-patient view is portrait — it's the one image that has to
  // hold a standing figure head to toe.
  if (slotKey.startsWith('scene:body')) return BODY_SPEC;
  if (SLOT_SPECS[slotKey]) return SLOT_SPECS[slotKey];
  return STANDARD_SPEC;
}

// Long cases all share one doctor and one patient picture rather than carrying
// their own — the conversation is the content, the faces are just staging.
export const GLOBAL_CASE_ID = 0;
export const GLOBAL_SLOTS = ['global:doctor', 'global:patient'];

/**
 * The body regions the map offers, in head-to-toe order.
 *
 * Deliberately a short fixed list: the generator invents region words freely,
 * and a map with fourteen zones of one station each teaches nothing. Anything
 * unrecognised becomes "general", which is honest — it means "look at the whole
 * patient" rather than pretending to a location.
 */
const REGION_ORDER = [
  'head', 'neck', 'chest', 'abdomen', 'groin', 'hands', 'legs', 'general',
] as const;

const REGION_LABELS: Record<string, string> = {
  head: 'Head and face',
  neck: 'Neck',
  chest: 'Chest',
  abdomen: 'Abdomen',
  groin: 'Groin',
  hands: 'Hands and arms',
  legs: 'Legs and feet',
  general: 'Whole patient',
};

const REGION_SYNONYMS: Record<string, string> = {
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

function normalizeRegion(raw?: string | null) {
  const key = String(raw || '').trim().toLowerCase();
  return REGION_SYNONYMS[key] || 'general';
}

const MEDIA_ROOT = () => join(process.cwd(), 'uploads', 'osce');
const INBOX_DIR = () => join(MEDIA_ROOT(), '_inbox');
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

const EMPTY_DOC: CaseDocument = {
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

/** `sign:malar-flush` → `sign-malar-flush` — the filename an author drops in. */
export function slotToFileBase(slotKey: string) {
  return slotKey.replace(/:/g, '-').replace(/[^A-Za-z0-9._-]/g, '-');
}

@Injectable()
export class OsceService {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Pool) {}

  /* ──────────────── categories = course subjects ──────────────── */

  /**
   * OSCE categories are the course's own subjects (`topics`), so adding a
   * subject in the admin panel creates a station category with no extra step.
   * For students the list is filtered to courses their subscription covers.
   */
  async listSystems(publishedOnly = false, userId?: number) {
    const profile = publishedOnly && userId ? await this.accessProfile(userId) : null;

    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT t.id AS topic_id, t.topic_name, t.sort_order,
              co.id AS course_id, co.course_title,
              COUNT(c.id) AS case_count,
              SUM(CASE WHEN c.is_free = 1 THEN 1 ELSE 0 END) AS free_count
         FROM topics t
         JOIN courses co ON co.id = t.course_id
         LEFT JOIN osce_cases c ON c.topic_id = t.id
              ${publishedOnly ? "AND c.status = 'published' AND c.is_public = 1" : ''}
        WHERE t.status = 'active' AND co.status = 'active'
        GROUP BY t.id
        ${publishedOnly ? 'HAVING case_count > 0' : ''}
        ORDER BY co.id, t.sort_order, t.topic_name`
    );

    return rows
      .filter((r) => {
        if (!profile) return true;
        // A subject shows when the course is in scope, or it has free stations.
        if (Number(r.free_count || 0) > 0) return true;
        return this.courseInScope(Number(r.course_id), profile);
      })
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
        // "Locked" means nothing in here opens — a subject with free stations
        // is still usable even when the course itself is out of scope.
        locked: profile
          ? !this.courseInScope(Number(r.course_id), profile) && Number(r.free_count || 0) === 0
          : false,
      }));
  }

  /* ─────────────────────── body map ──────────────────────── */

  /**
   * Stations grouped by where on the body their findings are.
   *
   * A second way in, per the plan: instead of course → subject → station, start
   * from "there's something odd in this patient's neck". Regions are derived
   * from each sign's own `region`, normalised — the generator writes whatever
   * word fits ("lips", "genital", "praecordium") rather than sticking to a list,
   * so an unmapped word lands in "general" instead of creating a region of one.
   */
  async listRegions(baseUrl: string, userId?: number) {
    const cases = await this.listCases({ publishedOnly: true, userId, baseUrl });
    const profile = userId ? await this.accessProfile(userId) : null;

    const buckets = new Map<string, Array<Record<string, unknown>>>();
    for (const key of REGION_ORDER) buckets.set(key, []);

    for (const item of cases) {
      // A long case is a conversation with no examination findings, so it has
      // nothing to place on a body.
      if (String((item as any).stationType) === 'long') continue;

      const full = await this.getCaseById(Number((item as any).id));
      if (!full) continue;
      const regions = new Set<string>();
      for (const sign of full.caseData?.signs || []) {
        regions.add(normalizeRegion(sign.region));
      }
      if (!regions.size) regions.add('general');

      for (const region of regions) {
        buckets.get(region)!.push({
          id: (item as any).id,
          title: (item as any).title,
          slug: (item as any).slug,
          summary: (item as any).summary,
          stationType: (item as any).stationType,
          cover: (item as any).cover,
          favourite: (item as any).favourite,
          locked: profile ? !this.caseInScope(full as any, profile) : false,
        });
      }
    }

    return REGION_ORDER.map((key) => ({
      key,
      label: REGION_LABELS[key],
      caseCount: buckets.get(key)!.length,
      cases: buckets.get(key)!,
    })).filter((r) => r.caseCount > 0);
  }

  /** ECG cards and auscultation clips available to attach to a case. */
  /**
   * ECG cards and auscultation clips a case can link to.
   *
   * Each row carries a preview URL, because picking a diagnostic by title alone
   * is guesswork — two cards called "Atrial fibrillation" differ in what they
   * actually show, and the whole point of linking is that the content is right.
   */
  async listLinkableContent(query: string, baseUrl = '') {
    const like = `%${String(query || '').trim()}%`;
    const hasQuery = String(query || '').trim().length > 0;
    const root = String(baseUrl || '').replace(/\/+$/, '');

    const [ecg] = await this.db.execute<RowDataPacket[]>(
      `SELECT e.id, e.title, t.title AS topic_title
         FROM ecg_cards e
         LEFT JOIN ecg_topics t ON t.id = e.topic_id
        WHERE e.is_active = 1 ${hasQuery ? 'AND e.title LIKE ?' : ''}
        ORDER BY e.position, e.id LIMIT 100`,
      hasQuery ? [like] : []
    );

    const [sounds] = await this.db.execute<RowDataPacket[]>(
      `SELECT a.id, a.title, a.audio_file, t.title AS topic_title, t.category
         FROM auscultation_cards a
         LEFT JOIN auscultation_topics t ON t.id = a.topic_id
        WHERE a.is_active = 1 ${hasQuery ? 'AND a.title LIKE ?' : ''}
        ORDER BY a.position, a.id LIMIT 100`,
      hasQuery ? [like] : []
    );

    return {
      ecgCards: ecg.map((r) => ({
        id: Number(r.id),
        title: String(r.title),
        group: r.topic_title ? String(r.topic_title) : '',
        // Served from our own streaming route — the card itself holds a base64
        // data URI, far too big to inline into a picker list.
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

  /* ──────────────────── shared long-case art ───────────────── */

  /** The doctor and patient pictures every long case reuses. */
  async globalMedia(baseUrl: string) {
    const [rows] = await this.db.execute<RowDataPacket[]>(
      'SELECT slot_key, storage_key, thumb_key, UNIX_TIMESTAMP(updated_at) AS stamp '
      + 'FROM osce_media WHERE case_id = ?',
      [GLOBAL_CASE_ID]
    );
    const root = (baseUrl || '').replace(/\/+$/, '');
    const out: Record<string, { full: string; thumb: string } | null> = {
      doctor: null, patient: null,
    };
    for (const r of rows) {
      const key = String(r.slot_key).replace('global:', '');
      if (!Object.prototype.hasOwnProperty.call(out, key)) continue;
      out[key] = {
        full: `${root}/api/osce/media/${r.storage_key}?v=${r.stamp || 0}`,
        thumb: `${root}/api/osce/media/${r.thumb_key || r.storage_key}?v=${r.stamp || 0}`,
      };
    }
    return out;
  }

  /** Global art lives under a reserved slug rather than a case folder. */
  async saveGlobalImage(slotKey: string, file: { buffer: Buffer; mimetype: string }) {
    if (!GLOBAL_SLOTS.includes(slotKey)) throw new BadRequestException('Unknown global slot');
    if (!file?.buffer?.length) throw new BadRequestException('No file received');

    const ext = this.extForMime(file.mimetype);
    if (!ext) throw new BadRequestException('Unsupported image type');

    const dir = join(MEDIA_ROOT(), '_global');
    await mkdir(dir, { recursive: true });
    const base = slotToFileBase(slotKey);
    const fileName = `${base}.${ext}`;

    const [prior] = await this.db.execute<RowDataPacket[]>(
      'SELECT storage_key FROM osce_media WHERE case_id = ? AND slot_key = ? LIMIT 1',
      [GLOBAL_CASE_ID, slotKey]
    );
    const priorKey = prior?.[0]?.storage_key ? String(prior[0].storage_key) : '';
    if (priorKey && priorKey !== `_global/${fileName}`) {
      await unlink(join(MEDIA_ROOT(), priorKey)).catch(() => undefined);
    }

    await writeFile(join(dir, fileName), file.buffer);
    await this.db.execute(
      `INSERT INTO osce_media (case_id, slot_key, storage_key, mime, source, bytes)
       VALUES (?, ?, ?, ?, 'upload', ?)
       ON DUPLICATE KEY UPDATE storage_key = VALUES(storage_key), mime = VALUES(mime),
                               bytes = VALUES(bytes)`,
      [GLOBAL_CASE_ID, slotKey, `_global/${fileName}`, file.mimetype, file.buffer.length]
    );
    return { slot: slotKey, storageKey: `_global/${fileName}` };
  }

  /* ─────────────────────── categories ─────────────────────── */

  /**
   * OSCE categories belong to OSCE, not to the lesson structure. They live
   * under a course but are named and ordered by the admin, so a station can be
   * filed under "Thyroid lumps" with no matching lesson subject, and the OSCE
   * order never has to follow the teaching order.
   */
  async listCategories(opts: { courseId?: number; publishedOnly?: boolean; userId?: number } = {}) {
    const profile = opts.publishedOnly && opts.userId
      ? await this.accessProfile(opts.userId) : null;

    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT cat.id, cat.course_id, cat.name, cat.sort_order, cat.is_active,
              co.course_title,
              COUNT(c.id) AS case_count,
              SUM(CASE WHEN c.is_free = 1 THEN 1 ELSE 0 END) AS free_count
         FROM osce_categories cat
         JOIN courses co ON co.id = cat.course_id
         LEFT JOIN osce_cases c ON c.category_id = cat.id
              ${opts.publishedOnly ? "AND c.status = 'published' AND c.is_public = 1" : ''}
        WHERE cat.is_active = 1 ${opts.courseId ? 'AND cat.course_id = ?' : ''}
        GROUP BY cat.id
        ${opts.publishedOnly ? 'HAVING case_count > 0' : ''}
        ORDER BY cat.sort_order, cat.name`,
      opts.courseId ? [opts.courseId] : []
    );

    return rows
      .filter((r) => !profile
        || Number(r.free_count || 0) > 0
        || this.courseInScope(Number(r.course_id), profile))
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
        locked: profile
          ? !this.courseInScope(Number(r.course_id), profile) && Number(r.free_count || 0) === 0
          : false,
      }));
  }

  async createCategory(courseId: number, name: string) {
    const clean = String(name || '').trim();
    if (!clean) throw new BadRequestException('Give the category a name');

    // The category list INNER JOINs courses, so a row whose course_id matches
    // no course is written successfully and then never appears again — it looks
    // like the save silently failed. course_id is INT NOT NULL, so a missing
    // course arrives here as 0 rather than as an error. Refuse it instead.
    const course = Number(courseId);
    if (!Number.isInteger(course) || course <= 0) {
      throw new BadRequestException('Pick a course before adding a category');
    }
    const [courseRows] = await this.db.execute<RowDataPacket[]>(
      'SELECT id FROM courses WHERE id = ? LIMIT 1', [course]
    );
    if (!courseRows.length) {
      throw new BadRequestException('That course no longer exists');
    }

    const [max] = await this.db.execute<RowDataPacket[]>(
      'SELECT COALESCE(MAX(sort_order), 0) AS n FROM osce_categories WHERE course_id = ?',
      [course]
    );
    const [res] = await this.db.execute<any>(
      'INSERT INTO osce_categories (course_id, name, sort_order) VALUES (?, ?, ?)',
      [course, clean, Number(max?.[0]?.n || 0) + 1]
    );
    return { id: Number(res.insertId), courseId: course, name: clean };
  }

  async updateCategory(id: number, patch: { name?: string; isActive?: boolean }) {
    const sets: string[] = [];
    const params: any[] = [];
    if (patch.name !== undefined) { sets.push('name = ?'); params.push(String(patch.name).trim()); }
    if (patch.isActive !== undefined) { sets.push('is_active = ?'); params.push(patch.isActive ? 1 : 0); }
    if (!sets.length) return { updated: false };
    params.push(id);
    await this.db.execute(`UPDATE osce_categories SET ${sets.join(', ')} WHERE id = ?`, params);
    return { updated: true };
  }

  async deleteCategory(id: number) {
    const [rows] = await this.db.execute<RowDataPacket[]>(
      'SELECT COUNT(*) AS n FROM osce_cases WHERE category_id = ?', [id]
    );
    if (Number(rows?.[0]?.n || 0) > 0) {
      throw new BadRequestException(
        'Move or delete the stations in this category first.'
      );
    }
    await this.db.execute('DELETE FROM osce_categories WHERE id = ?', [id]);
    return { deleted: true };
  }

  /** Persist an explicit order — the whole point is not inheriting one. */
  async reorderCategories(ids: number[]) {
    for (let i = 0; i < ids.length; i++) {
      await this.db.execute(
        'UPDATE osce_categories SET sort_order = ? WHERE id = ?', [i + 1, Number(ids[i])]
      );
    }
    return { ordered: ids.length };
  }

  async reorderCases(ids: number[]) {
    for (let i = 0; i < ids.length; i++) {
      await this.db.execute(
        'UPDATE osce_cases SET sort_order = ? WHERE id = ?', [i + 1, Number(ids[i])]
      );
    }
    return { ordered: ids.length };
  }

  /* ───────────────────── image settings ───────────────────── */

  /** Which image model to use, editable in the panel so models can be compared. */
  async getImageModel(): Promise<string> {
    const [rows] = await this.db.execute<RowDataPacket[]>(
      "SELECT setting_value FROM system_settings WHERE setting_key = 'osce_image_model' LIMIT 1"
    );
    return rows.length ? String(rows[0].setting_value || '').trim() : '';
  }

  async setImageModel(model: string) {
    await this.db.execute(
      `INSERT INTO system_settings (setting_key, setting_value) VALUES ('osce_image_model', ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [String(model || '').trim()]
    );
    return { model: String(model || '').trim() };
  }

  /**
   * Diagnostics can't be generated — an image model reproduces what ECG paper
   * looks like with no model of the signal underneath, so it will happily draw
   * "AF" over visible P waves. Link a real card instead.
   */
  canGenerateSlot(slotKey: string) {
    return !slotKey.startsWith('ix:');
  }

  /** The category's name, used to steer generation ("Cardiology", "Lumps"). */
  async categoryName(categoryId: number) {
    const [rows] = await this.db.execute<RowDataPacket[]>(
      'SELECT name FROM osce_categories WHERE id = ? LIMIT 1',
      [categoryId]
    );
    return rows.length ? String(rows[0].name) : 'General medicine';
  }

  /**
   * Courses that actually have published stations — the first rung of the
   * student drill-down (course → subject → station), so nothing ever mixes
   * Medicine's subjects with Surgery's in one list.
   */
  async listStudentCourses(userId: number) {
    const profile = await this.accessProfile(userId);
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT co.id, co.course_title,
              COUNT(c.id) AS case_count,
              COUNT(DISTINCT c.topic_id) AS subject_count,
              SUM(CASE WHEN c.is_free = 1 THEN 1 ELSE 0 END) AS free_count
         FROM courses co
         JOIN osce_cases c ON c.course_id = co.id
              AND c.status = 'published' AND c.is_public = 1
        WHERE co.status = 'active'
        GROUP BY co.id
        ORDER BY co.id`
    );
    return rows
      .filter((r) => Number(r.free_count || 0) > 0 || this.courseInScope(Number(r.id), profile))
      .map((r) => ({
        id: Number(r.id),
        title: String(r.course_title),
        caseCount: Number(r.case_count || 0),
        subjectCount: Number(r.subject_count || 0),
        locked: !this.courseInScope(Number(r.id), profile) && Number(r.free_count || 0) === 0,
      }));
  }

  async listCourses() {
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT co.id, co.course_title, COUNT(t.id) AS subject_count
         FROM courses co
         LEFT JOIN topics t ON t.course_id = co.id AND t.status = 'active'
        WHERE co.status = 'active'
        GROUP BY co.id ORDER BY co.id`
    );
    return rows.map((r) => ({
      id: Number(r.id),
      title: String(r.course_title),
      subjectCount: Number(r.subject_count || 0),
    }));
  }

  /* ────────────────────────── cases ────────────────────────── */

  async listCases(opts: {
    categoryId?: number; publishedOnly?: boolean; userId?: number; baseUrl?: string;
  } = {}) {
    const where: string[] = [];
    const params: any[] = [];
    if (opts.categoryId) { where.push('c.category_id = ?'); params.push(opts.categoryId); }
    if (opts.publishedOnly) where.push("c.status = 'published' AND c.is_public = 1");

    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT c.id, c.title, c.slug, c.summary, c.difficulty, c.status, c.is_public,
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
        ORDER BY c.sort_order, c.title`,
      // The join needs a user id even when nobody is signed in (the admin list);
      // 0 matches no row, so every case simply comes back un-favourited.
      [opts.userId ?? 0, ...params]
    );

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

  private mapCaseRow(r: RowDataPacket) {
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

  /* ─────────────────── subscription scope ──────────────────── */

  /**
   * Same rules the lesson canvas uses — an OSCE station belongs to a course, so
   * a student's existing course scope decides what they can open. Free stations
   * are always open.
   */
  private async accessProfile(userId: number) {
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT us.access_scope, us.course_ids_json
         FROM user_subscriptions us
        WHERE us.user_id = ? AND us.status = 'active'
          AND us.start_date <= CURDATE() AND us.end_date >= CURDATE()`,
      [userId]
    );
    const profile = { hasAny: rows.length > 0, full: false, courseIds: new Set<number>() };
    for (const row of rows) {
      const ids = this.parseIdList(row.course_ids_json);
      const scope = String(row.access_scope || '').toLowerCase();
      if (!ids.length && (scope === 'all' || scope === '')) profile.full = true;
      else ids.forEach((id) => profile.courseIds.add(id));
    }
    return profile;
  }

  private parseIdList(raw: any): number[] {
    if (!raw) return [];
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return Array.isArray(parsed) ? parsed.map((v) => Number(v)).filter(Boolean) : [];
    } catch { return []; }
  }

  private courseInScope(courseId: number, profile: { hasAny: boolean; full: boolean; courseIds: Set<number> }) {
    if (!profile.hasAny) return false;
    if (profile.full) return true;
    return profile.courseIds.has(courseId);
  }

  private caseInScope(row: RowDataPacket, profile: { hasAny: boolean; full: boolean; courseIds: Set<number> }) {
    if (Number(row.is_free) === 1) return true;
    return this.courseInScope(Number(row.course_id || 0), profile);
  }

  async createCase(input: {
    categoryId: number;
    title: string;
    summary?: string;
    difficulty?: string;
    caseData?: CaseDocument;
    stationType?: 'short' | 'long';
    createdBy?: number | null;
  }) {
    const title = String(input.title || '').trim();
    if (!title) throw new BadRequestException('Title is required');

    const [catRows] = await this.db.execute<RowDataPacket[]>(
      'SELECT id, course_id FROM osce_categories WHERE id = ? LIMIT 1',
      [Number(input.categoryId)]
    );
    if (!catRows.length) {
      throw new BadRequestException('Pick a category to file this station under');
    }
    const categoryId = Number(catRows[0].id);
    const courseId = Number(catRows[0].course_id);

    const slug = await this.uniqueSlug(title);
    const doc = input.caseData ?? EMPTY_DOC;

    const [res] = await this.db.execute<any>(
      `INSERT INTO osce_cases (course_id, topic_id, category_id, title, slug, summary,
                               difficulty, station_type, case_data, created_by)
       VALUES (?, 0, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        courseId,
        categoryId,
        title,
        slug,
        input.summary ?? null,
        ['core', 'intermediate', 'advanced'].includes(String(input.difficulty)) ? String(input.difficulty) : 'core',
        input.stationType === 'long' ? 'long' : 'short',
        JSON.stringify(doc),
        input.createdBy ?? null,
      ]
    );
    return this.getCaseById(Number(res.insertId));
  }

  private async uniqueSlug(title: string) {
    const base = title.toLowerCase().trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 160) || 'case';
    for (let i = 0; i < 50; i++) {
      const candidate = i === 0 ? base : `${base}-${i + 1}`;
      const [rows] = await this.db.execute<RowDataPacket[]>(
        'SELECT id FROM osce_cases WHERE slug = ? LIMIT 1',
        [candidate]
      );
      if (!rows.length) return candidate;
    }
    return `${base}-${Date.now()}`;
  }

  async getCaseById(id: number) {
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT c.*, cat.name AS category_name, co.course_title
         FROM osce_cases c
         LEFT JOIN osce_categories cat ON cat.id = c.category_id
         LEFT JOIN courses co ON co.id = c.course_id
        WHERE c.id = ? LIMIT 1`,
      [id]
    );
    if (!rows.length) return null;
    return { ...this.mapCaseRow(rows[0]), caseData: this.parseDoc(rows[0].case_data) };
  }

  async getCaseBySlug(slug: string, publishedOnly = false) {
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT c.*, cat.name AS category_name, co.course_title
         FROM osce_cases c
         LEFT JOIN osce_categories cat ON cat.id = c.category_id
         LEFT JOIN courses co ON co.id = c.course_id
        WHERE c.slug = ? ${publishedOnly ? "AND c.status = 'published' AND c.is_public = 1" : ''}
        LIMIT 1`,
      [slug]
    );
    if (!rows.length) return null;
    return { ...this.mapCaseRow(rows[0]), caseData: this.parseDoc(rows[0].case_data) };
  }

  private parseDoc(raw: any): CaseDocument {
    if (!raw) return { ...EMPTY_DOC };
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return { ...EMPTY_DOC, ...parsed };
    } catch {
      return { ...EMPTY_DOC };
    }
  }

  async updateCase(id: number, patch: {
    title?: string; summary?: string; difficulty?: string;
    categoryId?: number; caseData?: CaseDocument; isPublic?: boolean; isFree?: boolean;
    stationType?: 'short' | 'long';
  }) {
    const existing = await this.getCaseById(id);
    if (!existing) throw new NotFoundException('Case not found');

    const sets: string[] = [];
    const params: any[] = [];
    if (patch.title !== undefined) { sets.push('title = ?'); params.push(String(patch.title).trim()); }
    if (patch.summary !== undefined) { sets.push('summary = ?'); params.push(patch.summary ?? null); }
    if (patch.difficulty !== undefined) { sets.push('difficulty = ?'); params.push(patch.difficulty); }
    if (patch.isPublic !== undefined) { sets.push('is_public = ?'); params.push(patch.isPublic ? 1 : 0); }
    if (patch.caseData !== undefined) { sets.push('case_data = ?'); params.push(JSON.stringify(patch.caseData)); }
    if (patch.isFree !== undefined) { sets.push('is_free = ?'); params.push(patch.isFree ? 1 : 0); }
    if (patch.stationType !== undefined) {
      sets.push('station_type = ?'); params.push(patch.stationType === 'long' ? 'long' : 'short');
    }
    if (patch.categoryId !== undefined) {
      const [catRows] = await this.db.execute<RowDataPacket[]>(
        'SELECT id, course_id FROM osce_categories WHERE id = ? LIMIT 1', [Number(patch.categoryId)]
      );
      if (catRows.length) {
        sets.push('category_id = ?'); params.push(Number(catRows[0].id));
        sets.push('course_id = ?'); params.push(Number(catRows[0].course_id));
      }
    }
    if (!sets.length) return existing;

    params.push(id);
    await this.db.execute(`UPDATE osce_cases SET ${sets.join(', ')} WHERE id = ?`, params);
    return this.getCaseById(id);
  }

  async deleteCase(id: number) {
    await this.db.execute('DELETE FROM osce_media WHERE case_id = ?', [id]);
    await this.db.execute('DELETE FROM osce_progress WHERE case_id = ?', [id]);
    await this.db.execute('DELETE FROM osce_cases WHERE id = ?', [id]);
    return { deleted: true };
  }

  /* ───────────────────────── slots ─────────────────────────── */

  /** Every image slot the document declares, in journey order. */
  declaredSlots(doc: CaseDocument): Array<{ slot: string; label: string; brief: string }> {
    const out: Array<{ slot: string; label: string; brief: string }> = [];
    const push = (slot: string | null | undefined, label: string, brief = '') => {
      if (slot && !out.some((s) => s.slot === slot)) out.push({ slot, label, brief });
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
      if (!ix.ref) push(ix.media, `Investigation — ${ix.modality.toUpperCase()}`, '');
    }
    return out;
  }

  async listMedia(caseId: number) {
    const [rows] = await this.db.execute<RowDataPacket[]>(
      'SELECT slot_key, storage_key, thumb_key, mime, source, bytes, width, height, updated_at FROM osce_media WHERE case_id = ?',
      [caseId]
    );
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

  /** Declared slots + whether each is filled + its required spec. */
  async shotList(caseId: number) {
    const found = await this.getCaseById(caseId);
    if (!found) throw new NotFoundException('Case not found');
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

  /* ───────────────────── media ingest ──────────────────────── */

  async saveSlotImage(caseId: number, slotKey: string, file: {
    buffer: Buffer; mimetype: string; originalname?: string;
  }, meta: { width?: number; height?: number; thumbBuffer?: Buffer; source?: 'upload' | 'ai' } = {}) {
    const found = await this.getCaseById(caseId);
    if (!found) throw new NotFoundException('Case not found');
    if (!/^[A-Za-z0-9:_-]{1,120}$/.test(slotKey)) throw new BadRequestException('Invalid slot key');
    if (!file?.buffer?.length) throw new BadRequestException('No file received');
    if (file.buffer.length > MAX_IMAGE_BYTES) throw new BadRequestException('Image is too large (max 6 MB)');

    const ext = this.extForMime(file.mimetype);
    if (!ext) throw new BadRequestException('Unsupported image type');

    const dir = join(MEDIA_ROOT(), found.slug);
    await mkdir(dir, { recursive: true });

    const base = slotToFileBase(slotKey);
    const fileName = `${base}.${ext}`;

    // Replacing a PNG with a JPEG writes a DIFFERENT filename, so the old file
    // would linger forever. Clear whatever this slot pointed at first.
    const [prior] = await this.db.execute<RowDataPacket[]>(
      'SELECT storage_key, thumb_key FROM osce_media WHERE case_id = ? AND slot_key = ? LIMIT 1',
      [caseId, slotKey]
    );
    for (const key of [prior?.[0]?.storage_key, prior?.[0]?.thumb_key]) {
      if (key && String(key) !== `${found.slug}/${fileName}`) {
        await unlink(join(MEDIA_ROOT(), String(key))).catch(() => undefined);
      }
    }

    await writeFile(join(dir, fileName), file.buffer);
    const storageKey = `${found.slug}/${fileName}`;

    let thumbKey: string | null = null;
    if (meta.thumbBuffer?.length) {
      const thumbName = `${base}@480.${ext}`;
      await writeFile(join(dir, thumbName), meta.thumbBuffer);
      thumbKey = `${found.slug}/${thumbName}`;
    }

    await this.db.execute(
      `INSERT INTO osce_media (case_id, slot_key, storage_key, thumb_key, mime, source, bytes, width, height)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE storage_key = VALUES(storage_key), thumb_key = VALUES(thumb_key),
                               mime = VALUES(mime), source = VALUES(source), bytes = VALUES(bytes),
                               width = VALUES(width), height = VALUES(height)`,
      [caseId, slotKey, storageKey, thumbKey, file.mimetype, meta.source ?? 'upload',
       file.buffer.length, meta.width ?? null, meta.height ?? null]
    );

    return { slot: slotKey, storageKey, thumbKey, bytes: file.buffer.length };
  }

  /**
   * Build the image prompt for a slot from the case itself — the sign's own
   * brief where the author (or the generator) wrote one, otherwise the slot's
   * label. Placeholder imagery only; these are marked `source = 'ai'` so the
   * panel can badge them and they can be replaced with real pictures later.
   */
  async promptForSlot(caseId: number, slotKey: string) {
    const found = await this.getCaseById(caseId);
    if (!found) throw new NotFoundException('Case not found');

    const doc = found.caseData;
    const spec = specForSlot(slotKey);
    const shape = `Framed ${spec.ratio}, filling the frame edge to edge with no letterboxing.`;
    const clean = 'No text, no letters, no numbers, no labels, no arrows, no watermarks, no borders.';

    // Styling is per slot type. A blanket "soft clinical lighting on a neutral
    // dark background" is right for a patient photo and actively wrong for a
    // diagnostic, which is how an earlier version produced a small ECG strip
    // floating in grey dead space.
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
      const scene = (doc.scenes || []).find(
        (s) => s.media === slotKey || s.flip?.media === slotKey || s.compare?.media === slotKey
      );
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
      // Kept for completeness — generation is blocked for these (canGenerateSlot).
      const modality = slotKey.slice(3).toUpperCase();
      const ix = (doc.investigations || []).find((i) => i.media === slotKey);
      // One finding only: joining them produced mutually exclusive requests
      // (P mitrale AND atrial fibrillation on the same strip).
      const single = ix?.findings?.[0];
      return `A real ${modality} as it would appear in ${found.title}`
        + `${single ? `, showing ${single}` : ''}. Photographed straight on, filling the frame. ${shape}`;
    }

    return `Medical illustration for ${found.title}. ${clean} ${shape}`;
  }

  /** Save an AI-generated data URI into a slot through the normal ingest path. */
  async saveGeneratedSlot(caseId: number, slotKey: string, dataUrl: string) {
    const match = String(dataUrl).match(/^data:([^;,]+);base64,(.+)$/s);
    if (!match) throw new BadRequestException('The image service returned nothing usable');
    const buffer = Buffer.from(match[2], 'base64');
    return this.saveSlotImage(
      caseId,
      slotKey,
      { buffer, mimetype: match[1] },
      { source: 'ai' }
    );
  }

  async clearSlot(caseId: number, slotKey: string) {
    const [rows] = await this.db.execute<RowDataPacket[]>(
      'SELECT storage_key, thumb_key FROM osce_media WHERE case_id = ? AND slot_key = ? LIMIT 1',
      [caseId, slotKey]
    );
    for (const key of [rows?.[0]?.storage_key, rows?.[0]?.thumb_key]) {
      if (key) await unlink(join(MEDIA_ROOT(), String(key))).catch(() => undefined);
    }
    await this.db.execute('DELETE FROM osce_media WHERE case_id = ? AND slot_key = ?', [caseId, slotKey]);
    return { cleared: true };
  }

  /** Files bulk-dropped into uploads/osce/_inbox, matched to slots by filename. */
  async listInbox() {
    await mkdir(INBOX_DIR(), { recursive: true });
    const names = await readdir(INBOX_DIR()).catch(() => [] as string[]);
    return names
      .filter((n) => /\.(jpe?g|png|webp)$/i.test(n))
      .map((n) => ({ fileName: n, slot: this.slotFromFileName(n) }));
  }

  /** `sign-malar-flush.jpg` → `sign:malar-flush` */
  private slotFromFileName(fileName: string) {
    const stem = fileName.replace(/\.[^.]+$/, '');
    if (stem === 'cover') return 'cover';
    const m = stem.match(/^(scene|sign|chain|ix)-(.+)$/);
    return m ? `${m[1]}:${m[2]}` : null;
  }

  async takeFromInbox(fileName: string) {
    if (!/^[A-Za-z0-9._-]+\.(?:jpe?g|png|webp)$/i.test(fileName)) {
      throw new BadRequestException('Invalid inbox file name');
    }
    const path = join(INBOX_DIR(), fileName);
    const { readFile } = await import('fs/promises');
    const buffer = await readFile(path).catch(() => null);
    if (!buffer) throw new NotFoundException('Inbox file not found');
    return { buffer, path };
  }

  async discardInbox(fileName: string) {
    if (!/^[A-Za-z0-9._-]+\.(?:jpe?g|png|webp)$/i.test(fileName)) {
      throw new BadRequestException('Invalid inbox file name');
    }
    await unlink(join(INBOX_DIR(), fileName)).catch(() => undefined);
    return { discarded: true };
  }

  /** Archive rather than delete — an author's only copy might be in there. */
  async archiveInbox(fileName: string) {
    const doneDir = join(INBOX_DIR(), '_used');
    await mkdir(doneDir, { recursive: true });
    await rename(join(INBOX_DIR(), fileName), join(doneDir, fileName)).catch(() => undefined);
  }

  private extForMime(mime: string) {
    const map: Record<string, string> = {
      'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png',
    };
    return map[String(mime).toLowerCase()] || null;
  }

  /* ──────────────────────── publish ────────────────────────── */

  async publishCase(id: number) {
    const shots = await this.shotList(id);
    const missing = shots.filter((s) => !s.filled);
    if (missing.length) {
      throw new BadRequestException(
        `${missing.length} image slot${missing.length === 1 ? '' : 's'} still empty: ` +
        missing.slice(0, 5).map((m) => m.slot).join(', ') + (missing.length > 5 ? '…' : '')
      );
    }
    await this.db.execute("UPDATE osce_cases SET status = 'published' WHERE id = ?", [id]);
    return this.getCaseById(id);
  }

  async unpublishCase(id: number) {
    await this.db.execute("UPDATE osce_cases SET status = 'draft' WHERE id = ?", [id]);
    return this.getCaseById(id);
  }

  /* ─────────────────────── progress ────────────────────────── */

  async getProgress(userId: number) {
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT p.case_id, c.slug, p.checklist_json, p.seen_json, p.is_favourite, p.completed_at, p.updated_at
         FROM osce_progress p JOIN osce_cases c ON c.id = p.case_id
        WHERE p.user_id = ?`,
      [userId]
    );
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

  async saveProgress(userId: number, caseId: number, body: {
    checklist?: Record<string, boolean>; seen?: string[]; completed?: boolean;
    favourite?: boolean;
  }) {
    // `favourite` is omitted by the checklist/seen calls and vice versa, so each
    // field keeps its stored value unless this call actually carries one —
    // otherwise ticking a box would silently un-favourite the station.
    await this.db.execute(
      `INSERT INTO osce_progress
         (user_id, case_id, checklist_json, seen_json, completed_at, is_favourite)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         checklist_json = COALESCE(VALUES(checklist_json), checklist_json),
         seen_json      = COALESCE(VALUES(seen_json), seen_json),
         completed_at   = COALESCE(VALUES(completed_at), completed_at),
         is_favourite   = COALESCE(VALUES(is_favourite), is_favourite)`,
      [
        userId, caseId,
        body.checklist === undefined ? null : JSON.stringify(body.checklist),
        body.seen === undefined ? null : JSON.stringify(body.seen),
        body.completed ? new Date() : null,
        body.favourite === undefined ? null : (body.favourite ? 1 : 0),
      ]
    );
    return { saved: true };
  }

  private safeJson<T>(raw: any, fallback: T): T {
    if (raw == null) return fallback;
    if (typeof raw === 'object') return raw as T;
    try { return JSON.parse(String(raw)) as T; } catch { return fallback; }
  }

  /* ─────────────────────── hydration ───────────────────────── */

  /**
   * Resolve every slot key and content reference into something the app can
   * render directly, so a whole case arrives in ONE request. Media becomes an
   * absolute URL; an `ecg_card` / `auscultation_card` ref becomes a title plus a
   * URL. The document shape is otherwise untouched.
   */
  async hydrateCase(slug: string, baseUrl: string, publishedOnly = true, userId?: number) {
    const found = await this.getCaseBySlug(slug, publishedOnly);
    if (!found) return null;

    // A station belongs to a course, so the student's existing course scope
    // decides whether it opens — no separate OSCE entitlement to maintain.
    if (publishedOnly && userId) {
      const profile = await this.accessProfile(userId);
      const open = found.isFree || this.courseInScope(found.courseId, profile);
      if (!open) {
        throw new ForbiddenException(
          'This station is part of a course your subscription does not cover.'
        );
      }
    }

    const media = await this.listMedia(found.id);
    const bySlot = new Map(media.map((m) => [m.slot, m]));
    const root = baseUrl.replace(/\/+$/, '');

    const url = (slot?: string | null) => {
      if (!slot) return null;
      const hit = bySlot.get(slot);
      if (!hit) return null;
      const stamp = hit.updatedAt ? new Date(hit.updatedAt as any).getTime() : 0;
      return {
        full: `${root}/api/osce/media/${hit.storageKey}?v=${stamp}`,
        thumb: hit.thumbKey ? `${root}/api/osce/media/${hit.thumbKey}?v=${stamp}` : null,
        width: hit.width, height: hit.height,
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

    const isLong = String((found as any).stationType || '') === 'long'
      || (doc as any).stationType === 'long';

    const related = await this.resolveRelated(doc.related, publishedOnly, found.slug);

    // Summary & Connect: each mechanism with the findings it explains, resolved
    // to real titles here so the app renders names instead of ids. A step with
    // no findings attached is dropped — an empty branch teaches nothing.
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
          .map((s: any) => ({
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
        // A long case is a conversation; it uses the shared art instead of
        // per-case scene images.
        ...(isLong ? { cast: await this.globalMedia(baseUrl) } : {}),
      },
      cover: url('cover'),
    };
  }

  /**
   * Turn authored `related` slugs into links that actually open.
   *
   * The generator invents plausible slugs ("rheumatic-fever") for cases that
   * may never be authored, so an unresolved entry is the norm, not an edge
   * case. Students only ever see links that resolve to a real published
   * station; the admin preview keeps the rest, flagged, so the author can see
   * what was suggested and either write that case or drop the link. Showing a
   * student a station that cannot open is worse than showing them nothing.
   */
  private async resolveRelated(
    related: CaseDocument['related'],
    publishedOnly: boolean,
    selfSlug: string,
  ) {
    const list = Array.isArray(related) ? related : [];
    if (!list.length) return [];

    const slugs = [...new Set(list.map((r) => String(r?.case || '').trim()).filter(Boolean))];
    if (!slugs.length) return [];

    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT slug, title, status, station_type, is_free
         FROM osce_cases WHERE slug IN (${slugs.map(() => '?').join(',')})`,
      slugs
    );
    const bySlug = new Map(rows.map((r) => [String(r.slug), r]));

    const out: Array<Record<string, unknown>> = [];
    for (const item of list) {
      const slug = String(item?.case || '').trim();
      if (!slug || slug === selfSlug) continue; // never link a case to itself
      const hit = bySlug.get(slug);
      const openable = !!hit && (!publishedOnly || String(hit.status) === 'published');

      if (!openable && publishedOnly) continue; // students never see a dead link

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

  /**
   * ECG images live in `ecg_cards.image_url` as base64 data URIs. Inlining one
   * into the case payload would add megabytes, so hand back a URL to our own
   * streaming endpoint instead and let the app fetch (and cache) it separately.
   */
  private async ecgCardSummary(cardId: number, root: string) {
    const [rows] = await this.db.execute<RowDataPacket[]>(
      'SELECT id, title FROM ecg_cards WHERE id = ? AND is_active = 1 LIMIT 1',
      [cardId]
    );
    if (!rows.length) return null;
    return {
      title: String(rows[0].title),
      image: { full: `${root}/api/osce/ecg/${cardId}/image`, thumb: null, width: null, height: null },
    };
  }

  private async auscultationAudio(cardId: number, root: string) {
    const [rows] = await this.db.execute<RowDataPacket[]>(
      'SELECT id, title FROM auscultation_cards WHERE id = ? AND is_active = 1 LIMIT 1',
      [cardId]
    );
    if (!rows.length) return null;
    return {
      title: String(rows[0].title),
      url: `${root}/api/auscultation/cards/${cardId}/audio`,
    };
  }

  /**
   * An auscultation clip's bytes, so a case (and the admin's reference picker)
   * can play it without going through the student-only auscultation route —
   * `requireStudent` rejects an admin, and an <audio> tag sends no bearer token.
   */
  async auscultationAudioBytes(cardId: number) {
    const [rows] = await this.db.execute<RowDataPacket[]>(
      'SELECT audio_file, audio_mime FROM auscultation_cards WHERE id = ? AND is_active = 1 LIMIT 1',
      [cardId]
    );
    const file = String(rows?.[0]?.audio_file || '').trim();
    if (!file) return null;
    const buffer = await readFile(join(AUSCULTATION_AUDIO_DIR(), basename(file)))
      .catch(() => null);
    if (!buffer?.length) return null;
    return { buffer, mime: String(rows[0].audio_mime || 'audio/mpeg') };
  }

  /** Decode an ECG card's stored data URI so it can be served as a real image. */
  async ecgImageBytes(cardId: number) {
    const [rows] = await this.db.execute<RowDataPacket[]>(
      'SELECT image_url FROM ecg_cards WHERE id = ? AND is_active = 1 LIMIT 1',
      [cardId]
    );
    const raw = rows?.[0]?.image_url ? String(rows[0].image_url) : '';
    const match = raw.match(/^data:([^;,]+);base64,(.+)$/s);
    if (!match) return null;
    return { mime: match[1], buffer: Buffer.from(match[2], 'base64') };
  }
}
