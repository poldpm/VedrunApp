/* ============================================================
   CADA APP, LA SEVA MEMÒRIA — memoria.js   (22/11/2026)
   ------------------------------------------------------------
   El problema: totes les apps viuen a la mateixa adreça
   (`poldpm.github.io/<la de cadascú>/`), i per al navegador la mateixa
   adreça vol dir el MATEIX calaix de dades. L'app hi guardava les seves
   claus sense cap nom de qui eren (`vedruna_perfil`, `tasques`,
   `notescache_…`, `vedruna_pendents`…). En un ordinador compartit, o al
   d'en Pol, que n'obre diverses, l'app d'una mestra arrencava amb el
   perfil, els alumnes i les notes que hi havia deixat una altra, fins que
   arribava la resposta del servidor. I tot el que «recupera» coses del
   navegador (el perfil, v380) hi podia trobar una còpia que no era seva.

   Hi havia un remei a mitges, de setembre (`_calaixDAquestaApp`, a
   `js/app.js`): en obrir una app, es desava a part el calaix de l'anterior
   i es posava el seu. Però:
     · només canviava una part de les claus (n'hi havia una vintena que
       quedaven compartides: el login, les caselles de notes a mig enviar,
       el que va al Google Calendar…);
     · amb DUES apps obertes alhora no servia: la primera continuava
       escrivint al calaix que ara era de la segona, cua de desats inclosa,
       i la segona ho enviava al SEU full.

   L'arranjament de debò: cada app guarda les seves claus amb el nom de la
   seva carpeta al davant —`[/vedrunapp-mireiaduran/]tasques`—, en
   minúscules perquè GitHub serveix la mateixa app amb majúscules o sense.
   No s'ha tocat cap de les 300 crides que l'app fa al navegador: aquest
   fitxer s'interposa al `localStorage` d'aquesta pàgina i hi posa el nom a
   cada clau, a l'anada i a la tornada. Per a la resta de l'app tot és com
   sempre; només que ja no veu res que no sigui seu.

   ⚠ VA AQUÍ, JUST DESPRÉS DE `js/config.local.js`, I NO ABANS.
   Per saber quin calaix vell era seu necessita el token i el rol (amb això
   es feia l'empremta del calaix de setembre) i l'adreça del servidor. Els
   quatre fitxers d'abans (espera, pdfhorari, millores, rol) no toquen el
   `localStorage` en carregar-se: només dins de funcions que es criden més
   tard. Si algun dia n'hi ha d'haver un que sí, ha d'anar després d'aquest.

   ⚠ I NO S'ENCÉN ALS BANCS DE MENTIDA. Allà el `localStorage` és un objecte
   qualsevol (no un `Storage` de debò) i les proves miren les claus tal com
   són. Qui prova això és `eines/comprova-memoria.js`, amb un navegador de
   debò i dues apps a la mateixa adreça.
   ============================================================ */
(function () {
  'use strict';

  var real = null;
  try { real = window.localStorage; } catch (e) { real = null; }
  if (!real || typeof Storage !== 'function' || !(real instanceof Storage)) {
    window._memoria = { propia: false, estat: 'sense memòria del navegador' };
    return;
  }
  if (window._memoria && window._memoria.propia) return;      // ja hi és

  var SP = Storage.prototype;
  var dLen = Object.getOwnPropertyDescriptor(SP, 'length');
  var O = { get: SP.getItem, set: SP.setItem, rem: SP.removeItem, key: SP.key,
            clear: SP.clear, len: dLen && dLen.get };
  /* Un navegador que no deixa fer això: tot com abans (el calaix de setembre
     de `js/app.js` continua fent la seva feina). */
  if (!O.get || !O.set || !O.rem || !O.key || !O.len || !dLen.configurable) {
    window._memoria = { propia: false, estat: 'aquest navegador no ho permet' };
    return;
  }

  function cruGet(k)    { return O.get.call(real, k); }
  function cruSet(k, v) { O.set.call(real, k, v); }
  function cruTreu(k)   { O.rem.call(real, k); }
  function cruClaus() {
    var n = O.len.call(real), out = [];
    for (var i = 0; i < n; i++) { var k = O.key.call(real, i); if (k !== null) out.push(k); }
    return out;
  }

  /* ---------- 1) De qui és aquesta app ---------- */

  /* La carpeta d'on se serveix: `/vedrunapp-MireiaDuran/index.html` →
     `/vedrunapp-mireiaduran/`. És el que és únic de cada app (el token és el
     mateix per a tot el claustre, i el rol el comparteixen moltes). */
  var CARPETA_EXACTA = String((window.location && location.pathname) || '/').replace(/[^/]*$/, '') || '/';
  var CARPETA = CARPETA_EXACTA.toLowerCase();
  var P = '[' + CARPETA + ']';

  /* ---------- 2) L'embolcall ---------- */

  /* La llista de claus d'aquesta app, per a `length` i `key(i)`. Es fa una
     foto per tirada de codi (es buida en acabar): un bucle de
     `for (i < localStorage.length)` no la refà a cada volta —amb un parell
     de milers de claus del planning, això eren milions de crides—, i el que
     canviï una altra pestanya entre una tirada i l'altra es veu igualment. */
  var _claus = null, _hiEs = null, _buidaProgramat = false;
  function oblida() { _claus = null; _hiEs = null; }
  function claus() {
    if (_claus) return _claus;
    _claus = []; _hiEs = Object.create(null);
    var n = O.len.call(real);
    for (var i = 0; i < n; i++) {
      var k = O.key.call(real, i);
      if (k && k.indexOf(P) === 0) { var c = k.slice(P.length); _hiEs[c] = true; _claus.push(c); }
    }
    if (!_buidaProgramat) {
      _buidaProgramat = true;
      Promise.resolve().then(function () { _buidaProgramat = false; oblida(); });
    }
    return _claus;
  }

  var nou = {
    getItem: function (k) {
      return this === real ? O.get.call(this, P + k) : O.get.apply(this, arguments);
    },
    setItem: function (k, v) {
      if (this !== real) return O.set.apply(this, arguments);
      O.set.call(this, P + k, v);
      k = String(k);
      if (_claus && !_hiEs[k]) { _hiEs[k] = true; _claus.push(k); }
    },
    removeItem: function (k) {
      if (this !== real) return O.rem.apply(this, arguments);
      O.rem.call(this, P + k);
      if (_claus && _hiEs[String(k)]) oblida();
    },
    key: function (i) {
      if (this !== real) return O.key.apply(this, arguments);
      var c = claus(), n = Number(i) >>> 0;
      return n < c.length ? c[n] : null;
    },
    clear: function () {
      if (this !== real) return O.clear.apply(this, arguments);
      claus().slice().forEach(function (c) { O.rem.call(real, P + c); });
      oblida();
    },
  };

  try {
    SP.getItem = nou.getItem; SP.setItem = nou.setItem; SP.removeItem = nou.removeItem;
    SP.key = nou.key; SP.clear = nou.clear;
    Object.defineProperty(SP, 'length', {
      configurable: true, enumerable: dLen.enumerable,
      get: function () { return this === real ? claus().length : O.len.call(this); },
    });
  } catch (e) { tornaEnrere(); window._memoria = { propia: false, estat: 'no s\'ha pogut posar' }; return; }

  function tornaEnrere() {
    try {
      SP.getItem = O.get; SP.setItem = O.set; SP.removeItem = O.rem; SP.key = O.key; SP.clear = O.clear;
      Object.defineProperty(SP, 'length', dLen);
    } catch (e) {}
  }

  /* Que funciona de debò, i no només que s'ha pogut escriure: si una clau
     anés a parar al calaix de tothom, valdria més no fer res. */
  var funciona = true;
  try {
    var t = '__memoria_prova_' + Date.now();
    real.setItem(t, '1');
    funciona = cruGet(P + t) === '1' && cruGet(t) === null && real.getItem(t) === '1';
    real.removeItem(t);
    if (cruGet(P + t) !== null) funciona = false;
  } catch (e) {
    /* El navegador és ple i no es pot escriure ni la prova: es mira que, com
       a mínim, les funcions són les d'aquí. */
    funciona = (real.getItem === nou.getItem && real.key === nou.key);
  }
  if (!funciona) { tornaEnrere(); window._memoria = { propia: false, estat: 'no ha funcionat' }; return; }

  /* ---------- 3) El que ja hi havia: portar-ho al calaix nou, un sol cop ----------

     Fins a la v380 les claus d'aquesta app eren al calaix de tothom. Ara no
     les veuria: les porta aquí la primera vegada, però NOMÉS si se sap que
     són seves. Les dades de debò són al full; el que no es pot perdre de cap
     manera és el que encara no hi ha arribat (`VALUOSES`).

     Com se sap de qui és el calaix vell: des de setembre, cada app hi
     deixava la seva empremta a `vedruna_app` en obrir-se, i el calaix que
     desava a part era `vedruna_calaix_<empremta>`. L'empremta es fa igual
     que llavors (carpeta|token|rol). Si no n'hi ha, o és la de l'agost
     (token|rol, que és igual per a totes les tutores), només si l'adreça
     del servidor que hi ha desada és la d'aquesta app. Si no se sap, no es
     toca res: l'app arrenca com en un aparell nou i ho porta tot del full,
     i el calaix vell es queda per a la seva amo quan s'actualitzi.

     ⚠ AQUESTES LLISTES ES QUEDEN TAL COM SÓN. Són les claus que existien
     fins a la v380: una clau nova ja neix al calaix bo i no s'ha de portar
     d'enlloc. No hi afegeixis les que facis a partir d'ara. */

  /* Les que el calaix de setembre canviava d'app a app (`PREFIXOS`). */
  var CALAIX_VELL = ['vedruna_cfg', 'vedruna_perfil', 'vedruna_cache_main', 'vedruna_pendents',
    'vedruna_autosetup_fet', 'tasques', 'tasques_malmes', 'postits', 'horari', 'grup_treball',
    'direccio_grup', 'enllacos_propis', 'coment_estil', 'actitud_aspectes', 'notifEnabled',
    'trimAlertSup', 'main_sheet_id', 'grups_sheet_id_local', 'desdob_sheet_id_local',
    'cal_escola_seed', 'plan_', 'cal2_', 'assim_', 'actitud_', 'notescache_', 'tutoriacache_',
    'gcal_', 'seients_', 'obs_'];
  /* Les que es quedaven compartides entre totes les apps del navegador
     (també les dels `js/personal.js` de les mestres que en tenen). */
  var COMPARTIDES = ['vedruna_envol', 'vedruna_caselles', 'vedruna_docs_ids', 'vedruna_backend_versio',
    'vedruna_login', 'vedruna_obs_full_v304_', 'vedruna_obs_grups_v313', 'cal_base_', 'tq_cats',
    'reu_reserves_vistes', 'reu_reserves_avisades', 'reu_properes', 'dubtes_amagats', 'aules_horari',
    'gwrite_ombra', 'gwrite_actiu', 'llibreta', 'notescomp_publicat_dia', 'grupcache_', 'altrescache_',
    'rubaval_', 'rubrica_', 'temporitzador_', 'versio_ajornada', 'millores_demanades',
    'millores_vistes', 'avis_inici', 'ajustos_vistos',
    'cpvcats_', 'cpvultimacat_', 'aidacats_', 'aidaultimacat_', 'notescats_', 'notesultimacat_',
    'notesesquema'];
  /* El que encara no és al full: la cua de desats, el que viatjava quan es
     va tancar l'app, i les caselles de notes apuntades i encara no enviades. */
  var VALUOSES = ['vedruna_pendents', 'vedruna_envol', 'vedruna_caselles'];

  function comenca(k, llista) {
    for (var i = 0; i < llista.length; i++) {
      var p = llista[i];
      if (k === p || k.indexOf(p) === 0) return true;
    }
    return false;
  }
  function esValuosa(k) { return VALUOSES.indexOf(k) !== -1; }

  function empremta(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) { h = ((h * 31) + s.charCodeAt(i)) | 0; }
    return String(h);
  }
  var TOK = String(window.APP_TOKEN || '');
  var ROL = String(window.APP_ROL || 'tutor');
  var URL_NOSTRA = String(window.APP_SCRIPT_URL || '').trim();
  var NOSTRES = [empremta(CARPETA_EXACTA + '|' + TOK + '|' + ROL)];
  if (CARPETA !== CARPETA_EXACTA) NOSTRES.push(empremta(CARPETA + '|' + TOK + '|' + ROL));
  var DE_L_AGOST = empremta(TOK + '|' + ROL);

  function urlDe(textCfg) {
    try { return String((JSON.parse(textCfg || '{}') || {}).scriptUrl || '').trim(); } catch (e) { return ''; }
  }
  function urlEsNostra(textCfg) { return !!URL_NOSTRA && urlDe(textCfg) === URL_NOSTRA; }

  /* Dues cues de la mateixa app (la del calaix nou i la del vell) es fusionen:
     de cada desat, el més nou. Cap de les dues es perd. */
  function tsDe(x, k) {
    if (!x) return 0;
    if (k === 'vedruna_caselles') {
      var v = String(x.v || ''), parts = v.split('.');
      return (Number(parts[1]) || 0) + (Number(parts[0]) || 0) / 1e6;
    }
    return Number(x.ts) || 0;
  }
  function fusiona(k, ara, vell) {
    var a, b;
    try { a = JSON.parse(ara); } catch (e) { return vell; }
    try { b = JSON.parse(vell); } catch (e) { return ara; }
    if (k === 'vedruna_envol') {
      if (!a || typeof a !== 'object') return vell;
      if (!b || typeof b !== 'object') return ara;
      Object.keys(b).forEach(function (c) { if (!a[c] || tsDe(b[c], k) > tsDe(a[c], k)) a[c] = b[c]; });
      return JSON.stringify(a);
    }
    if (!Array.isArray(a)) return vell;
    if (!Array.isArray(b)) return ara;
    var per = {}, ordre = [];
    a.concat(b).forEach(function (x) {
      var c = x && x.clau !== undefined ? String(x.clau) : JSON.stringify(x);
      if (!(c in per)) { per[c] = x; ordre.push(c); }
      else if (tsDe(x, k) > tsDe(per[c], k)) per[c] = x;
    });
    return JSON.stringify(ordre.map(function (c) { return per[c]; }));
  }

  /* Posa una clau vella al calaix d'aquesta app. Mai trepitja una que ja hi
     sigui (seria més nova), llevat de les valuoses, que es fusionen. */
  function posa(k, v) {
    var hiEra = cruGet(P + k);
    if (hiEra !== null) {
      if (!esValuosa(k) || hiEra === v) return true;
      v = fusiona(k, hiEra, v);
    }
    try { cruSet(P + k, v); return true; } catch (e) { return false; }
  }

  /* La marca de «ja s'ha portat» va fora del calaix de l'app (amb claus `{}`
     i no `[]`), perquè l'app no la vegi entre les seves claus ni se
     l'endugui un `clear()`. */
  var MARCA = '{' + CARPETA + '}memoria';
  var resum = { portat: 0, fusionat: 0, perdut: 0, deixat: 0 };

  function migra() {
    var totes = cruClaus();
    var abans = cruGet('vedruna_app');
    var calaixos = totes.filter(function (k) { return k.indexOf('vedruna_calaix_') === 0; });
    var meuCalaix = null;
    NOSTRES.forEach(function (fp) { if (!meuCalaix && cruGet('vedruna_calaix_' + fp) !== null) meuCalaix = 'vedruna_calaix_' + fp; });
    if (!meuCalaix && cruGet('vedruna_calaix_' + DE_L_AGOST) !== null) {
      var cAgost = null;
      try { cAgost = JSON.parse(cruGet('vedruna_calaix_' + DE_L_AGOST)) || {}; } catch (e) { cAgost = {}; }
      if (urlEsNostra(cAgost.vedruna_cfg)) meuCalaix = 'vedruna_calaix_' + DE_L_AGOST;
    }
    var altresCalaixos = calaixos.filter(function (k) { return k !== meuCalaix; });

    /* El calaix obert (les claus soles) és d'aquesta app? */
    var obertNostre = NOSTRES.indexOf(abans) !== -1 || urlEsNostra(cruGet('vedruna_cfg'));
    var esVedruna = function (k) { return comenca(k, CALAIX_VELL) || comenca(k, COMPARTIDES); };
    var hiHaObert = totes.some(esVedruna);

    var tot = true;          // s'ha pogut portar tot el que no es pot perdre?
    if (obertNostre && hiHaObert) {
      /* Les compartides que no són valuoses: si al navegador hi ha calaixos
         d'altres apps que encara no s'han actualitzat, se'n fa una còpia i
         l'original es queda (també era seu). Si no n'hi ha cap més, es mouen. */
      var copia = altresCalaixos.length > 0;
      var meves = totes.filter(esVedruna);
      meves.sort(function (x, y) { return (esValuosa(y) ? 1 : 0) - (esValuosa(x) ? 1 : 0); });
      var lliures = false;
      for (var i = 0; i < meves.length; i++) {
        var k = meves[i], v = cruGet(k);
        if (v === null) continue;
        var nomesCopia = copia && !comenca(k, CALAIX_VELL) && !esValuosa(k);
        var ok = posa(k, v);
        if (!ok && esValuosa(k) && !lliures) {
          /* Navegador ple: es fa lloc llençant les còpies d'anar de pressa
             d'aquesta mateixa app (el full les tornarà a portar). */
          lliures = true;
          meves.forEach(function (x) { if (comenca(x, CALAIX_VELL) && !esValuosa(x)) { try { cruTreu(x); } catch (e) {} } });
          ok = posa(k, v);
        }
        if (ok) { resum.portat++; if (!nomesCopia) { try { cruTreu(k); } catch (e) {} } }
        else if (esValuosa(k)) { tot = false; resum.deixat++; }           // es queda on era: es tornarà a provar
        else { resum.perdut++; if (!nomesCopia) { try { cruTreu(k); } catch (e) {} } }
      }
    }
    /* El calaix obert ja no és de ningú: una app de la versió d'abans que
       s'obri en aquest navegador hi posarà el seu, com sempre. */
    if (obertNostre && tot) { try { cruTreu('vedruna_app'); } catch (e) {} }

    if (meuCalaix) {
      var d = null;
      try { d = JSON.parse(cruGet(meuCalaix)) || {}; } catch (e) { d = null; }
      if (d && typeof d === 'object') {
        var cs = Object.keys(d).sort(function (x, y) { return (esValuosa(y) ? 1 : 0) - (esValuosa(x) ? 1 : 0); });
        var totCalaix = true;
        cs.forEach(function (k) {
          if (d[k] === null || d[k] === undefined) return;
          var hiEra = cruGet(P + k) !== null;
          if (posa(k, String(d[k]))) { if (hiEra && esValuosa(k)) resum.fusionat++; else resum.portat++; }
          else if (esValuosa(k)) { totCalaix = false; resum.deixat++; }
          else resum.perdut++;
        });
        if (totCalaix) { try { cruTreu(meuCalaix); } catch (e) {} } else tot = false;
      }
    }

    var origen = (obertNostre && hiHaObert) ? 'nostre' : (meuCalaix ? 'calaix' : (hiHaObert ? 'd-una-altra' : 'buit'));
    if (tot) {
      try {
        cruSet(MARCA, JSON.stringify({ v: 1, quan: new Date().toISOString(), origen: origen,
          presa: obertNostre, resum: resum }));
      } catch (e) { /* ple: es tornarà a mirar el proper cop, i no trepitjarà res */ }
    }
    return origen;
  }

  /* Una pestanya d'aquesta mateixa app que encara anava amb la versió d'abans
     quan aquesta es va actualitzar pot haver deixat desats al calaix vell
     després de portar-lo aquí. Si el calaix vell era nostre i encara no l'ha
     agafat cap altra app, el que no es pot perdre ve aquí. */
  function escombra(marca) {
    if (!marca || !marca.presa) return;
    var abans = cruGet('vedruna_app');
    if (abans !== null && NOSTRES.indexOf(abans) === -1) return;
    VALUOSES.forEach(function (k) {
      var v = cruGet(k);
      if (v === null) return;
      if (posa(k, v)) { try { cruTreu(k); } catch (e) {} resum.fusionat++; }
    });
  }

  var estat = '';
  var marca = null;
  try { marca = JSON.parse(cruGet(MARCA) || 'null'); } catch (e) { marca = null; }
  try {
    if (!marca) estat = migra();
    else { estat = 'ja'; escombra(marca); }
  } catch (e) { estat = 'error: ' + (e && e.message); }

  window._memoria = {
    propia: true,
    carpeta: CARPETA,
    prefix: P,
    /* Per al Diagnòstic de Configuració. */
    estat: estat,
    resum: resum,
    marca: function () { try { return JSON.parse(cruGet(MARCA) || 'null'); } catch (e) { return null; } },
    claus: function () { return claus().slice(); },
  };
})();
