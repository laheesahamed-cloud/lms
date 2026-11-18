"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ACCESS_TOKEN_TTL_SECONDS = void 0;
exports.signingSecret = signingSecret;
exports.signAccessToken = signAccessToken;
exports.looksLikeAccessToken = looksLikeAccessToken;
exports.revokeUserAccess = revokeUserAccess;
exports.revokeSessionAccess = revokeSessionAccess;
exports.verifyAccessToken = verifyAccessToken;
const node_crypto_1 = require("node:crypto");
exports.ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
function secret() {
    const configured = String(process.env.ACCESS_TOKEN_SECRET || '').trim();
    if (configured)
        return Buffer.from(configured);
    const base = String(process.env.SETTINGS_ENCRYPTION_KEY || process.env.ACCOUNT_DELETION_HASH_SECRET || '').trim();
    if (base)
        return (0, node_crypto_1.createHash)('sha256').update(`access-token:${base}`).digest();
    return fallback;
}
const fallback = (0, node_crypto_1.randomBytes)(32);
function signingSecret() {
    return secret();
}
const b64 = (v) => Buffer.from(v).toString('base64url');
const HEADER = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
function signAccessToken(claims, maxSeconds = exports.ACCESS_TOKEN_TTL_SECONDS) {
    const now = Date.now();
    const ttl = Math.max(60, Math.min(exports.ACCESS_TOKEN_TTL_SECONDS, Math.floor(maxSeconds)));
    const payload = { ...claims, iat: now, exp: Math.floor(now / 1000) + ttl };
    const body = `${HEADER}.${b64(JSON.stringify(payload))}`;
    const sig = (0, node_crypto_1.createHmac)('sha256', secret()).update(body).digest('base64url');
    return { token: `${body}.${sig}`, expiresIn: ttl };
}
function looksLikeAccessToken(token) {
    return token.startsWith(`${HEADER}.`) && token.split('.').length === 3;
}
const revokedBefore = new Map();
const revokedSessions = new Map();
function revokeUserAccess(userId) {
    revokedBefore.set(Number(userId), Date.now());
}
function revokeSessionAccess(sid) {
    const now = Date.now();
    if (revokedSessions.size > 5000)
        for (const [k, until] of revokedSessions)
            if (until <= now)
                revokedSessions.delete(k);
    revokedSessions.set(sid, now + exports.ACCESS_TOKEN_TTL_SECONDS * 1000);
}
function verifyAccessToken(token) {
    const parts = token.split('.');
    if (parts.length !== 3 || parts[0] !== HEADER)
        return { ok: false, reason: 'invalid' };
    const expected = (0, node_crypto_1.createHmac)('sha256', secret()).update(`${parts[0]}.${parts[1]}`).digest();
    const given = Buffer.from(parts[2], 'base64url');
    if (given.length !== expected.length || !(0, node_crypto_1.timingSafeEqual)(given, expected))
        return { ok: false, reason: 'invalid' };
    let claims;
    try {
        claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    }
    catch {
        return { ok: false, reason: 'invalid' };
    }
    if (!claims || !Number.isInteger(claims.sub) || typeof claims.sid !== 'string')
        return { ok: false, reason: 'invalid' };
    if (claims.exp * 1000 <= Date.now())
        return { ok: false, reason: 'expired' };
    const before = revokedBefore.get(claims.sub);
    if ((before && claims.iat < before) || revokedSessions.has(claims.sid))
        return { ok: false, reason: 'revoked' };
    return { ok: true, claims };
}
//# sourceMappingURL=access-token.js.map