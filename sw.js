/* Service worker: mette in cache tutta l'app al primo caricamento, così in
   palestra funziona anche senza una tacca di segnale.
   Alza VERSIONE ogni volta che cambi un file: è quello che fa scattare
   l'aggiornamento sui telefoni che hanno già installato l'app. */

const VERSIONE = 'fitforme-v9';

const GUSCIO = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/base.css',
  './css/componenti.css',
  './css/allenamento.css',
  './css/palestra.css',
  './css/oggi.css',
  './font/archivo-var-latin.woff2',
  './font/fraunces-var-latin.woff2',
  './icone/icona-192.png',
  './icone/icona-512.png',
  './icone/icona-maskable-512.png',
  './icone/apple-touch-icon.png',
  './js/app.js',
  './js/db.js',
  './js/store.js',
  './js/ui.js',
  './js/icone.js',
  './js/oggi/vista.js',
  './js/csv.js',
  './js/corpo/vista.js',
  './js/dati/vista.js',
  './js/seed.js',
  './js/grafico.js',
  './js/componenti.js',
  './js/pasti/dati.js',
  './js/pasti/motore.js',
  './js/pasti/vista.js',
  './js/allenamento/protocolli.js',
  './js/allenamento/vista.js',
  './js/allenamento/palestra.js',
  './js/allenamento/editor.js',
  './js/corpo/vista.js',
  './js/dati/vista.js',
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const cache = await caches.open(VERSIONE);
    // addAll fallisce in blocco se manca un file: qui li aggiungo uno a uno,
    // così un modulo non ancora scritto non impedisce l'installazione.
    await Promise.all(GUSCIO.map(u => cache.add(u).catch(() => {})));
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const nomi = await caches.keys();
    await Promise.all(nomi.filter(n => n !== VERSIONE).map(n => caches.delete(n)));
    if (self.registration.navigationPreload) await self.registration.navigationPreload.disable();
    await self.clients.claim();
  })());
});

/* La pagina chiede di installare subito l'aggiornamento in attesa. */
self.addEventListener('message', e => {
  if (e.data === 'aggiorna-ora') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // niente cache per l'esterno

  // Navigazione: serve sempre il guscio, anche offline e anche sugli hash.
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      const cache = await caches.open(VERSIONE);
      const salvata = await cache.match('./index.html');
      if (salvata) {
        rinfresca(cache, './index.html');   // aggiorna in sottofondo
        return salvata;
      }
      try { return await fetch(req); }
      catch { return new Response('Non disponibile offline.', { status: 503 }); }
    })());
    return;
  }

  // Tutto il resto: prima la cache, rete solo se manca.
  e.respondWith((async () => {
    const cache = await caches.open(VERSIONE);
    const salvata = await cache.match(req, { ignoreSearch: true });
    if (salvata) { rinfresca(cache, req); return salvata; }
    try {
      const rete = await fetch(req);
      if (rete.ok) cache.put(req, rete.clone());
      return rete;
    } catch (err) {
      return new Response('Non disponibile offline.', { status: 503 });
    }
  })());
});

function rinfresca(cache, richiesta) {
  fetch(richiesta).then(r => { if (r.ok) cache.put(richiesta, r); }).catch(() => {});
}
