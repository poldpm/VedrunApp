/* Service Worker — cache PWA + notificacions a les 7h */
const CACHE = 'vedruna-v173';
const ASSETS = [
  './', './index.html', './manual.html', './css/main.css',
  './js/rol.js', './js/config.local.js', './js/app.js', './js/notes.js', './js/seients.js', './js/perfil.js', './js/grupview.js', './js/postits.js', './js/horari.js', './js/vedrunu.js', './js/gwrite.js', './js/rubriques.js', './js/docents.js', './js/coordinacio.js', './js/regdocents.js', './js/segentrevistes.js', './js/entrevistes.js', './js/notescomp.js', './js/reunions.js', './js/versio.js', './img/vedrunu-icon.png',
  './manifest.webmanifest', './img/favicon.svg', './img/icon-192.png', './img/icon-512.png',
  './img/icon-192-maskable.png', './img/icon-512-maskable.png', './img/icon.png',
  './img/favicon.ico', './img/favicon-32.png', './img/favicon-16.png', './img/apple-touch-icon.png',
];

/* ── Instal·lació i activació ── */
self.addEventListener('install',  e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));

/* ── Cache-first per assets, mai per Apps Script ── */
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = e.request.url;
  if (url.includes('script.google.com') || url.includes('googleapis.com') || url.includes('generativelanguage')) return;
  // versio.json ha de venir SEMPRE del servidor: es el que detecta si el
  // navegador serveix codi antic. Si es guardes, no ho detectaria mai.
  if (url.includes('versio.json')) return;
  e.respondWith(
    caches.match(e.request).then(cached => {
      // Si el tenim en cache, el servim DIRECTAMENT (sense tornar a demanar-lo a
      // la xarxa): els assets es versionen amb CACHE, així que quan es puja una
      // versió nova el sw ja els refresca sol. Això estalvia moltes peticions
      // per càrrega i fa l'app molt més ràpida i lleugera.
      if (cached) return cached;
      // Si no el tenim, el demanem i el desem per a la propera vegada.
      return fetch(e.request).then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => cached);
    })
  );
});

/* ── Notificacions: missatges des de l'app ── */
self.addEventListener('message', e => {
  if (e.data?.type === 'SCHEDULE_NOTIF') scheduleNotif(e.data.payload);
  if (e.data?.type === 'CANCEL_NOTIF')  cancelNotif();
  if (e.data?.type === 'TEST_NOTIF')    fireNotif(e.data.payload);
});

/* ── Alarma programada (setTimeout) ── */
let _timer = null;

function cancelNotif() {
  if (_timer) { clearTimeout(_timer); _timer = null; }
}

function scheduleNotif(payload) {
  cancelNotif();
  const now   = Date.now();
  const delay = payload.fireAt - now;
  if (delay < 0) return; // ja ha passat
  _timer = setTimeout(() => fireNotif(payload), delay);
}

function fireNotif(payload) {
  const { title, body, items } = payload;
  self.registration.showNotification(title || 'Gestió de Curs', {
    body:    body || '',
    icon:    './img/icon-192.png',
    badge:   './img/icon-192.png',
    tag:     'vedruna-daily',
    renotify: true,
    data:    { url: self.registration.scope },
    actions: items?.length ? [{ action: 'open', title: 'Obrir app' }] : [],
  });
}

/* ── Clic a la notificació ── */
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: 'window' }).then(cs => {
    const c = cs.find(c => c.url.startsWith(self.registration.scope));
    if (c) { c.focus(); return; }
    return clients.openWindow(self.registration.scope);
  }));
});

/* ── Periodic background sync (quan el navegador el suporta) ── */
self.addEventListener('periodicsync', e => {
  if (e.tag === 'daily-notif') e.waitUntil(checkAndNotify());
});

async function checkAndNotify() {
  // Recupera les dades guardades per l'app
  const store = await self.registration.storage?.get('notifData').catch(() => null);
  if (!store) return;
  const { avui, items } = store;
  if (avui !== todayStr()) return; // data diferent, no toca
  if (!items?.length) return;
  const body = items.slice(0, 3).map(i => '• ' + i).join('\n') + (items.length > 3 ? `\n… i ${items.length - 3} més` : '');
  fireNotif({ title: `Bon dia! Tens ${items.length} cosa${items.length > 1 ? 's' : ''} avui`, body });
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
