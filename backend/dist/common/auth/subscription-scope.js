"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestContext = exports.SCOPE_SQL = void 0;
exports.readScopeRows = readScopeRows;
exports.rememberStudent = rememberStudent;
exports.studentFromRequest = studentFromRequest;
exports.rememberSummaryRow = rememberSummaryRow;
exports.summaryRowFromRequest = summaryRowFromRequest;
exports.requestContextMiddleware = requestContextMiddleware;
exports.rememberTokenScope = rememberTokenScope;
exports.getScopeRows = getScopeRows;
const node_async_hooks_1 = require("node:async_hooks");
exports.SCOPE_SQL = `
  SELECT plans.slug AS plan_slug, us.access_scope, us.course_ids_json, us.lesson_ids_json
  FROM user_subscriptions us
  INNER JOIN plans ON plans.id = us.plan_id
  WHERE us.user_id = ?
    AND us.status = 'active'
    AND us.start_date <= CURDATE()
    AND us.end_date >= CURDATE()
    AND (us.access_expires_at IS NULL OR us.access_expires_at > UTC_TIMESTAMP())`;
async function readScopeRows(db, userId) {
    const [rows] = await db.execute(exports.SCOPE_SQL, [userId]);
    return rows.map((r) => ({
        plan_slug: r.plan_slug ?? null, access_scope: r.access_scope ?? null,
        course_ids_json: r.course_ids_json ?? null, lesson_ids_json: r.lesson_ids_json ?? null,
    }));
}
function rememberStudent(student) {
    const ctx = exports.requestContext.getStore();
    if (ctx && student)
        ctx.student = student;
}
function studentFromRequest() {
    return exports.requestContext.getStore()?.student;
}
function rememberSummaryRow(userId, row) {
    const ctx = exports.requestContext.getStore();
    if (ctx && row)
        ctx.summaryRow = { userId, row };
}
function summaryRowFromRequest(userId) {
    const ctx = exports.requestContext.getStore();
    return ctx?.summaryRow && ctx.summaryRow.userId === Number(userId) ? ctx.summaryRow.row : undefined;
}
exports.requestContext = new node_async_hooks_1.AsyncLocalStorage();
function requestContextMiddleware(_req, _res, next) {
    exports.requestContext.run({}, () => next());
}
function rememberTokenScope(userId, scopeRows) {
    const ctx = exports.requestContext.getStore();
    if (ctx) {
        ctx.userId = userId;
        ctx.scopeRows = Array.isArray(scopeRows) ? scopeRows : null;
    }
}
async function getScopeRows(db, userId) {
    const ctx = exports.requestContext.getStore();
    if (ctx && ctx.userId === Number(userId) && Array.isArray(ctx.scopeRows))
        return ctx.scopeRows;
    return readScopeRows(db, userId);
}
//# sourceMappingURL=subscription-scope.js.map