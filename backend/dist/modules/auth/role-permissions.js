"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PERMISSIONS = exports.USER_ROLES = exports.STAFF_ROLES = void 0;
exports.normalizeRole = normalizeRole;
exports.permissionsForRole = permissionsForRole;
exports.roleHasPermission = roleHasPermission;
exports.isStaffRole = isStaffRole;
exports.sanitizePermissions = sanitizePermissions;
exports.parseStoredPermissions = parseStoredPermissions;
exports.effectivePermissions = effectivePermissions;
exports.STAFF_ROLES = ['admin', 'content_editor', 'reviewer', 'tutor', 'finance', 'support', 'staff'];
exports.USER_ROLES = ['student', ...exports.STAFF_ROLES];
exports.PERMISSIONS = [
    'admin.access',
    'content.manage',
    'content.review',
    'students.manage',
    'questions.manage',
    'quizzes.manage',
    'subscriptions.manage',
    'plans.manage',
    'settings.manage',
    'ai.manage',
    'notifications.manage',
    'reports.view',
];
const ROLE_PERMISSIONS = {
    admin: [...exports.PERMISSIONS],
    content_editor: ['admin.access', 'content.manage', 'questions.manage', 'quizzes.manage', 'ai.manage', 'reports.view'],
    reviewer: ['admin.access', 'content.review', 'questions.manage', 'reports.view'],
    tutor: ['admin.access', 'content.review', 'reports.view'],
    finance: ['admin.access', 'subscriptions.manage', 'plans.manage', 'reports.view'],
    support: ['admin.access', 'students.manage', 'notifications.manage', 'reports.view'],
    staff: ['admin.access'],
    student: [],
};
function normalizeRole(role) {
    return exports.USER_ROLES.includes(role) ? role : 'student';
}
function permissionsForRole(role) {
    return ROLE_PERMISSIONS[normalizeRole(role)];
}
function roleHasPermission(role, permission) {
    return permissionsForRole(role).includes(permission);
}
function isStaffRole(role) {
    return exports.STAFF_ROLES.includes(role);
}
function sanitizePermissions(input) {
    if (!Array.isArray(input))
        return [];
    const valid = new Set(exports.PERMISSIONS);
    const out = [];
    for (const item of input) {
        if (typeof item === 'string' && valid.has(item) && !out.includes(item)) {
            out.push(item);
        }
    }
    return out;
}
function parseStoredPermissions(raw) {
    if (raw === null || raw === undefined)
        return null;
    const trimmed = String(raw).trim();
    if (!trimmed)
        return null;
    try {
        return sanitizePermissions(JSON.parse(trimmed));
    }
    catch {
        return sanitizePermissions(trimmed.split(',').map((part) => part.trim()));
    }
}
function effectivePermissions(role, storedRaw) {
    const normalized = normalizeRole(role);
    if (normalized === 'admin')
        return [...exports.PERMISSIONS];
    if (normalized === 'student')
        return [];
    const stored = parseStoredPermissions(storedRaw);
    if (stored && stored.length) {
        return stored.includes('admin.access') ? stored : ['admin.access', ...stored];
    }
    return ROLE_PERMISSIONS[normalized];
}
//# sourceMappingURL=role-permissions.js.map