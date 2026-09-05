/* ============================================================
   AVÍS DE VERSIÓ NOVA
   ------------------------------------------------------------
   El problema que resol: l'app és una PWA i el navegador es queda
   la còpia guardada. Quan es puja una versió nova, el mestre pot
   continuar dies amb l'antiga sense saber-ho (i pensant-se que els
   canvis no funcionen).

   Com ho detecta: aquest fitxer porta a dins la versió amb què s'ha
   servit (VERSIO_APP) i demana a la xarxa `versio.json`, que SEMPRE ve
   del servidor (el service worker no el guarda). Si no coincideixen, és
   que el navegador serveix codi antic.

   Què fa: un avís amb què s'ha actualitzat i un botó que ho arregla sol
   (esborra la còpia guardada i recarrega). La drecera manual hi és com a
   reserva, perquè de vegades el Ctrl+Shift+R sol no n'hi ha prou.

   ⚠ En pujar una versió: canvia VERSIO_APP aquí, el CACHE del sw.js i la
   versió i els canvis del versio.json. Els tres han d'anar junts.
   ============================================================ */
(function () {
  'use strict';

  var VERSIO_APP = 'v188';   // ← ha de coincidir amb el CACHE del sw.js

  /* La versió MÉS VELLA del Code.gs amb què aquesta app encara funciona.
     ------------------------------------------------------------------
     No és la versió d'ara: és el mínim. Abans es comparava la igualtat,
     i llavors un canvi de només CSS ja feia sortir la franja groga i
     obligava la mestra a redesplegar el servidor per no res.

     ⚠ Aquesta línia NOMÉS es puja quan l'app deixa de funcionar amb el
     servidor d'abans: una acció nova al Code.gs, un camp nou que el
     navegador espera... Si el canvi és de pantalla, NO es toca. */
  var BACKEND_MINIM = 'v183';

  var K_AJORNAT  = 'versio_ajornada';
  /* ⚠ EL BUCLE DEL 4/9/2026.
     L'app d'en Pol va entrar en bucle: sortia l'avís de versió nova, ell
     clicava "Actualitzar ara", i dos segons després tornava a sortir. La
     recàrrega demanava l'index.html amb una adreça nova, però els fitxers
     js/ es tornaven a llegir de la còpia guardada del navegador: la versió
     no canviava mai.

     L'arranjament de debò és la versió a l'adreça de cada fitxer (ho fa
     eines/puja-versio.js). Això d'aquí és la xarxa: si ja ho hem provat i
     la versió segueix sense quadrar, NO es torna a preguntar. Es diu un
     cop, amb una franja discreta, i es deixa treballar.

     Un avís que torna cada dos segons no és un avís: és una app trencada. */
  var K_INTENT   = 'versio_intent';
  var ESPERA_MS  = 10 * 60 * 1000;   // deu minuts

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (m) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[m];
    });
  }

  function llegeixIntent() {
    try { return JSON.parse(sessionStorage.getItem(K_INTENT) || 'null'); } catch (e) { return null; }
  }
  function desaIntent(versio) {
    var v = llegeixIntent();
    var n = (v && v.versio === versio ? (v.vegades || 0) : 0) + 1;
    try { sessionStorage.setItem(K_INTENT, JSON.stringify({ versio: versio, quan: Date.now(), vegades: n })); } catch (e) {}
  }
  function oblidaIntent() { try { sessionStorage.removeItem(K_INTENT); } catch (e) {} }

  /* La franja discreta per quan ja ho hem provat i no ha arribat. No
     interromp: diu què passa i deixa treballar. */
  function avisDiscret(info) {
    if (document.getElementById('verFranja')) return;
    var d = document.createElement('div');
    d.id = 'verFranja';
    d.className = 'ver-franja';
    d.setAttribute('role', 'status');
    d.innerHTML =
      '<span>Hi ha una versió nova (la ' + esc(info.versio) + ') i encara està arribant. ' +
      'Pot trigar uns minuts; mentrestant pots seguir treballant.</span>' +
      '<button class="btn btn-secondary btn-sm" id="verFranjaX">D\'acord</button>';
    document.body.insertBefore(d, document.body.firstChild);
    var x = document.getElementById('verFranjaX');
    if (x) x.addEventListener('click', function () { d.remove(); });
  }

  // Esborra la còpia guardada i torna a carregar. És el que de debò
  // desencalla el navegador quan el Ctrl+Shift+R no n'hi ha prou.
  async function actualitza(btn, versio) {
    desaIntent(versio || '');
    if (btn) { btn.disabled = true; btn.textContent = 'Actualitzant…'; }
    try {
      if (navigator.serviceWorker) {
        var regs = await navigator.serviceWorker.getRegistrations();
        for (var i = 0; i < regs.length; i++) { try { await regs[i].unregister(); } catch (e) {} }
      }
    } catch (e) {}
    try {
      var claus = await caches.keys();
      for (var j = 0; j < claus.length; j++) { try { await caches.delete(claus[j]); } catch (e) {} }
    } catch (e) {}
    try { localStorage.removeItem(K_AJORNAT); } catch (e) {}
    // Recàrrega amb trencacaches, per si el navegador encara s'hi resisteix
    var u = new URL(location.href);
    u.searchParams.set('_v', Date.now());
    location.replace(u.toString());
  }

  function mostra(info) {
    if (document.getElementById('verOverlay')) return;

    var canvis = Array.isArray(info.canvis) ? info.canvis : [];
    var ov = document.createElement('div');
    ov.className = 'modal-overlay open';
    ov.id = 'verOverlay';

    ov.innerHTML =
      '<div class="modal ver-modal">' +
        '<div class="modal-header">' +
          '<div>' +
            '<div class="modal-header-title">Hi ha una versió nova de l\'app</div>' +
            '<div class="modal-header-sub">Tens la ' + esc(VERSIO_APP) + ' i ja hi ha la ' + esc(info.versio || '') + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="modal-body">' +
          (canvis.length
            ? '<div class="ver-titol">' + esc(info.titol || 'Què s\'ha actualitzat') + '</div>' +
              '<ul class="ver-llista">' +
                canvis.map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') +
              '</ul>'
            : '<p class="ver-titol">S\'han fet millores a l\'app.</p>') +
          '<div class="ver-ajuda">' +
            'Prem <strong>Actualitzar ara</strong> i l\'app es posarà al dia sola. ' +
            'Si algun cop no acaba de funcionar, tanca-la del tot i torna-la a obrir, ' +
            'o prem <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>R</kbd> ' +
            '(al Mac, <kbd>Cmd</kbd> + <kbd>Shift</kbd> + <kbd>R</kbd>).' +
          '</div>' +
        '</div>' +
        '<div class="modal-footer">' +
          '<button class="btn btn-secondary" id="verDespres">Ara no</button>' +
          '<button class="btn btn-primary" id="verAra">Actualitzar ara</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(ov);
    document.getElementById('verAra').addEventListener('click', function () { actualitza(this, info.versio); });
    document.getElementById('verDespres').addEventListener('click', function () {
      // Només per aquesta versió: si en surt una altra, es tornarà a avisar.
      try { localStorage.setItem(K_AJORNAT, info.versio || ''); } catch (e) {}
      ov.remove();
    });
  }

  async function comprova() {
    try {
      // Sempre de la xarxa: si vingués de la còpia guardada, diria la versió antiga
      var r = await fetch('versio.json?_=' + Date.now(), { cache: 'no-store' });
      if (!r.ok) return;
      var info = await r.json();
      if (!info || !info.versio) return;
      if (info.versio === VERSIO_APP) { oblidaIntent(); return; }   // ja està al dia

      // Ja ho hem provat i no ha arribat: no es torna a preguntar.
      var intent = llegeixIntent();
      if (intent && intent.versio === info.versio && (Date.now() - intent.quan) < ESPERA_MS) {
        avisDiscret(info);
        return;
      }
      var ajornada = null;
      try { ajornada = localStorage.getItem(K_AJORNAT); } catch (e) {}
      if (ajornada === info.versio) return;                // ja ha dit "ara no"
      mostra(info);
    } catch (e) { /* sense connexió: no molestem */ }
  }

  // Una mica després d'arrencar, per no competir amb la càrrega inicial
  function init() { setTimeout(comprova, 2500); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.versioApp = { actual: VERSIO_APP, minimServidor: BACKEND_MINIM,
                       comprova: comprova, actualitza: actualitza };
})();
