/**
 * Finished lessons as ONE bitmap per student (OPTIMIZE 10.14), kept in
 * `student_study_summary.lessons_done`: bit n (lowest bit first in each byte)
 * = lesson id n is finished. Keyed by lesson id, never by list position, so
 * adding, hiding or reordering lessons never moves anyone's ticks. Bits only
 * turn on (a finished lesson stays finished). 192 bytes for ids up to 1,534.
 */

/** The bitmap for a list of finished lesson ids. */
export function lessonBits(ids: Iterable<number>): Buffer {
  let max = -1;
  const list: number[] = [];
  for (const raw of ids) {
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0) continue;
    list.push(id);
    if (id > max) max = id;
  }
  const out = Buffer.alloc(max < 0 ? 0 : Math.floor(max / 8) + 1);
  for (const id of list) out[Math.floor(id / 8)] |= 1 << (id % 8);
  return out;
}

/**
 * SQL that sets one lesson's bit in [column], growing the value with zero
 * bytes when the id is past its end — one expression, usable inside the
 * UPDATE that already runs (no read). Params: [byteIndex, mask] in order.
 */
export function setLessonBitSql(column: string): { sql: string; params: (lessonId: number) => number[] } {
  const padded = `IF(LENGTH(COALESCE(${column}, '')) > ?, ${column}, CONCAT(COALESCE(${column}, ''), REPEAT(UNHEX('00'), ? + 1 - LENGTH(COALESCE(${column}, '')))))`;
  return {
    sql: `CONCAT(LEFT(${padded}, ?), UNHEX(LPAD(HEX(ORD(SUBSTRING(${padded}, ? + 1, 1)) | ?), 2, '0')), SUBSTRING(${padded}, ? + 2))`,
    params: (lessonId: number) => {
      const idx = Math.floor(lessonId / 8);
      const mask = 1 << (lessonId % 8);
      // padded(idx, idx), idx | padded(idx, idx), idx, mask | padded(idx, idx), idx
      return [idx, idx, idx, idx, idx, idx, mask, idx, idx, idx];
    },
  };
}

/** Lesson ids whose bit is on. */
export function lessonIdsFromBits(bits: unknown): number[] {
  if (!bits) return [];
  const buf = Buffer.isBuffer(bits) ? bits : Buffer.from(bits as any);
  const out: number[] = [];
  for (let i = 0; i < buf.length; i++) {
    const byte = buf[i];
    if (!byte) continue;
    for (let b = 0; b < 8; b++) if (byte & (1 << b)) out.push(i * 8 + b);
  }
  return out;
}

type Executor = { execute: (sql: string, params?: any[]) => Promise<any> };

/**
 * A student's finished lessons (10.15: the summary row is the one place):
 * 1 row by primary key. Used by every reader that used to count
 * student_lesson_progress rows (website course pages, lesson list, agenda,
 * admin pages, older app builds).
 */
export async function finishedLessons(db: Executor, userId: number): Promise<Set<number>> {
  const [rows] = await db.execute('SELECT lessons_done FROM student_study_summary WHERE user_id = ? LIMIT 1', [userId]);
  return new Set(lessonIdsFromBits(rows?.[0]?.lessons_done));
}

/**
 * SQL that sets the byte at a fixed index of [column] to [valueSql] (which may
 * read the old byte), growing the value with zero bytes when needed — the
 * quiz marks byte map (10.16: byte n = quiz id n). Params: [idx, idx, idx,
 * ...valueParams, idx, idx, idx] in the order returned by params().
 */
export function setByteSql(column: string, valueSql: string): { sql: string; params: (index: number, valueParams: unknown[]) => unknown[] } {
  const padded = `IF(LENGTH(COALESCE(${column}, '')) > ?, ${column}, CONCAT(COALESCE(${column}, ''), REPEAT(UNHEX('00'), ? + 1 - LENGTH(COALESCE(${column}, '')))))`;
  return {
    sql: `CONCAT(LEFT(${padded}, ?), UNHEX(LPAD(HEX(${valueSql}), 2, '0')), SUBSTRING(${padded}, ? + 2))`,
    params: (index: number, valueParams: unknown[]) => [index, index, index, ...valueParams, index, index, index],
  };
}

/** SQL for the old byte at [index] of [column] (0 when past its end). */
export function oldByteSql(column: string): string {
  return `IF(LENGTH(COALESCE(${column}, '')) > ?, ORD(SUBSTRING(${column}, ? + 1, 1)), 0)`;
}

/** The byte map as { quizId: byte } for the non-zero entries. */
export function bytesFromMap(bits: unknown): Map<number, number> {
  const out = new Map<number, number>();
  if (!bits) return out;
  const buf = Buffer.isBuffer(bits) ? bits : Buffer.from(bits as any);
  for (let i = 0; i < buf.length; i++) if (buf[i]) out.set(i, buf[i]);
  return out;
}
