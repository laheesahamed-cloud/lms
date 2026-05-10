const CACHE_NAME = 'erpm-lms-shell-v47';

async function clearOldCaches() {
  const keys = await caches.keys();
  await Promise.all(
    keys
      .filter((key) => key.startsWith('erpm-lms-shell-') && key !== CACHE_NAME)
      .map((key) => caches.delete(key))
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(clearOldCaches().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clearOldCaches().then(() => self.clients.claim()));
});

self.addEventListener('fetch', () => {
  // Let the browser hit the network normally. This avoids stale cached shells
  // while scroll/layout fixes are being iterated locally.
});
