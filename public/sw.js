/* Empire Shop — Service Worker (Phase 9)
 * Strategies:
 *  - HTML navigations: network-first, fallback to /offline.html
 *  - Static /_next/static + /fonts + /icons: cache-first (immutable)
 *  - Images (same-origin + next/image): stale-while-revalidate
 *  - APIs (/api/*): network-only (never cache to avoid stale auth/data)
 *  - Push: shows notification and focuses/opens URL on click
 */
const VERSION = 'v1.0.0';
const PRECACHE = `empire-precache-${VERSION}`;
const RUNTIME_HTML = `empire-html-${VERSION}`;
const RUNTIME_ASSETS = `empire-assets-${VERSION}`;
const RUNTIME_IMAGES = `empire-images-${VERSION}`;

const PRECACHE_URLS = [
  '/offline.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(PRECACHE).then((c) => c.addAll(PRECACHE_URLS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith('empire-') && !k.endsWith(VERSION))
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

function isHTMLRequest(req) {
  return req.mode === 'navigate' || (req.method === 'GET' && req.headers.get('accept')?.includes('text/html'));
}

function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/fonts/') ||
    url.pathname.startsWith('/icons/')
  );
}

function isImage(req, url) {
  return (
    req.destination === 'image' ||
    url.pathname.startsWith('/_next/image') ||
    url.pathname.startsWith('/uploads/')
  );
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Never cache API / auth
  if (url.pathname.startsWith('/api/')) return;

  // HTML navigations — network-first with offline fallback
  if (isHTMLRequest(req)) {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(RUNTIME_HTML);
          cache.put(req, fresh.clone()).catch(() => {});
          return fresh;
        } catch {
          const cache = await caches.open(RUNTIME_HTML);
          const cached = await cache.match(req);
          if (cached) return cached;
          const offline = await caches.match('/offline.html');
          return offline || new Response('Offline', { status: 503, statusText: 'Offline' });
        }
      })(),
    );
    return;
  }

  // Static assets — cache-first
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.open(RUNTIME_ASSETS).then(async (cache) => {
        const cached = await cache.match(req);
        if (cached) return cached;
        const fresh = await fetch(req);
        if (fresh.ok) cache.put(req, fresh.clone()).catch(() => {});
        return fresh;
      }),
    );
    return;
  }

  // Images — stale-while-revalidate
  if (isImage(req, url)) {
    event.respondWith(
      caches.open(RUNTIME_IMAGES).then(async (cache) => {
        const cached = await cache.match(req);
        const network = fetch(req)
          .then((res) => {
            if (res.ok) cache.put(req, res.clone()).catch(() => {});
            return res;
          })
          .catch(() => cached);
        return cached || network;
      }),
    );
  }
});

/* -------- Push notifications -------- */
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'Empire Shop', body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'Empire Shop';
  const options = {
    body: data.body || '',
    icon: data.icon || '/icons/icon-192.png',
    badge: data.badge || '/icons/icon-192.png',
    dir: 'rtl',
    lang: data.lang || 'fa-AF',
    tag: data.tag,
    data: { url: data.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/';
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of all) {
        if ('focus' in client) {
          client.navigate(target).catch(() => {});
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
