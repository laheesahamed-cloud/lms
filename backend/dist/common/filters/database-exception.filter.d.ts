import { ArgumentsHost } from '@nestjs/common';
import { BaseExceptionFilter, HttpAdapterHost } from '@nestjs/core';
export declare class DatabaseExceptionFilter extends BaseExceptionFilter {
    private readonly adapterHost;
    constructor(adapterHost: HttpAdapterHost);
    catch(exception: unknown, host: ArgumentsHost): void;
}
