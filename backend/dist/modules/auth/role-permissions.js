"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PERMISSIONS = exports.USER_ROLES = exports.STAFF_ROLES = void 0;
exports.normalizeRole = normalizeRole;
exports.permissionsForRole = permissionsForRole;
exports.roleHasPermission = roleHasPermission;
exports.isStaffRole = isStaffRole;
exports.STAFF_ROLES = ['admin', 'content_editor', 'reviewer', 'tutor', 'finance', 'support'];
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
//# sourceMappingURL=role-permissions.js.map