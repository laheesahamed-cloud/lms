import { finishedLessons } from '../../common/utils/lesson-bits';
import { Inject, Injectable, Logger, OnApplicationBootstrap, OnModuleInit } from '@nestjs/common';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { localDateKey } from '../xp/streak';
import { Pool, RowDataPacket } from 'mysql2/promise';
import { DATABASE_CONNECTION } from '../../database/database.tokens';
import { onContentVersionChange } from '../../common/utils/content-version';
import { CourseStructureService } from './course-structure.service';
import { getScopeRows, summaryRowFromRequest } from '../../common/auth/subscription-scope';
import { buildContentAccess, ScopeRowLike } from '../../common/auth/content-access';

/**
 * The student catalogue (OPTIMIZE 10, step 5): what every student's lesson and
 * Q-Bank lists are made of, the same for everyone. Built once per catalogue
 * version, compact (arrays, no repeated keys), gzipped once, and kept by the
 * phone until the version changes. Each student's own state (progress, plan
 * access) comes separately, read by their user id.
 *
 *  courses   [id, title, code, examType, description]
 *  subjects  [id, courseId, name]
 *  topics    [id, subjectId, name]
 *  lessons   [id, courseId, subjectId, topicId, title, isFree, hasNote, hasPdf, hasVideo,
 *             flashcards, flashcardsStamp, lessonStamp]  (stamps = last change, so the
 *             phone re-downloads a lesson or its cards only when they changed)
 *            (ready-to-study lessons, in the order the lessons list shows them)
 *  quizzes   [id, courseId, subjectId, topicId, lessonId, isGeneral, examModeOnly,
 *             isFree, studentTitle, quizTitle, numberMode, quizNumber,
 *             totalQuestions, timeLimit, passingMarks, dynamic, contentStamp]
 *
 * Lessons come from the course structure snapshot (no extra reads); quizzes
 * are read by the same single worker in id-ordered slices of ≤ 1,000 rows.
 * Large content (lesson bodies, questions, quiz descriptions) is not in here:
 * it loads when a lesson or quiz is opened.
 */
const QUIZ_PASS_MARK = 45;
const FILE_FORMAT = 2; // 2: quiz rows carry the content stamp (10.27)
/**
 * The catalogue's SHAPE (which fields each row has). Raised whenever fields
 * are added, so phones holding an older shape fetch a fresh copy even when
 * the content version is unchanged (a phone kept a pre-stamp catalogue).
 */
export const CATALOGUE_FORMAT = 4;
/**
 * The lessons / quizzes parts' shape (10.25), smaller than format 4:
 *  - every row's id (lessons and quizzes) is the gap from the row before
 *    (the first row's is the id itself) — add them up to read the ids;
 *  - quiz rows have ONE name (admin and student names are the same):
 *    [id, courseId, subjectId, topicId, lessonId, isGeneral, examModeOnly,
 *     isFree, name, totalQuestions, timeLimit, passingMarks, dynamic, stamp],
 *    sent oldest first;
 *  - the quiz part carries only the topics its quizzes use.
 * The combined parts and the full catalogue keep format 4 (installed builds).
 */
export const PARTS_FORMAT = 5;
const SLICE = 1000;

/** Rows with their first column (the id) as the gap from the row before. */
function gapIds<T extends unknown[]>(rows: T[]): T[] {
  let previous = 0;
  return rows.map((row) => {
    const id = Number(row[0]);
    const out = [id - previous, ...row.slice(1)] as unknown as T;
    previous = id;
    return out;
  });
}

/** A format-4 quiz row as the format-5 row (one name, no number fields). */
function shortQuizRow(q: StudentCatalogue['quizzes'][number]) {
  return [q[0], q[1], q[2], q[3], q[4], q[5], q[6], q[7], q[8] || q[9], q[12], q[13], q[14], q[15], Number(q[16]) || 1];
}
const PAUSE_MS = 250;

/** A ready lesson that has approved flashcards (the flashcard deck list). */
export type DeckLesson = {
  id: number; courseId: number; topicId: number | null; subtopicId: number | null; isFree: boolean;
  courseTitle: string; topicName: string; subtopicName: string; lessonTitle: string; approvedFlashcardCount: number;
  /** When this lesson's approved cards last changed (10.23 F5: the cards file key). */
  stamp?: number;
};

export type StudentCatalogue = {
  v: number;
  courses: Array<[number, string, string, string, string]>;
  subjects: Array<[number, number, string]>;
  topics: Array<[number, number, string]>;
  lessons: Array<[number, number, number, number, string, 0 | 1, 0 | 1, 0 | 1, 0 | 1, number, number, number]>;
  quizzes: Array<[number, number, number, number, number, 0 | 1, 0 | 1, 0 | 1, string, string, 0 | 1, number, number, number, number, 0 | 1, number]>;
};

/**
 * How a client wants its progress: `bits` = the finished-lessons bitmap
 * (10.14), with the version it already holds and whose it is ("userId:version":
 * a phone signing in still holds the last account's copy, and two accounts can
 * be at the same version).
 */
export type ProgressOptions = { bits?: boolean; haveVersion?: number; haveUser?: number };

/** Progress options from a request's query / body / headers (format=bits, v="userId:version"). */
export function progressOptions(format: unknown, version: unknown): ProgressOptions {
  if (String(format || '') !== 'bits') return {};
  const m = String(version ?? '').match(/^(\d+):(\d+)$/);
  if (!m) return { bits: true };
  return { bits: true, haveUser: Number(m[1]), haveVersion: Number(m[2]) };
}

@Injectable()
export class StudentCatalogueService implements OnModuleInit, OnApplicationBootstrap {
  private readonly logger = new Logger(StudentCatalogueService.name);
  private current: {
    v: number; json: string; gzip: Buffer; decks: DeckLesson[]; quizCount: number;
    // Two-level catalogue (step 5): a small index and one part per course, so
    // a phone re-downloads only the courses whose fingerprint changed.
    index: { json: string; gzip: Buffer };
    parts: Map<number, { hash: string; json: string }>;
    // 10.23 L2: the same courses split into a lessons part and a quiz part.
    lessonParts: Map<number, { hash: string; json: string }>;
    quizParts: Map<number, { hash: string; json: string }>;
  } | null = null;
  private building: Promise<void> | null = null;

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Pool,
    private readonly structure: CourseStructureService,
  ) {}

  onModuleInit() {
    // A content save: rebuild in the background (a few seconds later, so a
    // burst of saves builds once), never inside a phone's request.
    onContentVersionChange(() => {
      if (this.rebuildTimer) clearTimeout(this.rebuildTimer);
      this.rebuildTimer = setTimeout(() => { this.get().catch(() => {}); }, 3000);
      this.rebuildTimer.unref?.();
    });
  }

  onApplicationBootstrap() {
    // Ready before the first phone asks: from the file, else built now.
    setTimeout(() => { this.get().catch((e) => this.logger.warn(`Catalogue warm-up failed: ${e?.message || e}`)); }, 1500).unref?.();
  }

  private rebuildTimer: NodeJS.Timeout | null = null;

  /**
   * One student's own state, read by their user id: plan access (from the
   * signed token when present, no SQL), lesson progress rows and quiz
   * progress rows (only what they used). Sent with the start-up / sign-in
   * reply and by GET /student/progress.
   */
  async progressFor(
    userId: number,
    studyStats: { quizProgress(userId: number): Promise<unknown[]>; ensureBuilt(userId: number): Promise<void> },
    opts: ProgressOptions = {},
  ) {
    const scopeRows = await getScopeRows<ScopeRowLike>(this.db, userId);
    const access = buildContentAccess(scopeRows);
    // 10.19: a PAID plan (the free plan's slug is 'free') — the Planner and
    // drug spins use it from here instead of /subscriptions/me (0 statements).
    const paidPlan = scopeRows.some((r: any) => String(r.plan_slug || '') !== 'free');
    // Finished lessons (10.14): a phone that asks for bits gets the bitmap from
    // the summary row (1 row), or nothing when its version is already current;
    // older builds and the website keep the row list.
    let lessonsPart: Record<string, unknown>;
    if (opts.bits) {
      await studyStats.ensureBuilt(userId);
      // Lessons AND quizzes from the one summary row (10.16): the lesson
      // bitmap, the quiz byte map (passed + best %) and the 5 recent results.
      // Already read in this request (the Study Hub part of a sign-in /
      // start-up reply, 10.17)? Reuse it; else 1 row by primary key.
      const known = summaryRowFromRequest(userId);
      const today = localDateKey(new Date());
      const rows = known && 'lessons_done' in known && 'practice_seq' in known ? [known as RowDataPacket] : (await this.db.execute<RowDataPacket[]>(
        `SELECT lessons_done, quiz_marks, recent_results, progress_version, practice_seq,
                IF(last_active_day <=> ?, 15, 0) AS today_bits
           FROM student_study_summary WHERE user_id = ? LIMIT 1`,
        [today, userId],
      ))[0];
      // 10.30: today's goals = 15 when the day was done (its mark arrived), else 0;
      // and the last ride-along item applied —
      // the phone numbers new practices after it (e.g. after a reinstall).
      const rowExtras = { todayBits: Number(rows[0]?.today_bits || 0), practiceSeq: Number(rows[0]?.practice_seq || 0) };
      const version = Number(rows[0]?.progress_version || 0);
      let recent: unknown = [];
      try { recent = rows[0]?.recent_results ? JSON.parse(String(rows[0].recent_results)) : []; } catch { recent = []; }
      lessonsPart = opts.haveUser === userId && opts.haveVersion === version && version > 0
        ? { lessonsVersion: version, lessonsUnchanged: true, ...rowExtras }
        : {
            ...rowExtras,
            lessonsVersion: version,
            lessonsBits: rows[0]?.lessons_done ? Buffer.from(rows[0].lessons_done).toString('base64') : '',
            quizMarks: rows[0]?.quiz_marks ? Buffer.from(rows[0].quiz_marks).toString('base64') : '',
            recentResults: recent,
          };
    } else {
      // Older builds keep the row-list shape, built from the bitmap (10.15).
      const done = await finishedLessons(this.db, userId);
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
        features: access.paid, // any active subscription unlocks every feature
        paidPlan,
      },
      ...lessonsPart,
      // The new app reads quiz marks from the byte map; older builds keep rows.
      ...(opts.bits ? {} : { quizzes: await studyStats.quizProgress(userId) }),
    };
  }

  /** The catalogue for the current version: { v, json, gzip }. */
  /**
   * The catalogue for the current version. While a newer one is being built,
   * requests keep the previous one (phones pick up the new version on their
   * next start-up); only the very first build ever waits.
   */
  async get() {
    const snapshot = await this.structure.get();
    if (this.current && this.current.v === snapshot.version) return this.current;
    if (!this.building) {
      this.building = (async () => {
        if (!(await this.loadFile(snapshot.version))) await this.build();
      })().finally(() => { this.building = null; });
    }
    if (this.current) return this.current;
    await this.building;
    return this.current!;
  }

  private async build() {
    const snapshot = await this.structure.get();
    const courseIds = new Set(snapshot.courses.map((c) => Number(c.id)));
    const subjectName = new Map(snapshot.subjects.map((s) => [Number(s.id), String(s.topic_name)]));
    const courseOrder = new Map(snapshot.courses.map((c, i) => [Number(c.id), i]));
    const subjectOrder = new Map(snapshot.subjects.map((s, i) => [Number(s.id), i]));
    const topicOrder = new Map(snapshot.topics.map((t, i) => [Number(t.id), i]));

    // Approved flashcards per lesson (count + last change), once per version.
    const [cardRows] = await this.db.query<RowDataPacket[]>(
      `SELECT lesson_id, COUNT(*) AS n, UNIX_TIMESTAMP(MAX(updated_at)) AS stamp
         FROM lesson_flashcards WHERE status = 'approved' GROUP BY lesson_id`,
    );
    const cardsByLesson = new Map(cardRows.map((r) => [Number(r.lesson_id), Number(r.n)]));
    const cardStamp = new Map(cardRows.map((r) => [Number(r.lesson_id), Math.floor(Number(r.stamp) || 0)]));

    // The old lessons list's order: course (by title), subject, topic, lesson.
    const lessons = snapshot.lessons
      .filter((l) => (l.engine_key || 'gemini') === 'gemini' && courseIds.has(Number(l.course_id)))
      .map((l, i) => ({ l, i }))
      .sort((a, b) =>
        (courseOrder.get(Number(a.l.course_id)) ?? 1e9) - (courseOrder.get(Number(b.l.course_id)) ?? 1e9)
        || (subjectOrder.get(Number(a.l.topic_id)) ?? 1e9) - (subjectOrder.get(Number(b.l.topic_id)) ?? 1e9)
        || (topicOrder.get(Number(a.l.subtopic_id)) ?? -1) - (topicOrder.get(Number(b.l.subtopic_id)) ?? -1)
        || a.i - b.i)
      .map(({ l }) => [
        Number(l.id), Number(l.course_id), Number(l.topic_id) || 0, Number(l.subtopic_id) || 0,
        String(l.lesson_title || ''), Number(l.is_free) === 1 ? 1 : 0,
        Number(l.has_note) === 1 ? 1 : 0, Number(l.has_pdf) === 1 ? 1 : 0, l.video_url ? 1 : 0,
        cardsByLesson.get(Number(l.id)) || 0, cardStamp.get(Number(l.id)) || 0, Number(l.updated_ts) || 0,
      ] as StudentCatalogue['lessons'][number]);

    const quizRows = await this.slices(
      // 10.54: lesson_id, exam_mode_only, student_title and display_title_mode
      // were dropped; the fixed values every set had keep the phone's lists identical.
      `SELECT id, course_id, topic_id, subtopic_id, NULL AS lesson_id, is_general, 0 AS exam_mode_only, is_free,
              quiz_title AS student_title, quiz_title, 'title' AS display_title_mode, quiz_number, total_questions, time_limit,
              passing_marks, status, content_stamp
         FROM quizzes`,
    );
    const quizzes = quizRows
      .filter((q) => q.status === 'active' && courseIds.has(Number(q.course_id)))
      .sort((a, b) => Number(b.id) - Number(a.id)) // newest first, as the old list
      .map((q) => [
        Number(q.id), Number(q.course_id), Number(q.topic_id) || 0, Number(q.subtopic_id) || 0, Number(q.lesson_id) || 0,
        Number(q.is_general) === 1 ? 1 : 0, Number(q.exam_mode_only) === 1 ? 1 : 0, Number(q.is_free) === 1 ? 1 : 0,
        // One name per quiz (10.25): admin and student names are the same, and
        // every quiz shows its name (no "• Quiz 2" number display).
        String(q.student_title || q.quiz_title || ''), String(q.student_title || q.quiz_title || ''),
        0, Number(q.quiz_number) || 0,
        Number(q.total_questions) || 0, Number(q.time_limit) || 0,
        Number(q.passing_marks) > 0 ? Number(q.passing_marks) : QUIZ_PASS_MARK,
        0, // random-set flag: always 0 since 10.54 (position kept for installed apps)
        Number(q.content_stamp) || 1, // 10.27 R1: this quiz's content stamp
      ] as StudentCatalogue['quizzes'][number]);

    const courseTitle = new Map(snapshot.courses.map((c) => [Number(c.id), String(c.course_title)]));
    const topicName = new Map(snapshot.topics.map((t) => [Number(t.id), String(t.subtopic_name)]));
    const decks: DeckLesson[] = lessons
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

    const catalogue: StudentCatalogue = {
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

  /** Gzip, per-course parts and index from a built catalogue (no database). */
  private finish(catalogue: StudentCatalogue, decks: DeckLesson[]) {
    const json = JSON.stringify({ f: CATALOGUE_FORMAT, ...catalogue });
    const gzip = gzipSync(Buffer.from(json), { level: 9 });

    // Parts: everything of one course (its subjects, topics, lessons, quizzes).
    const parts = new Map<number, { hash: string; json: string }>();
    const lessonParts = new Map<number, { hash: string; json: string }>();
    const quizParts = new Map<number, { hash: string; json: string }>();
    const hashOf = (text: string) => createHash('sha1').update(text).digest('hex').slice(0, 12);
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
      // 10.23 L2: the same course as two smaller parts, so a screen downloads
      // only what it shows — Lessons / Flashcards the lessons, Q-Bank the quizzes.
      // 10.25: written in the smaller format 5 (see `PARTS_FORMAT`).
      const lessonsJson = JSON.stringify({ course: id, kind: 'lessons', subjects: part.subjects, topics: part.topics, lessons: gapIds(part.lessons) });
      // The quiz part carries only the topics its quizzes use (10.25 cut 1: the
      // lessons part already has every topic) and the few lessons its quizzes
      // point to (a lesson-linked set's title), never the whole lessons list.
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
      f: CATALOGUE_FORMAT,
      v: catalogue.v,
      courses: catalogue.courses,
      parts: Object.fromEntries([...parts.entries()].map(([id, p]) => [id, p.hash])),
      lessonParts: Object.fromEntries([...lessonParts.entries()].map(([id, p]) => [id, p.hash])),
      quizParts: Object.fromEntries([...quizParts.entries()].map(([id, p]) => [id, p.hash])),
    });
    const index = { json: indexJson, gzip: gzipSync(Buffer.from(indexJson), { level: 9 }) };
    this.current = { v: catalogue.v, json, gzip, decks, index, parts, lessonParts, quizParts, quizCount: catalogue.quizzes.length };
  }

  // Kept in a file (backend/storage/cache, not in git), so a restart serves
  // the catalogue without rebuilding it while the version is unchanged.
  private readonly file = join(process.env.CACHE_DIR || join(process.cwd(), 'storage', 'cache'), 'student-catalogue.json');

  private async saveFile(catalogue: StudentCatalogue, decks: DeckLesson[]) {
    try {
      await mkdir(join(this.file, '..'), { recursive: true });
      const tmp = `${this.file}.${process.pid}.tmp`;
      await writeFile(tmp, JSON.stringify({ format: FILE_FORMAT, catalogue, decks }));
      await rename(tmp, this.file);
    } catch (error: any) {
      this.logger.warn(`Student catalogue file not saved: ${error?.message || error}`);
    }
  }

  private async loadFile(version: number) {
    try {
      const saved = JSON.parse(await readFile(this.file, 'utf8'));
      if (saved?.format === FILE_FORMAT && saved.catalogue?.v === version) {
        this.finish(saved.catalogue, saved.decks || []);
        return true;
      }
    } catch { /* no file yet */ }
    return false;
  }

  /**
   * Names of lessons, quizzes, courses and subjects from the catalogue held in
   * memory (10.24): other student replies (saved items) name rows with these
   * instead of joining the content tables — 0 statements. Parsed once per version.
   */
  private namesCache: { v: number; quiz: Map<number, any[]>; lesson: Map<number, any[]>; course: Map<number, string>; subject: Map<number, string>; topic: Map<number, any[]> } | null = null;

  async names() {
    const current = await this.get();
    if (this.namesCache && this.namesCache.v === current.v) return this.namesCache;
    const cat = JSON.parse(current.json) as StudentCatalogue;
    this.namesCache = {
      v: current.v,
      quiz: new Map(cat.quizzes.map((q) => [Number(q[0]), q as unknown as any[]])),
      lesson: new Map(cat.lessons.map((l) => [Number(l[0]), l as unknown as any[]])),
      course: new Map(cat.courses.map((c) => [Number(c[0]), String(c[1])])),
      subject: new Map(cat.subjects.map((x) => [Number(x[0]), String(x[2])])),
      topic: new Map(cat.topics.map((t) => [Number(t[0]), t as unknown as any[]])),
    };
    return this.namesCache;
  }

  /** The parts of these courses as one gzipped reply ({ v, parts: [...] }). */
  async partsFor(courseIds: number[], kind?: string) {
    const current = await this.get();
    // kind = lessons | quizzes (10.23 L2); none = the combined part (installed app builds).
    const source = kind === 'lessons' ? current.lessonParts : kind === 'quizzes' ? current.quizParts : current.parts;
    const parts = courseIds.map((id) => source.get(id)).filter((p): p is { hash: string; json: string } => !!p);
    const format = kind === 'lessons' || kind === 'quizzes' ? PARTS_FORMAT : CATALOGUE_FORMAT;
    const json = `{"f":${format},"v":${current.v},"parts":[${parts.map((p) => p.json).join(',')}]}`;
    return { v: current.v, json, gzip: gzipSync(Buffer.from(json), { level: 9 }) };
  }

  private async slices(select: string): Promise<RowDataPacket[]> {
    const out: RowDataPacket[] = [];
    let after = 0;
    for (;;) {
      const [rows] = await this.db.query<RowDataPacket[]>(`${select} WHERE id > ? ORDER BY id LIMIT ${SLICE}`, [after]);
      out.push(...rows);
      if (rows.length < SLICE) return out;
      after = Number(rows[rows.length - 1].id);
      await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
    }
  }
}
