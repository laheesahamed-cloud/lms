import { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';

/**
 * The planner in ONE row per student (OPTIMIZE 10.12).
 *
 * `study_planner_tasks` keeps one row with category 'plan' per student; its
 * `rule_json` is `{ v: 1, items: PlannerItem[] }`. The generated column
 * `plan_owner` (= user_id on that row, NULL on the old per-item rows) has a
 * UNIQUE key, so the row is found in one index read and every write is one
 * statement on it. Each item is what used to be a row: a saved plan rule
 * (`rule` set) or a task the student typed. The endpoints answer in the old
 * list shape, so the phone, the website and older app builds read it as before.
 */
export type PlannerItem = {
  id: string; // a string so JSON_SEARCH can find it
  title: string;
  description: string;
  dueDate: string; // 'YYYY-MM-DD' or ''
  status: 'todo' | 'done';
  category: string;
  priority: string;
  estimatedMinutes: number | null;
  itemType: string | null;
  itemId: number | null;
  rule: Record<string, unknown> | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export const PLAN_ROW_TITLE = 'Study plan';

/** Parse the plan row's rule_json; anything unreadable is an empty plan. */
export function readPlanItems(raw: unknown): PlannerItem[] {
  if (!raw) return [];
  try {
    const doc = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray((doc as any)?.items) ? ((doc as any).items as PlannerItem[]) : [];
  } catch {
    return [];
  }
}

let lastIdBase = 0;
let lastIdSeq = 0;

/**
 * Ids for new items without reading the row first: seconds since 2025-10-01
 * times 1000 plus a running number. Unique per student in practice (one
 * student's writes are seconds apart), far above the folded old row ids, and
 * small enough for the phone's plan-day ids (id × 100000 stays inside 2^63).
 */
export function newPlannerIds(count: number): string[] {
  const base = Math.max(0, Math.floor(Date.now() / 1000) - 1_759_276_800) * 1000;
  if (base !== lastIdBase) {
    lastIdBase = base;
    lastIdSeq = 0;
  }
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    out.push(String(base + (lastIdSeq % 1000)));
    lastIdSeq++;
  }
  return out;
}

function dateKey(value: unknown): string {
  if (!value) return '';
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(value).slice(0, 10);
}

function stamp(value: unknown): string {
  if (!value) return new Date().toISOString();
  return value instanceof Date ? value.toISOString() : String(value);
}

/** An old per-item row as a plan item (same id, same fields). */
export function rowToItem(row: RowDataPacket): PlannerItem {
  let rule: Record<string, unknown> | null = null;
  if (row.rule_json) {
    try {
      const parsed = JSON.parse(String(row.rule_json));
      rule = parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
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

/**
 * One-time (schema step): every student's old per-item rows become the items
 * of their plan row. The old rows stay where they are (never deleted) and are
 * no longer read. A student who already has a plan row is left alone.
 */
export async function foldPlannerRows(conn: Pool | PoolConnection): Promise<number> {
  const [rows] = await conn.execute<RowDataPacket[]>(
    `SELECT id, user_id, title, description, due_date, status, category, priority, estimated_minutes,
            item_type, item_id, rule_json, sort_order, created_at, updated_at
       FROM study_planner_tasks
      WHERE category <> 'plan'
      ORDER BY user_id, id`,
  );
  const byUser = new Map<number, PlannerItem[]>();
  for (const row of rows) {
    const list = byUser.get(Number(row.user_id)) || [];
    list.push(rowToItem(row));
    byUser.set(Number(row.user_id), list);
  }
  let folded = 0;
  for (const [userId, items] of byUser) {
    const [res] = await conn.execute<any>(
      `INSERT IGNORE INTO study_planner_tasks (user_id, title, status, category, rule_json)
       VALUES (?, ?, 'todo', 'plan', ?)`,
      [userId, PLAN_ROW_TITLE, JSON.stringify({ v: 1, items })],
    );
    if (Number(res?.affectedRows) === 1) folded++;
  }
  return folded;
}
