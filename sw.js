const DEFAULT_NOTIFICATION_URL = '/lms/notifications';
const DEFAULT_ICON = '/lms/pwa-icon.svg';
const DEFAULT_BADGE = '/lms/pwa-maskable.svg';
const CACHE_NAME = 'erpm-lms-shell-20260525-performance-cleanup-v1';
const APP_SHELL_URLS = [
  '/lms/',
  '/lms/index.html',
  '/lms/manifest.webmanifest',
  '/lms/pwa-icon.svg',
  '/lms/pwa-maskable.svg',
  '/lms/pwa-icon-192.png',
  '/lms/pwa-icon-512.png',
  '/lms/pwa-maskable-512.png',
  '/lms/apple-touch-icon.png',
  '/lms/frontend/dist/index.html',
];

function isProtectedPath(pathname) {
  return /^\/lms\/(?:app|admin|dashboard|study|courses|quizzes|exams|results|review|ai-notes|notes|billing|subscriptions|profile)(?:\/|$)/.test(pathname);
}

function isMascotPreviewPath(pathname) {
  return /^\/lms\/mascot-animation-lab(?:\/|$)/.test(pathname);
}

function offlineProtectedResponse() {
  return new Response(
    '<!doctype html><title>Protected content unavailable</title><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#05070d;color:#f8fafc;font-family:system-ui,sans-serif;text-align:center;padding:24px"><main><h1>Protected content is online-only</h1><p>Please reconnect and reload to continue.</p></main></body>',
    { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } }
  );
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL_URLS))
      .catch(() => undefined)
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith('erpm-lms-shell-') && key !== CACHE_NAME)
        .map((key) => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith('/lms/')) {
    return;
  }

  if (request.mode === 'navigate') {
    if (isMascotPreviewPath(url.pathname)) {
      event.respondWith(fetch(request, { cache: 'no-store' }));
      return;
    }

    if (isProtectedPath(url.pathname)) {
      event.respondWith(
        fetch(request, { cache: 'no-store' })
          .catch(() => offlineProtectedResponse())
      );
      return;
    }

    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('/lms/index.html', copy)).catch(() => {});
          return response;
        })
        .catch(() => caches.match('/lms/index.html').then((cached) => cached || caches.match('/lms/frontend/dist/index.html')))
    );
    return;
  }

  const isFreshAsset =
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.webmanifest') ||
    url.pathname.endsWith('/sw.js');

  if (isFreshAsset) {
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
          }
          return response;
        })
        .catch(() => caches.match(request, { ignoreSearch: true }))
    );
    return;
  }

  if (!/\.(?:png|jpg|jpeg|webp|svg|ico)$/i.test(url.pathname)) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
          }
          return response;
        })
        .catch(() => cached);

      return cached || network;
    })
  );
});

self.addEventListener('push', (event) => {
  const payload = readPushPayload(event);
  const title = payload.title || 'ERPM LMS';
  const options = {
    body: payload.body || 'You have a new notification.',
    icon: payload.icon || DEFAULT_ICON,
    badge: payload.badge || DEFAULT_BADGE,
    tag: payload.tag || 'erpm-lms-notification',
    renotify: Boolean(payload.renotify),
    requireInteraction: Boolean(payload.requireInteraction),
    data: {
      url: normalizeNotificationUrl(payload.url),
      ...payload.data,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = normalizeNotificationUrl(event.notification.data?.url);

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const target = new URL(targetUrl, self.location.origin);

    for (const client of windows) {
      const clientUrl = new URL(client.url);
      if (clientUrl.origin === target.origin && 'focus' in client) {
        if ('navigate' in client) {
          await client.navigate(target.href);
        }
        return client.focus();
      }
    }

    return self.clients.openWindow(target.href);
  })());
});

function readPushPayload(event) {
  if (!event.data) return {};
  try {
    return event.data.json();
  } catch (error) {
    return { body: event.data.text() };
  }
}

function normalizeNotificationUrl(url) {
  const value = typeof url === 'string' && url.startsWith('/') && !url.startsWith('//')
    ? url
    : DEFAULT_NOTIFICATION_URL;

  return value.startsWith('/lms') ? value : `/lms${value}`;
}
