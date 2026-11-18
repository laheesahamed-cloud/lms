"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DAILY_CAP = exports.PRACTICE_XP = exports.TODAY = void 0;
exports.parseRideAlong = parseRideAlong;
exports.rememberRideAlong = rememberRideAlong;
exports.takeRideAlong = takeRideAlong;
exports.returnRideAlong = returnRideAlong;
exports.rideAlongSavedMax = rideAlongSavedMax;
exports.rideAlongPending = rideAlongPending;
exports.progressWrite = progressWrite;
exports.applyProgress = applyProgress;
const subscription_scope_1 = require("../auth/subscription-scope");
const xp_rules_1 = require("../../modules/xp/xp.rules");
const xp_pay_sql_1 = require("../../modules/xp/xp-pay-sql");
const streak_sql_1 = require("../../modules/xp/streak-sql");
exports.TODAY = { LESSON: 1, EXAM: 2, PRACTICE: 4, FLASHCARDS: 8, ALL: 15 };
exports.PRACTICE_XP = 1;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
function parseRideAlong(body) {
    const list = (body && typeof body === 'object' ? body.practices : null);
    if (!Array.isArray(list))
        return [];
    const out = [];
    for (const p of list.slice(0, 200)) {
        const n = Math.trunc(Number(p?.n));
        const day = String(p?.day || '');
        if (!(n > 0) || n > 2_000_000_000 || !DAY.test(day))
            continue;
        if (p?.kind === 'day')
            out.push({ n, day, passed: false, kind: 'day' });
        else if (p?.kind === 'flash')
            out.push({ n, day, passed: false, kind: 'flash' });
        else
            out.push({ n, day, passed: p?.passed === true || p?.passed === 1 });
    }
    return out;
}
function rememberRideAlong(list) {
    const ctx = subscription_scope_1.requestContext.getStore();
    if (ctx) {
        ctx.rideAlong = list;
        ctx.rideAlongApplied = false;
    }
}
function takeRideAlong() {
    const ctx = subscription_scope_1.requestContext.getStore();
    if (!ctx || ctx.rideAlongApplied || !Array.isArray(ctx.rideAlong))
        return [];
    ctx.rideAlongApplied = true;
    return ctx.rideAlong;
}
function returnRideAlong() {
    const ctx = subscription_scope_1.requestContext.getStore();
    if (ctx && Array.isArray(ctx.rideAlong))
        ctx.rideAlongApplied = false;
}
function rideAlongSavedMax() {
    const ctx = subscription_scope_1.requestContext.getStore();
    if (!ctx || !ctx.rideAlongApplied || !Array.isArray(ctx.rideAlong))
        return 0;
    return ctx.rideAlong.reduce((m, p) => Math.max(m, p.n), 0);
}
function rideAlongPending() {
    const ctx = subscription_scope_1.requestContext.getStore();
    return Boolean(ctx && !ctx.rideAlongApplied && Array.isArray(ctx.rideAlong) && ctx.rideAlong.length);
}
function progressWrite(day, opts = {}) {
    const practices = opts.practices || [];
    const marks = practices.filter((p) => p.kind === 'day').sort((a, b) => a.day.localeCompare(b.day));
    const steps = marks.map((m) => (0, streak_sql_1.streakAssignmentsWhen)(m.day, '(? > practice_seq AND (last_active_day IS NULL OR last_active_day < ?))', [m.n, m.day]));
    const streak = steps.length
        ? { sql: steps.map((x) => x.sql).join(',\n          '), params: steps.flatMap((x) => x.params) }
        : { sql: 'streak = streak', params: [] };
    const parts = [];
    const params = [];
    if (opts.baseXpSql) {
        parts.push(`(${opts.baseXpSql})`);
        params.push(...(opts.baseXpParams || []));
    }
    for (const p of practices) {
        if (!p.passed || p.kind)
            continue;
        parts.push('IF(? > practice_seq, ?, 0)');
        params.push(p.n, exports.PRACTICE_XP);
    }
    const baseSql = parts.length ? parts.join(' + ') : '0';
    const amount = (0, xp_pay_sql_1.xpAmountFor)(baseSql, params, day);
    const pay = (0, xp_pay_sql_1.xpPayAssignmentsFor)(baseSql, params, day, opts.captureXp === true);
    const maxN = practices.reduce((m, p) => Math.max(m, p.n), 0);
    const seq = maxN
        ? { sql: 'practice_seq = GREATEST(practice_seq, ?)', params: [maxN] }
        : { sql: 'practice_seq = practice_seq', params: [] };
    return { streak, amount, pay, seq };
}
exports.DAILY_CAP = xp_rules_1.XP.DAILY_CAP;
async function applyProgress(db, userId, day) {
    const practices = takeRideAlong();
    if (!practices.length)
        return;
    const w = progressWrite(day, { practices });
    await db.execute(`INSERT INTO student_study_summary (user_id) VALUES (?)
     ON DUPLICATE KEY UPDATE ${w.streak.sql}, ${w.pay.sql}, ${w.seq.sql}`, [userId, ...w.streak.params, ...w.pay.params, ...w.seq.params]);
}
//# sourceMappingURL=progress-write.js.map