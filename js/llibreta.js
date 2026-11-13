/* ============================================================
   LA MEVA LLIBRETA — llibreta.js
   ------------------------------------------------------------
   «Des que tinc l'app he llençat la llibreta de paper, però em falta
   un lloc on apuntar-me coses.» Una mestra, 13/11/2026, explicant
   què feia amb la llibreta: les reunions de cicle («3r A marxa el 14,
   3r B el 21, nosaltres el 28»), els acords, el que ha de tenir en
   compte. Abans ho portava en una llibreta de mà i en un Excel que
   es trepitjava entre l'ordinador i el mòbil.

   ⚠ PER QUÈ NO ÉS UN POST-IT, QUE JA EL TENÍEM.

   Un post-it és una TARGETA amb una cosa a fer, en una paret. Això
   és una LLIBRETA: text seguit, d'un dia, que no s'esborra i que es
   torna a llegir mesos després. Tres diferències que no es poden
   salvar amb un post-it més gran:

     · L'eix és el dia que s'escriu, no la data en què t'ho han de
       recordar (al post-it, la data és un recordatori).
     · Una reunió són vuit línies que van juntes i en ordre, no vuit
       targetes escampades per la paret.
     · Es busca. Amb cinquanta anotacions, trobar «el bus» mirant una
       paret de targetes no es pot fer; amb un cercador, sí.

   ⚠ EINA OPCIONAL, I NEIX APAGADA. Només la té qui tingui

       window.EINES_LLIBRETA = true;

   al seu `js/personal.js`. El codi arriba a totes les apps amb el
   `sync-totes.js`; s'encén només a qui la demani. L'entrada del
   catàleg (`js/millores.js`) porta `interruptor: 'EINES_LLIBRETA'`.

   ------------------------------------------------------------
   D'UNA LÍNIA SE'N POT FER UNA TASCA O UN EVENT

   A cada línia hi ha dos botonets: un obre la finestra de SEMPRE de
   Tasques i l'altre la de SEMPRE del Calendari, amb el text ja posat.
   No es crea res a l'esquena de la mestra: ella acaba de dir la data
   o la categoria i desa. Així la tasca acaba a Tasques de debò i
   l'event al Calendari de debò, sense una tercera llista a part que
   després ningú no mira.

   Es recorda què ha sortit d'on (`tasques` i `events` de l'anotació,
   pel TEXT de la línia) perquè la línia ho pugui dir i no se'n facin
   dues sense voler. Es guarda pel text i no per la posició: si es
   retoca l'anotació i les línies ballen, la marca segueix la línia.

   ------------------------------------------------------------
   ON ES DESA

   Al full de la mestra (`_AppData`, clau `llibreta`), fusionat
   ANOTACIÓ PER ANOTACIÓ amb `_fusionaPerId_`, com els post-its i les
   tasques. És el que fa que escriure al mòbil durant la reunió i a
   l'ordinador a la tarda no es trepitgi: justament el que li passava
   amb l'Excel.
   ============================================================ */
(function () {
  'use strict';

  var CLAU = 'llibreta';
  var _anot = [];          // [{ id, data, text, etiq[], ts, tasques[], events[] }]
  var _cerca = '';
  var _filtre = '';        // etiqueta triada, o ''
  var _editId = null;
  var _carregat = false;
  var _servidorVell = false;   // la biblioteca encara no sap desar la llibreta

  /* L'interruptor es llegeix EN DIRECTE: `js/personal.js` es carrega
     l'últim i quan aquest fitxer s'executa encara no hi és. */
  function _hiEs() {
    try { return window.EINES_LLIBRETA === true; } catch (e) { return false; }
  }

  function byId(id) { return document.getElementById(id); }
  function _esc(s) {
    return (typeof escapeHtml === 'function') ? escapeHtml(s) : String(s == null ? '' : s);
  }
  function _avis(t, k) { if (typeof showToast === 'function') showToast(t, k || 'success'); }

  /* ---- Dates ---- */
  var DIES = ['Diumenge', 'Dilluns', 'Dimarts', 'Dimecres', 'Dijous', 'Divendres', 'Dissabte'];
  var MESOS = ['gener', 'febrer', 'març', 'abril', 'maig', 'juny',
               'juliol', 'agost', 'setembre', 'octubre', 'novembre', 'desembre'];
  function _avui() {
    var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  /* «de» o «d'» segons el mes: «13 de novembre», «1 d'octubre». */
  function _prep(m) { return /^[aeiouàèéíòóú]/i.test(m) ? 'd\'' + m : 'de ' + m; }
  function _dataText(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ''))) return '';
    var p = String(iso).split('-');
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    if (isNaN(d.getTime())) return '';
    var txt = DIES[d.getDay()] + ', ' + (+p[2]) + ' ' + _prep(MESOS[+p[1] - 1]);
    var ara = new Date();
    if (d.getFullYear() !== ara.getFullYear()) txt += ' de ' + p[0];
    if (iso === _avui()) txt += ' · avui';
    return txt;
  }

  /* ---- Cercar sense accents ni majúscules ----
     «Sortida» ha de trobar «sortida» i «sortides», i «mati» ha de trobar
     «matí»: qui busca una cosa seva no es recorda de com la va accentuar. */
  function _net(s) {
    return String(s == null ? '' : s).toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  /* ---- Les línies d'una anotació ----
     ⚠ ES VEU TAL COM S'ESCRIU, GUIONETS INCLOSOS (13/11/2026).

     La primera versió treia el pic del davant («- », «· », «• ») també per
     ENSENYAR-HO, i l'Aida, el mateix dia: «poso guionets davant de les
     frases, però em desapareixen». I tenia raó: una llibreta ha de dir el
     que hi has escrit. El pic només es treu per al TÍTOL de la tasca o de
     l'event, que allà sí que ha de dir «Demanar el bus» i no «- Demanar el
     bus». Veure `_treuPic`. */
  function _linies(text) {
    return String(text || '').split('\n').map(function (l) { return l.trim(); })
      .filter(function (l) { return l.length > 0; });
  }
  function _treuPic(l) {
    return String(l || '').replace(/^\s*[-–—·•*>]+\s*/, '').trim();
  }
  /* Per comparar una línia amb el que ja s'ha convertit en tasca o event:
     sense pic, sense accents i en minúscules. Sense treure el pic, les
     marques desades amb la versió d'abans deixarien de quadrar. */
  function _netLin(l) { return _net(_treuPic(l)); }

  /* ---- Carregar i desar ---- */
  function _cache() {
    try {
      var c = JSON.parse(localStorage.getItem(CLAU) || 'null');
      /* Una entrada nul·la d'una sincronització a mig fer no pot endur-se la
         pantalla sencera: és el que va passar amb els post-its (8/9/2026). */
      if (Array.isArray(c)) _anot = c.filter(function (a) { return a && typeof a === 'object'; });
    } catch (e) {}
  }

  function _desa() {
    try { localStorage.setItem(CLAU, JSON.stringify(_anot)); } catch (e) {}
    if (typeof config === 'undefined' || !config.scriptUrl) return;
    var cos = { action: 'saveLlibreta', llibreta: _anot };
    /* El `base` diu al servidor què havia vist aquesta pestanya: sense això,
       dues pestanyes obertes s'esborren les anotacions l'una a l'altra. */
    try { cos.base = localStorage.getItem(CLAU + '_base') || ''; } catch (e) {}
    if (typeof _desaAlFull === 'function') {
      _desaAlFull(cos).then(function (r) {
        if (r && r.ok && r.ts) { try { localStorage.setItem(CLAU + '_base', String(r.ts)); } catch (e) {} }
      });
    } else if (typeof appsScriptPost === 'function') {
      appsScriptPost(cos).catch(function () { _avis('No s\'ha pogut desar l\'anotació', 'error'); });
    }
  }

  async function _carrega() {
    if (typeof config === 'undefined' || !config.scriptUrl) return;
    if (typeof appsScriptGet !== 'function') return;
    try {
      var r = await appsScriptGet({ action: 'loadLlibreta', _fons: true });
      /* ⚠ EL SERVIDOR QUE ENCARA NO SAP QUÈ ÉS LA LLIBRETA.

         L'eina és nova: si la biblioteca de l'Apps Script encara és la
         d'abans, l'acció no hi és i el que s'escrigui es quedaria NOMÉS en
         aquest aparell, sense que res ho digués —i una llibreta que es perd
         en canviar de telèfon no serveix de res.

         Això no puja el `BACKEND_MINIM`: la franja groga de «servidor
         endarrerit» sortiria a totes les mestres, també a les sis que no
         tenen aquesta eina, i un avís que no va amb tu ensenya a no fer cas
         dels avisos. Ho diu aquí, a qui li toca. */
      if (r && r.ok === false && /desconeguda/i.test(String(r.error || ''))) {
        _servidorVell = true;
        _pinta();
        return;
      }
      _servidorVell = false;
      if (r && r.ok && Array.isArray(r.llibreta) &&
          !(typeof _pendentsTe === 'function' && _pendentsTe('saveLlibreta'))) {
        _anot = r.llibreta.filter(function (a) { return a && typeof a === 'object'; });
        try { localStorage.setItem(CLAU, JSON.stringify(_anot)); } catch (e) {}
        if (r.base) { try { localStorage.setItem(CLAU + '_base', String(r.base)); } catch (e) {} }
        _carregat = true;
        _pinta();
      }
    } catch (e) { /* silenci: ja tenim el cache */ }
  }

  /* ---- Etiquetes ---- */
  function _totesEtiquetes() {
    var vist = {}, out = [];
    _anot.forEach(function (a) {
      (a.etiq || []).forEach(function (e) {
        var k = _net(e);
        if (!k || vist[k]) return;
        vist[k] = 1; out.push(e);
      });
    });
    return out.sort(function (a, b) { return a.localeCompare(b, 'ca'); });
  }
  function _lletEtiq(s) {
    return String(s || '').split(',').map(function (x) { return x.trim(); })
      .filter(function (x) { return x.length > 0; }).slice(0, 8);
  }

  /* ---- Què es veu ara ---- */
  function _visibles() {
    var q = _net(_cerca).trim();
    var f = _net(_filtre);
    return _anot.filter(function (a) {
      if (f && !(a.etiq || []).some(function (e) { return _net(e) === f; })) return false;
      if (!q) return true;
      var dins = _net(a.text) + ' ' + _net((a.etiq || []).join(' ')) + ' ' + _net(_dataText(a.data));
      return dins.indexOf(q) !== -1;
    }).sort(function (a, b) {
      if (a.data !== b.data) return a.data < b.data ? 1 : -1;   // l'última a dalt
      return (b.ts || 0) - (a.ts || 0);
    });
  }

  /* ---- Pintar ---- */
  function _pinta() {
    var cont = byId('llibretaLlista');
    if (!cont) return;
    _pintaEtiquetes();

    var avis = '';
    if (_servidorVell) {
      avis = '<div class="callout-app warn" style="margin:0 0 14px">' +
        '<strong>El que escriguis es queda en aquest aparell.</strong> El servidor de la teva app ' +
        'encara no sap desar la llibreta: avisa en Pol i, quan ell hi hagi enganxat el codi nou, ' +
        'tot el que hi tinguis pujarà sol i el veuràs també al mòbil.</div>';
    }

    var llista = _visibles();
    if (!_anot.length) {
      cont.innerHTML = avis + '<div class="llib-buit">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" width="44" height="44">' +
        '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>' +
        '<p>La llibreta encara és en blanc.<br>Escriu a dalt el que no vols oblidar: ' +
        'el que s\'ha dit a una reunió, un acord, una cosa a tenir en compte.</p></div>';
      return;
    }
    if (!llista.length) {
      cont.innerHTML = avis + '<div class="llib-buit"><p>Cap anotació' +
        (_cerca ? ' amb «' + _esc(_cerca) + '»' : '') +
        (_filtre ? ' de «' + _esc(_filtre) + '»' : '') + '.</p></div>';
      return;
    }

    var h = avis;
    if (_cerca || _filtre) {
      h += '<p class="llib-compte">' + llista.length +
           (llista.length === 1 ? ' anotació' : ' anotacions') + ' de ' + _anot.length + '.</p>';
    }
    var diaAra = '';
    llista.forEach(function (a) {
      if (a.data !== diaAra) {
        diaAra = a.data;
        h += '<h2 class="llib-dia">' + _esc(_dataText(a.data) || 'Sense data') + '</h2>';
      }
      h += _pintaAnotacio(a);
    });
    cont.innerHTML = h;
  }

  /* ⚠ ELS DOS BOTONETS VAN NOMÉS AL TÍTOL, NO A CADA LÍNIA (13/11/2026).

     La primera versió en posava dos a CADA línia. L'Aida, amb una anotació
     de set materials per a la tapa de Nadal, es va trobar catorze icones en
     una pantalla: «que la icona de task i calendar no surtin a totes les
     línies, només en el títol».

     Ara n'hi ha un parell per anotació, a la primera línia, i valen per
     l'anotació SENCERA: el títol de la tasca és aquella primera línia i la
     resta hi va a la descripció. Per a una llista de material és el que
     toca —una tasca «Per a la tapa de Nadal» amb els set materials a dins—
     i no set tasques soltes. */
  function _pintaAnotacio(a) {
    var fetes = (a.tasques || []).map(_netLin);
    var evs = (a.events || []).map(_netLin);
    var linies = _linies(a.text);
    var cap = linies[0] || '';
    var jaT = fetes.indexOf(_netLin(cap)) !== -1;
    var jaE = evs.indexOf(_netLin(cap)) !== -1;
    var h = '<article class="llib-anot" data-id="' + _esc(a.id) + '">';

    h += '<div class="llib-linies">';
    linies.forEach(function (l, i) {
      h += '<div class="llib-linia' + (i === 0 ? ' llib-cap' : '') + '">' +
        '<span class="llib-text">' + _esc(l) + '</span>';
      if (i === 0) {
        h += '<span class="llib-accions">' +
          (jaT ? '<span class="llib-ja" title="Ja n\'has fet una tasca">✓ tasca</span>' : '') +
          (jaE ? '<span class="llib-ja" title="Ja ho has posat al calendari">✓ calendari</span>' : '') +
          '<button type="button" class="llib-mini" title="Fer-ne una tasca" aria-label="Fer una tasca d\'aquesta anotació" ' +
            'onclick="llibretaTasca(\'' + _esc(a.id) + '\')">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15">' +
            '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg></button>' +
          '<button type="button" class="llib-mini" title="Posar-ho al calendari" aria-label="Posar aquesta anotació al calendari" ' +
            'onclick="llibretaEvent(\'' + _esc(a.id) + '\')">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15">' +
            '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>' +
            '<line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></button>' +
        '</span>';
      }
      h += '</div>';
    });
    h += '</div>';

    if ((a.etiq || []).length) {
      h += '<div class="llib-etiq-anot">' + a.etiq.map(function (e) {
        return '<button type="button" class="llib-etiq-mini" onclick="llibretaFiltra(\'' +
               _esc(String(e).replace(/'/g, '')) + '\')">' + _esc(e) + '</button>';
      }).join('') + '</div>';
    }

    h += '<div class="llib-peu">' +
      '<button type="button" class="llib-peu-btn" onclick="llibretaEditar(\'' + _esc(a.id) + '\')">Editar</button>' +
      '<button type="button" class="llib-peu-btn" onclick="llibretaCopiar(\'' + _esc(a.id) + '\')">Copiar</button>' +
      '<button type="button" class="llib-peu-btn llib-peu-del" onclick="llibretaEsborrar(\'' + _esc(a.id) + '\')">Esborrar</button>' +
      '</div></article>';
    return h;
  }

  function _pintaEtiquetes() {
    var cont = byId('llibretaEtiquetes');
    if (!cont) return;
    var totes = _totesEtiquetes();
    if (!totes.length) { cont.innerHTML = ''; cont.style.display = 'none'; return; }
    cont.style.display = '';
    cont.innerHTML = '<button type="button" class="llib-etiq' + (_filtre ? '' : ' actiu') +
      '" onclick="llibretaFiltra(\'\')">Totes</button>' +
      totes.map(function (e) {
        var act = _net(e) === _net(_filtre);
        return '<button type="button" class="llib-etiq' + (act ? ' actiu' : '') +
               '" onclick="llibretaFiltra(\'' + _esc(String(e).replace(/'/g, '')) + '\')">' + _esc(e) + '</button>';
      }).join('');
  }

  /* ---- Escriure ---- */
  function _nova() {
    var ta = byId('llibretaNova');
    var dt = byId('llibretaNovaData');
    var et = byId('llibretaNovaEtiq');
    if (!ta) return;
    var text = ta.value.trim();
    if (!text) { _avis('Escriu alguna cosa abans de desar', 'error'); ta.focus(); return; }
    _anot.unshift({
      id: 'L' + Date.now() + Math.floor(Math.random() * 1000),
      data: (dt && dt.value) || _avui(),
      text: text,
      etiq: _lletEtiq(et && et.value),
      ts: Date.now(),
      tasques: [], events: [],
    });
    ta.value = '';
    if (et) et.value = '';
    if (dt) dt.value = _avui();
    _autoAlt(ta);
    _desa();
    _pinta();
    _avis('Apuntat');
  }

  /* El quadre d'escriure creix amb el que s'hi escriu: una reunió són deu
     línies i no s'han d'escriure per una escletxa de tres. */
  function _autoAlt(ta) {
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(360, Math.max(90, ta.scrollHeight)) + 'px';
  }

  function _troba(id) {
    return _anot.filter(function (a) { return String(a.id) === String(id); })[0] || null;
  }

  function _editar(id) {
    var a = _troba(id);
    if (!a) return;
    _editId = id;
    byId('llibEdText').value = a.text || '';
    byId('llibEdData').value = a.data || _avui();
    byId('llibEdEtiq').value = (a.etiq || []).join(', ');
    byId('llibretaEdOverlay').classList.add('open');
    setTimeout(function () { var t = byId('llibEdText'); if (t) { t.focus(); _autoAlt(t); } }, 80);
  }
  function _tancaEd() {
    var ov = byId('llibretaEdOverlay');
    if (ov) ov.classList.remove('open');
    _editId = null;
  }
  function _desaEd() {
    var a = _troba(_editId);
    if (!a) { _tancaEd(); return; }
    var text = byId('llibEdText').value.trim();
    if (!text) { _avis('L\'anotació no pot quedar buida', 'error'); return; }
    a.text = text;
    a.data = byId('llibEdData').value || a.data;
    a.etiq = _lletEtiq(byId('llibEdEtiq').value);
    a.mod = Date.now();
    _tancaEd();
    _desa();
    _pinta();
    _avis('Canviada');
  }

  function _esborrar(id) {
    var a = _troba(id);
    if (!a) return;
    /* Una llibreta es llegeix mesos després: esborrar-ne una pàgina sense
       preguntar no es pot desfer de cap manera. */
    var tros = _linies(a.text)[0] || '';
    if (!confirm('Esborrar aquesta anotació del ' + (_dataText(a.data) || '?') + '?\n\n«' +
                 tros.slice(0, 80) + (tros.length > 80 ? '…' : '') + '»\n\nNo es pot desfer.')) return;
    _anot = _anot.filter(function (x) { return String(x.id) !== String(id); });
    _desa();
    _pinta();
    _avis('Esborrada');
  }

  function _copiar(id) {
    var a = _troba(id);
    if (!a) return;
    var txt = (_dataText(a.data) || '') + '\n' + (a.text || '');
    try {
      navigator.clipboard.writeText(txt).then(function () { _avis('Copiada'); },
        function () { _avis('No s\'ha pogut copiar', 'error'); });
    } catch (e) { _avis('No s\'ha pogut copiar', 'error'); }
  }

  /* ---- D'una anotació a una tasca / a un event ----
     S'obre la finestra DE SEMPRE de cada eina, amb el text ja posat. No es
     crea res sense que ella ho desi: una tasca que apareix sola a Tasques
     sense haver-hi dit ni la data ni la categoria és una tasca que després
     ningú no sap d'on surt.

     El TÍTOL és la primera línia (sense el pic) i la RESTA va a la
     descripció: una anotació de «Per a la tapa de Nadal» amb set materials
     ha de ser UNA tasca amb els set materials a dins, no set tasques. */
  function _marca(a, quin, linia) {
    var llista = a[quin] = a[quin] || [];
    if (llista.map(_netLin).indexOf(_netLin(linia)) === -1) llista.push(linia);
    _desa();
    _pinta();
  }

  /* El text que acompanya la tasca o l'event: la resta de línies i d'on surt. */
  function _cos(a) {
    var resta = _linies(a.text).slice(1);
    var deOn = 'De la llibreta, ' + (_dataText(a.data) || '').replace(' · avui', '') + '.';
    return resta.length ? resta.join('\n') + '\n\n' + deOn : deOn;
  }

  function _tasca(id) {
    var a = _troba(id);
    if (!a) return;
    var cap = _linies(a.text)[0];
    if (!cap) return;
    if (typeof openTasca !== 'function') { _avis('Les tasques no hi són en aquesta app', 'error'); return; }
    openTasca(null);
    var t = byId('tascaTitol'), d = byId('tascaDesc'), dat = byId('tascaData');
    if (t) t.value = _treuPic(cap).slice(0, 120);
    if (d) d.value = _cos(a);
    if (dat && !dat.value && a.data >= _avui()) dat.value = a.data;
    _marca(a, 'tasques', cap);
  }

  function _event(id) {
    var a = _troba(id);
    if (!a) return;
    var cap = _linies(a.text)[0];
    if (!cap) return;
    if (typeof openCal2Event !== 'function') { _avis('El calendari no hi és en aquesta app', 'error'); return; }
    /* La data de l'anotació és la del dia que ho va escriure, no la del que
       ha de passar: s'hi posa com a punt de partida i ella la canvia. */
    openCal2Event(null, a.data || _avui());
    var t = byId('cal2EvTitol'), d = byId('cal2EvDesc');
    if (t) t.value = _treuPic(cap).slice(0, 120);
    if (d) d.value = _cos(a);
    _marca(a, 'events', cap);
  }

  /* ---- La pàgina ---- */
  function obrePagina() {
    if (!_hiEs()) return;
    var ta = byId('llibretaNova');
    var dt = byId('llibretaNovaData');
    if (dt && !dt.value) dt.value = _avui();
    if (ta) _autoAlt(ta);
    if (!_carregat) _cache();
    _pinta();
    _carrega();
  }

  function aplicaInterficie() {
    var b = byId('navLlibreta');
    if (b) b.style.display = _hiEs() ? '' : 'none';
  }

  /* Les funcions que criden els botons van a `window` a posta: els `onclick`
     de l'index.html les han de poder trobar, i així
     `eines/comprova-controls.js` pot comprovar que existeixen. */
  window.llibretaNova = _nova;
  window.llibretaEditar = _editar;
  window.llibretaDesaEdicio = _desaEd;
  window.llibretaTancaEdicio = _tancaEd;
  window.llibretaEsborrar = _esborrar;
  window.llibretaCopiar = _copiar;
  window.llibretaTasca = _tasca;
  window.llibretaEvent = _event;
  window.llibretaCreix = function (el) { _autoAlt(el); };
  window.llibretaCerca = function (v) { _cerca = String(v == null ? '' : v); _pinta(); };
  window.llibretaFiltra = function (e) {
    _filtre = (_net(e) === _net(_filtre)) ? '' : String(e || '');
    _pinta();
  };

  window.Llibreta = {
    hiEs: _hiEs,
    aplicaInterficie: aplicaInterficie,
    obrePagina: obrePagina,
    linies: _linies,
    treuPic: _treuPic,
    // per al banc de proves
    posa: function (l) { _anot = l || []; _carregat = true; },
    totes: function () { return _anot; },
  };
})();
