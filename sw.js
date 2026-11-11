// Uygulama kabuğunu ve ses kütüphanesi / piyano kayıtlarını önbelleğe alır,
// böylece yüklü uygulama internet olmadan da açılır.
const VERSION = 'v3';
const SHELL = `shell-${VERSION}`;
const RUNTIME = `runtime-${VERSION}`;
const FILES = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './js/scene.js',
  './js/music.js',
  './js/time.js',
  './js/diag.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  ...['A', 'C', 'Ds', 'Fs'].flatMap((n) => [1, 2, 3, 4, 5, 6, 7].map((o) => `./audio/piano/${n}${o}.mp3`)),
];
const CDN = ['cdnjs.cloudflare.com'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== RUNTIME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Kendi dosyalarımız: önce ağ (güncel kalsın), olmazsa önbellek.
  // no-cache: tarayıcı önbelleğindeki eski bir dosyayı yenisiyle karıştırmasın.
  if (url.origin === location.origin) {
    e.respondWith(
      fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' })
        .then((res) => { const copy = res.clone(); caches.open(SHELL).then((c) => c.put(req, copy)); return res; })
        .catch(() => caches.match(req).then((r) => r || caches.match('./index.html'))),
    );
    return;
  }

  // CDN dosyaları (Tone.js, piyano kayıtları): önce önbellek.
  if (CDN.includes(url.hostname)) {
    e.respondWith(
      caches.open(RUNTIME).then((c) =>
        c.match(req).then((hit) => hit || fetch(req).then((res) => { if (res.ok) c.put(req, res.clone()); return res; })),
      ),
    );
  }
});
