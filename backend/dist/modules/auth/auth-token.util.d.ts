export declare const SESSION_TTL_DAYS = 7;
export declare const ADMIN_SESSION_TTL_DAYS = 1;
export declare function extractBearerToken(authorization?: string): string;
export declare function isValidSessionTokenFormat(token: string): boolean;
export declare function hashSessionToken(token: string): string;
export declare function createSessionExpiry(ttlDays?: number): Date;
