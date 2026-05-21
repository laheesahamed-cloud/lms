import {
  Injectable, BadRequestException, ServiceUnavailableException,
  NotFoundException, UnauthorizedException, ForbiddenException, Inject,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { DATABASE_CONNECTION } from '../../database/database.tokens';
import {
  AI_PROVIDER_LABELS,
  AiProviderKey,
  decryptSecret,
  getDefaultBaseUrlForProvider,
  getDefaultModelForProvider,
  isAiProviderKey,
  normalizeAiProviderBaseUrl,
} from '../../common/utils/ai-provider.utils';
import { fetchWithRetry } from '../../common/utils/fetch-with-retry';
import { hashSessionToken } from '../auth/auth-token.util';
import { PlansService } from '../plans/plans.service';

const AI_NOTES_REQUEST_TIMEOUT_MS = 240_000;

export interface NoteSection {
  heading: string;
  bullets: string[];
  callout: string;
  sticky_note: string;
  mnemonic: string;
  diagram_prompt: string;
}

export interface NoteResult {
  title: string;
  subtitle: string;
  sections: NoteSection[];
  summary_box: string;
  key_points: string[];
  visual_style: { theme: string; look: string; colors: string[] };
}

export interface NoteCanvas {
  pages: NoteResult[];
}

type AiProviderRow  = RowDataPacket & { api_key_encrypted: string };
type UserRow        = RowDataPacket & { id: number; role: string; status: string };
type SubscriptionFeatureRow = RowDataPacket & { feature_key: string | null };
type AccessScopeRow = RowDataPacket & {
  feature_key: string | null;
  plan_slug: string | null;
  access_scope: 'all' | 'courses' | 'lessons' | null;
  course_ids_json: string | null;
  lesson_ids_json: string | null;
};
type AiNoteRow      = RowDataPacket & {
  id: number; user_id: number; title: string;
  raw_text: string | null; note_data: string | null;
  engine_key: CanvasEngineKey;
  course_id: number | null; topic_id: number | null; subtopic_id: number | null; lesson_id: number | null;
  video_url: string | null;
  is_free: number;
  status: 'active' | 'inactive';
  created_at: string; updated_at: string;
  course_title?: string | null; topic_name?: string | null; subtopic_name?: string | null; lesson_title?: string | null; lesson_video_url?: string | null;
  effective_course_id?: number | null; effective_topic_id?: number | null; effective_subtopic_id?: number | null;
  effective_is_free?: number | null;
  lesson_progress_status?: 'not_started' | 'in_progress' | 'completed' | null;
  lesson_progress_percent?: number | null;
  lesson_completed_at?: string | null;
};
type HierarchyRow = RowDataPacket & { id: number; name: string; };
type CanvasEngineKey = 'gemini' | 'openai';
type RuntimeCanvasProvider = {
  providerKey: AiProviderKey;
  providerLabel: string;
  apiKey: string;
  model: string;
  baseUrl: string;
};
type LessonAccessProfile = {
  hasAnyPaidLessonAccess: boolean;
  hasFullAccess: boolean;
  courseIds: Set<number>;
  lessonIds: Set<number>;
};

const FALLBACK_COLORS = ['#A7D8FF', '#FFE680', '#FFB3B3', '#C7F0BD', '#CE93D8', '#80DEEA', '#F48FB1', '#FFCC80'];
const GEMINI_MODELS = ['gemini-3.1-pro-preview', 'gemini-3.1-flash-lite-preview', 'gemini-3-flash-preview'];


@Injectable()
export class AiNotesService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Pool,
    private readonly config: ConfigService,
    private readonly plansService: PlansService,
  ) {}

  normalizeEngineKey(value: string | undefined): CanvasEngineKey {
    return value === 'openai' ? 'openai' : 'gemini';
  }

  // ── auth helpers ─────────────────────────────────────────
  private async resolveToken(token: string): Promise<UserRow> {
    if (!token) throw new UnauthorizedException('Missing auth token');
    const [rows] = await this.db.execute<UserRow[]>(
      `SELECT id, role, status
       FROM users
       WHERE session_token = ?
         AND session_expires_at > NOW()
       LIMIT 1`,
      [hashSessionToken(token)],
    );
    if (!rows.length) throw new UnauthorizedException('Invalid or expired session');
    return rows[0];
  }

  private async requireAdmin(token: string): Promise<UserRow> {
    const u = await this.resolveToken(token);
    if (u.role !== 'admin' || u.status !== 'active') throw new ForbiddenException('Active admin account required');
    return u;
  }

  private async requireStudent(token: string): Promise<UserRow> {
    const u = await this.resolveToken(token);
    if (u.role !== 'student' || u.status !== 'active') throw new ForbiddenException('Active student account required');
    return u;
  }

  private async requireStudentAiNotesAccess(token: string): Promise<UserRow> {
    const student = await this.requireStudent(token);
    const [rows] = await this.db.execute<SubscriptionFeatureRow[]>(
      `SELECT sf.feature_key
       FROM user_subscriptions us
       INNER JOIN subscription_plan_features spf
         ON spf.plan_id = us.plan_id
        AND spf.is_enabled = 1
       INNER JOIN subscription_features sf
         ON sf.id = spf.feature_id
        AND sf.status = 'active'
       WHERE us.user_id = ?
         AND us.status = 'active'
         AND us.start_date <= CURDATE()
         AND us.end_date >= CURDATE()
      `,
      [student.id]
    );
    const featureKeys = new Set(rows.map((row) => String(row.feature_key || '').trim()).filter(Boolean));
    const hasAccess = featureKeys.has('notes_canvas_study_mode');

    if (!hasAccess) {
      throw new ForbiddenException('Your current subscription does not include Lessons access');
    }

    return student;
  }

  // ── Admin CRUD ───────────────────────────────────────────
  async adminList(token: string, engineKey: CanvasEngineKey = 'gemini') {
    await this.requireAdmin(token);
    const [rows] = await this.db.execute<AiNoteRow[]>(`
      SELECT n.id, n.title, n.raw_text, NULL AS note_data, n.engine_key, n.course_id, n.topic_id, n.subtopic_id, n.lesson_id, n.video_url, n.is_free, n.status, n.created_at, n.updated_at,
             c.course_title, t.topic_name, s.subtopic_name, l.lesson_title, l.video_url AS lesson_video_url
      FROM ai_illustrated_notes n
      LEFT JOIN courses  c ON c.id = n.course_id
      LEFT JOIN topics   t ON t.id = n.topic_id
      LEFT JOIN subtopics s ON s.id = n.subtopic_id
      LEFT JOIN lessons  l ON l.id = n.lesson_id
      WHERE n.is_public = 1
        AND n.engine_key = ?
      ORDER BY n.updated_at DESC`, [engineKey]);
    return rows.map(r => this.deserialize(r));
  }

  async adminCreate(title: string, rawText: string | undefined, courseId: number | undefined, topicId: number | undefined, subtopicId: number | undefined, lessonId: number | undefined, isFree: number | undefined, videoUrl: string | undefined, token: string, engineKey: CanvasEngineKey = 'gemini') {
    await this.requireAdmin(token);
    const [result] = await this.db.execute<ResultSetHeader>(
      'INSERT INTO ai_illustrated_notes (user_id, title, raw_text, engine_key, course_id, topic_id, subtopic_id, lesson_id, video_url, is_public, is_free, status) VALUES (0, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, "active")',
      [title || 'Untitled Lesson', rawText ?? null, engineKey, courseId ?? null, topicId ?? null, subtopicId ?? null, lessonId ?? null, videoUrl ?? null, Number(isFree) === 1 ? 1 : 0],
    );
    return { id: result.insertId, title: title || 'Untitled Lesson' };
  }

  async adminFindOne(id: number, token: string, engineKey: CanvasEngineKey = 'gemini') {
    await this.requireAdmin(token);
    const [rows] = await this.db.execute<AiNoteRow[]>(`
      SELECT n.*, c.course_title, t.topic_name, s.subtopic_name, l.lesson_title, l.video_url AS lesson_video_url
      FROM ai_illustrated_notes n
      LEFT JOIN courses  c ON c.id = n.course_id
      LEFT JOIN topics   t ON t.id = n.topic_id
      LEFT JOIN subtopics s ON s.id = n.subtopic_id
      LEFT JOIN lessons  l ON l.id = n.lesson_id
      WHERE n.id = ? AND n.is_public = 1 AND n.engine_key = ?`, [id, engineKey]);
    if (!rows.length) throw new NotFoundException('Lesson not found');
    return this.deserialize(rows[0]);
  }

  async adminUpdate(id: number, patch: { title?: string; rawText?: string; noteData?: unknown; status?: string; courseId?: number | null; topicId?: number | null; subtopicId?: number | null; lessonId?: number | null; videoUrl?: string | null; isFree?: number | null }, token: string, engineKey: CanvasEngineKey = 'gemini') {
    await this.requireAdmin(token);
    const [existing] = await this.db.execute<AiNoteRow[]>(
      'SELECT id, lesson_id FROM ai_illustrated_notes WHERE id = ? AND is_public = 1 AND engine_key = ?', [id, engineKey],
    );
    if (!existing.length) throw new NotFoundException('Lesson not found');

    if (patch.courseId && (!patch.topicId || !patch.subtopicId)) {
      const fallback = await this.ensureDefaultLessonHierarchy(Number(patch.courseId));
      patch.topicId = patch.topicId || fallback.topicId;
      patch.subtopicId = patch.subtopicId || fallback.subtopicId;
    }

    const fields: string[] = [];
    const values: (string | number | null)[] = [];
    if (patch.title      !== undefined) { fields.push('title = ?');       values.push(patch.title); }
    if (patch.rawText    !== undefined) { fields.push('raw_text = ?');    values.push(patch.rawText); }
    if (patch.noteData   !== undefined) { fields.push('note_data = ?');   values.push(JSON.stringify(patch.noteData)); }
    if (patch.status     !== undefined) { fields.push('status = ?');      values.push(patch.status === 'active' ? 'active' : 'inactive'); }
    if ('courseId'   in patch)          { fields.push('course_id = ?');   values.push(patch.courseId   ?? null); }
    if ('topicId'    in patch)          { fields.push('topic_id = ?');    values.push(patch.topicId    ?? null); }
    if ('subtopicId' in patch)          { fields.push('subtopic_id = ?'); values.push(patch.subtopicId ?? null); }
    if ('lessonId'   in patch)          { fields.push('lesson_id = ?');   values.push(patch.lessonId   ?? null); }
    if ('videoUrl'   in patch)          { fields.push('video_url = ?');   values.push(String(patch.videoUrl || '').trim() || null); }
    if ('isFree'     in patch)          { fields.push('is_free = ?');     values.push(Number(patch.isFree) === 1 ? 1 : 0); }
    if (!fields.length) return { id };

    if (patch.noteData !== undefined) {
      const serialized = JSON.stringify(patch.noteData);
      const sizeBytes = Buffer.byteLength(serialized, 'utf8');
      if (sizeBytes > 60 * 1024 * 1024) {
        throw new BadRequestException('Lesson data exceeds the 60 MB save limit. Try removing large images.');
      }
    }

    values.push(id);
    try {
      await this.db.execute(`UPDATE ai_illustrated_notes SET ${fields.join(', ')} WHERE id = ?`, values);
    } catch (err: unknown) {
      const mysqlErr = err as { code?: string; errno?: number; sqlMessage?: string };
      if (mysqlErr?.code === 'ER_NET_PACKET_TOO_LARGE' || mysqlErr?.errno === 1153) {
        throw new BadRequestException('Lesson data is too large for the database. Increase max_allowed_packet in MySQL config or reduce image sizes.');
      }
      throw err;
    }
    const linkedLessonId = 'lessonId' in patch ? patch.lessonId : existing[0].lesson_id;
    const hasCompleteCategory = Boolean(patch.courseId && patch.topicId && patch.subtopicId);
    if (linkedLessonId && hasCompleteCategory) {
      const lessonValues: Array<string | number | null> = [
        Number(patch.courseId),
        Number(patch.topicId),
        Number(patch.subtopicId),
        patch.title ? String(patch.title).trim() : '',
        typeof patch.rawText === 'string' ? patch.rawText.trim() : null,
        typeof patch.videoUrl === 'string' ? patch.videoUrl.trim() : '',
        patch.isFree === null || patch.isFree === undefined ? null : (Number(patch.isFree) === 1 ? 1 : 0),
        patch.status ? String(patch.status).trim() : '',
        Number(linkedLessonId),
      ];
      await this.db.execute(
        `UPDATE lessons
         SET course_id = ?, topic_id = ?, subtopic_id = ?,
             lesson_title = COALESCE(NULLIF(?, ''), lesson_title),
             lesson_content = COALESCE(?, lesson_content),
             video_url = COALESCE(NULLIF(?, ''), video_url),
             is_free = COALESCE(?, is_free),
             status = COALESCE(NULLIF(?, ''), status)
         WHERE id = ?`,
        lessonValues,
      );
    }
    return { id };
  }

  async adminRemove(id: number, token: string, engineKey: CanvasEngineKey = 'gemini') {
    await this.requireAdmin(token);
    await this.db.execute('DELETE FROM ai_illustrated_notes WHERE id = ? AND is_public = 1 AND engine_key = ?', [id, engineKey]);
    return { deleted: true };
  }

  // ── Student read-only ────────────────────────────────────
  async studentList(token: string, engineKey: CanvasEngineKey = 'gemini') {
    const student = await this.requireStudent(token);
    const hasNotesAccess = await this.plansService.hasFeatureAccess(student.id, 'notes_canvas_study_mode');
    const accessProfile = await this.getLessonAccessProfile(student.id);
    const [rows] = await this.db.execute<AiNoteRow[]>(`
      SELECT n.id, n.title, NULL AS note_data, n.engine_key, n.course_id, n.topic_id, n.subtopic_id, n.lesson_id, n.video_url, n.is_free, n.status, n.created_at, n.updated_at,
             COALESCE(n.course_id, l.course_id) AS effective_course_id,
             COALESCE(n.topic_id, l.topic_id) AS effective_topic_id,
             COALESCE(n.subtopic_id, l.subtopic_id) AS effective_subtopic_id,
             COALESCE(l.is_free, n.is_free) AS effective_is_free,
             slp.status AS lesson_progress_status,
             slp.progress_percent AS lesson_progress_percent,
             slp.completed_at AS lesson_completed_at,
             c.course_title, t.topic_name, s.subtopic_name, l.lesson_title, l.video_url AS lesson_video_url
      FROM ai_illustrated_notes n
      LEFT JOIN lessons  l ON l.id = n.lesson_id
      LEFT JOIN student_lesson_progress slp ON slp.lesson_id = n.lesson_id AND slp.user_id = ?
      LEFT JOIN courses  c ON c.id = COALESCE(n.course_id, l.course_id)
      LEFT JOIN topics   t ON t.id = COALESCE(n.topic_id, l.topic_id)
      LEFT JOIN subtopics s ON s.id = COALESCE(n.subtopic_id, l.subtopic_id)
      WHERE n.is_public = 1 AND n.note_data IS NOT NULL AND n.status = 'active'
        AND n.engine_key = ?
      ORDER BY c.course_title ASC, t.topic_name ASC, n.updated_at DESC`, [student.id, engineKey]);
    return rows.map((row) => this.mapStudentNote(row, hasNotesAccess, accessProfile));
  }

  async studentFindOne(id: number, token: string, engineKey: CanvasEngineKey = 'gemini') {
    const student = await this.requireStudent(token);
    const hasNotesAccess = await this.plansService.hasFeatureAccess(student.id, 'notes_canvas_study_mode');
    const accessProfile = await this.getLessonAccessProfile(student.id);
    const [rows] = await this.db.execute<AiNoteRow[]>(`
      SELECT n.*,
             COALESCE(n.course_id, l.course_id) AS effective_course_id,
             COALESCE(n.topic_id, l.topic_id) AS effective_topic_id,
             COALESCE(n.subtopic_id, l.subtopic_id) AS effective_subtopic_id,
             COALESCE(l.is_free, n.is_free) AS effective_is_free,
             slp.status AS lesson_progress_status,
             slp.progress_percent AS lesson_progress_percent,
             slp.completed_at AS lesson_completed_at,
             c.course_title, t.topic_name, s.subtopic_name, l.lesson_title, l.video_url AS lesson_video_url
      FROM ai_illustrated_notes n
      LEFT JOIN lessons  l ON l.id = n.lesson_id
      LEFT JOIN student_lesson_progress slp ON slp.lesson_id = n.lesson_id AND slp.user_id = ?
      LEFT JOIN courses  c ON c.id = COALESCE(n.course_id, l.course_id)
      LEFT JOIN topics   t ON t.id = COALESCE(n.topic_id, l.topic_id)
      LEFT JOIN subtopics s ON s.id = COALESCE(n.subtopic_id, l.subtopic_id)
      WHERE n.id = ? AND n.is_public = 1 AND n.status = 'active' AND n.engine_key = ?`, [student.id, id, engineKey]);
    if (!rows.length) throw new NotFoundException('Lesson not found');
    return this.mapStudentNote(rows[0], hasNotesAccess, accessProfile);
  }

  async studentFindByLesson(lessonId: number, token: string, engineKey: CanvasEngineKey = 'gemini') {
    const student = await this.requireStudent(token);
    const hasNotesAccess = await this.plansService.hasFeatureAccess(student.id, 'notes_canvas_study_mode');
    const accessProfile = await this.getLessonAccessProfile(student.id);
    const [rows] = await this.db.execute<AiNoteRow[]>(`
      SELECT n.*,
             l.course_id AS effective_course_id,
             l.topic_id AS effective_topic_id,
             l.subtopic_id AS effective_subtopic_id,
             l.is_free AS effective_is_free,
             slp.status AS lesson_progress_status,
             slp.progress_percent AS lesson_progress_percent,
             slp.completed_at AS lesson_completed_at,
             c.course_title, t.topic_name, s.subtopic_name, l.lesson_title, l.video_url AS lesson_video_url
      FROM ai_illustrated_notes n
      INNER JOIN lessons l ON l.id = n.lesson_id
      LEFT JOIN student_lesson_progress slp ON slp.lesson_id = n.lesson_id AND slp.user_id = ?
      INNER JOIN courses c ON c.id = l.course_id
      INNER JOIN topics t ON t.id = l.topic_id
      LEFT JOIN subtopics s ON s.id = l.subtopic_id
      WHERE n.lesson_id = ? AND n.is_public = 1 AND n.status = 'active' AND n.note_data IS NOT NULL
        AND n.engine_key = ?
        AND (n.course_id IS NULL OR n.course_id = l.course_id)
        AND (n.topic_id IS NULL OR n.topic_id = l.topic_id)
        AND (n.subtopic_id IS NULL OR n.subtopic_id = l.subtopic_id OR (n.subtopic_id IS NULL AND l.subtopic_id IS NULL))
      ORDER BY n.updated_at DESC
      LIMIT 1`, [student.id, lessonId, engineKey]);
    if (!rows.length) throw new NotFoundException('Lesson not found');
    return this.mapStudentNote(rows[0], hasNotesAccess, accessProfile);
  }

  // ── Hierarchy lookups (admin) ─────────────────────────────
  async getCourses(token: string) {
    await this.requireAdmin(token);
    const [rows] = await this.db.execute<HierarchyRow[]>(
      "SELECT id, course_title AS name FROM courses WHERE status = 'active' ORDER BY course_title ASC");
    return rows;
  }

  async getTopics(courseId: number | undefined, token: string) {
    await this.requireAdmin(token);
    const [rows] = await this.db.execute<HierarchyRow[]>(
      courseId
        ? "SELECT id, topic_name AS name FROM topics WHERE course_id = ? AND status = 'active' ORDER BY topic_name ASC"
        : "SELECT id, topic_name AS name FROM topics WHERE status = 'active' ORDER BY topic_name ASC",
      courseId ? [courseId] : [],
    );
    return rows;
  }

  async getSubtopics(topicId: number | undefined, token: string) {
    await this.requireAdmin(token);
    const [rows] = await this.db.execute<HierarchyRow[]>(
      topicId
        ? "SELECT id, subtopic_name AS name FROM subtopics WHERE topic_id = ? AND status = 'active' ORDER BY subtopic_name ASC"
        : "SELECT id, subtopic_name AS name FROM subtopics WHERE status = 'active' ORDER BY subtopic_name ASC",
      topicId ? [topicId] : [],
    );
    return rows;
  }

  async getLessonCanvases(token: string, engineKey: CanvasEngineKey = 'gemini') {
    await this.requireAdmin(token);
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT lesson_id AS lessonId, id AS canvasId, title FROM ai_illustrated_notes
       WHERE lesson_id IS NOT NULL AND is_public = 1 AND engine_key = ? ORDER BY updated_at DESC`,
      [engineKey],
    );
    return rows;
  }

  async getLessons(subtopicId: number | undefined, token: string) {
    await this.requireAdmin(token);
    const [rows] = await this.db.execute<HierarchyRow[]>(
      subtopicId
        ? "SELECT id, lesson_title AS name FROM lessons WHERE subtopic_id = ? AND status = 'active' ORDER BY lesson_title ASC"
        : "SELECT id, lesson_title AS name FROM lessons WHERE status = 'active' ORDER BY lesson_title ASC",
      subtopicId ? [subtopicId] : [],
    );
    return rows;
  }

  private async ensureDefaultLessonHierarchy(courseId: number) {
    const [topicRows] = await this.db.execute<RowDataPacket[]>(
      `SELECT id FROM topics
       WHERE course_id = ? AND topic_name = 'General lessons'
       LIMIT 1`,
      [courseId],
    );
    let topicId = topicRows[0]?.id ? Number(topicRows[0].id) : 0;
    if (!topicId) {
      const [result] = await this.db.execute<ResultSetHeader>(
        `INSERT INTO topics (course_id, topic_name, topic_description, status)
         VALUES (?, 'General lessons', 'Auto-created bucket for course-level lessons.', 'active')`,
        [courseId],
      );
      topicId = result.insertId;
    }

    const [subtopicRows] = await this.db.execute<RowDataPacket[]>(
      `SELECT id FROM subtopics
       WHERE topic_id = ? AND subtopic_name = 'Overview'
       LIMIT 1`,
      [topicId],
    );
    let subtopicId = subtopicRows[0]?.id ? Number(subtopicRows[0].id) : 0;
    if (!subtopicId) {
      const [result] = await this.db.execute<ResultSetHeader>(
        `INSERT INTO subtopics (topic_id, subtopic_name, status)
         VALUES (?, 'Overview', 'active')`,
        [topicId],
      );
      subtopicId = result.insertId;
    }

    return { topicId, subtopicId };
  }

  // ── AI generation (admin only) ───────────────────────────
  async generate(text: string, token: string, _engineKey: CanvasEngineKey = 'gemini'): Promise<NoteCanvas> {
    await this.requireAdmin(token);
    if (!text || text.trim().length < 10) throw new BadRequestException('Text must be at least 10 characters');
    const prompt = this.buildPrompt(text);
    const provider = await this.resolveActiveCanvasProvider();
    return this.generateWithProvider(prompt, provider);
  }

  private async generateWithProvider(prompt: string, provider: RuntimeCanvasProvider): Promise<NoteCanvas> {
    if (!provider.apiKey) {
      throw new ServiceUnavailableException(`No API key found for the active Lessons provider (${provider.providerLabel}). Go to Admin → Settings → AI, edit the active provider, paste the API key, and save.`);
    }

    if (provider.providerKey === 'gemini') {
      return this.generateWithGeminiProvider(prompt, provider);
    }

    return this.generateWithChatProvider(prompt, provider);
  }

  private async generateWithGemini(prompt: string): Promise<NoteCanvas> {
    const apiKey = await this.resolveGeminiKey();
    if (!apiKey) throw new ServiceUnavailableException('No Gemini API key found for Lessons. Your Gemini provider exists but has no saved key, or GEMINI_API_KEY is missing in backend/.env. Go to Admin → Settings → AI, edit Gemini, paste the API key, and save.');
    const errors: string[] = [];
    let canvas: NoteCanvas | null = null;

    for (const model of GEMINI_MODELS) {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), AI_NOTES_REQUEST_TIMEOUT_MS);
      try {
        const res = await fetchWithRetry(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: ctrl.signal,
            body: JSON.stringify({
              generationConfig: { responseMimeType: 'application/json' },
              contents: [{ parts: [{ text: prompt }] }],
            }),
          },
        );
        if (!res.ok) {
          let detail = '';
          try { const body = await res.json() as { error?: { message?: string } }; detail = body?.error?.message || ''; } catch { /* ignore */ }
          const errStr = `${model}: HTTP ${res.status}${detail ? ` — ${detail}` : ''}`;
          errors.push(errStr);
          console.warn(`[AiNotes] ${errStr}`);
          continue;
        }
        const json = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
        const raw = json?.candidates?.[0]?.content?.parts?.find(p => typeof p?.text === 'string')?.text?.trim();
        if (!raw) { errors.push(`${model}: empty response`); continue; }
        console.log(`[AiNotes] Generated canvas with ${model}`);
        // Strip markdown code fences if model wrapped the JSON
        const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
        const parsed = JSON.parse(jsonStr);
        canvas = this.splitIntoPages(this.validate(parsed));
        break;
      } catch (err) {
        if (err instanceof BadRequestException || err instanceof ServiceUnavailableException) throw err;
        const msg = err instanceof Error ? err.message : String(err);
        const isTimeout = msg.includes('abort') || msg.includes('timeout');
        errors.push(`${model}: ${isTimeout ? `timed out (${AI_NOTES_REQUEST_TIMEOUT_MS / 1000}s)` : msg}`);
        console.warn(`[AiNotes] ${model} failed:`, msg);
      } finally { clearTimeout(t); }
    }

    if (!canvas) throw new ServiceUnavailableException(`All models failed: ${errors.join(' | ')}`);

    return canvas;
  }

  private async generateWithGeminiProvider(prompt: string, provider: RuntimeCanvasProvider): Promise<NoteCanvas> {
    const modelName = String(provider.model || getDefaultModelForProvider('gemini')).trim();
    const modelCandidates = Array.from(new Set([modelName, ...GEMINI_MODELS].filter(Boolean)));
    const errors: string[] = [];

    for (const model of modelCandidates) {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), AI_NOTES_REQUEST_TIMEOUT_MS);
      try {
        const res = await fetchWithRetry(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(provider.apiKey)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: ctrl.signal,
            body: JSON.stringify({
              generationConfig: { responseMimeType: 'application/json' },
              contents: [{ parts: [{ text: prompt }] }],
            }),
          },
        );
        if (!res.ok) {
          let detail = '';
          try { const body = await res.json() as { error?: { message?: string } }; detail = body?.error?.message || ''; } catch { /* ignore */ }
          errors.push(`${model}: HTTP ${res.status}${detail ? ` — ${detail}` : ''}`);
          continue;
        }
        const json = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
        const raw = json?.candidates?.[0]?.content?.parts?.find(p => typeof p?.text === 'string')?.text?.trim();
        if (!raw) { errors.push(`${model}: empty response`); continue; }
        const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
        return this.splitIntoPages(this.validate(JSON.parse(jsonStr)));
      } catch (err) {
        if (err instanceof BadRequestException || err instanceof ServiceUnavailableException) throw err;
        const msg = err instanceof Error ? err.message : String(err);
        const isTimeout = msg.includes('abort') || msg.includes('timeout');
        errors.push(`${model}: ${isTimeout ? `timed out (${AI_NOTES_REQUEST_TIMEOUT_MS / 1000}s)` : msg}`);
      } finally { clearTimeout(t); }
    }

    throw new ServiceUnavailableException(`Gemini lesson generation failed: ${errors.join(' | ')}`);
  }

  private async generateWithOpenAi(prompt: string): Promise<NoteCanvas> {
    const provider = await this.resolveOpenAiConfig();
    if (!provider.apiKey) {
      throw new ServiceUnavailableException('No OpenAI API key found. Go to Admin → Settings → AI Providers and add your OpenAI key.');
    }

    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), AI_NOTES_REQUEST_TIMEOUT_MS);

    try {
      let text = '';
      try {
        text = await this.sendOpenAiCanvasPrompt(provider, prompt, ctrl.signal, true);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!this.isUnsupportedOpenAiJsonModeError(message)) {
          throw error;
        }
        text = await this.sendOpenAiCanvasPrompt(provider, prompt, ctrl.signal, false);
      }

      if (!text) {
        throw new ServiceUnavailableException('OpenAI returned an empty completion');
      }

      const jsonStr = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
      const parsed = JSON.parse(jsonStr);
      return this.splitIntoPages(this.validate(parsed));
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof ServiceUnavailableException) throw error;
      const message = error instanceof Error ? error.message : String(error);
      const normalized = message.toLowerCase();
      const isTimeout = normalized.includes('abort') || normalized.includes('timeout');
      const isSocket =
        normalized.includes('socket connection was closed') ||
        normalized.includes('connectionclosed') ||
        normalized.includes('fetch failed') ||
        normalized.includes('econnreset');
      throw new ServiceUnavailableException(
        isTimeout
          ? `OpenAI generation timed out (${AI_NOTES_REQUEST_TIMEOUT_MS / 1000}s)`
          : isSocket
            ? 'OpenAI could not be reached. Check internet, VPN/proxy/firewall, DNS, or custom base URL.'
            : `OpenAI generation failed: ${message}`
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private async sendOpenAiCanvasPrompt(
    provider: RuntimeCanvasProvider,
    prompt: string,
    signal: AbortSignal,
    useJsonMode: boolean,
  ): Promise<string> {
    const response = await fetchWithRetry(normalizeAiProviderBaseUrl('openai', provider.baseUrl), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        'Content-Type': 'application/json',
      },
      signal,
      body: JSON.stringify({
        model: provider.model,
        temperature: 0.7,
        top_p: 0.9,
        ...(useJsonMode ? { response_format: { type: 'json_object' } } : {}),
        messages: [
          {
            role: 'system',
            content: useJsonMode
              ? 'Return valid JSON only. Do not use markdown fences. Do not add commentary before or after the JSON.'
              : 'Return ONLY raw valid JSON. No markdown fences. No prose. No commentary. Start with { and end with }.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    const rawPayload = await response.json().catch(() => null);
    if (!response.ok) {
      const message = this.extractGenericApiError(rawPayload);
      throw new ServiceUnavailableException(`OpenAI generation failed: ${message}`);
    }

    return this.extractChatCompletionText(rawPayload);
  }

  private async generateWithChatProvider(prompt: string, provider: RuntimeCanvasProvider): Promise<NoteCanvas> {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), AI_NOTES_REQUEST_TIMEOUT_MS);

    try {
      let text = '';
      try {
        text = await this.sendChatCanvasPrompt(provider, prompt, ctrl.signal, true);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!this.isUnsupportedOpenAiJsonModeError(message)) {
          throw error;
        }
        text = await this.sendChatCanvasPrompt(provider, prompt, ctrl.signal, false);
      }

      if (!text) {
        throw new ServiceUnavailableException(`${provider.providerLabel} returned an empty completion`);
      }

      const jsonStr = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
      return this.splitIntoPages(this.validate(JSON.parse(jsonStr)));
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof ServiceUnavailableException) throw error;
      const message = error instanceof Error ? error.message : String(error);
      const normalized = message.toLowerCase();
      const isTimeout = normalized.includes('abort') || normalized.includes('timeout');
      const isSocket =
        normalized.includes('socket connection was closed') ||
        normalized.includes('connectionclosed') ||
        normalized.includes('fetch failed') ||
        normalized.includes('econnreset');
      throw new ServiceUnavailableException(
        isTimeout
          ? `${provider.providerLabel} lesson generation timed out (${AI_NOTES_REQUEST_TIMEOUT_MS / 1000}s)`
          : isSocket
            ? `${provider.providerLabel} could not be reached. Check internet, VPN/proxy/firewall, DNS, or custom base URL.`
            : `${provider.providerLabel} lesson generation failed: ${message}`
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private async sendChatCanvasPrompt(
    provider: RuntimeCanvasProvider,
    prompt: string,
    signal: AbortSignal,
    useJsonMode: boolean,
  ): Promise<string> {
    if (provider.providerKey === 'claude') {
      return this.sendClaudeCanvasPrompt(provider, prompt, signal);
    }

    const providerKey = provider.providerKey === 'openrouter' ? 'openrouter' : 'openai';
    const response = await fetchWithRetry(normalizeAiProviderBaseUrl(providerKey, provider.baseUrl), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        'Content-Type': 'application/json',
      },
      signal,
      body: JSON.stringify({
        model: provider.model,
        temperature: 0.7,
        top_p: 0.9,
        ...(useJsonMode ? { response_format: { type: 'json_object' } } : {}),
        messages: [
          {
            role: 'system',
            content: useJsonMode
              ? 'Return valid JSON only. Do not use markdown fences. Do not add commentary before or after the JSON.'
              : 'Return ONLY raw valid JSON. No markdown fences. No prose. No commentary. Start with { and end with }.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    const rawPayload = await response.json().catch(() => null);
    if (!response.ok) {
      const message = this.extractGenericApiError(rawPayload);
      throw new ServiceUnavailableException(`${provider.providerLabel} generation failed: ${message}`);
    }

    return this.extractChatCompletionText(rawPayload);
  }

  private async sendClaudeCanvasPrompt(provider: RuntimeCanvasProvider, prompt: string, signal: AbortSignal): Promise<string> {
    const response = await fetchWithRetry(normalizeAiProviderBaseUrl('claude', provider.baseUrl), {
      method: 'POST',
      headers: {
        'x-api-key': provider.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      signal,
      body: JSON.stringify({
        model: provider.model,
        max_tokens: 4096,
        temperature: 0.7,
        system: 'Return ONLY raw valid JSON. No markdown fences. No prose. No commentary. Start with { and end with }.',
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const rawPayload = await response.json().catch(() => null);
    if (!response.ok) {
      const message = this.extractGenericApiError(rawPayload);
      throw new ServiceUnavailableException(`${provider.providerLabel} generation failed: ${message}`);
    }

    return this.extractClaudeCompletionText(rawPayload);
  }

  private isUnsupportedOpenAiJsonModeError(message: string): boolean {
    const normalized = String(message || '').toLowerCase();
    return normalized.includes('response_format')
      && (normalized.includes('not supported') || normalized.includes('invalid parameter'));
  }

  // ── helpers ──────────────────────────────────────────────
  private async resolveGeminiKey(): Promise<string> {
    try {
      const [rows] = await this.db.execute<AiProviderRow[]>(
        `SELECT api_key_encrypted
         FROM ai_provider_configs
         WHERE status = 'active'
           AND provider_key = 'gemini'
           AND api_key_encrypted IS NOT NULL
           AND api_key_encrypted <> ''
         ORDER BY is_active DESC, updated_at DESC, id DESC
         LIMIT 1`,
      );
      if (rows[0]?.api_key_encrypted) {
        const d = decryptSecret(rows[0].api_key_encrypted, this.getEncryptionSecret());
        if (d) return d;
      }
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      /* fall through */
    }
    return String(this.config.get<string>('GEMINI_API_KEY') || this.config.get<string>('SMART_NOTES_IMAGE_API_KEY') || '').trim();
  }

  private async resolveOpenAiConfig(): Promise<RuntimeCanvasProvider> {
    try {
      const [rows] = await this.db.execute<(AiProviderRow & { model?: string | null; base_url?: string | null })[]>(
        `SELECT api_key_encrypted, model, base_url
         FROM ai_provider_configs
         WHERE status = 'active' AND provider_key = 'openai'
         ORDER BY is_active DESC, updated_at DESC
         LIMIT 1`,
      );
      if (rows[0]?.api_key_encrypted) {
        const apiKey = decryptSecret(rows[0].api_key_encrypted, this.getEncryptionSecret());
        if (apiKey) {
          return {
            providerKey: 'openai',
            providerLabel: AI_PROVIDER_LABELS.openai,
            apiKey,
            model: String(rows[0].model || getDefaultModelForProvider('openai')).trim(),
            baseUrl: normalizeAiProviderBaseUrl('openai', rows[0].base_url),
          };
        }
      }
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      // fall through to env fallback
    }

    return {
      providerKey: 'openai',
      providerLabel: AI_PROVIDER_LABELS.openai,
      apiKey: String(this.config.get<string>('OPENAI_API_KEY') || '').trim(),
      model: getDefaultModelForProvider('openai'),
      baseUrl: getDefaultBaseUrlForProvider('openai'),
    };
  }

  private async resolveActiveCanvasProvider(): Promise<RuntimeCanvasProvider> {
    const [rows] = await this.db.execute<(RowDataPacket & {
      provider_key: string;
      provider_label: string | null;
      api_key_encrypted: string | null;
      base_url: string | null;
      model: string | null;
    })[]>(
      `
        SELECT provider_key, provider_label, api_key_encrypted, base_url, model
        FROM ai_provider_configs
        WHERE status = 'active'
          AND api_key_encrypted IS NOT NULL
          AND api_key_encrypted <> ''
        ORDER BY is_active DESC, updated_at DESC, id DESC
        LIMIT 1
      `
    );

    const row = rows[0];
    if (row) {
      const rawProviderKey = String(row.provider_key || '').trim().toLowerCase();
      if (!isAiProviderKey(rawProviderKey)) {
        throw new ServiceUnavailableException('The active AI provider is invalid. Choose a valid provider in Admin → Settings → AI.');
      }

      const apiKey = this.safeDecryptSecret(String(row.api_key_encrypted || ''));
      return {
        providerKey: rawProviderKey,
        providerLabel: String(row.provider_label || '').trim() || AI_PROVIDER_LABELS[rawProviderKey],
        apiKey,
        model: String(row.model || '').trim() || getDefaultModelForProvider(rawProviderKey),
        baseUrl: normalizeAiProviderBaseUrl(rawProviderKey, row.base_url),
      };
    }

    const envOpenRouterKey = String(this.config.get<string>('OPENROUTER_API_KEY') || '').trim();
    if (envOpenRouterKey) {
      return {
        providerKey: 'openrouter',
        providerLabel: 'OpenRouter (.env fallback)',
        apiKey: envOpenRouterKey,
        model: String(this.config.get<string>('OPENROUTER_MODEL') || getDefaultModelForProvider('openrouter')).trim(),
        baseUrl: getDefaultBaseUrlForProvider('openrouter'),
      };
    }

    throw new ServiceUnavailableException('No active AI provider is configured for Lessons. Go to Admin → Settings → AI, add a provider with an API key, and click “Use now”.');
  }

  private getEncryptionSecret() {
    const configured = String(this.config.get<string>('SETTINGS_ENCRYPTION_KEY') || '').trim();
    const nodeEnv = String(this.config.get<string>('NODE_ENV') || 'development').trim();
    if (!configured && nodeEnv === 'production') {
      throw new BadRequestException('SETTINGS_ENCRYPTION_KEY must be configured before using saved AI provider secrets');
    }
    return configured || 'lms-dev-settings-key-change-me';
  }

  private safeDecryptSecret(value: string) {
    try {
      return decryptSecret(value, this.getEncryptionSecret());
    } catch {
      return '';
    }
  }

  private extractChatCompletionText(payload: unknown): string {
    const content = (payload as { choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }> })?.choices?.[0]?.message?.content;
    if (typeof content === 'string') return content.trim();
    if (Array.isArray(content)) {
      return content
        .map((part) => (part?.type === 'text' && typeof part?.text === 'string' ? part.text : ''))
        .join('')
        .trim();
    }
    return '';
  }

  private extractClaudeCompletionText(payload: unknown): string {
    const content = (payload as { content?: Array<{ type?: string; text?: string }> })?.content;
    if (!Array.isArray(content)) return '';
    return content
      .map((part) => (part?.type === 'text' && typeof part?.text === 'string' ? part.text : ''))
      .join('')
      .trim();
  }

  private extractGenericApiError(payload: unknown): string {
    const message = (payload as { error?: { message?: string } })?.error?.message;
    return String(message || 'Unknown provider error');
  }

  private deserialize(row: AiNoteRow) {
    let noteData: unknown = null;
    try { noteData = row.note_data ? JSON.parse(row.note_data) : null; } catch { noteData = null; }
    return {
      id: row.id,
      title: row.title,
      rawText: row.raw_text,
      noteData,
      engineKey: row.engine_key || 'gemini',
      courseId:     row.effective_course_id ?? row.course_id    ?? null,
      topicId:      row.effective_topic_id ?? row.topic_id     ?? null,
      subtopicId:   row.effective_subtopic_id ?? row.subtopic_id  ?? null,
      lessonId:     row.lesson_id    ?? null,
      videoUrl:     row.video_url || row.lesson_video_url || '',
      isFree:       Number(row.effective_is_free ?? row.is_free) === 1,
      status:       row.status       ?? 'active',
      courseTitle:  row.course_title  ?? null,
      topicName:    row.topic_name    ?? null,
      subtopicName: row.subtopic_name ?? null,
      lessonTitle:  row.lesson_title  ?? null,
      lessonProgressStatus: row.lesson_progress_status || 'not_started',
      lessonProgressPercent: Number(row.lesson_progress_percent || 0),
      lessonCompletedAt: row.lesson_completed_at || null,
      lessonCompleted: row.lesson_progress_status === 'completed',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private async getLessonAccessProfile(userId: number): Promise<LessonAccessProfile> {
    const [rows] = await this.db.execute<AccessScopeRow[]>(
      `
        SELECT sf.feature_key, plans.slug AS plan_slug, us.access_scope, us.course_ids_json, us.lesson_ids_json
        FROM user_subscriptions us
        INNER JOIN plans ON plans.id = us.plan_id
        INNER JOIN subscription_plan_features spf
          ON spf.plan_id = us.plan_id
         AND spf.is_enabled = 1
        INNER JOIN subscription_features sf
          ON sf.id = spf.feature_id
         AND sf.status = 'active'
        WHERE us.user_id = ?
          AND us.status = 'active'
          AND us.start_date <= CURDATE()
          AND us.end_date >= CURDATE()
          AND sf.feature_key IN ('lessons_access_full', 'lessons_access_limited')
      `,
      [userId],
    );

    const profile: LessonAccessProfile = {
      hasAnyPaidLessonAccess: rows.length > 0,
      hasFullAccess: false,
      courseIds: new Set<number>(),
      lessonIds: new Set<number>(),
    };

    for (const row of rows) {
      const courseIds = this.parseIdList(row.course_ids_json);
      const lessonIds = this.parseIdList(row.lesson_ids_json);
      const scope = this.resolveEffectiveAccessScope(row, courseIds, lessonIds);

      if (scope === 'all' && courseIds.length === 0 && lessonIds.length === 0) {
        profile.hasFullAccess = true;
      } else if (scope === 'courses') {
        courseIds.forEach((courseId) => profile.courseIds.add(courseId));
      } else if (scope === 'lessons') {
        lessonIds.forEach((lessonId) => profile.lessonIds.add(lessonId));
      }
    }

    return profile;
  }

  private parseIdList(raw: string | null) {
    try {
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0);
    } catch {
      return [];
    }
  }

  private resolveEffectiveAccessScope(row: AccessScopeRow, courseIds: number[], lessonIds: number[]) {
    const planSlug = String(row.plan_slug || '').trim();
    if (planSlug.startsWith('custom-single-') || planSlug.startsWith('custom-multi-')) {
      return 'courses';
    }
    return row.access_scope || (courseIds.length ? 'courses' : lessonIds.length ? 'lessons' : 'all');
  }

  private canAccessStudentNote(
    note: ReturnType<AiNotesService['deserialize']>,
    hasNotesAccess: boolean,
    accessProfile: LessonAccessProfile,
  ) {
    if (note.isFree) return true;
    if (!hasNotesAccess || !accessProfile.hasAnyPaidLessonAccess) return false;
    if (accessProfile.hasFullAccess) return true;
    if (note.courseId && accessProfile.courseIds.has(Number(note.courseId))) return true;
    if (note.lessonId && accessProfile.lessonIds.has(Number(note.lessonId))) return true;
    return false;
  }

  private mapStudentNote(row: AiNoteRow, hasNotesAccess: boolean, accessProfile: LessonAccessProfile) {
    const note = this.deserialize(row);
    const canAccess = this.canAccessStudentNote(note, hasNotesAccess, accessProfile);
    const hasStudyMode = hasNotesAccess || note.isFree;
    return {
      ...note,
      canAccess,
      accessLocked: !canAccess,
      upgradeLabel: hasStudyMode ? 'Not included in your course package' : 'Available in Standard plan',
      lockReason: !canAccess
        ? hasStudyMode
          ? 'Your package only unlocks selected course or lesson content.'
          : 'Upgrade to access this feature'
        : '',
      noteData: canAccess ? note.noteData : null,
    };
  }

  private buildPrompt(text: string): string {
    return `You are a senior medical educator writing high-yield lessons for final-year medical students preparing for the Sri Lankan Medical Licensing Examination (ERPM / Act 16) and Sri Lanka Medical College (SLMC) clinical exams.

TARGET AUDIENCE: Final-year MBBS — full clinical terminology, mechanisms, exam-relevant precision.

COVERAGE RULE: You MUST cover EVERY topic, disease, drug, and concept mentioned in the source text. Do NOT skip any topic. If the source text is long, generate MORE sections — up to 12 sections is fine. Better to have more sections than to miss content.

━━━ SECTION ORDER ━━━
Generate sections in this order (include ALL that are relevant; add extra sections for any additional topics):
1. Definition & Classification
2. Pathophysiology
3. Aetiology & Risk Factors
4. Clinical Features
5. Investigations
6. Management
7. Complications & Prognosis
8–12. [Additional sections for any extra subtopics, special populations, SL-specific protocols, or drug details not covered above]

━━━ BULLET RULES (STRICT — NO EXCEPTIONS) ━━━
- Every bullet = ONE clinical fact, MAX 13 WORDS — fragment, not a sentence
- NO paragraphs. NO "this is because…". NO multi-clause sentences.
- Good: "==Cor pulmonale==: RV failure from ==chronic hypoxia==" (9 words ✓)
- Bad: "Cor pulmonale is a condition where the right ventricle fails due to chronic hypoxia from lung disease" ✗
- ==double equals== → highlight: key diagnoses, named syndromes, eponyms, pathological terms
- Use different highlight targets across sections so colors rotate visibly in the lesson canvas
- **double asterisks** → bold: drug+dose+route, lab cut-offs, scoring thresholds, percentages
- Doses: always include route + freq → "**Furosemide 40mg IV stat**", "**Amoxicillin 500mg PO TDS × 7d**"
- Always include numbers where available (EF%, GFR, mmHg, mg/dL, weeks, days)

━━━ GUIDELINE TAGS ━━━
- [SL MOH 2023] or [SL MOH] for Sri Lankan protocols
- [GOLD 2024] COPD · [GINA 2024] Asthma · [ISH 2020] Hypertension
- [ESC 2021] / [AHA/ACC 2022] Heart failure · [ADA 2024] Diabetes
- [Surviving Sepsis 2021] · [AHA/ASA 2019] Stroke · [WHO 2022] / [SL NTP] TB
- [SL MOH] for dengue, malaria, leptospirosis, typhoid (endemic — SL protocols primary)
- [Not in SL formulary] if drug unavailable locally
- [EXAM TRAP] for common mistakes, confused drugs, Sri Lanka-specific traps

━━━ CLASSIFICATION — SUB-BULLETS ━━━
Use → prefix for subtypes after the parent bullet:
  "==VSD==: ventricular septal defect"
  "→ ==Perimembranous==: **80%**, most common [EXAM TRAP]"
  "→ ==Muscular==: may close spontaneously"
Use → pattern for ALL classifications: types, grades, stages, classes, subtypes.

━━━ PER-SECTION RULES ━━━
- 5–8 bullets (including → sub-bullets for classifications)
- callout: [EXAM TRAP] or rare-but-tested pearl — max 12 words, fragment
- sticky_note: key mechanism/criterion/rule — max 10 words, fragment only
- mnemonic: any memorable acronym or hook — "" if nothing fits
- diagram_prompt: precise structure/pathway/flowchart to draw

━━━ SUMMARY BOX ━━━
NOT a paragraph. ONE of these formats (max 25 words):
Option A: "Urate crystals · hot joint · **colchicine** + **allopurinol**" (dot fragments)
Option B: "↑Urate → crystals → neutrophil activation → arthritis → **NSAIDs**/colchicine" (arrow flow)
Option C: "Cause: urate | Feature: podagra | Rx: **allopurinol 100–300mg OD**" (mini table)

━━━ KEY POINTS ━━━
6–10 true one-liners with values covering the MOST high-yield facts from ALL sections:
"==HFrEF==: EF **<40%**", "[EXAM TRAP] Loop diuretics: no mortality benefit in HF"

━━━ SRI LANKAN PRIORITY ━━━
- Always check for SL MOH guideline on the topic
- Endemic diseases (dengue, malaria, leptospirosis, typhoid, filariasis) — SL protocols first
- Resource-limited context: prefer oral over IV where equivalent

Return ONLY this JSON (no markdown, no code fences, no explanation):
{
  "title": "TOPIC NAME IN CAPS",
  "subtitle": "One high-yield fragment — pathophys · hallmark · management hook",
  "sections": [
    {
      "heading": "1. Definition & Classification",
      "bullets": ["==Term==: fragment", "→ ==Subtype==: detail [EXAM TRAP]"],
      "callout": "[EXAM TRAP] short fragment max 12 words",
      "sticky_note": "Key fact fragment max 10 words",
      "mnemonic": "ACRONYM: A-B-C-D (or empty string)",
      "diagram_prompt": "Precise anatomy/pathway/flowchart to illustrate"
    }
  ],
  "summary_box": "fragment · fragment · fragment (max 25 words, no paragraph)",
  "key_points": ["==Term==: **value**", "[EXAM TRAP] fact with value"],
  "visual_style": { "theme": "notebook", "look": "hand-drawn academic", "colors": ["#A7D8FF","#FFE680","#FFB3B3","#C7F0BD","#CE93D8","#80DEEA","#F48FB1","#FFCC80"] }
}

Medical text:
${text.slice(0, 12000)}`;
  }

  private splitIntoPages(result: NoteResult): NoteCanvas {
    const sections = result.sections;
    if (sections.length <= 5) return { pages: [result] };

    // Split into pages of 5 sections each
    const pageGroups: NoteSection[][] = [];
    for (let i = 0; i < sections.length; i += 5) {
      pageGroups.push(sections.slice(i, i + 5));
    }

    const kp  = result.key_points;
    const n   = pageGroups.length;
    const pages: NoteResult[] = pageGroups.map((group, i) => {
      const isLast  = i === n - 1;
      const kpStart = Math.floor(i * kp.length / n);
      const kpEnd   = isLast ? kp.length : Math.floor((i + 1) * kp.length / n);
      return {
        title:        i === 0 ? result.title : this.derivePageTitle(group, i),
        subtitle:     i === 0 ? result.subtitle : '',
        sections:     group,
        summary_box:  isLast ? result.summary_box : '',
        key_points:   kp.slice(kpStart, kpEnd),
        visual_style: result.visual_style,
      };
    });

    return { pages };
  }

  private derivePageTitle(sections: NoteSection[], idx: number): string {
    const h = sections[0]?.heading?.toLowerCase() || '';
    if (/clinical|feature|sign|symptom|presentation/.test(h)) return 'CLINICAL APPROACH';
    if (/investig|diagnos|lab|imaging|test/.test(h))           return 'INVESTIGATIONS';
    if (/manag|treat|therap|drug|rx|medic|surg/.test(h))       return 'MANAGEMENT';
    if (/complic|prognos|outcome|special|follow/.test(h))      return 'COMPLICATIONS & CONTEXT';
    return `PART ${idx + 1}`;
  }

  private validate(d: unknown): NoteResult {
    const data = (d ?? {}) as Record<string, unknown>;
    return {
      title: String(data?.title || 'Lesson').trim().slice(0, 120),
      subtitle: String(data?.subtitle || '').trim().slice(0, 200),
      sections: (Array.isArray(data?.sections) ? data.sections : []).slice(0, 12).map((s: unknown) => {
        const sec = (s ?? {}) as Record<string, unknown>;
        return {
          heading:        String(sec?.heading        || '').trim(),
          bullets:        (Array.isArray(sec?.bullets) ? sec.bullets : []).map(String).slice(0, 16),
          callout:        String(sec?.callout        || '').trim().slice(0, 300),
          sticky_note:    String(sec?.sticky_note    || '').trim().slice(0, 200),
          mnemonic:       String(sec?.mnemonic       || '').trim().slice(0, 300),
          diagram_prompt: String(sec?.diagram_prompt || '').trim().slice(0, 200),
        };
      }).filter(s => s.heading || s.bullets.length > 0),
      summary_box: String(data?.summary_box || '').trim().slice(0, 600),
      key_points:  (Array.isArray(data?.key_points) ? data.key_points : []).map(String).slice(0, 10),
      visual_style: {
        theme: 'notebook',
        look: 'hand-drawn academic',
        colors: this.normalizePalette((data?.visual_style as Record<string, unknown> | undefined)?.colors),
      },
    };
  }

  private normalizePalette(value: unknown): string[] {
    const colors = Array.isArray(value)
      ? value
          .map(color => String(color || '').trim())
          .filter(color => /^#[0-9a-f]{6}$/i.test(color))
      : [];
    const palette = [...colors, ...FALLBACK_COLORS];
    return Array.from(new Set(palette)).slice(0, 8);
  }

}
