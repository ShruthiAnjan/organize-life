/* Organize Life Co. service worker — makes the app open and work with no internet.
   Strategy: try the network first (so updates arrive as soon as you're online),
   fall back to the saved copy when offline. Your data is NOT stored here —
   it lives in the browser's IndexedDB and is never touched by updates. */
const VERSION = 'olc-v2026.11.19-1';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css', 'css/fonts.css',
  'fonts/inter.woff2', 'fonts/source-serif-4.woff2',
  'icons/logo-mark.png', 'icons/logo-wordmark.png', 'icons/logo-full.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png', 'icons/favicon-32.png',
  'js/core.js', 'js/charts.js', 'js/p-home.js', 'js/p-planner.js', 'js/p-finance.js', 'js/p-career.js', 'js/p-learning.js',
  'js/p-life.js', 'js/p-goals.js', 'js/p-vision.js', 'js/p-reports.js', 'js/boot.js'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('message', e => { if (e.data === 'skipWaiting') self.skipWaiting(); });
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    try {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 4000);
      const res = await fetch(req, {signal: ctl.signal, cache: 'no-cache'}); clearTimeout(t);
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    } catch (err) {
      const hit = await cache.match(req, {ignoreSearch: true}) || (req.mode === 'navigate' ? await cache.match('index.html') : null);
      if (hit) return hit;
      throw err;
    }
  })());
});
