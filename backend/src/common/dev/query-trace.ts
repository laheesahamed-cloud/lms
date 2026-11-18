import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Development-only request/query tracing for the live load monitor
 * (tools/dev-monitor). OFF unless DEV_QUERY_TRACE=1, and never in production.
 *
 * Each API request gets a number; every SQL statement it runs is prefixed with
 * a comment "/* trace:N *\/", so the database's own slow log (rows examined,
 * rows sent, time) can be attributed to the exact request. The request list
 * itself (method, path, status, time, bytes) is served on a loopback-only
 * endpoint, GET /api/__dev/trace?since=N.
 */
export const queryTraceEnabled =
  process.env.DEV_QUERY_TRACE === '1' && String(process.env.NODE_ENV || '').toLowerCase() !== 'production';

type TraceRequest = {
  id: number; method: string; path: string; client: string; status: number;
  ms: number; bytes: number; startedAt: string;
};

const storage = new AsyncLocalStorage<{ id: number }>();
const finished: TraceRequest[] = [];
let nextId = 1;

function tag(sql: unknown) {
  const ctx = storage.getStore();
  if (!ctx) return sql;
  const prefix = `/* trace:${ctx.id} */ `;
  if (typeof sql === 'string') return prefix + sql;
  if (sql && typeof sql === 'object' && typeof (sql as any).sql === 'string') return { ...(sql as any), sql: prefix + (sql as any).sql };
  return sql;
}

function wrapRunner<T extends object>(target: T): T {
  for (const method of ['query', 'execute'] as const) {
    const original = (target as any)[method];
    if (typeof original !== 'function' || original.__traced) continue;
    const wrapped = function (this: any, sql: unknown, ...rest: unknown[]) { return original.call(this, tag(sql), ...rest); };
    (wrapped as any).__traced = true;
    (target as any)[method] = wrapped;
  }
  return target;
}

/** Tag every statement run through this pool (and the connections it hands out). */
export function traceQueries<T extends object>(pool: T): T {
  if (!queryTraceEnabled) return pool;
  wrapRunner(pool);
  const getConnection = (pool as any).getConnection;
  if (typeof getConnection === 'function') {
    (pool as any).getConnection = async function (this: any, ...args: unknown[]) {
      return wrapRunner(await getConnection.apply(this, args));
    };
  }
  return pool;
}

/** Express middleware: numbers each request and records it when it finishes. */
export function queryTraceMiddleware(req: any, res: any, next: any) {
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
  res.write = function (chunk: any, ...rest: any[]) { if (chunk) bytes += Buffer.byteLength(chunk); return write.call(this, chunk, ...rest); };
  res.end = function (chunk: any, ...rest: any[]) { if (chunk && typeof chunk !== 'function') bytes += Buffer.byteLength(chunk); return end.call(this, chunk, ...rest); };
  res.on('finish', () => {
    finished.push({
      id, method: String(req.method || 'GET'), path: path.split('?')[0], client: String(req.headers?.['x-app-client'] || 'web'),
      status: res.statusCode, ms: Date.now() - started, bytes, startedAt: new Date(started).toISOString(),
    });
    if (finished.length > 20000) finished.splice(0, finished.length - 20000);
  });
  storage.run({ id }, () => next());
}
