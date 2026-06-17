const CACHE = 'trenche-hero-v2';
const CORE = ['./', './index.html', './manifest.json', './assets/icon-192.png', './assets/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).catch(()=>{})); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== CACHE).map(x => caches.delete(x))))); self.clients.claim(); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (u.hostname.endsWith('supabase.co')) return;          // never cache leaderboard API
  if (e.request.method !== 'GET') return;
  const isHTML = e.request.mode === 'navigate'
    || (e.request.headers.get('accept') || '').includes('text/html')
    || u.pathname === '/' || u.pathname.endsWith('.html');
  if (isHTML) {                                            // network-first so deploys show up immediately
    e.respondWith(
      fetch(e.request).then(resp => { const cc = resp.clone(); caches.open(CACHE).then(c => c.put(e.request, cc)); return resp; })
        .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
    );
    return;
  }
  e.respondWith(                                           // cache-first for static assets
    caches.match(e.request).then(r => r || fetch(e.request).then(resp => {
      if (resp && resp.ok && u.origin === location.origin) { const cc = resp.clone(); caches.open(CACHE).then(c => c.put(e.request, cc)); }
      return resp;
    }).catch(() => caches.match('./index.html')))
  );
});
