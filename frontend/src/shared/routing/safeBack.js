const DEFAULT_BACK_FALLBACK_PATH = '/dashboard';

function normalizePath(path) {
  const cleanPath = String(path || '').split('#')[0].split('?')[0] || DEFAULT_BACK_FALLBACK_PATH;
  return cleanPath.replace(/\/+$/, '') || '/';
}

export function getHistoryIndex() {
  if (typeof window === 'undefined') return 0;
  const index = Number(window.history?.state?.idx);
  return Number.isFinite(index) ? index : 0;
}

export function canNavigateBack() {
  return getHistoryIndex() > 0;
}

export function safeNavigateBack(navigate, {
  fallbackPath = DEFAULT_BACK_FALLBACK_PATH,
  currentPath = typeof window !== 'undefined' ? window.location.pathname : '',
  replace = true,
} = {}) {
  if (typeof navigate !== 'function') return false;

  if (canNavigateBack()) {
    navigate(-1);
    return true;
  }

  if (normalizePath(currentPath) !== normalizePath(fallbackPath)) {
    navigate(fallbackPath, { replace });
  }

  return false;
}
