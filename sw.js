// Network-first service worker: always fresh when online, still playable offline.
const CACHE = 'pixel-gridiron-edbbbd97';
const FILES = [
 './',
 'index.html',
 'manifest.webmanifest',
 'icons/icon-152.png',
 'icons/icon-167.png',
 'icons/icon-180.png',
 'icons/icon-192.png',
 'icons/icon-512.png',
 'src/achievements.js',
 'src/app.js',
 'src/audio.js',
 'src/data.js',
 'src/flow.js',
 'src/gfx.js',
 'src/input.js',
 'src/league.js',
 'src/main.js',
 'src/match.js',
 'src/music.js',
 'src/office.js',
 'src/play.js',
 'src/playbook.js',
 'src/players.js',
 'src/rng.js',
 'src/save.js',
 'src/scenes/game.js',
 'src/scenes/menus.js',
 'src/ui.js'
];
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
