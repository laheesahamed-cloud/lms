"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.API_RESPONSE_TARGETS_MS = void 0;
exports.classifyApiPerformanceRoute = classifyApiPerformanceRoute;
exports.recordApiRequestMetric = recordApiRequestMetric;
exports.recordClientPerformanceMetric = recordClientPerformanceMetric;
exports.getPerformanceMetricsSnapshot = getPerformanceMetricsSnapshot;
const MAX_RECORDS_PER_GROUP = 240;
const MAX_CLIENT_RECORDS = 240;
exports.API_RESPONSE_TARGETS_MS = {
    authentication: 800,
    dashboard: 1000,
    questionFetch: 1000,
    answerSave: 500,
    reviewData: 1200,
    staticAsset: 200,
    other: 2000,
};
const apiMetrics = new Map();
const clientMetrics = [];
function shouldLogPerformanceEvents() {
    return process.env.ENABLE_PERFORMANCE_LOGS === 'true' ||
        (process.env.NODE_ENV || 'development') !== 'production';
}
function normalizePath(path) {
    return String(path || '')
        .split('?')[0]
        .replace(/\/\d+(?=\/|$)/g, '/:id');
}
function percentile(values, p) {
    if (!values.length)
        return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
    return sorted[index];
}
function classifyApiPerformanceRoute(path, method) {
    const normalizedPath = normalizePath(path);
    const normalizedMethod = String(method || 'GET').toUpperCase();
    if (/^\/api\/auth\/(?:login|register|me|refresh|logout)$/.test(normalizedPath))
        return 'authentication';
    if (/^\/api\/(?:student\/)?dashboard/.test(normalizedPath))
        return 'dashboard';
    if (normalizedMethod === 'GET' && /^\/api\/(?:student\/)?quiz-attempts\/quiz\/:id$/.test(normalizedPath))
        return 'questionFetch';
    if (/^\/api\/(?:student\/)?quiz-attempts\/(?:practice|exam)\/:id\/(?:save|submit)$/.test(normalizedPath))
        return 'answerSave';
    if (normalizedMethod === 'GET' && /^\/api\/(?:student\/)?quiz-attempts\/(?:result|review|practice-review)\/:id/.test(normalizedPath))
        return 'reviewData';
    if (/\.(?:js|css|png|jpe?g|webp|svg|ico|woff2?)$/i.test(normalizedPath))
        return 'staticAsset';
    return 'other';
}
function recordApiRequestMetric(input) {
    const group = classifyApiPerformanceRoute(input.path, input.method);
    const targetMs = exports.API_RESPONSE_TARGETS_MS[group] || exports.API_RESPONSE_TARGETS_MS.other;
    const record = {
        method: String(input.method || 'GET').toUpperCase(),
        path: normalizePath(input.path),
        group,
        statusCode: Number(input.statusCode || 0),
        durationMs: Math.max(0, Math.round(Number(input.durationMs || 0))),
        targetMs,
        ok: Number(input.statusCode || 0) < 500,
        slow: Number(input.durationMs || 0) > targetMs,
        timestamp: new Date().toISOString(),
    };
    const records = apiMetrics.get(group) || [];
    records.push(record);
    if (records.length > MAX_RECORDS_PER_GROUP)
        records.splice(0, records.length - MAX_RECORDS_PER_GROUP);
    apiMetrics.set(group, records);
    if (shouldLogPerformanceEvents() && (record.slow || !record.ok)) {
        console.warn(JSON.stringify({
            event: record.slow ? 'api_performance_slow' : 'api_performance_error',
            group: record.group,
            method: record.method,
            path: record.path,
            statusCode: record.statusCode,
            durationMs: record.durationMs,
            targetMs: record.targetMs,
        }));
    }
}
function recordClientPerformanceMetric(input) {
    const payload = input && typeof input === 'object' ? input : {};
    const metric = String(payload.metric || '').trim().slice(0, 64);
    const value = Number(payload.value);
    if (!metric || !Number.isFinite(value) || value < 0) {
        return;
    }
    clientMetrics.push({
        metric,
        route: String(payload.route || '').slice(0, 160),
        value: Math.round(value),
        target: Number.isFinite(Number(payload.target)) ? Math.round(Number(payload.target)) : undefined,
        timestamp: new Date().toISOString(),
    });
    if (clientMetrics.length > MAX_CLIENT_RECORDS) {
        clientMetrics.splice(0, clientMetrics.length - MAX_CLIENT_RECORDS);
    }
}
function getPerformanceMetricsSnapshot() {
    const api = Array.from(apiMetrics.entries()).reduce((acc, [group, records]) => {
        const durations = records.map((record) => record.durationMs);
        const slowCount = records.filter((record) => record.slow).length;
        const errorCount = records.filter((record) => !record.ok).length;
        acc[group] = {
            targetMs: exports.API_RESPONSE_TARGETS_MS[group],
            sampleCount: records.length,
            p50Ms: percentile(durations, 50),
            p95Ms: percentile(durations, 95),
            maxMs: durations.length ? Math.max(...durations) : 0,
            slowCount,
            errorCount,
            latest: records[records.length - 1] || null,
        };
        return acc;
    }, {});
    return {
        targets: exports.API_RESPONSE_TARGETS_MS,
        api,
        client: {
            sampleCount: clientMetrics.length,
            latest: clientMetrics.slice(-20),
        },
    };
}
//# sourceMappingURL=performance-metrics.js.map