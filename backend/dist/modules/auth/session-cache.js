"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SESSION_CACHE_TTL_MS = void 0;
exports.getCachedSession = getCachedSession;
exports.setCachedSession = setCachedSession;
exports.getCachedResolved = getCachedResolved;
exports.setCachedResolved = setCachedResolved;
exports.forgetSessionToken = forgetSessionToken;
exports.forgetUserSessions = forgetUserSessions;
const access_token_1 = require("../../common/auth/access-token");
exports.SESSION_CACHE_TTL_MS = 10_000;
const cache = new Map();
function getCachedSession(tokenHash) {
    const entry = cache.get(tokenHash);
    if (!entry)
        return null;
    if (entry.expiresAt <= Date.now()) {
        cache.delete(tokenHash);
        return null;
    }
    return entry.user;
}
function setCachedSession(tokenHash, userId, user) {
    if (cache.size > 5000) {
        const now = Date.now();
        for (const [key, entry] of cache) {
            if (entry.expiresAt <= now)
                cache.delete(key);
        }
    }
    cache.set(tokenHash, { user, userId: Number(userId), expiresAt: Date.now() + exports.SESSION_CACHE_TTL_MS });
}
function getCachedResolved(tokenHash) {
    const entry = cache.get(tokenHash);
    if (!entry || entry.expiresAt <= Date.now() || !entry.resolved)
        return null;
    return entry.resolved;
}
function setCachedResolved(tokenHash, value, scope) {
    const entry = cache.get(tokenHash);
    if (entry && entry.expiresAt > Date.now())
        entry.resolved = { value, scope };
}
function forgetSessionToken(tokenHash) {
    cache.delete(tokenHash);
    (0, access_token_1.revokeSessionAccess)(tokenHash);
}
function forgetUserSessions(userId) {
    const id = Number(userId);
    (0, access_token_1.revokeUserAccess)(id);
    for (const [key, entry] of cache) {
        if (entry.userId === id)
            cache.delete(key);
    }
}
//# sourceMappingURL=session-cache.js.map