export const STAFF_ROLES = ['admin', 'content_editor', 'reviewer', 'tutor', 'finance', 'support', 'staff'] as const;
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
  // Custom staff accounts get exactly what an administrator ticks for them (stored per-user).
  // With no explicit grant they can enter the admin panel but see nothing beyond the hub.
  staff: ['admin.access'],
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

/** Keep only recognised permission strings, de-duplicated and order-stable. */
export function sanitizePermissions(input: unknown): Permission[] {
  if (!Array.isArray(input)) return [];
  const valid = new Set<string>(PERMISSIONS);
  const out: Permission[] = [];
  for (const item of input) {
    if (typeof item === 'string' && valid.has(item) && !out.includes(item as Permission)) {
      out.push(item as Permission);
    }
  }
  return out;
}

/** Parse the raw `users.permissions` column (JSON array, or NULL for "use role defaults"). */
export function parseStoredPermissions(raw: string | null | undefined): Permission[] | null {
  if (raw === null || raw === undefined) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  try {
    return sanitizePermissions(JSON.parse(trimmed));
  } catch {
    // Tolerate legacy comma-separated values.
    return sanitizePermissions(trimmed.split(',').map((part) => part.trim()));
  }
}

/**
 * Effective permissions for a user: administrators always get everything, students get
 * nothing, and staff accounts use their per-user grant (falling back to the role default
 * when no custom grant is stored). Staff always retain `admin.access` so they can sign in.
 */
export function effectivePermissions(role: string | null | undefined, storedRaw?: string | null): Permission[] {
  const normalized = normalizeRole(role);
  if (normalized === 'admin') return [...PERMISSIONS];
  if (normalized === 'student') return [];

  const stored = parseStoredPermissions(storedRaw);
  if (stored && stored.length) {
    return stored.includes('admin.access') ? stored : (['admin.access', ...stored] as Permission[]);
  }

  return ROLE_PERMISSIONS[normalized];
}
