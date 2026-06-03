const PUBLIC_WEBSITE_PATHS = new Set([
  '/',
  '/login',
  '/register',
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/terms',
  '/privacy-policy',
  '/refund-policy',
  '/cookie-policy',
  '/ai',
  '/ai/gemini',
  '/ai/chatgpt',
]);

export function normalizePublicRoutePath(pathname = '') {
  return String(pathname || '/')
    .replace(/^\/lms(?:\/frontend\/dist)?(?=\/|$)/, '')
    .replace(/\/+$/, '') || '/';
}

export function isPublicWebsiteRoute(pathname = '') {
  const path = normalizePublicRoutePath(pathname);
  return PUBLIC_WEBSITE_PATHS.has(path) || /^\/launch-preview\//.test(path);
}
