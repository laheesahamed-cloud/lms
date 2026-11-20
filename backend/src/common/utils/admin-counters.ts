import { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';

/**
 * 10.57: stored admin counters, one small table `admin_counters (name, value)`.
 *
 * The admin pages (Admin Hub, Users, Subscriptions, Drugs) read these few rows
 * instead of counting every user / subscription / drug on each open.
 *
 *   users:{role}:{status}               live accounts (deleted_at IS NULL)
 *   subs:{plan_id}:{payment_status}:{status}   subscriptions whose student row exists
 *   drugs:total                         every drug
 *
 * Subscriptions are kept per plan, so "free plan" rules (worked out from the
 * plan's price at read time) can change without the counters going wrong.
 *
 * Every write that can move a count adjusts it in the same request:
 *   - users: bumpUserCounter / moveUserCounter, with the role and status the
 *     code already holds;
 *   - subscriptions: trackSubscriptionChange (reads the rows the write will
 *     touch, by the write's own WHERE, then the same rows by id afterwards)
 *     or countNewSubscription for an INSERT;
 *   - drugs: bumpCounter('drugs:total', ±n).
 * Edits made outside the app (SQL imports, phpMyAdmin) are repaired by
 * rebuildAdminCounters (Structure page → Fix counts runs it at the end).
 */
type Executor = Pick<Pool, 'query'> | Pick<PoolConnection, 'query'>;

export type SubscriptionKeyRow = { plan_id: unknown; payment_status: unknown; status: unknown };

export const subscriptionCounterKey = (row: SubscriptionKeyRow) =>
  `subs:${Number(row.plan_id) || 0}:${String(row.payment_status ?? '')}:${String(row.status ?? '')}`;

/** Add each delta to its counter (one statement; zero deltas skipped). */
export async function bumpCounters(db: Executor, deltas: Map<string, number> | Array<[string, number]>) {
  const rows = [...(deltas instanceof Map ? deltas.entries() : deltas)].filter(([, n]) => n !== 0);
  if (!rows.length) return;
  rows.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)); // one lock order
  await db.query(
    'INSERT INTO admin_counters (name, value) VALUES ? ON DUPLICATE KEY UPDATE value = value + VALUES(value)',
    [rows],
  );
}

export const bumpCounter = (db: Executor, name: string, delta: number) => bumpCounters(db, [[name, delta]]);

export const userCounterKey = (role: unknown, status: unknown) => `users:${String(role ?? '')}:${String(status ?? '')}`;

export const bumpUserCounter = (db: Executor, role: unknown, status: unknown, delta: number) =>
  bumpCounter(db, userCounterKey(role, status), delta);

/** A live user changed role and/or status (no-op when both are unchanged). */
export async function moveUserCounter(
  db: Executor,
  from: { role: unknown; status: unknown },
  to: { role: unknown; status: unknown },
) {
  const a = userCounterKey(from.role, from.status);
  const b = userCounterKey(to.role, to.status);
  if (a === b) return;
  await bumpCounters(db, [[a, -1], [b, 1]]);
}

export const countNewSubscription = (db: Executor, row: SubscriptionKeyRow) =>
  bumpCounter(db, subscriptionCounterKey(row), 1);

/**
 * Run a subscription UPDATE and adjust the counters by exactly the rows it
 * changed. `where`/`params` must select the same rows as the UPDATE's WHERE.
 * Reads: the touched rows before (by that WHERE) and after (by id).
 */
export async function trackSubscriptionChange<T>(
  db: Executor,
  where: string,
  params: unknown[],
  write: () => Promise<T>,
): Promise<T> {
  const [before] = await db.query<RowDataPacket[]>(
    `SELECT id, plan_id, payment_status, status FROM user_subscriptions WHERE ${where}`, params);
  const result = await write();
  if (!before.length) return result;
  const [after] = await db.query<RowDataPacket[]>(
    'SELECT id, plan_id, payment_status, status FROM user_subscriptions WHERE id IN (?)', [before.map((r) => Number(r.id))]);
  const deltas = new Map<string, number>();
  const add = (key: string, n: number) => deltas.set(key, (deltas.get(key) || 0) + n);
  for (const r of before) add(subscriptionCounterKey(r as SubscriptionKeyRow), -1);
  for (const r of after) add(subscriptionCounterKey(r as SubscriptionKeyRow), 1);
  await bumpCounters(db, deltas);
  return result;
}

/** All counters with a prefix ('users:', 'subs:', 'drugs:'), as a Map. */
export async function readCounters(db: Executor, prefix: string) {
  const [rows] = await db.query<RowDataPacket[]>(
    'SELECT name, value FROM admin_counters WHERE name LIKE ?', [`${prefix}%`]);
  return new Map(rows.map((r) => [String(r.name), Number(r.value) || 0]));
}

/** Users by role and status, from the counters (same shape as the old GROUP BY). */
export async function readUserGroups(db: Executor) {
  const map = await readCounters(db, 'users:');
  return [...map.entries()]
    .filter(([, n]) => n !== 0)
    .map(([name, n]) => {
      const [, role, status] = name.split(':');
      return { role, status, n };
    });
}

/** Subscriptions by plan / payment status / status, from the counters. */
export async function readSubscriptionGroups(db: Executor) {
  const map = await readCounters(db, 'subs:');
  return [...map.entries()]
    .filter(([, n]) => n !== 0)
    .map(([name, n]) => {
      const [, planId, paymentStatus, status] = name.split(':');
      return { planId: Number(planId), paymentStatus, status, n };
    });
}

/**
 * Rebuild every counter from the tables (Fix counts, and the schema step that
 * creates the table). Three grouped reads; replaces the whole table.
 */
export async function rebuildAdminCounters(db: Pick<Pool, 'getConnection'>) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const result = await rebuildAdminCountersOn(conn);
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

/** The rebuild itself, on a connection the caller holds (no transaction of its own). */
export async function rebuildAdminCountersOn(conn: Executor) {
  const [users] = await conn.query<RowDataPacket[]>(
    'SELECT role, status, COUNT(*) AS n FROM users WHERE deleted_at IS NULL GROUP BY role, status');
  const [subs] = await conn.query<RowDataPacket[]>(
    `SELECT us.plan_id, us.payment_status, us.status, COUNT(*) AS n
     FROM user_subscriptions us INNER JOIN users student ON student.id = us.user_id
     GROUP BY us.plan_id, us.payment_status, us.status`);
  const [[drugs]] = await conn.query<RowDataPacket[]>('SELECT COUNT(*) AS n FROM drugs');
  const rows: Array<[string, number]> = [
    ...users.map((r) => [userCounterKey(r.role, r.status), Number(r.n)] as [string, number]),
    ...subs.map((r) => [subscriptionCounterKey(r as SubscriptionKeyRow), Number(r.n)] as [string, number]),
    ['drugs:total', Number(drugs?.n || 0)],
  ];
  await conn.query('DELETE FROM admin_counters');
  if (rows.length) await conn.query('INSERT INTO admin_counters (name, value) VALUES ?', [rows]);
  return { counters: rows.length };
}
