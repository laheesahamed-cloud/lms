import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Pool } from 'mysql2/promise';
import { from, mergeMap, Observable } from 'rxjs';
import { requestContext, studentFromRequest } from '../auth/subscription-scope';
import { applyProgress, parseRideAlong, rememberRideAlong, returnRideAlong, rideAlongPending, rideAlongSavedMax } from '../utils/progress-write';
import { localDateKey } from '../../modules/xp/streak';

/**
 * Practices riding along (OPTIMIZE 10.28). Any student request may carry
 * `practices: [...]` in its JSON body. They are taken out of the body BEFORE
 * validation (strict DTOs would refuse the extra field) and kept for this
 * request: a write that updates the student's row anyway (lesson done, exam
 * finish, flashcards) applies them in its own statement; otherwise they are
 * applied here, after the request, in ONE statement.
 */
@Injectable()
export class RideAlongInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RideAlongInterceptor.name);

  constructor(private readonly db: Pool) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const req = context.switchToHttp().getRequest();
    const body = req?.body;
    if (!body || typeof body !== 'object' || !('practices' in body)) return next.handle();
    const list = parseRideAlong(body);
    delete body.practices;
    if (!list.length) return next.handle();
    rememberRideAlong(list);
    const res = context.switchToHttp().getResponse();
    return next.handle().pipe(mergeMap((data) => from((async () => {
      if (rideAlongPending()) {
        const ctx = requestContext.getStore() as any;
        // The signed token / session check recorded the student; the start-up
        // reply also names them (it checks the session itself).
        const replyUser = (data as any)?.user;
        const fromReply = replyUser && String(replyUser.role || '') === 'student' ? Number(replyUser.id) : 0;
        const userId = Number(ctx?.userId || studentFromRequest()?.id || fromReply || 0);
        if (userId > 0) {
          try {
            await applyProgress(this.db, userId, localDateKey(new Date()));
          } catch (error: any) {
            // The phone keeps them and sends them again (the number guards doubles).
            returnRideAlong();
            this.logger.warn(`Practices not saved for ${userId}: ${error?.message || error}`);
          }
        }
      }
      // The phone drops its copies only up to the number the server saved.
      const saved = rideAlongSavedMax();
      if (saved > 0 && res && !res.headersSent) res.setHeader('X-Practices-Applied', String(saved));
      return data;
    })())));
  }
}
