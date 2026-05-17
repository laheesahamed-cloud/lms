const APP_BASENAME = '/lms';
const LEGACY_BUILD_BASENAME = '/lms/frontend/dist';

const protectedLegacyPathPattern =
  /^\/(?:dashboard|pending|profile|courses|structure|users|questions|quizzes|exams|subscriptions|billing|bookmarks|notifications|planner|doubts|flashcards|notes|study|ai-notes|results|review|announcements|reports|setup|settings)(?:\/|$)/;

function splitPath(path) {
  const hashIndex = path.indexOf('#');
  const beforeHash = hashIndex >= 0 ? path.slice(0, hashIndex) : path;
  const hash = hashIndex >= 0 ? path.slice(hashIndex) : '';
  const searchIndex = beforeHash.indexOf('?');
  return {
    pathname: searchIndex >= 0 ? beforeHash.slice(0, searchIndex) : beforeHash,
    search: searchIndex >= 0 ? beforeHash.slice(searchIndex) : '',
    hash,
  };
}

function stripKnownBasename(path) {
  if (path === LEGACY_BUILD_BASENAME) return '/';
  if (path.startsWith(`${LEGACY_BUILD_BASENAME}/`)) {
    return path.slice(LEGACY_BUILD_BASENAME.length) || '/';
  }
  if (path === APP_BASENAME) return '/';
  if (path.startsWith(`${APP_BASENAME}/`)) {
    return path.slice(APP_BASENAME.length) || '/';
  }
  return path;
}

export function getSafeForwardPath(rawPath, fallback = '') {
  if (typeof rawPath !== 'string') return fallback;
  const trimmed = rawPath.trim();
  if (!trimmed || trimmed.startsWith('//') || /[\u0000-\u001f]/.test(trimmed)) {
    return fallback;
  }

  let path = trimmed;
  if (/^https?:\/\//i.test(trimmed)) {
    if (typeof window === 'undefined' || !window.location?.origin) return fallback;
    let url;
    try {
      url = new URL(trimmed);
    } catch {
      return fallback;
    }
    if (url.origin !== window.location.origin) return fallback;
    path = `${url.pathname}${url.search}${url.hash}`;
  }

  if (!path.startsWith('/')) return fallback;

  const { pathname, search, hash } = splitPath(path);
  const cleanPathname = stripKnownBasename(pathname) || '/';
  return `${cleanPathname}${search}${hash}`;
}

export function canonicalizeForwardPathForUser(path, user) {
  const safePath = getSafeForwardPath(path);
  if (!safePath || !user?.role) return '';

  const { pathname, search, hash } = splitPath(safePath);
  const suffix = `${search}${hash}`;

  if (user.role === 'admin') {
    if (pathname.startsWith('/app')) return '/admin/dashboard';
    if (pathname.startsWith('/admin')) return safePath;
    if (protectedLegacyPathPattern.test(pathname)) {
      const cleanPath = pathname === '/billing' ? '/subscriptions' : pathname;
      return `/admin${cleanPath}${suffix}`;
    }
    return safePath;
  }

  if (user.role === 'student') {
    if (pathname.startsWith('/admin')) return user.status === 'active' ? '/dashboard' : '/pending';
    if (pathname.startsWith('/app')) {
      const cleanPath = pathname.replace(/^\/app(?=\/|$)/, '') || '/dashboard';
      if (user.status !== 'active' && cleanPath !== '/pending') return '/pending';
      if (user.status === 'active' && cleanPath === '/pending') return '/dashboard';
      return `${cleanPath}${suffix}`;
    }
    if (protectedLegacyPathPattern.test(pathname)) {
      const cleanPath = pathname === '/billing' ? '/subscriptions' : pathname;
      return user.status === 'active' ? `${cleanPath}${suffix}` : '/pending';
    }
  }

  return safePath;
}

export function getCurrentForwardPath() {
  if (typeof window === 'undefined' || !window.location) return '';
  return getSafeForwardPath(`${window.location.pathname || '/'}${window.location.search || ''}${window.location.hash || ''}`);
}
