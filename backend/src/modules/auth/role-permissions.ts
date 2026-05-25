export const STAFF_ROLES = ['admin', 'content_editor', 'reviewer', 'tutor', 'finance', 'support'] as const;
export const USER_ROLES = ['student', ...STAFF_ROLES] as const;

export type UserRole = (typeof USER_ROLES)[number];
export type StaffRole = (typeof STAFF_ROLES)[number];

export const PERMISSIONS = [
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
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [...PERMISSIONS],
  content_editor: ['admin.access', 'content.manage', 'questions.manage', 'quizzes.manage', 'ai.manage', 'reports.view'],
  reviewer: ['admin.access', 'content.review', 'questions.manage', 'reports.view'],
  tutor: ['admin.access', 'content.review', 'reports.view'],
  finance: ['admin.access', 'subscriptions.manage', 'plans.manage', 'reports.view'],
  support: ['admin.access', 'students.manage', 'notifications.manage', 'reports.view'],
  student: [],
};

export function normalizeRole(role: string | null | undefined): UserRole {
  return USER_ROLES.includes(role as UserRole) ? role as UserRole : 'student';
}

export function permissionsForRole(role: string | null | undefined) {
  return ROLE_PERMISSIONS[normalizeRole(role)];
}

export function roleHasPermission(role: string | null | undefined, permission: Permission) {
  return permissionsForRole(role).includes(permission);
}

export function isStaffRole(role: string | null | undefined) {
  return STAFF_ROLES.includes(role as StaffRole);
}
