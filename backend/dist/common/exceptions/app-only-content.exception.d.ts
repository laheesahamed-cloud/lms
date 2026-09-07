import { ForbiddenException } from '@nestjs/common';
export declare class AppOnlyContentException extends ForbiddenException {
    constructor();
}
