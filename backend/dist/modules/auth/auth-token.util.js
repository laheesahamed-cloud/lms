"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ADMIN_SESSION_TTL_DAYS = exports.SESSION_TTL_DAYS = void 0;
exports.extractBearerToken = extractBearerToken;
exports.isValidSessionTokenFormat = isValidSessionTokenFormat;
exports.hashSessionToken = hashSessionToken;
exports.createSessionExpiry = createSessionExpiry;
const crypto_1 = require("crypto");
exports.SESSION_TTL_DAYS = 7;
exports.ADMIN_SESSION_TTL_DAYS = 1;
function extractBearerToken(authorization) {
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : authorization?.trim();
    return token || '';
}
function isValidSessionTokenFormat(token) {
    return /^[a-f0-9]{64}$/i.test(String(token || '').trim());
}
function hashSessionToken(token) {
    return (0, crypto_1.createHash)('sha256').update(token).digest('hex');
}
function createSessionExpiry(ttlDays = exports.SESSION_TTL_DAYS) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + ttlDays);
    return expiresAt;
}
//# sourceMappingURL=auth-token.util.js.map