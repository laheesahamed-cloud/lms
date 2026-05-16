import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const express = require('express') as any;
const { json, urlencoded } = express;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('path');
import { AppModule } from './app.module';
import { AuthService } from './modules/auth/auth.service';

const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();
const contentRateLimitBuckets = new Map<string, { count: number; resetAt: number; warnedAt: number }>();
const contentDeviceBuckets = new Map<string, { resetAt: number; ips: Set<string>; agents: Set<string> }>();
const AUDITABLE_PATH_PATTERNS = [
  /^\/api\/auth\/login$/,
  /^\/api\/auth\/forgot-password$/,
  /^\/api\/auth\/reset-password$/,
  /^\/api\/questions\/import/,
  /^\/api\/ai/,
  /^\/api\/admin(?:\/|$)/,
  /^\/api\/student\/(?:lessons|ai-notes|quiz-attempts|quizzes|results|practice-review)(?:\/|$)/,
];

function extractCookieValue(cookieHeader: string | undefined, name: string) {
  return String(cookieHeader || '')
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1) || '';
}

function isLocalOrigin(origin: string) {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
}

function isPrivateLanOrigin(origin: string) {
  return /^https?:\/\/(10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?$/i.test(origin);
}

function isCapacitorOrigin(origin: string) {
  return /^(capacitor|ionic):\/\/localhost$/i.test(origin);
}

function isAllowedOrigin(origin: string, configuredFrontendUrl: string, allowLanOrigins: boolean) {
  return origin === configuredFrontendUrl ||
    isCapacitorOrigin(origin) ||
    (allowLanOrigins && (isLocalOrigin(origin) || isPrivateLanOrigin(origin)));
}

function isAuditablePath(path: string) {
  return AUDITABLE_PATH_PATTERNS.some((pattern) => pattern.test(path));
}

function isStudentContentPath(path: string) {
  return /^\/api\/(?:student\/)?(?:lessons\/student|ai-notes(?:\/student)?|quiz-attempts|quizzes\/\d+\/cards|courses\/student|dashboard\/student\/activity)(?:\/|$)/.test(path) ||
    /^\/api\/student\/(?:lessons|ai-notes|quiz-attempts|quizzes|results|practice-review|courses)(?:\/|$)/.test(path);
}

function normalizeRateLimitPath(path: string) {
  return path
    .replace(/\?.*$/, '')
    .replace(/\/\d+(?=\/|$)/g, '/:id');
}

function extractRouteItemId(path: string) {
  const match = path.match(/\/(\d+)(?:\/|$)/);
  return match ? Number(match[1]) : null;
}

function getRequestIp(req: any) {
  return String(req.ip || req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
}

function updateContentDeviceAudit(userId: string, ip: string, userAgent: string) {
  const now = Date.now();
  const windowMs = 15 * 60_000;
  const existing = contentDeviceBuckets.get(userId);
  const bucket = !existing || existing.resetAt <= now
    ? { resetAt: now + windowMs, ips: new Set<string>(), agents: new Set<string>() }
    : existing;

  bucket.ips.add(ip);
  if (userAgent) bucket.agents.add(userAgent.slice(0, 120));
  contentDeviceBuckets.set(userId, bucket);

  if (bucket.ips.size > 3 || bucket.agents.size > 5) {
    console.warn(JSON.stringify({
      event: 'content_multi_device_warning',
      userId,
      ipCount: bucket.ips.size,
      userAgentCount: bucket.agents.size,
    }));
  }
}

function rewriteApiBoundary(path: string, method: string) {
  const suffix = path.replace(/^\/api\/(?:admin|student)\/?/, '');
  const parts = suffix.split('/').filter(Boolean);
  const [resource, ...rest] = parts;
  const restPath = rest.length ? `/${rest.join('/')}` : '';

  if (path === '/api/admin' || path === '/api/admin/') return '/api/dashboard/admin';
  if (path === '/api/student' || path === '/api/student/') return '/api/dashboard/student';

  if (path.startsWith('/api/admin/')) {
    if (resource === 'dashboard') return `/api/dashboard/admin${restPath}`;
    if (resource === 'ai-notes') {
      if (rest[0] === 'generate') return '/api/ai-notes/generate';
      return `/api/ai-notes/admin${restPath}`;
    }
    if (resource === 'announcements') return `/api/announcements/admin${restPath}`;
    if (resource === 'reports') return `/api/reports/admin${restPath}`;
    if (resource === 'question-review') return `/api/question-review/admin${restPath}`;
    if (resource === 'lesson-doubts') return `/api/lesson-doubts/admin${restPath}`;
    if (resource === 'push') return `/api/push/admin${restPath}`;
    if (resource === 'subscriptions') {
      if (rest[0] === 'assign') return '/api/subscriptions/assign';
      if (rest[0] === 'requests' && rest[2] === 'resolve') return `/api/subscriptions/requests/${rest[1]}/resolve`;
      if (rest[0] && ['extend', 'renew', 'cancel', 'payment'].includes(rest[1] || '')) {
        return `/api/subscriptions/${rest[0]}/${rest[1]}`;
      }
      return `/api/subscriptions/admin${restPath}`;
    }
    if (resource === 'plans') {
      return method === 'GET' && !rest.length ? '/api/plans/admin' : `/api/plans${restPath}`;
    }
    if (resource === 'lessons') {
      return method === 'GET' && !rest.length ? '/api/lessons/admin' : `/api/lessons${restPath}`;
    }
    if (resource && ['courses', 'topics', 'subtopics', 'questions', 'quizzes', 'users', 'settings', 'setup', 'papers', 'theory-recap', 'smart-notes', 'ai'].includes(resource)) {
      return `/api/${resource}${restPath}`;
    }
  }

  if (path.startsWith('/api/student/')) {
    if (resource === 'dashboard') {
      if (rest[0] === 'activity') return '/api/dashboard/student/activity';
      return '/api/dashboard/student';
    }
    if (resource === 'courses') {
      if (rest[0] === 'lessons' && rest[2] === 'progress') return `/api/courses/student/lessons/${rest[1]}/progress`;
      return `/api/courses/student${restPath}`;
    }
    if (resource === 'lessons') return `/api/lessons/student${restPath}`;
    if (resource === 'ai-notes') {
      if (rest[0] === 'lesson' && rest[1]) return `/api/ai-notes/student/lesson/${rest[1]}`;
      return `/api/ai-notes${restPath}`;
    }
    if (resource === 'quizzes') {
      if (rest[0] && rest[1] === 'cards') return `/api/quizzes/${rest[0]}/cards`;
      return rest.length ? `/api/quiz-attempts/quiz/${rest[0]}` : '/api/quiz-attempts/quizzes';
    }
    if (resource === 'quiz-attempts') return `/api/quiz-attempts${restPath}`;
    if (resource === 'results') {
      if (rest[0] === 'review' && rest[1]) return `/api/quiz-attempts/review/${rest[1]}`;
      if (rest[0]) return `/api/quiz-attempts/result/${rest[0]}`;
      return '/api/quiz-attempts/results';
    }
    if (resource === 'practice-review' && rest[0]) return `/api/quiz-attempts/practice-review/${rest[0]}`;
    if (resource === 'subscriptions') {
      if (!rest.length) return '/api/subscriptions/me';
      if (rest[0] === 'request') return '/api/subscriptions/request';
      if (rest[0] === 'payhere' && rest[1] === 'initiate') return '/api/subscriptions/payhere/initiate';
      if (rest[0] === 'manual-payment' && rest[1] === 'request') return '/api/subscriptions/manual-payment/request';
      return `/api/subscriptions${restPath}`;
    }
    if (resource === 'bookmarks') return `/api/study-bookmarks${restPath}`;
    if (resource === 'notifications') return `/api/notifications${restPath}`;
    if (resource === 'planner') return `/api/study-planner${restPath}`;
    if (resource === 'doubts') return `/api/lesson-doubts${restPath}`;
    if (resource === 'push') return `/api/push${restPath}`;
    if (resource === 'theory-recap') return `/api/theory-recap${restPath}`;
  }

  return '';
}

function rewriteRequestUrl(req: any, targetPath: string) {
  const originalUrl = String(req.url || '');
  const queryIndex = originalUrl.indexOf('?');
  const query = queryIndex >= 0 ? originalUrl.slice(queryIndex) : '';
  req.url = `${targetPath}${query}`;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const configService = app.get(ConfigService);
  const authService = app.get(AuthService);
  const bodyLimit = configService.get<string>('bodyLimit') || configService.get<string>('BODY_LIMIT') || '75mb';
  const nodeEnv = configService.get<string>('NODE_ENV') || 'development';
  const allowLanOrigins = configService.get<string>('ALLOW_LAN_ORIGINS') === 'true' || nodeEnv !== 'production';
  const uploadsRoot = path.join(process.cwd(), 'uploads');

  app.use('/uploads/payment-proofs', (_req: any, res: any) => {
    res.status(404).json({ message: 'File not found' });
  });

  app.use('/uploads', express.static(uploadsRoot, {
    index: false,
    setHeaders: (res: any) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    },
  }));

  app.use((req: any, res: any, next: any) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'none'; connect-src 'self' http://localhost:3000 http://127.0.0.1:3000 http://192.168.0.117:3000 http://192.168.2.189:3000 http://172.20.10.2:3000 capacitor://localhost ionic://localhost; script-src 'self' capacitor://localhost ionic://localhost; frame-src 'self' capacitor://localhost ionic://localhost; img-src 'self' data: blob: http://192.168.0.117:3000 http://192.168.2.189:3000 http://172.20.10.2:3000; style-src 'self' 'unsafe-inline' capacitor://localhost ionic://localhost; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
    );
    res.removeHeader('X-Powered-By');
    next();
  });

  app.use((req: any, res: any, next: any) => {
    const startedAt = Date.now();
    const path = String(req.path || req.url || '');
    if (!isAuditablePath(path)) {
      next();
      return;
    }

    res.on('finish', () => {
      const ip = String(req.ip || req.socket?.remoteAddress || 'unknown');
      const method = String(req.method || 'GET').toUpperCase();
      const statusCode = Number(res.statusCode || 0);
      const durationMs = Date.now() - startedAt;
      console.info(JSON.stringify({
        event: 'security_access',
        method,
        path,
        statusCode,
        durationMs,
        ip,
        userAgent: String(req.headers?.['user-agent'] || '').slice(0, 160),
      }));
    });

    next();
  });

  app.use((req: any, _res: any, next: any) => {
    if (!req.headers?.authorization) {
      const cookieToken = extractCookieValue(req.headers?.cookie, 'lms_session');
      if (cookieToken) {
        req.headers.authorization = `Bearer ${decodeURIComponent(cookieToken)}`;
      }
    }
    next();
  });

  const configuredFrontendUrl = configService.get<string>('frontendUrl') || 'http://localhost:5174';
  app.use((req: any, res: any, next: any) => {
    const origin = String(req.headers?.origin || '');
    if (origin && isAllowedOrigin(origin, configuredFrontendUrl, allowLanOrigins)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
      res.setHeader(
        'Access-Control-Allow-Headers',
        String(req.headers?.['access-control-request-headers'] || 'Authorization,Content-Type')
      );
      res.setHeader('Vary', 'Origin');
    }

    if (String(req.method || '').toUpperCase() === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    next();
  });

  app.use((req: any, res: any, next: any) => {
    const method = String(req.method || 'GET').toUpperCase();
    const unsafeMethod = !['GET', 'HEAD', 'OPTIONS'].includes(method);
    const origin = String(req.headers?.origin || '');

    if (unsafeMethod && origin && !isAllowedOrigin(origin, configuredFrontendUrl, allowLanOrigins)) {
      res.status(403).json({ message: 'Request origin is not allowed' });
      return;
    }

    next();
  });

  app.use((req: any, res: any, next: any) => {
    const path = String(req.path || req.url || '');
    const isAdminPath = path.startsWith('/api/admin/');
    const isSensitivePath =
      isAdminPath ||
      path.startsWith('/api/auth/') ||
      path.startsWith('/api/ai') ||
      path.includes('/import') ||
      path.includes('/generate');

    if (!isSensitivePath) {
      next();
      return;
    }

    const windowMs = 60_000;
    const maxRequests = path.startsWith('/api/auth/') ? 20 : isAdminPath ? 40 : 10;
    const ip = String(req.ip || req.socket?.remoteAddress || 'unknown');
    const key = `${ip}:${path}`;
    const now = Date.now();
    const bucket = rateLimitBuckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      rateLimitBuckets.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    bucket.count += 1;
    if (bucket.count > maxRequests) {
      res.status(429).json({ message: 'Too many requests. Please wait a moment and try again.' });
      return;
    }

    next();
  });

  app.use(async (req: any, res: any, next: any) => {
    const path = String(req.path || req.url || '');
    const method = String(req.method || 'GET').toUpperCase();
    const isAdminBoundary = path === '/api/admin' || path.startsWith('/api/admin/');
    const isStudentBoundary = path === '/api/student' || path.startsWith('/api/student/');

    if (!isAdminBoundary && !isStudentBoundary) {
      next();
      return;
    }

    try {
      if (isAdminBoundary) {
        const admin = await authService.requireAdmin(req.headers?.authorization);
        req.lmsUser = admin;
      } else {
        const student = await authService.requireStudent(req.headers?.authorization);
        req.lmsUser = student;
      }

      const rewrittenPath = rewriteApiBoundary(path, method);
      if (!rewrittenPath) {
        res.status(404).json({ message: 'API boundary route was not found' });
        return;
      }

      rewriteRequestUrl(req, rewrittenPath);
      next();
    } catch (error: any) {
      const statusCode = Number(error?.status || error?.statusCode || 401);
      res.status(statusCode).json({ message: error?.message || 'Access denied' });
    }
  });

  app.use((req: any, res: any, next: any) => {
    const path = String(req.path || req.url || '');
    if (!isStudentContentPath(path)) {
      next();
      return;
    }

    const method = String(req.method || 'GET').toUpperCase();
    const ip = getRequestIp(req);
    const userAgent = String(req.headers?.['user-agent'] || '');
    const userId = String(req.lmsUser?.id || 'anonymous');
    const normalizedPath = normalizeRateLimitPath(path);
    const now = Date.now();
    const windowMs = 60_000;
    const maxRequests = method === 'GET' ? 70 : 100;
    const key = `${userId}:${ip}:${method}:${normalizedPath}`;
    const bucket = contentRateLimitBuckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      contentRateLimitBuckets.set(key, { count: 1, resetAt: now + windowMs, warnedAt: 0 });
    } else {
      bucket.count += 1;
      if (bucket.count > Math.floor(maxRequests * 0.75) && now - bucket.warnedAt > 15_000) {
        bucket.warnedAt = now;
        console.warn(JSON.stringify({
          event: 'content_rapid_access_warning',
          userId,
          method,
          path: normalizedPath,
          count: bucket.count,
          ip,
        }));
      }

      if (bucket.count > maxRequests) {
        console.warn(JSON.stringify({
          event: 'content_rate_limited',
          userId,
          method,
          path: normalizedPath,
          count: bucket.count,
          ip,
        }));
        res.status(429).json({ message: 'Too many content requests. Please wait a moment and try again.' });
        return;
      }
    }

    if (userId !== 'anonymous') {
      updateContentDeviceAudit(userId, ip, userAgent);
    }

    const startedAt = Date.now();
    res.on('finish', () => {
      console.info(JSON.stringify({
        event: 'content_access',
        userId,
        method,
        path: normalizedPath,
        itemId: extractRouteItemId(path),
        statusCode: Number(res.statusCode || 0),
        durationMs: Date.now() - startedAt,
        ip,
        userAgent: userAgent.slice(0, 160),
      }));
    });

    next();
  });

  app.use(json({ limit: bodyLimit, strict: true }));
  app.use(urlencoded({ limit: bodyLimit, extended: true, parameterLimit: 1000 }));
  const corsOrigin = (
    origin: string | undefined,
    callback: (error: Error | null, allow?: boolean) => void,
  ) => {
    if (!origin) {
      callback(null, true);
      return;
    }

    if (isAllowedOrigin(origin, configuredFrontendUrl, allowLanOrigins)) {
      callback(null, true);
      return;
    }

    callback(new Error(`CORS blocked for origin: ${origin}`), false);
  };

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    })
  );

  await app.listen(configService.get<number>('port') || 3000, '0.0.0.0');
}

bootstrap();
