"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var AppleIapService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppleIapService = void 0;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
const APPLE_ROOT_CA_G3_PEM = `-----BEGIN CERTIFICATE-----
MIICQzCCAcmgAwIBAgIILcX8iNLFS5UwCgYIKoZIzj0EAwMwZzEbMBkGA1UEAwwS
QXBwbGUgUm9vdCBDQSAtIEczMSYwJAYDVQQLDB1BcHBsZSBDZXJ0aWZpY2F0aW9u
IEF1dGhvcml0eTETMBEGA1UECgwKQXBwbGUgSW5jLjELMAkGA1UEBhMCVVMwHhcN
MTQwNDMwMTgxOTA2WhcNMzkwNDMwMTgxOTA2WjBnMRswGQYDVQQDDBJBcHBsZSBS
b290IENBIC0gRzMxJjAkBgNVBAsMHUFwcGxlIENlcnRpZmljYXRpb24gQXV0aG9y
aXR5MRMwEQYDVQQKDApBcHBsZSBJbmMuMQswCQYDVQQGEwJVUzB2MBAGByqGSM49
AgEGBSuBBAAiA2IABJjpLz1AcqTtkyJygRMc3RCV8cWjTnHcFBbZDuWmBSp3ZHtf
TjjTuxxEtX/1H7YyYl3J6YRbTzBPEVoA/VhYDKX1DyxNB0cTddqXl5dvMVztK517
IDvYuVTZXpmkOlEKMaNCMEAwHQYDVR0OBBYEFLuw3qFYM4iapIqZ3r6966/ayySr
MA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0PAQH/BAQDAgEGMAoGCCqGSM49BAMDA2gA
MGUCMQCD6cHEFl4aXTQY2e3v9GwOAEZLuN+yRhHFD/3meoyhpmvOwgPUnPWTxnS4
at+qIxUCMG1mihDK1A3UT82NQz60imOlM27jbdoXt2QfyFMm+YhidDkLF1vLUagM
6BgD56KyKA==
-----END CERTIFICATE-----`;
const APPLE_ROOT_CA_G3_SHA256 = '63343abfb89a6a03ebb57e9b3f5fa7be7c4f5c756f3017b3a8c488c3653e9179';
const ALLOWED_ALG = 'ES256';
let AppleIapService = AppleIapService_1 = class AppleIapService {
    constructor() {
        this.logger = new common_1.Logger(AppleIapService_1.name);
        this.bundleId = String(process.env.APPLE_IAP_BUNDLE_ID || 'app.xyndrome.lk').trim();
        this.allowSandbox = String(process.env.APPLE_IAP_ALLOW_SANDBOX || '').trim() === '1' ||
            String(process.env.NODE_ENV || '').trim() !== 'production';
    }
    verifyTransaction(jws) {
        const payload = this.verifyJws(jws);
        const transactionId = this.str(payload.transactionId);
        const originalTransactionId = this.str(payload.originalTransactionId) || transactionId;
        const productId = this.str(payload.productId);
        const bundleId = this.str(payload.bundleId);
        if (!transactionId || !productId) {
            throw new common_1.BadRequestException('Apple transaction is missing required fields.');
        }
        this.assertBundleId(bundleId);
        const environment = this.assertEnvironment(this.str(payload.environment));
        return {
            transactionId,
            originalTransactionId,
            productId,
            bundleId,
            environment,
            purchaseDate: this.epoch(payload.purchaseDate),
            expiresDate: this.epoch(payload.expiresDate),
            revocationDate: this.epoch(payload.revocationDate),
            revocationReason: payload.revocationReason === undefined || payload.revocationReason === null
                ? null
                : Number(payload.revocationReason),
            type: this.str(payload.type),
            appAccountToken: this.str(payload.appAccountToken) || null,
        };
    }
    verifyNotification(signedPayload) {
        const payload = this.verifyJws(signedPayload);
        const data = (payload.data && typeof payload.data === 'object' ? payload.data : {});
        const bundleId = this.str(data.bundleId);
        this.assertBundleId(bundleId);
        const environment = this.assertEnvironment(this.str(data.environment));
        return {
            notificationType: this.str(payload.notificationType),
            subtype: this.str(payload.subtype),
            notificationUUID: this.str(payload.notificationUUID),
            bundleId,
            environment,
            signedTransactionInfo: this.str(data.signedTransactionInfo) || null,
            signedRenewalInfo: this.str(data.signedRenewalInfo) || null,
        };
    }
    isEntitled(transaction, now = Date.now()) {
        if (transaction.revocationDate !== null)
            return false;
        if (transaction.expiresDate === null)
            return true;
        return transaction.expiresDate > now;
    }
    trustAnchor() {
        return { pem: APPLE_ROOT_CA_G3_PEM, fingerprint: APPLE_ROOT_CA_G3_SHA256 };
    }
    verifyJws(jws) {
        const token = String(jws || '').trim();
        const parts = token.split('.');
        if (parts.length !== 3) {
            throw new common_1.UnauthorizedException('Malformed Apple signature.');
        }
        const [encodedHeader, encodedPayload, encodedSignature] = parts;
        const header = this.decodeJson(encodedHeader, 'header');
        if (String(header.alg) !== ALLOWED_ALG) {
            throw new common_1.UnauthorizedException('Unsupported Apple signature algorithm.');
        }
        const chain = Array.isArray(header.x5c) ? header.x5c.map((entry) => String(entry)) : [];
        if (chain.length < 2) {
            throw new common_1.UnauthorizedException('Apple signature is missing its certificate chain.');
        }
        const certificates = chain.map((der) => this.parseCertificate(der));
        this.verifyChain(certificates);
        const leaf = certificates[0];
        const signature = this.derFromJoseSignature(Buffer.from(encodedSignature, 'base64url'));
        const verifier = (0, node_crypto_1.createVerify)('SHA256');
        verifier.update(`${encodedHeader}.${encodedPayload}`);
        verifier.end();
        if (!verifier.verify(leaf.publicKey, signature)) {
            throw new common_1.UnauthorizedException('Apple signature verification failed.');
        }
        return this.decodeJson(encodedPayload, 'payload');
    }
    verifyChain(certificates) {
        const now = new Date();
        const { pem, fingerprint } = this.trustAnchor();
        const root = new node_crypto_1.X509Certificate(pem);
        for (const certificate of certificates) {
            if (new Date(certificate.validFrom) > now || new Date(certificate.validTo) < now) {
                throw new common_1.UnauthorizedException('Apple certificate chain contains an expired certificate.');
            }
        }
        for (let index = 0; index < certificates.length - 1; index += 1) {
            if (!certificates[index].verify(certificates[index + 1].publicKey)) {
                throw new common_1.UnauthorizedException('Apple certificate chain is not internally consistent.');
            }
        }
        const presentedRoot = certificates[certificates.length - 1];
        if (this.fingerprint(presentedRoot) !== fingerprint) {
            throw new common_1.UnauthorizedException('Apple certificate chain does not terminate at the expected root.');
        }
        if (!presentedRoot.verify(root.publicKey)) {
            throw new common_1.UnauthorizedException('Apple root certificate failed self-verification.');
        }
    }
    parseCertificate(base64Der) {
        try {
            return new node_crypto_1.X509Certificate(Buffer.from(base64Der, 'base64'));
        }
        catch {
            throw new common_1.UnauthorizedException('Apple certificate chain could not be parsed.');
        }
    }
    fingerprint(certificate) {
        return (0, node_crypto_1.createHash)('sha256').update(certificate.raw).digest('hex');
    }
    derFromJoseSignature(signature) {
        if (signature.length !== 64) {
            throw new common_1.UnauthorizedException('Apple signature has an unexpected length.');
        }
        const r = this.trimInteger(signature.subarray(0, 32));
        const s = this.trimInteger(signature.subarray(32, 64));
        const body = Buffer.concat([
            Buffer.from([0x02, r.length]),
            r,
            Buffer.from([0x02, s.length]),
            s,
        ]);
        return Buffer.concat([Buffer.from([0x30, body.length]), body]);
    }
    trimInteger(value) {
        let start = 0;
        while (start < value.length - 1 && value[start] === 0)
            start += 1;
        const trimmed = value.subarray(start);
        return trimmed[0] & 0x80 ? Buffer.concat([Buffer.from([0x00]), trimmed]) : trimmed;
    }
    assertBundleId(bundleId) {
        if (bundleId !== this.bundleId) {
            this.logger.warn(`Rejected Apple payload for foreign bundle id "${bundleId}".`);
            throw new common_1.UnauthorizedException('Apple payload is for a different app.');
        }
    }
    assertEnvironment(environment) {
        if (environment === 'Production')
            return 'Production';
        if (environment === 'Sandbox') {
            if (!this.allowSandbox) {
                this.logger.warn('Rejected a Sandbox Apple payload in production.');
                throw new common_1.UnauthorizedException('Sandbox purchases are not accepted here.');
            }
            return 'Sandbox';
        }
        throw new common_1.UnauthorizedException('Apple payload has an unknown environment.');
    }
    decodeJson(segment, label) {
        try {
            const parsed = JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
            if (!parsed || typeof parsed !== 'object')
                throw new Error('not an object');
            return parsed;
        }
        catch {
            throw new common_1.UnauthorizedException(`Apple ${label} could not be decoded.`);
        }
    }
    str(value) {
        return value === undefined || value === null ? '' : String(value).trim();
    }
    epoch(value) {
        if (value === undefined || value === null || value === '')
            return null;
        const parsed = Number(value);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    }
};
exports.AppleIapService = AppleIapService;
exports.AppleIapService = AppleIapService = AppleIapService_1 = __decorate([
    (0, common_1.Injectable)()
], AppleIapService);
//# sourceMappingURL=apple-iap.service.js.map