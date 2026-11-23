// Bump this when you change files so phones pick up the new version.
const CACHE = 'riyaz-v48';

const ASSETS = [
  './',
  'index.html',
  'style.css',
  'ragas.js',
  'app.js',
  'pitch.js',
  'sing.js',
  'hum.js',
  'ragafind.js',
  'phrases.js',
  'library.js',
  'exercises.js', 'ragapaths.js', 'classnotes.js',
  'practice.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'icons/favicon-32.png',
  'harmonium/samples.json',
  // every semitone C2–D5 (the source has no F♯4)
  ...['C2', 'Cs2', 'D2', 'Ds2', 'E2', 'F2', 'Fs2', 'G2', 'Gs2', 'A2', 'As2', 'B2',
      'C3', 'Cs3', 'D3', 'Ds3', 'E3', 'F3', 'Fs3', 'G3', 'Gs3', 'A3', 'As3', 'B3',
      'C4', 'Cs4', 'D4', 'Ds4', 'E4', 'F4', 'G4', 'Gs4', 'A4', 'As4', 'B4',
      'C5', 'Cs5', 'D5'].map(n => `harmonium/${n}.wav`),
  'taals.js',
  'tabla/samples.json',
  ...['m_na1','m_na2','m_tin1','m_tin2','m_tin3','m_tun1','m_tun2','m_tun3','m_te1','m_te2','m_te3','m_te4','m_re1',
      'm_ge1','m_ge2','m_ge3','m_ge4','m_ge5','m_ge6','m_ge7','m_ge8','m_ke1','m_ke2','m_ke3',
      's_dha1','s_dhin1','s_ge1','s_ke1','s_na1','s_na2','s_re1','s_te1','s_tin1','s_tun1'].map(n => `tabla/${n}.wav`),
  'tanpura/samples.json',
  // modelled tanpura plucks: every odd MIDI note 25–71 (C♯1–B4), two takes each
  ...Array.from({ length: 24 }, (_, i) => 25 + 2 * i).flatMap(m => [`tanpura/p${m}_0.mp3`, `tanpura/p${m}_1.mp3`]),
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
      // remove old app versions only — never the settings backup
      .then(keys => Promise.all(keys.filter(k => k !== CACHE && k.startsWith('riyaz-v')).map(k => caches.delete(k))))
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
