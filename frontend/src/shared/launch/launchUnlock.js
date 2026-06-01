export const LAUNCH_ADMIN_UNLOCK_KEY = 'lms_launch_admin_unlocked_at';
export const LAUNCH_ADMIN_UNLOCK_MAX_AGE_MS = 10 * 60 * 1000;

export function rememberLaunchAdminUnlock() {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(LAUNCH_ADMIN_UNLOCK_KEY, String(Date.now()));
  } catch {
    // Session storage is best-effort; the real admin password still protects access.
  }
}

export function hasRecentLaunchAdminUnlock() {
  if (typeof window === 'undefined') return false;
  try {
    const timestamp = Number(window.sessionStorage.getItem(LAUNCH_ADMIN_UNLOCK_KEY) || 0);
    return timestamp > 0 && Date.now() - timestamp <= LAUNCH_ADMIN_UNLOCK_MAX_AGE_MS;
  } catch {
    return false;
  }
}
