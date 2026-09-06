/* SECTION: sw —— Service Worker：预缓存壳资源，cache-first + 离线回退 */
'use strict';
const CACHE = 'tt-shell-v5';
const SHELL = [
  './',
  './日课.html',
  './index.html',
  './assets/data.js',
  './assets/idb.js',
  './assets/core.js',
  './assets/app.js',
  './manifest.json',
  './icon.svg',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  e.respondWith(
    caches.match(req).then(hit => {
      if (hit) return hit;
      return fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => {
        if (req.mode === 'navigate') return caches.match('./index.html').then(m => m || caches.match('./'));
        return Response.error();
      });
    })
  );
});
