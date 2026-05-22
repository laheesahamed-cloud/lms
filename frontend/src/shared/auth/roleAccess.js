const STAFF_ROLES = new Set(['admin', 'content_editor', 'reviewer', 'tutor', 'finance', 'support']);

export function isStaffRole(role) {
  return STAFF_ROLES.has(String(role || ''));
}

export function userHasPermission(user, permission) {
  if (!permission) return true;
  if (user?.role === 'admin') return true;
  return Array.isArray(user?.permissions) && user.permissions.includes(permission);
}

export function userHasPermissions(user, permissions = []) {
  return permissions.every((permission) => userHasPermission(user, permission));
}

export function isStaffUser(user) {
  return isStaffRole(user?.role) || userHasPermission(user, 'admin.access');
}

export function roleRouteMode(role) {
  return isStaffRole(role) ? 'admin' : 'student';
}

export function getStaffRoleLabel(role) {
  if (role === 'admin') return 'Administrator';
  return String(role || 'Staff')
    .split('_')
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ');
}
