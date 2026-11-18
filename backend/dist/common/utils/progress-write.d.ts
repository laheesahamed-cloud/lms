export declare const TODAY: {
    readonly LESSON: 1;
    readonly EXAM: 2;
    readonly PRACTICE: 4;
    readonly FLASHCARDS: 8;
    readonly ALL: 15;
};
export declare const PRACTICE_XP = 1;
export type RideAlongPractice = {
    n: number;
    day: string;
    passed: boolean;
    kind?: 'day' | 'flash';
};
export declare function parseRideAlong(body: unknown): RideAlongPractice[];
export declare function rememberRideAlong(list: RideAlongPractice[]): void;
export declare function takeRideAlong(): RideAlongPractice[];
export declare function returnRideAlong(): void;
export declare function rideAlongSavedMax(): number;
export declare function rideAlongPending(): boolean;
export declare function progressWrite(day: string, opts?: {
    baseXpSql?: string;
    baseXpParams?: unknown[];
    practices?: RideAlongPractice[];
    captureXp?: boolean;
}): {
    streak: {
        sql: string;
        params: unknown[];
    };
    amount: {
        sql: string;
        params: any[];
    };
    pay: {
        sql: string;
        params: any[];
    };
    seq: {
        sql: string;
        params: unknown[];
    };
};
export declare const DAILY_CAP: 100;
type Exec = {
    execute: (sql: string, params?: any[]) => Promise<any>;
};
export declare function applyProgress(db: Exec, userId: number, day: string): Promise<void>;
export {};
