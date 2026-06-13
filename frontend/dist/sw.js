const DEFAULT_NOTIFICATION_URL = '/lms/notifications';
const DEFAULT_ICON = '/lms/favicon-light-192.png';
const DEFAULT_BADGE = '/lms/pwa-maskable.svg';
const CACHE_NAME = 'xyndrome-lms-shell-20260612-assets-v12';
const APP_SHELL_URLS = [
  '/lms/',
  '/lms/index.html',
  '/lms/frontend/dist/boot.js',
  '/lms/manifest.webmanifest',
  '/lms/favicon-light-32.png',
  '/lms/favicon-light-180.png',
  '/lms/favicon-light-192.png',
  '/lms/favicon-light-512.png',
  '/lms/pwa-maskable.svg',
  '/lms/pwa-maskable-512.png',
  '/lms/frontend/dist/index.html',
];

function isProtectedPath(pathname) {
  return /^\/lms\/(?:app|admin|dashboard|study|courses|quizzes|exams|results|review|ai-notes|notes|billing|subscriptions|profile)(?:\/|$)/.test(pathname);
}

function offlineProtectedResponse() {
  return new Response(
    '<!doctype html><title>Protected content unavailable</title><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#05070d;color:#f8fafc;font-family:system-ui,sans-serif;text-align:center;padding:24px"><main><h1>Protected content is online-only</h1><p>Please reconnect and reload to continue.</p></main></body>',
    { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } }
  );
}

function buildAssetContentTypeIsValid(request, response) {
  if (!response || !response.ok) return false;

  const pathname = new URL(request.url).pathname;
  const contentType = response.headers.get('content-type') || '';

  if (pathname.endsWith('.css')) {
    return contentType.includes('text/css');
  }

  return contentType.includes('javascript') ||
    contentType.includes('ecmascript');
}

function missingBuildAssetResponse() {
  return new Response('', {
    status: 404,
    statusText: 'Build asset not found',
    headers: { 'Cache-Control': 'no-store' },
  });
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
        .filter((key) => key.startsWith('erpm-lms-shell-') || key.startsWith('xyndrome-lms-shell-'))
        .filter((key) => key !== CACHE_NAME)
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
    // Stale-while-revalidate shell (Round-2 Task 20, owner-approved
    // trade-off: a deploy becomes visible on the SECOND navigation after
    // it). The shell HTML is static and carries NO user data (report sec
    // 13.4), so serving it from cache is safe for protected paths too —
    // page data always comes from the live API. The background fetch
    // refreshes the cached shell on every navigation; kill-switch =
    // uninstallPwaRegistration() / VITE_ENABLE_PWA=false, as before.
    event.respondWith((async () => {
      const revalidate = fetch(request, { cache: 'no-store' })
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/lms/index.html', copy)).catch(() => {});
          }
          return response;
        });
      const cached = await caches.match('/lms/index.html');
      if (cached) {
        event.waitUntil(revalidate.catch(() => undefined));
        return cached;
      }
      return revalidate.catch(async () => {
        const fallback = await caches.match('/lms/frontend/dist/index.html');
        if (fallback) return fallback;
        return isProtectedPath(url.pathname)
          ? offlineProtectedResponse()
          : Response.error();
      });
    })());
    return;
  }

  const isServiceWorkerOrManifest =
    url.pathname.endsWith('.webmanifest') ||
    url.pathname.endsWith('/sw.js') ||
    url.pathname.endsWith('/boot.js');

  if (isServiceWorkerOrManifest) {
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

  const isVersionedBuildAsset =
    /\/assets\/(?:chunks\/|css\/)?[^/]+-[A-Za-z0-9_-]{6,}\.(?:js|css)$/i.test(url.pathname);

  if (isVersionedBuildAsset) {
    event.respondWith(
      caches.match(request, { ignoreSearch: true }).then((cached) => {
        const validCached = buildAssetContentTypeIsValid(request, cached) ? cached : null;
        const network = fetch(request)
          .then((response) => {
            if (buildAssetContentTypeIsValid(request, response)) {
              const copy = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
              return response;
            }

            return validCached || missingBuildAssetResponse();
          })
          .catch(() => validCached || missingBuildAssetResponse());

        return validCached || network;
      })
    );
    return;
  }

  if (!/\.(?:png|jpg|jpeg|webp|svg|ico|woff2?|ttf)$/i.test(url.pathname)) {
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
  const title = payload.title || 'xyndrome';
  const options = {
    body: payload.body || 'You have a new notification.',
    icon: payload.icon || DEFAULT_ICON,
    badge: payload.badge || DEFAULT_BADGE,
    tag: payload.tag || 'xyndrome-lms-notification',
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
