export declare const ADMIN_READ_TTL_MS: number;
export declare function cachedAdminRead<T>(key: string, load: () => Promise<T>, ttlMs?: number): Promise<T>;
export declare function clearAdminReadCache(): void;
export declare function isContentWrite(method: string, path: string): boolean;
