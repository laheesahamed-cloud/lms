"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RANK_GAP = void 0;
exports.isStructureKind = isStructureKind;
exports.moveStructureItem = moveStructureItem;
exports.respreadGroup = respreadGroup;
exports.convertToGapRanks = convertToGapRanks;
exports.RANK_GAP = 1000;
const LEVELS = {
    course: { table: 'courses', parent: [] },
    subject: { table: 'topics', parent: ['course_id'] },
    topic: { table: 'subtopics', parent: ['topic_id'] },
    lesson: { table: 'lessons', parent: ['topic_id', 'subtopic_id'] },
};
function isStructureKind(value) {
    return typeof value === 'string' && Object.prototype.hasOwnProperty.call(LEVELS, value);
}
function sameParent(kind, alias) {
    const cols = LEVELS[kind].parent;
    return cols.length ? cols.map((c) => `${alias}.${c} <=> x.${c}`).join(' AND ') : '1 = 1';
}
async function moveStructureItem(db, kind, id, aboveId, belowId) {
    const first = await tryMove(db, kind, id, aboveId, belowId);
    if (first)
        return { ok: true, respread: false };
    const ids = [id, aboveId, belowId].filter((v) => v != null);
    const cols = LEVELS[kind].parent;
    const [rows] = await db.execute(`SELECT id${cols.length ? `, ${cols.join(', ')}` : ''} FROM ${LEVELS[kind].table} WHERE id IN (${ids.map(() => '?').join(', ')})`, ids);
    if (rows.length !== ids.length)
        return { ok: false, reason: 'stale' };
    const self = rows.find((r) => Number(r.id) === id);
    const sameGroup = rows.every((r) => cols.every((c) => String(r[c] ?? '') === String(self[c] ?? '')));
    if (!sameGroup)
        return { ok: false, reason: 'stale' };
    await respreadGroup(db, kind, cols.map((c) => self[c] ?? null));
    const second = await tryMove(db, kind, id, aboveId, belowId);
    return second ? { ok: true, respread: true } : { ok: false, reason: 'stale' };
}
async function tryMove(db, kind, id, aboveId, belowId) {
    const t = LEVELS[kind].table;
    let sql;
    let params;
    if (aboveId != null && belowId != null) {
        sql = `UPDATE ${t} x
      JOIN ${t} a ON a.id = ?
      JOIN ${t} b ON b.id = ?
      SET x.sort_order = a.sort_order + ((b.sort_order - a.sort_order) DIV 2)
      WHERE x.id = ? AND ${sameParent(kind, 'a')} AND ${sameParent(kind, 'b')}
        AND b.sort_order - a.sort_order > 1`;
        params = [aboveId, belowId, id];
    }
    else if (belowId != null) {
        sql = `UPDATE ${t} x JOIN ${t} b ON b.id = ?
      SET x.sort_order = b.sort_order - ${exports.RANK_GAP}
      WHERE x.id = ? AND ${sameParent(kind, 'b')}`;
        params = [belowId, id];
    }
    else if (aboveId != null) {
        sql = `UPDATE ${t} x JOIN ${t} a ON a.id = ?
      SET x.sort_order = a.sort_order + ${exports.RANK_GAP}
      WHERE x.id = ? AND ${sameParent(kind, 'a')}`;
        params = [aboveId, id];
    }
    else {
        return false;
    }
    const [result] = await db.execute(sql, params);
    return result.affectedRows > 0;
}
async function respreadGroup(db, kind, parentValues) {
    const { table, parent } = LEVELS[kind];
    const where = parent.length ? `WHERE ${parent.map((c) => `${c} <=> ?`).join(' AND ')}` : '';
    await db.execute(`UPDATE ${table} z
     JOIN (SELECT id, ROW_NUMBER() OVER (ORDER BY sort_order, id) AS rn FROM ${table} ${where}) r ON r.id = z.id
     SET z.sort_order = r.rn * ${exports.RANK_GAP}`, parentValues);
}
async function convertToGapRanks(conn, log) {
    const visible = "l.is_public = 1 AND l.engine_key = 'gemini'";
    const hasTopic = 'l.subtopic_id IS NOT NULL AND EXISTS (SELECT 1 FROM subtopics s2 WHERE s2.id = l.subtopic_id)';
    const [before] = await conn.query(`SELECT l.id FROM lessons l WHERE ${visible} AND ${hasTopic} ORDER BY l.course_id, l.sort_order, l.id`);
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
      SET z.sort_order = r.rn * ${exports.RANK_GAP}`);
        await conn.query(`
      UPDATE topics z
      JOIN (SELECT id, ROW_NUMBER() OVER (PARTITION BY course_id ORDER BY sort_order, id) AS rn FROM topics) r ON r.id = z.id
      SET z.sort_order = r.rn * ${exports.RANK_GAP}`);
        await conn.query(`
      UPDATE courses z
      JOIN (SELECT id, ROW_NUMBER() OVER (ORDER BY sort_order, id) AS rn FROM courses) r ON r.id = z.id
      SET z.sort_order = r.rn * ${exports.RANK_GAP}`);
        await conn.query(`
      UPDATE lessons z
      JOIN (SELECT id, ROW_NUMBER() OVER (PARTITION BY topic_id, subtopic_id ORDER BY sort_order, id) AS rn FROM lessons) r ON r.id = z.id
      SET z.sort_order = r.rn * ${exports.RANK_GAP}`);
        const [after] = await conn.query(`SELECT l.id FROM lessons l
       LEFT JOIN topics t ON t.id = l.topic_id
       LEFT JOIN subtopics s ON s.id = l.subtopic_id
       WHERE ${visible} AND ${hasTopic}
       ORDER BY l.course_id, t.sort_order, t.id, s.sort_order, s.id, l.sort_order, l.id`);
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
    }
    catch (error) {
        await conn.rollback().catch(() => undefined);
        throw error;
    }
}
//# sourceMappingURL=structure-order.js.map