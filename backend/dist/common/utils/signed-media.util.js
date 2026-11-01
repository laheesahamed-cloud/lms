"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.signMedia = signMedia;
exports.isValidMediaSignature = isValidMediaSignature;
const crypto_1 = require("crypto");
const SIGNATURE_LENGTH = 24;
function secret() {
    return String(process.env.MEDIA_URL_SECRET
        || process.env.SETTINGS_ENCRYPTION_KEY
        || 'lms-dev-media-url-key-change-me');
}
function signMedia(resource) {
    return (0, crypto_1.createHmac)('sha256', secret())
        .update(resource)
        .digest('base64url')
        .slice(0, SIGNATURE_LENGTH);
}
function isValidMediaSignature(resource, signature) {
    if (typeof signature !== 'string' || signature.length !== SIGNATURE_LENGTH)
        return false;
    const expected = Buffer.from(signMedia(resource));
    const given = Buffer.from(signature);
    return expected.length === given.length && (0, crypto_1.timingSafeEqual)(expected, given);
}
//# sourceMappingURL=signed-media.util.js.map