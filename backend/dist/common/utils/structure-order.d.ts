import { Pool, PoolConnection } from 'mysql2/promise';
export declare const RANK_GAP = 1000;
export type StructureKind = 'course' | 'subject' | 'topic' | 'lesson';
type Executor = Pick<Pool, 'execute' | 'query'> | Pick<PoolConnection, 'execute' | 'query'>;
export declare function isStructureKind(value: unknown): value is StructureKind;
export type MoveResult = {
    ok: true;
    respread: boolean;
} | {
    ok: false;
    reason: 'stale';
};
export declare function moveStructureItem(db: Executor, kind: StructureKind, id: number, aboveId: number | null, belowId: number | null): Promise<MoveResult>;
export declare function respreadGroup(db: Executor, kind: StructureKind, parentValues: unknown[]): Promise<void>;
export declare function convertToGapRanks(conn: PoolConnection, log: (msg: string) => void): Promise<boolean>;
export {};
