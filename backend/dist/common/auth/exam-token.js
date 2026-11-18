"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.newExamNonce = newExamNonce;
exports.signExamToken = signExamToken;
exports.verifyExamToken = verifyExamToken;
const node_crypto_1 = require("node:crypto");
const access_token_1 = require("./access-token");
const b64 = (v) => Buffer.from(v).toString('base64url');
const GRACE_MS = 10 * 60 * 1000;
function newExamNonce() {
    return (0, node_crypto_1.randomBytes)(12).toString('hex');
}
function signExamToken(claims) {
    const body = b64(JSON.stringify(claims));
    const sig = (0, node_crypto_1.createHmac)('sha256', (0, access_token_1.signingSecret)()).update(`exam.${body}`).digest('base64url');
    return `${body}.${sig}`;
}
function verifyExamToken(token, userId, quizId) {
    const raw = String(token || '');
    const dot = raw.indexOf('.');
    if (dot <= 0)
        return null;
    const body = raw.slice(0, dot);
    const sig = raw.slice(dot + 1);
    const want = (0, node_crypto_1.createHmac)('sha256', (0, access_token_1.signingSecret)()).update(`exam.${body}`).digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(want);
    if (a.length !== b.length || !(0, node_crypto_1.timingSafeEqual)(a, b))
        return null;
    try {
        const claims = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
        if (Number(claims.u) !== Number(userId) || Number(claims.q) !== Number(quizId))
            return null;
        if (!Array.isArray(claims.ids) || !claims.n)
            return null;
        if (Date.now() > Number(claims.d) + GRACE_MS)
            return null;
        return claims;
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=exam-token.js.map