import { AsyncLocalStorage } from 'node:async_hooks';
import { RowDataPacket } from 'mysql2/promise';

/**
 * The student's active subscription scopes, as the services read them
 * (plan_slug, access_scope, course_ids_json, lesson_ids_json, one entry per
 * active subscription). Read once when the signed access token is issued and
 * carried in it, so content screens need no subscription SQL per request; each
 * service still applies its own rule to these rows, exactly as before.
 * Requests without a signed token (older app, website) read the database.
 */
export type ScopeRow = { plan_slug: string | null; access_scope: string | null; course_ids_json: string | null; lesson_ids_json: string | null };

type Executor = { execute: (sql: string, params?: any[]) => Promise<any> };

export const SCOPE_SQL = `
  SELECT plans.slug AS plan_slug, us.access_scope, us.course_ids_json, us.lesson_ids_json
  FROM user_subscriptions us
  INNER JOIN plans ON plans.id = us.plan_id
  WHERE us.user_id = ?
    AND us.status = 'active'
    AND us.start_date <= CURDATE()
    AND us.end_date >= CURDATE()
    AND (us.access_expires_at IS NULL OR us.access_expires_at > UTC_TIMESTAMP())`;

export async function readScopeRows(db: Executor, userId: number): Promise<ScopeRow[]> {
  const [rows] = await db.execute(SCOPE_SQL, [userId]) as [RowDataPacket[]];
  return rows.map((r) => ({
    plan_slug: r.plan_slug ?? null, access_scope: r.access_scope ?? null,
    course_ids_json: r.course_ids_json ?? null, lesson_ids_json: r.lesson_ids_json ?? null,
  }));
}

// ---- per-request context (set when a signed token is verified) ----
type RequestContext = { userId?: number; scopeRows?: ScopeRow[] | null; summaryRow?: { userId: number; row: Record<string, unknown> }; student?: any };

/**
 * The student the API boundary already resolved for THIS request (10.16-W):
 * services reuse it instead of looking the session up again.
 */
export function rememberStudent(student: any) {
  const ctx = requestContext.getStore();
  if (ctx && student) ctx.student = student;
}

export function studentFromRequest(): any {
  return requestContext.getStore()?.student;
}

/**
 * The student's summary row as already read in THIS request (OPTIMIZE 10.17):
 * the Study Hub read carries the progress columns too, so the progress part of
 * the same reply (sign-in / start-up) reuses it instead of reading it again.
 */
export function rememberSummaryRow(userId: number, row: Record<string, unknown> | undefined) {
  const ctx = requestContext.getStore();
  if (ctx && row) ctx.summaryRow = { userId, row };
}

export function summaryRowFromRequest(userId: number): Record<string, unknown> | undefined {
  const ctx = requestContext.getStore();
  return ctx?.summaryRow && ctx.summaryRow.userId === Number(userId) ? ctx.summaryRow.row : undefined;
}
export const requestContext = new AsyncLocalStorage<RequestContext>();

/** Express middleware: one context per request. */
export function requestContextMiddleware(_req: any, _res: any, next: any) {
  requestContext.run({}, () => next());
}

export function rememberTokenScope(userId: number, scopeRows: ScopeRow[] | null | undefined) {
  const ctx = requestContext.getStore();
  if (ctx) { ctx.userId = userId; ctx.scopeRows = Array.isArray(scopeRows) ? scopeRows : null; }
}

/** Scope rows for this user: from this request's signed token, else the database. */
export async function getScopeRows<T = ScopeRow>(db: Executor, userId: number): Promise<T[]> {
  const ctx = requestContext.getStore();
  if (ctx && ctx.userId === Number(userId) && Array.isArray(ctx.scopeRows)) return ctx.scopeRows as unknown as T[];
  return readScopeRows(db, userId) as unknown as Promise<T[]>;
}
