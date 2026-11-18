import { revokeSessionAccess, revokeUserAccess } from '../../common/auth/access-token';
/**
 * A very short memory of "this session token belongs to this user".
 *
 * Every signed-in request used to look the session up in the database, and many
 * looked it up twice (the API boundary middleware, then the service). On a host
 * that caps connections per account that is a connection per request spent on
 * the same answer. Remembering it for a few seconds removes most of those.
 *
 * Anything that changes or ends a session must call forgetUserSessions /
 * forgetSessionToken so a signed-out or deactivated account stops working at once
 * in this process. The memory is per process: during a restart overlap the other
 * copy may keep an old answer for at most SESSION_CACHE_TTL_MS.
 */
export const SESSION_CACHE_TTL_MS = 10_000;

type Entry = { user: unknown; userId: number; expiresAt: number; resolved?: { value: unknown; scope: unknown } };

const cache = new Map<string, Entry>();

export function getCachedSession<T>(tokenHash: string): T | null {
  const entry = cache.get(tokenHash);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(tokenHash);
    return null;
  }
  return entry.user as T;
}

export function setCachedSession(tokenHash: string, userId: number, user: unknown) {
  if (cache.size > 5000) {
    const now = Date.now();
    for (const [key, entry] of cache) {
      if (entry.expiresAt <= now) cache.delete(key);
    }
  }
  cache.set(tokenHash, { user, userId: Number(userId), expiresAt: Date.now() + SESSION_CACHE_TTL_MS });
}

/**
 * The student as the boundary resolved it (subscription included) and their
 * plan scopes, kept with the session entry for its remaining seconds — so a
 * page's burst of requests reads the subscription once, not per request.
 * Cleared with the session (sign-out, deactivate, password change).
 */
export function getCachedResolved<T>(tokenHash: string): { value: T; scope: unknown } | null {
  const entry = cache.get(tokenHash);
  if (!entry || entry.expiresAt <= Date.now() || !entry.resolved) return null;
  return entry.resolved as { value: T; scope: unknown };
}

export function setCachedResolved(tokenHash: string, value: unknown, scope: unknown) {
  const entry = cache.get(tokenHash);
  if (entry && entry.expiresAt > Date.now()) entry.resolved = { value, scope };
}

export function forgetSessionToken(tokenHash: string) {
  cache.delete(tokenHash);
  // Signed access tokens issued from this session stop working too.
  revokeSessionAccess(tokenHash);
}

export function forgetUserSessions(userId: number) {
  const id = Number(userId);
  // Every signed access token issued to this user before now stops working
  // (sign-in elsewhere, password change, deactivate, delete); the app renews
  // with its session token if that session is still valid.
  revokeUserAccess(id);
  for (const [key, entry] of cache) {
    if (entry.userId === id) cache.delete(key);
  }
}
