import { getSafeExternalUrl } from './linkSafety.js';

export function normalizeVideoUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  if (/^[A-Za-z0-9_-]{11}$/.test(raw)) return `https://youtu.be/${raw}`;
  if (/^\/\//.test(raw)) return `https:${raw}`;
  if (/^[a-z][a-z\d+.-]*:/i.test(raw)) {
    try {
      const parsed = new URL(raw);
      return ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString() : '';
    } catch {
      return '';
    }
  }
  if (/^(www\.|youtu\.be\/|youtube\.com\/|m\.youtube\.com\/|vimeo\.com\/|player\.vimeo\.com\/|drive\.google\.com\/)/i.test(raw)) {
    return `https://${raw}`;
  }
  return raw;
}

function normalizeStartSeconds(value) {
  const seconds = Math.floor(Number(value || 0));
  if (!Number.isFinite(seconds) || seconds <= 0) return 0;
  return Math.min(seconds, 23 * 60 * 60 + 59 * 60 + 59);
}

function withParams(src, params) {
  const u = new URL(src);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      u.searchParams.set(key, value);
    }
  }
  return u.toString();
}

function currentOrigin() {
  if (typeof window === 'undefined' || !window.location?.origin) return '';
  return window.location.origin;
}

export function getVideoEmbed(url, options = {}) {
  const raw = normalizeVideoUrl(url);
  if (!raw) return null;
  const safeExternalUrl = getSafeExternalUrl(raw);
  const startSeconds = normalizeStartSeconds(options.startSeconds);
  const youtubeParams = {
    rel:'0',
    modestbranding:'1',
    playsinline:'1',
    iv_load_policy:'3',
    cc_load_policy:'1',
    disablekb:'0',
    controls:'1',
    fs:'1',
    origin:currentOrigin(),
    start:startSeconds || undefined,
  };
  try {
    const u = new URL(raw);
    if (!['http:', 'https:'].includes(u.protocol)) return null;
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') {
      const id = u.pathname.split('/').filter(Boolean)[0];
      if (id) return { type:'iframe', src:withParams(`https://www.youtube.com/embed/${id}`, youtubeParams), provider:'youtube' };
    }
    if (host.includes('youtube.com')) {
      const watchId = u.searchParams.get('v');
      const path = u.pathname.split('/').filter(Boolean);
      const embeddedId = ['embed', 'shorts', 'live'].includes(path[0]) ? path[1] : null;
      const id = watchId || embeddedId;
      if (id) return { type:'iframe', src:withParams(`https://www.youtube.com/embed/${id}`, youtubeParams), provider:'youtube' };
    }
    if (host.includes('vimeo.com')) {
      const id = u.pathname.split('/').filter(Boolean).find(part => /^\d+$/.test(part));
      if (id) {
        const src = withParams(`https://player.vimeo.com/video/${id}`, { dnt:'1', title:'0', byline:'0', portrait:'0', badge:'0' });
        return { type:'iframe', src: startSeconds ? `${src}#t=${startSeconds}s` : src, provider:'vimeo' };
      }
    }
    if (host === 'drive.google.com') {
      const path = u.pathname.split('/').filter(Boolean);
      const fileIndex = path.indexOf('d');
      const id = fileIndex >= 0 ? path[fileIndex + 1] : u.searchParams.get('id');
      if (id) return { type:'iframe', src:`https://drive.google.com/file/d/${id}/preview` };
    }
  } catch {
    // Fall through to direct media detection.
  }
  if (safeExternalUrl && /\.(mp4|webm|ogg|mov)(?:[?#].*)?$/i.test(safeExternalUrl)) return { type:'video', src:safeExternalUrl };
  return { type:'blocked', externalUrl:safeExternalUrl };
}
