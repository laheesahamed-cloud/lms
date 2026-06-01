import { useEffect } from 'react';

const DEFAULT_TITLE = 'xyndrome';
const DEFAULT_DESCRIPTION =
  'xyndrome is a medical learning platform for lessons, quizzes, revision notes, subscriptions, and progress tracking.';
const DEFAULT_IMAGE = '/lms/pwa-icon-512.png';
const PUBLIC_WEBSITE_URL = String(import.meta.env.VITE_PUBLIC_WEBSITE_URL || '').trim().replace(/\/+$/, '');

function upsertMeta(selector, attributes) {
  if (typeof document === 'undefined') return;
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement('meta');
    document.head.appendChild(element);
  }

  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });
}

function upsertLink(selector, attributes) {
  if (typeof document === 'undefined') return;
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement('link');
    document.head.appendChild(element);
  }

  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });
}

function absoluteUrl(path = '/', baseUrl = '') {
  if (typeof window === 'undefined') return path;
  try {
    return new URL(path, baseUrl || window.location.origin).toString();
  } catch {
    return path;
  }
}

function publicPath(path = '/') {
  return String(path || '/').replace(/^\/+/, '');
}

function publicAssetPath(path = '/') {
  return String(path || '/').replace(/^\/lms\/?/, '').replace(/^\/+/, '');
}

function publicUrl(path = '/') {
  if (PUBLIC_WEBSITE_URL) {
    return absoluteUrl(publicPath(path), `${PUBLIC_WEBSITE_URL}/`);
  }

  return absoluteUrl(`/lms${path === '/' ? '/' : path}`);
}

export function PageMeta({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  path = '/',
  image = DEFAULT_IMAGE,
  noindex = false,
}) {
  useEffect(() => {
    const fullTitle = title === DEFAULT_TITLE ? title : `${title} | xyndrome`;
    const canonicalUrl = publicUrl(path);
    const imageUrl = PUBLIC_WEBSITE_URL ? absoluteUrl(publicAssetPath(image), `${PUBLIC_WEBSITE_URL}/`) : absoluteUrl(image);

    document.title = fullTitle;
    upsertMeta('meta[name="description"]', { name: 'description', content: description });
    upsertMeta('meta[name="robots"]', {
      name: 'robots',
      content: noindex ? 'noindex,nofollow' : 'index,follow',
    });
    upsertLink('link[rel="canonical"]', { rel: 'canonical', href: canonicalUrl });
    upsertMeta('meta[property="og:title"]', { property: 'og:title', content: fullTitle });
    upsertMeta('meta[property="og:description"]', { property: 'og:description', content: description });
    upsertMeta('meta[property="og:type"]', { property: 'og:type', content: 'website' });
    upsertMeta('meta[property="og:url"]', { property: 'og:url', content: canonicalUrl });
    upsertMeta('meta[property="og:image"]', { property: 'og:image', content: imageUrl });
    upsertMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' });
    upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: fullTitle });
    upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: description });
    upsertMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: imageUrl });
  }, [description, image, noindex, path, title]);

  return null;
}
