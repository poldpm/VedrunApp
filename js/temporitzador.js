/* ============================================================
   TEMPORITZADOR — temporitzador.js
   ------------------------------------------------------------
   «Cinc minuts i recollim.» Un compte enrere gran, per projectar
   a la paret, sense haver d'obrir cap altra pàgina.

   Demanat per la Imma (29/10/2026): no vol haver d'obrir el
   ClassroomScreen quan ja té aquesta app oberta tot el dia.

   ⚠ EINA OPCIONAL, I NEIX APAGADA. Només la té qui tingui

       window.EINES_TEMPORITZADOR = true;

   al seu `js/personal.js`. El codi arriba a totes les apps amb el
   `sync-totes.js`; s'encén només a qui la demani. L'entrada del
   catàleg (`js/millores.js`) porta
   `interruptor: 'EINES_TEMPORITZADOR'`.

   ------------------------------------------------------------
   ⚠ EL COMPTE NO ES VA RESTANT: ES CALCULA DE L'HORA D'ACABAR

   El parany clàssic d'un temporitzador és anar fent `queden--`
   cada segon. Sembla que vagi bé i no hi va: quan la pestanya
   passa a segon pla —la mestra canvia de finestra per posar un
   vídeo, o el portàtil s'adorm— el navegador frena o atura aquell
   rellotge, i en tornar falten minuts. Aquí es desa L'HORA
   D'ACABAR i el que es pinta sempre surt de restar-li l'hora
   d'ara, o sigui que torni quan torni, el número és el bo.

   Per això també sobreviu a canviar d'apartat dins de l'app i a
   tancar-la i tornar-la a obrir: l'hora d'acabar es guarda al
   navegador.

   ------------------------------------------------------------
   NO PARLA MAI AMB EL SERVIDOR

   Un temporitzador que depengui de la xarxa no serveix de res: es
   fa servir amb el projector engegat i la connexió que hi hagi.
   Tot és d'aquest navegador i prou. Tampoc no desa res al full de
   càlcul: no hi ha res a desar.
   ============================================================ */
(function () {
  'use strict';

  var CLAU = 'temporitzador_estat';
  var MINUTS_RAPIDS = [1, 2, 3, 5, 10, 15, 20, 30];

  /* L'estat: o compta (hi ha `fi`), o està aturat amb `queden` ms. */
  var _fi = null;        // hora (ms) en què s'acaba
  var _queden = 5 * 60 * 1000;
  var _tic = null;
  var _sonat = false;
  var _wake = null;      // perquè la pantalla no s'apagui projectant

  /* ---- L'interruptor. Es llegeix EN DIRECTE, no en carregar ----
     `js/personal.js` es carrega l'ÚLTIM de tots: en el moment en què
     aquest fitxer s'executa, `window.EINES_TEMPORITZADOR` encara no hi és. */
  function _hiEs() {
    try { return window.EINES_TEMPORITZADOR === true; } catch (e) { return false; }
  }

  function byId(id) { return document.getElementById(id); }

  /* ---- Desar i recuperar, perquè sobrevisqui a canviar d'apartat ---- */
  function _desa() {
    try {
      localStorage.setItem(CLAU, JSON.stringify({ fi: _fi, queden: _queden, sonat: _sonat }));
    } catch (e) {}
  }
  function _recupera() {
    try {
      var x = JSON.parse(localStorage.getItem(CLAU) || 'null');
      if (!x) return;
      if (typeof x.queden === 'number' && x.queden > 0) _queden = x.queden;
      _sonat = !!x.sonat;
      /* Un `fi` que ja ha passat fa estona no s'arrossega: si ahir el va
         deixar comptant, avui no li ha de sonar en obrir l'app. */
      if (typeof x.fi === 'number' && x.fi > Date.now()) _fi = x.fi;
    } catch (e) {}
  }

  /* ---- Quant queda, SEMPRE calculat de l'hora d'acabar ---- */
  function _restant() {
    if (_fi === null) return _queden;
    return Math.max(0, _fi - Date.now());
  }
  function _compta() { return _fi !== null; }

  function _text(ms) {
    var t = Math.ceil(ms / 1000);
    var m = Math.floor(t / 60), s = t % 60;
    return m + ':' + (s < 10 ? '0' + s : s);
  }

  /* ---- La pantalla ---- */
  function _pinta() {
    var n = byId('tempNum');
    if (!n) return;
    var ms = _restant();
    n.textContent = _text(ms);

    var caixa = byId('page-temporitzador');
    if (caixa) {
      caixa.classList.toggle('temp-acabat', ms <= 0 && _sonat);
      caixa.classList.toggle('temp-poc', ms > 0 && ms <= 10000);
    }
    var b = byId('tempEngega');
    if (b) b.textContent = _compta() ? 'Pausa' : (_restant() > 0 ? 'Comença' : 'Comença');
    var est = byId('tempEstat');
    if (est) {
      est.textContent = (ms <= 0 && _sonat) ? 'Temps!'
                      : _compta() ? 'Comptant…'
                      : 'Aturat';
    }
  }

  function _arrencaTic() {
    if (_tic) return;
    /* Quatre cops per segon: el número només canvia un cop, però així el
       salt no es nota quan el navegador s'ha pres el seu temps. */
    _tic = setInterval(function () {
      if (!_compta()) return;
      if (_restant() <= 0) _acaba();
      _pinta();
    }, 250);
  }
  function _aturaTic() {
    if (_tic) { clearInterval(_tic); _tic = null; }
  }

  /* ---- Que la pantalla no s'apagui mentre compta ----
     El portàtil connectat al projector s'adorm sol i deixa l'aula mirant
     una pantalla negra. Això ho demana al navegador; si diu que no (no
     tots el tenen), no passa res més: el compte segueix igual. */
  function _despertaOn() {
    try {
      if (!navigator.wakeLock || _wake) return;
      navigator.wakeLock.request('screen').then(function (w) { _wake = w; }).catch(function () {});
    } catch (e) {}
  }
  function _despertaOff() {
    try { if (_wake) { _wake.release(); _wake = null; } } catch (e) {}
  }

  /* ---- El so del final ----
     Es fa amb el so del navegador, sense cap fitxer: dues notes curtes i
     suaus. Els navegadors no deixen sonar res fins que algú ha clicat, i
     aquí sempre ve d'un clic a «Comença», o sigui que es pot. */
  function _so() {
    try {
      var C = window.AudioContext || window.webkitAudioContext;
      if (!C) return;
      var ctx = new C();
      [0, 0.22].forEach(function (quan, i) {
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine';
        o.frequency.value = i === 0 ? 880 : 1174;
        g.gain.setValueAtTime(0.0001, ctx.currentTime + quan);
        g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + quan + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + quan + 0.18);
        o.connect(g); g.connect(ctx.destination);
        o.start(ctx.currentTime + quan); o.stop(ctx.currentTime + quan + 0.2);
      });
      setTimeout(function () { try { ctx.close(); } catch (e) {} }, 900);
    } catch (e) {}
  }

  function _acaba() {
    _fi = null;
    _queden = 0;
    if (!_sonat) { _sonat = true; _so(); }
    _aturaTic();
    _despertaOff();
    _desa();
  }

  /* ---- El que fan els botons ---- */
  function engega() {
    if (_compta()) { pausa(); return; }
    var ms = _restant();
    if (ms <= 0) { posa(5); return; }      // acabat: el botó torna a servir per a alguna cosa
    _sonat = false;
    _fi = Date.now() + ms;
    _arrencaTic();
    _despertaOn();
    _desa();
    _pinta();
  }

  function pausa() {
    if (!_compta()) return;
    _queden = _restant();
    _fi = null;
    _aturaTic();
    _despertaOff();
    _desa();
    _pinta();
  }

  /* Posa N minuts i arrenca. Dos clics seguits al mateix botó no sumen:
     torna a començar d'aquells minuts, que és el que s'espera quan es
     clica «5 min» amb el compte ja engegat. */
  function posa(min) {
    _queden = Math.max(1, Math.round(min)) * 60 * 1000;
    _sonat = false;
    _fi = Date.now() + _queden;
    _arrencaTic();
    _despertaOn();
    _desa();
    _pinta();
  }

  /* Afegir o treure un minut sense parar el compte. */
  function suma(min) {
    var ms = _restant() + min * 60 * 1000;
    if (ms < 0) ms = 0;
    if (_compta()) { _fi = Date.now() + ms; if (ms > 0) _sonat = false; }
    else _queden = ms;
    if (ms === 0 && _compta()) _acaba();
    _desa();
    _pinta();
  }

  function atura() {
    _fi = null;
    _queden = 5 * 60 * 1000;
    _sonat = false;
    _aturaTic();
    _despertaOff();
    _desa();
    _pinta();
  }

  /* ---- Pantalla completa, per al projector ---- */
  function pantallaCompleta() {
    var el = byId('page-temporitzador');
    if (!el) return;
    try {
      if (document.fullscreenElement) { document.exitFullscreen(); return; }
      if (el.requestFullscreen) el.requestFullscreen().catch(function () {});
    } catch (e) {}
  }

  /* ---- Els botons de minuts, pintats des de la llista ---- */
  function _pintaRapids() {
    var w = byId('tempRapids');
    if (!w || w.dataset.fet === '1') return;
    w.innerHTML = MINUTS_RAPIDS.map(function (m) {
      return '<button type="button" class="temp-rapid" onclick="tempPosa(' + m + ')">' + m + ' min</button>';
    }).join('');
    w.dataset.fet = '1';
  }

  function obre() {
    _pintaRapids();
    /* Si estava comptant i torna a entrar, el tic s'ha de tornar a posar en
       marxa: en sortir de l'apartat no es para, però després d'una recàrrega
       de la pàgina sí que cal. */
    if (_compta()) _arrencaTic();
    _pinta();
  }

  function aplicaInterficie() {
    var b = byId('navTemporitzador');
    if (b) b.style.display = _hiEs() ? '' : 'none';
  }

  /* En obrir l'app: recupera l'estat i, si estava comptant, segueix. */
  function arrenca() {
    _recupera();
    if (_compta()) { _arrencaTic(); _despertaOn(); }
    aplicaInterficie();
    _pinta();
  }

  /* ⚠ La pantalla desperta es perd sola quan la pestanya passa al darrere
     (el navegador la retira). En tornar, s'ha de tornar a demanar o el
     portàtil s'adormirà a mitja activitat. */
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && _compta()) { _despertaOn(); _pinta(); }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', arrenca);
  } else {
    arrenca();
  }

  /* Les funcions que criden els botons van a `window` a posta: els
     `onclick` de l'index.html les han de poder trobar, i així
     `eines/comprova-controls.js` pot comprovar que existeixen. */
  window.tempEngega = engega;
  window.tempPosa = posa;
  window.tempSuma = suma;
  window.tempAtura = atura;
  window.tempPantallaCompleta = pantallaCompleta;

  window.Temporitzador = {
    hiEs: _hiEs,
    obre: obre,
    aplicaInterficie: aplicaInterficie,
    /* Per als bancs de proves: deixen mirar i moure el rellotge sense
       haver d'esperar-se cinc minuts de debò. */
    _restant: _restant,
    _compta: _compta,
    _posaFi: function (ms) { _fi = ms; _desa(); _pinta(); },
  };
})();
