/* ============================================================
   TEMPORITZADOR — temporitzador.js
   ------------------------------------------------------------
   «Cinc minuts i recollim.» Comptes enrere grans, per projectar
   a la paret, sense haver d'obrir cap altra pàgina.

   Demanat per la Imma (29/10/2026): no vol haver d'obrir el
   ClassroomScreen quan ja té aquesta app oberta tot el dia. I el
   30/10, dues coses més que allà sí que té: un RELLOTGE DE
   BROQUES amb l'hora, i MÉS D'UN temporitzador alhora (mentre la
   feina de grup té vint minuts, la lectura en té cinc).

   ⚠ EINA OPCIONAL, I NEIX APAGADA. Només la té qui tingui

       window.EINES_TEMPORITZADOR = true;

   al seu `js/personal.js`. El codi arriba a totes les apps amb el
   `sync-totes.js`; s'encén només a qui la demani. L'entrada del
   catàleg (`js/millores.js`) porta
   `interruptor: 'EINES_TEMPORITZADOR'`.

   ------------------------------------------------------------
   ⚠ CAP COMPTE ES VA RESTANT: TOTS ES CALCULEN DE L'HORA D'ACABAR

   El parany clàssic és anar fent `queden--` cada segon. Sembla
   que vagi bé i no hi va: quan la pestanya passa a segon pla —la
   mestra canvia de finestra per posar un vídeo, o el portàtil
   s'adorm— el navegador frena o atura aquell rellotge, i en
   tornar falten minuts. Cada temporitzador desa L'HORA D'ACABAR
   i el que es pinta surt sempre de restar-li l'hora d'ara.

   Amb diversos alhora això encara importa més: si es restessin,
   cadascun aniria enrere per la seva banda i acabarien dient
   coses diferents.

   ------------------------------------------------------------
   ⚠ EL TIC NO POT REPINTAR LA LLISTA SENCERA

   Cada temporitzador té un nom que la mestra pot escriure. Si el
   tic de cada quart de segon tornés a pintar la llista, li
   esborraria el que està escrivint i li trauria el cursor. Per
   això hi ha dues pintades separades: `_pintaLlista()` quan la
   llista CANVIA (se n'afegeix o se'n treu un), i `_pintaNumeros()`
   a cada tic, que només toca els números i prou.

   ------------------------------------------------------------
   NO PARLA MAI AMB EL SERVIDOR

   Un temporitzador que depengui de la xarxa no serveix de res: es
   fa servir amb el projector engegat i la connexió que hi hagi.
   Tot és d'aquest navegador i prou.
   ============================================================ */
(function () {
  'use strict';

  var CLAU = 'temporitzador_estat';
  var CLAU_RELLOTGE = 'temporitzador_rellotge';
  var MINUTS_RAPIDS = [1, 2, 3, 5, 10, 15, 20, 30];
  var MAX = 6;                 // més de sis a la paret no es llegeixen

  /* Cada temporitzador: { id, nom, fi (ms) o null, queden (ms), sonat } */
  var _llista = [];
  var _tic = null;
  var _rellotge = true;
  var _wake = null;

  /* ---- L'interruptor. Es llegeix EN DIRECTE, no en carregar ----
     `js/personal.js` es carrega l'ÚLTIM de tots: en el moment en què
     aquest fitxer s'executa, `window.EINES_TEMPORITZADOR` encara no hi és. */
  function _hiEs() {
    try { return window.EINES_TEMPORITZADOR === true; } catch (e) { return false; }
  }

  function byId(id) { return document.getElementById(id); }
  function _esc(s) {
    return (typeof escapeHtml === 'function') ? escapeHtml(s) : String(s == null ? '' : s);
  }
  function _idNou() { return 't' + Date.now() + Math.random().toString(36).slice(2, 5); }

  /* ---- Desar i recuperar ---- */
  function _desa() {
    try { localStorage.setItem(CLAU, JSON.stringify(_llista)); } catch (e) {}
  }
  function _recupera() {
    var x = null;
    try { x = JSON.parse(localStorage.getItem(CLAU) || 'null'); } catch (e) { x = null; }

    /* ⚠ El que hi havia abans del 30/10 era UN temporitzador sol, desat com
       un objecte `{fi, queden, sonat}`. Si la mestra el tenia comptant, no
       se li pot perdre pel camí: es llegeix i es converteix en el primer de
       la llista. */
    if (x && !Array.isArray(x) && typeof x === 'object') {
      x = [{ id: _idNou(), nom: '', fi: (typeof x.fi === 'number' ? x.fi : null),
             queden: (typeof x.queden === 'number' ? x.queden : 5 * 60 * 1000),
             sonat: !!x.sonat }];
    }
    _llista = Array.isArray(x) ? x.filter(function (t) { return t && typeof t === 'object'; }) : [];

    /* Una hora d'acabar que ja ha passat no s'arrossega: si ahir el va deixar
       comptant, avui no li ha de sonar en obrir l'app. Es deixa a zero i
       aturat, que és el que ja era de debò. */
    var ara = Date.now();
    _llista.forEach(function (t) {
      if (typeof t.fi === 'number' && t.fi <= ara) { t.fi = null; t.queden = 0; t.sonat = true; }
      if (typeof t.queden !== 'number') t.queden = 5 * 60 * 1000;
      if (!t.id) t.id = _idNou();
      if (typeof t.nom !== 'string') t.nom = '';
    });
    if (_llista.length > MAX) _llista = _llista.slice(0, MAX);

    try { _rellotge = localStorage.getItem(CLAU_RELLOTGE) !== 'no'; } catch (e) { _rellotge = true; }
  }

  /* ---- Quant queda, SEMPRE calculat de l'hora d'acabar ---- */
  function _restant(t) {
    if (!t) return 0;
    if (t.fi === null || t.fi === undefined) return Math.max(0, t.queden || 0);
    return Math.max(0, t.fi - Date.now());
  }
  function _compta(t) { return !!(t && t.fi !== null && t.fi !== undefined); }
  function _algunCompta() { return _llista.some(_compta); }

  function _text(ms) {
    var tot = Math.ceil(ms / 1000);
    var h = Math.floor(tot / 3600), m = Math.floor((tot % 3600) / 60), s = tot % 60;
    var dd = function (n) { return n < 10 ? '0' + n : String(n); };
    return h > 0 ? (h + ':' + dd(m) + ':' + dd(s)) : (m + ':' + dd(s));
  }

  /* ============================================================
     EL RELLOTGE DE BROQUES
     ------------------------------------------------------------
     Es dibuixa un cop (l'esfera i les marques) i a cada segon
     només es giren les tres broques. Repintar-ho tot cada segon
     faria parpellejar la pantalla del projector.
     ============================================================ */
  function _dibuixaEsfera() {
    var w = byId('tempRellotge');
    if (!w || w.dataset.fet === '1') return;
    var marques = '';
    for (var i = 0; i < 60; i++) {
      var gran = (i % 5 === 0);
      marques += '<line x1="100" y1="' + (gran ? 14 : 18) + '" x2="100" y2="' + (gran ? 26 : 23) + '" ' +
                 'stroke="currentColor" stroke-width="' + (gran ? 3 : 1.2) + '" ' +
                 'stroke-linecap="round" opacity="' + (gran ? 0.85 : 0.35) + '" ' +
                 'transform="rotate(' + (i * 6) + ' 100 100)"/>';
    }
    w.innerHTML =
      '<svg viewBox="0 0 200 200" class="temp-rellotge-svg" role="img" aria-label="Hora actual">' +
        '<circle cx="100" cy="100" r="94" class="temp-esfera"/>' +
        marques +
        '<line id="tempBrocaH" x1="100" y1="110" x2="100" y2="52" class="temp-broca temp-broca-h"/>' +
        '<line id="tempBrocaM" x1="100" y1="114" x2="100" y2="30" class="temp-broca temp-broca-m"/>' +
        '<line id="tempBrocaS" x1="100" y1="118" x2="100" y2="24" class="temp-broca temp-broca-s"/>' +
        '<circle cx="100" cy="100" r="5" class="temp-centre"/>' +
      '</svg>' +
      '<p class="temp-hora-text" id="tempHoraText"></p>';
    w.dataset.fet = '1';
  }

  function _giraBroques() {
    var w = byId('tempRellotge');
    if (!w || !_rellotge || w.hidden) return;
    var d = new Date();
    var s = d.getSeconds(), m = d.getMinutes(), h = d.getHours() % 12;
    var gira = function (id, graus) {
      var el = byId(id);
      if (el) el.setAttribute('transform', 'rotate(' + graus + ' 100 100)');
    };
    gira('tempBrocaS', s * 6);
    gira('tempBrocaM', m * 6 + s * 0.1);
    gira('tempBrocaH', h * 30 + m * 0.5);
    var txt = byId('tempHoraText');
    if (txt) {
      var dd = function (n) { return n < 10 ? '0' + n : String(n); };
      txt.textContent = d.getHours() + ':' + dd(d.getMinutes());
    }
  }

  function rellotgeMostra(si) {
    _rellotge = !!si;
    try { localStorage.setItem(CLAU_RELLOTGE, _rellotge ? 'si' : 'no'); } catch (e) {}
    _aplicaRellotge();
  }
  function _aplicaRellotge() {
    var w = byId('tempRellotge');
    if (w) w.hidden = !_rellotge;
    var b = byId('tempRellotgeBtn');
    if (b) {
      b.textContent = _rellotge ? 'Amagar el rellotge' : 'Mostrar el rellotge';
      b.setAttribute('aria-pressed', _rellotge ? 'true' : 'false');
    }
    if (_rellotge) { _dibuixaEsfera(); _giraBroques(); }
    _mouElTic();
  }

  /* ============================================================
     EL TIC
     ------------------------------------------------------------
     Un de sol per a tot: els comptes i el rellotge. I només corre
     si hi ha alguna cosa que es mogui: amb tot aturat i el
     rellotge amagat, no cal despertar el navegador cada quart de
     segon.
     ============================================================ */
  function _mouElTic() {
    var cal = _rellotge || _algunCompta();
    if (cal && !_tic) {
      _tic = setInterval(function () {
        var caliaPintar = false;
        _llista.forEach(function (t) {
          if (_compta(t) && _restant(t) <= 0) { _acaba(t); caliaPintar = true; }
        });
        _pintaNumeros();
        _giraBroques();
        if (caliaPintar) _pintaLlista();
      }, 250);
    } else if (!cal && _tic) {
      clearInterval(_tic); _tic = null;
    }
  }

  /* ---- Que la pantalla no s'apagui mentre compta ----
     El portàtil connectat al projector s'adorm sol i deixa l'aula mirant
     una pantalla negra. Si el navegador diu que no, no passa res més. */
  function _desperta() {
    try {
      if (!navigator.wakeLock) return;
      if (_algunCompta() && !_wake) {
        navigator.wakeLock.request('screen').then(function (w) { _wake = w; }).catch(function () {});
      } else if (!_algunCompta() && _wake) {
        _wake.release(); _wake = null;
      }
    } catch (e) {}
  }

  /* ---- El so del final ----
     Dues notes curtes, sense cap fitxer. Els navegadors no deixen sonar res
     fins que algú ha clicat, i aquí sempre ve d'un clic previ. */
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

  function _acaba(t) {
    t.fi = null;
    t.queden = 0;
    /* ⚠ Si n'acaben dos alhora, un sol so. Dos xiulets encavalcats no es
       distingeixen i només fan soroll. */
    if (!t.sonat) { t.sonat = true; _so(); }
    _desa();
    _desperta();
  }

  /* ---- El que fan els botons ---- */
  function _tro(id) {
    return _llista.filter(function (t) { return t.id === id; })[0] || null;
  }

  function afegeix(min) {
    if (_llista.length >= MAX) {
      if (typeof showToast === 'function') {
        showToast('Ja en tens ' + MAX + '. A la paret, més no es llegeixen: para\'n o treu-ne un.', 'info');
      }
      return;
    }
    var t = { id: _idNou(), nom: '', fi: null, queden: Math.max(1, Math.round(min)) * 60 * 1000, sonat: false };
    t.fi = Date.now() + t.queden;          // neix comptant: és el que s'espera en clicar «5 min»
    _llista.push(t);
    _desa(); _pintaLlista(); _mouElTic(); _desperta();
  }

  function engega(id) {
    var t = _tro(id); if (!t) return;
    if (_compta(t)) {                      // compta: pausa
      t.queden = _restant(t);
      t.fi = null;
    } else {
      if (_restant(t) <= 0) return;        // acabat: no arrenca de zero tot sol
      t.sonat = false;
      t.fi = Date.now() + _restant(t);
    }
    _desa(); _pintaLlista(); _mouElTic(); _desperta();
  }

  function suma(id, min) {
    var t = _tro(id); if (!t) return;
    var ms = _restant(t) + min * 60 * 1000;
    if (ms < 0) ms = 0;
    if (_compta(t)) {
      if (ms === 0) { _acaba(t); }
      else { t.fi = Date.now() + ms; t.sonat = false; }
    } else {
      t.queden = ms;
      if (ms > 0) t.sonat = false;
    }
    _desa(); _pintaLlista(); _mouElTic();
  }

  function treu(id) {
    _llista = _llista.filter(function (t) { return t.id !== id; });
    _desa(); _pintaLlista(); _mouElTic(); _desperta();
  }

  function anomena(id, nom) {
    var t = _tro(id); if (!t) return;
    t.nom = String(nom || '').slice(0, 40);
    _desa();                                // NO es repinta: hi està escrivint
  }

  function pantallaCompleta() {
    var el = byId('page-temporitzador');
    if (!el) return;
    try {
      if (document.fullscreenElement) { document.exitFullscreen(); return; }
      if (el.requestFullscreen) el.requestFullscreen().catch(function () {});
    } catch (e) {}
  }

  /* ---- Les pintades ---- */
  function _pintaRapids() {
    var w = byId('tempRapids');
    if (!w || w.dataset.fet === '1') return;
    w.innerHTML = MINUTS_RAPIDS.map(function (m) {
      return '<button type="button" class="temp-rapid" onclick="tempAfegeix(' + m + ')">+ ' + m + ' min</button>';
    }).join('');
    w.dataset.fet = '1';
  }

  /* La llista SENCERA. Només quan canvia què hi ha, mai a cada tic: veure
     l'avís de dalt del fitxer (el nom que està escrivint). */
  function _pintaLlista() {
    var w = byId('tempLlista');
    if (!w) return;
    if (!_llista.length) {
      w.innerHTML = '<p class="modal-hint temp-buit">Clica els minuts que vols i el temporitzador comença. ' +
                    'Pots tenir-ne uns quants alhora.</p>';
      return;
    }
    w.innerHTML = _llista.map(function (t) {
      var ms = _restant(t);
      var acabat = (ms <= 0);
      return '<div class="temp-card' + (acabat ? ' acabat' : (ms <= 10000 ? ' poc' : '')) + '" data-id="' + _esc(t.id) + '">' +
        '<input class="temp-nom" type="text" value="' + _esc(t.nom) + '" maxlength="40" ' +
          'placeholder="Sense nom" aria-label="Nom del temporitzador" ' +
          'oninput="tempAnomena(\'' + _esc(t.id) + '\', this.value)">' +
        '<div class="temp-card-num" data-num="' + _esc(t.id) + '">' + _text(ms) + '</div>' +
        '<div class="temp-card-botons">' +
          '<button type="button" class="btn btn-ghost btn-sm" onclick="tempSuma(\'' + _esc(t.id) + '\', -1)" title="Un minut menys">−1</button>' +
          '<button type="button" class="btn ' + (_compta(t) ? 'btn-ghost' : 'btn-primary') + ' btn-sm temp-anar" ' +
            'onclick="tempEngega(\'' + _esc(t.id) + '\')"' + (acabat && !_compta(t) ? ' disabled' : '') + '>' +
            (_compta(t) ? 'Pausa' : 'Comença') + '</button>' +
          '<button type="button" class="btn btn-ghost btn-sm" onclick="tempSuma(\'' + _esc(t.id) + '\', 1)" title="Un minut més">+1</button>' +
          '<button type="button" class="cal2-agendar-del" onclick="tempTreu(\'' + _esc(t.id) + '\')" title="Treu aquest temporitzador">×</button>' +
        '</div>' +
        '<p class="temp-card-estat">' + (acabat ? 'Temps!' : (_compta(t) ? 'Comptant…' : 'Aturat')) + '</p>' +
      '</div>';
    }).join('');
  }

  /* A cada tic: NOMÉS els números i la marca de poc/acabat. */
  function _pintaNumeros() {
    _llista.forEach(function (t) {
      var n = document.querySelector('[data-num="' + t.id + '"]');
      if (!n) return;
      var ms = _restant(t);
      var txt = _text(ms);
      if (n.textContent !== txt) n.textContent = txt;
      var card = n.closest ? n.closest('.temp-card') : null;
      if (card) {
        card.classList.toggle('acabat', ms <= 0);
        card.classList.toggle('poc', ms > 0 && ms <= 10000);
      }
    });
  }

  function obre() {
    _pintaRapids();
    _aplicaRellotge();
    _pintaLlista();
    _pintaNumeros();
    _mouElTic();
  }

  function aplicaInterficie() {
    var b = byId('navTemporitzador');
    if (b) b.style.display = _hiEs() ? '' : 'none';
  }

  function arrenca() {
    _recupera();
    aplicaInterficie();
    _mouElTic();
    _desperta();
  }

  /* ⚠ La pantalla desperta es perd sola quan la pestanya passa al darrere
     (el navegador la retira). En tornar, s'ha de tornar a demanar o el
     portàtil s'adormirà a mitja activitat. I es repinta, perquè mentre no
     es mirava el tic pot haver anat a la seva. */
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'visible') return;
    _desperta();
    _pintaNumeros();
    _giraBroques();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', arrenca);
  } else {
    arrenca();
  }

  /* Les funcions que criden els botons van a `window` a posta: els
     `onclick` de l'index.html les han de poder trobar, i així
     `eines/comprova-controls.js` pot comprovar que existeixen. */
  window.tempAfegeix = afegeix;
  window.tempEngega = engega;
  window.tempSuma = suma;
  window.tempTreu = treu;
  window.tempAnomena = anomena;
  window.tempRellotge = function () { rellotgeMostra(!_rellotge); };
  window.tempPantallaCompleta = pantallaCompleta;

  window.Temporitzador = {
    hiEs: _hiEs,
    obre: obre,
    aplicaInterficie: aplicaInterficie,
    /* Per als bancs de proves: deixen mirar i moure els rellotges sense
       haver d'esperar-se cinc minuts de debò. */
    _llista: function () { return _llista; },
    _restant: _restant,
    _compta: _compta,
    _rellotgeEs: function () { return _rellotge; },
    _posaFi: function (id, ms) { var t = _tro(id); if (t) { t.fi = ms; _desa(); _pintaLlista(); _mouElTic(); } },
  };
})();
