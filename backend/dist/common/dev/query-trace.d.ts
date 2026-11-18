export declare const queryTraceEnabled: boolean;
export declare function traceQueries<T extends object>(pool: T): T;
export declare function queryTraceMiddleware(req: any, res: any, next: any): void;
