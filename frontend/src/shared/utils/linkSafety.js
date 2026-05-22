const INTERNAL_ROUTE_PATTERNS = [
  /^\/$/,
  /^\/(?:login|register|pending|profile|dashboard|courses|structure|users|questions|quizzes|exams|subscriptions|finance|billing|bookmarks|notifications|planner|doubts|flashcards|notes|ai-notes|results|review|announcements|reports|setup|settings)(?:\/|$|\?|#)/,
  /^\/auth\/(?:login|register|forgot-password|reset-password)(?:$|\?|#)/,
  /^\/ai(?:\/(?:gemini|chatgpt))?(?:$|\?|#)/,
  /^\/study\/lesson\/[^/?#]+(?:$|\?|#)/,
  /^\/app(?:\/|$|\?|#)/,
  /^\/admin(?:\/|$|\?|#)/,
  /^\/student(?:\/|$|\?|#)/,
];

export function getSafeInternalPath(value, fallback = '') {
  const raw = String(value || '').trim();
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) {
    return fallback;
  }

  try {
    const parsed = new URL(raw, 'http://lms.local');
    const path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    return INTERNAL_ROUTE_PATTERNS.some((pattern) => pattern.test(path)) ? path : fallback;
  } catch {
    return fallback;
  }
}

export function getSafeExternalUrl(value, { allowHttpLocalhost = true } = {}) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  try {
    const withProtocol = raw.startsWith('//') ? `https:${raw}` : raw;
    const parsed = new URL(withProtocol);
    const isLocalHttp = allowHttpLocalhost && parsed.protocol === 'http:' && /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(parsed.hostname);

    if (parsed.protocol !== 'https:' && !isLocalHttp) {
      return '';
    }

    return parsed.toString();
  } catch {
    return '';
  }
}
