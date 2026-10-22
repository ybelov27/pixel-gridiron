// Network-first service worker: always fresh when online, still playable offline.
const CACHE = 'pixel-gridiron-46d34b80';
const FILES = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-152.png', 'icons/icon-167.png', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png',
  'src/main.js', 'src/gfx.js', 'src/input.js', 'src/ui.js', 'src/app.js', 'src/audio.js', 'src/rng.js', 'src/data.js', 'src/players.js',
  'src/play.js', 'src/playbook.js', 'src/match.js', 'src/league.js', 'src/office.js', 'src/flow.js', 'src/save.js',
  'src/scenes/game.js', 'src/scenes/menus.js'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request).then((r) => {
    if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('index.html'))));
});
