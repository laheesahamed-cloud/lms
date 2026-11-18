"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lessonBits = lessonBits;
exports.setLessonBitSql = setLessonBitSql;
exports.lessonIdsFromBits = lessonIdsFromBits;
exports.finishedLessons = finishedLessons;
exports.setByteSql = setByteSql;
exports.oldByteSql = oldByteSql;
exports.bytesFromMap = bytesFromMap;
function lessonBits(ids) {
    let max = -1;
    const list = [];
    for (const raw of ids) {
        const id = Number(raw);
        if (!Number.isInteger(id) || id <= 0)
            continue;
        list.push(id);
        if (id > max)
            max = id;
    }
    const out = Buffer.alloc(max < 0 ? 0 : Math.floor(max / 8) + 1);
    for (const id of list)
        out[Math.floor(id / 8)] |= 1 << (id % 8);
    return out;
}
function setLessonBitSql(column) {
    const padded = `IF(LENGTH(COALESCE(${column}, '')) > ?, ${column}, CONCAT(COALESCE(${column}, ''), REPEAT(UNHEX('00'), ? + 1 - LENGTH(COALESCE(${column}, '')))))`;
    return {
        sql: `CONCAT(LEFT(${padded}, ?), UNHEX(LPAD(HEX(ORD(SUBSTRING(${padded}, ? + 1, 1)) | ?), 2, '0')), SUBSTRING(${padded}, ? + 2))`,
        params: (lessonId) => {
            const idx = Math.floor(lessonId / 8);
            const mask = 1 << (lessonId % 8);
            return [idx, idx, idx, idx, idx, idx, mask, idx, idx, idx];
        },
    };
}
function lessonIdsFromBits(bits) {
    if (!bits)
        return [];
    const buf = Buffer.isBuffer(bits) ? bits : Buffer.from(bits);
    const out = [];
    for (let i = 0; i < buf.length; i++) {
        const byte = buf[i];
        if (!byte)
            continue;
        for (let b = 0; b < 8; b++)
            if (byte & (1 << b))
                out.push(i * 8 + b);
    }
    return out;
}
async function finishedLessons(db, userId) {
    const [rows] = await db.execute('SELECT lessons_done FROM student_study_summary WHERE user_id = ? LIMIT 1', [userId]);
    return new Set(lessonIdsFromBits(rows?.[0]?.lessons_done));
}
function setByteSql(column, valueSql) {
    const padded = `IF(LENGTH(COALESCE(${column}, '')) > ?, ${column}, CONCAT(COALESCE(${column}, ''), REPEAT(UNHEX('00'), ? + 1 - LENGTH(COALESCE(${column}, '')))))`;
    return {
        sql: `CONCAT(LEFT(${padded}, ?), UNHEX(LPAD(HEX(${valueSql}), 2, '0')), SUBSTRING(${padded}, ? + 2))`,
        params: (index, valueParams) => [index, index, index, ...valueParams, index, index, index],
    };
}
function oldByteSql(column) {
    return `IF(LENGTH(COALESCE(${column}, '')) > ?, ORD(SUBSTRING(${column}, ? + 1, 1)), 0)`;
}
function bytesFromMap(bits) {
    const out = new Map();
    if (!bits)
        return out;
    const buf = Buffer.isBuffer(bits) ? bits : Buffer.from(bits);
    for (let i = 0; i < buf.length; i++)
        if (buf[i])
            out.set(i, buf[i]);
    return out;
}
//# sourceMappingURL=lesson-bits.js.map