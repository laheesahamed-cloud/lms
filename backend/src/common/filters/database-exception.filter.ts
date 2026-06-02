import { ArgumentsHost, Catch } from '@nestjs/common';
import { BaseExceptionFilter, HttpAdapterHost } from '@nestjs/core';

const DATABASE_UNAVAILABLE_CODE = 'DATABASE_UNAVAILABLE';

const DATABASE_AVAILABILITY_ERROR_CODES = new Set([
  'PROTOCOL_CONNECTION_LOST',
  'ECONNREFUSED',
  'ECONNRESET',
  'ECONNABORTED',
  'ETIMEDOUT',
  'EHOSTUNREACH',
  'ENOTFOUND',
  'ER_CON_COUNT_ERROR',
  'ER_SERVER_SHUTDOWN',
  'ER_SERVER_GONE_ERROR',
  'CR_SERVER_GONE_ERROR',
  'CR_SERVER_LOST',
]);

function getErrorCode(error: unknown) {
  const code = (error as { code?: unknown })?.code;
  return typeof code === 'string' ? code.trim().toUpperCase() : '';
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || '');
}

function isDatabaseUnavailableError(error: unknown) {
  const code = getErrorCode(error);
  if (code && DATABASE_AVAILABILITY_ERROR_CODES.has(code)) {
    return true;
  }

  const message = getErrorMessage(error);
  return /(?:connect\s+ECONNREFUSED|connect\s+ETIMEDOUT|read\s+ECONNRESET|PROTOCOL_CONNECTION_LOST|server has gone away|pool is closed|connection is in closed state|can't enqueue .* after fatal error)/i.test(message);
}

@Catch()
export class DatabaseExceptionFilter extends BaseExceptionFilter {
  constructor(private readonly adapterHost: HttpAdapterHost) {
    super(adapterHost.httpAdapter);
  }

  catch(exception: unknown, host: ArgumentsHost) {
    if (!isDatabaseUnavailableError(exception)) {
      super.catch(exception, host);
      return;
    }

    const httpAdapter = this.adapterHost.httpAdapter;
    const context = host.switchToHttp();
    const response = context.getResponse();
    const request = context.getRequest<{ originalUrl?: string; url?: string }>();

    httpAdapter.setHeader(response, 'Retry-After', '3');
    httpAdapter.reply(response, {
      statusCode: 503,
      code: DATABASE_UNAVAILABLE_CODE,
      message: 'Database is temporarily unavailable. Please try again shortly.',
      checks: {
        database: {
          ok: false,
        },
      },
      path: request?.originalUrl || request?.url || '',
      timestamp: new Date().toISOString(),
    }, 503);
  }
}
