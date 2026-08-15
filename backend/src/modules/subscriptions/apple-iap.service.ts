import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { X509Certificate, createHash, createVerify } from 'node:crypto';

/**
 * Verification of Apple StoreKit 2 / App Store Server API JWS payloads.
 *
 * Apple signs every transaction and every server notification as a JWS whose
 * header carries an `x5c` certificate chain. A JWS is trivially decodable by
 * anyone, so decoding it proves nothing — the signature and the chain are what
 * make it trustworthy. This service therefore:
 *
 *   1. verifies the leaf certificate's signature over the JWS,
 *   2. verifies the chain leaf → intermediate → Apple Root CA - G3,
 *   3. verifies the chain terminates at the *pinned* root below, not merely at
 *      some root the OS happens to trust,
 *   4. checks certificate validity windows,
 *   5. only then reads the claims.
 *
 * Uses Node's built-in crypto only — no new dependency, matching how Sign in
 * with Apple is verified elsewhere in this codebase.
 */

/**
 * Apple Root CA - G3, the trust anchor for App Store Server API signatures.
 *
 * Source:  https://www.apple.com/certificateauthority/AppleRootCA-G3.cer
 * Subject: CN=Apple Root CA - G3, OU=Apple Certification Authority, O=Apple Inc., C=US
 * SHA-256: 63:34:3A:BF:B8:9A:6A:03:EB:B5:7E:9B:3F:5F:A7:BE:7C:4F:5C:75:6F:30:17:B3:A8:C4:88:C3:65:3E:91:79
 * Valid:   2014-04-30 → 2039-04-30
 *
 * Pinning this is the whole point: without it an attacker could present a chain
 * signed by any CA and forge purchases.
 */
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

const APPLE_ROOT_CA_G3_SHA256 =
  '63343abfb89a6a03ebb57e9b3f5fa7be7c4f5c756f3017b3a8c488c3653e9179';

/** Only ES256 is accepted; allowing "none" or an RSA downgrade would be fatal. */
const ALLOWED_ALG = 'ES256';

export type AppleEnvironment = 'Production' | 'Sandbox';

/** The subset of JWSTransactionDecodedPayload this app relies on. */
export interface AppleTransaction {
  transactionId: string;
  originalTransactionId: string;
  productId: string;
  bundleId: string;
  environment: AppleEnvironment;
  /** Epoch milliseconds. */
  purchaseDate: number | null;
  expiresDate: number | null;
  revocationDate: number | null;
  revocationReason: number | null;
  type: string;
  appAccountToken: string | null;
}

/** Decoded App Store Server Notification V2 body. */
export interface AppleNotification {
  notificationType: string;
  subtype: string;
  notificationUUID: string;
  bundleId: string;
  environment: AppleEnvironment;
  signedTransactionInfo: string | null;
  signedRenewalInfo: string | null;
}

@Injectable()
export class AppleIapService {
  private readonly logger = new Logger(AppleIapService.name);

  private readonly bundleId = String(process.env.APPLE_IAP_BUNDLE_ID || 'app.xyndrome.lk').trim();

  /**
   * Sandbox receipts must not grant access in production — a tester's free
   * sandbox purchase would otherwise unlock the real app. Off unless explicitly
   * enabled for QA.
   */
  private readonly allowSandbox =
    String(process.env.APPLE_IAP_ALLOW_SANDBOX || '').trim() === '1' ||
    String(process.env.NODE_ENV || '').trim() !== 'production';

  // ─── Public API ────────────────────────────────────────────────────────────

  /** Verify a signed transaction JWS and return its validated claims. */
  verifyTransaction(jws: string): AppleTransaction {
    const payload = this.verifyJws(jws);

    const transactionId = this.str(payload.transactionId);
    const originalTransactionId = this.str(payload.originalTransactionId) || transactionId;
    const productId = this.str(payload.productId);
    const bundleId = this.str(payload.bundleId);

    if (!transactionId || !productId) {
      throw new BadRequestException('Apple transaction is missing required fields.');
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
      revocationReason:
        payload.revocationReason === undefined || payload.revocationReason === null
          ? null
          : Number(payload.revocationReason),
      type: this.str(payload.type),
      appAccountToken: this.str(payload.appAccountToken) || null,
    };
  }

  /** Verify an App Store Server Notification V2 `signedPayload`. */
  verifyNotification(signedPayload: string): AppleNotification {
    const payload = this.verifyJws(signedPayload);
    const data = (payload.data && typeof payload.data === 'object' ? payload.data : {}) as Record<string, unknown>;

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

  /**
   * True when the transaction currently entitles the user to access:
   * not revoked/refunded, and not past its expiry.
   */
  isEntitled(transaction: AppleTransaction, now: number = Date.now()): boolean {
    if (transaction.revocationDate !== null) return false;
    if (transaction.expiresDate === null) return true; // non-expiring product
    return transaction.expiresDate > now;
  }

  /**
   * The pinned trust anchor. Production always uses Apple Root CA - G3; the
   * regression test overrides this in a subclass so the *acceptance* path can be
   * exercised with a locally generated chain. Overriding it never widens trust —
   * it replaces the single anchor rather than adding one.
   */
  protected trustAnchor(): { pem: string; fingerprint: string } {
    return { pem: APPLE_ROOT_CA_G3_PEM, fingerprint: APPLE_ROOT_CA_G3_SHA256 };
  }

  // ─── Signature verification ────────────────────────────────────────────────

  /**
   * Verify a JWS and return its decoded payload. Throws if anything about the
   * signature or certificate chain is wrong. Nothing in the payload is trusted
   * before this succeeds.
   */
  private verifyJws(jws: string): Record<string, any> {
    const token = String(jws || '').trim();
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new UnauthorizedException('Malformed Apple signature.');
    }

    const [encodedHeader, encodedPayload, encodedSignature] = parts;

    const header = this.decodeJson(encodedHeader, 'header');
    if (String(header.alg) !== ALLOWED_ALG) {
      // Blocks both "alg: none" and an algorithm-confusion downgrade.
      throw new UnauthorizedException('Unsupported Apple signature algorithm.');
    }

    const chain = Array.isArray(header.x5c) ? header.x5c.map((entry: unknown) => String(entry)) : [];
    if (chain.length < 2) {
      throw new UnauthorizedException('Apple signature is missing its certificate chain.');
    }

    const certificates = chain.map((der) => this.parseCertificate(der));
    this.verifyChain(certificates);

    const leaf = certificates[0];
    const signature = this.derFromJoseSignature(Buffer.from(encodedSignature, 'base64url'));

    const verifier = createVerify('SHA256');
    verifier.update(`${encodedHeader}.${encodedPayload}`);
    verifier.end();

    // `X509Certificate.publicKey` is already a public KeyObject — do not wrap it.
    if (!verifier.verify(leaf.publicKey, signature)) {
      throw new UnauthorizedException('Apple signature verification failed.');
    }

    return this.decodeJson(encodedPayload, 'payload');
  }

  /**
   * Verify leaf → … → root, where the final certificate must be the pinned
   * Apple Root CA - G3. Each certificate must be signed by the next and be
   * inside its validity window.
   */
  private verifyChain(certificates: X509Certificate[]) {
    const now = new Date();
    const { pem, fingerprint } = this.trustAnchor();
    const root = new X509Certificate(pem);

    for (const certificate of certificates) {
      if (new Date(certificate.validFrom) > now || new Date(certificate.validTo) < now) {
        throw new UnauthorizedException('Apple certificate chain contains an expired certificate.');
      }
    }

    for (let index = 0; index < certificates.length - 1; index += 1) {
      if (!certificates[index].verify(certificates[index + 1].publicKey)) {
        throw new UnauthorizedException('Apple certificate chain is not internally consistent.');
      }
    }

    // Pin: the presented root must be byte-identical to Apple Root CA - G3, and
    // must actually have signed the certificate below it.
    const presentedRoot = certificates[certificates.length - 1];
    if (this.fingerprint(presentedRoot) !== fingerprint) {
      throw new UnauthorizedException('Apple certificate chain does not terminate at the expected root.');
    }
    if (!presentedRoot.verify(root.publicKey)) {
      throw new UnauthorizedException('Apple root certificate failed self-verification.');
    }
  }

  private parseCertificate(base64Der: string): X509Certificate {
    try {
      return new X509Certificate(Buffer.from(base64Der, 'base64'));
    } catch {
      throw new UnauthorizedException('Apple certificate chain could not be parsed.');
    }
  }

  private fingerprint(certificate: X509Certificate): string {
    return createHash('sha256').update(certificate.raw).digest('hex');
  }

  /**
   * JWS ES256 signatures are the raw `r || s` pair; Node's verifier expects
   * DER. Convert, rejecting anything that isn't a 64-byte P-256 signature.
   */
  private derFromJoseSignature(signature: Buffer): Buffer {
    if (signature.length !== 64) {
      throw new UnauthorizedException('Apple signature has an unexpected length.');
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

  /** Strip leading zeros, then re-add one if the high bit would read negative. */
  private trimInteger(value: Buffer): Buffer {
    let start = 0;
    while (start < value.length - 1 && value[start] === 0) start += 1;
    const trimmed = value.subarray(start);
    return trimmed[0] & 0x80 ? Buffer.concat([Buffer.from([0x00]), trimmed]) : trimmed;
  }

  // ─── Claim checks ──────────────────────────────────────────────────────────

  private assertBundleId(bundleId: string) {
    if (bundleId !== this.bundleId) {
      // A validly-signed transaction from a *different* app must never grant
      // access here.
      this.logger.warn(`Rejected Apple payload for foreign bundle id "${bundleId}".`);
      throw new UnauthorizedException('Apple payload is for a different app.');
    }
  }

  private assertEnvironment(environment: string): AppleEnvironment {
    if (environment === 'Production') return 'Production';
    if (environment === 'Sandbox') {
      if (!this.allowSandbox) {
        this.logger.warn('Rejected a Sandbox Apple payload in production.');
        throw new UnauthorizedException('Sandbox purchases are not accepted here.');
      }
      return 'Sandbox';
    }
    throw new UnauthorizedException('Apple payload has an unknown environment.');
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private decodeJson(segment: string, label: string): Record<string, any> {
    try {
      const parsed = JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
      if (!parsed || typeof parsed !== 'object') throw new Error('not an object');
      return parsed as Record<string, any>;
    } catch {
      throw new UnauthorizedException(`Apple ${label} could not be decoded.`);
    }
  }

  private str(value: unknown): string {
    return value === undefined || value === null ? '' : String(value).trim();
  }

  /** Apple sends timestamps as epoch milliseconds. */
  private epoch(value: unknown): number | null {
    if (value === undefined || value === null || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }
}
