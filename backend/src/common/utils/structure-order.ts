import { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

/**
 * Gap-based order for the admin Structure page.
 *
 * Every level is ordered inside its own parent, with ranks spaced RANK_GAP apart
 * (1000, 2000, 3000…):
 *   courses   — the whole list
 *   subjects  — `topics`, inside their course
 *   topics    — `subtopics`, inside their subject
 *   lessons   — inside their topic (topic_id + subtopic_id)
 *
 * Moving an item between two neighbours gives it the rank halfway between
 * theirs: ONE statement that reads the two neighbours by id and changes the one
 * moved row. Lessons in different topics may share a rank; every read looks
 * inside one parent first, and ties are broken by id.
 *
 * When two neighbours have no whole number left between them, only that one
 * parent's items are respread back to RANK_GAP spacing (same order), then the
 * move is retried once.
 */
export const RANK_GAP = 1000;

export type StructureKind = 'course' | 'subject' | 'topic' | 'lesson';

type Executor = Pick<Pool, 'execute' | 'query'> | Pick<PoolConnection, 'execute' | 'query'>;

const LEVELS: Record<StructureKind, { table: string; parent: string[] }> = {
  course: { table: 'courses', parent: [] },
  subject: { table: 'topics', parent: ['course_id'] },
  topic: { table: 'subtopics', parent: ['topic_id'] },
  lesson: { table: 'lessons', parent: ['topic_id', 'subtopic_id'] },
};

export function isStructureKind(value: unknown): value is StructureKind {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(LEVELS, value);
}

/** `a.course_id <=> x.course_id AND …` — the neighbour is in the moved item's parent. */
function sameParent(kind: StructureKind, alias: string) {
  const cols = LEVELS[kind].parent;
  return cols.length ? cols.map((c) => `${alias}.${c} <=> x.${c}`).join(' AND ') : '1 = 1';
}

export type MoveResult =
  | { ok: true; respread: boolean }
  | { ok: false; reason: 'stale' };

/**
 * Put `id` between `aboveId` (the item that will sit just above it) and
 * `belowId` (just below). Either neighbour may be null for the top or bottom.
 *
 * Normal case: 1 statement, 3 rows examined (2 at the top or bottom), 1 changed.
 * The statement locks the rows it reads, so two moves at the same moment both
 * land; neither is lost.
 */
export async function moveStructureItem(
  db: Executor,
  kind: StructureKind,
  id: number,
  aboveId: number | null,
  belowId: number | null,
): Promise<MoveResult> {
  const first = await tryMove(db, kind, id, aboveId, belowId);
  if (first) return { ok: true, respread: false };

  // Nothing changed: either the neighbours are no longer in this item's parent
  // (the admin's screen is out of date), or there is no rank left between them.
  const ids = [id, aboveId, belowId].filter((v): v is number => v != null);
  const cols = LEVELS[kind].parent;
  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT id${cols.length ? `, ${cols.join(', ')}` : ''} FROM ${LEVELS[kind].table} WHERE id IN (${ids.map(() => '?').join(', ')})`,
    ids,
  );
  if (rows.length !== ids.length) return { ok: false, reason: 'stale' };
  const self = rows.find((r) => Number(r.id) === id)!;
  const sameGroup = rows.every((r) => cols.every((c) => String(r[c] ?? '') === String(self[c] ?? '')));
  if (!sameGroup) return { ok: false, reason: 'stale' };

  await respreadGroup(db, kind, cols.map((c) => self[c] ?? null));
  const second = await tryMove(db, kind, id, aboveId, belowId);
  return second ? { ok: true, respread: true } : { ok: false, reason: 'stale' };
}

async function tryMove(db: Executor, kind: StructureKind, id: number, aboveId: number | null, belowId: number | null) {
  const t = LEVELS[kind].table;
  let sql: string;
  let params: number[];
  if (aboveId != null && belowId != null) {
    sql = `UPDATE ${t} x
      JOIN ${t} a ON a.id = ?
      JOIN ${t} b ON b.id = ?
      SET x.sort_order = a.sort_order + ((b.sort_order - a.sort_order) DIV 2)
      WHERE x.id = ? AND ${sameParent(kind, 'a')} AND ${sameParent(kind, 'b')}
        AND b.sort_order - a.sort_order > 1`;
    params = [aboveId, belowId, id];
  } else if (belowId != null) {
    // Top of the list: one gap above the first item.
    sql = `UPDATE ${t} x JOIN ${t} b ON b.id = ?
      SET x.sort_order = b.sort_order - ${RANK_GAP}
      WHERE x.id = ? AND ${sameParent(kind, 'b')}`;
    params = [belowId, id];
  } else if (aboveId != null) {
    // Bottom of the list: one gap below the last item.
    sql = `UPDATE ${t} x JOIN ${t} a ON a.id = ?
      SET x.sort_order = a.sort_order + ${RANK_GAP}
      WHERE x.id = ? AND ${sameParent(kind, 'a')}`;
    params = [aboveId, id];
  } else {
    return false;
  }
  const [result] = await db.execute<ResultSetHeader>(sql, params);
  return result.affectedRows > 0;
}

/** Respread one parent's items to RANK_GAP spacing, keeping their order. One statement. */
export async function respreadGroup(db: Executor, kind: StructureKind, parentValues: unknown[]) {
  const { table, parent } = LEVELS[kind];
  const where = parent.length ? `WHERE ${parent.map((c) => `${c} <=> ?`).join(' AND ')}` : '';
  await db.execute(
    `UPDATE ${table} z
     JOIN (SELECT id, ROW_NUMBER() OVER (ORDER BY sort_order, id) AS rn FROM ${table} ${where}) r ON r.id = z.id
     SET z.sort_order = r.rn * ${RANK_GAP}`,
    parentValues as any[],
  );
}

/**
 * One-time conversion to per-parent gap ranks, in the order students see today.
 *
 * Today's lesson order is flat across a course; topic headings are worked out
 * from where a lesson's topic changes. From now on topics are ordered by their
 * own rank, so each topic is first ranked where its first visible lesson sits
 * (topics with no visible lesson keep their current place after those).
 *
 * The visible order of every course is compared before and after. If anything
 * would move, everything is rolled back and nothing changes.
 */
export async function convertToGapRanks(conn: PoolConnection, log: (msg: string) => void) {
  const visible = "l.is_public = 1 AND l.engine_key = 'gemini'";
  // Lessons whose topic is missing are shown as a "No topic" group and are left
  // out of the comparison (their place was never well defined).
  const hasTopic = 'l.subtopic_id IS NOT NULL AND EXISTS (SELECT 1 FROM subtopics s2 WHERE s2.id = l.subtopic_id)';
  const [before] = await conn.query<RowDataPacket[]>(
    `SELECT l.id FROM lessons l WHERE ${visible} AND ${hasTopic} ORDER BY l.course_id, l.sort_order, l.id`,
  );

  await conn.beginTransaction();
  try {
    await conn.query(`
      UPDATE subtopics z
      JOIN (
        SELECT s.id, ROW_NUMBER() OVER (
          PARTITION BY s.topic_id ORDER BY (f.first_rank IS NULL), f.first_rank, s.sort_order, s.id
        ) AS rn
        FROM subtopics s
        LEFT JOIN (
          SELECT l.subtopic_id, MIN(l.sort_order) AS first_rank
          FROM lessons l WHERE ${visible} AND l.subtopic_id IS NOT NULL
          GROUP BY l.subtopic_id
        ) f ON f.subtopic_id = s.id
      ) r ON r.id = z.id
      SET z.sort_order = r.rn * ${RANK_GAP}`);
    await conn.query(`
      UPDATE topics z
      JOIN (SELECT id, ROW_NUMBER() OVER (PARTITION BY course_id ORDER BY sort_order, id) AS rn FROM topics) r ON r.id = z.id
      SET z.sort_order = r.rn * ${RANK_GAP}`);
    await conn.query(`
      UPDATE courses z
      JOIN (SELECT id, ROW_NUMBER() OVER (ORDER BY sort_order, id) AS rn FROM courses) r ON r.id = z.id
      SET z.sort_order = r.rn * ${RANK_GAP}`);
    await conn.query(`
      UPDATE lessons z
      JOIN (SELECT id, ROW_NUMBER() OVER (PARTITION BY topic_id, subtopic_id ORDER BY sort_order, id) AS rn FROM lessons) r ON r.id = z.id
      SET z.sort_order = r.rn * ${RANK_GAP}`);

    const [after] = await conn.query<RowDataPacket[]>(
      `SELECT l.id FROM lessons l
       LEFT JOIN topics t ON t.id = l.topic_id
       LEFT JOIN subtopics s ON s.id = l.subtopic_id
       WHERE ${visible} AND ${hasTopic}
       ORDER BY l.course_id, t.sort_order, t.id, s.sort_order, s.id, l.sort_order, l.id`,
    );
    const same = before.length === after.length && before.every((r, i) => Number(r.id) === Number(after[i].id));
    if (!same) {
      await conn.rollback();
      const firstDiff = before.findIndex((r, i) => Number(r.id) !== Number(after[i]?.id));
      log(`gap ranks NOT applied: the visible lesson order would change (first difference at lesson ${before[firstDiff]?.id}). Nothing was changed.`);
      return false;
    }
    await conn.commit();
    log(`gap ranks applied; visible order of ${after.length} lessons unchanged.`);
    return true;
  } catch (error) {
    await conn.rollback().catch(() => undefined);
    throw error;
  }
}
