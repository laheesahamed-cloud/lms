"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizePagination = normalizePagination;
function normalizePagination(input = {}, options = {}) {
    const defaultLimit = Math.max(1, Math.trunc(options.defaultLimit ?? 50));
    const maxLimit = Math.max(defaultLimit, Math.trunc(options.maxLimit ?? 100));
    const requestedLimit = Number(input.limit);
    const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
        ? Math.min(Math.trunc(requestedLimit), maxLimit)
        : defaultLimit;
    const requestedOffset = Number(input.offset);
    if (Number.isFinite(requestedOffset) && requestedOffset >= 0) {
        return { limit, offset: Math.trunc(requestedOffset) };
    }
    const requestedPage = Number(input.page);
    const page = Number.isFinite(requestedPage) && requestedPage > 1 ? Math.trunc(requestedPage) : 1;
    return { limit, offset: (page - 1) * limit };
}
//# sourceMappingURL=pagination.js.map