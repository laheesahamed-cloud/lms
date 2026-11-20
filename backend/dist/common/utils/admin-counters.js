"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.countNewSubscription = exports.bumpUserCounter = exports.userCounterKey = exports.bumpCounter = exports.subscriptionCounterKey = void 0;
exports.bumpCounters = bumpCounters;
exports.moveUserCounter = moveUserCounter;
exports.trackSubscriptionChange = trackSubscriptionChange;
exports.readCounters = readCounters;
exports.readUserGroups = readUserGroups;
exports.readSubscriptionGroups = readSubscriptionGroups;
exports.rebuildAdminCounters = rebuildAdminCounters;
exports.rebuildAdminCountersOn = rebuildAdminCountersOn;
const subscriptionCounterKey = (row) => `subs:${Number(row.plan_id) || 0}:${String(row.payment_status ?? '')}:${String(row.status ?? '')}`;
exports.subscriptionCounterKey = subscriptionCounterKey;
async function bumpCounters(db, deltas) {
    const rows = [...(deltas instanceof Map ? deltas.entries() : deltas)].filter(([, n]) => n !== 0);
    if (!rows.length)
        return;
    rows.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    await db.query('INSERT INTO admin_counters (name, value) VALUES ? ON DUPLICATE KEY UPDATE value = value + VALUES(value)', [rows]);
}
const bumpCounter = (db, name, delta) => bumpCounters(db, [[name, delta]]);
exports.bumpCounter = bumpCounter;
const userCounterKey = (role, status) => `users:${String(role ?? '')}:${String(status ?? '')}`;
exports.userCounterKey = userCounterKey;
const bumpUserCounter = (db, role, status, delta) => (0, exports.bumpCounter)(db, (0, exports.userCounterKey)(role, status), delta);
exports.bumpUserCounter = bumpUserCounter;
async function moveUserCounter(db, from, to) {
    const a = (0, exports.userCounterKey)(from.role, from.status);
    const b = (0, exports.userCounterKey)(to.role, to.status);
    if (a === b)
        return;
    await bumpCounters(db, [[a, -1], [b, 1]]);
}
const countNewSubscription = (db, row) => (0, exports.bumpCounter)(db, (0, exports.subscriptionCounterKey)(row), 1);
exports.countNewSubscription = countNewSubscription;
async function trackSubscriptionChange(db, where, params, write) {
    const [before] = await db.query(`SELECT id, plan_id, payment_status, status FROM user_subscriptions WHERE ${where}`, params);
    const result = await write();
    if (!before.length)
        return result;
    const [after] = await db.query('SELECT id, plan_id, payment_status, status FROM user_subscriptions WHERE id IN (?)', [before.map((r) => Number(r.id))]);
    const deltas = new Map();
    const add = (key, n) => deltas.set(key, (deltas.get(key) || 0) + n);
    for (const r of before)
        add((0, exports.subscriptionCounterKey)(r), -1);
    for (const r of after)
        add((0, exports.subscriptionCounterKey)(r), 1);
    await bumpCounters(db, deltas);
    return result;
}
async function readCounters(db, prefix) {
    const [rows] = await db.query('SELECT name, value FROM admin_counters WHERE name LIKE ?', [`${prefix}%`]);
    return new Map(rows.map((r) => [String(r.name), Number(r.value) || 0]));
}
async function readUserGroups(db) {
    const map = await readCounters(db, 'users:');
    return [...map.entries()]
        .filter(([, n]) => n !== 0)
        .map(([name, n]) => {
        const [, role, status] = name.split(':');
        return { role, status, n };
    });
}
async function readSubscriptionGroups(db) {
    const map = await readCounters(db, 'subs:');
    return [...map.entries()]
        .filter(([, n]) => n !== 0)
        .map(([name, n]) => {
        const [, planId, paymentStatus, status] = name.split(':');
        return { planId: Number(planId), paymentStatus, status, n };
    });
}
async function rebuildAdminCounters(db) {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const result = await rebuildAdminCountersOn(conn);
        await conn.commit();
        return result;
    }
    catch (error) {
        await conn.rollback();
        throw error;
    }
    finally {
        conn.release();
    }
}
async function rebuildAdminCountersOn(conn) {
    const [users] = await conn.query('SELECT role, status, COUNT(*) AS n FROM users WHERE deleted_at IS NULL GROUP BY role, status');
    const [subs] = await conn.query(`SELECT us.plan_id, us.payment_status, us.status, COUNT(*) AS n
     FROM user_subscriptions us INNER JOIN users student ON student.id = us.user_id
     GROUP BY us.plan_id, us.payment_status, us.status`);
    const [[drugs]] = await conn.query('SELECT COUNT(*) AS n FROM drugs');
    const rows = [
        ...users.map((r) => [(0, exports.userCounterKey)(r.role, r.status), Number(r.n)]),
        ...subs.map((r) => [(0, exports.subscriptionCounterKey)(r), Number(r.n)]),
        ['drugs:total', Number(drugs?.n || 0)],
    ];
    await conn.query('DELETE FROM admin_counters');
    if (rows.length)
        await conn.query('INSERT INTO admin_counters (name, value) VALUES ?', [rows]);
    return { counters: rows.length };
}
//# sourceMappingURL=admin-counters.js.map