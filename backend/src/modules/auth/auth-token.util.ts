import { createHash } from 'crypto';

export const SESSION_TTL_DAYS = 7;

export function extractBearerToken(authorization?: string) {
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : authorization?.trim();
  return token || '';
}

export function hashSessionToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function createSessionExpiry(ttlDays = SESSION_TTL_DAYS) {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + ttlDays);
  return expiresAt;
}

