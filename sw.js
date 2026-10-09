/* Service worker de MacroFit.
   Sube el número de VERSION cada vez que actualices archivos de la app.
   Tus datos NO se tocan: viven en el almacenamiento del navegador, no en esta caché. */
const VERSION = 'macrofit-v2';
const FILES = ['./', 'index.html', 'styles.css', 'data.js', 'ex-img.js', 'coach.js', 'app.js', 'manifest.json',
  'icon-180.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(VERSION).then(c => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match(e.request).then(r => r || caches.match('index.html')))
  );
});
