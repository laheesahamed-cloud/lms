export declare const SESSION_CACHE_TTL_MS = 10000;
export declare function getCachedSession<T>(tokenHash: string): T | null;
export declare function setCachedSession(tokenHash: string, userId: number, user: unknown): void;
export declare function forgetSessionToken(tokenHash: string): void;
export declare function forgetUserSessions(userId: number): void;
