import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const express = require('express') as any;
const { json, urlencoded } = express;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('path');
import { AppModule } from './app.module';

const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

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

function isAllowedOrigin(origin: string, configuredFrontendUrl: string, allowLanOrigins: boolean) {
  return origin === configuredFrontendUrl || (allowLanOrigins && (isLocalOrigin(origin) || isPrivateLanOrigin(origin)));
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const configService = app.get(ConfigService);
  const bodyLimit = configService.get<string>('bodyLimit') || configService.get<string>('BODY_LIMIT') || '75mb';
  const nodeEnv = configService.get<string>('NODE_ENV') || 'development';
  const allowLanOrigins = configService.get<string>('ALLOW_LAN_ORIGINS') === 'true' || nodeEnv !== 'production';
  const uploadsRoot = path.join(process.cwd(), 'uploads');

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
      "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
    );
    res.removeHeader('X-Powered-By');
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
    const isSensitivePath =
      path.startsWith('/api/auth/') ||
      path.startsWith('/api/ai') ||
      path.includes('/import') ||
      path.includes('/generate');

    if (!isSensitivePath) {
      next();
      return;
    }

    const windowMs = 60_000;
    const maxRequests = path.startsWith('/api/auth/') ? 20 : 10;
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

  app.use(json({ limit: bodyLimit }));
  app.use(urlencoded({ limit: bodyLimit, extended: true }));
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
