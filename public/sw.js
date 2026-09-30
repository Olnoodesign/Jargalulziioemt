/* Жаргал-Өлзий — service worker (PWA).
   Аппын бүрхүүлийг (shell) кэшлэж, /api хүсэлтийг үргэлж сүлжээнээс авна. */
const CACHE = 'jo-shell-v1';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll([
    '/', '/manifest.json', '/icon-192.png', '/icon-512.png'
  ])).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // API — үргэлж сүлжээнээс (кэшлэхгүй), нэвтрэлт/өгөгдөл шинэ байх ёстой
  if (url.pathname.startsWith('/api')) return;
  // Хуудас нээх үед: сүлжээ, амжилтгүй бол кэшлэсэн бүрхүүл
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).catch(() => caches.match('/')));
    return;
  }
  // Бусад статик: кэш эхэлж, байхгүй бол сүлжээ
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
