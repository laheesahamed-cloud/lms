/**
 * Short-lived memory for admin reads that scan the whole question bank (the
 * Questions page counts, quiz/question form dropdowns, the "added per day"
 * charts). Admin screens re-asked the same question on every open; the answer
 * only changes when content is saved.
 *
 * clearAdminReadCache() runs on every content write (see main.ts), so a save
 * shows at once; otherwise entries expire after their TTL. Per process: during
 * a restart overlap the other copy may show an older value for up to the TTL.
 */
const store = new Map<string, { value: unknown; expiresAt: number }>();
const inflight = new Map<string, Promise<unknown>>();
let generation = 0;

export const ADMIN_READ_TTL_MS = 5 * 60 * 1000;

export function cachedAdminRead<T>(key: string, load: () => Promise<T>, ttlMs = ADMIN_READ_TTL_MS): Promise<T> {
  const hit = store.get(key);
  if (hit && hit.expiresAt > Date.now()) return Promise.resolve(hit.value as T);
  const running = inflight.get(key);
  if (running) return running as Promise<T>;
  const startedIn = generation;
  const task = load()
    .then((value) => {
      // A write that landed while this was loading may not be in `value`.
      if (startedIn === generation) {
        if (store.size > 500) store.clear();
        store.set(key, { value, expiresAt: Date.now() + ttlMs });
      }
      return value;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, task);
  return task;
}

export function clearAdminReadCache() {
  generation += 1;
  store.clear();
}

// Write requests under these API paths change what the cached reads show.
const CONTENT_WRITE_PREFIXES = [
  '/api/questions', '/api/quizzes', '/api/lessons', '/api/topics', '/api/subtopics',
  '/api/papers', '/api/courses', '/api/theory-recap',
  '/api/admin', '/api/setup', '/api/users', '/api/plans', '/api/settings',
];

export function isContentWrite(method: string, path: string) {
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return false;
  return CONTENT_WRITE_PREFIXES.some((prefix) => path === prefix || path.startsWith(prefix + '/'));
}
