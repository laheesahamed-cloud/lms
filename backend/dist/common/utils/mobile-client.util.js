"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MOBILE_APP_CLIENT_VALUE = exports.APP_CLIENT_HEADER = void 0;
exports.isMobileAppClient = isMobileAppClient;
exports.APP_CLIENT_HEADER = 'x-app-client';
exports.MOBILE_APP_CLIENT_VALUE = 'xyndrome-mobile-app';
function isMobileAppClient(headerValue) {
    if (!headerValue)
        return false;
    const value = Array.isArray(headerValue) ? headerValue[0] : headerValue;
    return String(value).trim().toLowerCase() === exports.MOBILE_APP_CLIENT_VALUE;
}
//# sourceMappingURL=mobile-client.util.js.map