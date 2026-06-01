"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sqlIdentifier = sqlIdentifier;
exports.allowedSqlFragment = allowedSqlFragment;
exports.sqlPlaceholders = sqlPlaceholders;
const common_1 = require("@nestjs/common");
const SQL_IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
function sqlIdentifier(value, allowedValues, label = 'SQL identifier') {
    const raw = String(value || '').trim();
    const allowed = allowedValues ? new Set(Array.from(allowedValues).map((item) => String(item))) : null;
    if (!raw || (allowed && !allowed.has(raw))) {
        throw new common_1.BadRequestException(`${label} is not allowed`);
    }
    const parts = raw.split('.');
    if (!parts.every((part) => SQL_IDENTIFIER_PATTERN.test(part))) {
        throw new common_1.BadRequestException(`${label} is invalid`);
    }
    return parts.map((part) => `\`${part}\``).join('.');
}
function allowedSqlFragment(value, allowedValues, label = 'SQL fragment') {
    const raw = String(value || '').trim();
    const allowed = new Set(Array.from(allowedValues).map((item) => String(item)));
    if (!allowed.has(raw)) {
        throw new common_1.BadRequestException(`${label} is not allowed`);
    }
    return raw;
}
function sqlPlaceholders(values) {
    return values.map(() => '?').join(',');
}
//# sourceMappingURL=sql-safety.js.map