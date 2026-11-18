// Bump this when you change files so phones pick up the new version.
const CACHE = 'riyaz-v21';

const ASSETS = [
  './',
  'index.html',
  'style.css',
  'ragas.js',
  'app.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'icons/favicon-32.png',
  'harmonium/samples.json',
  ...['C2', 'Ds2', 'Fs2', 'A2', 'C3', 'Ds3', 'Fs3', 'A3', 'C4', 'Ds4', 'G4', 'C5', 'D5'].map(n => `harmonium/${n}.wav`),
  'tanpura/samples.json',
  ...['Cs2', 'Gs2', 'As2', 'Cs3'].map(n => `tanpura/${n}.wav`),
];

self.addEventListener('install', e => {
  // cache: 'reload' skips the browser's HTTP cache so a new version gets genuinely fresh files
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Serve from cache first (works offline); refresh the cache in the background when online.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.open(CACHE).then(async cache => {
      const cached = await cache.match(e.request, { ignoreSearch: true });
      const network = fetch(e.request)
        .then(res => { if (res.ok) cache.put(e.request, res.clone()); return res; })
        .catch(() => null);
      if (cached) { e.waitUntil(network); return cached; }
      return (await network) || new Response('Offline', { status: 503 });
    })
  );
});
