export declare function lessonBits(ids: Iterable<number>): Buffer;
export declare function setLessonBitSql(column: string): {
    sql: string;
    params: (lessonId: number) => number[];
};
export declare function lessonIdsFromBits(bits: unknown): number[];
type Executor = {
    execute: (sql: string, params?: any[]) => Promise<any>;
};
export declare function finishedLessons(db: Executor, userId: number): Promise<Set<number>>;
export declare function setByteSql(column: string, valueSql: string): {
    sql: string;
    params: (index: number, valueParams: unknown[]) => unknown[];
};
export declare function oldByteSql(column: string): string;
export declare function bytesFromMap(bits: unknown): Map<number, number>;
export {};
