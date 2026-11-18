"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ADMIN_READ_TTL_MS = void 0;
exports.cachedAdminRead = cachedAdminRead;
exports.clearAdminReadCache = clearAdminReadCache;
exports.isContentWrite = isContentWrite;
const store = new Map();
const inflight = new Map();
let generation = 0;
exports.ADMIN_READ_TTL_MS = 5 * 60 * 1000;
function cachedAdminRead(key, load, ttlMs = exports.ADMIN_READ_TTL_MS) {
    const hit = store.get(key);
    if (hit && hit.expiresAt > Date.now())
        return Promise.resolve(hit.value);
    const running = inflight.get(key);
    if (running)
        return running;
    const startedIn = generation;
    const task = load()
        .then((value) => {
        if (startedIn === generation) {
            if (store.size > 500)
                store.clear();
            store.set(key, { value, expiresAt: Date.now() + ttlMs });
        }
        return value;
    })
        .finally(() => inflight.delete(key));
    inflight.set(key, task);
    return task;
}
function clearAdminReadCache() {
    generation += 1;
    store.clear();
}
const CONTENT_WRITE_PREFIXES = [
    '/api/questions', '/api/quizzes', '/api/lessons', '/api/topics', '/api/subtopics',
    '/api/papers', '/api/courses', '/api/theory-recap',
    '/api/admin', '/api/setup', '/api/users', '/api/plans', '/api/settings',
];
function isContentWrite(method, path) {
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS')
        return false;
    return CONTENT_WRITE_PREFIXES.some((prefix) => path === prefix || path.startsWith(prefix + '/'));
}
//# sourceMappingURL=admin-read-cache.js.map