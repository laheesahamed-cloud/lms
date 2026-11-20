import { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';

/**
 * Stored counts for the admin Structure page.
 *
 * Only these four columns exist:
 *   courses.lesson_count, courses.subject_count,
 *   topics.lesson_count (a subject's lessons), topics.subtopic_count (its topics)
 *
 * The page only READS them. Every save that can change one adjusts just the
 * affected rows, by primary key, in the same transaction as the change
 * (`col = col ± n`), so a failed save rolls its counts back too. Saves that
 * can't change a count (lesson text, flashcards, order, status, files) touch
 * none. There is no automatic full recount any more, not after saves and not
 * at startup (except once, when the columns are first created).
 *
 * A lesson counts only when it is public on the default engine:
 *   is_public = 1 AND engine_key = 'gemini'   (status does NOT matter)
 *
 * Edits made outside the app (phpMyAdmin, SQL imports) are repaired by the
 * admin "Fix counts" action (checkStructureCounts / fixStructureCounts).
 */
type Executor = Pick<Pool, 'execute' | 'query'> | Pick<PoolConnection, 'execute' | 'query'>;

export const COUNTED_LESSON = "is_public = 1 AND engine_key = 'gemini'";

export function isCountedLesson(row: Record<string, any> | null | undefined) {
  return Boolean(row) && Number(row!.is_public) === 1 && String(row!.engine_key ?? 'gemini') === 'gemini';
}

/** Add `delta` to one counter column for each id (ids may repeat; null ids skipped). Ascending id = consistent lock order. */
export async function bumpCounts(
  conn: Executor,
  table: 'courses' | 'topics' | 'questions',
  column: 'lesson_count' | 'subject_count' | 'subtopic_count'
    | 'quiz_total' | 'quiz_active' | 'quiz_general_total' | 'quiz_general_active' | 'quiz_unfiled_total' | 'quiz_unfiled_active'
    | 'quiz_count' | 'question_total',
  changes: Array<[number | null | undefined, number]>,
) {
  const byId = new Map<number, number>();
  for (const [id, delta] of changes) {
    if (id == null || !Number.isFinite(Number(id)) || Number(id) <= 0 || !delta) continue;
    byId.set(Number(id), (byId.get(Number(id)) || 0) + delta);
  }
  const entries = [...byId.entries()].filter(([, d]) => d !== 0).sort((a, b) => a[0] - b[0]);
  if (!entries.length) return;
  const cases = entries.map(() => 'WHEN ? THEN ?').join(' ');
  const params: number[] = [];
  for (const [id, d] of entries) params.push(id, d);
  for (const [id] of entries) params.push(id);
  // GREATEST(…, 0) is a guard only; Fix counts reports any drift it would hide.
  await conn.execute(
    `UPDATE ${table} SET ${column} = GREATEST(CAST(${column} AS SIGNED) + (CASE id ${cases} ELSE 0 END), 0)
     WHERE id IN (${entries.map(() => '?').join(', ')})`,
    params,
  );
}

/**
 * A lesson changed placement and/or eligibility: move its count from the old
 * course and subject to the new ones. 0 rows when nothing that counts changed,
 * up to 4 (2 courses + 2 subjects) otherwise.
 */
export async function moveLessonCounts(
  conn: Executor,
  before: { course_id: unknown; topic_id: unknown; counted: boolean },
  after: { course_id: unknown; topic_id: unknown; counted: boolean },
) {
  const n = (v: unknown) => (v == null || v === '' ? null : Number(v));
  const courseChanges: Array<[number | null, number]> = [];
  const subjectChanges: Array<[number | null, number]> = [];
  if (before.counted) { courseChanges.push([n(before.course_id), -1]); subjectChanges.push([n(before.topic_id), -1]); }
  if (after.counted) { courseChanges.push([n(after.course_id), 1]); subjectChanges.push([n(after.topic_id), 1]); }
  // Lock order everywhere: lessons → subjects (topics) → courses.
  await bumpCounts(conn, 'topics', 'lesson_count', subjectChanges);
  await bumpCounts(conn, 'courses', 'lesson_count', courseChanges);
}

/** Full recount of every course and subject. Only used when the columns are first created. */
export async function recountStructure(db: Executor) {
  // Correlated counts on parent-id indexes (stable plans; see OPTIMIZE.md 4.9).
  await db.execute(`
    UPDATE courses c
    SET c.lesson_count = (SELECT COUNT(*) FROM lessons l WHERE l.course_id = c.id AND l.is_public = 1 AND l.engine_key = 'gemini')`);
  await db.execute(`
    UPDATE courses c
    SET c.subject_count = (SELECT COUNT(*) FROM topics t WHERE t.course_id = c.id)`);
  await db.execute(`
    UPDATE topics t
    SET t.lesson_count = (SELECT COUNT(*) FROM lessons l WHERE l.topic_id = t.id AND l.engine_key = 'gemini' AND l.is_public = 1)`);
  await db.execute(`
    UPDATE topics t
    SET t.subtopic_count = (SELECT COUNT(*) FROM subtopics s WHERE s.topic_id = t.id)`);
}

export type CountIssue = {
  level: 'course' | 'subject';
  id: number;
  name: string;
  field: 'lesson_count' | 'subject_count' | 'subtopic_count'
    | 'quiz_total' | 'quiz_active' | 'quiz_general_total' | 'quiz_general_active' | 'quiz_unfiled_total' | 'quiz_unfiled_active';
  stored: number;
  actual: number;
};

/**
 * Cheap drift check: compares each course with its own subjects (sum of the
 * subjects' lesson counts, number of subject rows). Reads only courses and
 * topics (no lessons), so it is safe to run any time. It cannot see a lesson
 * added or removed outside the app in a way that skipped BOTH counts; the full
 * fix below does.
 */
export async function checkStructureCounts(db: Executor): Promise<CountIssue[]> {
  const [rows] = await db.query<RowDataPacket[]>(`
    SELECT c.id, c.course_title, c.lesson_count, c.subject_count,
           COALESCE(SUM(t.lesson_count), 0) AS subjects_lessons, COUNT(t.id) AS subjects
    FROM courses c LEFT JOIN topics t ON t.course_id = c.id
    GROUP BY c.id, c.course_title, c.lesson_count, c.subject_count`);
  const issues: CountIssue[] = [];
  for (const r of rows) {
    if (Number(r.lesson_count) !== Number(r.subjects_lessons)) {
      issues.push({ level: 'course', id: Number(r.id), name: r.course_title, field: 'lesson_count', stored: Number(r.lesson_count), actual: Number(r.subjects_lessons) });
    }
    if (Number(r.subject_count) !== Number(r.subjects)) {
      issues.push({ level: 'course', id: Number(r.id), name: r.course_title, field: 'subject_count', stored: Number(r.subject_count), actual: Number(r.subjects) });
    }
  }
  return issues;
}

/**
 * "Fix counts", in as few small requests as possible.
 *
 * The admin page drives it one request at a time, with a pause between them,
 * and each request stays under ~1,000 rows examined:
 *   request 1   — plan (courses + their subjects with stored counts, 1 query)
 *                 AND the first set of subjects
 *   request 2…  — the next set; the LAST one also finishes (course totals)
 * Today's data needs 2 requests; at 50,000 lessons about 55, each still small.
 *
 * A set is whole subjects. It is counted in ONE statement: each subject row
 * (by primary key) with its real lesson and topic counts as correlated
 * subqueries, both index-only. Sets are sized from the stored counts; each
 * request reports the rows it really read.
 *
 * Each request uses one connection for a few ms. Counting takes no locks, so
 * saves carry on. A number is written only if it still has the value read
 * before counting (compare-and-set); otherwise it is reported as "changed
 * during the fix". One fix at a time, then a cooldown (FIX_COUNTS_COOLDOWN_MS,
 * default 1 minute) before the next.
 */
export const FIX_REQUEST_ROW_BUDGET = 980; // + sign-in check + rare writes stays under 1,000

export class CountFixBusyError extends Error {}

type FixCourse = { id: number; name: string; lessonCount: number; subjectCount: number };
type SetOutcome = { fixed: CountIssue[]; changed: CountIssue[]; courseLessons: Record<number, number>; rowsRead: number };
type FinishTotals = Array<{ id: number; lessons: number; expectedLessons: number; expectedSubjects: number }>;

let fixRun: { id: string; expiresAt: number; finishRows: number; bumpStamps: boolean; startedAt: string | null } | null = null;
let cooldownUntil = 0;
const FIX_RUN_IDLE_MS = 60_000;
function cooldownMs() {
  const v = Number(process.env.FIX_COUNTS_COOLDOWN_MS);
  return Number.isFinite(v) && v >= 0 ? v : 60_000;
}

function touchRun(runId: string) {
  if (!fixRun || fixRun.id !== runId || fixRun.expiresAt < Date.now()) {
    throw new CountFixBusyError('This fix has expired or another one is running. Start again.');
  }
  fixRun.expiresAt = Date.now() + FIX_RUN_IDLE_MS;
  return fixRun;
}

/** One statement: the set's subjects with their stored and real counts, then compare-and-set writes. */
async function countSet(db: Executor, subjectIds: number[]): Promise<SetOutcome> {
  const ids = [...new Set(subjectIds.map(Number).filter((v) => Number.isInteger(v) && v > 0))].slice(0, 1000);
  if (!ids.length) return { fixed: [], changed: [], courseLessons: {}, rowsRead: 0 };
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT t.id, t.course_id, t.topic_name, t.lesson_count, t.subtopic_count, t.quiz_total, t.quiz_active,
       (SELECT COUNT(*) FROM lessons l FORCE INDEX (idx_lessons_topic_engine_pub_sort)
         WHERE l.topic_id = t.id AND l.is_public = 1 AND l.engine_key = 'gemini') AS real_lessons,
       (SELECT COUNT(*) FROM subtopics s FORCE INDEX (unique_topic_subtopic) WHERE s.topic_id = t.id) AS real_topics,
       -- Both assessment numbers from one pass over this subject's own index
       -- range ("total:active"). A grouped join over the whole set made
       -- MariaDB scan every assessment, general ones included, in each set.
       (SELECT CONCAT(COUNT(*), ':', COALESCE(SUM(q.status = 'active'), 0))
         FROM quizzes q FORCE INDEX (idx_quizzes_topic_general)
         WHERE q.topic_id = t.id AND q.is_general = 0) AS quiz_counts
     FROM topics t FORCE INDEX (PRIMARY) WHERE t.id IN (?)`, [ids]);
  const fixed: CountIssue[] = [];
  const changed: CountIssue[] = [];
  const courseLessons: Record<number, number> = {};
  let rowsRead = rows.length;
  for (const r of rows) {
    const [quizTotal, quizActive] = String(r.quiz_counts || '0:0').split(':').map(Number);
    r.real_quiz_total = quizTotal;
    r.real_quiz_active = quizActive;
    const id = Number(r.id);
    const realLessons = Number(r.real_lessons);
    const realTopics = Number(r.real_topics);
    rowsRead += realLessons + realTopics + Number(r.real_quiz_total);
    courseLessons[Number(r.course_id)] = (courseLessons[Number(r.course_id)] || 0) + realLessons;
    for (const [field, actual] of [
      ['lesson_count', realLessons], ['subtopic_count', realTopics],
      ['quiz_total', Number(r.real_quiz_total)], ['quiz_active', Number(r.real_quiz_active)],
    ] as const) {
      const before = Number(r[field]);
      if (before === actual) continue;
      const issue: CountIssue = { level: 'subject', id, name: r.topic_name, field, stored: before, actual };
      const [res] = await db.execute<any>(`UPDATE topics SET ${field} = ? WHERE id = ? AND ${field} = ?`, [actual, id, before]);
      (res.affectedRows ? fixed : changed).push(issue);
    }
  }
  return { fixed, changed, courseLessons, rowsRead };
}

/** One statement: each course with its real subject count and its lessons with no subject; compare-and-set writes. */
async function finishCourses(db: Executor, totals: FinishTotals, bumpStamps = false) {
  // 10.27 R1: after an SQL import (which skips the saves that raise quiz
  // stamps) every quiz gets a new stamp so phones rebuild it once.
  // 10.60: only when the admin ticks "I changed content with SQL" — it wrote
  // every assessment row on each Fix counts run.
  if (bumpStamps) await db.execute('UPDATE quizzes SET content_stamp = content_stamp + 1');
  const list = totals.filter((t) => Number.isInteger(Number(t.id)) && Number(t.id) > 0).slice(0, 1000);
  const ids = list.map((t) => Number(t.id));
  const fixed: CountIssue[] = [];
  const changed: CountIssue[] = [];
  if (!ids.length) return { fixed, changed };
  const [courses] = await db.query<RowDataPacket[]>(
    `SELECT c.id, c.course_title, c.lesson_count, c.subject_count,
       c.quiz_general_total, c.quiz_general_active, c.quiz_unfiled_total, c.quiz_unfiled_active, c.quiz_total,
       COALESCE(g.total, 0) AS real_general_total, COALESCE(g.active, 0) AS real_general_active,
       COALESCE(u.total, 0) AS real_unfiled_total, COALESCE(u.active, 0) AS real_unfiled_active,
       -- Subject rows and their (already fixed) assessment counts, one pass:
       -- "subjects:assessments". Same rows as counting the subjects alone.
       (SELECT CONCAT(COUNT(*), ':', COALESCE(SUM(t.quiz_total), 0))
         FROM topics t FORCE INDEX (fk_topics_course) WHERE t.course_id = c.id) AS subject_counts,
       (SELECT COUNT(*) FROM lessons l FORCE INDEX (fk_lessons_topic)
         WHERE l.topic_id IS NULL AND l.course_id = c.id AND l.is_public = 1 AND l.engine_key = 'gemini') AS loose_lessons
     FROM courses c
     LEFT JOIN (
       -- General assessments, one pass, both numbers (index only).
       SELECT course_id, COUNT(*) AS total, SUM(status = 'active') AS active
       FROM quizzes FORCE INDEX (idx_quizzes_course_general)
       WHERE course_id IN (?) AND is_general = 1 GROUP BY course_id
     ) g ON g.course_id = c.id
     LEFT JOIN (
       -- Assessments with no subject (usually none).
       SELECT course_id, COUNT(*) AS total, SUM(status = 'active') AS active
       FROM quizzes FORCE INDEX (idx_quizzes_topic_general)
       WHERE topic_id IS NULL AND is_general = 0 AND course_id IN (?) GROUP BY course_id
     ) u ON u.course_id = c.id
     WHERE c.id IN (?)`, [ids, ids, ids]);
  for (const c of courses) {
    const id = Number(c.id);
    const t = list.find((x) => Number(x.id) === id)!;
    const [realSubjects, subjectQuizzes] = String(c.subject_counts || '0:0').split(':').map(Number);
    c.real_subjects = realSubjects;
    const checks: Array<['lesson_count' | 'subject_count', number, number]> = [
      ['lesson_count', Number(t.lessons || 0) + Number(c.loose_lessons || 0), Number(t.expectedLessons)],
      ['subject_count', Number(c.real_subjects || 0), Number(t.expectedSubjects)],
    ];
    for (const [field, actual, expected] of checks) {
      const now = Number(c[field]);
      if (now === actual) continue;
      const issue: CountIssue = { level: 'course', id, name: c.course_title, field, stored: now, actual };
      // Changed since the plan was read (a save happened): the total may be stale.
      if (now !== expected) { changed.push(issue); continue; }
      const [res] = await db.execute<any>(`UPDATE courses SET ${field} = ? WHERE id = ? AND ${field} = ?`, [actual, id, now]);
      (res.affectedRows ? fixed : changed).push(issue);
    }
    // Assessment counts are counted completely here, so they are compared with
    // the value read in this same statement.
    for (const [field, actual] of [
      ['quiz_general_total', Number(c.real_general_total)], ['quiz_general_active', Number(c.real_general_active)],
      ['quiz_unfiled_total', Number(c.real_unfiled_total)], ['quiz_unfiled_active', Number(c.real_unfiled_active)],
      // Every assessment of the course = its subjects' + general + no subject.
      ['quiz_total', subjectQuizzes + Number(c.real_general_total) + Number(c.real_unfiled_total)],
    ] as const) {
      const now = Number(c[field]);
      if (now === actual) continue;
      const issue: CountIssue = { level: 'course', id, name: c.course_title, field, stored: now, actual };
      const [res] = await db.execute<any>(`UPDATE courses SET ${field} = ? WHERE id = ? AND ${field} = ?`, [actual, id, now]);
      (res.affectedRows ? fixed : changed).push(issue);
    }
  }
  return { fixed, changed };
}

function packSets(subjects: Array<{ id: number; weight: number }>, planRows: number, finishRows: number): { sets: number[][]; finishFitsLast: boolean } {
  const B = FIX_REQUEST_ROW_BUDGET;
  const total = subjects.reduce((t, s) => t + s.weight, 0);
  const sorted = [...subjects].sort((a, b) => b.weight - a.weight);
  for (let n = Math.max(1, Math.ceil((total + planRows + finishRows) / B)); n <= subjects.length + 1; n += 1) {
    const room = Array.from({ length: n }, (_, i) => B - (i === 0 ? planRows : 0) - (i === n - 1 ? finishRows : 0));
    const bins: number[][] = Array.from({ length: n }, () => []);
    let ok = true;
    for (const s of sorted) {
      let i = room.findIndex((r) => r >= s.weight);
      // A subject bigger than any room (one huge subject) gets the emptiest set.
      if (i < 0) {
        if (bins.every((bin) => bin.length)) { ok = false; break; }
        i = bins.findIndex((bin) => !bin.length);
      }
      bins[i].push(s.id);
      room[i] -= s.weight;
    }
    if (ok) {
      // Drop empty sets (keep the first: request 1 always runs). The finish
      // rides with the last set only if that set kept room for it.
      const keep = bins.map((bin, i) => ({ bin, room: room[i], i })).filter((x) => x.bin.length || x.i === 0);
      const last = keep[keep.length - 1];
      return { sets: keep.map((x) => x.bin), finishFitsLast: last.i === n - 1 || last.room >= finishRows };
    }
  }
  return { sets: [subjects.map((s) => s.id)], finishFitsLast: false };
}

function endRun() {
  fixRun = null;
  cooldownUntil = Date.now() + cooldownMs();
}

/**
 * 10.60: "checked up to" mark for the quick fix. Saved when a full fix ends
 * (its start time) and when a quick fix ends; the quick fix then looks only at
 * rows changed since (every structure table stamps updated_at on insert and
 * update, SQL imports included).
 */
export const COUNTS_CHECKED_AT_KEY = 'structure_counts_checked_at';

async function dbNow(db: Executor): Promise<string> {
  const [[row]] = await db.query<RowDataPacket[]>("SELECT DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s') AS now");
  return String(row.now);
}

async function saveCheckedAt(db: Executor, at: string | null | undefined) {
  if (!at) return;
  await db.execute(
    `INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
    [COUNTS_CHECKED_AT_KEY, at],
  );
}

async function readCheckedAt(db: Executor): Promise<string | null> {
  const [[row]] = await db.query<RowDataPacket[]>(
    'SELECT setting_value FROM system_settings WHERE setting_key = ? LIMIT 1', [COUNTS_CHECKED_AT_KEY]);
  const v = String(row?.setting_value || '').trim();
  return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(v) ? v : null;
}

/**
 * 10.60 quick fix (the default): one request. Recounts only the subjects
 * that have a lesson, topic, assessment or the subject row itself changed
 * since the last check, plus every subject of a course whose own totals no
 * longer match its subjects (catches a lesson moved between subjects).
 * Rows deleted directly in SQL leave no trace: the full fix covers those.
 * Falls back (needFull) when there is no mark yet or the work would not fit
 * one small request.
 */
export async function quickCountFix(db: Executor, opts: { bumpStamps?: boolean } = {}) {
  if (fixRun && fixRun.expiresAt > Date.now()) throw new CountFixBusyError('Fix counts is already running.');
  const since = await readCheckedAt(db);
  if (!since) return { needFull: true, reason: 'first-run' as const };
  const startedAt = await dbNow(db);
  fixRun = { id: 'quick', expiresAt: Date.now() + FIX_RUN_IDLE_MS, finishRows: 0, bumpStamps: Boolean(opts.bumpStamps), startedAt };
  try {
    let rowsRead = 0;
    // Changed rows since the mark, by small updated_at indexes (index only).
    const changedSubjects = new Set<number>();
    const changedCourses = new Set<number>();
    const pick = async (sql: string) => {
      const [rows] = await db.query<RowDataPacket[]>(sql, [since]);
      rowsRead += rows.length;
      for (const r of rows) {
        if (r.topic_id != null) changedSubjects.add(Number(r.topic_id));
        if (r.course_id != null) changedCourses.add(Number(r.course_id));
      }
    };
    await pick('SELECT topic_id, course_id FROM lessons FORCE INDEX (idx_lessons_updated_scope) WHERE updated_at >= ?');
    await pick('SELECT topic_id, NULL AS course_id FROM subtopics FORCE INDEX (idx_subtopics_updated_scope) WHERE updated_at >= ?');
    await pick('SELECT topic_id, course_id FROM quizzes FORCE INDEX (idx_quizzes_updated_scope) WHERE updated_at >= ?');
    await pick('SELECT id AS topic_id, course_id FROM topics FORCE INDEX (idx_topics_updated_scope) WHERE updated_at >= ?');

    // Courses whose totals no longer match their subjects (courses + topics only).
    const drift = await checkStructureCounts(db);
    for (const issue of drift) changedCourses.add(issue.id);
    if (changedCourses.size) {
      const [subs] = await db.query<RowDataPacket[]>(
        'SELECT id, course_id, lesson_count, subtopic_count, quiz_total FROM topics WHERE course_id IN (?)', [[...changedCourses]]);
      rowsRead += subs.length;
      // A course with drift: all its subjects. A course with only a changed
      // row: just that row's subject (already in changedSubjects).
      const driftCourses = new Set(drift.map((d) => d.id));
      let weight = 0;
      for (const t of subs) {
        if (driftCourses.has(Number(t.course_id))) changedSubjects.add(Number(t.id));
        if (changedSubjects.has(Number(t.id))) weight += Number(t.lesson_count || 0) + Number(t.subtopic_count || 0) + Number(t.quiz_total || 0) + 1;
      }
      if (weight + rowsRead > FIX_REQUEST_ROW_BUDGET * 2) {
        fixRun = null;
        return { needFull: true, reason: 'too-many-changes' as const, changedSubjects: changedSubjects.size };
      }
    }
    const set = await countSet(db, [...changedSubjects]);
    rowsRead += set.rowsRead;
    // Course totals for every touched course, from the (now fixed) subject rows.
    let finish = { fixed: [] as CountIssue[], changed: [] as CountIssue[] };
    const courseIds = new Set<number>([...changedCourses]);
    if (changedSubjects.size) {
      const [owners] = await db.query<RowDataPacket[]>('SELECT DISTINCT course_id FROM topics WHERE id IN (?)', [[...changedSubjects]]);
      for (const o of owners) courseIds.add(Number(o.course_id));
    }
    if (courseIds.size) {
      const [cs] = await db.query<RowDataPacket[]>(
        `SELECT c.id, c.lesson_count, c.subject_count,
           (SELECT COALESCE(SUM(t.lesson_count), 0) FROM topics t WHERE t.course_id = c.id) AS subject_lessons
         FROM courses c WHERE c.id IN (?)`, [[...courseIds]]);
      rowsRead += cs.length;
      finish = await finishCourses(db, cs.map((c) => ({
        id: Number(c.id), lessons: Number(c.subject_lessons || 0),
        expectedLessons: Number(c.lesson_count), expectedSubjects: Number(c.subject_count),
      })), Boolean(opts.bumpStamps));
    } else if (opts.bumpStamps) {
      await db.execute('UPDATE quizzes SET content_stamp = content_stamp + 1');
    }
    await saveCheckedAt(db, startedAt);
    return {
      needFull: false,
      done: true,
      since,
      subjectsChecked: changedSubjects.size,
      coursesChecked: courseIds.size,
      rowsRead,
      fixed: [...set.fixed, ...finish.fixed],
      changed: [...set.changed, ...finish.changed],
    };
  } finally {
    if (fixRun?.id === 'quick') fixRun = null;
  }
}

/** Request 1: plan + first set (+ finish too when everything fits in one request). */
export async function startCountFix(db: Executor, courseId?: number, opts: { bumpStamps?: boolean } = {}) {
  if (fixRun && fixRun.expiresAt > Date.now()) throw new CountFixBusyError('Fix counts is already running.');
  if (cooldownUntil > Date.now()) {
    throw new CountFixBusyError(`Fix counts ran a moment ago. Try again in ${Math.ceil((cooldownUntil - Date.now()) / 1000)} s.`);
  }
  // No ORDER BY: sorting in the database added a temporary-table pass.
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT c.id AS course_id, c.course_title, c.lesson_count, c.subject_count,
            c.quiz_general_total, c.quiz_unfiled_total,
            t.id AS subject_id, t.lesson_count AS subject_lessons, t.subtopic_count AS subject_topics, t.quiz_total AS subject_quizzes
     FROM courses c LEFT JOIN topics t ON t.course_id = c.id
     ${courseId ? 'WHERE c.id = ?' : ''}`,
    courseId ? [courseId] : [],
  );
  rows.sort((a, b) => Number(a.course_id) - Number(b.course_id) || Number(a.subject_id || 0) - Number(b.subject_id || 0));
  const courseMap = new Map<number, FixCourse>();
  const subjects: Array<{ id: number; weight: number }> = [];
  for (const r of rows) {
    const cid = Number(r.course_id);
    if (!courseMap.has(cid)) courseMap.set(cid, { id: cid, name: r.course_title, lessonCount: Number(r.lesson_count), subjectCount: Number(r.subject_count) });
    if (r.subject_id == null) continue;
    // Rows this subject costs: its lessons + topics + assessments + its own row.
    subjects.push({ id: Number(r.subject_id), weight: Number(r.subject_lessons || 0) + Number(r.subject_topics || 0) + Number(r.subject_quizzes || 0) + 1 });
  }
  const courses = [...courseMap.values()];
  const planRows = rows.length + courses.length;
  // Finish reads each course, its subjects (index) and its general / no-subject assessments (index).
  const courseQuizRows = [...new Map(rows.map((r) => [Number(r.course_id), Number(r.quiz_general_total || 0) + Number(r.quiz_unfiled_total || 0)])).values()]
    .reduce((t, n) => t + n, 0);
  const finishRows = courses.length + subjects.length + courseQuizRows;
  const total = subjects.reduce((t, s) => t + s.weight, 0);
  // Fewest requests that fit. Request 1 also carries the plan rows and the last
  // one the finish rows, so their sets get that much less room. Subjects are
  // packed biggest first into the first set with room (order inside a set
  // doesn't matter); if they don't all fit, one more request is added.
  const { sets, finishFitsLast } = packSets(subjects, planRows, finishRows);
  // A whole-site run marks "checked up to" its start time when it ends (10.60).
  const startedAt = courseId ? null : await dbNow(db);
  fixRun = { id: Math.random().toString(36).slice(2) + Date.now().toString(36), expiresAt: Date.now() + FIX_RUN_IDLE_MS, finishRows, bumpStamps: Boolean(opts.bumpStamps), startedAt };
  try {
    const first = await countSet(db, sets[0] || []);
    const remaining = sets.slice(1);
    let finish = null;
    if (!remaining.length && planRows + first.rowsRead + finishRows <= FIX_REQUEST_ROW_BUDGET) {
      finish = await finishCourses(db, courses.map((c) => ({ id: c.id, lessons: first.courseLessons[c.id] || 0, expectedLessons: c.lessonCount, expectedSubjects: c.subjectCount })), fixRun.bumpStamps);
      await saveCheckedAt(db, fixRun.startedAt);
      endRun();
    }
    return {
      runId: fixRun?.id ?? null,
      courses,
      first,
      remaining,
      // Whether the last remaining set can also do the finish in the same request.
      finishWithLast: remaining.length > 0 && finishFitsLast,
      done: Boolean(finish),
      bumpedStamps: Boolean(finish) && Boolean(opts.bumpStamps),
      finish,
    };
  } catch (error) {
    fixRun = null;
    throw error;
  }
}

/** Requests 2…: one set; with `finish`, the course totals too (this set's lessons are added in). */
export async function runCountFixSet(db: Executor, runId: string, subjectIds: number[], finish?: FinishTotals) {
  const run = touchRun(runId);
  const outcome = await countSet(db, subjectIds);
  if (!finish) return { ...outcome, done: false, finish: null };
  try {
    const totals = finish.map((c) => ({ ...c, lessons: Number(c.lessons || 0) + (outcome.courseLessons[Number(c.id)] || 0) }));
    const result = await finishCourses(db, totals, run.bumpStamps);
    await saveCheckedAt(db, run.startedAt);
    return { ...outcome, done: true, finish: result, bumpedStamps: run.bumpStamps };
  } finally {
    endRun();
  }
}

/** Separate finish, only when the last set had no room for it. */
export async function finishCountFix(db: Executor, runId: string, totals: FinishTotals) {
  const run = touchRun(runId);
  try {
    const result = await finishCourses(db, totals, run.bumpStamps);
    await saveCheckedAt(db, run.startedAt);
    return { ...result, done: true, bumpedStamps: run.bumpStamps };
  } finally {
    endRun();
  }
}
