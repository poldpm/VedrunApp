/* Service Worker — cache PWA + notificacions a les 7h */
const CACHE = 'vedruna-v224';
const ASSETS = [
  './', './index.html', './manual.html', './css/main.css',
  './js/espera.js', './js/pdfhorari.js', './js/millores.js', './js/rol.js', './js/config.local.js', './js/app.js', './js/notes.js', './js/seients.js', './js/perfil.js', './js/grupview.js', './js/postits.js', './js/horari.js', './js/vedrunu.js', './js/gwrite.js', './js/rubriques.js', './js/docents.js', './js/coordinacio.js', './js/regdocents.js', './js/segentrevistes.js', './js/entrevistes.js', './js/notescomp.js', './js/reunions.js', './js/versio.js', './img/vedrunu-icon.png',
  './manifest.webmanifest', './img/favicon.svg', './img/icon-192.png', './img/icon-512.png',
  './img/icon-192-maskable.png', './img/icon-512-maskable.png', './img/icon.png',
  './img/favicon.ico', './img/favicon-32.png', './img/favicon-16.png', './img/apple-touch-icon.png',
  /* ⚠ Aquests set faltaven (auditoria 6/9/2026), i el més important és el
     primer: `js/personal.js` és on van les personalitzacions de cada
     mestra. Sense connexió, l'app s'obria a mitges i just aquella part no
     hi era. Les sis imatges són els enllaços de la portada. */
  './js/personal.js',
  './img/logo-horitzontal.png', './img/link_gmail.png', './img/link_drive.png',
  './img/link_clickedu.png', './img/link_coordinacio.png', './img/link_classdojo.png',
];

/* ── Instal·lació i activació ── */
self.addEventListener('install',  e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));

/* ── Cache-first per assets, mai per Apps Script ── */
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = e.request.url;
  /* ⚠ EL SEGON DOMINI DEL SERVIDOR NO ERA A LA LLISTA.

     Segona auditoria (8/9/2026). La configuració accepta a posta dues adreces
     de servidor: script.google.com i script.googleusercontent.com (Google
     dóna l'una o l'altra segons com s'hagi desplegat). Aquí només hi havia la
     primera, o sigui que amb l'altra les respostes del servidor —amb els noms
     dels alumnes, les observacions i les notes a dins— s'anaven guardant al
     cache del navegador i s'hi quedaven per sempre. */
  if (url.includes('script.google.com') || url.includes('googleusercontent.com') ||
      url.includes('googleapis.com') || url.includes('generativelanguage')) return;
  // versio.json ha de venir SEMPRE del servidor: es el que detecta si el
  // navegador serveix codi antic. Si es guardes, no ho detectaria mai.
  if (url.includes('versio.json')) return;
  e.respondWith(
    // ⚠ ignoreSearch: des de la v174 els fitxers es demanen amb la versió a
    // l adreça (js/app.js?v=v174) perquè el navegador no en pugui servir una
    // còpia vella. Sense això, la còpia guardada com a "js/app.js" no
    // quadraria mai amb la petició i tot aniria sempre a la xarxa.
    caches.match(e.request, { ignoreSearch: true }).then(cached => {
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
  if (e.data?.type === 'SCHEDULE_NOTIF') {
    scheduleNotif(e.data.payload);
    /* I, sobretot, es desa on el service worker ho pugui llegir quan
       reviu: el temporitzador de sota se'l menja el navegador. */
    const p = e.data.payload || {};
    e.waitUntil(notifDesa({ avui: p.avui || todayStr(), items: p.items || [], jaDit: false }));
  }
  if (e.data?.type === 'CANCEL_NOTIF')  { cancelNotif(); e.waitUntil(notifDesa({ avui: '', items: [], jaDit: true })); }
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

/* ── Periodic background sync ─────────────────────────────────
   ⚠ AIXÒ NO FUNCIONAVA, I ERA IMPOSSIBLE QUE FUNCIONÉS.

   Trobat a l'auditoria del 6/9/2026. Hi havia dos camins per a l'avís del
   matí i cap dels dos podia arribar:

     · l'alarma era un `setTimeout` DINS del service worker, i el Chrome
       mata els service workers quan fa una estona que no fan res (~30 s):
       amb ells se n'anava el temporitzador. Comprovat aturant el service
       worker com fa el navegador: l'alarma no salta mai més.
     · el pla B llegia `self.registration.storage`, que NO és cap API del
       web (comprovat al Chrome: no existeix). A més, ningú no registrava
       mai cap `periodicSync` ni escrivia mai la clau `notifData`.

   Ara el que ha de sonar es desa a la **Cache API**, que el service worker
   sí que pot llegir quan reviu, i l'app registra de debò el `periodicSync`.
   El `setTimeout` es manté només com a cop de sort per si el service worker
   encara és viu a l'hora.

   ⚠ El `periodicSync` el decideix el navegador: arriba al matí, no
   necessàriament a les 7:00 en punt. Això es diu a la mestra tal com és. */
const NOTIF_CACHE = 'vedruna-notif';
const NOTIF_URL = './__notif-avui';

async function notifDesa(dades) {
  try {
    const c = await caches.open(NOTIF_CACHE);
    await c.put(NOTIF_URL, new Response(JSON.stringify(dades), {
      headers: { 'Content-Type': 'application/json' },
    }));
  } catch (e) {}
}
async function notifLlegeix() {
  try {
    const c = await caches.open(NOTIF_CACHE);
    const r = await c.match(NOTIF_URL);
    if (!r) return null;
    return await r.json();
  } catch (e) { return null; }
}

self.addEventListener('periodicsync', e => {
  if (e.tag === 'daily-notif') e.waitUntil(checkAndNotify());
});

async function checkAndNotify() {
  const store = await notifLlegeix();
  if (!store) return;
  const { avui, items, jaDit } = store;
  if (avui !== todayStr()) return;      // és d'un altre dia: no toca
  if (jaDit) return;                    // ja s'ha dit avui
  if (!items || !items.length) return;
  const body = items.slice(0, 3).map(i => '• ' + i).join('\n') + (items.length > 3 ? `\n… i ${items.length - 3} més` : '');
  fireNotif({ title: `Bon dia! Tens ${items.length} cosa${items.length > 1 ? 's' : ''} avui`, body });
  await notifDesa({ avui, items, jaDit: true });
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
