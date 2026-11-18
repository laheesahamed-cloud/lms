import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Signed access tokens (OPTIMIZE 10.2 #1). A short token the server trusts by
 * its signature alone, so protected requests need no session SQL. The long
 * session token stays the renewal token (renewing checks the database once).
 *
 * Format: standard HS256 JWT. Lifetime 1 hour (or less, when the student's
 * access ends sooner). Revocation (sign-out, new sign-in elsewhere, password
 * change, deactivate, delete) is held in this process's memory; after a
 * restart an already-issued token stays valid until it expires (at most 1 h),
 * which was the agreed trade-off. Payments / subscriptions and account /
 * security still check the database on every request.
 */
export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;

export type AccessClaims = {
  sub: number;          // user id
  sid: string;          // hash of the session (renewal) token this was issued from
  role: string;
  st: string;           // account status
  name: string;
  email: string;
  perm: string | null;  // stored permissions (staff only)
  av: string;           // avatar key
  nps: 0 | 1;           // needs profile setup
  acc: unknown;         // student access profile (plan, feature access) at issue time
  iat: number;          // ms
  exp: number;          // seconds (JWT)
};

function secret(): Buffer {
  const configured = String(process.env.ACCESS_TOKEN_SECRET || '').trim();
  if (configured) return Buffer.from(configured);
  const base = String(process.env.SETTINGS_ENCRYPTION_KEY || process.env.ACCOUNT_DELETION_HASH_SECRET || '').trim();
  if (base) return createHash('sha256').update(`access-token:${base}`).digest();
  // No secret configured: tokens only live as long as this process.
  return fallback;
}
const fallback = randomBytes(32);

/** The same signing key, for other short signed tokens (the exam token, 10.16). */
export function signingSecret(): Buffer {
  return secret();
}

const b64 = (v: Buffer | string) => Buffer.from(v).toString('base64url');
const HEADER = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));

export function signAccessToken(claims: Omit<AccessClaims, 'iat' | 'exp'>, maxSeconds = ACCESS_TOKEN_TTL_SECONDS) {
  const now = Date.now();
  const ttl = Math.max(60, Math.min(ACCESS_TOKEN_TTL_SECONDS, Math.floor(maxSeconds)));
  const payload: AccessClaims = { ...claims, iat: now, exp: Math.floor(now / 1000) + ttl };
  const body = `${HEADER}.${b64(JSON.stringify(payload))}`;
  const sig = createHmac('sha256', secret()).update(body).digest('base64url');
  return { token: `${body}.${sig}`, expiresIn: ttl };
}

/** A JWT-shaped bearer (session tokens are 64 hex characters, no dots). */
export function looksLikeAccessToken(token: string) {
  return token.startsWith(`${HEADER}.`) && token.split('.').length === 3;
}

// ---- revocation (this process) ----
const revokedBefore = new Map<number, number>();      // user id → ms
const revokedSessions = new Map<string, number>();    // sid → forget-after ms

export function revokeUserAccess(userId: number) {
  revokedBefore.set(Number(userId), Date.now());
}

export function revokeSessionAccess(sid: string) {
  const now = Date.now();
  if (revokedSessions.size > 5000) for (const [k, until] of revokedSessions) if (until <= now) revokedSessions.delete(k);
  revokedSessions.set(sid, now + ACCESS_TOKEN_TTL_SECONDS * 1000);
}

export type VerifyResult = { ok: true; claims: AccessClaims } | { ok: false; reason: 'invalid' | 'expired' | 'revoked' };

export function verifyAccessToken(token: string): VerifyResult {
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== HEADER) return { ok: false, reason: 'invalid' };
  const expected = createHmac('sha256', secret()).update(`${parts[0]}.${parts[1]}`).digest();
  const given = Buffer.from(parts[2], 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return { ok: false, reason: 'invalid' };
  let claims: AccessClaims;
  try { claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')); } catch { return { ok: false, reason: 'invalid' }; }
  if (!claims || !Number.isInteger(claims.sub) || typeof claims.sid !== 'string') return { ok: false, reason: 'invalid' };
  if (claims.exp * 1000 <= Date.now()) return { ok: false, reason: 'expired' };
  const before = revokedBefore.get(claims.sub);
  if ((before && claims.iat < before) || revokedSessions.has(claims.sid)) return { ok: false, reason: 'revoked' };
  return { ok: true, claims };
}
