export declare const ACCESS_TOKEN_TTL_SECONDS: number;
export type AccessClaims = {
    sub: number;
    sid: string;
    role: string;
    st: string;
    name: string;
    email: string;
    perm: string | null;
    av: string;
    nps: 0 | 1;
    acc: unknown;
    iat: number;
    exp: number;
};
export declare function signingSecret(): Buffer;
export declare function signAccessToken(claims: Omit<AccessClaims, 'iat' | 'exp'>, maxSeconds?: number): {
    token: string;
    expiresIn: number;
};
export declare function looksLikeAccessToken(token: string): boolean;
export declare function revokeUserAccess(userId: number): void;
export declare function revokeSessionAccess(sid: string): void;
export type VerifyResult = {
    ok: true;
    claims: AccessClaims;
} | {
    ok: false;
    reason: 'invalid' | 'expired' | 'revoked';
};
export declare function verifyAccessToken(token: string): VerifyResult;
