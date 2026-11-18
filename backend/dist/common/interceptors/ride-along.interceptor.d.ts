import { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { Pool } from 'mysql2/promise';
import { Observable } from 'rxjs';
export declare class RideAlongInterceptor implements NestInterceptor {
    private readonly db;
    private readonly logger;
    constructor(db: Pool);
    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown>;
}
