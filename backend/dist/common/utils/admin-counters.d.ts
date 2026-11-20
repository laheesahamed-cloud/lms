import { Pool, PoolConnection } from 'mysql2/promise';
type Executor = Pick<Pool, 'query'> | Pick<PoolConnection, 'query'>;
export type SubscriptionKeyRow = {
    plan_id: unknown;
    payment_status: unknown;
    status: unknown;
};
export declare const subscriptionCounterKey: (row: SubscriptionKeyRow) => string;
export declare function bumpCounters(db: Executor, deltas: Map<string, number> | Array<[string, number]>): Promise<void>;
export declare const bumpCounter: (db: Executor, name: string, delta: number) => Promise<void>;
export declare const userCounterKey: (role: unknown, status: unknown) => string;
export declare const bumpUserCounter: (db: Executor, role: unknown, status: unknown, delta: number) => Promise<void>;
export declare function moveUserCounter(db: Executor, from: {
    role: unknown;
    status: unknown;
}, to: {
    role: unknown;
    status: unknown;
}): Promise<void>;
export declare const countNewSubscription: (db: Executor, row: SubscriptionKeyRow) => Promise<void>;
export declare function trackSubscriptionChange<T>(db: Executor, where: string, params: unknown[], write: () => Promise<T>): Promise<T>;
export declare function readCounters(db: Executor, prefix: string): Promise<Map<string, number>>;
export declare function readUserGroups(db: Executor): Promise<{
    role: string;
    status: string;
    n: number;
}[]>;
export declare function readSubscriptionGroups(db: Executor): Promise<{
    planId: number;
    paymentStatus: string;
    status: string;
    n: number;
}[]>;
export declare function rebuildAdminCounters(db: Pick<Pool, 'getConnection'>): Promise<{
    counters: number;
}>;
export declare function rebuildAdminCountersOn(conn: Executor): Promise<{
    counters: number;
}>;
export {};
