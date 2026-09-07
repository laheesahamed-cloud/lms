"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppOnlyContentException = void 0;
const common_1 = require("@nestjs/common");
class AppOnlyContentException extends common_1.ForbiddenException {
    constructor() {
        super({
            statusCode: 403,
            error: 'Forbidden',
            message: 'This content is only available in the Xyndrome mobile app.',
            code: 'APP_ONLY_CONTENT',
        });
    }
}
exports.AppOnlyContentException = AppOnlyContentException;
//# sourceMappingURL=app-only-content.exception.js.map