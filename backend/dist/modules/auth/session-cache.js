"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SESSION_CACHE_TTL_MS = void 0;
exports.getCachedSession = getCachedSession;
exports.setCachedSession = setCachedSession;
exports.forgetSessionToken = forgetSessionToken;
exports.forgetUserSessions = forgetUserSessions;
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
function forgetSessionToken(tokenHash) {
    cache.delete(tokenHash);
}
function forgetUserSessions(userId) {
    const id = Number(userId);
    for (const [key, entry] of cache) {
        if (entry.userId === id)
            cache.delete(key);
    }
}
//# sourceMappingURL=session-cache.js.map