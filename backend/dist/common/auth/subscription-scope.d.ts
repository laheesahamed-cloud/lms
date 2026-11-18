import { AsyncLocalStorage } from 'node:async_hooks';
export type ScopeRow = {
    plan_slug: string | null;
    access_scope: string | null;
    course_ids_json: string | null;
    lesson_ids_json: string | null;
};
type Executor = {
    execute: (sql: string, params?: any[]) => Promise<any>;
};
export declare const SCOPE_SQL = "\n  SELECT plans.slug AS plan_slug, us.access_scope, us.course_ids_json, us.lesson_ids_json\n  FROM user_subscriptions us\n  INNER JOIN plans ON plans.id = us.plan_id\n  WHERE us.user_id = ?\n    AND us.status = 'active'\n    AND us.start_date <= CURDATE()\n    AND us.end_date >= CURDATE()\n    AND (us.access_expires_at IS NULL OR us.access_expires_at > UTC_TIMESTAMP())";
export declare function readScopeRows(db: Executor, userId: number): Promise<ScopeRow[]>;
type RequestContext = {
    userId?: number;
    scopeRows?: ScopeRow[] | null;
    summaryRow?: {
        userId: number;
        row: Record<string, unknown>;
    };
    student?: any;
};
export declare function rememberStudent(student: any): void;
export declare function studentFromRequest(): any;
export declare function rememberSummaryRow(userId: number, row: Record<string, unknown> | undefined): void;
export declare function summaryRowFromRequest(userId: number): Record<string, unknown> | undefined;
export declare const requestContext: AsyncLocalStorage<RequestContext>;
export declare function requestContextMiddleware(_req: any, _res: any, next: any): void;
export declare function rememberTokenScope(userId: number, scopeRows: ScopeRow[] | null | undefined): void;
export declare function getScopeRows<T = ScopeRow>(db: Executor, userId: number): Promise<T[]>;
export {};
