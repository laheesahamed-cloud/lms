"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PLAN_ROW_TITLE = void 0;
exports.readPlanItems = readPlanItems;
exports.newPlannerIds = newPlannerIds;
exports.rowToItem = rowToItem;
exports.foldPlannerRows = foldPlannerRows;
exports.PLAN_ROW_TITLE = 'Study plan';
function readPlanItems(raw) {
    if (!raw)
        return [];
    try {
        const doc = typeof raw === 'string' ? JSON.parse(raw) : raw;
        return Array.isArray(doc?.items) ? doc.items : [];
    }
    catch {
        return [];
    }
}
let lastIdBase = 0;
let lastIdSeq = 0;
function newPlannerIds(count) {
    const base = Math.max(0, Math.floor(Date.now() / 1000) - 1_759_276_800) * 1000;
    if (base !== lastIdBase) {
        lastIdBase = base;
        lastIdSeq = 0;
    }
    const out = [];
    for (let i = 0; i < count; i++) {
        out.push(String(base + (lastIdSeq % 1000)));
        lastIdSeq++;
    }
    return out;
}
function dateKey(value) {
    if (!value)
        return '';
    if (value instanceof Date) {
        const y = value.getFullYear();
        const m = String(value.getMonth() + 1).padStart(2, '0');
        const d = String(value.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
    return String(value).slice(0, 10);
}
function stamp(value) {
    if (!value)
        return new Date().toISOString();
    return value instanceof Date ? value.toISOString() : String(value);
}
function rowToItem(row) {
    let rule = null;
    if (row.rule_json) {
        try {
            const parsed = JSON.parse(String(row.rule_json));
            rule = parsed && typeof parsed === 'object' ? parsed : null;
        }
        catch {
            rule = null;
        }
    }
    return {
        id: String(row.id),
        title: String(row.title || ''),
        description: String(row.description || ''),
        dueDate: dateKey(row.due_date),
        status: row.status === 'done' ? 'done' : 'todo',
        category: String(row.category || 'general'),
        priority: String(row.priority || 'medium'),
        estimatedMinutes: row.estimated_minutes == null ? null : Number(row.estimated_minutes),
        itemType: row.item_type ? String(row.item_type) : null,
        itemId: row.item_id ? Number(row.item_id) : null,
        rule,
        sortOrder: Number(row.sort_order || 0),
        createdAt: stamp(row.created_at),
        updatedAt: stamp(row.updated_at),
    };
}
async function foldPlannerRows(conn) {
    const [rows] = await conn.execute(`SELECT id, user_id, title, description, due_date, status, category, priority, estimated_minutes,
            item_type, item_id, rule_json, sort_order, created_at, updated_at
       FROM study_planner_tasks
      WHERE category <> 'plan'
      ORDER BY user_id, id`);
    const byUser = new Map();
    for (const row of rows) {
        const list = byUser.get(Number(row.user_id)) || [];
        list.push(rowToItem(row));
        byUser.set(Number(row.user_id), list);
    }
    let folded = 0;
    for (const [userId, items] of byUser) {
        const [res] = await conn.execute(`INSERT IGNORE INTO study_planner_tasks (user_id, title, status, category, rule_json)
       VALUES (?, ?, 'todo', 'plan', ?)`, [userId, exports.PLAN_ROW_TITLE, JSON.stringify({ v: 1, items })]);
        if (Number(res?.affectedRows) === 1)
            folded++;
    }
    return folded;
}
//# sourceMappingURL=planner-doc.js.map