import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, retry, timer, throwError } from 'rxjs';

/**
 * Re-runs a save that lost a database deadlock.
 *
 * When two saves lock the same rows in opposite order, MariaDB undoes one of
 * them completely (ER_LOCK_DEADLOCK, errno 1213) so the other can finish. The
 * undone save changed nothing, and side effects such as push notifications run
 * only after a commit, so running the whole handler again is safe. Without
 * this, the admin would see a "database unavailable" error for a save that
 * simply needed a second try.
 *
 * Writes only (GET is never retried), at most 2 extra tries, short random wait.
 */
const DEADLOCK_ERRNO = 1213;

function isDeadlock(error: unknown) {
  const e = error as { errno?: number; code?: string } | null;
  return e?.errno === DEADLOCK_ERRNO || e?.code === 'ER_LOCK_DEADLOCK';
}

@Injectable()
export class DeadlockRetryInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const method = String(context.switchToHttp().getRequest()?.method || 'GET').toUpperCase();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return next.handle();
    return next.handle().pipe(
      retry({
        count: 2,
        delay: (error) => (isDeadlock(error) ? timer(20 + Math.floor(Math.random() * 60)) : throwError(() => error)),
      }),
    );
  }
}
