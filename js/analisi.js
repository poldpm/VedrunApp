/* ============================================================
   ANÀLISI DEL CURS — analisi.js   (24/11/2026)
   ------------------------------------------------------------
   En Pol: «un anàlisi del curs o un seguiment del curs on jo pugui
   agafar totes les dades que tinc de les meves classes […] que em
   pugui fer unes gràfiques de quantes persones aproven i suspenen
   la meva assignatura, de quants AE, AN, NA tinc». Per a tutors (la
   seva tutoria i les seves assignatures), especialistes (cada
   assignatura i grup) i direcció (el grup que tinguin triat).

   ⚠ EINA OPCIONAL, I NEIX APAGADA. Només la té qui tingui

       window.EINES_ANALISI = true;

   al seu `js/personal.js`. El codi arriba a totes les apps amb el
   `sync-totes.js`; s'encén només a qui la demani. L'entrada del
   catàleg (`js/millores.js`) porta `interruptor: 'EINES_ANALISI'`.

   ------------------------------------------------------------
   NOMÉS LLEGEIX. No escriu res enlloc, ni al full ni al navegador
   (fora de recordar quina vista tenia triada). Tot surt del que
   l'app ja porta:

   · La NOTA DEL TRIMESTRE de cada alumne surt del resum que ja fa el
     servidor (`getNotesResum`), el MATEIX càlcul que la columna
     Mitjana del full, la pantalla de Notes i la fitxa de l'alumne
     (categories, actitud i Carpeta inclosos). Si aquí es calculés
     per lliure, l'anàlisi diria una nota i la fitxa una altra.
   · El detall de cada ACTIVITAT (nota, NE, apunts, categoria) surt de
     `getNotes`, el mateix que pinta la pantalla de Notes.
   · Els ASSOLIMENTS, l'ACTITUD i els COMENTARIS DESATS, amb les mateixes
     funcions que les seves pantalles (`assimValGet`, `getActitud`,
     `_comentDesatsLlegeix`): així la clau sempre és la mateixa.
   · Com a tutor (o direcció), les assignatures que fan altres mestres
     surten de les notes que elles publiquen (`carregaNotesCompartides`).
     Si una mestra no ha obert la seva app, la seva assignatura no hi és,
     i es diu.

   Les vistes: «La meva tutoria» (o «El grup», a direcció), «Una
   assignatura» i «Totes les meves assignatures». El trimestre: 1r, 2n,
   3r o tot el curs (la mitjana dels que tinguin nota).

   Els gràfics són SVG i CSS fets aquí, sense cap llibreria: l'app ha de
   funcionar sense connexió i no es carrega res de fora.
   ============================================================ */
(function () {
  'use strict';

  /* ---- L'interruptor. Es llegeix EN DIRECTE, no en carregar ----
     `js/personal.js` es carrega l'ÚLTIM de tots. */
  function hiEs() {
    try { return window.EINES_ANALISI === true; } catch (e) { return false; }
  }

  var CLAU_TRIA = 'analisi_tria';
  function byId(id) { return document.getElementById(id); }
  function esc(s) { return (typeof escapeHtml === 'function') ? escapeHtml(s) : String(s == null ? '' : s); }
  function norm(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  }
  function arrod1(n) { return Math.round(n * 10) / 10; }
  function mitjana(llista) {
    var v = llista.filter(function (x) { return typeof x === 'number' && !isNaN(x); });
    return v.length ? v.reduce(function (a, b) { return a + b; }, 0) / v.length : null;
  }
  function fmt(n) { return (n === null || n === undefined || isNaN(n)) ? '—' : String(arrod1(n)).replace('.', ','); }
  function pct(a, b) { return b ? Math.round(a / b * 100) : 0; }

  /* ---- Les quatre qualificacions. Els mateixos talls i colors que les notes
     (`QUALS`, js/notes.js), però amb el color ple: en un gràfic, el color
     clar del fons de la casella no es distingeix. */
  var BANDES = [
    { codi: 'NA', nom: 'No assoliment',            color: '#DC2626' },
    { codi: 'AS', nom: 'Assoliment satisfactori',  color: '#F59E0B' },
    { codi: 'AN', nom: 'Assoliment notable',       color: '#3B82F6' },
    { codi: 'AE', nom: 'Assoliment excel·lent',    color: '#10B981' },
  ];
  function banda(n) {
    if (n === null || n === undefined || isNaN(n)) return null;
    if (n < 5) return BANDES[0];
    if (n < 7) return BANDES[1];
    if (n < 9) return BANDES[2];
    return BANDES[3];
  }
  function ordreBanda(n) { var b = banda(n); return b ? BANDES.indexOf(b) : -1; }

  var NIVELLS_ASSIM = [
    { key: 'mba',  curt: 'MBA', color: '#059669' },
    { key: 'ass',  curt: 'AS',  color: '#2563EB' },
    { key: 'aaj',  curt: 'AAJ', color: '#D97706' },
    { key: 'nass', curt: 'NA',  color: '#DC2626' },
  ];

  /* ---- El que hi ha triat ---- */
  var E = { vista: null, key: null, trim: null, torn: 0 };
  function llegeixTria() {
    try {
      var t = JSON.parse(localStorage.getItem(CLAU_TRIA) || 'null');
      if (t && typeof t === 'object') { E.vista = t.vista || null; E.key = t.key || null; E.trim = (t.trim === 0 || t.trim) ? t.trim : null; }
    } catch (e) {}
  }
  function desaTria() {
    try { localStorage.setItem(CLAU_TRIA, JSON.stringify({ vista: E.vista, key: E.key, trim: E.trim })); } catch (e) {}
  }

  function esDir() { try { return typeof esDireccio === 'function' && esDireccio(); } catch (e) { return false; } }
  function grupPropi() {
    try {
      if (esDir()) return (typeof _grupDeTreball === 'function') ? _grupDeTreball() : null;
      return (typeof _perfilTutorGrupKey === 'function') ? _perfilTutorGrupKey() : null;
    } catch (e) { return null; }
  }

  /* Les assignatures del perfil, registrades als mapes de les pantalles
     (d'on surten els nens i de quin grup són), igual que fa Notes. */
  function entrades() {
    var es = [];
    try { es = (typeof _perfilEntradesAmbGrup === 'function') ? _perfilEntradesAmbGrup() : []; } catch (e) { es = []; }
    es.forEach(function (e) {
      try { _registraEntrada(e); } catch (x) {}
      try { _registraEntrada(e, _navMateriaKey(e)); } catch (x) {}
    });
    return es;
  }

  function vistesDisponibles(es) {
    var out = [];
    var g = grupPropi();
    if (g || esDir()) out.push({ id: 'grup', nom: esDir() ? ('El grup' + (g ? ' (' + g + ')' : '')) : ('La meva tutoria (' + g + ')') });
    if (es.length) out.push({ id: 'assig', nom: 'Una assignatura' });
    if (es.length > 1) out.push({ id: 'totes', nom: 'Totes les meves assignatures' });
    return out;
  }

  /* ---- Al servidor, amb memòria de dos minuts (canviar de trimestre o
     d'assignatura i tornar-hi no ha de tornar a esperar). ---- */
  var _mem = {};
  async function demana(params) {
    var clau = JSON.stringify(params);
    var m = _mem[clau];
    if (m && Date.now() - m.ts < 120000) return m.r;
    var r = null;
    try { r = await appsScriptGet(Object.assign({ _fons: true }, params)); } catch (e) { r = null; }
    if (r && r.ok) _mem[clau] = { r: r, ts: Date.now() };
    return r;
  }

  /* Amb quina clau i quin grup es llegeixen les notes d'una assignatura:
     EXACTAMENT com ho fa `openNotes` (js/notes.js). */
  function notesDe(e) {
    var mat = _navMateriaKey(e);
    var dd = null;
    try { dd = (typeof _assigDesdobMap !== 'undefined' && (_assigDesdobMap[mat] || _assigDesdobMap[e.key])) || _ddDeEntrada(e); } catch (x) { dd = null; }
    var grup = dd ? (dd.grupFix || null) : (e.grup || null);
    return { mat: mat, grup: grup, dd: dd };
  }

  /* El resum del servidor: { resum: { clau: {1:{notes,ne,rowNoms},2,3} }, mats: [{key,nom}] }.
     La clau de cada assignatura és la de la pàgina de notes, o el seu nom
     net (veure `getNotesResum` al Code.gs). */
  async function resumDe(grup) {
    var r = await demana({ action: 'getNotesResum', grup: grup || '' });
    return (r && r.ok && r.resum) ? r : null;
  }
  function clauResum(resum, mat) {
    if (!resum) return null;
    if (resum[mat]) return mat;
    var n = norm(mat);
    var ks = Object.keys(resum);
    for (var i = 0; i < ks.length; i++) if (norm(ks[i]) === n) return ks[i];
    return null;
  }
  function posPerNom(nom, rowNoms) {
    if (typeof _fitxaPosPerNom === 'function') return _fitxaPosPerNom(nom, rowNoms);
    var n = norm(nom);
    for (var i = 0; i < (rowNoms || []).length; i++) if (norm(rowNoms[i]) === n) return i;
    return -1;
  }

  /* Els nens d'una assignatura, amb els mateixos carregadors que Notes i
     Assoliments (amb desdoblament, els del grup triat a la barra). */
  async function carregaAlumnes(e, dd) {
    try {
      if (dd && typeof _loadDesdobStudents === 'function') { await _loadDesdobStudents(dd.curs, dd.assig); return; }
      var grup = (typeof _assigGrupMap !== 'undefined') ? _assigGrupMap[e.key] : null;
      if (!grup) { if (typeof _restoreTutoriaStudents === 'function') _restoreTutoriaStudents(); return; }
      if (typeof _ensureGrupStudents === 'function') {
        var nomBase = (typeof _assigNomMap !== 'undefined' && _assigNomMap[e.key]) || e.nom;
        await _ensureGrupStudents(grup, nomBase);
      }
    } catch (x) {}
  }
  function alumnesAra() { try { return (typeof students !== 'undefined' && students) ? students.slice() : []; } catch (e) { return []; } }
  function nomDe(s) { try { return (typeof nomAlumne === 'function') ? nomAlumne(s) : s.nom; } catch (e) { return s && s.nom; } }
  function sidDe(s) { try { return (typeof _assimSid === 'function') ? _assimSid(s) : (s.rowId || s.id); } catch (e) { return s.id; } }

  /* ============================================================
     ELS GRÀFICS (SVG i CSS, sense llibreries)
     ============================================================ */
  function targeta(titol, cos, opts) {
    opts = opts || {};
    return '<section class="an-card' + (opts.ample ? ' an-ample' : '') + '">' +
      '<h3 class="an-card-tit">' + esc(titol) + '</h3>' +
      (opts.sub ? '<p class="an-card-sub">' + opts.sub + '</p>' : '') + cos + '</section>';
  }
  function buit(text) { return '<p class="an-buit">' + text + '</p>'; }

  function xifres(llista) {
    return '<div class="an-xifres">' + llista.map(function (x) {
      return '<div class="an-xifra' + (x.to ? ' ' + x.to : '') + '"><span class="an-xifra-n">' + esc(x.valor) +
        '</span><span class="an-xifra-nom">' + esc(x.nom) + '</span></div>';
    }).join('') + '</div>';
  }

  /* Rodona (aprovats i suspesos). `parts`: [{nom, n, color}] */
  function donut(parts, centre, sub) {
    var total = parts.reduce(function (a, p) { return a + p.n; }, 0);
    var R = 52, C = 2 * Math.PI * R, ofs = 0;
    var arcs = total ? parts.filter(function (p) { return p.n > 0; }).map(function (p) {
      var l = C * p.n / total;
      var s = '<circle cx="70" cy="70" r="' + R + '" fill="none" stroke="' + p.color + '" stroke-width="22" ' +
        'stroke-dasharray="' + l.toFixed(2) + ' ' + (C - l).toFixed(2) + '" stroke-dashoffset="' + (-ofs).toFixed(2) +
        '" transform="rotate(-90 70 70)"><title>' + esc(p.nom + ': ' + p.n) + '</title></circle>';
      ofs += l; return s;
    }).join('') : '<circle cx="70" cy="70" r="' + R + '" fill="none" stroke="#E5E7EB" stroke-width="22"/>';
    return '<div class="an-donut"><svg viewBox="0 0 140 140" role="img" aria-label="' +
      esc(parts.map(function (p) { return p.nom + ' ' + p.n; }).join(', ')) + '">' + arcs +
      '<text x="70" y="68" text-anchor="middle" class="an-donut-n">' + esc(centre) + '</text>' +
      '<text x="70" y="88" text-anchor="middle" class="an-donut-sub">' + esc(sub || '') + '</text></svg>' +
      '<ul class="an-llegenda">' + parts.map(function (p) {
        return '<li><span class="an-punt" style="background:' + p.color + '"></span>' + esc(p.nom) +
          ' <strong>' + p.n + '</strong>' + (total ? ' <span class="an-gris">(' + pct(p.n, total) + '%)</span>' : '') + '</li>';
      }).join('') + '</ul></div>';
  }

  /* Barra apilada horitzontal amb llegenda. `parts`: [{nom, n, color}] */
  function apilada(parts) {
    var total = parts.reduce(function (a, p) { return a + p.n; }, 0);
    if (!total) return buit('Encara no hi ha dades.');
    return '<div class="an-apilada" role="img" aria-label="' + esc(parts.map(function (p) { return p.nom + ' ' + p.n; }).join(', ')) + '">' +
      parts.filter(function (p) { return p.n > 0; }).map(function (p) {
        return '<span style="flex:' + p.n + ';background:' + p.color + '" title="' + esc(p.nom + ': ' + p.n) + '">' +
          (pct(p.n, total) >= 8 ? p.n : '') + '</span>';
      }).join('') + '</div>' +
      '<ul class="an-llegenda an-llegenda-fila">' + parts.map(function (p) {
        return '<li><span class="an-punt" style="background:' + p.color + '"></span>' + esc(p.nom) + ' <strong>' + p.n + '</strong></li>';
      }).join('') + '</ul>';
  }

  /* Els atributs d'una fila que es clica (amb el ratolí o amb Retorn): la
     fitxa d'un alumne o una assignatura. El valor, sempre entre cometes i
     passat per `_idJs`. */
  var _FILA = ' class="an-clicable" role="button" tabindex="0"';
  function clicAlumne(id) {
    var a = _idJs(String(id));
    return _FILA + ` onclick="analisiObreAlumne('${a}')" onkeydown="if(event.key==='Enter'){analisiObreAlumne('${a}')}"`;
  }
  function clicAssig(k) {
    var a = _idJs(String(k));
    return _FILA + ` onclick="analisiAssig('${a}')" onkeydown="if(event.key==='Enter'){analisiAssig('${a}')}"`;
  }

  /* Barres horitzontals. `files`: [{nom, valor 0-100, text, color, peu, clic}]
     (`clic`: els atributs de `clicAlumne`/`clicAssig`, o res) */
  function barres(files) {
    if (!files.length) return buit('Encara no hi ha dades.');
    return '<ul class="an-barres">' + files.map(function (f) {
      var v = Math.max(0, Math.min(100, f.valor || 0));
      return '<li' + (f.clic || '') + '>' +
        '<span class="an-barra-nom">' + esc(f.nom) + (f.peu ? '<span class="an-barra-peu">' + esc(f.peu) + '</span>' : '') + '</span>' +
        '<span class="an-barra-pista"><span class="an-barra" style="width:' + v + '%;background:' + (f.color || '#8B1E3F') + '"></span></span>' +
        '<span class="an-barra-txt">' + esc(f.text) + '</span></li>';
    }).join('') + '</ul>';
  }

  /* Com es reparteixen les notes del 0 al 10 (arrodonides). */
  function histograma(notes) {
    var bins = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    notes.forEach(function (n) { var k = Math.max(0, Math.min(10, Math.floor(n + 0.5))); bins[k]++; });
    var max = Math.max.apply(null, bins) || 1;
    return '<div class="an-hist" role="img" aria-label="Notes del 0 al 10: ' + bins.join(', ') + '">' + bins.map(function (n, i) {
      var b = banda(i);
      return '<div class="an-hist-col" title="' + i + ': ' + n + ' alumne' + (n === 1 ? '' : 's') + '">' +
        '<span class="an-hist-n">' + (n || '') + '</span>' +
        '<span class="an-hist-barra" style="height:' + Math.round(n / max * 100) + '%;background:' + b.color + '"></span>' +
        '<span class="an-hist-et">' + i + '</span></div>';
    }).join('') + '</div>';
  }

  /* L'evolució per trimestres. `series`: [{nom, color, punts:[v1,v2,v3]}], escala 0..maxY */
  function linia(series, maxY, sufix) {
    var W = 300, H = 150, X0 = 34, Y0 = 16, AW = 240, AH = 104;
    var xs = [X0, X0 + AW / 2, X0 + AW];
    function y(v) { return Y0 + AH - (v / maxY) * AH; }
    var grid = [0, 0.5, 1].map(function (f) {
      var v = maxY * f, yy = y(v);
      return '<line x1="' + X0 + '" x2="' + (X0 + AW) + '" y1="' + yy + '" y2="' + yy + '" class="an-grid"/>' +
        '<text x="' + (X0 - 6) + '" y="' + (yy + 4) + '" text-anchor="end" class="an-eix">' + Math.round(v) + (sufix || '') + '</text>';
    }).join('');
    var et = ['1r', '2n', '3r'].map(function (t, i) {
      return '<text x="' + xs[i] + '" y="' + (Y0 + AH + 18) + '" text-anchor="middle" class="an-eix">' + t + ' trim.</text>';
    }).join('');
    var ls = series.map(function (s) {
      var pts = [];
      s.punts.forEach(function (v, i) { if (typeof v === 'number' && !isNaN(v)) pts.push([xs[i], y(v), v]); });
      if (!pts.length) return '';
      return (pts.length > 1 ? '<polyline fill="none" stroke="' + s.color + '" stroke-width="2.5" points="' +
        pts.map(function (p) { return p[0] + ',' + p[1].toFixed(1); }).join(' ') + '"/>' : '') +
        pts.map(function (p) {
          return '<circle cx="' + p[0] + '" cy="' + p[1].toFixed(1) + '" r="4" fill="' + s.color + '"><title>' +
            esc(s.nom + ': ' + fmt(p[2]) + (sufix || '')) + '</title></circle>' +
            '<text x="' + p[0] + '" y="' + (p[1] - 8).toFixed(1) + '" text-anchor="middle" class="an-valor" fill="' + s.color + '">' +
            esc(fmt(p[2]) + (sufix || '')) + '</text>';
        }).join('');
    }).join('');
    return '<svg class="an-linia" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Evolució per trimestres">' +
      grid + et + ls + '</svg>' +
      (series.length > 1 ? '<ul class="an-llegenda an-llegenda-fila">' + series.map(function (s) {
        return '<li><span class="an-punt" style="background:' + s.color + '"></span>' + esc(s.nom) + '</li>';
      }).join('') + '</ul>' : '');
  }

  /* L'evolució: la mitjana i el % d'aprovats, un al costat de l'altre. Amb
     un sol trimestre amb notes no hi ha evolució: no es pinta (una línia
     d'un sol punt no diu res i ocupa mitja pantalla). */
  function evolucio(titol, mitjanes, pcts, nomPct) {
    if (mitjanes.filter(function (v) { return v !== null && v !== undefined; }).length < 2) return '';
    return targeta(titol, '<div class="an-dues an-evo">' +
      '<div><h4 class="an-h4">Mitjana</h4>' + linia([{ nom: 'Mitjana', color: '#8B1E3F', punts: mitjanes }], 10) + '</div>' +
      '<div><h4 class="an-h4">' + esc(nomPct) + '</h4>' + linia([{ nom: nomPct, color: '#10B981', punts: pcts }], 100, '%') + '</div>' +
      '</div>', { ample: true });
  }

  /* Núvol de punts: actitud (x) i nota (y), de 0 a 10. */
  function nuvol(punts) {
    var X0 = 30, Y0 = 10, A = 200;
    function px(v) { return X0 + v / 10 * A; }
    function py(v) { return Y0 + A - v / 10 * A; }
    var eixos = [0, 5, 10].map(function (v) {
      return '<line x1="' + px(0) + '" x2="' + px(10) + '" y1="' + py(v) + '" y2="' + py(v) + '" class="an-grid"/>' +
        '<text x="' + (X0 - 6) + '" y="' + (py(v) + 4) + '" text-anchor="end" class="an-eix">' + v + '</text>' +
        '<text x="' + px(v) + '" y="' + (Y0 + A + 16) + '" text-anchor="middle" class="an-eix">' + v + '</text>';
    }).join('');
    var dots = punts.map(function (p) {
      return '<circle cx="' + px(p.x).toFixed(1) + '" cy="' + py(p.y).toFixed(1) + '" r="5" fill="#8B1E3F" fill-opacity=".6"><title>' +
        esc(p.nom + ' · actitud ' + fmt(p.x) + ' · nota ' + fmt(p.y)) + '</title></circle>';
    }).join('');
    return '<svg class="an-nuvol" viewBox="0 0 240 245" role="img" aria-label="Actitud i nota de cada alumne">' + eixos + dots +
      '<text x="' + px(5) + '" y="243" text-anchor="middle" class="an-eix">actitud →</text>' +
      '<text x="8" y="' + py(5) + '" text-anchor="middle" class="an-eix" transform="rotate(-90 8 ' + py(5) + ')">nota →</text></svg>';
  }

  function llistaAlumnes(files, buida) {
    if (!files.length) return buit(buida || 'Cap.');
    return '<ul class="an-alumnes">' + files.map(function (f) {
      var clic = (f.id !== undefined && f.id !== null) ? clicAlumne(f.id) : '';
      return '<li' + clic + '><span class="an-al-nom">' + esc(f.nom) + '</span>' +
        (f.motius && f.motius.length ? '<span class="an-motius">' + f.motius.map(function (m) {
          return '<span class="an-motiu ' + (m.to || '') + '">' + esc(m.text) + '</span>';
        }).join('') + '</span>' : '') + (f.dreta ? '<span class="an-al-dreta">' + f.dreta + '</span>' : '') + '</li>';
    }).join('') + '</ul>';
  }
  function _idJs(s) { return (typeof window._idJs === 'function') ? window._idJs(s) : String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }
  function chipNota(n) {
    var b = banda(n);
    if (!b) return '<span class="an-chip an-chip-buit">—</span>';
    return '<span class="an-chip" style="background:' + b.color + '">' + fmt(n) + '</span>';
  }

  /* ============================================================
     ELS SELECTORS
     ============================================================ */
  function pintaControls(es) {
    var cont = byId('anControls');
    if (!cont) return;
    var vs = vistesDisponibles(es);
    if (!vs.some(function (v) { return v.id === E.vista; })) E.vista = vs.length ? vs[0].id : null;
    if (E.vista === 'assig' && !es.some(function (e) { return e.key === E.key; })) E.key = es.length ? es[0].key : null;
    if (E.trim === null || E.trim === undefined) E.trim = (typeof getTrimestreProposat === 'function') ? getTrimestreProposat() : 1;

    var h = '';
    if (vs.length > 1) {
      h += '<div class="an-sel"><span class="an-sel-et">Què vols mirar</span><div class="trim-sel-row">' + vs.map(function (v) {
        return '<button type="button" class="trim-sel-btn' + (v.id === E.vista ? ' active' : '') + '" aria-pressed="' + (v.id === E.vista) +
          '" onclick="analisiVista(\'' + v.id + '\')">' + esc(v.nom) + '</button>';
      }).join('') + '</div></div>';
    }
    if (E.vista === 'assig') {
      h += '<div class="an-sel"><span class="an-sel-et">Assignatura</span><div class="trim-sel-row">' + es.map(function (e) {
        return '<button type="button" class="trim-sel-btn' + (e.key === E.key ? ' active' : '') + '" aria-pressed="' + (e.key === E.key) +
          '" onclick="analisiAssig(\'' + _idJs(e.key) + '\')">' + esc(e.label || e.nom) + '</button>';
      }).join('') + '</div><div id="anDesdobBar" class="desdob-bar-wrap"></div></div>';
    }
    h += '<div class="an-sel"><span class="an-sel-et">Trimestre</span><div class="trim-sel-row">' +
      [[1, '1r Trim.'], [2, '2n Trim.'], [3, '3r Trim.'], [0, 'Tot el curs']].map(function (t) {
        return '<button type="button" class="trim-sel-btn' + (t[0] === E.trim ? ' active' : '') + '" aria-pressed="' + (t[0] === E.trim) +
          '" onclick="analisiTrim(' + t[0] + ')">' + t[1] + '</button>';
      }).join('') + '</div></div>';
    cont.innerHTML = h;
  }

  function trimNom(t) { return t ? ['', '1r trimestre', '2n trimestre', '3r trimestre'][t] : 'tot el curs'; }

  /* ============================================================
     UNA ASSIGNATURA
     ============================================================ */
  async function dadesAssig(e, t, torn, pComent) {
    var nd = notesDe(e);
    await carregaAlumnes(e, nd.dd);
    if (torn !== E.torn) return null;
    var llista = alumnesAra();

    var trims = t ? [t] : [1, 2, 3];
    /* Totes les crides alhora: cada una al Google triga un segon o dos, i
       amb «tot el curs» en són quatre. */
    var respostes = await Promise.all([resumDe(nd.grup)].concat(trims.map(function (tt) {
      return demana({ action: 'getNotes', materia: nd.mat, trimestre: tt, grup: nd.grup });
    })));
    if (torn !== E.torn) return null;
    var resumR = respostes[0];
    var resum = resumR ? resumR.resum : null;
    var rk = clauResum(resum, nd.mat);
    var det = {};
    trims.forEach(function (tt, i) { var r = respostes[i + 1]; det[tt] = (r && r.ok) ? r : null; });

    /* Qui hi ha: amb desdoblament, els del grup triat; si no, la llista del
       grup (i, si no n'hi ha, els noms de la pestanya de notes). */
    var pop = llista.map(function (s) { return { nom: nomDe(s), nomCru: s.nom, s: s }; });
    if (!pop.length) {
      var vistos = {};
      [1, 2, 3].forEach(function (tt) {
        var d = det[tt] || (resum && rk && resum[rk] && resum[rk][tt]);
        ((d && d.rowNoms) || []).forEach(function (n) { if (n && !vistos[norm(n)]) { vistos[norm(n)] = 1; pop.push({ nom: n, nomCru: n, s: null }); } });
      });
    }

    // La nota de cada trimestre (la del full)
    pop.forEach(function (a) {
      a.fin = { 1: null, 2: null, 3: null }; a.ne = 0;
      [1, 2, 3].forEach(function (tt) {
        var d = resum && rk && resum[rk] ? resum[rk][tt] : null;
        if (!d || !d.rowNoms) return;
        var p = posPerNom(a.nomCru, d.rowNoms);
        if (p === -1) p = posPerNom(a.nom, d.rowNoms);
        if (p === -1) return;
        var v = d.notes ? d.notes[p] : null;
        if (v !== null && v !== undefined && !isNaN(parseFloat(v))) a.fin[tt] = parseFloat(v);
      });
      a.nota = t ? a.fin[t] : mitjana([a.fin[1], a.fin[2], a.fin[3]]);
    });

    // Les activitats
    var acts = [];
    trims.forEach(function (tt) {
      var d = det[tt];
      if (!d || !d.items) return;
      d.items.forEach(function (it) {
        var act = { id: it.id, nom: (trims.length > 1 ? tt + 'T · ' : '') + it.nom, nomCru: it.nom, trim: tt,
          max: it.maxPunts || 10, pes: it.pes || 1, cat: it.cat || '', readonly: !!it.readonly, notes: [], ne: 0, buides: 0, perAlumne: {} };
        pop.forEach(function (a, ia) {
          var p = posPerNom(a.nomCru, d.rowNoms || []);
          if (p === -1) p = posPerNom(a.nom, d.rowNoms || []);
          if (p === -1) { act.buides++; return; }
          var esNE = !!(d.noEntregats && d.noEntregats[it.id] && d.noEntregats[it.id][p]);
          if (esNE) { act.ne++; a.ne++; act.perAlumne[ia] = 'NE'; return; }
          var v = (d.valors && d.valors[it.id]) ? d.valors[it.id][p] : '';
          if (v === '' || v === null || v === undefined) { act.buides++; return; }
          var n = act.readonly ? parseFloat(v) : parseFloat(v) / act.max * 10;
          if (isNaN(n)) { act.buides++; return; }
          act.notes.push(n); act.perAlumne[ia] = n;
        });
        act.mitjana = mitjana(act.notes);
        acts.push(act);
      });
    });

    /* Si el resum no porta aquesta assignatura (una pestanya que el resum
       no reconeix), la nota es fa com la mitjana ponderada de sempre. */
    if (!rk && acts.length) {
      pop.forEach(function (a, ia) {
        [1, 2, 3].forEach(function (tt) {
          var sv = 0, sp = 0;
          acts.filter(function (x) { return x.trim === tt; }).forEach(function (x) {
            var v = x.perAlumne[ia]; if (v === undefined) return;
            var n = v === 'NE' ? 0 : v; sv += n * x.pes; sp += x.pes;
          });
          if (sp) a.fin[tt] = Math.floor(sv / sp + 0.5);
        });
        a.nota = t ? a.fin[t] : mitjana([a.fin[1], a.fin[2], a.fin[3]]);
      });
    }

    // L'actitud (la mateixa que el quadre d'actitud de Notes)
    var actitud = null;
    if (typeof getActitud === 'function' && typeof ACTITUD_ASPECTES !== 'undefined' && pop.some(function (a) { return a.s; })) {
      if (typeof _actitudLoadFromSheets === 'function') {
        await Promise.all(trims.map(function (tt) {
          return Promise.resolve().then(function () { return _actitudLoadFromSheets(nd.mat, tt); }).catch(function () {});
        }));
      }
      if (torn !== E.torn) return null;
      actitud = { aspectes: ACTITUD_ASPECTES.map(function (as) { return { id: as.id, nom: as.nom, vals: [] }; }), punts: [] };
      pop.forEach(function (a) {
        if (!a.s) return;
        var mitjAl = [];
        trims.forEach(function (tt) {
          var dades = {};
          try { dades = getActitud(nd.mat, tt, a.s.id) || {}; } catch (x) { dades = {}; }
          actitud.aspectes.forEach(function (as) { var v = parseFloat(dades[as.id]); if (!isNaN(v)) as.vals.push(v); });
          var m = (typeof calcMitjanaActitud === 'function') ? calcMitjanaActitud(dades) : null;
          if (m !== null) mitjAl.push(m);
        });
        a.actitud = mitjana(mitjAl);
        if (a.actitud !== null && a.nota !== null) actitud.punts.push({ x: a.actitud, y: a.nota, nom: a.nom });
      });
      actitud.hiHa = actitud.aspectes.some(function (as) { return as.vals.length; });
    }

    // Els assoliments (d'un trimestre)
    var assim = null;
    if (t && typeof assimObjLoad === 'function' && typeof assimValGet === 'function') {
      var objs = [];
      try { objs = assimObjLoad(e.key, t) || []; } catch (x) { objs = []; }
      if (objs.length && pop.some(function (a) { return a.s; })) {
        assim = { objs: objs.map(function (o) { return { o: o, c: { mba: 0, ass: 0, aaj: 0, nass: 0, buit: 0 } }; }) };
        pop.forEach(function (a) {
          if (!a.s) return;
          var sid = sidDe(a.s), c = { mba: 0, ass: 0, aaj: 0, nass: 0 }, marcats = 0;
          assim.objs.forEach(function (oo) {
            var v = null;
            try { v = assimValGet(sid, oo.o.id, e.key, t); } catch (x) { v = null; }
            if (v && oo.c[v] !== undefined) { oo.c[v]++; c[v]++; marcats++; } else oo.c.buit++;
          });
          a.assimCompte = c; a.assimMarcats = marcats;
          /* Sobre els objectius que ja té MARCATS: a mig trimestre, comptar
             els buits com a zeros faria semblar que tothom va malament. */
          a.assimPct = (marcats && typeof _assimPctFila === 'function') ? _assimPctFila(c, marcats) : null;
        });
      }
    }

    // Els comentaris de l'informe desats (v385)
    var coment = null;
    if (pComent) { await pComent; if (torn !== E.torn) return null; }
    if (t && typeof _comentDesatsLlegeix === 'function') {
      try {
        var cd = _comentDesatsLlegeix();
        coment = { fets: 0, total: 0 };
        pop.forEach(function (a) {
          if (!a.s) return;
          coment.total++;
          var k = t + '|' + e.key + '|' + sidDe(a.s);
          if (cd[k] && String(cd[k].text || '').trim()) { coment.fets++; a.comentFet = true; }
        });
      } catch (x) { coment = null; }
    }

    return { e: e, t: t, pop: pop, acts: acts, cats: (det[trims[0]] && det[trims[0]].cats) || [],
             actitud: actitud, assim: assim, coment: coment, teResum: !!rk };
  }

  function pintaAssig(D) {
    var t = D.t, pop = D.pop;
    var amb = pop.filter(function (a) { return a.nota !== null && a.nota !== undefined && !isNaN(a.nota); });
    var notes = amb.map(function (a) { return a.nota; });
    var aprov = amb.filter(function (a) { return a.nota >= 5; }).length;
    var compte = BANDES.map(function (b) { return { nom: b.codi, n: amb.filter(function (a) { return banda(a.nota) === b; }).length, color: b.color }; });
    var h = '';

    if (!amb.length && !D.acts.length) {
      return targeta(D.e.label || D.e.nom, buit('Encara no hi ha cap nota d\'aquesta assignatura ' +
        (t ? 'en el ' + trimNom(t) : 'aquest curs') + '. Quan en posis a <strong>Notes</strong>, aquí sortirà l\'anàlisi.'), { ample: true });
    }

    // Xifres
    var neTot = pop.reduce(function (s, a) { return s + (a.ne || 0); }, 0);
    var xs = [
      { valor: pop.length, nom: 'alumnes' },
      { valor: fmt(mitjana(notes)), nom: 'mitjana' },
      { valor: amb.length ? pct(aprov, amb.length) + '%' : '—', nom: 'aproven', to: amb.length && pct(aprov, amb.length) < 70 ? 'an-alerta' : '' },
      { valor: compte[0].n, nom: 'NA (suspesos)', to: compte[0].n ? 'an-alerta' : '' },
      { valor: neTot, nom: 'NE (no entregats)' },
    ];
    if (D.assim) {
      var pcts = pop.filter(function (a) { return a.assimPct !== null && a.assimPct !== undefined && a.assimMarcats; }).map(function (a) { return a.assimPct; });
      if (pcts.length) xs.push({ valor: Math.round(mitjana(pcts)) + '%', nom: 'assoliment mitjà' });
    }
    h += xifres(xs);

    // 1. Aprovats i suspesos · 2. Qualificacions · 3. Repartiment
    h += '<div class="an-graella">';
    h += targeta('Aproven i suspenen', amb.length ? donut([
      { nom: 'Aproven', n: aprov, color: '#10B981' }, { nom: 'Suspenen', n: amb.length - aprov, color: '#DC2626' },
    ], pct(aprov, amb.length) + '%', 'aproven') : buit('Encara no hi ha notes del trimestre.'));
    h += targeta('NA, AS, AN i AE', apilada(compte.map(function (c, i) { return { nom: BANDES[i].codi + ' · ' + BANDES[i].nom, n: c.n, color: c.color }; })));
    if (notes.length) {
      h += targeta('Com es reparteixen les notes', histograma(notes) +
        '<p class="an-peu">Més alta <strong>' + fmt(Math.max.apply(null, notes)) + '</strong> · més baixa <strong>' +
        fmt(Math.min.apply(null, notes)) + '</strong> · mitjana <strong>' + fmt(mitjana(notes)) + '</strong></p>', { ample: true });
    }
    h += '</div>';
    // 4. Evolució
    var evo = [1, 2, 3].map(function (tt) { return mitjana(pop.map(function (a) { return a.fin[tt]; })); });
    var evoAp = [1, 2, 3].map(function (tt) {
      var ams = pop.filter(function (a) { return a.fin[tt] !== null; });
      return ams.length ? pct(ams.filter(function (a) { return a.fin[tt] >= 5; }).length, ams.length) : null;
    });
    h += evolucio('Evolució per trimestres', evo, evoAp, '% que aproven');

    // 5. Pugen i baixen
    var canvis = canvisEntreTrims(pop, t);
    if (canvis) h += targeta('Qui puja i qui baixa (' + canvis.de + ' → ' + canvis.a + ')',
      '<div class="an-dues"><div><h4 class="an-h4">⬆ Pugen (' + canvis.pugen.length + ')</h4>' + llistaAlumnes(canvis.pugen, 'Ningú.') +
      '</div><div><h4 class="an-h4">⬇ Baixen (' + canvis.baixen.length + ')</h4>' + llistaAlumnes(canvis.baixen, 'Ningú.') + '</div></div>', { ample: true });

    // 14-17. Alumnes a mirar
    h += targeta('Alumnes a mirar', llistaAlumnes(alertesAssig(D, canvis), 'Cap alumne amb cap senyal d\'alerta. 👏'),
      { ample: true, sub: 'Suspèn, ha baixat de qualificació, té molts NE o molts NA als assoliments.' });

    // 6-9. Activitats
    var acts = D.acts.filter(function (a) { return a.notes.length || a.ne; });
    if (acts.length) {
      var ord = acts.slice().sort(function (a, b) { return (a.mitjana === null ? 99 : a.mitjana) - (b.mitjana === null ? 99 : b.mitjana); });
      h += '<div class="an-graella">';
      h += targeta('Les activitats, de pitjor a millor', barres(ord.map(function (a) {
        var b = banda(a.mitjana);
        return { nom: a.nom, valor: (a.mitjana || 0) * 10, text: fmt(a.mitjana), color: b ? b.color : '#9CA3AF',
                 peu: (a.notes.length ? pct(a.notes.filter(function (n) { return n >= 5; }).length, a.notes.length) + '% aproven' : '') +
                      (a.ne ? ' · ' + a.ne + ' NE' : '') + (a.pes > 1 ? ' · pes ' + a.pes : '') };
      })), { sub: 'La mitjana de cada activitat, sobre 10. Les de dalt són les que han anat pitjor.' });
      var ambNE = acts.filter(function (a) { return a.ne; }).sort(function (a, b) { return b.ne - a.ne; });
      var nensNE = D.pop.filter(function (a) { return a.ne; }).sort(function (a, b) { return b.ne - a.ne; });
      h += targeta('No entregats (NE)', ambNE.length
        ? barres(ambNE.map(function (a) { return { nom: a.nom, valor: pct(a.ne, D.pop.length), text: a.ne + ' NE', color: '#DC2626' }; })) +
          '<h4 class="an-h4">Qui en té més</h4>' + llistaAlumnes(nensNE.slice(0, 8).map(function (a) {
            return { id: a.s ? a.s.id : null, nom: a.nom, dreta: '<strong>' + a.ne + '</strong> NE' };
          }))
        : buit('Cap NE. 👏'));
      // 8. Categories
      if (D.cats && D.cats.length) {
        var perCat = D.cats.map(function (c) {
          var ns = []; acts.filter(function (a) { return a.cat === c.id; }).forEach(function (a) { ns = ns.concat(a.notes); });
          return { nom: c.nom, m: mitjana(ns), n: ns.length, pes: c.pes };
        }).filter(function (c) { return c.n; });
        if (perCat.length) h += targeta('Per categories', barres(perCat.map(function (c) {
          var b = banda(c.m);
          return { nom: c.nom, valor: (c.m || 0) * 10, text: fmt(c.m), color: b ? b.color : '#9CA3AF', peu: c.pes ? 'compta un ' + c.pes + '%' : '' };
        })));
      }
      // 9. Versió adaptada
      var adapt = acts.filter(function (a) { return / · adaptada$/.test(a.nomCru); });
      if (adapt.length) {
        h += targeta('Versions adaptades', barres(adapt.map(function (a) {
          var base = acts.find(function (x) { return x.trim === a.trim && x.nomCru === a.nomCru.replace(/ · adaptada$/, ''); });
          return { nom: a.nom, valor: (a.mitjana || 0) * 10, text: fmt(a.mitjana), color: '#8B5CF6',
                   peu: a.notes.length + ' alumne' + (a.notes.length === 1 ? '' : 's') + (base ? ' · l\'ordinària: ' + fmt(base.mitjana) : '') };
        })), { sub: 'Com els va als que fan la versió adaptada, al costat de la mitjana de la versió ordinària.' });
      }
      h += '</div>';
    }

    // 10. Actitud
    if (D.actitud && D.actitud.hiHa) {
      h += '<div class="an-graella">';
      h += targeta('L\'actitud, aspecte per aspecte', barres(D.actitud.aspectes.filter(function (as) { return as.vals.length; }).map(function (as) {
        var m = mitjana(as.vals), b = banda(m);
        return { nom: as.nom, valor: (m || 0) * 10, text: fmt(m), color: b ? b.color : '#9CA3AF' };
      })));
      if (D.actitud.punts.length >= 3) {
        h += targeta('Actitud i nota', nuvol(D.actitud.punts),
          { sub: 'Cada punt és un alumne. Si van cap amunt a la dreta, qui té millor actitud treu millor nota.' });
      }
      h += '</div>';
    }

    // 11-13. Assoliments
    if (D.assim) {
      var obj = D.assim.objs.map(function (oo, i) { return { oo: oo, i: i, na: oo.c.nass, marc: oo.c.mba + oo.c.ass + oo.c.aaj + oo.c.nass }; });
      var dificils = obj.filter(function (x) { return x.marc; }).sort(function (a, b) { return pct(b.na + b.oo.c.aaj * 0.5, b.marc) - pct(a.na + a.oo.c.aaj * 0.5, a.marc); });
      h += targeta('Els objectius: on costa més', dificils.length ? '<ul class="an-objs">' + dificils.map(function (x) {
        var tot = x.marc;
        return '<li><span class="an-obj-text"><strong>' + (x.i + 1) + '.</strong> ' + esc(x.oo.o.text || x.oo.o.nom || '') + '</span>' +
          '<span class="an-apilada an-apilada-petita">' + NIVELLS_ASSIM.map(function (nv) {
            var n = x.oo.c[nv.key];
            return n ? '<span style="flex:' + n + ';background:' + nv.color + '" title="' + nv.curt + ': ' + n + '">' + (pct(n, tot) >= 12 ? n : '') + '</span>' : '';
          }).join('') + '</span>' +
          (x.oo.c.buit ? '<span class="an-gris an-obj-peu">' + x.oo.c.buit + ' sense marcar</span>' : '') + '</li>';
      }).join('') + '</ul><ul class="an-llegenda an-llegenda-fila">' + NIVELLS_ASSIM.map(function (nv) {
        return '<li><span class="an-punt" style="background:' + nv.color + '"></span>' + nv.curt + '</li>';
      }).join('') + '</ul>' : buit('Encara no has marcat cap objectiu d\'aquest trimestre a <strong>Assoliments</strong>.'),
        { ample: true, sub: 'Ordenats de més difícil a més fàcil: primer els que tenen més NA i AAJ.' });
      var rank = D.pop.filter(function (a) { return a.assimMarcats; }).sort(function (a, b) { return (b.assimPct || 0) - (a.assimPct || 0); });
      var incoh = D.pop.filter(function (a) {
        if (!a.assimMarcats || a.nota === null || a.nota === undefined || a.assimMarcats < Math.max(3, D.assim.objs.length / 2)) return false;
        return (a.nota >= 7 && a.assimPct < 50) || (a.nota < 5 && a.assimPct >= 75);
      });
      if (rank.length) h += '<div class="an-graella">';
      if (rank.length) h += targeta('Assoliment de cada alumne', rank.length ? '<p class="an-card-sub">Sobre els objectius que ja li tens marcats.</p>' + barres(rank.map(function (a) {
        var c = a.assimPct >= 80 ? '#10B981' : a.assimPct >= 50 ? '#F59E0B' : '#DC2626';
        return { nom: a.nom, valor: a.assimPct, text: a.assimPct + '%', color: c,
                 clic: a.s ? clicAlumne(a.s.id) : null };
      })) : buit('Encara no hi ha cap alumne avaluat.'));
      if (rank.length) h += targeta('La nota i els assoliments no quadren', llistaAlumnes(incoh.map(function (a) {
        return { id: a.s ? a.s.id : null, nom: a.nom, motius: [
          { text: 'nota ' + fmt(a.nota), to: a.nota >= 5 ? 'an-ok' : 'an-mal' },
          { text: 'assoliment ' + a.assimPct + '%', to: a.assimPct >= 50 ? 'an-ok' : 'an-mal' }] };
      }), 'Cap: la nota i els assoliments diuen el mateix. 👍'),
        { sub: 'Bona nota amb molts objectius per assolir, o al revés. Val la pena mirar-ho abans de l\'informe.' });
      if (rank.length) h += '</div>';
    } else if (!t) {
      h += targeta('Els assoliments', buit('Els assoliments són de cada trimestre: tria\'n un a dalt per veure\'ls.'), { ample: true });
    }

    // 22. Feina pendent
    h += targeta('La teva feina pendent', feinaPendent(D), { ample: true });
    if (!D.teResum && D.acts.length) {
      h += '<p class="an-nota">La nota de cada alumne s\'ha calculat aquí amb la mitjana ponderada de les activitats.</p>';
    }
    return h;
  }

  function canvisEntreTrims(pop, t) {
    var a = t || 3, de = null;
    if (!t) {
      // Tot el curs: els dos últims trimestres amb notes
      var amb = [1, 2, 3].filter(function (tt) { return pop.some(function (x) { return x.fin[tt] !== null; }); });
      if (amb.length < 2) return null;
      a = amb[amb.length - 1]; de = amb[amb.length - 2];
    } else {
      if (t < 2) return null;
      de = t - 1;
      if (!pop.some(function (x) { return x.fin[de] !== null; })) return null;
    }
    var pugen = [], baixen = [];
    pop.forEach(function (x) {
      var o1 = ordreBanda(x.fin[de]), o2 = ordreBanda(x.fin[a]);
      if (o1 === -1 || o2 === -1 || o1 === o2) return;
      var f = { id: x.s ? x.s.id : null, nom: x.nom, dreta: chipNota(x.fin[de]) + ' → ' + chipNota(x.fin[a]) };
      (o2 > o1 ? pugen : baixen).push(f);
    });
    return { de: trimNom(de).replace(' trimestre', ''), a: trimNom(a).replace(' trimestre', ''), pugen: pugen, baixen: baixen };
  }

  function alertesAssig(D, canvis) {
    var baixen = {};
    if (canvis) canvis.baixen.forEach(function (f) { baixen[f.nom] = true; });
    var out = [];
    D.pop.forEach(function (a) {
      var m = [];
      if (a.nota !== null && a.nota !== undefined && a.nota < 5) m.push({ text: 'suspèn (' + fmt(a.nota) + ')', to: 'an-mal' });
      if (baixen[a.nom]) m.push({ text: 'ha baixat', to: 'an-avis' });
      if (a.ne >= 3) m.push({ text: a.ne + ' NE', to: 'an-avis' });
      if (a.assimMarcats >= 3 && a.assimCompte && a.assimCompte.nass / a.assimMarcats >= 0.5) {
        m.push({ text: a.assimCompte.nass + ' NA als objectius', to: 'an-avis' });
      }
      if (m.length) out.push({ id: a.s ? a.s.id : null, nom: a.nom, motius: m, pes: m.length });
    });
    return out.sort(function (a, b) { return b.pes - a.pes || a.nom.localeCompare(b.nom); });
  }

  function feinaPendent(D) {
    var files = [];
    var buides = D.acts.filter(function (a) { return a.buides && !a.readonly; });
    var nb = buides.reduce(function (s, a) { return s + a.buides; }, 0);
    files.push({ ok: !nb, text: nb ? nb + ' notes per posar, en ' + buides.length + ' activitat' + (buides.length === 1 ? '' : 's') +
      ' (' + buides.slice(0, 4).map(function (a) { return a.nom; }).join(', ') + (buides.length > 4 ? '…' : '') + ')' : 'Totes les notes posades.' });
    if (D.assim) {
      var pend = D.assim.objs.reduce(function (s, oo) { return s + oo.c.buit; }, 0);
      files.push({ ok: !pend, text: pend ? pend + ' caselles d\'objectius sense marcar a Assoliments.' : 'Tots els objectius marcats.' });
    }
    if (D.coment && D.coment.total) {
      var falten = D.coment.total - D.coment.fets;
      files.push({ ok: !falten, text: falten ? 'Et falten ' + falten + ' comentaris d\'informe (en tens ' + D.coment.fets + ' de ' + D.coment.total + ').' : 'Tots els comentaris de l\'informe fets.' });
    }
    return '<ul class="an-pendent">' + files.map(function (f) {
      return '<li class="' + (f.ok ? 'an-ok' : 'an-avis') + '">' + (f.ok ? '✓ ' : '• ') + esc(f.text) + '</li>';
    }).join('') + '</ul>';
  }

  /* ============================================================
     LA TUTORIA (o el grup, a direcció)
     ============================================================ */
  async function dadesGrup(t, torn) {
    var g = grupPropi();
    if (!g) return { senseGrup: true };
    /* La llista sencera del grup, com la de la pàgina Alumnes. A direcció,
       la del grup que tingui triat; a un tutor, la seva (si encara no havia
       arribat, es demana). */
    try {
      var tenim = (typeof _tutoriaAlumnes !== 'undefined' && _tutoriaAlumnes && _tutoriaAlumnes.length);
      if ((esDir() || !tenim) && typeof _loadTutoriaGrup === 'function') await _loadTutoriaGrup();
      if (typeof _restoreTutoriaStudents === 'function') _restoreTutoriaStudents();
    } catch (x) {}
    if (torn !== E.torn) return null;
    var pop = alumnesAra().map(function (s) { return { nom: nomDe(s), nomCru: s.nom, s: s, per: {} }; });

    var rr = await Promise.all([
      resumDe(g),
      (typeof carregaNotesCompartides === 'function')
        ? Promise.resolve().then(function () { return carregaNotesCompartides(g); }).catch(function () { return null; })
        : null,
    ]);
    if (torn !== E.torn) return null;
    var resumR = rr[0], comp = rr[1];

    var assigs = [];
    var vistes = {};
    if (resumR && resumR.mats) {
      resumR.mats.forEach(function (m) {
        var nom = String(m.nom || m.key).split('__')[0];
        if (vistes[norm(nom)] || vistes[norm(m.key)]) return;
        vistes[norm(nom)] = vistes[norm(m.key)] = true;
        assigs.push({ nom: nom, de: 'meva', dades: resumR.resum[m.key] });
      });
    }
    var noPublicades = [];
    (comp || []).forEach(function (a) {
      if (vistes[norm(a.key)] || vistes[norm(a.nom)]) return;
      vistes[norm(a.key)] = vistes[norm(a.nom)] = true;
      if (!a.compartit) { noPublicades.push(a.nom); return; }
      assigs.push({ nom: a.nom, de: a.mestra || 'altra', alumnes: a.alumnes || {} });
    });

    pop.forEach(function (al) {
      assigs.forEach(function (as, ia) {
        var fin = { 1: null, 2: null, 3: null };
        [1, 2, 3].forEach(function (tt) {
          var v = null;
          if (as.dades) {
            var d = as.dades[tt];
            if (d && d.rowNoms) {
              var p = posPerNom(al.nomCru, d.rowNoms);
              if (p === -1) p = posPerNom(al.nom, d.rowNoms);
              if (p !== -1 && d.notes) v = d.notes[p];
            }
          } else if (as.alumnes) {
            /* Les notes publicades van per la fila del full del nen (com a la
               seva fitxa: `pintaNotesAltresMestres`). */
            var rid = (typeof personal !== 'undefined' && personal[al.s.id] && personal[al.s.id].rowId) || al.s.rowId;
            var n = (rid !== undefined && rid !== null && as.alumnes[String(rid)]) || {};
            v = n[String(tt)];
          }
          if (v !== null && v !== undefined && v !== '' && !isNaN(parseFloat(v))) fin[tt] = parseFloat(v);
        });
        al.per[ia] = { fin: fin, nota: t ? fin[t] : mitjana([fin[1], fin[2], fin[3]]) };
      });
      var ns = assigs.map(function (as, ia) { return al.per[ia].nota; }).filter(function (v) { return v !== null && v !== undefined && !isNaN(v); });
      al.mitjana = mitjana(ns);
      al.suspeses = ns.filter(function (v) { return v < 5; }).length;
      al.ambNotes = ns.length;
    });

    return { g: g, t: t, pop: pop, assigs: assigs, noPublicades: noPublicades };
  }

  function pintaGrup(D) {
    if (D.senseGrup) {
      return targeta('El grup', buit(esDir()
        ? 'Primer tria un grup a <strong>Alumnes</strong>: l\'anàlisi és del grup que tinguis triat.'
        : 'Al teu perfil no hi ha cap tutoria. Tria <strong>Una assignatura</strong> a dalt.'), { ample: true });
    }
    var t = D.t, pop = D.pop, h = '';
    if (!D.assigs.length) {
      return targeta('El grup ' + D.g, buit('Encara no hi ha notes de cap assignatura d\'aquest grup. Quan en posis a <strong>Notes</strong> (o les altres mestres publiquin les seves), aquí sortirà l\'anàlisi.'), { ample: true });
    }
    var ambNotes = pop.filter(function (a) { return a.ambNotes; });
    var totes = ambNotes.filter(function (a) { return a.suspeses === 0; }).length;
    var dues = ambNotes.filter(function (a) { return a.suspeses >= 2; }).length;
    h += xifres([
      { valor: pop.length, nom: 'alumnes' },
      { valor: D.assigs.length, nom: 'assignatures' },
      { valor: fmt(mitjana(ambNotes.map(function (a) { return a.mitjana; }))), nom: 'mitjana del grup' },
      { valor: ambNotes.length ? pct(totes, ambNotes.length) + '%' : '—', nom: 'ho aproven tot' },
      { valor: dues, nom: 'en suspenen 2 o més', to: dues ? 'an-alerta' : '' },
    ]);

    // 18. El quadre
    var cap = '<tr><th class="an-q-nom">Alumne</th>' + D.assigs.map(function (as) {
      return '<th title="' + esc(as.nom + (as.de !== 'meva' ? ' · ' + as.de : '')) + '"><span>' + esc(as.nom) + '</span></th>';
    }).join('') + '<th>Mitjana</th><th>Susp.</th></tr>';
    var files = pop.map(function (al) {
      return '<tr><td class="an-q-nom"><button type="button" class="an-link" onclick="analisiObreAlumne(\'' + _idJs(String(al.s.id)) + '\')">' +
        esc(al.nom) + '</button></td>' + D.assigs.map(function (as, ia) {
          var n = al.per[ia].nota, b = banda(n);
          return '<td class="an-q-cel"' + (b ? ' style="background:' + b.color + '22;color:' + b.color + '"' : '') + ' title="' +
            esc(as.nom + ': ' + fmt(n)) + '">' + (b ? fmt(n) : '<span class="an-gris">—</span>') + '</td>';
        }).join('') + '<td class="an-q-cel"><strong>' + fmt(al.mitjana) + '</strong></td>' +
        '<td class="an-q-cel' + (al.suspeses ? ' an-q-susp' : '') + '">' + (al.ambNotes ? al.suspeses : '—') + '</td></tr>';
    }).join('');
    h += targeta('Alumne per alumne', '<div class="an-quadre-wrap"><table class="an-quadre"><thead>' + cap + '</thead><tbody>' + files + '</tbody></table></div>' +
      (D.noPublicades.length ? '<p class="an-peu">Encara no hi ha notes publicades de: ' + esc(D.noPublicades.join(', ')) +
        '. Les publica l\'app de cada mestra quan l\'obre.</p>' : ''), { ample: true, sub: 'La nota de cada assignatura (' + trimNom(t) + '). En vermell, suspès. Clica un nom per obrir-ne la fitxa.' });

    // 19-20 i evolució
    h += '<div class="an-graella">';
    var perAssig = D.assigs.map(function (as, ia) {
      var ns = pop.map(function (al) { return al.per[ia].nota; }).filter(function (v) { return v !== null && v !== undefined && !isNaN(v); });
      return { nom: as.nom, n: ns.length, susp: ns.filter(function (v) { return v < 5; }).length, m: mitjana(ns) };
    }).filter(function (x) { return x.n; }).sort(function (a, b) { return pct(b.susp, b.n) - pct(a.susp, a.n); });
    h += targeta('On suspenen més', barres(perAssig.map(function (x) {
      return { nom: x.nom, valor: pct(x.susp, x.n), text: x.susp + ' (' + pct(x.susp, x.n) + '%)', color: '#DC2626', peu: 'mitjana ' + fmt(x.m) };
    })), { sub: 'Quants alumnes suspenen cada assignatura.' });
    var dist = [0, 0, 0, 0];
    ambNotes.forEach(function (a) { dist[Math.min(3, a.suspeses)]++; });
    h += targeta('Quantes en suspèn cada alumne', barres(['Cap', '1', '2', '3 o més'].map(function (nom, i) {
      return { nom: nom, valor: pct(dist[i], ambNotes.length), text: dist[i] + ' alumne' + (dist[i] === 1 ? '' : 's'),
               color: i === 0 ? '#10B981' : i === 1 ? '#F59E0B' : '#DC2626' };
    })));
    var evo = [1, 2, 3].map(function (tt) {
      var ms = pop.map(function (al) { return mitjana(D.assigs.map(function (as, ia) { return al.per[ia].fin[tt]; })); });
      return mitjana(ms);
    });
    var evoTot = [1, 2, 3].map(function (tt) {
      var amb = pop.filter(function (al) { return D.assigs.some(function (as, ia) { return al.per[ia].fin[tt] !== null; }); });
      if (!amb.length) return null;
      return pct(amb.filter(function (al) { return D.assigs.every(function (as, ia) { var v = al.per[ia].fin[tt]; return v === null || v >= 5; }); }).length, amb.length);
    });
    h += '</div>';
    h += evolucio('Evolució del grup', evo, evoTot, '% que ho aproven tot');

    // 14-17. Alumnes a mirar
    h += targeta('Alumnes a mirar', llistaAlumnes(alertesGrup(D), 'Cap alumne amb cap senyal d\'alerta. 👏'),
      { ample: true, sub: 'Suspèn alguna assignatura o ha baixat de qualificació.' });

    // 21. Registres d'aula
    var reg = registres(D);
    if (reg) h += reg;

    // 22. La feina pendent de la tutoria
    if (t) {
      var pend = comentarisTutoria(D) + senseObservacio(D);
      if (pend) h += targeta('La teva feina pendent', '<ul class="an-pendent">' + pend + '</ul>', { ample: true });
    }
    return h;
  }

  function alertesGrup(D) {
    var t = D.t, out = [];
    D.pop.forEach(function (al) {
      var m = [];
      if (al.suspeses >= 2) m.push({ text: 'suspèn ' + al.suspeses + ' assignatures', to: 'an-mal' });
      else if (al.suspeses === 1) {
        var quina = D.assigs.filter(function (as, ia) { var v = al.per[ia].nota; return v !== null && v !== undefined && v < 5; }).map(function (as) { return as.nom; })[0];
        m.push({ text: 'suspèn ' + (quina || 'una assignatura'), to: 'an-mal' });
      }
      // Ha baixat de qualificació en alguna assignatura
      var de = t ? t - 1 : null, a = t;
      if (!t) {
        var amb = [1, 2, 3].filter(function (tt) { return D.assigs.some(function (as, ia) { return al.per[ia].fin[tt] !== null; }); });
        if (amb.length >= 2) { a = amb[amb.length - 1]; de = amb[amb.length - 2]; }
      }
      if (de && a) {
        var baixades = D.assigs.filter(function (as, ia) {
          var o1 = ordreBanda(al.per[ia].fin[de]), o2 = ordreBanda(al.per[ia].fin[a]);
          return o1 !== -1 && o2 !== -1 && o2 < o1;
        }).map(function (as) { return as.nom; });
        if (baixades.length) m.push({ text: 'baixa a ' + baixades.join(', '), to: 'an-avis' });
      }
      if (m.length) out.push({ id: al.s.id, nom: al.nom, motius: m, pes: m.length + (al.suspeses || 0) });
    });
    return out.sort(function (a, b) { return b.pes - a.pes || a.nom.localeCompare(b.nom); });
  }

  /* 21. Les caselles dels registres d'aula (el de la tutoria, que és el que
     té carregat un tutor; a direcció, només si és del mateix grup). */
  function registres(D) {
    try {
      if (typeof registreItems === 'undefined' || !registreItems || !registreItems.length) return '';
      if (esDir() && typeof _registreGrup === 'function' && _registreGrup() !== D.g) return '';
      if (!esDir() && typeof _registreGrup === 'function' && _registreGrup() !== '') return '';
      var checks = registreItems.filter(function (it) { return it.tipus === 'checkbox'; });
      if (!checks.length) return '';
      var perItem = checks.map(function (it) {
        var d = registreData[it.id] || {}, fets = 0;
        D.pop.forEach(function (al) { if (d[al.s.id] === true) fets++; });
        return { nom: it.nom, fets: fets };
      });
      var perAl = D.pop.map(function (al) {
        var fets = 0;
        checks.forEach(function (it) { var d = registreData[it.id] || {}; if (d[al.s.id] === true) fets++; });
        return { al: al, p: pct(fets, checks.length) };
      });
      var bons = perAl.filter(function (x) { return x.p >= 80 && x.al.mitjana !== null; });
      var dolents = perAl.filter(function (x) { return x.p < 50 && x.al.mitjana !== null; });
      var rel = (bons.length && dolents.length)
        ? '<p class="an-peu">Els que en tenen el 80% o més marcat tenen una mitjana de <strong>' + fmt(mitjana(bons.map(function (x) { return x.al.mitjana; }))) +
          '</strong>; els que no arriben al 50%, de <strong>' + fmt(mitjana(dolents.map(function (x) { return x.al.mitjana; }))) + '</strong>.</p>' : '';
      return '<div class="an-graella">' +
        targeta('Registres d\'aula', barres(perItem.map(function (x) {
          return { nom: x.nom, valor: pct(x.fets, D.pop.length), text: pct(x.fets, D.pop.length) + '%', color: '#8B1E3F' };
        })), { sub: 'Quants alumnes tenen marcada cada casella.' }) +
        targeta('Qui en té menys de marcades', llistaAlumnes(perAl.filter(function (x) { return x.p < 50; }).sort(function (a, b) { return a.p - b.p; }).map(function (x) {
          return { id: x.al.s.id, nom: x.al.nom, dreta: '<strong>' + x.p + '%</strong>' };
        }), 'Tothom en té més de la meitat. 👍') + rel) + '</div>';
    } catch (e) { return ''; }
  }

  function comentarisTutoria(D) {
    if (typeof _comentDesatsLlegeix !== 'function') return '';
    var cd = {};
    try { cd = _comentDesatsLlegeix(); } catch (e) { return ''; }
    var es = entrades().filter(function (e) { return !e.altres && e.grup === D.g; });
    if (!es.length) return '';
    return es.map(function (e) {
      var fets = 0;
      D.pop.forEach(function (al) { var k = D.t + '|' + e.key + '|' + sidDe(al.s); if (cd[k] && String(cd[k].text || '').trim()) fets++; });
      var falten = D.pop.length - fets;
      return '<li class="' + (falten ? 'an-avis' : 'an-ok') + '">' + (falten ? '• ' : '✓ ') + esc((e.label || e.nom) + ': ') +
        (falten ? 'et falten ' + falten + ' comentaris d\'informe (' + fets + ' de ' + D.pop.length + ')' : 'tots els comentaris fets') + '</li>';
    }).join('');
  }

  /* Els alumnes sense cap observació aquest trimestre (de cap assignatura ni
     general): és el que fa falta per a l'informe. */
  function senseObservacio(D) {
    if (typeof observacions === 'undefined' || !observacions || !D.pop.length) return '';
    var sense = D.pop.filter(function (al) {
      var obs = observacions[al.s.id] || {};
      return !Object.keys(obs).some(function (k) { return k.indexOf(D.t + '_') === 0 && String(obs[k] || '').trim(); });
    });
    if (!sense.length) return '<li class="an-ok">✓ Tothom té alguna observació aquest trimestre.</li>';
    return '<li class="an-avis">• ' + sense.length + ' alumne' + (sense.length === 1 ? '' : 's') + ' sense cap observació aquest trimestre' +
      (sense.length <= 6 ? ': ' + esc(sense.map(function (al) { return al.nom; }).join(', ')) : '') + '.</li>';
  }

  /* ============================================================
     TOTES LES MEVES ASSIGNATURES
     ============================================================ */
  async function dadesTotes(es, t, torn) {
    var files = [];
    /* Un resum per grup, i tots alhora. */
    var grups = [];
    es.forEach(function (e) { var g = notesDe(e).grup || ''; if (grups.indexOf(g) === -1) grups.push(g); });
    var resums = await Promise.all(grups.map(function (g) { return resumDe(g); }));
    if (torn !== E.torn) return null;
    for (var i = 0; i < es.length; i++) {
      var e = es[i], nd = notesDe(e);
      var r = resums[grups.indexOf(nd.grup || '')];
      var rk = r ? clauResum(r.resum, nd.mat) : null;
      var per = rk ? r.resum[rk] : null;
      var noms = {};
      /* Cada alumne: la nota de cada trimestre i els NE (només els del
         trimestre triat; amb «tot el curs», els de tots). */
      [1, 2, 3].forEach(function (tt) {
        var d = per && per[tt];
        ((d && d.rowNoms) || []).forEach(function (n, p) {
          if (!n) return;
          var a = noms[norm(n)] = noms[norm(n)] || { nom: n, fin: {}, ne: 0 };
          var v = d.notes ? d.notes[p] : null;
          if (v !== null && v !== undefined && !isNaN(parseFloat(v))) a.fin[tt] = parseFloat(v);
          if ((!t || t === tt) && d.ne && d.ne[p]) a.ne += d.ne[p];
        });
      });
      var al = Object.keys(noms).map(function (k) { return noms[k]; });
      var notesT = function (tt) { return al.map(function (a) { return tt ? a.fin[tt] : mitjana([a.fin[1], a.fin[2], a.fin[3]]); }).filter(function (v) { return v !== null && v !== undefined && !isNaN(v); }); };
      var ns = notesT(t);
      var ant = null;
      if (t && t > 1) { var nsA = notesT(t - 1); if (nsA.length) ant = mitjana(nsA); }
      files.push({ e: e, n: al.length, ns: ns, m: mitjana(ns), ant: ant,
        aprov: ns.filter(function (v) { return v >= 5; }).length,
        na: ns.filter(function (v) { return v < 5; }).length, ae: ns.filter(function (v) { return v >= 9; }).length,
        ne: al.reduce(function (s, a) { return s + a.ne; }, 0) });
    }
    return { t: t, files: files };
  }

  function pintaTotes(D) {
    var fs = D.files, h = '';
    var ambNotes = fs.filter(function (f) { return f.ns.length; });
    if (!ambNotes.length) return targeta('Les teves assignatures', buit('Encara no hi ha notes de cap assignatura ' + (D.t ? 'en el ' + trimNom(D.t) : 'aquest curs') + '.'), { ample: true });
    var totes = []; ambNotes.forEach(function (f) { totes = totes.concat(f.ns); });
    h += xifres([
      { valor: fs.length, nom: 'assignatures' },
      { valor: fmt(mitjana(totes)), nom: 'mitjana de totes' },
      { valor: pct(totes.filter(function (v) { return v >= 5; }).length, totes.length) + '%', nom: 'aproven' },
      { valor: totes.filter(function (v) { return v < 5; }).length, nom: 'NA (suspesos)', to: totes.some(function (v) { return v < 5; }) ? 'an-alerta' : '' },
    ]);
    h += '<div class="an-graella">';
    h += targeta('Quants aproven cada assignatura', barres(ambNotes.slice().sort(function (a, b) { return pct(a.aprov, a.ns.length) - pct(b.aprov, b.ns.length); }).map(function (f) {
      var p = pct(f.aprov, f.ns.length);
      return { nom: f.e.label || f.e.nom, valor: p, text: p + '%', color: p >= 85 ? '#10B981' : p >= 70 ? '#F59E0B' : '#DC2626',
               peu: f.na + ' NA · mitjana ' + fmt(f.m), clic: clicAssig(f.e.key) };
    })), { sub: 'Clica una assignatura per veure-la sencera.' });
    h += targeta('La mitjana de cada assignatura', barres(ambNotes.slice().sort(function (a, b) { return (a.m || 0) - (b.m || 0); }).map(function (f) {
      var b = banda(f.m), dif = (f.ant !== null && f.m !== null) ? f.m - f.ant : null;
      return { nom: f.e.label || f.e.nom, valor: (f.m || 0) * 10, text: fmt(f.m), color: b ? b.color : '#9CA3AF',
               peu: dif === null ? '' : (dif > 0.05 ? '▲ ' : dif < -0.05 ? '▼ ' : '= ') + 'trim. anterior ' + fmt(f.ant),
               clic: clicAssig(f.e.key) };
    })));
    h += '</div>';
    h += targeta('Resum', '<div class="an-quadre-wrap"><table class="an-quadre an-resum"><thead><tr><th class="an-q-nom">Assignatura</th><th>Alumnes</th><th>Mitjana</th><th>Aproven</th><th>NA</th><th>AE</th><th>NE</th></tr></thead><tbody>' +
      fs.map(function (f) {
        return '<tr><td class="an-q-nom"><button type="button" class="an-link" onclick="analisiAssig(\'' + _idJs(f.e.key) + '\')">' + esc(f.e.label || f.e.nom) + '</button></td>' +
          '<td class="an-q-cel">' + f.n + '</td><td class="an-q-cel">' + chipNota(f.m) + '</td>' +
          '<td class="an-q-cel">' + (f.ns.length ? pct(f.aprov, f.ns.length) + '%' : '—') + '</td>' +
          '<td class="an-q-cel' + (f.na ? ' an-q-susp' : '') + '">' + f.na + '</td><td class="an-q-cel">' + f.ae + '</td><td class="an-q-cel">' + f.ne + '</td></tr>';
      }).join('') + '</tbody></table></div>', { ample: true });
    return h;
  }

  /* ============================================================
     PINTAR
     ============================================================ */
  async function pinta() {
    var cos = byId('anCos');
    if (!cos) return;
    var es = entrades();
    pintaControls(es);
    var torn = ++E.torn;
    if (typeof config === 'undefined' || !config || !config.scriptUrl) {
      cos.innerHTML = targeta('Anàlisi del curs', buit('Per veure l\'anàlisi cal estar connectada al teu full. Ves a <strong>Configuració</strong>.'), { ample: true });
      return;
    }
    if (!E.vista) {
      cos.innerHTML = targeta('Anàlisi del curs', buit('Primer digues a <strong>El meu perfil</strong> quines assignatures fas (i si tens tutoria).'), { ample: true });
      return;
    }
    cos.innerHTML = '<div class="an-carregant"><span class="coment-spinner"></span> Llegint les notes…</div>';
    var html = '';
    try {
      if (E.vista === 'grup') {
        var DG = await dadesGrup(E.trim, torn); if (!DG || torn !== E.torn) return;
        html = pintaGrup(DG);
      } else if (E.vista === 'totes') {
        var DT = await dadesTotes(es, E.trim, torn); if (!DT || torn !== E.torn) return;
        html = pintaTotes(DT);
      } else {
        var e = es.find(function (x) { return x.key === E.key; }) || es[0];
        var nd = notesDe(e);
        if (nd.dd && typeof _renderDesdobControl === 'function') {
          try { _renderDesdobControl('anDesdobBar', nd.dd, function () { pinta(); }); } catch (x) {}
        }
        /* Els comentaris desats es demanen alhora que les notes, i
           `dadesAssig` els espera just abans de comptar-los. */
        var pComent = (typeof _comentDesatsDelFull === 'function')
          ? Promise.resolve().then(function () { return _comentDesatsDelFull(); }).catch(function () {})
          : null;
        var DA = await dadesAssig(e, E.trim, torn, pComent); if (!DA || torn !== E.torn) return;
        html = pintaAssig(DA);
      }
    } catch (err) {
      try { if (typeof diagApunta === 'function') diagApunta('Anàlisi del curs: ' + (err && err.message)); } catch (x) {}
      html = targeta('Anàlisi del curs', buit('No s\'han pogut llegir les dades. Torna-ho a provar d\'aquí un moment.'), { ample: true });
    }
    if (torn !== E.torn) return;
    cos.innerHTML = html;
  }

  /* ---- El que criden els botons (a `window`, perquè els `onclick` els
     trobin i `eines/comprova-controls.js` pugui comprovar que existeixen) ---- */
  function vista(v) { E.vista = v; desaTria(); pinta(); }
  function assig(k) { E.vista = 'assig'; E.key = k; desaTria(); pinta(); }
  function trim(t) { E.trim = t; desaTria(); pinta(); }
  function obreAlumne(id) {
    if (typeof openPersonalDrawer !== 'function') return;
    var s = alumnesAra().find(function (x) { return String(x.id) === String(id); });
    if (!s) { if (typeof showToast === 'function') showToast('Aquest alumne no és a la llista que hi ha oberta ara', 'info'); return; }
    openPersonalDrawer(s.id);
  }

  function obrePagina() {
    if (!hiEs()) return;
    if (E.vista === null) llegeixTria();
    pinta();
  }
  function aplicaInterficie() {
    var b = byId('navAnalisi');
    if (b) b.style.display = hiEs() ? '' : 'none';
  }

  window.analisiVista = vista;
  window.analisiAssig = assig;
  window.analisiTrim = trim;
  window.analisiObreAlumne = obreAlumne;
  window.Analisi = {
    hiEs: hiEs,
    obrePagina: obrePagina,
    aplicaInterficie: aplicaInterficie,
    /* Per a les proves (eines/comprova-analisi.js) */
    _banda: banda,
    _estat: function () { return { vista: E.vista, key: E.key, trim: E.trim }; },
  };
})();
