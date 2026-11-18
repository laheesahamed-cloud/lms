"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.queryTraceEnabled = void 0;
exports.traceQueries = traceQueries;
exports.queryTraceMiddleware = queryTraceMiddleware;
const node_async_hooks_1 = require("node:async_hooks");
exports.queryTraceEnabled = process.env.DEV_QUERY_TRACE === '1' && String(process.env.NODE_ENV || '').toLowerCase() !== 'production';
const storage = new node_async_hooks_1.AsyncLocalStorage();
const finished = [];
let nextId = 1;
function tag(sql) {
    const ctx = storage.getStore();
    if (!ctx)
        return sql;
    const prefix = `/* trace:${ctx.id} */ `;
    if (typeof sql === 'string')
        return prefix + sql;
    if (sql && typeof sql === 'object' && typeof sql.sql === 'string')
        return { ...sql, sql: prefix + sql.sql };
    return sql;
}
function wrapRunner(target) {
    for (const method of ['query', 'execute']) {
        const original = target[method];
        if (typeof original !== 'function' || original.__traced)
            continue;
        const wrapped = function (sql, ...rest) { return original.call(this, tag(sql), ...rest); };
        wrapped.__traced = true;
        target[method] = wrapped;
    }
    return target;
}
function traceQueries(pool) {
    if (!exports.queryTraceEnabled)
        return pool;
    wrapRunner(pool);
    const getConnection = pool.getConnection;
    if (typeof getConnection === 'function') {
        pool.getConnection = async function (...args) {
            return wrapRunner(await getConnection.apply(this, args));
        };
    }
    return pool;
}
function queryTraceMiddleware(req, res, next) {
    const path = String(req.originalUrl || req.url || '');
    if (path.startsWith('/api/__dev/trace')) {
        const remote = String(req.socket?.remoteAddress || '');
        if (!/^(::1|127\.0\.0\.1|::ffff:127\.0\.0\.1)$/.test(remote)) {
            res.statusCode = 404;
            res.end();
            return;
        }
        const since = Number(new URL(path, 'http://x').searchParams.get('since') || 0);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ requests: finished.filter((r) => r.id > since), nextId }));
        return;
    }
    const id = nextId++;
    const started = Date.now();
    let bytes = 0;
    const write = res.write;
    const end = res.end;
    res.write = function (chunk, ...rest) { if (chunk)
        bytes += Buffer.byteLength(chunk); return write.call(this, chunk, ...rest); };
    res.end = function (chunk, ...rest) { if (chunk && typeof chunk !== 'function')
        bytes += Buffer.byteLength(chunk); return end.call(this, chunk, ...rest); };
    res.on('finish', () => {
        finished.push({
            id, method: String(req.method || 'GET'), path: path.split('?')[0], client: String(req.headers?.['x-app-client'] || 'web'),
            status: res.statusCode, ms: Date.now() - started, bytes, startedAt: new Date(started).toISOString(),
        });
        if (finished.length > 20000)
            finished.splice(0, finished.length - 20000);
    });
    storage.run({ id }, () => next());
}
//# sourceMappingURL=query-trace.js.map