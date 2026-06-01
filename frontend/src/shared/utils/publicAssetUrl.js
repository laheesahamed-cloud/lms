import { API_BASE_URL } from '../api/client.js';

export function resolvePublicAssetUrl(value) {
  const url = String(value || '').trim();
  if (!url) return '';
  if (/^(?:https?:|data:|blob:)/i.test(url)) return url;

  if (url.startsWith('/api/')) {
    const apiBase = String(API_BASE_URL || '').replace(/\/+$/, '');
    if (apiBase.endsWith('/api')) {
      return `${apiBase.slice(0, -4)}${url}`;
    }
  }

  return url;
}
