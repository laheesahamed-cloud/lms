"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getContentVersion = getContentVersion;
exports.onContentVersionChange = onContentVersionChange;
exports.bumpContentVersion = bumpContentVersion;
exports.watchContentVersion = watchContentVersion;
exports.isCatalogueWrite = isCatalogueWrite;
let current = null;
let loading = null;
async function getContentVersion(db) {
    if (current !== null)
        return current;
    if (!loading) {
        loading = db.query("SELECT setting_value FROM system_settings WHERE setting_key = 'content_version' LIMIT 1")
            .then(([rows]) => { current = Number(rows[0]?.setting_value || 1) || 1; return current; })
            .finally(() => { loading = null; });
    }
    return loading;
}
const listeners = [];
function onContentVersionChange(listener) {
    listeners.push(listener);
}
function announce(next) {
    current = next;
    for (const listener of listeners) {
        try {
            listener(next);
        }
        catch { }
    }
}
async function bumpContentVersion(db) {
    await db.query(`INSERT INTO system_settings (setting_key, setting_value) VALUES ('content_version', '2')
     ON DUPLICATE KEY UPDATE setting_value = CAST(setting_value AS UNSIGNED) + 1`);
    const [rows] = await db.query("SELECT setting_value FROM system_settings WHERE setting_key = 'content_version' LIMIT 1");
    const next = Number(rows[0]?.setting_value || 0) || ((current ?? 1) + 1);
    announce(Math.max(next, (current ?? 0) + 1));
}
let watchTimer = null;
function watchContentVersion(db, intervalMs = 30_000) {
    if (watchTimer)
        return;
    watchTimer = setInterval(() => {
        db.query("SELECT setting_value FROM system_settings WHERE setting_key = 'content_version' LIMIT 1")
            .then(([rows]) => {
            const stored = Number(rows[0]?.setting_value || 0);
            if (current !== null && stored > current)
                announce(stored);
        })
            .catch(() => { });
    }, intervalMs);
    watchTimer.unref?.();
}
const CATALOGUE_PREFIXES = [
    '/api/questions', '/api/quizzes', '/api/lessons', '/api/topics', '/api/subtopics',
    '/api/papers', '/api/courses', '/api/plans', '/api/admin',
    '/api/theory-recap',
];
function isCatalogueWrite(method, path) {
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS')
        return false;
    if (/\/student(\/|$)/.test(path))
        return false;
    if (/\/(announcements|notifications|push)(\/|$)/.test(path))
        return false;
    if (/^\/api\/admin\/(users|subscriptions|settings|reports|question-reports|question-review|dashboard|ai)(\/|$)/.test(path))
        return false;
    if (/\/structure\/counts(\/|$)/.test(path))
        return false;
    return CATALOGUE_PREFIXES.some((prefix) => path === prefix || path.startsWith(prefix + '/'));
}
//# sourceMappingURL=content-version.js.map