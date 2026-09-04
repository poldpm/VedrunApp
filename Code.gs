/* ============================================================
   Vedruna Escorial Vic — Code.gs  (versió optimitzada)
   PRINCIPI: mínimes crides a Sheets. Llegir/escriure per rangs.
   ============================================================ */

/* ============================================================
   CONFIGURACIÓ / CREDENCIALS
   ------------------------------------------------------------
   Les credencials (IDs de fulls, clau de Gemini, token) NO s'escriuen
   aquí al codi. Es guarden a les PROPIETATS DEL SCRIPT, un magatzem
   privat dins del teu Apps Script. Així:
     · No apareixen mai al codi (ni al que es puja a GitHub).
     · Quan actualitzis el codi, es mantenen intactes: no les has de
       tornar a posar mai més.

   COM POSAR-LES (només un cop, a l'Apps Script):
     1. Obre el projecte d'Apps Script.
     2. Executa la funció  configuraCredencials  un sol cop (posant-hi
        els valors), o ves a  Configuració del projecte (engranatge) →
        Propietats del script → i afegeix aquestes claus:
          GRUPS_ID     → ID del full de grups
          DESDOB_ID    → ID del full de desdoblaments
          GEMINI_KEY   → clau de Gemini
          APP_TOKEN    → token secret (el mateix que a js/app.js)
     3. Ja està. No ho has de tornar a tocar.
   ============================================================ */

// Llegeix una propietat del script (credencial guardada de forma privada)
function _prop(clau) {
  try { return PropertiesService.getScriptProperties().getProperty(clau) || ''; }
  catch(e) { return ''; }
}

// FUNCIÓ D'AJUDA: executa-la UN COP per desar totes les credencials de cop.
// Posa els teus valors aquí, executa-la des de l'editor d'Apps Script, i
// després pots ESBORRAR els valors d'aquí (queden desats a les propietats).


/* ============================================================
   NOTES COMPARTIDES AMB EL TUTOR
   ------------------------------------------------------------
   Cada mestra té el seu full, i les notes que hi entra són
   seves. Però un tutor ha de poder veure com va el seu alumne
   a TOTES les assignatures, també a les que li fa un altre.

   COM ES FA (sense canviar l'arquitectura):
   cada mestra PUBLICA un resum de les seves notes al full
   "Grups" COMPARTIT, pel mateix camí que ja fan servir les
   observacions i la fitxa. El tutor el llegeix d'allà.

   ⚠ NOMÉS SI ELLA HO VOL. Hi ha una casella a les notes de cada
   assignatura ("Compartir amb el tutor"). Ve DESMARCADA:
     · desmarcada → NO es publica cap nota. El tutor només veu
       que aquella assignatura existeix i que no estan compartides.
     · marcada    → es publica la nota final de cada trimestre.
   Si la desmarca, les notes ja publicades s'esborren del full
   compartit: no es queden allà "per si de cas".

   Es publica NOMÉS la nota final de cada trimestre, mai el
   detall dels exàmens: el tutor ha de poder veure com va
   l'alumne, no revisar la feina d'una companya.

   Els alumnes es lliguen PEL NOM entre el full de la mestra i el
   full compartit, i es desen amb el rowId del compartit, que és
   l'identificador que tothom comparteix.
   ============================================================ */


/* Normalitza un nom per casar-lo entre fulls diferents. Ha de fer EL MATEIX
   que _normNomSimple del frontend: si no, els alumnes no es lligarien.
   Els rangs es construeixen amb codis perquè cap editor no els espatlli. */
var _RE_ACCENTS = new RegExp('[' + String.fromCharCode(0x300) + '-' + String.fromCharCode(0x36f) + ']', 'g');
function _normNomComp_(s) {
  return (s || '').toString()
    .normalize('NFD').replace(_RE_ACCENTS, '')
    .toLowerCase()
    .split(/[ \t\r\n]+/).join(' ')
    .trim();
}

var NOTESCOMP_PREFIX = 'notescomp_';

function _notesCompClau_(grup, matKey) {
  return NOTESCOMP_PREFIX + grup + '|' + matKey;
}

/* La preferència d'ella, al SEU full (no al compartit) */
function _compartirClau_(grup, matKey) { return 'compartir_' + grup + '|' + matKey; }

function loadCompartirNotes(ss, grup, matKey) {
  if (!grup || !matKey) return { ok: true, compartir: false };
  var v = sheetGetJSON(ss, '_AppData', _compartirClau_(grup, matKey));
  return { ok: true, compartir: v === 'si' };
}

/* Marca o desmarca, i publica o esborra en conseqüència. */
function saveCompartirNotes(ss, grup, matKey, nomAssig, nomMestra, compartir) {
  if (!grup || !matKey) return { ok: false, error: 'Falta el grup o l\'assignatura' };
  sheetSetJSON(ss, '_AppData', _compartirClau_(grup, matKey), compartir ? 'si' : 'no');
  return publicaNotesResum(ss, grup, matKey, nomAssig, nomMestra);
}

/* Les notes finals d'UNA assignatura, per trimestre, del full d'ella.
   Torna { rowNoms: [...], notes: {1:{pos:nota}, 2:…, 3:…} } */
function _notesUnaAssig_(ss, grup, nomBase) {
  var out = { rowNoms: null, trims: {} };
  [1, 2, 3].forEach(function (t) {
    var nom = _notesTabName(t, nomBase, grup);
    var sh = ss.getSheetByName(nom);
    if (!sh) { sh = ss.getSheetByName(_notesTabName(t, nomBase, '')); }  // llegat sense grup
    if (!sh) return;
    var r = _resumOneSheet(sh);
    if (!r) return;
    out.trims[t] = r;
    if (!out.rowNoms && r.rowNoms) out.rowNoms = r.rowNoms;
  });
  return out;
}

/* PUBLICAR (o esborrar) el resum al full compartit. */
function publicaNotesResum(ss, grup, matKey, nomAssig, nomMestra) {
  if (!grup || !matKey) return { ok: false, error: 'Falta el grup o l\'assignatura' };
  var gss = getGrupsSpreadsheet(ss);
  if (!gss) return { ok: false, error: 'No s\'ha pogut obrir el full de grups compartit' };

  var pref = loadCompartirNotes(ss, grup, matKey);
  var clau = _notesCompClau_(grup, matKey);
  var ara = Utilities.formatDate(new Date(), _gTz_(), 'yyyy-MM-dd HH:mm');

  /* Si NO comparteix: es publica només que existeix, SENSE cap nota.
     Així el tutor sap que hi ha Música i qui la fa, però no veu res més. */
  if (!pref.compartir) {
    sheetSetJSON(gss, '_AppData', clau, JSON.stringify({
      nom: String(nomAssig || matKey), mestra: String(nomMestra || ''),
      compartit: false, actualitzat: ara
    }));
    return { ok: true, compartit: false };
  }

  /* Sí que comparteix: es calculen les notes finals i es lliguen pel nom
     amb els alumnes del full compartit, per desar-les amb el seu rowId. */
  var nomBase = String(nomAssig || matKey);
  var dades = _notesUnaAssig_(ss, grup, nomBase);

  // El llistat del grup és al full COMPARTIT (gss), no al d'ella: és d'allà
  // que surten els rowId que tothom comparteix.
  var roster = getGrupAlumnes(gss, grup);
  var perNom = {}, repetits = {};
  if (roster && roster.ok && roster.alumnes) {
    roster.alumnes.forEach(function (a) {
      var k = _normNomComp_(a.nom);
      // Dos alumnes del mateix grup amb el MATEIX nom: no es pot saber de
      // qui és la nota. Es marca com a ambigu i no se n'assigna cap.
      // Posar-la a un dels dos seria una nota a l'expedient del nen
      // equivocat, i això no es pot fer mai.
      if (perNom[k] !== undefined) { repetits[k] = true; }
      else { perNom[k] = a.rowId; }
    });
  }

  var alumnes = {}, sensePar = 0, ambigus = 0;
  if (dades.rowNoms) {
    dades.rowNoms.forEach(function (nomAl, pos) {
      if (!nomAl) return;
      var k = _normNomComp_(nomAl);
      if (repetits[k]) { ambigus++; return; }            // dos alumnes igual: no s'endevina
      var rowId = perNom[k];
      if (rowId === undefined) { sensePar++; return; }   // no és al full compartit
      var fila = {};
      [1, 2, 3].forEach(function (t) {
        var d = dades.trims[t];
        fila[t] = (d && d.notes && d.notes[pos] !== undefined) ? d.notes[pos] : null;
      });
      alumnes[String(rowId)] = fila;
    });
  }

  sheetSetJSON(gss, '_AppData', clau, JSON.stringify({
    nom: nomBase, mestra: String(nomMestra || ''),
    compartit: true, actualitzat: ara, alumnes: alumnes
  }));
  return { ok: true, compartit: true, alumnes: Object.keys(alumnes).length,
           sensePar: sensePar, ambigus: ambigus };
}

/* Qui fa servir aquesta app, és el tutor/a d'aquest grup?
   Ho decideix el seu perfil, que és al SEU full. */
function _esTutorDe_(ss, grup) {
  try {
    var v = sheetGetJSON(ss, '_AppData', 'profile');
    if (!v) return false;
    var p = JSON.parse(v);
    if (!p || !p.tutorCurs || !p.tutorLinia) return false;   // especialista
    return (p.tutorCurs + ' ' + p.tutorLinia) === String(grup);
  } catch (e) { return false; }
}

/* LLEGIR-LES (NOMÉS EL TUTOR). Torna una entrada per assignatura
   publicada d'aquell grup, amb les notes si estan compartides.

   ⚠ Veure les notes de les altres mestres és un privilegi DEL TUTOR.
   Una especialista no ha de poder veure les notes de les assignatures
   que no fa ella, ni demanant-ho directament. Al frontend ja no té per
   on demanar-ho (obre les fitxes per un camí a part que només carrega
   les seves assignatures), però la decisió es pren AQUÍ, que és l'únic
   lloc on no depèn de com estigui feta la pantalla. */
function getNotesCompartides(ss, grup) {
  if (!grup) return { ok: true, assignatures: [] };
  if (!_esTutorDe_(ss, grup)) {
    return { ok: true, assignatures: [], noEsTutor: true };
  }
  var gss = getGrupsSpreadsheet(ss);
  if (!gss) return { ok: false, error: 'No s\'ha pogut obrir el full de grups compartit' };
  var tot = sheetGetAll(gss, '_AppData') || {};
  var pref = NOTESCOMP_PREFIX + grup + '|';
  var out = [];
  Object.keys(tot).forEach(function (k) {
    if (k.indexOf(pref) !== 0) return;
    var matKey = k.slice(pref.length);
    var v = null;
    try { v = JSON.parse(tot[k]); } catch (e) { return; }
    if (!v) return;
    out.push({
      key: matKey, nom: v.nom || matKey, mestra: v.mestra || '',
      compartit: !!v.compartit, actualitzat: v.actualitzat || '',
      // Les claus desades poden ser files (com sempre) o codis (ja migrat):
      // es tradueixen a la que el navegador espera ara.
      alumnes: v.compartit ? _reclau_(gss, grup, v.alumnes || {}) : null
    });
  });
  out.sort(function (a, b) { return String(a.nom).localeCompare(String(b.nom)); });
  return { ok: true, assignatures: out };
}


/* ============================================================
   ENTREVISTES AMB LES FAMÍLIES
   ------------------------------------------------------------
   Els tutors han de quedar com a mínim un cop amb cada família,
   i amb alguns casos van fent entrevistes de seguiment. Això no
   és el registre oficial (aquest va en una altra app): és per
   poder marcar-ho i veure d'un cop d'ull a qui li'n falta.

   ⚠ QUÈ ES COMPARTEIX I QUÈ NO — és la decisió important:

     · Al SEU full (privat):  cada entrevista amb la data, l'hora
       i el que hagi apuntat de com ha anat.
     · Al full COMPARTIT:     NOMÉS quantes n'ha fet i quan va ser
       l'última. Cap nota, mai.

   Així direcció pot portar el control de qui n'ha fet i qui no,
   sense llegir el que un tutor ha escrit d'una família. El que
   s'apunta d'una entrevista amb uns pares no ha de sortir del
   full de qui la va fer.
   ============================================================ */

function _entrClauDet_(grup) { return 'entrevistes_' + grup; }
function _entrClauPub_(grup) { return 'entrevistes_pub_' + grup; }

/* Totes les entrevistes del grup, del SEU full.
   { rowId: [ {id, data, hora, nota}, … ] } */
function _entrLlegeix_(ss, grup) {
  var r = _jsonDeCela_(ss, '_AppData', _entrClauDet_(grup));
  var d = (r.hi && r.dades) ? r.dades : {};
  var gss = getGrupsSpreadsheet(ss);
  return gss ? _reclau_(gss, grup, d) : d;
}
/* La mateixa lectura, però PETA si el que hi ha desat no es pot llegir.
   La fan servir les desades: val més un error a la pantalla que esborrar
   les entrevistes d'un grup sencer sense que ningú se n'assabenti. */
function _entrLlegeixSegur_(ss, grup) {
  var r = _capMalament_(_jsonDeCela_(ss, '_AppData', _entrClauDet_(grup)),
                        'les entrevistes de ' + grup);
  return (r.hi && r.dades) ? r.dades : {};
}

function loadEntrevistes(ss, grup) {
  if (!grup) return { ok: true, entrevistes: {} };
  return { ok: true, entrevistes: _entrLlegeix_(ss, grup) };
}

/* El resum que SÍ que va al compartit: quantes i quan l'última.
   Es torna a calcular sencer cada vegada, així no pot quedar
   descompassat del detall. */
function _entrPublica_(ss, grup, detall) {
  var gss = getGrupsSpreadsheet(ss);
  if (!gss) return false;   // sense full compartit: el detall ja s'ha desat igual
  var pub = {};
  Object.keys(detall).forEach(function (rowId) {
    var l = detall[rowId] || [];
    if (!l.length) return;
    var ultima = '', dates = [];
    l.forEach(function (e) {
      var quan = String(e.data || '') + (e.hora ? ' ' + e.hora : '');
      if (quan > ultima) ultima = quan;
      if (e.data) dates.push(String(e.data));
    });
    dates.sort();
    /* Les DATES sí que hi van (direcció les necessita per portar el control);
       la NOTA de com ha anat, mai. Una data no diu res d'una família; el que
       el tutor hi hagi escrit, sí. */
    pub[rowId] = { quantes: l.length, ultima: ultima, dates: dates };
  });
  sheetSetJSON(gss, '_AppData', _entrClauPub_(grup), JSON.stringify({
    grup: grup,
    actualitzat: Utilities.formatDate(new Date(), _gTz_(), 'yyyy-MM-dd HH:mm'),
    alumnes: pub
  }));
  return true;
}

/* Desa una entrevista (nova o editada). */
function saveEntrevista(ss, grup, rowId, e) {
  if (!grup || rowId === undefined || rowId === null || rowId === '') {
    return { ok: false, error: 'Falta el grup o l\'alumne' };
  }
  e = e || {};
  var data = String(e.data || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return { ok: false, error: 'Posa-hi el dia de l\'entrevista' };
  var hora = String(e.hora || '').trim();
  if (hora && !/^\d{2}:\d{2}$/.test(hora)) hora = '';

  var det = _entrLlegeixSegur_(ss, grup);
  var k = String(rowId);
  if (!det[k]) det[k] = [];

  var id = String(e.id || '').trim();
  var nova = { id: id || ('e' + Date.now()), data: data, hora: hora, nota: String(e.nota || '').trim() };

  var i = id ? _entrIndex_(det[k], id) : -1;
  if (i >= 0) det[k][i] = nova; else det[k].push(nova);

  // Ordenades de la més nova a la més vella: és com es volen mirar
  det[k].sort(function (a, b) {
    return String(b.data + (b.hora || '')).localeCompare(String(a.data + (a.hora || '')));
  });

  sheetSetJSON(ss, '_AppData', _entrClauDet_(grup), JSON.stringify(det));
  var compartit = _entrPublica_(ss, grup, det);
  SpreadsheetApp.flush();
  return { ok: true, id: nova.id, quantes: det[k].length, compartit: compartit };
}

function _entrIndex_(llista, id) {
  for (var i = 0; i < llista.length; i++) if (String(llista[i].id) === String(id)) return i;
  return -1;
}

function deleteEntrevista(ss, grup, rowId, id) {
  if (!grup || rowId === undefined || !id) return { ok: false, error: 'Falta alguna dada' };
  var det = _entrLlegeix_(ss, grup);
  var k = String(rowId);
  if (!det[k]) return { ok: false, error: 'Aquest alumne no en té cap' };
  var i = _entrIndex_(det[k], id);
  if (i < 0) return { ok: false, error: 'Aquesta entrevista ja no hi és' };
  det[k].splice(i, 1);
  if (!det[k].length) delete det[k];
  sheetSetJSON(ss, '_AppData', _entrClauDet_(grup), JSON.stringify(det));
  var compartit = _entrPublica_(ss, grup, det);
  SpreadsheetApp.flush();
  return { ok: true, quantes: (det[k] || []).length, compartit: compartit };
}

/* El resum del COMPARTIT. Aquí no hi ha cap nota: només qui n'ha fet
   i quan. És el que llegirà direcció per portar el control. */
function getEntrevistesPub(ss, grup) {
  if (!grup) return { ok: true, alumnes: {} };
  var gss = getGrupsSpreadsheet(ss);
  if (!gss) return { ok: false, error: 'No s\'ha pogut obrir el full de grups compartit' };
  var v = sheetGetJSON(gss, '_AppData', _entrClauPub_(grup));
  if (!v) return { ok: true, alumnes: {}, actualitzat: '' };
  try {
    var o = JSON.parse(v) || {};
    return { ok: true, alumnes: o.alumnes || {}, actualitzat: o.actualitzat || '' };
  } catch (e) { return { ok: true, alumnes: {}, actualitzat: '' }; }
}

/* ============================================================
   COORDINACIÓ — ELS ESMORZARS
   ------------------------------------------------------------
   Cada setmana un membre de l'equip de coordinació porta
   l'esmorzar a la reunió. Aquí es desa qui li tocava, si l'ha
   portat i quina nota li han posat.

   Va al full "Grups" COMPARTIT, no al full personal de qui ho
   apunta. Si anés al personal, els dos directors tindrien cada
   un la seva llista i no coincidirien mai: és una dada de
   l'equip, no de ningú.

   Només l'app de direcció ho ensenya, però el que ho protegeix
   de debò és el token, com la resta d'accions.
   ============================================================ */

var ESMORZARS_CLAU = 'coord_esmorzars';

/* Tot el que se sap dels esmorzars viu en una sola clau del full compartit:

     registres → el que ja ha passat (qui, si el va portar, la nota)
     torns     → a qui li toca i quin dia és la reunió
     equip     → els 5 noms i els seus correus

   L'equip s'hi desa a posta encara que la llista de debò sigui a
   `js/docents.js`: el recordatori del dilluns el fa un disparador de
   l'Apps Script, que s'executa sol, sense navegador, i no té manera de
   llegir el fitxer del frontend. Cada cop que l'app hi desa res, l'hi torna
   a deixar actualitzat. */
function _esmLlegeix_(gss, exigent) {
  var r = _jsonDeCela_(gss, '_AppData', ESMORZARS_CLAU);
  if (exigent) _capMalament_(r, 'els esmorzars');
  var o = (r.hi && r.dades) ? r.dades : {};
  return { registres: o.registres || [], torns: o.torns || [], equip: o.equip || [],
           actualitzat: o.actualitzat || '', illegible: !!r.malament };
}

function _esmEscriu_(gss, dades) {
  sheetSetJSON(gss, '_AppData', ESMORZARS_CLAU, JSON.stringify({
    registres: dades.registres || [],
    torns: dades.torns || [],
    equip: dades.equip || [],
    actualitzat: Utilities.formatDate(new Date(), _gTz_(), 'yyyy-MM-dd HH:mm')
  }));
}

function loadEsmorzars(ss) {
  var gss = getGrupsSpreadsheet(ss);
  if (!gss) return { ok: false, error: 'No s\'ha pogut obrir el full de grups compartit' };
  var d = _esmLlegeix_(gss);
  return { ok: true, registres: d.registres, torns: d.torns, actualitzat: d.actualitzat || '' };
}

function saveEsmorzars(ss, registres, torns, equip) {
  var gss = getGrupsSpreadsheet(ss);
  if (!gss) return { ok: false, error: 'No s\'ha pogut obrir el full de grups compartit' };
  var _llista = function (x) {
    if (typeof x === 'string') { try { x = JSON.parse(x); } catch (e) { return null; } }
    return Object.prototype.toString.call(x) === '[object Array]' ? x : null;
  };
  var regs = _llista(registres);
  if (!regs) return { ok: false, error: 'La llista d\'esmorzars no és vàlida' };
  var t = _llista(torns);
  var eq = _llista(equip);
  var abans = _esmLlegeix_(gss, true);
  _esmEscriu_(gss, {
    registres: regs,
    torns: t || abans.torns,
    equip: eq && eq.length ? eq : abans.equip,
  });
  return { ok: true, registres: regs.length, torns: (t || abans.torns).length };
}

/* ============================================================
   SEGUIMENT D'ENTREVISTES (direcció)
   ------------------------------------------------------------
   El resum de TOTA la primària en UNA sola crida: per cada grup,
   quants alumnes hi ha i, de cada un, quantes entrevistes té i
   quan. D'aquí surten les dades quan els en demanen.

   Es fa al servidor a posta: fer-ho des del navegador serien 36
   crides (18 grups × llista d'alumnes + resum) i trigaria una
   eternitat. Aquí els resums es llegeixen TOTS d'una lectura del
   full `_AppData`, i només les llistes d'alumnes van pestanya a
   pestanya.

   ⚠ NOMÉS quantes i quan. La nota de com ha anat l'entrevista no
   surt mai del full del tutor que la va fer.
   ============================================================ */

function resumEntrevistes(ss) {
  var gss = getGrupsSpreadsheet(ss);
  if (!gss) return { ok: false, error: 'No s\'ha pogut obrir el full de grups compartit' };

  // Tots els resums publicats, d'una sola lectura.
  var tot = {};
  try { tot = sheetGetAll(gss, '_AppData') || {}; } catch (e) { tot = {}; }

  var grups = [];
  GRUPS_PRIMARIA.forEach(function (grup) {
    var pub = { alumnes: {}, actualitzat: '' };
    var v = tot[_entrClauPub_(grup)];
    if (v) { try { pub = JSON.parse(v) || pub; } catch (e) {} }

    var alumnes = [];
    try {
      var ga = getGrupAlumnes(gss, grup);
      (ga.alumnes || []).forEach(function (a) {
        var p = (pub.alumnes || {})[a.rowId] || (pub.alumnes || {})[String(a.rowId)] || null;
        alumnes.push({
          nom: a.nom,
          quantes: p ? (p.quantes || 0) : 0,
          ultima:  p ? (p.ultima || '') : '',
          // `dates` no hi és als resums publicats abans de la v135: llavors
          // només se'n sap el nombre i l'última, i l'app ho diu.
          dates:   (p && p.dates) ? p.dates : null,
        });
      });
    } catch (e) { /* un grup que no es pot llegir no ha de tombar la resta */ }

    grups.push({ grup: grup, actualitzat: pub.actualitzat || '', alumnes: alumnes });
  });

  return { ok: true, grups: grups };
}

/* ============================================================
   REGISTRE DE DOCENTS
   ------------------------------------------------------------
   El mateix que el registre d'aula, però les files són els
   mestres en comptes dels alumnes: qui ha entregat una cosa, qui
   ha fet una formació, el que calgui.

   Va al full "Grups" COMPARTIT perquè els dos directors hi vegin
   el mateix (cada un té la seva app i el seu full personal).

   ⚠ Això vol dir que qualsevol mestre que obri aquell full de
   càlcul també ho pot llegir. Està al full ocult `_AppData`, no
   en una pestanya a la vista, però no és cap secret. Si algun dia
   hi ha d'anar res delicat, s'ha de moure a un full de direcció a
   part (veure PROJECTE.md).

   Les cel·les es desen per NOM del docent, no per número de fila:
   si un any la llista canvia, el que hi ha apuntat no es desplaça
   a la persona equivocada.
   ============================================================ */

var REGDOC_CLAU = 'coord_registre_docents';

function loadRegistreDocents(ss) {
  var gss = getGrupsSpreadsheet(ss);
  if (!gss) return { ok: false, error: 'No s\'ha pogut obrir el full de grups compartit' };
  var r = _jsonDeCela_(gss, '_AppData', REGDOC_CLAU);
  // Si hi ha alguna cosa desada i no es pot llegir, s'ha de DIR. Abans es
  // tornava la llista buida i la pantalla semblava acabada d'estrenar;
  // la primera desada s'ho enduia tot.
  if (r.malament) return { ok: false, error: 'Els registres del claustre que hi ha desats no es poden llegir (' +
    r.mida + ' caràcters). No hi desis res fins que en Pol ho hagi mirat, o els perdràs.' };
  var o = (r.hi && r.dades) ? r.dades : {};
  return { ok: true, items: o.items || [], data: o.data || {}, actualitzat: o.actualitzat || '' };
}

function saveRegistreDocents(ss, items, data) {
  var gss = getGrupsSpreadsheet(ss);
  if (!gss) return { ok: false, error: 'No s\'ha pogut obrir el full de grups compartit' };
  if (typeof items === 'string') { try { items = JSON.parse(items); } catch (e) { items = null; } }
  if (typeof data === 'string')  { try { data  = JSON.parse(data);  } catch (e) { data  = null; } }
  if (Object.prototype.toString.call(items) !== '[object Array]') {
    return { ok: false, error: 'La llista d\'ítems no és vàlida' };
  }
  // Aquesta desada escriu el blob SENCER a sobre. Si el que hi ha desat no
  // es pot llegir, val més aturar-se que trepitjar-ho: fins ara la lectura
  // tornava una llista buida i la desada s'ho enduia tot sense dir res.
  _capMalament_(_jsonDeCela_(gss, '_AppData', REGDOC_CLAU), 'els registres del claustre');
  sheetSetJSON(gss, '_AppData', REGDOC_CLAU, JSON.stringify({
    items: items,
    data: data || {},
    actualitzat: Utilities.formatDate(new Date(), _gTz_(), 'yyyy-MM-dd HH:mm')
  }));
  return { ok: true, items: items.length };
}

/* ------------------------------------------------------------
   EL RECORDATORI DEL DILLUNS
   ------------------------------------------------------------
   Un disparador diari mira si aquesta setmana hi ha reunió i, si a qui li
   toca encara no se l'ha avisat, li envia el correu. Es marca `avisat` de
   seguida: si el disparador s'executés dos cops, no en rebria dos.

   Va des del dilluns fins al dia de la reunió a posta. Si un dilluns el
   disparador falla (Google també té mals dies), l'endemà encara hi arriba,
   que val més tard que mai.
   ------------------------------------------------------------ */

function _esmDataDe_(iso) {
  var p = String(iso || '').split('-');
  if (p.length < 3) return null;
  var d = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
  return isNaN(d.getTime()) ? null : d;
}

// El dilluns de la setmana d'aquesta data.
function _esmDillunsDe_(d) {
  var x = new Date(d.getTime());
  var dia = x.getDay();               // 0 diumenge … 6 dissabte
  var enrere = (dia === 0) ? 6 : dia - 1;
  x.setDate(x.getDate() - enrere);
  x.setHours(0, 0, 0, 0);
  return x;
}

function _esmAvuiZero_() { var h = new Date(); h.setHours(0, 0, 0, 0); return h; }

var _ESM_DIES = ['diumenge','dilluns','dimarts','dimecres','dijous','divendres','dissabte'];
var _ESM_MESOS = ['gener','febrer','març','abril','maig','juny','juliol','agost','setembre','octubre','novembre','desembre'];

function _esmDataLlarga_(d) {
  return _ESM_DIES[d.getDay()] + ' ' + d.getDate() + ' de ' + _ESM_MESOS[d.getMonth()];
}

/* El text del correu. És una broma de l'equip: que ho sembli. */
function _esmCosCorreu_(nom, dataReunio, resum) {
  var pila = '';
  if (resum && resum.gomets > 0) {
    pila = '<p style="margin:0 0 14px">Per cert, que ja portes <strong style="color:#B3251A">' +
      resum.gomets + ' gomet' + (resum.gomets === 1 ? '' : 's') + ' vermell' + (resum.gomets === 1 ? '' : 's') +
      '</strong>. Als 3 hi ha penyora. Tu mateix.</p>';
  } else if (resum && resum.mitjana !== null && resum.mitjana !== undefined) {
    pila = '<p style="margin:0 0 14px">De moment vas per una mitjana de <strong>' +
      String(Math.round(resum.mitjana * 10) / 10).replace('.', ',') + ' de 10</strong>. Hi ha una reputació en joc.</p>';
  }
  return '' +
  '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1A1014;max-width:520px">' +
    '<div style="background:#4A1520;color:#fff;padding:18px 22px;border-radius:12px 12px 0 0">' +
      '<div style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;opacity:.75">Equip de coordinació</div>' +
      '<div style="font-size:22px;font-weight:bold;margin-top:4px">Aquesta setmana l\'esmorzar el portes tu</div>' +
    '</div>' +
    '<div style="border:1px solid #E8DFE3;border-top:none;border-radius:0 0 12px 12px;padding:22px">' +
      '<p style="margin:0 0 14px">Bon dilluns, <strong>' + nom + '</strong>!</p>' +
      '<p style="margin:0 0 14px">Aquest <strong>' + _esmDataLlarga_(dataReunio) + '</strong> tenim reunió de coordinació, ' +
        'i et toca a tu portar l\'esmorzar. Ja ho saps: hi haurà nota.</p>' +
      pila +
      '<p style="margin:0 0 6px">Tens tota la setmana per pensar-t\'ho. Consells de la casa:</p>' +
      '<ul style="margin:0 0 16px;padding-left:20px">' +
        '<li>Res que s\'hagi de tallar amb ganivet i plat.</li>' +
        '<li>Que n\'hi hagi per a tothom, que després hi ha retrets.</li>' +
        '<li>Les galetes de paquet compten, però la nota ho notarà.</li>' +
      '</ul>' +
      '<p style="margin:0;color:#6B5560;font-size:13px">T\'ho recorda l\'app de Gestió de Curs, que no s\'oblida mai de res.</p>' +
    '</div>' +
  '</div>';
}

// El resum d'una persona (mitjana i gomets), calculat al servidor.
function _esmResumDe_(registres, nom) {
  var seus = (registres || []).filter(function (r) { return r.qui === nom; });
  var notes = seus.filter(function (r) { return r.portat && typeof r.nota === 'number'; })
                  .map(function (r) { return r.nota; });
  var suma = 0; notes.forEach(function (n) { suma += n; });
  return {
    gomets: seus.filter(function (r) { return !r.portat; }).length,
    mitjana: notes.length ? (suma / notes.length) : null,
  };
}

function _esmCorreuDe_(equip, nom) {
  var m = (equip || []).filter(function (e) { return e && e.nom === nom; })[0];
  return (m && m.email) ? String(m.email).trim() : '';
}

/* Envia l'avís d'un torn. `forcat` = l'han demanat des de l'app amb un botó;
   si no, és el disparador i només envia quan toca. */
function _esmEnvia_(gss, tornId, forcat) {
  var d = _esmLlegeix_(gss);
  var torn = d.torns.filter(function (t) { return t.id === tornId; })[0];
  if (!torn) return { ok: false, error: 'Aquest torn ja no hi és' };
  if (torn.avisat && !forcat) return { ok: true, enviats: 0, motiu: 'ja avisat' };

  var correu = _esmCorreuDe_(d.equip, torn.qui);
  if (!correu) return { ok: false, error: 'No sé el correu de ' + torn.qui + '. Posa-l\'hi al llistat de docents.' };
  var dataReunio = _esmDataDe_(torn.data);
  if (!dataReunio) return { ok: false, error: 'La data de la reunió no és vàlida' };

  MailApp.sendEmail({
    to: correu,
    subject: 'Aquesta setmana l\'esmorzar el portes tu (' + _esmDataLlarga_(dataReunio) + ')',
    htmlBody: _esmCosCorreu_(torn.qui, dataReunio, _esmResumDe_(d.registres, torn.qui)),
    name: 'Coordinació · Vedruna Escorial Vic',
  });

  torn.avisat = Utilities.formatDate(new Date(), _gTz_(), 'yyyy-MM-dd HH:mm');
  _esmEscriu_(gss, d);
  return { ok: true, enviats: 1, a: correu, torn: torn };
}

// Acció des de l'app: "envia-li l'avís ara".
function enviaAvisEsmorzar(ss, tornId) {
  var gss = getGrupsSpreadsheet(ss);
  if (!gss) return { ok: false, error: 'No s\'ha pogut obrir el full de grups compartit' };
  return _esmEnvia_(gss, tornId, true);
}

/* LA FUNCIÓ DEL DISPARADOR. S'executa sola cada dia al matí. */
function recordatoriEsmorzars() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var gss = getGrupsSpreadsheet(ss);
  if (!gss) return 'Sense full compartit: res a fer.';
  var d = _esmLlegeix_(gss);
  var avui = _esmAvuiZero_();
  var fets = [];

  d.torns.forEach(function (t) {
    if (t.avisat) return;
    var reunio = _esmDataDe_(t.data);
    if (!reunio) return;
    var dilluns = _esmDillunsDe_(reunio);
    // Des del dilluns de la seva setmana i fins al dia de la reunió.
    if (avui < dilluns || avui > reunio) return;
    try {
      var r = _esmEnvia_(gss, t.id, false);
      fets.push(r.ok ? (t.qui + ': enviat') : (t.qui + ': ' + r.error));
    } catch (e) { fets.push(t.qui + ': ha fallat (' + e.message + ')'); }
  });

  var resum = fets.length ? fets.join(' · ') : 'Avui no tocava avisar ningú.';
  Logger.log(resum);
  return resum;
}

/* Instal·la el disparador diari. S'executa UN COP des de l'editor.
   Es pot repetir sense por: primer treu el que ja hi hagués. */
function configuraRecordatoriEsmorzars() {
  var fora = 0;
  try {
    ScriptApp.getProjectTriggers().forEach(function (t) {
      if (t.getHandlerFunction() === 'recordatoriEsmorzars') { ScriptApp.deleteTrigger(t); fora++; }
    });
    ScriptApp.newTrigger('recordatoriEsmorzars').timeBased().everyDays(1).atHour(7).create();
  } catch (e) {
    var err = _faltaPermisDisparadors_(e) ? _comManifestVell_()
                                         : 'No s ha pogut posar el disparador: ' + e.message;
    Logger.log(err);
    return err;
  }
  var txt = 'Recordatori dels esmorzars: disparador diari posat (cap a les 7 del mati).' +
            (fora ? ' N he tret ' + fora + ' de vell.' : '');
  Logger.log(txt);
  return txt;
}

/* ============================================================
   CONVOCAR REUNIONS
   ------------------------------------------------------------
   La mestra marca quines hores té lliures, l'app li dona un
   enllaç, l'envia per correu i cada família tria la seva hora.
   La reserva li entra al SEU Google Calendar.

   ⚠ LA REGLA QUE NO ES POT TRENCAR MAI: dues persones no poden
   quedar-se la mateixa hora, ni tenir reunions que se solapin.

   Com es garanteix (i per què no n'hi ha prou amb el navegador):
   dues famílies poden clicar el mateix segon des de dos mòbils.
   Qui decideix és NOMÉS el servidor, i ho fa així:

     1. LockService: mentre s'atén una reserva, cap altra hi entra.
        No és un "sembla que va bé": Apps Script garanteix que
        només una execució té el pany.
     2. Ja amb el pany posat, es torna a LLEGIR la fila del full
        (mai es fa cas del que digui el navegador, que pot tenir
        la pàgina oberta de fa mitja hora).
     3. Es comprova també el Google Calendar de la mestra, per si
        ella hi ha posat res des que va crear el calendari.
     4. Es marca la fila com a ocupada i es fa flush() ABANS de
        crear l'event: així la porta queda tancada encara que la
        crida al Calendar vagi lenta o falli.
     5. Si el Calendar falla, la fila ES QUEDA OCUPADA i s'apunta
        l'error. Val més una hora bloquejada de més (que la mestra
        pot alliberar) que dues famílies a la mateixa hora.

   Les franges es generen AL SERVIDOR i no se solapen mai per
   construcció: van una darrere l'altra, amb el descans (buffer)
   que hagi dit la mestra.
   ============================================================ */

var REU_CALS  = 'Reunions';
var REU_HORES = 'Reunions_Hores';
var REU_MAX_FRANGES = 500;   // barrera de seguretat

var REU_CAP_CALS  = ['id','titol','descripcio','durada','buffer','lloc','actiu','creat','avisar','maxPersona','desDe','finsA','missatge'];
var REU_CAP_HORES = ['calId','slotId','data','inici','fi','estat','nom','email','gEventId','reservat','error'];

/* ── Dates i hores: text, sempre ─────────────────────────────────────────
   El Google Sheets NO desa "17:00" com a text: ho converteix en un valor
   d'hora, i en tornar-lo a llegir dona una data amb la data zero del full
   (30/12/1899) i el desfasament horari d'aquell any. Pintada tal qual, a la
   mestra li sortia "Sat Dec 30 1899 07:20:00 GMT+0014 (Hora estàndard
   d'Europa central)" en lloc de "17:00", i les hores no li quadraven.
   Aquests dos ajudants tornen sempre el text que toca, vingui com vingui. */
function _reuTxtHora_(v) {
  // Es mira si sap dir l hora en lloc d instanceof Date: aixi funciona
  // vingui d on vingui l objecte.
  if (v && typeof v.getTime === 'function') return Utilities.formatDate(v, _gTz_(), 'HH:mm');
  var s = String(v == null ? '' : v).trim();
  var m = s.match(/^(\d{1,2}):(\d{2})/);
  return m ? ('0' + m[1]).slice(-2) + ':' + m[2] : s;
}
function _reuTxtData_(v) {
  if (v && typeof v.getTime === 'function') return Utilities.formatDate(v, _gTz_(), 'yyyy-MM-dd');
  var s = String(v == null ? '' : v).trim();
  var m = s.match(/^\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : s;
}

function _reuFull_(ss, nom, capcalera) {
  var sh = ss.getSheetByName(nom);
  if (!sh) {
    sh = ss.insertSheet(nom);
    sh.getRange(1, 1, 1, capcalera.length).setValues([capcalera]);
    sh.setFrozenRows(1);
    // Les columnes es formaten com a TEXT perquè el full no converteixi
    // "17:00" en un valor d'hora ni "2026-12-15" en una data (veure els
    // ajudants aquí sobre). Així el que s'hi escriu és el que se'n llegeix.
    try { sh.getRange(1, 1, sh.getMaxRows(), capcalera.length).setNumberFormat('@'); } catch (e) {}
    try {
      sh.getRange(1, 1, 1, capcalera.length)
        .setBackground('#7A1E2E').setFontColor('#FFFFFF').setFontWeight('bold');
    } catch (e) {}
  }
  return sh;
}
function _reuCals_(ss)  { return _reuFull_(ss, REU_CALS,  REU_CAP_CALS); }
function _reuHores_(ss) { return _reuFull_(ss, REU_HORES, REU_CAP_HORES); }

// Identificador llarg i impossible d'endevinar: l'enllaç és la clau.
function _reuId_() {
  var lletres = 'abcdefghijkmnopqrstuvwxyz23456789';
  var s = '';
  for (var i = 0; i < 22; i++) s += lletres.charAt(Math.floor(Math.random() * lletres.length));
  return s;
}

function _reuPad_(n) { return (n < 10 ? '0' : '') + n; }

// 'YYYY-MM-DD' + 'HH:MM' -> Date en la zona del script
function _reuData_(data, hora) {
  var d = String(data).split('-'), h = String(hora).split(':');
  return new Date(+d[0], +d[1] - 1, +d[2], +h[0], +h[1], 0, 0);
}
function _reuISO_(dt) {
  return Utilities.formatDate(dt, _gTz_(), "yyyy-MM-dd'T'HH:mm:ssXXX");
}
function _reuMinuts_(hora) {
  var h = String(hora).split(':');
  return (+h[0]) * 60 + (+h[1]);
}
function _reuHora_(minuts) {
  return _reuPad_(Math.floor(minuts / 60)) + ':' + _reuPad_(minuts % 60);
}

/* Xoca amb res que la mestra ja tingui al calendari?
   Torna el títol del que xoca, o null si està lliure. */
function _reuXoca_(data, inici, fi) {
  try {
    var r = Calendar.Events.list('primary', {
      timeMin: _reuISO_(_reuData_(data, inici)),
      timeMax: _reuISO_(_reuData_(data, fi)),
      singleEvents: true, maxResults: 20
    });
    var items = r.items || [];
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (it.status === 'cancelled') continue;
      if (it.transparency === 'transparent') continue;   // marcat com a "lliure"
      if (it.start && it.start.date) continue;           // de tot el dia: no bloqueja una hora
      // Si ella hi ha dit que no hi va, no compta
      var jo = (it.attendees || []).filter(function (a) { return a.self; })[0];
      if (jo && jo.responseStatus === 'declined') continue;
      return it.summary || 'una cosa que ja tens';
    }
    return null;
  } catch (e) {
    // Si no es pot consultar el calendari, val més NO oferir l'hora que
    // arriscar-se a una reunió a sobre d'una altra cosa.
    return '(no s\'ha pogut consultar el calendari)';
  }
}

/* ============================================================
   GENERADOR DE FRANGES — un sol lloc
   ------------------------------------------------------------
   Els horaris de debò no són iguals cada dia: dilluns pot ser a
   les 11, dimarts a les 15 i dimecres només al migdia. Per això
   les hores es diuen PER DIA DE LA SETMANA:

     perDia = { "1": [{inici:"11:00", fi:"12:00"}],   // dilluns
                "2": [{inici:"15:00", fi:"16:00"}],   // dimarts
                "3": [{inici:"13:00", fi:"15:00"}] }  // dimecres

   (1 = dilluns … 7 = diumenge, com tothom ho diria.)

   I `exclou` són les hores concretes que aquell dia no van bé:
     exclou = ["2026-09-12 17:00", ...]

   Aquesta funció la fan servir TANT el previsualitzat com la
   creació, així que el que la mestra repassa és exactament el que
   es crearà. Per construcció les franges d'un dia van una darrere
   l'altra: no se solapen mai.
   ============================================================ */
/* Parteix una estona (17:00–19:00) en franges de la durada demanada,
   amb el descans entremig. UN SOL LLOC: ho fan servir tant crear un
   calendari com afegir-hi hores després, així no poden divergir. */
function _reuTrossos_(data, ini, fi, durada, buffer) {
  var out = [];
  var m0 = _reuMinuts_(ini), m1 = _reuMinuts_(fi);
  if (isNaN(m0) || isNaN(m1) || m1 <= m0) return out;
  for (var m = m0; m + durada <= m1; m += durada + buffer) {
    out.push({ data: data, inici: _reuHora_(m), fi: _reuHora_(m + durada) });
  }
  return out;
}

function _reuGenera_(d) {
  var durada = parseInt(d.durada, 10) || 15;
  var buffer = parseInt(d.buffer, 10) || 0;
  if (buffer < 0 || buffer > 120) buffer = 0;
  var perDia = d.perDia || {};
  var exclou = {};
  (d.exclou || []).forEach(function (x) { exclou[String(x)] = true; });
  var mirarCalendari = d.evitarOcupats !== false;

  var out = [], avisos = 0;
  var des = String(d.desDe || ''), fins = String(d.finsA || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(des) || !/^\d{4}-\d{2}-\d{2}$/.test(fins)) return { franges: [], error: 'Dates mal posades' };
  if (fins < des) { var tmp = des; des = fins; fins = tmp; }

  var p = des.split('-');
  var dia = new Date(+p[0], +p[1] - 1, +p[2]);
  var q = fins.split('-');
  var ultim = new Date(+q[0], +q[1] - 1, +q[2]);
  var voltes = 0;

  while (dia.getTime() <= ultim.getTime() && voltes++ < 400) {
    var dow = dia.getDay() === 0 ? 7 : dia.getDay();     // 1..7, dilluns=1
    var trams = perDia[String(dow)] || [];
    if (trams.length) {
      var data = dia.getFullYear() + '-' + _reuPad_(dia.getMonth() + 1) + '-' + _reuPad_(dia.getDate());
      var tr = trams.slice().sort(function (a, b) { return _reuMinuts_(a.inici) - _reuMinuts_(b.inici); });
      var finsAra = -1;
      for (var t = 0; t < tr.length; t++) {
        var m0 = _reuMinuts_(tr[t].inici), m1 = _reuMinuts_(tr[t].fi);
        if (isNaN(m0) || isNaN(m1) || m1 <= m0) continue;
        if (m0 < finsAra) m0 = finsAra;                  // trams encavalcats: no repetim hores
        var trossos = _reuTrossos_(data, _reuHora_(m0), _reuHora_(m1), durada, buffer);
        for (var k = 0; k < trossos.length; k++) {
          if (out.length >= REU_MAX_FRANGES) break;
          var tt = trossos[k];
          if (exclou[data + ' ' + tt.inici]) continue;   // treta a mà per la mestra
          var xoc = mirarCalendari ? _reuXoca_(data, tt.inici, tt.fi) : null;
          if (xoc) avisos++;
          out.push({ data: data, inici: tt.inici, fi: tt.fi, xoc: xoc || '' });
        }
        finsAra = m1;
      }
    }
    dia.setDate(dia.getDate() + 1);
  }
  return { franges: out, ambXoc: avisos };
}

/* Previsualitzat: el mateix que es crearà, per poder-hi treure hores. */
function reunionsPreview(ss, d) {
  d = d || {};
  var g = _reuGenera_(d);
  if (g.error) return { ok: false, error: g.error };
  return { ok: true, franges: g.franges, ambXoc: g.ambXoc, total: g.franges.length };
}

/* Crear un calendari NO es pot fer dues vegades.
   El navegador reintenta un cop quan una crida falla o triga massa (45 s),
   i crear un calendari escriu moltes files: si la resposta es perdia pel
   camí, el servidor ja ho havia fet i el reintent en creava un SEGON.
   En Pol se'n va trobar dos de cop el setembre del 2026.

   Solució: el navegador envia una clau d'operació (opId) que NO canvia
   entre l'intent i el reintent. Aquí es mira si aquella clau ja s'ha
   servit i, si sí, es torna el mateix resultat sense refer res. El pany
   és perquè el reintent sol arribar amb el primer encara treballant:
   s'espera el torn i llavors ja hi troba el resultat.                    */
function reunionsCrea(ss, d) {
  var opId = (d && d.opId) ? String(d.opId).slice(0, 60) : '';
  if (!opId) return _reuCreaFer_(ss, d);

  var clau = 'reuCrea_' + opId;
  var cache = CacheService.getScriptCache();
  var lock = LockService.getScriptLock();
  var tinc = false;
  try { lock.waitLock(120000); tinc = true; } catch (e) {}
  try {
    var fet = cache.get(clau);
    if (fet) { try { return JSON.parse(fet); } catch (e) {} }
    var res = _reuCreaFer_(ss, d);
    if (res && res.ok) { try { cache.put(clau, JSON.stringify(res), 21600); } catch (e) {} }
    return res;
  } finally { if (tinc) { try { lock.releaseLock(); } catch (e) {} } }
}

function _reuCreaFer_(ss, d) {
  d = d || {};
  var titol = String(d.titol || '').trim();
  if (!titol) return { ok: false, error: 'Falta el títol' };
  var durada = parseInt(d.durada, 10) || 15;
  if (durada < 5 || durada > 240) return { ok: false, error: 'La durada ha de ser entre 5 i 240 minuts' };
  var perDia = d.perDia || {};
  var teCap = false;
  Object.keys(perDia).forEach(function (k) { if ((perDia[k] || []).length) teCap = true; });
  if (!teCap) return { ok: false, error: 'Digues a quines hores tens lliure com a mínim un dia' };

  var g = _reuGenera_(d);
  if (g.error) return { ok: false, error: g.error };

  // Les que xoquen amb el seu calendari no s'ofereixen (si ho ha demanat)
  var bones = g.franges.filter(function (f) { return !f.xoc; });
  if (!bones.length) {
    return { ok: false, error: g.franges.length
      ? 'Totes les hores que has posat xoquen amb coses que ja tens al calendari.'
      : 'No ha quedat cap hora: comprova les dates, les hores i la durada.' };
  }

  var calId = _reuId_();
  var ara = Utilities.formatDate(new Date(), _gTz_(), 'yyyy-MM-dd HH:mm');
  var files = bones.map(function (f, i) {
    return [calId, calId + '-' + i, f.data, f.inici, f.fi, 'lliure', '', '', '', '', ''];
  });

  var shC = _reuCals_(ss), shH = _reuHores_(ss);
  shC.appendRow([calId, titol, String(d.descripcio || ''), durada,
                 parseInt(d.buffer, 10) || 0, String(d.lloc || ''),
                 'si', ara, (d.avisar === false ? 'no' : 'si'),
                 parseInt(d.maxPersona, 10) || 0,
                 bones[0].data, bones[bones.length - 1].data,
                 String(d.missatge || '').slice(0, 600)]);
  shH.getRange(shH.getLastRow() + 1, 1, files.length, REU_CAP_HORES.length).setValues(files);
  SpreadsheetApp.flush();

  return { ok: true, calId: calId, franges: files.length,
           saltades: g.franges.length - bones.length, enllac: _reuEnllac_(calId) };
}

/* Treure una hora que encara NO té ningú.
   Cas típic: ja s'ha enviat l'enllaç i surt un imprevist un dia concret.
   Amb el pany posat, com tot el que toca les hores: si just en aquell
   moment algú l'està reservant, s'espera el torn i llavors veurà que
   ja té algú i no la traurà. Per treure una hora RESERVADA hi ha
   reunionsAllibera, que a més esborra l'event del calendari. */
function reunionsTreuHora(ss, calId, slotId) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(25000); } catch (e) { return { ok: false, error: 'Torna-ho a provar en un moment' }; }
  try {
    var sh = _reuHores_(ss), n = sh.getLastRow();
    if (n < 2) return { ok: false, error: 'No hi ha hores' };
    var v = sh.getRange(2, 1, n - 1, REU_CAP_HORES.length).getValues();
    for (var i = 0; i < v.length; i++) {
      if (String(v[i][0]) !== String(calId) || String(v[i][1]) !== String(slotId)) continue;
      if (String(v[i][5]) === 'ocupat') {
        return { ok: false, error: 'Aquesta hora ja te algú: fes servir "Alliberar" si la vols treure.', ocupada: true };
      }
      sh.deleteRow(i + 2);
      SpreadsheetApp.flush();
      return { ok: true };
    }
    return { ok: false, error: 'Aquesta hora ja no hi és' };
  } finally { lock.releaseLock(); }
}

/* Afegir hores a un calendari que ja existeix, sense refer-lo.
   Respecta les que ja hi ha i no crea res que es trepitgi. */
/* Afegir hores a un calendari ja enviat.
   Rep estones concretes ([{data:'2026-09-18', inici:'10:00', fi:'11:00'}])
   i les parteix amb la durada i el descans que ja té aquell calendari.
   No crea res que trepitgi el que ja hi ha, ni res que xoqui amb el seu
   Google Calendar. Amb el pany posat, com tot el que toca les hores. */
function reunionsAfegeixHores(ss, calId, estones) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(25000); } catch (e) { return { ok: false, error: 'Torna-ho a provar en un moment' }; }
  try {
    var f = _reuCalFila_(ss, calId);
    if (!f) return { ok: false, error: 'Aquest calendari no hi és' };
    var cal = _reuCalObj_(f.v);
    if (!estones || !estones.length) return { ok: false, error: 'Digues quin dia i a quina hora' };

    var sh = _reuHores_(ss), n = sh.getLastRow();
    var hi = [];
    if (n >= 2) {
      sh.getRange(2, 1, n - 1, REU_CAP_HORES.length).getValues().forEach(function (r) {
        if (String(r[0]) === String(calId)) hi.push({ data: String(r[2]), i: _reuMinuts_(String(r[3])), f: _reuMinuts_(String(r[4])) });
      });
    }

    var noves = [], seg = Date.now() % 100000, jaHiEren = 0, xoquen = 0;
    estones.forEach(function (e) {
      var data = String(e.data || '');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return;
      _reuTrossos_(data, String(e.inici || ''), String(e.fi || ''), cal.durada, cal.buffer).forEach(function (t) {
        var m0 = _reuMinuts_(t.inici), m1 = _reuMinuts_(t.fi);
        for (var k = 0; k < hi.length; k++) {
          if (hi[k].data === data && m0 < hi[k].f && hi[k].i < m1) { jaHiEren++; return; }
        }
        if (_reuXoca_(data, t.inici, t.fi)) { xoquen++; return; }
        hi.push({ data: data, i: m0, f: m1 });
        noves.push([calId, calId + '-x' + (seg++), data, t.inici, t.fi, 'lliure', '', '', '', '', '']);
      });
    });

    if (!noves.length) {
      return { ok: false, error: jaHiEren || xoquen
        ? 'Cap hora nova: ' + (jaHiEren ? jaHiEren + ' ja les tenies al calendari de reunions' : '') +
          (jaHiEren && xoquen ? ' i ' : '') + (xoquen ? xoquen + ' xoquen amb el teu Google Calendar' : '') + '.'
        : 'Amb aquesta estona i una durada de ' + cal.durada + ' minuts no hi cap cap reunió.' };
    }
    sh.getRange(sh.getLastRow() + 1, 1, noves.length, REU_CAP_HORES.length).setValues(noves);
    SpreadsheetApp.flush();
    return { ok: true, afegides: noves.length, jaHiEren: jaHiEren, xoquen: xoquen };
  } finally { lock.releaseLock(); }
}

/* El missatge que veu qui reserva quan ja ha triat l'hora.
   Buit = el de sempre ("Ho hem apuntat…"). */
function reunionsMissatge(ss, calId, text) {
  var f = _reuCalFila_(ss, calId);
  if (!f) return { ok: false, error: 'Aquest calendari no hi és' };
  _reuCals_(ss).getRange(f.fila, 13).setValue(String(text || '').slice(0, 600));
  SpreadsheetApp.flush();
  return { ok: true };
}

function _reuEnllac_(calId) {
  var url = '';
  try { url = ScriptApp.getService().getUrl(); } catch (e) {}
  if (!url) return '';
  return url + '?r=' + calId;
}

/* ---------- llegir ---------- */
function _reuCalFila_(ss, calId) {
  var sh = _reuCals_(ss), n = sh.getLastRow();
  if (n < 2) return null;
  var v = sh.getRange(2, 1, n - 1, REU_CAP_CALS.length).getValues();
  for (var i = 0; i < v.length; i++) {
    if (String(v[i][0]) === String(calId)) return { fila: i + 2, v: v[i] };
  }
  return null;
}
function _reuCalObj_(f) {
  return { id: String(f[0]), titol: String(f[1]), descripcio: String(f[2]),
           durada: +f[3] || 15, buffer: +f[4] || 0, lloc: String(f[5]),
           actiu: String(f[6]) !== 'no', creat: String(f[7]),
           avisar: String(f[8]) !== 'no', maxPersona: +f[9] || 0,
           desDe: _reuTxtData_(f[10]), finsA: _reuTxtData_(f[11]),
           missatge: String(f[12] || '') };
}

function reunionsLlista(ss) {
  var shC = _reuCals_(ss), shH = _reuHores_(ss);
  var cals = [], hores = [];
  if (shC.getLastRow() >= 2) cals = shC.getRange(2, 1, shC.getLastRow() - 1, REU_CAP_CALS.length).getValues();
  if (shH.getLastRow() >= 2) hores = shH.getRange(2, 1, shH.getLastRow() - 1, REU_CAP_HORES.length).getValues();

  var avui = Utilities.formatDate(new Date(), _gTz_(), 'yyyy-MM-dd');
  var perCal = {};
  hores.forEach(function (h) {
    var id = String(h[0]);
    if (!perCal[id]) perCal[id] = { lliures: 0, ocupades: 0, reserves: [], passades: 0, horesLliures: [] };
    var passada = _reuTxtData_(h[2]) < avui;
    if (passada) { perCal[id].passades++; }
    if (String(h[5]) === 'ocupat') {
      perCal[id].ocupades++;
      if (!passada) {
        perCal[id].reserves.push({ slotId: String(h[1]), data: _reuTxtData_(h[2]), inici: _reuTxtHora_(h[3]), fi: _reuTxtHora_(h[4]),
                                   nom: String(h[6]), email: String(h[7]), gEventId: String(h[8]),
                                   quan: String(h[9]), error: String(h[10]) });
      }
    } else if (!passada) {
      perCal[id].lliures++;
      // La llista de les que encara son lliures: fa falta per poder treure
      // una hora si a la mestra li surt un imprevist un dia concret.
      perCal[id].horesLliures.push({ slotId: String(h[1]), data: _reuTxtData_(h[2]),
                                     inici: _reuTxtHora_(h[3]), fi: _reuTxtHora_(h[4]) });
    }
  });

  var out = cals.map(function (f) {
    var c = _reuCalObj_(f);
    var e = perCal[c.id] || { lliures: 0, ocupades: 0, reserves: [], passades: 0, horesLliures: [] };
    c.lliures = e.lliures; c.ocupades = e.ocupades; c.passades = e.passades;
    c.horesLliures = (e.horesLliures || []).sort(function (a, b) {
      return (a.data + a.inici).localeCompare(b.data + b.inici);
    });
    c.reserves = e.reserves.sort(function (a, b) {
      return (a.data + a.inici).localeCompare(b.data + b.inici);
    });
    c.enllac = _reuEnllac_(c.id);
    c.acabat = c.finsA && c.finsA < avui;
    return c;
  });
  // Els que ja han passat, al final
  out.sort(function (a, b) {
    if (a.acabat !== b.acabat) return a.acabat ? 1 : -1;
    return String(b.creat).localeCompare(String(a.creat));
  });
  return { ok: true, calendaris: out, avui: avui };
}

/* ---------- accions de la mestra ---------- */
function reunionsActiva(ss, calId, actiu) {
  var f = _reuCalFila_(ss, calId);
  if (!f) return { ok: false, error: 'Aquest calendari no hi és' };
  _reuCals_(ss).getRange(f.fila, 7).setValue(actiu ? 'si' : 'no');
  return { ok: true };
}

/* Allibera una hora reservada: treu l'event del calendari i la torna a
   deixar lliure. Ho fa amb el pany posat, com les reserves. */
function reunionsAllibera(ss, calId, slotId) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(25000); } catch (e) { return { ok: false, error: 'Torna-ho a provar en un moment' }; }
  try {
    var sh = _reuHores_(ss), n = sh.getLastRow();
    if (n < 2) return { ok: false, error: 'No hi ha hores' };
    var v = sh.getRange(2, 1, n - 1, REU_CAP_HORES.length).getValues();
    for (var i = 0; i < v.length; i++) {
      if (String(v[i][0]) !== String(calId) || String(v[i][1]) !== String(slotId)) continue;
      var gId = String(v[i][8]);
      if (gId) { try { Calendar.Events.remove('primary', gId); } catch (e) {} }
      sh.getRange(i + 2, 6, 1, 6).setValues([['lliure', '', '', '', '', '']]);
      SpreadsheetApp.flush();
      return { ok: true };
    }
    return { ok: false, error: 'Aquesta hora no hi és' };
  } finally { lock.releaseLock(); }
}

/* Torna a intentar posar al calendari una reserva que va fallar. */
function reunionsReintenta(ss, calId, slotId) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(25000); } catch (e) { return { ok: false, error: 'Torna-ho a provar en un moment' }; }
  try {
    var f = _reuCalFila_(ss, calId);
    if (!f) return { ok: false, error: 'Aquest calendari no hi és' };
    var cal = _reuCalObj_(f.v);
    var sh = _reuHores_(ss), n = sh.getLastRow();
    var v = sh.getRange(2, 1, n - 1, REU_CAP_HORES.length).getValues();
    for (var i = 0; i < v.length; i++) {
      if (String(v[i][0]) !== String(calId) || String(v[i][1]) !== String(slotId)) continue;
      if (String(v[i][8])) return { ok: true, ja: true };
      // Pels ajudants també: si no, el "Tornar-ho a provar" tornaria a
      // muntar l'event amb el text de 1899 i tornaria a fallar sempre.
      var r = _reuCreaEvent_(cal, _reuTxtData_(v[i][2]), _reuTxtHora_(v[i][3]),
                             _reuTxtHora_(v[i][4]), String(v[i][6]), String(v[i][7]));
      sh.getRange(i + 2, 9).setValue(r.gEventId || '');
      sh.getRange(i + 2, 11).setValue(r.error || '');
      SpreadsheetApp.flush();
      return r.gEventId ? { ok: true } : { ok: false, error: r.error || 'No s\'ha pogut posar al calendari' };
    }
    return { ok: false, error: 'Aquesta hora no hi és' };
  } finally { lock.releaseLock(); }
}

/* Esborra un calendari sencer. Les hores reservades i els seus events del
   Google Calendar també, perquè si no li quedarien reunions fantasma. */
function reunionsEsborra(ss, calId) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(25000); } catch (e) { return { ok: false, error: 'Torna-ho a provar en un moment' }; }
  try {
    var shH = _reuHores_(ss), n = shH.getLastRow(), esborratsEvents = 0;
    if (n >= 2) {
      var v = shH.getRange(2, 1, n - 1, REU_CAP_HORES.length).getValues();
      // Abans es feia deleteRow() DINS del bucle: amb 16 hores eren 16
      // viatges a Google d'un en un i l'esborrat trigava una eternitat.
      // Ara es queda el que NO s'esborra i es reescriu el bloc sencer:
      // dues crides, tant si són 16 hores com si en són 300.
      var queden = [];
      for (var i = 0; i < v.length; i++) {
        if (String(v[i][0]) === String(calId)) {
          var gId = String(v[i][8]);
          if (gId) { try { Calendar.Events.remove('primary', gId); esborratsEvents++; } catch (e) {} }
          continue;
        }
        queden.push(v[i]);
      }
      if (queden.length !== v.length) {
        if (queden.length) shH.getRange(2, 1, queden.length, REU_CAP_HORES.length).setValues(queden);
        var sobren = v.length - queden.length;
        if (sobren > 0) shH.deleteRows(2 + queden.length, sobren);
      }
    }
    var f = _reuCalFila_(ss, calId);
    if (f) _reuCals_(ss).deleteRow(f.fila);
    SpreadsheetApp.flush();
    return { ok: true, eventsEsborrats: esborratsEvents };
  } finally { lock.releaseLock(); }
}

/* ---------- crear l'event al Google Calendar ---------- */
function _reuCreaEvent_(cal, data, inici, fi, nom, email) {
  var tz = _gTz_();
  var ev = {
    summary: cal.titol + ' — ' + nom,
    description: 'Reunió reservada des de l\'app.\n\nPersona: ' + nom +
                 (email ? '\nCorreu: ' + email : '') +
                 (cal.descripcio ? '\n\n' + cal.descripcio : ''),
    start: { dateTime: data + 'T' + inici + ':00', timeZone: tz },
    end:   { dateTime: data + 'T' + fi + ':00',    timeZone: tz }
  };
  if (cal.lloc) ev.location = cal.lloc;
  if (email && cal.avisar) ev.attendees = [{ email: email }];
  try {
    var creat = _gRetry_(function () {
      return Calendar.Events.insert(ev, 'primary',
        (email && cal.avisar) ? { sendUpdates: 'all' } : { sendUpdates: 'none' });
    });
    return { gEventId: creat.id };
  } catch (e) {
    /* Si Google diu que no, guardem PROU informació per saber per què. Amb
       un "Bad Request" pelat no es pot fer res: cal saber què li enviàvem.
       I si el problema és el convidat, es torna a provar SENSE convidat:
       val més que l'event hi sigui i la família no rebi la invitació, que
       no que no hi hagi res al calendari de la mestra. */
    var msg = String((e && e.message) || e);
    if (ev.attendees) {
      try {
        var creat2 = _gRetry_(function () {
          var sense = {};
          Object.keys(ev).forEach(function (k) { if (k !== 'attendees') sense[k] = ev[k]; });
          return Calendar.Events.insert(sense, 'primary', { sendUpdates: 'none' });
        });
        return { gEventId: creat2.id,
                 error: 'L\'event és al teu calendari, però NO s\'ha pogut convidar ' +
                        (email || 'la família') + ': ' + msg.slice(0, 150) };
      } catch (e2) { msg += ' | i sense convidat també falla: ' + String((e2 && e2.message) || e2); }
    }
    return { error: (msg + '  [' + ev.start.dateTime + ' → ' + ev.end.dateTime +
                     ', zona ' + tz + ']').slice(0, 400) };
  }
}

/* ============================================================
   RESERVAR — la part on no hi pot haver cap error
   Crida't NOMÉS des de reuPublicReserva (pàgina pública).
   ============================================================ */
function _reuReserva_(calId, slotId, nom, email) {
  nom = String(nom || '').trim();
  email = String(email || '').trim();
  if (nom.length < 3) return { ok: false, error: 'Escriu el teu nom i cognoms.' };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: 'Escriu un correu electrònic vàlid.' };

  var lock = LockService.getScriptLock();
  // waitLock, no tryLock: si hi ha algú reservant, s'espera el torn.
  try { lock.waitLock(28000); }
  catch (e) { return { ok: false, error: 'Hi ha algú altre reservant en aquest moment. Torna-ho a provar en uns segons.' }; }

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var f = _reuCalFila_(ss, calId);
    if (!f) return { ok: false, error: 'Aquest calendari de reunions no existeix.' };
    var cal = _reuCalObj_(f.v);
    if (!cal.actiu) return { ok: false, error: 'Aquest calendari està tancat: ja no s\'hi poden reservar hores.' };

    var sh = _reuHores_(ss), n = sh.getLastRow();
    if (n < 2) return { ok: false, error: 'Aquest calendari no té hores.' };
    var v = sh.getRange(2, 1, n - 1, REU_CAP_HORES.length).getValues();

    // Límit de reserves per persona (si la mestra n'ha posat)
    if (cal.maxPersona > 0) {
      var seves = 0;
      for (var k = 0; k < v.length; k++) {
        if (String(v[k][0]) === String(calId) && String(v[k][5]) === 'ocupat' &&
            String(v[k][7]).toLowerCase() === email.toLowerCase()) seves++;
      }
      if (seves >= cal.maxPersona) {
        return { ok: false, error: 'Ja tens ' + seves + ' hora' + (seves > 1 ? 'es' : '') +
                 ' reservada' + (seves > 1 ? 'es' : '') + ' amb aquest correu.' };
      }
    }

    // La fila d'aquesta franja, LLEGIDA ARA (no el que digui el navegador)
    var idx = -1;
    for (var i = 0; i < v.length; i++) {
      if (String(v[i][0]) === String(calId) && String(v[i][1]) === String(slotId)) { idx = i; break; }
    }
    if (idx === -1) return { ok: false, error: 'Aquesta hora ja no hi és.' };
    if (String(v[idx][5]) === 'ocupat') {
      return { ok: false, error: 'Ho sentim: aquesta hora l\'acaba d\'agafar una altra persona. Tria\'n una altra.', ocupada: true };
    }

    // Han de passar pels ajudants SÍ O SÍ: amb aquests valors s'hi munta
    // l'event del Google Calendar (data + "T" + hora). Si hi arriba el text
    // que el full torna per a un valor d'hora ("Sat Dec 30 1899 17:00:00
    // GMT+0014 …"), l'event no es pot crear: la família es pensa que té
    // hora i a la mestra no li surt res al calendari.
    var data = _reuTxtData_(v[idx][2]), inici = _reuTxtHora_(v[idx][3]), fi = _reuTxtHora_(v[idx][4]);

    // Ja ha passat?
    if (_reuData_(data, inici).getTime() < Date.now()) {
      return { ok: false, error: 'Aquesta hora ja ha passat.' };
    }

    // Cap altra franja ocupada d'aquest calendari s'hi pot solapar.
    // (Per construcció no hi hauria d'haver solapaments, però això ho
    //  comprova de debò en comptes de confiar-hi.)
    var iniM = _reuMinuts_(inici), fiM = _reuMinuts_(fi);
    for (var j = 0; j < v.length; j++) {
      if (j === idx) continue;
      if (String(v[j][5]) !== 'ocupat') continue;
      if (_reuTxtData_(v[j][2]) !== data) continue;   // comparar text amb text
      var a0 = _reuMinuts_(_reuTxtHora_(v[j][3])), a1 = _reuMinuts_(_reuTxtHora_(v[j][4]));
      if (iniM < a1 && a0 < fiM) {
        return { ok: false, error: 'Aquesta hora es trepitja amb una reunió ja reservada. Tria\'n una altra.', ocupada: true };
      }
    }

    // I res del calendari de la mestra s'hi pot solapar tampoc
    var xoc = _reuXoca_(data, inici, fi);
    if (xoc) return { ok: false, error: 'Aquesta hora ja no està disponible. Tria\'n una altra.', ocupada: true };

    /* PORTA TANCADA: es marca ocupada i es confirma al full ABANS de
       tocar el Google Calendar. Si el Calendar falla, l'hora es queda
       ocupada i s'apunta l'error: mai dues persones a la mateixa hora. */
    var ara = Utilities.formatDate(new Date(), _gTz_(), 'yyyy-MM-dd HH:mm');
    sh.getRange(idx + 2, 6, 1, 5).setValues([['ocupat', nom, email, '', ara]]);
    SpreadsheetApp.flush();

    var r = _reuCreaEvent_(cal, data, inici, fi, nom, email);
    sh.getRange(idx + 2, 9).setValue(r.gEventId || '');
    sh.getRange(idx + 2, 11).setValue(r.error || '');
    SpreadsheetApp.flush();

    return { ok: true, data: data, inici: inici, fi: fi, titol: cal.titol, lloc: cal.lloc,
             missatge: cal.missatge, alCalendari: !!r.gEventId };
  } finally {
    lock.releaseLock();
  }
}

/* ============================================================
   PÀGINA PÚBLICA
   Qui reserva no té l'app ni cap token: l'enllaç ja és la clau
   (l'id del calendari són 22 caràcters a l'atzar).
   Es serveix des de l'Apps Script, així que funciona per a
   qualsevol, sense instal·lar res.
   ============================================================ */

// Crides que fa la pàgina pública (google.script.run). NO demanen token.
function reuPublicInfo(calId) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var f = _reuCalFila_(ss, calId);
    if (!f) return { ok: false, error: 'Aquest enllaç no és vàlid.' };
    var cal = _reuCalObj_(f.v);
    var sh = _reuHores_(ss), n = sh.getLastRow();
    var lliures = [];
    if (n >= 2) {
      var v = sh.getRange(2, 1, n - 1, REU_CAP_HORES.length).getValues();
      var ara = Date.now();
      v.forEach(function (h) {
        if (String(h[0]) !== String(calId)) return;
        if (String(h[5]) !== 'lliure') return;                 // ocupada: no es mostra
        if (_reuData_(_reuTxtData_(h[2]), _reuTxtHora_(h[3])).getTime() < ara) return;  // ja passada
        lliures.push({ slotId: String(h[1]), data: _reuTxtData_(h[2]), inici: _reuTxtHora_(h[3]), fi: _reuTxtHora_(h[4]) });
      });
    }
    lliures.sort(function (a, b) { return (a.data + a.inici).localeCompare(b.data + b.inici); });
    return { ok: true, titol: cal.titol, descripcio: cal.descripcio, lloc: cal.lloc,
             durada: cal.durada, actiu: cal.actiu, hores: lliures,
             missatge: cal.missatge };
  } catch (e) {
    return { ok: false, error: 'Hi ha hagut un problema. Torna-ho a provar.' };
  }
}

function reuPublicReserva(calId, slotId, nom, email) {
  try { return _reuReserva_(calId, slotId, nom, email); }
  catch (e) { return { ok: false, error: 'Hi ha hagut un problema. Torna-ho a provar.' }; }
}

function _reuPaginaHtml_(calId) {
  var h = ''
  + '<!DOCTYPE html><html lang="ca"><head><meta charset="utf-8">'
  + '<meta name="viewport" content="width=device-width,initial-scale=1">'
  + '<title>Reservar hora</title><style>'
  + ':root{--g:#7A1E2E;--c:#C01E4B;--gd:#4A1520;--soft:#FBEAED;--bd:#EADFE2;--tx:#2A2124;--mu:#8A7F82}'
  + '*{box-sizing:border-box;margin:0;padding:0}'
  + 'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#FAF7F8;color:var(--tx);line-height:1.6;padding:18px}'
  + '.w{max-width:620px;margin:0 auto}'
  + '.card{background:#fff;border:1px solid var(--bd);border-radius:14px;padding:22px;box-shadow:0 1px 3px rgba(0,0,0,.04)}'
  + 'h1{font-size:23px;color:var(--gd);line-height:1.25;margin-bottom:6px}'
  + '.desc{color:var(--mu);margin-bottom:4px;white-space:pre-wrap}'
  + '.meta{font-size:13px;color:var(--mu);margin-top:10px;padding-top:10px;border-top:1px solid var(--bd)}'
  + '.dia{margin-top:20px}'
  + '.dia h2{font-size:14px;color:var(--g);text-transform:uppercase;letter-spacing:.05em;margin-bottom:9px}'
  + '.hores{display:flex;flex-wrap:wrap;gap:8px}'
  + 'button.h{font:inherit;font-weight:700;font-size:15px;background:#fff;color:var(--g);border:1.5px solid var(--bd);'
  + 'border-radius:9px;padding:11px 15px;cursor:pointer;min-width:88px;min-height:46px}'
  + 'button.h:hover{border-color:var(--c);background:var(--soft)}'
  + 'button.h:focus-visible{outline:3px solid var(--c);outline-offset:2px}'
  + '.btn{font:inherit;font-weight:700;background:var(--c);color:#fff;border:0;border-radius:9px;padding:13px 20px;cursor:pointer;min-height:48px;width:100%}'
  + '.btn[disabled]{opacity:.55;cursor:not-allowed}'
  + '.btn2{background:#fff;color:var(--g);border:1.5px solid var(--bd)}'
  + 'label{display:block;font-weight:700;font-size:14px;margin:14px 0 5px}'
  + 'input{font:inherit;width:100%;padding:12px;border:1.5px solid var(--bd);border-radius:9px;min-height:46px}'
  + 'input:focus{outline:3px solid var(--c);outline-offset:1px;border-color:var(--c)}'
  + '.tria{background:var(--soft);border-left:4px solid var(--c);padding:12px 15px;border-radius:0 9px 9px 0;margin-bottom:6px;font-weight:700;color:var(--gd)}'
  + '.err{background:#FEF3C7;border-left:4px solid #D97706;padding:12px 15px;border-radius:0 9px 9px 0;margin:14px 0;color:#92400E}'
  + '.ok{text-align:center;padding:10px 0}.ok .tic{font-size:44px;line-height:1}'
  + '.buit{text-align:center;color:var(--mu);padding:26px 0}'
  + '.carregant{text-align:center;color:var(--mu);padding:30px 0}'
  + '.hint{font-size:12.5px;color:var(--mu);margin-top:6px}'
  + 'button.d{font:inherit;display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;'
  + 'background:#fff;color:var(--gd);border:1.5px solid var(--bd);border-radius:9px;padding:13px 15px;'
  + 'cursor:pointer;min-height:52px;margin-bottom:8px;text-align:left;font-weight:700;font-size:15px}'
  + 'button.d:hover{border-color:var(--c);background:var(--soft)}'
  + 'button.d:focus-visible{outline:3px solid var(--c);outline-offset:2px}'
  + 'button.d em{font-style:normal;font-weight:400;font-size:13px;color:var(--mu);white-space:nowrap}'
  + '</style></head><body><div class="w"><div class="card" id="app">'
  + '<div class="carregant">Carregant les hores disponibles…</div>'
  + '</div></div><script>'
  + 'var CAL=' + JSON.stringify(String(calId)) + ';var INFO=null,TRIA=null;'
  + 'var PERDIA={},ORDRE=[],CAP="";'
  + 'var DIES=["Diumenge","Dilluns","Dimarts","Dimecres","Dijous","Divendres","Dissabte"];'
  + 'var MESOS=["gener","febrer","març","abril","maig","juny","juliol","agost","setembre","octubre","novembre","desembre"];'
  + 'function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(m){return {"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;"}[m];});}'
  // Les dates poden arribar com "2026-09-10" o, si aquest Apps Script encara
  // no s'ha redesplegat, com "Wed Sep 10 2026 00:00:00 GMT+0200 (…)". A una
  // família li sortia "Undefined NaN" com a nom del dia. Aquí s'entenen les
  // dues, i el que no s'entengui no s'ensenya malament.
  + 'function normData(v){var s=String(v==null?"":v).trim();'
  + 'if(/^\\d{4}-\\d{2}-\\d{2}$/.test(s))return s;'
  + 'var d=new Date(s);if(!isNaN(d.getTime())&&d.getFullYear()>2000){'
  + 'var p=function(n){return (n<10?"0":"")+n;};'
  + 'return d.getFullYear()+"-"+p(d.getMonth()+1)+"-"+p(d.getDate());}return "";}'
  // L'hora es LLEGEIX del text, no s'interpreta: fer new Date() amb
  // "Sat Dec 30 1899 15:00:00 GMT+0014" i treure'n l'hora la mou mitja hora
  // pel desfasament horari d'aquell any (les 15:00 sortien com a 14:31).
  + 'function normHora(v){var s=String(v==null?"":v).trim();var m=s.match(/(\\d{1,2}):(\\d{2})/);'
  + 'if(m){var hh=Math.min(23,parseInt(m[1],10));return ("0"+hh).slice(-2)+":"+m[2];}return s;}'
  + 'function dataText(d){var s=normData(d);if(!s)return "";var p=s.split("-");'
  + 'var dt=new Date(+p[0],+p[1]-1,+p[2]);'
  + 'return DIES[dt.getDay()]+", "+(+p[2])+" de "+MESOS[+p[1]-1];}'
  + 'function diaCurt(d){var s=normData(d);if(!s)return "";var p=s.split("-");'
  + 'var dt=new Date(+p[0],+p[1]-1,+p[2]);'
  + 'return DIES[dt.getDay()]+" "+(+p[2])+" "+MESOS[+p[1]-1];}'
  + 'var app=document.getElementById("app");'
  + 'function carrega(){google.script.run.withSuccessHandler(pinta).withFailureHandler(function(){'
  + 'app.innerHTML="<div class=\'err\'>No s\'ha pogut carregar. Comprova la connexió i torna-ho a provar.</div>";'
  + '}).reuPublicInfo(CAL);}'
  + 'function pinta(r){INFO=r;if(!r||!r.ok){app.innerHTML="<div class=\'err\'>"+esc((r&&r.error)||"Enllaç no vàlid")+"</div>";return;}'
  + 'var h="<h1>"+esc(r.titol)+"</h1>";'
  + 'if(r.descripcio)h+="<div class=\'desc\'>"+esc(r.descripcio)+"</div>";'
  + 'if(!r.actiu){h+="<div class=\'err\'>Aquest calendari està tancat: ja no s\'hi poden reservar hores.</div>";app.innerHTML=h;return;}'
  + 'if(!r.hores.length){h+="<div class=\'buit\'><strong>Ara mateix no queda cap hora lliure.</strong><br>Si necessites una altra hora, respon el correu amb què t\'han enviat aquest enllaç.</div>";app.innerHTML=h;return;}'
  + 'h+="<div class=\'meta\'>Reunions de "+r.durada+" minuts"+(r.lloc?" &middot; "+esc(r.lloc):"")+" &middot; queden "+r.hores.length+" hores lliures</div>";'
  // Primer es tria el DIA i després l'hora. Abans sortien totes les hores de
  // tots els dies de cop: amb tres setmanes eren dues-centes al mòbil, i la
  // família havia de baixar una eternitat per trobar la que li anava bé.
  + 'PERDIA={};ORDRE=[];'
  + 'r.hores.forEach(function(s){var d=normData(s.data)||"?";'
  + 'if(!PERDIA[d]){PERDIA[d]=[];ORDRE.push(d);}'
  + 'PERDIA[d].push({slotId:s.slotId,data:d,inici:normHora(s.inici),fi:normHora(s.fi)});});'
  + 'ORDRE.sort();'
  + 'ORDRE.forEach(function(d){PERDIA[d].sort(function(a,b){return a.inici.localeCompare(b.inici);});});'
  + 'CAP=h;pintaDies();}'

  // Pas 1: els dies
  + 'function pintaDies(){var h=CAP+"<div class=\'dia\'><h2>Tria el dia</h2>";'
  + 'ORDRE.forEach(function(d){var n=PERDIA[d].length;'
  + 'h+="<button class=\'d\' data-d=\'"+esc(d)+"\'><span>"+esc(d==="?"?"Sense data":diaCurt(d))+"</span>"'
  + '+"<em>"+n+(n===1?" hora":" hores")+"</em></button>";});'
  + 'h+="</div>";app.innerHTML=h;'
  + 'app.querySelectorAll("button.d").forEach(function(b){b.addEventListener("click",function(){'
  + 'pintaHores(b.getAttribute("data-d"));});});}'

  // Pas 2: les hores d'aquell dia
  + 'function pintaHores(d){var l=PERDIA[d]||[];'
  + 'var h=CAP+"<div class=\'dia\'><h2>"+esc(d==="?"?"Sense data":dataText(d))+"</h2><div class=\'hores\'>";'
  + 'l.forEach(function(s){h+="<button class=\'h\' data-s=\'"+esc(s.slotId)+"\'>"+esc(s.inici)+"</button>";});'
  + 'h+="</div><button class=\'btn btn2\' id=\'tornar\' style=\'margin-top:14px\'>&larr; Triar un altre dia</button></div>";'
  + 'app.innerHTML=h;'
  + 'document.getElementById("tornar").addEventListener("click",pintaDies);'
  + 'app.querySelectorAll("button.h").forEach(function(b){b.addEventListener("click",function(){'
  + 'var s=l.filter(function(x){return x.slotId===b.getAttribute("data-s");})[0];if(s)formulari(s);});});}'
  + 'function formulari(s){TRIA=s;'
  + 'app.innerHTML="<h1>"+esc(INFO.titol)+"</h1>"'
  + '+"<div class=\'tria\'>"+esc(dataText(s.data))+" &middot; "+esc(normHora(s.inici))+" - "+esc(normHora(s.fi))+"</div>"'
  + '+(INFO.lloc?"<div class=\'hint\'>On: "+esc(INFO.lloc)+"</div>":"")'
  + '+"<label for=\'n\'>Nom i cognoms</label><input id=\'n\' autocomplete=\'name\'>"'
  + '+"<label for=\'e\'>Correu electrònic</label><input id=\'e\' type=\'email\' autocomplete=\'email\'>"'
  + '+"<div class=\'hint\'>Hi rebràs la confirmació i l\'avís al calendari.</div>"'
  + '+"<div id=\'msg\'></div>"'
  + '+"<div style=\'margin-top:16px;display:flex;gap:9px;flex-direction:column\'>"'
  + '+"<button class=\'btn\' id=\'ok\'>Reservar aquesta hora</button>"'
  + '+"<button class=\'btn btn2\' id=\'no\'>Triar-ne una altra</button></div>";'
  + 'document.getElementById("no").addEventListener("click",function(){carrega();});'
  + 'document.getElementById("ok").addEventListener("click",envia);'
  + 'document.getElementById("n").focus();}'
  + 'function envia(){var n=document.getElementById("n").value.trim();var e=document.getElementById("e").value.trim();'
  + 'var msg=document.getElementById("msg");'
  + 'if(n.length<3){msg.innerHTML="<div class=\'err\'>Escriu el teu nom i cognoms.</div>";document.getElementById("n").focus();return;}'
  + 'if(!/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(e)){msg.innerHTML="<div class=\'err\'>Escriu un correu electrònic vàlid.</div>";document.getElementById("e").focus();return;}'
  + 'var b=document.getElementById("ok");b.disabled=true;b.textContent="Reservant\\u2026";msg.innerHTML="";'
  + 'google.script.run.withSuccessHandler(function(r){'
  + 'if(r&&r.ok){fet(r);return;}'
  + 'b.disabled=false;b.textContent="Reservar aquesta hora";'
  + 'msg.innerHTML="<div class=\'err\'>"+esc((r&&r.error)||"No s\'ha pogut reservar.")+"</div>";'
  + 'if(r&&r.ocupada)setTimeout(carrega,2200);'
  + '}).withFailureHandler(function(){b.disabled=false;b.textContent="Reservar aquesta hora";'
  + 'msg.innerHTML="<div class=\'err\'>No s\'ha pogut reservar. Comprova la connexió i torna-ho a provar.</div>";'
  + '}).reuPublicReserva(CAL,TRIA.slotId,n,e);}'
  + 'function fet(r){app.innerHTML="<div class=\'ok\'><div class=\'tic\'>\\u2705</div>"'
  + '+"<h1 style=\'margin-top:8px\'>Hora reservada</h1>"'
  // Les hores també passen pel normHora aquí: aquesta pantalla la veu la
  // família just després de reservar, i és l'última impressió que s'endú.
  + '+"<p style=\'margin:10px 0\'><strong>"+esc(dataText(r.data))+"</strong><br>"+esc(normHora(r.inici))+" - "+esc(normHora(r.fi))+"</p>"'
  + '+(r.lloc?"<p class=\'hint\'>On: "+esc(r.lloc)+"</p>":"")'
  + '+"<p class=\'hint\' style=\'margin-top:12px\'>"+esc(r.missatge||"Ho hem apuntat. Si no hi pots venir, respon el correu amb què t\'han enviat l\'enllaç.")+"</p></div>";}'
  + 'carrega();'
  + '</script></body></html>';
  return h;
}


/* ============================================================
   DEIXAR EL FULL EN BLANC (per fer-ne la plantilla)
   ------------------------------------------------------------
   Serveix per tenir UN full net del qual cada mestra en faci una
   còpia al seu Drive. Treu totes les dades de proves i deixa
   l'estructura a punt.

   COM ES FA:
     1. Tria "buidaLesDades" al desplegable de dalt.
     2. Prem Executar.
     3. Llegeix el registre: diu exactament què ha buidat.

   ⚠ QUÈ *NO* TOCA MAI, i és a posta:
     · El full "Grups" COMPARTIT (alumnes de tota l'escola).
     · El full "Desdoblaments" COMPARTIT.
       Aquests dos són d'un altre document: aquesta funció només
       toca el full on viu aquest script.
     · Les credencials (Script Properties). Es queden, que és el
       que vols per a la plantilla.
     · El Google Calendar i el Google Tasks. Res d'això s'esborra.

   ⚠ NO ES POT DESFER. Fes-ho només al full que vols de plantilla.
      Si vols conservar les teves dades, fes-ne una còpia abans
      (Fitxer > Fes-ne una còpia).
   ============================================================ */
function buidaLesDades() {
  var CONFIRMA = 'SI, BUIDA-HO';   // ← per buidar de debò, ha de dir exactament això

  var linies = [];
  var diu = function (t) { linies.push(t); Logger.log(t); };

  diu('DEIXAR EL FULL EN BLANC');
  diu('=======================');

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  diu('Full: "' + ss.getName() + '"');
  diu('');

  if (CONFIRMA !== 'SI, BUIDA-HO') {
    diu('ATURAT: no s\'ha tocat res.');
    diu('Per buidar-lo de debo, posa CONFIRMA = \'SI, BUIDA-HO\' aqui dalt.');
    return linies.join('\n');
  }

  /* Aquests fulls es buiden PER COMPLET (dades de proves) */
  var BUIDA_TOT = ['_AppData', '_AppData_Planning', '_AppData_Assim', '_AppData_Actitud',
                   'Reunions', 'Reunions_Hores'];

  /* D'aquests es deixa la primera fila (la capçalera) i prou */
  /* D'aquests es deixa la capçalera i prou. Els registres d'una mestra amb
     tutoria no es diuen "Registres d'aula" sinó "Registres 2n C" (un per
     grup), o sigui que s'han de mirar pel començament del nom i no per la
     llista: si no, es quedarien amb totes les dades a dins. */
  var DEIXA_CAPCALERA = ['Alumnes'];
  var esDeRegistres = function (n) { return /^Registres( |$)/.test(n); };

  var esborrats = 0, buidats = 0, pestanyes = 0;

  ss.getSheets().forEach(function (sh) {
    var nom = sh.getName();
    pestanyes++;

    /* 1) Les pestanyes de notes i assoliments d'un grup: fora senceres.
          Es tornen a crear soles quan la mestra hi entri. */
    var esDeGrup = /^(1T|2T|3T)[_ ]/.test(nom) || /_(1r|2n|3r|4t|5è|6è) [ABC]$/.test(nom) ||
                   /^Assoliments/i.test(nom) || /^Actitud/i.test(nom);
    if (esDeGrup) {
      try { ss.deleteSheet(sh); esborrats++; diu('   esborrada  ' + nom); }
      catch (e) { diu('   NO s\'ha pogut esborrar ' + nom + ': ' + e.message); }
      return;
    }

    /* 2) Els magatzems de dades: buits del tot */
    if (BUIDA_TOT.indexOf(nom) !== -1) {
      try { sh.clearContents(); buidats++; diu('   buidada    ' + nom); }
      catch (e) { diu('   NO s\'ha pogut buidar ' + nom + ': ' + e.message); }
      return;
    }

    /* 3) Alumnes i Registres: es queda la capçalera */
    if (DEIXA_CAPCALERA.indexOf(nom) !== -1 || esDeRegistres(nom)) {
      try {
        var n = sh.getLastRow();
        if (n > 1) sh.getRange(2, 1, n - 1, Math.max(sh.getLastColumn(), 1)).clearContent();
        buidats++;
        diu('   buidada    ' + nom + ' (capçalera conservada)');
      } catch (e) { diu('   NO s\'ha pogut buidar ' + nom + ': ' + e.message); }
      return;
    }

    diu('   intacta    ' + nom);
  });

  SpreadsheetApp.flush();

  diu('');
  diu('=======================');
  diu('Pestanyes mirades: ' + pestanyes + ' · buidades: ' + buidats + ' · esborrades: ' + esborrats);
  diu('');
  diu('NO s\'ha tocat: el full "Grups" ni el de "Desdoblaments" (son documents');
  diu('a part), ni les credencials, ni el Calendar, ni el Tasks.');
  diu('');
  diu('El full ja et serveix de plantilla. Per a cada mestra nova:');
  diu('  1. Fitxer > Fes-ne una còpia, al Drive D\'ELLA.');
  diu('  2. Que ELLA executi configuraTot() i desplegui (veure INSTALLACIO.md).');
  return linies.join('\n');
}

/* ============================================================
   CONFIGURAR UNA APP NOVA — TOT EN UNA SOLA EXECUCIO
   ------------------------------------------------------------
   Per donar d'alta una mestra: omple els 4 valors d'aqui sota,
   tria "configuraTot" al desplegable de dalt i prem Executar.

   Fa tot això sol:
     · Desa les credencials a les propietats del script
     · Crea les pestanyes que calen (Alumnes, Registres d'aula, _AppData…)
     · Protegeix els fulls i ajusta les columnes
     · Comprova que pot escriure al Calendar i a Tasks
     · Et diu què queda per fer

   Els 3 primers valors son ELS MATEIXOS per a totes les mestres:
   copia'ls una vegada i reaprofita'ls. Nomes canvia si vols un token
   diferent per a cadascuna (no cal: pot ser el mateix).

   NOTA: si deixes un valor buit, NO s'esborra el que ja hi hagi.
   Aixi pots tornar-la a executar sense por.
   ============================================================ */
function configuraTot() {
  // ▼▼▼ OMPLE AIXO ▼▼▼
  var CONFIG = {
    GRUPS_ID:   '',   // ID del full "Grups" compartit
    DESDOB_ID:  '',   // ID del full "Desdoblaments" compartit
    GEMINI_KEY: '',   // clau de Gemini (pot ser la mateixa per a totes)
    APP_TOKEN:  '',   // ha de coincidir amb el de js/config.local.js de la seva app
  };
  // ▲▲▲ OMPLE AIXO ▲▲▲

  var linies = [];
  var diu = function (t) { linies.push(t); Logger.log(t); };
  var pendents = [];

  diu('CONFIGURACIO DE L APP');
  diu('=====================');

  /* 1) Credencials */
  diu('');
  diu('1) Credencials');
  var props = PropertiesService.getScriptProperties();
  var posades = 0, mantingudes = 0;
  Object.keys(CONFIG).forEach(function (k) {
    var v = (CONFIG[k] || '').toString().trim();
    if (v) { props.setProperty(k, v); posades++; }
    else {
      var actual = props.getProperty(k);
      if (actual) { mantingudes++; }
      else { pendents.push('Falta ' + k + ': omple-la aqui dalt i torna a executar.'); }
    }
  });
  diu('   Desades: ' + posades + ' · ja hi eren: ' + mantingudes);
  if (pendents.length) pendents.forEach(function (p) { diu('   FALTA: ' + p); });

  /* 2) Pestanyes del full */
  diu('');
  diu('2) Pestanyes del full de calcul');
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  try {
    getOrCreateAlumnesSheet(ss);
    diu('   Alumnes ................ OK');
  } catch (e) { diu('   Alumnes ................ HA FALLAT: ' + e.message); }
  try {
    getOrCreateRegistreSheet(ss, []);
    diu('   Registres d aula ....... OK');
  } catch (e) { diu('   Registres d aula ....... HA FALLAT: ' + e.message); }
  // Els fulls de dades ocults es creen sols en escriure-hi la primera clau
  try { _reuCals_(ss); _reuHores_(ss); diu('   Reunions .............. OK'); }
  catch (e) { diu('   Reunions .............. HA FALLAT: ' + e.message); }
  ['_AppData', '_AppData_Planning', '_AppData_Assim', '_AppData_Actitud'].forEach(function (nom) {
    try {
      var sh = ss.getSheetByName(nom);
      if (!sh) { sh = ss.insertSheet(nom); sh.hideSheet(); }
      diu('   ' + nom + (nom.length < 16 ? ' ' : '') + ' ....... OK');
    } catch (e) { diu('   ' + nom + ' HA FALLAT: ' + e.message); }
  });

  /* 3) Proteccio i format */
  diu('');
  diu('3) Proteccio i amplada de columnes');
  try { protegirTotsElsFullsDeCalcul(ss); diu('   Fulls protegits ........ OK'); }
  catch (e) { diu('   Proteccio .............. HA FALLAT: ' + e.message); }
  try { autoAjustaTotsElsFulls(ss); diu('   Columnes ajustades ..... OK'); }
  catch (e) { diu('   Columnes ............... HA FALLAT: ' + e.message); }

  /* 4) Acces al full compartit de Grups */
  diu('');
  diu('4) Full "Grups" compartit');
  try {
    var gss = getGrupsSpreadsheet(ss);
    if (gss) diu('   Accedeix a: "' + gss.getName() + '" OK');
    else { diu('   NO s hi pot accedir.'); pendents.push('Comprova el GRUPS_ID i que aquest compte hi tingui perms.'); }
  } catch (e) {
    diu('   NO s hi pot accedir: ' + e.message);
    pendents.push('Comprova el GRUPS_ID i els permisos del full Grups.');
  }

  /* 5) Escriptura al Calendar i a Tasks (i autoritzacio) */
  diu('');
  diu('5) Google Calendar i Google Tasks');
  var idProva = 'provavedruna' + String(Date.now()).slice(-8);
  try {
    var dema = new Date(); dema.setDate(dema.getDate() + 1);
    var pad = function (x) { return (x < 10 ? '0' : '') + x; };
    var d = dema.getFullYear() + '-' + pad(dema.getMonth() + 1) + '-' + pad(dema.getDate());
    Calendar.Events.insert({
      id: idProva, summary: 'PROVA app (s esborra sola)',
      start: { dateTime: d + 'T09:00:00', timeZone: 'Europe/Madrid' },
      end:   { dateTime: d + 'T10:00:00', timeZone: 'Europe/Madrid' }
    }, 'primary');
    Calendar.Events.remove('primary', idProva);
    diu('   Calendar ............... OK (pot escriure-hi)');
  } catch (e) {
    diu('   Calendar ............... HA FALLAT: ' + e.message);
    pendents.push('Calendar: revisa el servei avancat i els permisos.');
    try { Calendar.Events.remove('primary', idProva); } catch (e2) {}
  }
  try {
    var t = Tasks.Tasks.insert({ title: 'PROVA app (s esborra sola)' }, '@default');
    Tasks.Tasks.remove('@default', t.id);
    diu('   Tasks .................. OK (pot escriure-hi)');
  } catch (e) {
    diu('   Tasks .................. HA FALLAT: ' + e.message);
    pendents.push('Tasks: revisa el servei avancat i els permisos.');
  }

  /* 6) Recordatori dels esmorzars (només a l'app de direcció) */
  diu('');
  diu('6) Recordatori dels esmorzars de coordinacio');
  diu('   NOMES cal a l app de DIRECCIO. A la resta, salta-t ho.');
  try {
    var jaHiEs = ScriptApp.getProjectTriggers().filter(function (t) {
      return t.getHandlerFunction() === 'recordatoriEsmorzars';
    }).length;
    diu(jaHiEs ? '   Disparador diari ....... ja hi es' : '   Disparador diari ....... NO hi es');
    if (!jaHiEs) pendents.push('Si es l app de direccio: executa configuraRecordatoriEsmorzars() un cop.');
  } catch (e) {
    diu(_faltaPermisDisparadors_(e) ? '   NO s han pogut mirar: el appsscript.json es vell.' 
                                    : '   No s han pogut mirar els disparadors: ' + e.message);
    if (_faltaPermisDisparadors_(e)) pendents.push('El appsscript.json d aquest projecte es vell. ' + _comManifestVell_());
  }

  /* 7) Sincronitzacio constant de les llistes d'alumnes */
  diu('');
  diu('7) Sincronitzacio constant de les llistes de l escola');
  diu('   NOMES ha d estar engegada en UNA app (la de DIRECCIO).');
  diu('   Si s engega a mes d una, dos scripts escriurien el mateix full alhora.');
  try {
    var permisSync = String(PropertiesService.getScriptProperties()
      .getProperty('SYNC_LLISTES') || '').toLowerCase() === 'si';
    var dispSync = ScriptApp.getProjectTriggers().filter(function (t) {
      return t.getHandlerFunction() === 'grupsSincronitzaAuto';
    }).length;
    diu('   Permis (SYNC_LLISTES) .. ' + (permisSync ? 'si' : 'no'));
    diu('   Disparador ............. ' + (dispSync ? 'posat (cada ' + SYNC_CADA_MINUTS + ' min)' : 'NO hi es'));
    if (permisSync && !dispSync) pendents.push('Te el permis pero NO el disparador: executa configuraSincronitzacioLlistes().');
    if (!permisSync && dispSync) pendents.push('Te el disparador pero NO el permis: no fara res. Executa configuraSincronitzacioLlistes() o treuSincronitzacioLlistes().');
    if (!permisSync && !dispSync) diu('   Si es l app de DIRECCIO: executa configuraSincronitzacioLlistes() un cop.');
  } catch (e) {
    diu(_faltaPermisDisparadors_(e) ? '   NO s ha pogut mirar: el appsscript.json es vell.'
                                    : '   No s ha pogut mirar: ' + e.message);
    if (_faltaPermisDisparadors_(e)) pendents.push('El appsscript.json d aquest projecte es vell. ' + _comManifestVell_());
  }

  /* Resum */
  diu('');
  diu('=====================');
  if (!pendents.length) {
    diu('TOT LLEST.');
    diu('');
    diu('Nomes queda:');
    diu('  1. Implementa > Nova implementacio > Aplicacio web');
    diu('     (Executar com: JO · Acces: qualsevol)');
    diu('  2. Copia la URL que acaba en /exec');
    diu('  3. Posa-la a l app de la mestra: Configuracio > Connectar');
  } else {
    diu('QUEDA PER FER:');
    pendents.forEach(function (p) { diu('  - ' + p); });
  }
  return linies.join('\n');
}

function configuraCredencials() {
  var props = PropertiesService.getScriptProperties();
  props.setProperties({
    GRUPS_ID:   '',   // ← ID del full de grups
    DESDOB_ID:  '',   // ← ID del full de desdoblaments
    GEMINI_KEY: '',   // ← clau de Gemini
    APP_TOKEN:  '',   // ← token secret (mateix que js/app.js)
  });
  return 'Credencials desades a les propietats del script ✓';
}

// Accessors (llegeixen de propietats; si no n'hi ha, cadena buida)
var FULLS_COMPARTITS = {
  get grups()  { return _prop('GRUPS_ID'); },
  get desdob() { return _prop('DESDOB_ID'); },
};
function _appToken()  { return _prop('APP_TOKEN'); }
function _geminiKey() { return _prop('GEMINI_KEY'); }

const TABS = { alumnes: 'Alumnes', registre: "Registres d'aula" };

/* Quina pestanya de registres toca.
   · Tutor (sense grup): "Registres d'aula", la de sempre.
   · Especialista: una per grup, "Registres 3r A", perquè les files són els
     alumnes d'aquell grup i barrejar-los posaria les creus a qui no toca. */
function _nomFullRegistre(grup) {
  var g = (grup || '').toString().trim();
  if (!g) return TABS.registre;
  // El Sheets no accepta aquests caràcters al nom d'una pestanya
  g = g.replace(/[:\\\/\?\*\[\]]/g, '-');
  var nom = 'Registres ' + g;
  return nom.length > 99 ? nom.slice(0, 99) : nom;
}

// Tots els grups de primària (3 línies). Cada grup és una pestanya al full centralitzat.
const GRUPS_PRIMARIA = [
  '1r A','1r B','1r C','2n A','2n B','2n C','3r A','3r B','3r C',
  '4t A','4t B','4t C','5è A','5è B','5è C','6è A','6è B','6è C'
];
// Capçaleres del full de grup (les 9 primeres venen del teu full de Grups;
// les 3 últimes són camps propis de l'app).
const GRUP_HEADERS = [
  'Nom','Cognom','Data naixement','Nom mare','Nom pare','Email mare','Email pare',
  'Observació important','Gènere','PI','AM','Aspectes específics','Informe EAP','Condicions seient',
  'Id'   // ⚠ NO TOCAR: veure "L'IDENTIFICADOR PERMANENT" més avall
];
const COL_UID = 15;   // columna O

// Resol l'ID del full de grups: primer el desat pel mestre, si no el compartit
function _resolGrupsId(ss) {
  var propi = sheetGetJSON(ss, '_AppData', 'grups_sheet_id');
  if (propi && propi.toString().trim()) return propi.toString().trim();
  return (FULLS_COMPARTITS.grups || '').toString().trim();
}
// Resol l'ID del full de desdoblaments igual
function _resolDesdobId(ss) {
  var propi = sheetGetJSON(ss, '_AppData', 'desdob_sheet_id');
  if (propi && propi.toString().trim()) return propi.toString().trim();
  return (FULLS_COMPARTITS.desdob || '').toString().trim();
}

// Full "grups" compartit (extern). El seu ID es desa a la config del full personal
// amb la clau 'grups_sheet_id'. Retorna l'objecte Spreadsheet o null.
function getGrupsSpreadsheet(ss) {
  var id = _resolGrupsId(ss);
  if (!id) return null;
  try { return SpreadsheetApp.openById(id); }
  catch(e) { return null; }
}

// Versió que informa de l'error (per diagnòstic). Retorna {ss, error}.
function getGrupsSpreadsheetDiag(ss) {
  var id = _resolGrupsId(ss);
  if (!id) return { ss:null, error:'No hi ha cap ID de full "Grups" desat' };
  try { return { ss: SpreadsheetApp.openById(id), error:null }; }
  catch(e) { return { ss:null, error:'No es pot obrir el full "Grups": ' + e.message, id:id }; }
}

// Executa una funció amb el full "Grups". Si no es pot obrir, retorna error clar.
function _withGrups(ss, fn) {
  var d = getGrupsSpreadsheetDiag(ss);
  if (!d.ss) return { ok:false, error:d.error, needsGrupsSheet:true };
  return fn(d.ss);
}

// Acció de diagnòstic: comprova l'accés al full "Grups" i llista pestanyes
function diagGrups(ss) {
  var d = getGrupsSpreadsheetDiag(ss);
  if (!d.ss) return { ok:false, error:d.error, id:d.id||null };
  var noms = d.ss.getSheets().map(function(s){ return s.getName(); });
  return { ok:true, nom: d.ss.getName(), pestanyes: noms };
}

// Desa/llegeix l'ID del full "grups" compartit
function saveGrupsSheetId(ss, id) {
  sheetSetJSON(ss, '_AppData', 'grups_sheet_id', (id||'').toString().trim());
  return { ok:true };
}
function getGrupsSheetId(ss) {
  return { ok:true, id: _resolGrupsId(ss) };
}
const MATERIA_NOM = {
  general:'General', matematiques:'Matemàtiques', catala:'Català',
  medi:'Medi Natural', musica:'Música', angles:'Anglès', carpeta:'Carpeta Viatgera'
};
const MATERIES_AMB_CARPETA = ['matematiques','catala','medi'];
const COL_OBS      = 'Observacions';
const NUM_TRIMS    = 3;
const CARPETA_NOTE = '10|2|carpeta_ref';
const DATA_ROW     = 4; // files 1-3 capçaleres; dades des d'aquí

// Nom de la pestanya de notes. Si hi ha grup, s'hi afegeix el sufix
// perquè cada assignatura+grup tingui la seva pestanya independent.
// Retrocompatible: sense grup, manté el nom antic (1T_Matemàtiques).
function _notesTabName(trimestre, nomBase, grup) {
  if (grup && grup.toString().trim()) return trimestre + 'T_' + nomBase + '_' + grup.toString().trim();
  return trimestre + 'T_' + nomBase;
}

function doGet(e) {
  // Pàgina pública per reservar hora (?r=<id>). No demana token: la
  // clau és l'enllaç mateix, i qui reserva no té ni app ni token.
  var r = e && e.parameter && e.parameter.r;
  if (r) {
    return HtmlService.createHtmlOutput(_reuPaginaHtml_(r))
      .setTitle('Reservar hora')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }
  return handleRequest(e);
}
function doPost(e) { return handleRequest(e); }

function handleRequest(e) {
  try {
    var body, action;
    if (e.postData && e.postData.contents) { body = JSON.parse(e.postData.contents); action = body.action; }
    else action = e.parameter.action;
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var p  = e.parameter; // shortcut per paràmetres GET

    // --- Comprovació del token de seguretat ---
    // L'app envia el token a body.token (POST) o p.token (GET).
    // Si el token està definit i no coincideix, es rebutja la petició.
    var tokenConfig = _appToken();
    if (tokenConfig && tokenConfig.trim()) {
      var tokenRebut = (body && body.token) || p.token || '';
      if (tokenRebut !== tokenConfig) {
        return ContentService
          .createTextOutput(JSON.stringify({ ok:false, error:'No autoritzat', _authError:true }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }

    var result;
    switch (action) {
      case 'getAlumnes':           result = getAlumnes(ss); break;
      case 'getMainData':          result = getMainData(ss); break;
      case 'reunionsLlista':      result = reunionsLlista(ss); break;
      case 'reunionsMissatge':    result = reunionsMissatge(ss, (body&&body.calId)||p.calId, (body&&body.missatge)||''); break;
      case 'reunionsPreview':     result = reunionsPreview(ss, (body&&body.dades)||{}); break;
      case 'reunionsTreuHora':    result = reunionsTreuHora(ss, (body&&body.calId)||p.calId, (body&&body.slotId)||p.slotId); break;
      case 'reunionsAfegeixHores':result = reunionsAfegeixHores(ss, (body&&body.calId)||p.calId, (body&&body.hores)||[]); break;
      case 'reunionsCrea':        result = reunionsCrea(ss, (body&&body.dades)||{}); break;
      case 'reunionsAllibera':    result = reunionsAllibera(ss, (body&&body.calId)||p.calId, (body&&body.slotId)||p.slotId); break;
      case 'reunionsReintenta':   result = reunionsReintenta(ss, (body&&body.calId)||p.calId, (body&&body.slotId)||p.slotId); break;
      case 'reunionsActiva':      result = reunionsActiva(ss, (body&&body.calId)||p.calId, !!(body&&body.actiu)); break;
      case 'reunionsEsborra':     result = reunionsEsborra(ss, (body&&body.calId)||p.calId); break;
      case 'bootstrap':            result = bootstrap(ss, parseWeekIds((body&&body.weekIds)||p.weekIds)); break;
      case 'setAlumnes':           result = setAlumnes(ss, body.alumnes); break;
      case 'getPersonal':          result = getPersonal(ss, (body&&body.studentId)||p.studentId); break;
      case 'getAllPersonal':       result = getAllPersonal(ss); break;
      case 'savePersonal':         result = savePersonal(ss, body.studentId, body.dades); break;
      case 'syncAlumnesARegistre': result = syncAlumnesARegistre(ss, body.alumnes, body.grup); break;
      case 'getRegistre':          result = getRegistre(ss, (body&&body.grup)||p.grup); break;
      case 'addRegistreItem':      result = addRegistreItem(ss, body.item, body.alumnes, body.grup); break;
      case 'deleteRegistreItem':   result = deleteRegistreItem(ss, body.itemId, body.grup); break;
      case 'updateRegistreCell':   result = updateRegistreCell(ss, body.itemId, body.studentId, body.value, body.grup); break;
      case 'getObservacions':      result = getObservacions(ss); break;
      case 'saveObservacio':       result = saveObservacio(ss, body.studentId, body.materia, body.trimestre, body.text, body.replace||false); break;
      case 'deleteObservacio':     result = deleteObservacio(ss, body.studentId, body.materia, body.trimestre); break;
      case 'getNotes':             result = getNotes(ss, body&&body.materia||p.materia, body&&body.trimestre||p.trimestre, body&&body.grup||p.grup); break;
      case 'loadEntrevistes':    result = loadEntrevistes(ss, (body&&body.grup)||p.grup); break;
      case 'saveEntrevista':     result = saveEntrevista(ss, body.grup, body.rowId, body.entrevista); break;
      case 'deleteEntrevista':   result = deleteEntrevista(ss, body.grup, body.rowId, body.id); break;
      case 'getEntrevistesPub':  result = getEntrevistesPub(ss, (body&&body.grup)||p.grup); break;
      case 'loadEsmorzars':      result = loadEsmorzars(ss); break;
      case 'saveEsmorzars':      result = saveEsmorzars(ss, body && body.registres, body && body.torns, body && body.equip); break;
      case 'enviaAvisEsmorzar':  result = enviaAvisEsmorzar(ss, body && body.tornId); break;
      case 'resumEntrevistes':   result = resumEntrevistes(ss); break;
      case 'loadRegistreDocents': result = loadRegistreDocents(ss); break;
      case 'saveRegistreDocents': result = saveRegistreDocents(ss, body && body.items, body && body.data); break;
      case 'getNotesCompartides':  result = getNotesCompartides(ss, (body&&body.grup)||p.grup); break;
      case 'loadCompartirNotes':   result = loadCompartirNotes(ss, (body&&body.grup)||p.grup, (body&&body.matKey)||p.matKey); break;
      case 'saveCompartirNotes':   result = saveCompartirNotes(ss, body.grup, body.matKey, body.nomAssig, body.nomMestra, !!body.compartir); break;
      case 'publicaNotesResum':    result = publicaNotesResum(ss, body.grup, body.matKey, body.nomAssig, body.nomMestra); break;
      case 'getNotesResum':        result = getNotesResum(ss, (body&&body.grup)||p.grup); break;
      case 'addNotaItem':          result = addNotaItem(ss, body.materia, body.trimestre, body.item, body.alumnes, body.grup); break;
      case 'deleteNotaItem':       result = deleteNotaItem(ss, body.materia, body.trimestre, body.itemId, body.grup); break;
      case 'updateNota':           result = updateNota(ss, body.materia, body.trimestre, body.itemId, body.studentId, body.punts, body.grup, body.nom); break;
      case 'setNoEntregat':        result = setNoEntregat(ss, body.materia, body.trimestre, body.itemId, body.studentId, body.valor, body.grup, body.nom); break;
      case 'updateActitud':         result = updateActitud(ss, body.materia, body.trimestre, body.studentId, body.mitja); break;
      case 'updateActitudBatch':    result = updateActitudBatch(ss, body.materia, body.trimestre, body.mitjanes); break;
      case 'syncAssoliments':        result = syncAssoliments(ss, body.trimestre, body.data); break;

      // Planning
      case 'savePlanning':           result = savePlanning(ss, body.weekId, body.data); break;
      case 'loadPlanning':           result = loadPlanning(ss, (body&&body.weekId)||p.weekId); break;
      case 'saveSeients':            result = saveSeients(ss, body.layout, body.history, body.markers, (body&&body.grup)||p.grup); break;
      case 'loadSeients':            result = loadSeients(ss, (body&&body.grup) || p.grup); break;
      case 'savePostits':            result = savePostits(ss, body.postits); break;
      case 'loadPostits':            result = loadPostits(ss); break;
      case 'saveHorari':             result = saveHorari(ss, body.horari); break;
      case 'loadHorari':             result = loadHorari(ss); break;
      case 'saveHorariAssigs':       result = saveHorariAssigs(ss, body.assigs); break;
      case 'loadHorariAssigs':       result = loadHorariAssigs(ss); break;
      case 'aplicarHorariPlanning':  result = aplicarHorariPlanning(ss, body.horari, body.weekIds); break;
      case 'gemini':                 result = geminiGenerate(body && body.prompt, body && body.contents); break;
      case 'saveProfile':            result = saveProfile(ss, body.profile); break;
      case 'loadProfile':            result = loadProfile(ss); break;
      case 'setupGrups':             result = setupGrups(getGrupsSpreadsheet(ss) || ss); break;
      case 'grupsSincronitza':       result = grupsSincronitza(ss, !!(body && body.prova)); break;
      case 'grupsSyncEstat':         result = grupsSyncEstat(ss); break;
      case 'getGrupAlumnes':         result = _withGrups(ss, function(gss){ return getGrupAlumnes(gss, (body&&body.grup) || p.grup); }); break;
      case 'saveGrupPersonal':       result = _withGrups(ss, function(gss){ return saveGrupPersonal(gss, body.grup, body.rowId, body.dades); }); break;
      case 'saveGrupGenere':         result = _withGrups(ss, function(gss){ return saveGrupGenere(gss, body.grup, body.rowId, body.genere); }); break;
      case 'saveGrupsSheetId':       result = saveGrupsSheetId(ss, body.id); break;
      case 'getGrupsSheetId':        result = getGrupsSheetId(ss); break;
      case 'diagGrups':              result = diagGrups(ss); break;
      case 'protegirFulls':          result = protegirTotsElsFullsDeCalcul(ss); break;
      case 'ajustarColumnes':        result = autoAjustaTotsElsFulls(ss); break;
      case 'getMainSheetId':         result = { ok:true, id: ss.getId() }; break;
      case 'saveDesdobSheetId':      result = saveDesdobSheetId(ss, body.id); break;
      case 'getDesdobSheetId':       result = getDesdobSheetId(ss); break;
      case 'getDesdoblament':        result = getDesdoblament(ss, (body&&body.curs) || p.curs, (body&&body.linia) || p.linia, (body&&body.assignatura) || p.assignatura); break;
      case 'getDesdobGrups':         result = getDesdobGrups(ss, (body&&body.curs) || p.curs, (body&&body.assignatura) || p.assignatura); break;
      case 'getDesdobGrup':          result = getDesdobGrup(ss, (body&&body.curs) || p.curs, (body&&body.assignatura) || p.assignatura, (body&&body.grup) || p.grup); break;
      case 'getGrupObs':             result = getGrupObs(ss, (body&&body.grup) || p.grup); break;
      case 'saveGrupObs':            result = saveGrupObs(ss, body.grup, body.rowId, body.materia, body.text); break;

      // Tasques
      case 'saveTasques':            result = saveTasques(ss, body.data); break;
      case 'loadTasques':            result = loadTasques(ss); break;

      // Calendari
      case 'saveCalendari':          result = saveCalendari(ss, body.year, body.data); break;
      case 'loadCalendari':          result = loadCalendari(ss, (body&&body.year)||p.year); break;
      case 'saveCalendariCats':      result = saveCalendariCats(ss, body.data); break;
      case 'loadCalendariCats':      result = loadCalendariCats(ss); break;

      // Assoliments (objectius + avaluacions)
      case 'saveAssimObjectius':     result = saveAssimObjectius(ss, body.materia, body.trimestre, body.data); break;
      case 'loadAssimObjectius':     result = loadAssimObjectius(ss, (body&&body.materia)||p.materia, (body&&body.trimestre)||p.trimestre); break;
      case 'saveAssimValors':        result = saveAssimValors(ss, body.materia, body.trimestre, body.data); break;
      case 'loadAssimValors':        result = loadAssimValors(ss, (body&&body.materia)||p.materia, (body&&body.trimestre)||p.trimestre); break;

      // Actitud
      case 'saveActitud':            result = saveActitudData(ss, body.materia, body.trimestre, body.data); break;
      case 'loadActitud':            result = loadActitudData(ss, (body&&body.materia)||p.materia, (body&&body.trimestre)||p.trimestre); break;
      case 'loadAppData':            result = loadAppData(ss, parseWeekIds((body&&body.weekIds)||p.weekIds)); break;
      case 'getGCalEvents':          result = getGoogleCalendarEvents(parseInt((body&&body.year)||p.year), parseInt((body&&body.month)||p.month)); break;
      case 'completaGoogleTask': result = completaGoogleTask((body&&body.taskId)||p.taskId, (body&&body.llistaId)||p.llistaId, (body&&body.fet)); break;
      case 'getGoogleTasks':         result = getGoogleTasks(); break;
      case 'gwriteSync':             result = gwriteSync(body && body.canvis); break;
      case 'saveNotaComentari':      result = saveNotaComentari(ss, (body&&body.materia)||p.materia, (body&&body.trimestre)||p.trimestre, body&&body.itemId, body&&body.nom, body&&body.text, (body&&body.grup)||p.grup); break;
      case 'saveRubrica':           result = saveRubrica(ss, (body&&body.materia)||p.materia, body&&body.data); break;
      case 'loadRubrica':           result = loadRubrica(ss, (body&&body.materia)||p.materia); break;
      case 'saveActitudAspectes':   result = saveActitudAspectes(ss, body&&body.data); break;
      case 'loadActitudAspectes':   result = loadActitudAspectes(ss); break;
      case 'saveComentEstil':       result = saveComentEstil(ss, body&&body.data); break;
      case 'loadComentEstil':       result = loadComentEstil(ss); break;
      default: result = { ok:false, error:'Accio desconeguda: '+action };
    }
    return jsonResponse(result);
  } catch(err) { return jsonResponse({ ok:false, error:err.message }); }
}

/* ============================================================
   ALUMNES
   ============================================================ */
/* Retorna alumnes + registre + observacions + personal en UNA sola crida
   (evita 4 crides separades a l'arrencada → molt més ràpid) */
function getMainData(ss) {
  return {
    ok: true,
    alumnes:      getAlumnes(ss).alumnes,
    registre:     getRegistre(ss),
    observacions: getObservacions(ss).observacions,
    personal:     getAllPersonal(ss).personal,
  };
}

function getAlumnes(ss) {
  var sh = getOrCreateAlumnesSheet(ss), lr = sh.getLastRow();
  if (lr < 2) return { ok:true, alumnes:[] };
  var lc = Math.max(sh.getLastColumn(), 7);
  var rows = sh.getRange(2, 1, lr-1, lc).getValues();
  var alumnes = [], idx = 0;
  rows.forEach(function(r, i){
    var nom = (r[0]||'').toString().trim();
    if (!nom) return;
    var g = (r[6]||'').toString().trim().toLowerCase().charAt(0); // col G = gènere
    alumnes.push({
      id:    idx,
      rowId: i+2,
      nom:   nom,
      genere: g === 'f' ? 'f' : 'm'
    });
    idx++;
  });
  return { ok:true, alumnes:alumnes };
}

/* ============================================================
   FULL CENTRALITZAT PER GRUPS (nou model multi-mestre)
   ============================================================ */

// Crea (si no existeixen) les 18 pestanyes de grup amb les capçaleres correctes.
// Executa-ho un cop des de l'editor d'Apps Script o via l'app.
/* ============================================================
   PROTECCIÓ DE FULLS (avís en editar manualment)
   Aplica una protecció "d'avís": qualsevol persona que editi el full
   manualment veu un pop-up de confirmació, però l'Apps Script (l'app)
   hi escriu sense cap interrupció.
   ============================================================ */

// Protegeix un full concret amb avís (idempotent: no en crea de duplicades)
function _protegirFull(sheet) {
  if (!sheet) return;
  try {
    var proteccions = sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET);
    var ja = null;
    for (var i = 0; i < proteccions.length; i++) {
      if (proteccions[i].isWarningOnly()) { ja = proteccions[i]; break; }
    }
    if (ja) return; // ja té protecció d'avís
    var p = sheet.protect().setDescription('Protegit per l\'app de gestió de curs');
    p.setWarningOnly(true); // avís en editar, però l'app hi pot escriure
  } catch(e) { /* silenciós: si falla la protecció, no bloqueja l'app */ }
}

// Protegeix TOTS els fulls d'un full de càlcul
function protegirTotsElsFulls(ss) {
  if (!ss) return { ok:false, error:'Sense full de càlcul' };
  var n = 0;
  ss.getSheets().forEach(function(sh) { _protegirFull(sh); n++; });
  return { ok:true, protegits:n };
}

// Protegeix tots els fulls de TOTS els fulls de càlcul que usa l'app
// (personal, Grups i Desdoblaments). Es pot cridar des del menú de config.
function protegirTotsElsFullsDeCalcul(ss) {
  var res = { ok:true, personal:0, grups:0, desdob:0 };
  try { res.personal = protegirTotsElsFulls(ss).protegits || 0; } catch(e) {}
  try {
    var gss = getGrupsSpreadsheet(ss);
    if (gss) res.grups = protegirTotsElsFulls(gss).protegits || 0;
  } catch(e) {}
  try {
    var dss = getDesdobSpreadsheet(ss);
    if (dss) res.desdob = protegirTotsElsFulls(dss).protegits || 0;
  } catch(e) {}
  return res;
}

// Ajusta l'amplada de totes les columnes amb contingut al seu contingut
// (evita textos tallats). Silenciós si falla.
// Ajusta les columnes de tots els fulls de grups i del registre personal.
// Es pot cridar des de l'app per posar-ho tot al dia d'una vegada.
function autoAjustaTotsElsFulls(ss) {
  var n = 0;
  // Full personal: registre
  try {
    var reg = ss.getSheetByName(TABS.registre);
    if (reg) { _autoAjustaColumnes(reg); n++; }
  } catch(e) {}
  // Fulls de grups (full extern)
  try {
    var gss = getGrupsSpreadsheet(ss);
    if (gss) {
      GRUPS_PRIMARIA.forEach(function(nom) {
        var sh = gss.getSheetByName(nom);
        if (sh) { _autoAjustaColumnes(sh); n++; }
      });
    }
  } catch(e) {}
  return { ok:true, ajustats:n };
}

function _autoAjustaColumnes(sheet) {
  if (!sheet) return;
  try {
    var lc = sheet.getLastColumn();
    if (lc > 0) sheet.autoResizeColumns(1, lc);
  } catch(e) { /* silenciós */ }
}

function setupGrups(ss) {
  var creats = [];
  GRUPS_PRIMARIA.forEach(function(nom) {
    var sh = ss.getSheetByName(nom);
    if (!sh) {
      sh = ss.insertSheet(nom);
      _protegirFull(sh);
      sh.getRange(1, 1, 1, GRUP_HEADERS.length).setValues([GRUP_HEADERS])
        .setFontWeight('bold').setBackground('#FBEAED').setFontColor('#7A1E2E');
      sh.setFrozenRows(1);
      _autoAjustaColumnes(sh);
      creats.push(nom);
    }
  });
  return { ok:true, creats:creats, total:GRUPS_PRIMARIA.length };
}

// Llegeix els alumnes d'un grup concret (pestanya). Combina Nom+Cognom.
// Normalitza un nom de grup per comparar (treu accents, espais de més, minúscules)
function _normGrupNom(s) {
  if (!s) return '';
  return s.toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

function getGrupAlumnes(ss, grup) {
  var sh = ss.getSheetByName(grup);
  if (!sh) {
    // Cerca tolerant: normalitza noms (espais, majúscules, accents)
    var target = _normGrupNom(grup);
    var found = null;
    ss.getSheets().forEach(function(s){
      if (!found && _normGrupNom(s.getName()) === target) found = s;
    });
    if (found) sh = found;
  }
  if (!sh) {
    var totes = ss.getSheets().map(function(s){ return s.getName(); });
    return { ok:true, alumnes:[], grup:grup, existeix:false,
             debug:'Buscava "'+grup+'" al full "'+ss.getName()+'". Disponibles: '+totes.join(', ') };
  }
  var lr = sh.getLastRow();
  if (lr < 2) return { ok:true, alumnes:[], grup:grup, existeix:true };
  var lc = Math.max(sh.getLastColumn(), GRUP_HEADERS.length);
  var rows = sh.getRange(2, 1, lr-1, lc).getValues();

  // Mapa fila→codi, muntat amb les files que ja hem hagut de llegir. Es deixa
  // al record perquè les observacions i les entrevistes no el tornin a
  // demanar: si no, cada arrencada tornava a llegir tot el grup.
  var mapaUids = { perFila: {}, perUid: {} };
  rows.forEach(function (r, i) {
    var u = String(r[COL_UID - 1] || '').trim();
    if (u) { mapaUids.perFila[i + 2] = u; mapaUids.perUid[u] = i + 2; }
  });
  try { _mapaUidsCache[(ss.getId ? ss.getId() : 'x') + '|' + grup] = mapaUids; } catch (e) {}

  var alumnes = [], idx = 0;
  rows.forEach(function(r, i){
    var nom = (r[0]||'').toString().trim();
    var cognom = (r[1]||'').toString().trim();
    if (!nom && !cognom) return;
    var nomComplet = (nom + ' ' + cognom).trim();
    var g = (r[8]||'').toString().trim().toLowerCase().charAt(0); // col I = gènere
    // Data naixement (col C)
    var dn = r[2];
    var dataNaix = '';
    if (dn instanceof Date) {
      dataNaix = dn.getFullYear() + '-' + ('0'+(dn.getMonth()+1)).slice(-2) + '-' + ('0'+dn.getDate()).slice(-2);
    } else if (dn) {
      dataNaix = dn.toString();
    }
    alumnes.push({
      id: idx,
      // El que viatja com a "rowId" és EL CODI de l'alumne, que no canvia
      // mai. Si encara no en té (abans de la migració), s'hi posa la fila
      // i tot funciona com sempre: el pont accepta les dues coses.
      rowId: String(r[COL_UID - 1] || '').trim() || (i + 2),
      fila: i + 2,                                 // la fila de debò, per si cal
      uid: String(r[COL_UID - 1] || '').trim(),
      nom: nomComplet,
      nomPila: nom,
      cognom: cognom,
      dataNaix: dataNaix,
      genere: g === 'f' ? 'f' : 'm',
      mare: r[3]||'', pare: r[4]||'',
      emailMare: r[5]||'', emailPare: r[6]||'',
      obs: r[7]||'',
      pi: r[9]||'', am: r[10]||'', especific: r[11]||'', eap: r[12]||'',
      seient: (function(){
        try {
          var o = r[13] ? JSON.parse(r[13]) : null;
          // noAmb apunta a ALTRES alumnes. Si hi ha files antigues, es
          // tradueixen al codi, que és el que el navegador comparara.
          if (o && o.noAmb && o.noAmb.length) {
            o.noAmb = o.noAmb.map(function (x) {
              return (/^\d+$/.test(String(x)) && mapaUids.perFila[String(x)]) ? mapaUids.perFila[String(x)] : x;
            });
          }
          return o;
        } catch(e){ return null; }
      })()
    });
    idx++;
  });
  return { ok:true, alumnes:alumnes, grup:grup, existeix:true };
}

// Desa les dades personals (PI/AM/específic/família/obs) d'un alumne d'un grup
function saveGrupPersonal(ss, grup, rowId, d) {
  var sh = ss.getSheetByName(grup);
  if (!sh) return { ok:false, error:'Grup no trobat: ' + grup };
  var row = _filaDeClau_(ss, grup, rowId);
  if (row < 2) return { ok:false, error:'No trobo aquest alumne al grup ' + grup };
  // Cols D-H: mare, pare, emailMare, emailPare, obs (índexs 4-8)
  sh.getRange(row, 4, 1, 5).setValues([[d.mare||'', d.pare||'', d.emailMare||'', d.emailPare||'', d.obs||'']]);
  // Cols J-L: PI, AM, específic (índexs 10-12) — no toquem I (gènere)
  sh.getRange(row, 10, 1, 3).setValues([[d.pi||'', d.am||'', d.especific||'']]);
  // Col M: Informe EAP (índex 13)
  sh.getRange(row, 13).setValue(d.eap||'');
  // Col N: Condicions de seient (JSON, índex 14)
  sh.getRange(row, 14).setValue(d.seient ? JSON.stringify(d.seient) : '');
  _autoAjustaColumnes(sh);
  return { ok:true };
}

// Desa el gènere d'un alumne al full "Grups" (columna I = índex 9)
function saveGrupGenere(ss, grup, rowId, genere) {
  var sh = ss.getSheetByName(grup);
  if (!sh) {
    // cerca tolerant
    var target = _normGrupNom(grup), found = null;
    ss.getSheets().forEach(function(s){ if (!found && _normGrupNom(s.getName()) === target) found = s; });
    sh = found;
  }
  if (!sh) return { ok:false, error:'Grup no trobat: ' + grup };
  var row = _filaDeClau_(ss, grup, rowId);
  if (row < 2) return { ok:false, error:'No trobo aquest alumne al grup ' + grup };
  sh.getRange(row, 9).setValue(genere === 'f' ? 'F' : 'M');
  return { ok:true };
}

/* ============================================================
   DESDOBLAMENTS (full extern, només lectura)
   Llegeix quins alumnes es queden a cada classe en una
   assignatura desdoblada, i els fa coincidir amb el full "grups".
   ============================================================ */

// Full de desdoblaments extern. ID desat amb clau 'desdob_sheet_id'.
function getDesdobSpreadsheet(ss) {
  var id = _resolDesdobId(ss);
  if (!id) return null;
  try { return SpreadsheetApp.openById(id); } catch(e) { return null; }
}
function saveDesdobSheetId(ss, id) {
  sheetSetJSON(ss, '_AppData', 'desdob_sheet_id', (id||'').toString().trim());
  return { ok:true };
}
function getDesdobSheetId(ss) {
  return { ok:true, id: _resolDesdobId(ss) };
}

// --- Normalització de noms (treu accents, aclariments, parteix nom+inicial) ---
function _normNom(s) {
  if (!s) return '';
  s = s.toString();
  s = s.replace(/\([^)]*\)/g, '');           // treu (possible baixa)
  s = s.replace(/[*⭐⚠]/g, '');
  // insereix espai entre minúscula i majúscula enganxades (PaulaM → Paula M)
  s = s.replace(/([a-zàèéíòóúçñ])([A-ZÀÈÉÍÒÓÚÇÑ])/g, '$1 $2');
  // treu accents
  s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  s = s.toLowerCase().replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
  return s;
}
function _tokens(s) {
  var n = _normNom(s);
  if (!n) return [];
  return n.split(' ').filter(function(t){ return t.length > 0; });
}

// Fa coincidir un nom (qualsevol format) amb un alumne de la llista.
// Usa la inicial del cognom per desambiguar noms de pila repetits (Paula M / Paula N).
function _matchAlumne(nomDesdob, alumnesTokens) {
  var td = _tokens(nomDesdob);
  if (!td.length) return null;
  var best = null, bestScore = 0;
  for (var i = 0; i < alumnesTokens.length; i++) {
    var at = alumnesTokens[i].tokens;
    var score = 0, comuns = 0, totsHi = true;
    for (var j = 0; j < td.length; j++) {
      var t = td[j];
      if (at.indexOf(t) !== -1) { comuns++; score += 5; }
      else if (t.length === 1) {
        // token d'inicial: mira si algun token del grup comença per aquesta lletra
        var trobatInicial = false;
        for (var m = 0; m < at.length; m++) {
          if (at[m].charAt(0) === t) { score += 3; trobatInicial = true; break; }
        }
        if (!trobatInicial) totsHi = false;
      } else { totsHi = false; }
    }
    if (comuns === 0) continue;
    if (totsHi) score += 10;
    if (score > bestScore) { bestScore = score; best = alumnesTokens[i].ref; }
  }
  return best;
}

// Mapa curs → pestanya de desdoblaments
function _desdobTabName(curs) {
  // curs: '2n' → 'Desdoblaments 2n (26-27)'
  return 'Desdoblaments ' + curs + ' (26-27)';
}

// Llegeix la llista d'alumnes que ES QUEDEN a un grup en una assignatura desdoblada.
// Params: curs ('2n'), linia ('C'), assignatura ('Matemàtiques').
// Retorna { ok, alumnes:[...], bloc, trobat }.
function getDesdoblament(ss, curs, linia, assignatura) {
  // Cache de 6h (el desdoblament no canvia sovint). Clau per curs+linia+assignatura.
  var cacheKey = 'desdob_' + curs + '_' + linia + '_' + assignatura;
  try {
    var cached = CacheService.getScriptCache().get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch(e) {}

  var res = _getDesdoblamentRaw(ss, curs, linia, assignatura);
  try { CacheService.getScriptCache().put(cacheKey, JSON.stringify(res), 21600); } catch(e) {}
  return res;
}

function _getDesdoblamentRaw(ss, curs, linia, assignatura) {
  var dss = getDesdobSpreadsheet(ss);
  if (!dss) return { ok:true, existeix:false, alumnes:[], motiu:'Sense full de desdoblaments' };
  var sh = dss.getSheetByName(_desdobTabName(curs));
  if (!sh) return { ok:true, existeix:false, alumnes:[], motiu:'Sense pestanya per a ' + curs };

  var rng = sh.getDataRange().getValues();
  if (!rng.length) return { ok:true, existeix:true, alumnes:[], motiu:'Pestanya buida' };

  // 1) Troba la fila de títols de bloc i la de capçaleres de columna
  var titolRow = -1, headerRow = -1;
  var KEYWORDS = ['MATES','CATALÀ','ANGLÈS','TALLERS','PACBAL','AMBIENTS','PRÀCTICUM','CASTELLÀ','MEDI'];
  for (var i = 0; i < rng.length; i++) {
    var joined = rng[i].map(function(c){ return (c||'').toString().toUpperCase(); }).join(' ');
    if (titolRow === -1) {
      for (var k = 0; k < KEYWORDS.length; k++) {
        if (joined.indexOf(KEYWORDS[k]) !== -1) { titolRow = i; break; }
      }
    }
    if (joined.toLowerCase().indexOf('desdoblament') !== -1) { headerRow = i; break; }
  }
  if (titolRow === -1 || headerRow === -1) return { ok:true, existeix:true, alumnes:[], motiu:'No trobo els blocs' };

  // 2) Troba la columna del bloc que conté l'assignatura demanada
  var assigNorm = _normNom(assignatura);
  var titols = rng[titolRow];
  var blocStartCol = -1, blocTitol = '';
  for (var c = 0; c < titols.length; c++) {
    var t = (titols[c]||'').toString();
    if (!t) continue;
    var tn = _normNom(t);
    // el bloc conté l'assignatura si algun mot de l'assignatura hi apareix
    if (tn.indexOf(assigNorm) !== -1 || _blocConteAssig(tn, assigNorm)) {
      blocStartCol = c; blocTitol = t; break;
    }
  }
  if (blocStartCol === -1) return { ok:true, existeix:true, alumnes:[], motiu:'Cap bloc per a ' + assignatura, sensDesdob:true };

  // 3) Dins del bloc, troba la columna de la línia demanada (p. ex. "4t B")
  var grupBuscat = _normNom(curs + ' ' + linia);
  var headers = rng[headerRow];
  var colLinia = -1, colEnd = headers.length;
  // El bloc va de blocStartCol fins al següent títol de bloc
  var nextBloc = headers.length;
  for (var c2 = blocStartCol+1; c2 < titols.length; c2++) {
    if ((titols[c2]||'').toString().trim()) { nextBloc = c2; break; }
  }
  for (var c3 = blocStartCol; c3 < nextBloc; c3++) {
    if (_normNom((headers[c3]||'').toString()) === grupBuscat) { colLinia = c3; break; }
  }
  if (colLinia === -1) return { ok:true, existeix:true, alumnes:[], motiu:'El bloc no té columna ' + curs + ' ' + linia, bloc:blocTitol, sensDesdob:true };

  // 4) Llegeix els noms de la columna (des de headerRow+1 fins al final)
  var nomsQueden = [];
  for (var r = headerRow+1; r < rng.length; r++) {
    var v = (rng[r][colLinia]||'').toString().trim();
    if (v) nomsQueden.push(v);
  }

  // 5) Match amb els alumnes reals del grup (full "grups")
  var gss = getGrupsSpreadsheet(ss) || ss;
  var grupData = getGrupAlumnes(gss, curs + ' ' + linia);
  var alumnesTokens = (grupData.alumnes||[]).map(function(a){
    return { ref:a, tokens:_tokens(a.nom) };
  });

  var resultat = [], noTrobats = [];
  nomsQueden.forEach(function(nom){
    var m = _matchAlumne(nom, alumnesTokens);
    if (m) resultat.push(m);
    else noTrobats.push(nom);
  });

  return {
    ok:true, existeix:true, bloc:blocTitol,
    alumnes:resultat, noTrobats:noTrobats,
    total:nomsQueden.length, trobats:resultat.length
  };
}

/* ---- Grups de desdoblament ROTATORIS (p. ex. Tallers 3r) ----
   A diferència de getDesdoblament (que filtra UNA classe), aquí un grup pot
   barrejar alumnes de diverses classes del curs (A/B/C). S'agafa la columna
   del grup demanat i es busquen els noms a TOTES les classes del curs. */

// Localitza el bloc d'una assignatura dins d'una pestanya de desdoblaments.
// Retorna { titolRow, headerRow, blocStartCol, nextBloc } o null.
function _desdobLocalitzaBloc(rng, assig) {
  var titolRow = -1, headerRow = -1;
  var KEYWORDS = ['MATES','CATALÀ','ANGLÈS','TALLERS','PACBAL','AMBIENTS','PRÀCTICUM','PRACTICUM','CASTELLÀ','MEDI','LECTURA'];
  for (var i = 0; i < rng.length; i++) {
    var joined = rng[i].map(function(c){ return (c||'').toString().toUpperCase(); }).join(' ');
    if (titolRow === -1) {
      for (var k = 0; k < KEYWORDS.length; k++) {
        if (joined.indexOf(KEYWORDS[k]) !== -1) { titolRow = i; break; }
      }
    }
    if (joined.toLowerCase().indexOf('desdoblament') !== -1) { headerRow = i; break; }
  }
  if (titolRow === -1 || headerRow === -1) return null;
  var assigNorm = _normNom(assig);
  var titols = rng[titolRow];
  var headers = rng[headerRow];
  // 1) Columna on hi ha el TÍTOL del bloc que conté l'assignatura
  var titleCol = -1;
  for (var c = 0; c < titols.length; c++) {
    var t = (titols[c]||'').toString();
    if (!t) continue;
    var tn = _normNom(t);
    if (tn.indexOf(assigNorm) !== -1 || _blocConteAssig(tn, assigNorm)) { titleCol = c; break; }
  }
  if (titleCol === -1) return null;
  // 2) El títol pot estar desalineat respecte les columnes de grup (p. ex.
  //    "MATES i PRÀCTICUM" una columna a la dreta del seu "3r A"). Ens situem
  //    a la capçalera de grup no buida més propera al títol...
  var pivot = titleCol;
  if (!(headers[pivot]||'').toString().trim()) {
    for (var d = 1; d <= 4; d++) {
      if ((headers[pivot+d]||'').toString().trim()) { pivot = pivot+d; break; }
      if (pivot-d >= 0 && (headers[pivot-d]||'').toString().trim()) { pivot = pivot-d; break; }
    }
  }
  // 3) ...i expandim a la RUN contigua de capçaleres no buides = columnes del bloc.
  //    (Els blocs estan separats per columnes de capçalera buides.)
  var colStart = pivot, colEnd = pivot;
  while (colStart-1 >= 0 && (headers[colStart-1]||'').toString().trim()) colStart--;
  while (colEnd+1 < headers.length && (headers[colEnd+1]||'').toString().trim()) colEnd++;
  return { titolRow: titolRow, headerRow: headerRow, blocStartCol: colStart, nextBloc: colEnd+1 };
}

// Treu decoracions del nom d'un grup per mostrar-lo net (⭐, *, ⚠…).
function _netejaGrupNom(s) {
  return (s||'').toString().replace(/[*⭐⚠]/g, '').replace(/\s+/g, ' ').trim();
}

// Llista els grups (columnes de capçalera) del bloc d'una assignatura.
// Params: curs ('3r'), assig ('Tallers'). Retorna { ok, grups:[...], bloc }.
function getDesdobGrups(ss, curs, assig) {
  var dss = getDesdobSpreadsheet(ss);
  if (!dss) return { ok:true, grups:[], motiu:'Sense full de desdoblaments' };
  var sh = dss.getSheetByName(_desdobTabName(curs));
  if (!sh) return { ok:true, grups:[], motiu:'Sense pestanya per a ' + curs };
  var rng = sh.getDataRange().getValues();
  if (!rng.length) return { ok:true, grups:[] };
  var loc = _desdobLocalitzaBloc(rng, assig);
  if (!loc) return { ok:true, grups:[], motiu:'No trobo el bloc de ' + assig };
  var headers = rng[loc.headerRow];
  var grups = [];
  for (var c = loc.blocStartCol; c < loc.nextBloc; c++) {
    var h = _netejaGrupNom(headers[c]);
    if (h) grups.push(h);
  }
  return { ok:true, grups:grups, bloc: _netejaGrupNom(rng[loc.titolRow][loc.blocStartCol]) };
}

// Alumnes d'un grup de desdoblament concret, buscats a TOTES les classes del curs.
// Params: curs ('3r'), assig ('Tallers'), grup (nom de columna: '3r A', 'Desdoblament'…).
// Retorna { ok, alumnes:[...registres complets...], noTrobats, total, trobats }.
function getDesdobGrup(ss, curs, assig, grup) {
  // Cache de 6 h (el desdoblament gairebé no canvia); estalvia openById + lectura
  // del full + 3 lectures de rosters a cada càrrega d'un grup rotatori.
  var cacheKey = 'desdobgrup_' + curs + '_' + assig + '_' + grup;
  try { var c = CacheService.getScriptCache().get(cacheKey); if (c) return JSON.parse(c); } catch(e) {}
  var res = _getDesdobGrupRaw(ss, curs, assig, grup);
  try { CacheService.getScriptCache().put(cacheKey, JSON.stringify(res), 21600); } catch(e) {}
  return res;
}
function _getDesdobGrupRaw(ss, curs, assig, grup) {
  var dss = getDesdobSpreadsheet(ss);
  if (!dss) return { ok:true, existeix:false, alumnes:[], motiu:'Sense full de desdoblaments' };
  var sh = dss.getSheetByName(_desdobTabName(curs));
  if (!sh) return { ok:true, existeix:false, alumnes:[], motiu:'Sense pestanya per a ' + curs };
  var rng = sh.getDataRange().getValues();
  if (!rng.length) return { ok:true, existeix:true, alumnes:[] };
  var loc = _desdobLocalitzaBloc(rng, assig);
  if (!loc) return { ok:true, existeix:true, alumnes:[], motiu:'No trobo el bloc de ' + assig };

  // Columna del grup demanat dins del bloc
  var grupNorm = _normNom(grup);
  var headers = rng[loc.headerRow];
  var colGrup = -1;
  for (var c = loc.blocStartCol; c < loc.nextBloc; c++) {
    if (_normNom((headers[c]||'').toString()) === grupNorm) { colGrup = c; break; }
  }
  if (colGrup === -1) return { ok:true, existeix:true, alumnes:[], motiu:'El bloc no té el grup ' + grup };

  // Noms escrits a la columna del grup
  var noms = [];
  for (var r = loc.headerRow+1; r < rng.length; r++) {
    var v = (rng[r][colGrup]||'').toString().trim();
    if (v) noms.push(v);
  }

  // Combina els rosters de totes les línies del curs, amb id global estable i únic
  var gss = getGrupsSpreadsheet(ss) || ss;
  var LINIES = ['A','B','C'];
  var tots = [];
  for (var li = 0; li < LINIES.length; li++) {
    var gd = getGrupAlumnes(gss, curs + ' ' + LINIES[li]);
    var arr = gd.alumnes || [];
    for (var a = 0; a < arr.length; a++) {
      var al = arr[a];
      al.grupOrigen = curs + ' ' + LINIES[li];
      al.id = (li + 1) * 1000 + (al.rowId || (a + 1)); // únic i estable entre sessions
      tots.push(al);
    }
  }
  var alumnesTokens = tots.map(function(a){ return { ref:a, tokens:_tokens(a.nom) }; });

  // Per cada nom del desdoblament: match FORT al full "Grups" (fitxa completa).
  // Si no es troba (o la classe encara no està plena), es crea un registre mínim
  // amb el nom, així la llista surt sencera igualment i s'hi poden posar notes.
  var usats = {};
  var resultat = [], sensePerfil = 0;
  for (var n = 0; n < noms.length; n++) {
    var nom = noms[n];
    var m = _matchAlumneFort(nom, alumnesTokens);
    if (m && !usats[m.id]) {
      usats[m.id] = true;
      resultat.push(m);
    } else {
      resultat.push({
        id: 'd_' + _normNom(nom).replace(/[^a-z0-9]/g, '') + '_' + n,
        nom: _netejaGrupNom(nom),
        nomPila: _netejaGrupNom(nom).split(' ')[0],
        genere: 'm',
        grupOrigen: null,
        senseFitxa: true
      });
      sensePerfil++;
    }
  }
  return { ok:true, existeix:true, grup:grup, alumnes:resultat, total:noms.length, trobats: resultat.length - sensePerfil, sensePerfil: sensePerfil };
}

// Com _matchAlumne però NOMÉS accepta coincidències FORTES (tots els mots hi són,
// o com a mínim 2 en comú). Evita fusionar noms diferents quan la classe està
// incompleta (p. ex. "Bruna Solà" no es confon amb "Bruna Olmos").
function _matchAlumneFort(nomDesdob, alumnesTokens) {
  var td = _tokens(nomDesdob);
  if (!td.length) return null;
  var best = null, bestScore = 0, bestTots = false, bestComuns = 0;
  for (var i = 0; i < alumnesTokens.length; i++) {
    var at = alumnesTokens[i].tokens;
    var score = 0, comuns = 0, totsHi = true;
    for (var j = 0; j < td.length; j++) {
      var t = td[j];
      if (at.indexOf(t) !== -1) { comuns++; score += 5; }
      else if (t.length === 1) {
        var trob = false;
        for (var m = 0; m < at.length; m++) { if (at[m].charAt(0) === t) { score += 3; trob = true; break; } }
        if (!trob) totsHi = false;
      } else { totsHi = false; }
    }
    if (comuns === 0) continue;
    if (totsHi) score += 10;
    if (score > bestScore) { bestScore = score; best = alumnesTokens[i].ref; bestTots = totsHi; bestComuns = comuns; }
  }
  if (best && (bestTots || bestComuns >= 2)) return best;
  return null;
}

// Comprova si un títol de bloc (normalitzat) conté l'assignatura.
// Gestiona títols compostos: "mates i tallers" conté "matematiques"?
function _blocConteAssig(titolNorm, assigNorm) {
  // equivalències bàsiques
  var equiv = {
    'matematiques': ['mates','matematiques','matematica'],
    'catala': ['catala'],
    'castella': ['castella'],
    'angles': ['angles'],
    'medi': ['medi'],
    'tallers': ['tallers'],
    'ambients': ['ambients'],
    'practicum': ['practicum']
  };
  var claus = equiv[assigNorm] || [assigNorm];
  for (var i = 0; i < claus.length; i++) {
    if (titolNorm.indexOf(claus[i]) !== -1) return true;
  }
  return false;
}

/* ============================================================
   OBSERVACIONS COMPARTIDES (al full "grups")
   Es desen al full ocult _AppData del full grups, amb clau
   'obs_{grup}'. Estructura: { rowId: { 'materia': text, ... } }
   Així qualsevol mestre que fa classe al grup les pot veure.
   ============================================================ */

function getGrupObs(ss, grup) {
  return _getGrupObsWith(getGrupsSpreadsheet(ss) || ss, grup);
}
// Variant que reutilitza un full "Grups" ja obert (evita reobrir-lo al bootstrap).
function _getGrupObsWith(gss, grup) {
  var v = sheetGetJSON(gss, '_AppData', 'obs_' + grup);
  var o = {};
  try { o = v ? JSON.parse(v) : {}; } catch (e) { o = {}; }
  return { ok:true, obs: _reclau_(gss, grup, o) };
}

function saveGrupObs(ss, grup, rowId, materia, text) {
  var gss = getGrupsSpreadsheet(ss) || ss;
  var v = sheetGetJSON(gss, '_AppData', 'obs_' + grup);
  var obs = v ? JSON.parse(v) : {};
  var key = rowId.toString();
  if (!obs[key]) obs[key] = {};
  if (text && text.toString().trim()) obs[key][materia] = text.toString().trim();
  else delete obs[key][materia];
  if (Object.keys(obs[key]).length === 0) delete obs[key];
  sheetSetJSON(gss, '_AppData', 'obs_' + grup, JSON.stringify(obs));
  return { ok:true };
}
function setAlumnes(ss, alumnes) {
  var sh = getOrCreateAlumnesSheet(ss), lr = sh.getLastRow();
  if (alumnes.length > 0) {
    // Col A = nom
    sh.getRange(2, 1, alumnes.length, 1).setValues(alumnes.map(function(a){ return [a.nom]; }));
    // Col G = gènere (només si l'alumne en porta; si no, manté el que hi havia)
    alumnes.forEach(function(a, i) {
      if (a.genere) sh.getRange(i+2, 7).setValue(a.genere === 'f' ? 'f' : 'm');
    });
  }
  var old = lr >= 2 ? lr-1 : 0;
  if (old > alumnes.length) sh.getRange(alumnes.length+2, 1, old-alumnes.length, 7).clearContent();
  return { ok:true };
}
/* Retorna totes les dades personals de cop (una crida per tota la classe) */
function getAllPersonal(ss) {
  var sh  = getOrCreateAlumnesSheet(ss);
  var lr  = sh.getLastRow();
  if (lr < 2) return { ok:true, personal:[] };
  var lc  = Math.max(sh.getLastColumn(), 10);
  var all = sh.getRange(2, 1, lr-1, lc).getValues();
  var result = [];
  var idx = 0;
  all.forEach(function(row, i) {
    var nom = (row[0]||'').toString().trim();
    if (!nom) return;
    result.push({
      id:    idx,
      rowId: i+2,
      mare:      row[1]||'',
      pare:      row[2]||'',
      emailMare: row[3]||'',
      emailPare: row[4]||'',
      obs:       row[5]||'',
      pi:        row[7]||'',
      am:        row[8]||'',
      especific: row[9]||'',
    });
    idx++;
  });
  return { ok:true, personal:result };
}

function getPersonal(ss, rowId) {
  var sh  = getOrCreateAlumnesSheet(ss);
  // rowId és el número de fila real al full Alumnes (2, 3, 4...)
  var row = parseInt(rowId);
  if (isNaN(row) || row < 2 || row > sh.getLastRow()) return { ok:true, dades:{} };
  var lc   = Math.max(sh.getLastColumn(), 10);
  var vals = sh.getRange(row, 1, 1, lc).getValues()[0];
  return { ok:true, dades:{
    mare:      vals[1]||'',
    pare:      vals[2]||'',
    emailMare: vals[3]||'',
    emailPare: vals[4]||'',
    obs:       vals[5]||'',
    pi:        vals[7]||'',   // col H: assignatures amb PI (o buit)
    am:        vals[8]||'',   // col I: assignatures amb AM (o buit)
    especific: vals[9]||'',   // col J: aspectes conductuals / necessitats
  }};
}
function savePersonal(ss, rowId, d) {
  var sh  = getOrCreateAlumnesSheet(ss);
  // rowId és el número de fila real al full Alumnes (2, 3, 4...)
  var row = parseInt(rowId);
  if (isNaN(row) || row < 2) return { ok:false, error:'Fila invalida: '+rowId };
  // Col B-F: dades de contacte i obs
  sh.getRange(row, 2, 1, 5).setValues([[d.mare||'',d.pare||'',d.emailMare||'',d.emailPare||'',d.obs||'']]);
  // Col H-J: PI, AM, aspectes específics (no toquem la G = gènere)
  sh.getRange(row, 8, 1, 3).setValues([[d.pi||'', d.am||'', d.especific||'']]);
  return { ok:true };
}

/* ============================================================
   REGISTRES
   ============================================================ */
function syncAlumnesARegistre(ss, alumnes, grup) {
  var sh = ss.getSheetByName(_nomFullRegistre(grup)); if (!sh) return { ok:true };
  var lr = sh.getLastRow();
  if (alumnes.length > 0) sh.getRange(2,1,alumnes.length,1).setValues(alumnes.map(function(a){return [a.nom];}));
  var old = lr >= 2 ? lr-1 : 0;
  if (old > alumnes.length) sh.getRange(alumnes.length+2,1,old-alumnes.length,1).clearContent();
  _autoAjustaColumnes(sh);
  return { ok:true };
}
function getRegistre(ss, grup) {
  var sh = ss.getSheetByName(_nomFullRegistre(grup));
  if (!sh) return { ok:true, items:[], data:{} };
  var lc = sh.getLastColumn(), lr = sh.getLastRow();
  if (lc < 2) return { ok:true, items:[], data:{} };
  var headers = sh.getRange(1,2,1,lc-1).getValues()[0];
  var notes   = sh.getRange(1,2,1,lc-1).getNotes()[0];
  // Lectura ÚNICA de tot el bloc de dades (evita N+1: abans es llegia columna a columna)
  var block = (lr >= 2) ? sh.getRange(2,2,lr-1,lc-1).getValues() : [];
  var items = [], data = {};
  headers.forEach(function(nom,idx) {
    if (!nom) return;
    var parts = (notes[idx]||'').split('|');
    var tipus = parts[0]||'checkbox', id = parseInt(parts[1])||(idx+1000);
    items.push({ id:id, nom:nom.toString(), tipus:tipus }); data[id] = {};
    for (var ri = 0; ri < block.length; ri++) {
      var v = block[ri][idx];
      data[id][ri] = tipus==='checkbox' ? (v===true) : (v ? v.toString() : '');
    }
  });
  return { ok:true, items:items, data:data };
}
function addRegistreItem(ss, item, alumnes, grup) {
  var sh = getOrCreateRegistreSheet(ss, alumnes, grup), nc = sh.getLastColumn()+1;
  var cell = sh.getRange(1,nc); cell.setValue(item.nom).setFontWeight('bold'); cell.setNote(item.tipus+'|'+item.id);
  if (alumnes && alumnes.length > 0) {
    var r = sh.getRange(2,nc,alumnes.length,1);
    item.tipus==='checkbox' ? r.insertCheckboxes() : r.setValues(alumnes.map(function(){return [''];}));
  }
  _autoAjustaColumnes(sh);
  return { ok:true };
}
function deleteRegistreItem(ss, itemId, grup) {
  var sh = ss.getSheetByName(_nomFullRegistre(grup)); if (!sh) return { ok:true };
  var lc = sh.getLastColumn(); if (lc < 2) return { ok:true };
  var notes = sh.getRange(1,2,1,lc-1).getNotes()[0];
  for (var i = notes.length-1; i >= 0; i--) if (parseInt((notes[i]||'').split('|')[1])===itemId) sh.deleteColumn(i+2);
  return { ok:true };
}
function updateRegistreCell(ss, itemId, studentId, value, grup) {
  var sh = ss.getSheetByName(_nomFullRegistre(grup)); if (!sh) return { ok:false, error:'no sheet' };
  var lc = sh.getLastColumn(); if (lc < 2) return { ok:true };
  var notes = sh.getRange(1,2,1,lc-1).getNotes()[0];
  var col = -1;
  notes.forEach(function(n,i){ if (parseInt((n||'').split('|')[1])===itemId) col=i+2; });
  if (col===-1) return { ok:false, error:'col not found' };
  sh.getRange(parseInt(studentId)+2, col).setValue(value);
  return { ok:true };
}

/* ============================================================
   OBSERVACIONS
   ============================================================ */
function getObservacions(ss) {
  var obs = {};
  // Les pestanyes possibles són 21 (3 trimestres × 7 assignatures) i la
  // majoria no existeixen. Demanar-les d'una en una amb getSheetByName eren
  // 21 preguntes a Google; amb getSheets() n'hi ha prou amb una i la resta
  // es mira en memòria.
  var perNom = {};
  ss.getSheets().forEach(function(s){ perNom[s.getName()] = s; });
  for (var t=1; t<=NUM_TRIMS; t++) {
    Object.keys(MATERIA_NOM).forEach(function(key) {
      var sh = perNom[t+'T_'+MATERIA_NOM[key]]; if (!sh) return;
      var oc = findObsColumn(sh); if (oc===-1) return;
      var lr = sh.getLastRow(); if (lr < DATA_ROW) return;
      sh.getRange(DATA_ROW,oc,lr-DATA_ROW+1,1).getValues().forEach(function(row,idx){
        var txt = (row[0]||'').toString().trim(); if (!txt) return;
        // Cada alumne ocupa 2 files; l'observació és a la superior (idx parell).
        // saveObservacio escriu a sid*2+DATA_ROW, així que sid = idx/2 (no idx).
        var sid = Math.floor(idx/2);
        if (!obs[sid]) obs[sid] = {};
        obs[sid][t+'_'+key] = txt;
      });
    });
  }
  return { ok:true, observacions:obs };
}
function saveObservacio(ss, sid, materia, trimestre, text, replace) {
  var nomBase = _materiaNomBase(materia); if (!nomBase) return { ok:false, error:'Materia desconeguda' };
  var sh = getOrCreateMateriaSheet(ss, trimestre+'T_'+nomBase);
  var oc = findOrCreateObsColumn(sh);
  var rowObs = parseInt(sid)*2 + DATA_ROW;
  var cell = sh.getRange(rowObs, oc);
  var cur = (cell.getValue()||'').toString().trim();
  cell.setValue(replace ? text : (cur ? cur+' · '+text : text)).setWrap(true);
  return { ok:true };
}
function deleteObservacio(ss, sid, materia, trimestre) {
  var nomBase = _materiaNomBase(materia); if (!nomBase) return { ok:true };
  var sh = ss.getSheetByName(trimestre+'T_'+nomBase); if (!sh) return { ok:true };
  var oc = findObsColumn(sh); if (oc===-1) return { ok:true };
  sh.getRange(parseInt(sid)*2+DATA_ROW, oc).clearContent();
  return { ok:true };
}

/* ============================================================
   NOTES — Lectura OPTIMITZADA (1 sola lectura de tot el rang)
   ============================================================ */
// Retorna el nom base d'una assignatura per al nom de pestanya.
// Si la clau és coneguda (MATERIA_NOM), usa'l; si no, deriva'l de la clau
// (perquè funcionin les assignatures noves del perfil: Tallers, Ambients...).
function _materiaNomBase(materia) {
  if (MATERIA_NOM[materia]) return MATERIA_NOM[materia];
  // Deriva: capitalitza la clau. El frontend passa el label real via body.matLabel
  // si el té; aquí fem el millor possible.
  if (!materia) return '';
  return materia.charAt(0).toUpperCase() + materia.slice(1);
}

function getNotes(ss, materia, trimestre, grup) {
  if (!materia||!trimestre) return { ok:false, error:'Falten parametres' };
  var nomBase = _materiaNomBase(materia);
  if (!nomBase) return { ok:false, error:'Materia desconeguda: '+materia };
  var sh = ss.getSheetByName(_notesTabName(trimestre, nomBase, grup));
  if (!sh) return { ok:true, items:[], valors:{}, noEntregats:{} };

  if (MATERIES_AMB_CARPETA.indexOf(materia)!==-1) moveCarpetaBeforeMitjana(sh);

  var lc = sh.getLastColumn(), lr = sh.getLastRow();
  if (lc < 2) return { ok:true, items:[], valors:{}, noEntregats:{} };

  // UNA SOLA LECTURA de tot el rang (capçaleres + totes les dades)
  var allData  = sh.getRange(1, 1, Math.max(lr, DATA_ROW), lc).getValues();
  var allNotes = sh.getRange(1, 1, 1, lc).getNotes()[0]; // notes de fila 1

  var headers = allData[0]; // fila 1
  var items = [], valors = {}, neMap = {};
  var numAlumnes = Math.floor((lr - DATA_ROW + 1) / 2); // 2 files per alumne

  headers.forEach(function(h, col) {
    var meta  = allNotes[col] || '';
    var parts = meta.split('|');

    if (meta === CARPETA_NOTE) {
      items.push({ id:'carpeta_ref', nom:'Carpeta Viatgera', maxPunts:10, pes:2, readonly:true });
      valors['carpeta_ref'] = {};
      for (var si=0; si<numAlumnes; si++) {
        var rowP = DATA_ROW-1 + si*2; // índex 0-based
        // Carpeta: cel·la fusionada, el valor pot ser a rowP o rowP+1
        var v = allData[rowP] ? allData[rowP][col] : '';
        if (v===''||v===null) v = allData[rowP+1] ? allData[rowP+1][col] : '';
        valors['carpeta_ref'][si] = (v!==''&&v!==null) ? v : '';
      }
    } else if (parts.length===3 && !isNaN(parseFloat(parts[0])) && !isNaN(parseInt(parts[2]))) {
      var id = parseInt(parts[2]);
      var nom = (h||'').toString().trim();
      if (!nom) return;
      items.push({ id:id, nom:nom, maxPunts:parseFloat(parts[0]), pes:parseFloat(parts[1]) });
      valors[id] = {};
      for (var si2=0; si2<numAlumnes; si2++) {
        var rowP2 = DATA_ROW-1 + si2*2; // índex 0-based (fila de punts)
        var row = allData[rowP2];
        if (!row) continue;
        var v2 = row[col];
        if (v2==='NE') {
          if (!neMap[id]) neMap[id] = {};
          neMap[id][si2] = true;
          valors[id][si2] = 0;
        } else {
          valors[id][si2] = (v2!==''&&v2!==null) ? v2 : '';
        }
      }
    }
  });

  // Llista de noms de cada fila d'alumne (per posició), perquè el frontend
  // pugui mapejar les notes al nom correcte i no per posició cega.
  var rowNoms = [];
  for (var sn=0; sn<numAlumnes; sn++) {
    var rP = DATA_ROW-1 + sn*2;
    rowNoms.push(allData[rP] ? (allData[rP][0]||'').toString().trim() : '');
  }

  // Comentaris per alumne i activitat. Es desen com a NOTA de la mateixa
  // cel·la de la puntuacio, aixi el mestre tambe els veu obrint el full.
  var comentaris = {};
  try {
    var totesNotes = sh.getRange(1, 1, Math.max(lr, DATA_ROW), lc).getNotes();
    items.forEach(function (it) {
      var c = -1;
      allNotes.forEach(function (m, i) {
        var p = (m || '').split('|');
        if (p.length === 3 && parseInt(p[2]) === it.id) c = i;
      });
      if (c === -1) return;
      for (var sc = 0; sc < numAlumnes; sc++) {
        var rc = DATA_ROW - 1 + sc * 2;
        var txt = (totesNotes[rc] && totesNotes[rc][c]) ? String(totesNotes[rc][c]).trim() : '';
        if (txt) {
          if (!comentaris[it.id]) comentaris[it.id] = {};
          comentaris[it.id][sc] = txt;
        }
      }
    });
  } catch (e) { /* si falla, simplement no n hi ha */ }

  return { ok:true, items:items, valors:valors, noEntregats:neMap, rowNoms:rowNoms, comentaris:comentaris };
}

/* Retorna la nota final arrodonida i el comptador de NE de CADA alumne
   per TOTES les assignatures i trimestres, en una sola crida.
   Usat per la fitxa de l'alumne (evita 18 crides per alumne). */
// Resum de notes per a la fitxa de l'alumne. ENUMERA les pestanyes de notes
// REALS del grup (p. ex. "1T_Matemàtiques_4t B") en comptes d'assumir una
// llista fixa de matèries amb noms sense grup. Així funciona per a qualsevol
// assignatura del perfil (Castellà, L'art del traç, Tallers…) i per a les
// pestanyes per-grup. Si no es passa grup, inclou també les pestanyes llegades
// sense sufix de grup.
function getNotesResum(ss, grup) {
  var TRIMS = [1, 2, 3];
  var suf = (grup && grup.toString().trim()) ? ('_' + grup.toString().trim()) : '';

  // Normalitza per agrupar la mateixa assignatura entre trimestres.
  function _norm(s){ return (s||'').toString().normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]/g,''); }
  // Mapa nom-base conegut → clau curta (matematiques, medi…), per mantenir la
  // compatibilitat amb qui consumeix el resum amb claus fixes (context del xat).
  var NOM2KEY = {};
  Object.keys(MATERIA_NOM).forEach(function(k){ NOM2KEY[_norm(MATERIA_NOM[k])] = k; });

  // Recull les pestanyes de notes d'aquest grup: { key: { nom, trims:{1:sh,…} } }
  var mats = {};
  ss.getSheets().forEach(function(sh){
    var m = sh.getName().match(/^([123])T_(.+)$/);
    if (!m) return;
    var trim = parseInt(m[1], 10), base = m[2];
    if (suf) {
      if (base.length <= suf.length || base.slice(-suf.length) !== suf) return;
      base = base.slice(0, -suf.length);
    }
    if (!base) return;
    var key = NOM2KEY[_norm(base)] || _norm(base);
    if (!mats[key]) mats[key] = { nom: base, trims: {} };
    mats[key].trims[trim] = sh;
  });

  var resum = {}, ordre = [];
  Object.keys(mats).forEach(function(key){
    ordre.push({ key: key, nom: mats[key].nom });
    resum[key] = {};
    TRIMS.forEach(function(trim){
      resum[key][trim] = mats[key].trims[trim] ? _resumOneSheet(mats[key].trims[trim]) : null;
    });
  });

  return { ok: true, resum: resum, mats: ordre };
}

// Extreu { notes, ne, rowNoms } d'una pestanya de notes (1 sola lectura del rang).
function _resumOneSheet(sh) {
  var lc = sh.getLastColumn(), lr = sh.getLastRow();
  if (lc < 2 || lr < DATA_ROW) return null;

  var allData  = sh.getRange(1, 1, lr, lc).getValues();
  var allNotes = sh.getRange(1, 1, 1, lc).getNotes()[0];
  var headers  = allData[0];
  var numAlumnes = Math.floor((lr - DATA_ROW + 1) / 2);

  // Localitza columnes d'ítems (amb pes) i la columna Nota
  var itemCols = [], notaCol = -1;
  headers.forEach(function(h, col) {
    var meta = allNotes[col] || '';
    if (meta === CARPETA_NOTE) {
      itemCols.push({ col: col, max: 10, pes: 2, readonly: true });
    } else if (meta === '10|2|actitud_ref') {
      itemCols.push({ col: col, max: 10, pes: 2, readonly: true });
    } else {
      var parts = meta.split('|');
      if (parts.length === 3 && !isNaN(parseFloat(parts[0]))) {
        itemCols.push({ col: col, max: parseFloat(parts[0]), pes: parseFloat(parts[1]), readonly: false });
      }
    }
    if ((h||'').toString().trim() === 'Nota') notaCol = col;
  });

  var notes = {}, neCount = {}, rowNoms = [];
  for (var si = 0; si < numAlumnes; si++) {
    var rowP = DATA_ROW - 1 + si*2;
    rowNoms[si] = (allData[rowP] && allData[rowP][0]) ? allData[rowP][0].toString().trim() : '';
    if (!allData[rowP]) continue;
    var sumV = 0, sumP = 0, ne = 0;
    itemCols.forEach(function(ic) {
      var v = allData[rowP][ic.col];
      if (v === 'NE') { ne++; sumP += ic.pes; return; } // compta com a 0
      if (v === '' || v === null) {
        // readonly pot tenir el valor a la fila següent (fusionada)
        if (ic.readonly && allData[rowP+1]) v = allData[rowP+1][ic.col];
        if (v === '' || v === null) return;
      }
      var n = ic.readonly ? parseFloat(v) : Math.round(parseFloat(v)/ic.max*10*100)/100;
      if (!isNaN(n)) { sumV += n * ic.pes; sumP += ic.pes; }
    });
    var mitj = sumP > 0 ? sumV/sumP : null;
    notes[si]   = mitj !== null ? Math.floor(mitj + 0.5) : null;
    neCount[si] = ne;
  }
  return { notes: notes, ne: neCount, rowNoms: rowNoms };
}

/* ============================================================
   NOTES — Afegir ítem
   ============================================================ */
function addNotaItem(ss, materia, trimestre, item, alumnes, grup) {
  var nomBase = _materiaNomBase(materia); if (!nomBase) return { ok:false, error:'Materia desconeguda' };
  var sh = getOrCreateMateriaSheet(ss, _notesTabName(trimestre, nomBase, grup));
  initAlumnesRows(sh, alumnes, _notesTabName(trimestre, nomBase, grup));

  // Posició d'inserció: ABANS de Carpeta, Mitjana, Nota, Obs
  var lc = sh.getLastColumn();
  var hdrs  = lc>0 ? sh.getRange(1,1,1,lc).getValues()[0]  : [];
  var metas = lc>0 ? sh.getRange(1,1,1,lc).getNotes()[0]   : [];
  var ins = lc+1;
  for (var i=0; i<hdrs.length; i++) {
    var hn=(hdrs[i]||'').toString().trim(), mn=(metas[i]||'').toString();
    if (mn===CARPETA_NOTE||hn==='Mitjana'||hn==='Nota'||hn===COL_OBS){ins=i+1;break;}
  }
  if (ins<=lc) sh.insertColumnsBefore(ins,1);

  // Escriu capçalera amb el granat de l'app
  var c1=sh.getRange(1,ins);
  c1.setValue(item.nom).setFontWeight('bold')
    .setHorizontalAlignment('center').setVerticalAlignment('middle')
    .setBackground(GARNET_HEADER).setFontColor(GARNET_TEXT).setFontFamily('Nunito');
  c1.setNote(item.maxPunts+'|'+item.pes+'|'+item.id);
  sh.getRange(2,ins).setValue('Pes: '+item.pes).setFontSize(9)
    .setHorizontalAlignment('center').setVerticalAlignment('middle')
    .setBackground(GARNET_SUBHEAD).setFontColor(GARNET_TEXT_MID).setFontFamily('Nunito');
  sh.getRange(3,ins).setValue('/'+item.maxPunts+' pts').setFontSize(9)
    .setHorizontalAlignment('center').setVerticalAlignment('middle')
    .setBackground(GARNET_SUBHEAD).setFontColor(GARNET_TEXT_MID).setFontFamily('Nunito');
  sh.autoResizeColumn(ins); if(sh.getColumnWidth(ins)<80) sh.setColumnWidth(ins,80);

  // Inicialitza files de dades (centrades H+V)
  var numA = alumnes ? alumnes.length : 0;
  for (var si=0; si<numA; si++) {
    sh.getRange(si*2+DATA_ROW+1,ins).setFontColor('#CCCCCC')
      .setHorizontalAlignment('center').setVerticalAlignment('middle');
  }

  if (MATERIES_AMB_CARPETA.indexOf(materia)!==-1) moveCarpetaBeforeMitjana(sh);
  refreshMitjanaColumn(sh);
  applyFormatToNotesSheet(sh);
  return { ok:true };
}

/* ============================================================
   NOTES — Eliminar ítem
   ============================================================ */
function deleteNotaItem(ss, materia, trimestre, itemId, grup) {
  var nomBase=_materiaNomBase(materia); if(!nomBase)return{ok:true};
  var sh=ss.getSheetByName(_notesTabName(trimestre, nomBase, grup)); if(!sh)return{ok:true};
  var lc=sh.getLastColumn();
  var metas=sh.getRange(1,1,1,lc).getNotes()[0];
  for(var i=metas.length-1;i>=0;i--){
    var p=(metas[i]||'').split('|');
    if(p.length===3&&parseInt(p[2])===itemId){sh.deleteColumn(i+1);break;}
  }
  refreshMitjanaColumn(sh);
  return{ok:true};
}

/* ============================================================
   NOTES — Actualitzar nota (OPTIMITZAT: escriu punts + nota d'un cop)
   ============================================================ */
// Troba la fila (rowP) d'un alumne a la pestanya de notes pel seu NOM.
// Cerca a la columna A. Retorna la fila superior del parell, o -1 si no el troba.
function _trobaFilaAlumne(sh, nom) {
  if (!nom) return -1;
  var lr = sh.getLastRow();
  if (lr < DATA_ROW) return -1;
  var noms = sh.getRange(DATA_ROW, 1, lr - DATA_ROW + 1, 1).getValues();
  var target = _normNom ? _normNom(nom) : nom.toString().toLowerCase().trim();
  for (var i = 0; i < noms.length; i++) {
    var v = (noms[i][0] || '').toString().trim();
    if (!v) continue;
    var vn = _normNom ? _normNom(v) : v.toLowerCase().trim();
    if (vn === target) return DATA_ROW + i; // fila superior del parell
  }
  return -1;
}

function updateNota(ss, materia, trimestre, itemId, studentId, punts, grup, nom) {
  var nomBase=_materiaNomBase(materia); if(!nomBase)return{ok:false,error:'Materia desconeguda'};
  var sh=ss.getSheetByName(_notesTabName(trimestre, nomBase, grup)); if(!sh)return{ok:false,error:'Pestanya no trobada'};

  var lc=sh.getLastColumn();
  var metas=sh.getRange(1,1,1,lc).getNotes()[0];
  var col=-1;
  metas.forEach(function(m,i){ var p=(m||'').split('|'); if(p.length===3&&parseInt(p[2])===itemId) col=i+1; });
  if(col===-1)return{ok:false,error:'Columna no trobada: '+itemId};

  // Localitza la fila PEL NOM (robust); si no el troba, la crea al final
  var rowP = _trobaFilaAlumne(sh, nom);
  if (rowP === -1 && nom) {
    // Crea la fila per a aquest alumne (parell de files fusionades a la col A)
    var lastR = sh.getLastRow();
    // Troba la primera fila lliure a partir de DATA_ROW (en múltiples de 2)
    var novaFila = Math.max(DATA_ROW, lastR + 1);
    // Alinea a parell segons DATA_ROW
    if ((novaFila - DATA_ROW) % 2 !== 0) novaFila++;
    sh.getRange(novaFila,1).setValue(nom).setVerticalAlignment('middle');
    sh.getRange(novaFila+1,1).setValue('').setBackground('#FFFFFF');
    try { sh.getRange(novaFila,1,2,1).merge(); } catch(e){}
    rowP = novaFila;
  }
  if (rowP === -1) { var si=parseInt(studentId); rowP = si*2+DATA_ROW; }
  var rowN = rowP+1;
  var maxP=parseFloat((metas[col-1]||'10|1|0').split('|')[0]); // ja llegit a dalt (evita un getNote extra)

  // Si la cel·la conté 'NE' i estem enviant 0 o buit → crida espúria, ignora
  var curVal=sh.getRange(rowP,col).getValue();
  if(curVal==='NE'&&(punts===0||punts===''||punts===null))return{ok:true};

  var val=(punts===''||punts===null||punts===undefined)?'':parseFloat(punts);
  var nota=(val!==''&&!isNaN(val)&&maxP>0)?Math.round(val/maxP*10*100)/100:'';

  // Escriu les dues cel·les d'un sol cop via setValues en un rang de 2 files
  // (una crida en lloc de dues)
  sh.getRange(rowP,col).setValue(val===''?'':val)
    .setFontColor('#AAAAAA').setFontSize(9).setHorizontalAlignment('center').setVerticalAlignment('bottom').setBackground(null);
  var cellN=sh.getRange(rowN,col);
  cellN.setValue(nota===''?'':nota).setNumberFormat('0.00')
    .setFontWeight('bold').setFontSize(10).setHorizontalAlignment('center').setVerticalAlignment('top');
  colorNota(cellN,nota);

  recalcMitjana(sh,rowP);
  if(materia==='carpeta') propagaCarpeta(ss,trimestre,si,sh,rowP);
  // Centra i aplica Nunito a la fila afectada
  var lc2=sh.getLastColumn();
  sh.getRange(rowP,1,2,lc2)
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setFontFamily('Nunito');
  return{ok:true};
}

/* ============================================================
   NO ENTREGAT
   ============================================================ */
function setNoEntregat(ss, materia, trimestre, itemId, studentId, valor, grup, nom) {
  var nomBase=_materiaNomBase(materia); if(!nomBase)return{ok:false,error:'Materia desconeguda'};
  var sh=ss.getSheetByName(_notesTabName(trimestre, nomBase, grup)); if(!sh)return{ok:false,error:'Pestanya no trobada'};
  var lc=sh.getLastColumn();
  var metas=sh.getRange(1,1,1,lc).getNotes()[0];
  var col=-1;
  metas.forEach(function(m,i){ var p=(m||'').split('|'); if(p.length===3&&parseInt(p[2])===itemId) col=i+1; });
  if(col===-1)return{ok:false,error:'Columna no trobada'};
  var rowP = _trobaFilaAlumne(sh, nom);
  if (rowP === -1) { var si=parseInt(studentId); rowP = si*2+DATA_ROW; }
  var rowN = rowP+1;
  if(valor){
    sh.getRange(rowP,col).setValue('NE').setFontColor('#991B1B').setFontWeight('bold')
      .setFontSize(9).setHorizontalAlignment('center').setVerticalAlignment('bottom').setBackground(null);
    colorNota(sh.getRange(rowN,col).setValue(0).setNumberFormat('0.00')
      .setFontWeight('bold').setFontSize(10).setHorizontalAlignment('center').setVerticalAlignment('top'),0);
  } else {
    sh.getRange(rowP,col).setValue('').setFontColor('#AAAAAA').setFontSize(9)
      .setFontWeight('normal').setBackground(null).setHorizontalAlignment('center').setVerticalAlignment('bottom');
    sh.getRange(rowN,col).setValue('').setBackground(null).setFontColor('#CCCCCC').setFontWeight('normal');
  }
  recalcMitjana(sh,rowP);
  var lc3=sh.getLastColumn();
  sh.getRange(rowP,1,2,lc3).setHorizontalAlignment('center').setVerticalAlignment('middle');
  return{ok:true};
}

/* ============================================================
   CARPETA VIATGERA
   ============================================================ */
function moveCarpetaBeforeMitjana(sh) {
  var lc=sh.getLastColumn(); if(lc<2)return;
  var hdrs=sh.getRange(1,1,1,lc).getValues()[0];
  var mts=sh.getRange(1,1,1,lc).getNotes()[0];
  var cCol=-1, mCol=-1;
  hdrs.forEach(function(h,i){ if((mts[i]||'')===CARPETA_NOTE)cCol=i+1; if((h||'').toString().trim()==='Mitjana')mCol=i+1; });
  if(cCol===-1||mCol===-1||cCol===mCol-1) return;
  if(Math.abs(cCol-mCol)<=1) return;
  // Copia i mou
  var lr=Math.max(sh.getLastRow(),3);
  var vals=sh.getRange(1,cCol,lr,1).getValues();
  var bgs=sh.getRange(1,cCol,lr,1).getBackgrounds();
  var fcs=sh.getRange(1,cCol,lr,1).getFontColors();
  var fws=sh.getRange(1,cCol,lr,1).getFontWeights();
  var fss=sh.getRange(1,cCol,lr,1).getFontSizes();
  var alH=sh.getRange(1,cCol,lr,1).getHorizontalAlignments();
  var alV=sh.getRange(1,cCol,lr,1).getVerticalAlignments();
  var noteVal=sh.getRange(1,cCol).getNote();
  sh.deleteColumn(cCol);
  if(cCol<mCol) mCol--;
  sh.insertColumnsBefore(mCol,1);
  var r=sh.getRange(1,mCol,lr,1);
  r.setValues(vals).setBackgrounds(bgs).setFontColors(fcs).setFontWeights(fws)
   .setFontSizes(fss).setHorizontalAlignments(alH).setVerticalAlignments(alV);
  sh.getRange(1,mCol).setNote(noteVal);
  sh.autoResizeColumn(mCol); if(sh.getColumnWidth(mCol)<80)sh.setColumnWidth(mCol,80);
}

function propagaCarpeta(ss, trimestre, si, carpetaSh, rowP) {
  // Calcula la mitjana de Carpeta per aquest alumne (lectura batch)
  var lc=carpetaSh.getLastColumn();
  var metas=carpetaSh.getRange(1,1,1,lc).getNotes()[0];
  var rowData=carpetaSh.getRange(rowP,1,1,lc).getValues()[0];
  var sumV=0,sumP=0;
  metas.forEach(function(m,i){
    var p=(m||'').split('|');
    if(p.length!==3||isNaN(parseFloat(p[0])))return;
    var v=rowData[i];
    if(v===''||v===null||v==='NE')return;
    var vf=parseFloat(v); if(isNaN(vf))return;
    sumV+=(vf/parseFloat(p[0])*10)*parseFloat(p[1]); sumP+=parseFloat(p[1]);
  });
  var mitjanaCarpeta=sumP>0?Math.round(sumV/sumP*100)/100:'';

  MATERIES_AMB_CARPETA.forEach(function(mat){
    var sh=ss.getSheetByName(trimestre+'T_'+MATERIA_NOM[mat]); if(!sh)return;
    var lc2=sh.getLastColumn();
    var hdrs2=lc2>0?sh.getRange(1,1,1,lc2).getValues()[0]:[];
    var mts2=lc2>0?sh.getRange(1,1,1,lc2).getNotes()[0]:[];
    var cCol=-1,mCol=-1;
    hdrs2.forEach(function(h,i){
      if((mts2[i]||'')===CARPETA_NOTE)cCol=i+1;
      if((h||'').toString().trim()==='Mitjana')mCol=i+1;
    });
    if(cCol===-1){
      var ins=lc2+1;
      for(var i=0;i<hdrs2.length;i++){var h=(hdrs2[i]||'').toString().trim();if(h==='Mitjana'||h===COL_OBS){ins=i+1;break;}}
      if(ins<=lc2)sh.insertColumnsBefore(ins,1);
      var c1=sh.getRange(1,ins);
      c1.setValue('Carpeta Viatgera').setFontWeight('bold').setHorizontalAlignment('center').setBackground('#FBEAED').setFontColor('#7A1E2E').setFontFamily('Nunito');
      c1.setNote(CARPETA_NOTE);
      sh.getRange(2,ins).setValue('Pes: 2').setFontColor('#A63050').setFontSize(9).setHorizontalAlignment('center').setBackground('#F5D0D6').setFontFamily('Nunito');
      sh.getRange(3,ins).setValue('/10').setFontColor('#A63050').setFontSize(9).setHorizontalAlignment('center').setBackground('#F5D0D6').setFontFamily('Nunito');
      sh.autoResizeColumn(ins); if(sh.getColumnWidth(ins)<90)sh.setColumnWidth(ins,90);
      cCol=ins;
    }
    var rp=si*2+DATA_ROW, rn=rp+1;
    try{sh.getRange(rp,cCol,2,1).breakApart();}catch(ex){}
    sh.getRange(rp,cCol).setValue('').setFontColor('#AAAAAA').setFontSize(9).setHorizontalAlignment('center').setVerticalAlignment('bottom');
    var cellN=sh.getRange(rn,cCol);
    cellN.setValue(mitjanaCarpeta===''?'':mitjanaCarpeta).setNumberFormat('0.00')
      .setFontWeight('bold').setFontSize(11).setHorizontalAlignment('center').setVerticalAlignment('top');
    colorNota(cellN,mitjanaCarpeta);
    try{sh.getRange(rp,cCol,2,1).merge();}catch(ex){}
    moveCarpetaBeforeMitjana(sh);
    recalcMitjana(sh,rp);
  });
}

/* ============================================================
   RECALC MITJANA — lectura batch de les dues files
   ============================================================ */
/* `cap` (opcional) és la capçalera ja llegida: {lc, hdr, meta}. Serveix per
   a qui recalcula molts alumnes seguits del MATEIX full: la capçalera és la
   mateixa per a tots i rellegir-la a cada alumne eren 3 viatges a Google per
   cap. Si no se li passa, es comporta exactament com abans. */
function recalcMitjana(sh, rowP, cap) {
  var lc, hdrData, metaData;
  if (cap && cap.lc) {
    lc = cap.lc; hdrData = cap.hdr; metaData = cap.meta;
  } else {
    lc = sh.getLastColumn();
    hdrData  = lc>=2 ? sh.getRange(1,1,1,lc).getValues()[0] : [];
    metaData = lc>=2 ? sh.getRange(1,1,1,lc).getNotes()[0]  : [];
  }
  if(lc<2)return;
  var rowPData = sh.getRange(rowP,1,1,lc).getValues()[0];
  var rowNData = sh.getRange(rowP+1,1,1,lc).getValues()[0];

  var items=[],mCol=-1,notaCol=-1;
  hdrData.forEach(function(h,i){
    var m=(metaData[i]||'').toString(), hn=(h||'').toString().trim();
    var p=m.split('|');
    if(m===CARPETA_NOTE){
      var v=rowPData[i]; if(v===''||v===null)v=rowNData[i];
      items.push({nota:(v!==''&&v!==null&&!isNaN(parseFloat(v)))?parseFloat(v):null,pes:2});
    } else if(p.length===3&&!isNaN(parseFloat(p[0]))){
      var vp=rowPData[i],np;
      if(vp==='NE') np=0;
      else np=(vp!==''&&vp!==null&&!isNaN(parseFloat(vp)))?Math.round(parseFloat(vp)/parseFloat(p[0])*10*100)/100:null;
      items.push({nota:np,pes:parseFloat(p[1])});
    }
    if(hn==='Mitjana')mCol=i+1;
    if(hn==='Nota')notaCol=i+1;
  });

  var sumV=0,sumP=0;
  items.forEach(function(it){if(it.nota!==null){sumV+=it.nota*it.pes;sumP+=it.pes;}});
  var mitj=sumP>0?Math.round(sumV/sumP*100)/100:'';

  if(mCol!==-1){
    try{sh.getRange(rowP,mCol,2,1).merge();}catch(e){}
    var cm=sh.getRange(rowP,mCol);
    cm.setValue(mitj===''?'':mitj).setNumberFormat('0.00').setFontWeight('bold').setFontSize(11)
      .setHorizontalAlignment('center').setVerticalAlignment('middle').setFontFamily('Nunito');
    if(mitj===''){cm.setBackground('#F5F5F5').setFontColor('#BBBBBB');}
    else{colorMitjana(cm,mitj);}
  }
  if(notaCol!==-1){
    var ar=mitj!==''?Math.floor(parseFloat(mitj)+0.5):'';
    try{sh.getRange(rowP,notaCol,2,1).merge();}catch(e){}
    var cn=sh.getRange(rowP,notaCol);
    cn.setValue(ar===''?'':ar).setFontWeight('bold').setFontSize(13)
      .setHorizontalAlignment('center').setVerticalAlignment('middle').setFontFamily('Nunito');
    if(ar===''){cn.setBackground('#F5F5F5').setFontColor('#BBBBBB');}
    else{colorNotaArrod(cn,ar);}
  }
}

function refreshMitjanaColumn(sh) {
  var lr=sh.getLastRow();
  for(var si=0;;si++){var r=si*2+DATA_ROW;if(r>lr)break;recalcMitjana(sh,r);}
  // Assegura que existeixen les columnes Mitjana i Nota
  var lc=sh.getLastColumn();
  var hdrs=sh.getRange(1,1,1,lc).getValues()[0];
  var hasMitj=false,hasNota=false;
  hdrs.forEach(function(h){var hn=(h||'').toString().trim();if(hn==='Mitjana')hasMitj=true;if(hn==='Nota')hasNota=true;});
  if(!hasMitj){
    var ins=lc+1;
    for(var i=0;i<hdrs.length;i++)if((hdrs[i]||'').toString().trim()===COL_OBS){ins=i+1;break;}
    if(ins<=sh.getLastColumn())sh.insertColumnsBefore(ins,1);
    sh.getRange(1,ins).setValue('Mitjana').setFontWeight('bold').setHorizontalAlignment('center').setBackground('#FBEAED').setFontColor('#7A1E2E').setFontFamily('Nunito');
    sh.getRange(2,ins).setValue('ponderada').setFontColor('#A63050').setFontSize(9).setHorizontalAlignment('center').setBackground('#F5D0D6').setFontFamily('Nunito');
    sh.getRange(3,ins).setValue('/10').setFontColor('#A63050').setFontSize(9).setHorizontalAlignment('center').setBackground('#F5D0D6').setFontFamily('Nunito');
    sh.autoResizeColumn(ins); if(sh.getColumnWidth(ins)<75)sh.setColumnWidth(ins,75);
  }
  if(!hasNota){
    lc=sh.getLastColumn(); hdrs=sh.getRange(1,1,1,lc).getValues()[0];
    var ins2=lc+1;
    for(var j=0;j<hdrs.length;j++)if((hdrs[j]||'').toString().trim()===COL_OBS){ins2=j+1;break;}
    if(ins2<=sh.getLastColumn())sh.insertColumnsBefore(ins2,1);
    sh.getRange(1,ins2).setValue('Nota').setFontWeight('bold').setHorizontalAlignment('center').setBackground('#FBEAED').setFontColor('#7A1E2E').setFontFamily('Nunito');
    sh.getRange(2,ins2).setValue('arrod.').setFontColor('#A63050').setFontSize(9).setHorizontalAlignment('center').setBackground('#F5D0D6').setFontFamily('Nunito');
    sh.getRange(3,ins2).setValue('').setBackground('#F5D0D6').setFontFamily('Nunito');
    sh.autoResizeColumn(ins2); if(sh.getColumnWidth(ins2)<60)sh.setColumnWidth(ins2,60);
  }
}

/* ============================================================
   COLORS
   ============================================================ */
function colorNota(cell,nota){
  if(nota===''||nota===null||nota===undefined){cell.setBackground(null).setFontColor('#CCCCCC');return;}
  var n=parseFloat(nota);
  if(n>=9)cell.setBackground('#C8E6C9').setFontColor('#1B5E20');
  else if(n>=7)cell.setBackground('#BBDEFB').setFontColor('#0D47A1');
  else if(n>=5)cell.setBackground('#FFF9C4').setFontColor('#F57F17');
  else cell.setBackground('#FFCDD2').setFontColor('#B71C1C');
}
function colorMitjana(cell,mitj){
  if(mitj===''||mitj===null||mitj===undefined){cell.setBackground(null).setFontColor('#CCCCCC');return;}
  var n=parseFloat(mitj);
  if(n>=9)cell.setBackground('#D1FAE5').setFontColor('#065F46');
  else if(n>=7)cell.setBackground('#DBEAFE').setFontColor('#1E40AF');
  else if(n>=5)cell.setBackground('#FEF3C7').setFontColor('#92400E');
  else cell.setBackground('#FEE2E2').setFontColor('#991B1B');
}
function colorNotaArrod(cell,nota){
  if(nota===''||nota===null||nota===undefined){cell.setBackground(null).setFontColor('#CCCCCC');return;}
  parseInt(nota)<5?cell.setBackground('#FFCDD2').setFontColor('#B71C1C'):cell.setBackground('#C8E6C9').setFontColor('#1B5E20');
}

/* ============================================================
   HELPERS
   ============================================================ */
function initAlumnesRows(sh, alumnes, tabName) {
  if(!alumnes||!alumnes.length)return;
  alumnes.forEach(function(a,i){
    var rp=i*2+DATA_ROW,rn=rp+1;
    if(!sh.getRange(rp,1).getValue()){
      sh.getRange(rp,1).setValue(a.nom).setVerticalAlignment('middle');
      sh.getRange(rn,1).setValue('').setBackground('#FFFFFF');
      try{sh.getRange(rp,1,2,1).merge();}catch(e){}
    }
  });
  if(!sh.getRange(1,1).getValue()){
    var nom=tabName.replace(/^\d+T_/,'');
    try{sh.getRange(1,1,3,1).merge();}catch(e){}
    sh.getRange(1,1).setValue(nom).setFontWeight('bold').setFontSize(12)
      .setHorizontalAlignment('center').setVerticalAlignment('middle')
      .setBackground(GARNET_HEADER).setFontColor(GARNET_TEXT).setFontFamily('Nunito');
    sh.autoResizeColumn(1); if(sh.getColumnWidth(1)<140) sh.setColumnWidth(1,140);
  }
}
function findObsColumn(sh){
  var lc=sh.getLastColumn();if(lc<1)return -1;
  var h=sh.getRange(1,1,1,lc).getValues()[0];
  for(var i=h.length-1;i>=0;i--)if((h[i]||'').toString().trim()===COL_OBS)return i+1;
  return -1;
}
function findOrCreateObsColumn(sh){
  var col=findObsColumn(sh);if(col!==-1)return col;
  var nc=sh.getLastColumn()+1;sh.getRange(1,nc).setValue(COL_OBS).setFontWeight('bold');return nc;
}
function ensureObsIsLastColumn(sh){
  var lc=sh.getLastColumn();if(lc<1)return;
  var h=sh.getRange(1,1,1,lc).getValues()[0];
  var oi=-1;for(var i=0;i<h.length;i++)if((h[i]||'').toString().trim()===COL_OBS){oi=i;break;}
  if(oi===-1||oi===lc-1)return;
  var oc=oi+1,lr=Math.max(sh.getLastRow(),1);
  var vals=sh.getRange(1,oc,lr,1).getValues();
  sh.deleteColumn(oc);
  var nl=sh.getLastColumn()+1;
  sh.getRange(1,nl,lr,1).setValues(vals);sh.getRange(1,nl).setFontWeight('bold');
}
function ensureAlumnesRows(ss, sh){
  var ash=ss.getSheetByName(TABS.alumnes);if(!ash)return;
  var la=ash.getLastRow();if(la<2)return;
  var alumnes=ash.getRange(2,1,la-1,1).getValues(),lr=sh.getLastRow();
  alumnes.forEach(function(row,idx){var rp=idx*2+DATA_ROW;if(rp>lr||!sh.getRange(rp,1).getValue())sh.getRange(rp,1).setValue(row[0]);});
}

/* ============================================================
   CREATORS
   ============================================================ */
function getOrCreateAlumnesSheet(ss){
  var s=ss.getSheetByName(TABS.alumnes);
  if(!s){s=ss.insertSheet(TABS.alumnes);_protegirFull(s);s.getRange(1,1,1,6).setValues([['Nom','Nom mare','Nom pare','Email mare','Email pare','Observació']]).setFontWeight('bold');}
  return s;
}
function getOrCreateMateriaSheet(ss, tabName){
  var s=ss.getSheetByName(tabName);
  if(!s){
    s=ss.insertSheet(tabName);
    _protegirFull(s);
    var nom=tabName.replace(/^\d+T_/,'');
    try{s.getRange(1,1,3,1).merge();}catch(e){}
    s.getRange(1,1).setValue(nom).setFontWeight('bold').setFontSize(12)
      .setHorizontalAlignment('center').setVerticalAlignment('middle')
      .setBackground(GARNET_HEADER).setFontColor(GARNET_TEXT).setFontFamily('Nunito');
    s.autoResizeColumn(1); if(s.getColumnWidth(1)<140) s.setColumnWidth(1,140);
    s.getRange(1,2).setValue(COL_OBS).setFontWeight('bold')
      .setBackground(GARNET_HEADER).setFontColor(GARNET_TEXT).setFontFamily('Nunito');
    applyFormatToNotesSheet(s); // el format complet només cal en CREAR el full (és estable)
  } else { ensureObsIsLastColumn(s); }
  return s;
}
function getOrCreateRegistreSheet(ss, alumnes, grup){
  var nom=_nomFullRegistre(grup);
  var s=ss.getSheetByName(nom);
  if(!s){
    s=ss.insertSheet(nom);_protegirFull(s);s.getRange(1,1).setValue('Alumne').setFontWeight('bold');
    if(alumnes&&alumnes.length)s.getRange(2,1,alumnes.length,1).setValues(alumnes.map(function(a){return [a.nom];}));
  } else if (alumnes && alumnes.length) {
    // Els noms de la columna A han de ser els d'aquest grup: les creus es
    // desen per numero de fila, i si la llista no hi es (o ha canviat)
    // acabarien a l'alumne equivocat.
    s.getRange(2,1,alumnes.length,1).setValues(alumnes.map(function(a){return [a.nom];}));
    var lr=s.getLastRow(), sobren=lr-1-alumnes.length;
    if(sobren>0) s.getRange(alumnes.length+2,1,sobren,1).clearContent();
  }
  return s;
}

/* === FORMAT UNIFICAT DE LES GRAELLES DE NOTES ===
   Aplica color granat clar a capçaleres, Nunito a tot,
   centrat horitzontal + vertical a totes les cel·les,
   columnes especials (Alumne, Mitjana, Nota, Observacions) en granat */

// Paleta granat (idèntica a l'app)
var GARNET_HEADER   = '#FBEAED'; // Capçalera fila 1 (color principal)
var GARNET_SUBHEAD  = '#F5D0D6'; // Capçaleres files 2-3 (pes/punts) o secundàries
var GARNET_TEXT     = '#7A1E2E'; // Text granat fosc
var GARNET_TEXT_MID = '#A63050'; // Text granat mig (pes, /punts)
var READONLY_BG     = '#F7F7F7'; // Fons cel·les de només lectura (mitjana, nota)

/* Aplica format complet al full: Nunito + centrat H/V a totes les cel·les +
   colors granat a capçaleres i a columnes especials. */
function applyFormatToNotesSheet(sh) {
  var lc = sh.getLastColumn(), lr = sh.getLastRow();
  if (lc < 1 || lr < 1) return;

  // 1) Tot el full: Nunito + centrat horitzontal i vertical
  sh.getRange(1, 1, lr, lc)
    .setFontFamily('Nunito')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');

  // 2) Capçaleres (fila 1) en granat clar + text granat fosc + negreta
  sh.getRange(1, 1, 1, lc)
    .setBackground(GARNET_HEADER)
    .setFontColor(GARNET_TEXT)
    .setFontWeight('bold');

  // 3) Files 2 i 3 (pes / /punts) si existeixen: granat secundari + text granat mig
  if (lr >= 2) sh.getRange(2, 1, 1, lc).setBackground(GARNET_SUBHEAD).setFontColor(GARNET_TEXT_MID).setFontSize(9);
  if (lr >= 3) sh.getRange(3, 1, 1, lc).setBackground(GARNET_SUBHEAD).setFontColor(GARNET_TEXT_MID).setFontSize(9);

  // 4) Identifica i pinta columnes especials (Mitjana, Nota, Observacions)
  var hdrs = sh.getRange(1, 1, 1, lc).getValues()[0];
  for (var i = 0; i < hdrs.length; i++) {
    var h = (hdrs[i] || '').toString().trim();
    if (h === 'Mitjana' || h === 'Nota') {
      // Cel·les readonly: fons gris molt clar
      if (lr >= DATA_ROW) sh.getRange(DATA_ROW, i+1, lr-DATA_ROW+1, 1).setBackground(READONLY_BG);
    }
    if (h === 'Observacions') {
      // Observacions: alineació a l'esquerra i wrap (text llarg)
      if (lr >= DATA_ROW) sh.getRange(DATA_ROW, i+1, lr-DATA_ROW+1, 1)
        .setHorizontalAlignment('left')
        .setWrap(true);
    }
  }

  // 5) Columna A (Noms d'alumnes): negreta, alineació esquerra, fons blanc
  if (lr >= DATA_ROW) sh.getRange(DATA_ROW, 1, lr-DATA_ROW+1, 1)
    .setFontWeight('bold')
    .setHorizontalAlignment('left')
    .setBackground('#FFFFFF');

  // 6) Congela les 3 primeres files i la primera columna per facilitar l'scroll
  if (sh.getFrozenRows() < 3) sh.setFrozenRows(3);
  if (sh.getFrozenColumns() < 1) sh.setFrozenColumns(1);
}

/* Mantenim els antics noms per retrocompatibilitat (ara apliquen el format complet) */
function centerAllCells(sh) { applyFormatToNotesSheet(sh); }
function applyNunito(sh)    { applyFormatToNotesSheet(sh); }

/* ============================================================
   ACTITUD — escriu la mitjana a la columna "Actitud" (pes 2)
   entre Carpeta Viatgera i Mitjana
   ============================================================ */
function updateActitud(ss, materia, trimestre, studentId, mitja) {
  var nomBase = _materiaNomBase(materia);
  if (!nomBase) return { ok:false, error:'Materia desconeguda' };
  var sh = ss.getSheetByName(trimestre+'T_'+nomBase);
  if (!sh) return { ok:true }; // pestanya no creada encara, OK

  var lc   = sh.getLastColumn();
  if (lc < 2) return { ok:true };
  var hdrs  = sh.getRange(1,1,1,lc).getValues()[0];
  var metas = sh.getRange(1,1,1,lc).getNotes()[0];

  // Busca o crea la columna Actitud (nota meta: '10|2|actitud_ref')
  var ACTITUD_NOTE = '10|2|actitud_ref';
  var col = -1;
  metas.forEach(function(m,i){ if((m||'').toString()===ACTITUD_NOTE) col=i+1; });

  if (col===-1) {
    // Crea la columna just abans de Mitjana
    var mCol = -1;
    hdrs.forEach(function(h,i){ if((h||'').toString().trim()==='Mitjana') mCol=i+1; });
    if (mCol===-1) mCol = lc+1; // al final si no hi ha Mitjana
    sh.insertColumnsBefore(mCol, 1);
    col = mCol;
    var c1 = sh.getRange(1, col);
    c1.setValue('Actitud').setFontWeight('bold').setHorizontalAlignment('center').setBackground('#FBEAED').setFontColor('#7A1E2E').setFontFamily('Nunito');
    c1.setNote(ACTITUD_NOTE);
    sh.getRange(2,col).setValue('Pes: 2').setFontColor('#A63050').setFontSize(9).setHorizontalAlignment('center').setBackground('#F5D0D6').setFontFamily('Nunito');
    sh.getRange(3,col).setValue('/10').setFontColor('#A63050').setFontSize(9).setHorizontalAlignment('center').setBackground('#F5D0D6').setFontFamily('Nunito');
    sh.autoResizeColumn(col);
    if (sh.getColumnWidth(col) < 80) sh.setColumnWidth(col, 80);
  }

  var si   = parseInt(studentId);
  var rowP = si*2 + DATA_ROW;
  var rowN = rowP+1;
  var mitjaVal = (mitja===null||mitja===undefined||mitja==='') ? '' : parseFloat(mitja);

  // Fila de punts: buit (la mitjana és /10 directament)
  sh.getRange(rowP, col).setValue('').setFontColor('#AAAAAA').setBackground(null).setHorizontalAlignment('center').setFontFamily('Nunito');
  // Fila nota: la mitjana en color
  var cellN = sh.getRange(rowN, col);
  cellN.setValue(mitjaVal==='' ? '' : mitjaVal).setNumberFormat('0.00')
    .setFontWeight('bold').setFontSize(10).setHorizontalAlignment('center').setFontFamily('Nunito');
  if (mitjaVal !== '') colorNota(cellN, mitjaVal);

  recalcMitjana(sh, rowP);
  return { ok:true };
}

/* Versió batch: actualitza l'actitud de TOTS els alumnes en una sola passada.
   Molt més ràpid que cridar updateActitud N vegades. */
function updateActitudBatch(ss, materia, trimestre, mitjanes) {
  var nomBase = _materiaNomBase(materia);
  if (!nomBase) return { ok:false, error:'Materia desconeguda' };
  var sh = ss.getSheetByName(trimestre+'T_'+nomBase);
  if (!sh) return { ok:true };

  var lc = sh.getLastColumn();
  if (lc < 2) return { ok:true };
  var hdrs  = sh.getRange(1,1,1,lc).getValues()[0];
  var metas = sh.getRange(1,1,1,lc).getNotes()[0];

  var ACTITUD_NOTE = '10|2|actitud_ref';
  var col = -1;
  metas.forEach(function(m,i){ if((m||'').toString()===ACTITUD_NOTE) col=i+1; });

  if (col===-1) {
    var mCol = -1;
    hdrs.forEach(function(h,i){ if((h||'').toString().trim()==='Mitjana') mCol=i+1; });
    if (mCol===-1) mCol = lc+1;
    sh.insertColumnsBefore(mCol, 1);
    col = mCol;
    var c1 = sh.getRange(1, col);
    c1.setValue('Actitud').setFontWeight('bold').setHorizontalAlignment('center').setBackground('#FBEAED').setFontColor('#7A1E2E').setFontFamily('Nunito');
    c1.setNote(ACTITUD_NOTE);
    sh.getRange(2,col).setValue('Pes: 2').setFontColor('#A63050').setFontSize(9).setHorizontalAlignment('center').setBackground('#F5D0D6').setFontFamily('Nunito');
    sh.getRange(3,col).setValue('/10').setFontColor('#A63050').setFontSize(9).setHorizontalAlignment('center').setBackground('#F5D0D6').setFontFamily('Nunito');
    sh.autoResizeColumn(col);
    if (sh.getColumnWidth(col) < 80) sh.setColumnWidth(col, 80);
  }

  // La capçalera d'aquest full és la mateixa per a tots els alumnes: es
  // llegeix UN cop i es passa a recalcMitjana. Abans la rellegia sencera a
  // cada alumne: amb 25 alumnes eren 75 lectures per a res.
  var lcAra = sh.getLastColumn();
  var cap = { lc: lcAra,
              hdr:  lcAra>=2 ? sh.getRange(1,1,1,lcAra).getValues()[0] : [],
              meta: lcAra>=2 ? sh.getRange(1,1,1,lcAra).getNotes()[0]  : [] };

  // Escriu totes les mitjanes
  Object.keys(mitjanes).forEach(function(sid) {
    var si   = parseInt(sid);
    var rowP = si*2 + DATA_ROW;
    var rowN = rowP+1;
    var mitjaVal = parseFloat(mitjanes[sid]);
    sh.getRange(rowP, col).setValue('').setHorizontalAlignment('center').setFontFamily('Nunito');
    var cellN = sh.getRange(rowN, col);
    cellN.setValue(mitjaVal).setNumberFormat('0.00')
      .setFontWeight('bold').setFontSize(10).setHorizontalAlignment('center').setFontFamily('Nunito');
    colorNota(cellN, mitjaVal);
    recalcMitjana(sh, rowP, cap);
  });

  return { ok:true };
}

/* ============================================================
   ASSOLIMENTS — full per trimestre amb seccions per assignatura
   data: { materia: { objectius:[{id,nom,text}], alumnes:[{id,nom,vals:{objId:val}}] } }
   val: true='✓' / 'partial'='~' / false='✗' / null='—'
   ============================================================ */
function syncAssoliments(ss, trimestre, data) {
  var tabName = trimestre + 'T_Assoliments';
  var sh = ss.getSheetByName(tabName);
  if (sh) ss.deleteSheet(sh);
  sh = ss.insertSheet(tabName);
  _protegirFull(sh);

  // Colors
  var GARNET_H  = '#FBEAED', GARNET_M = '#F5D0D6';
  var GREEN_BG  = '#D1FAE5', GREEN_FC  = '#065F46';
  var YELLOW_BG = '#FEF3C7', YELLOW_FC = '#92400E';
  var RED_BG    = '#FEE2E2', RED_FC    = '#991B1B';
  var GREY_BG   = '#F3F4F6', GREY_FC   = '#9CA3AF';

  var row = 1;
  var MATS_ORDER = ['matematiques','catala','medi','musica','angles'];
  var MATS_NOM   = {matematiques:'Matemàtiques',catala:'Català',medi:'Medi Natural',musica:'Música',angles:'Anglès'};

  MATS_ORDER.forEach(function(mat) {
    var matData = data[mat];
    if (!matData || !matData.objectius || !matData.objectius.length) return;
    var objs    = matData.objectius;
    var alumnes = matData.alumnes || [];
    var nCols   = objs.length + 2; // Col A=Alumne + objectius + %

    // Capçalera assignatura (fila fusionada)
    sh.getRange(row, 1, 1, nCols).merge()
      .setValue(MATS_NOM[mat])
      .setFontWeight('bold').setFontSize(12).setFontFamily('Nunito')
      .setHorizontalAlignment('center').setBackground(GARNET_H).setFontColor('#7A1E2E');
    row++;

    // Capçalera objectius. Es munta la fila sencera i s'escriu d'un cop:
    // abans es pintava casella per casella i cada una era un viatge a Google.
    var capVals = ['Alumne'];
    objs.forEach(function(obj, i) { capVals.push(obj.nom || ('Obj.'+(i+1))); });
    capVals.push('%');
    sh.getRange(row, 1, 1, nCols).setValues([capVals])
      .setFontWeight('bold').setBackground(GARNET_M).setFontColor('#7A1E2E').setFontFamily('Nunito');
    // Centrat i ajust de text només dels objectius i el %; la casella
    // "Alumne" es queda com estava (no se li tocava l'alineació).
    sh.getRange(row, 2, 1, nCols - 1).setHorizontalAlignment('center');
    sh.getRange(row, 2, 1, objs.length).setWrap(true);
    row++;

    // Files d'alumnes: es munta tota la graella en memòria (valors, fons,
    // color de lletra, negreta i alineació) i s'escriu amb una crida per
    // cosa, en lloc d'una per casella. Amb 25 alumnes i 8 objectius això
    // passava de ~250 viatges a Google a 6 per assignatura.
    if (alumnes.length) {
      // Valors i fons van a tot el bloc (la columna del nom també en tenia).
      // El color, la negreta i l'alineació NOMÉS a partir de la columna 2:
      // a la del nom no s'hi tocaven, i deixar-la igual evita canviar-ne
      // l'aspecte encara que hi poséssim el valor per defecte.
      var vals = [], fons = [], colors = [], pesos = [], alin = [];
      alumnes.forEach(function(al) {
        var fV = [al.nom], fF = ['#FFFFFF'], fC = [], fP = [], fA = [];
        var punts = 0;
        objs.forEach(function(obj) {
          var val = al.vals ? al.vals[obj.id] : null;
          if (val === true)          { fV.push('✓'); fF.push(GREEN_BG);  fC.push(GREEN_FC);  fP.push('bold');   punts += 1;   }
          else if (val === 'partial'){ fV.push('~'); fF.push(YELLOW_BG); fC.push(YELLOW_FC); fP.push('bold');   punts += 0.5; }
          else if (val === false)    { fV.push('✗'); fF.push(RED_BG);    fC.push(RED_FC);    fP.push('bold');   }
          else                       { fV.push('—'); fF.push(GREY_BG);   fC.push(GREY_FC);   fP.push('normal'); }
          fA.push('center');
        });
        var pct = objs.length > 0 ? Math.round(punts / objs.length * 100) : 0;
        fV.push(pct + '%');
        fF.push(pct >= 80 ? GREEN_BG : pct >= 50 ? YELLOW_BG : RED_BG);
        fC.push(pct >= 80 ? GREEN_FC : pct >= 50 ? YELLOW_FC : RED_FC);
        fP.push('bold'); fA.push('center');
        vals.push(fV); fons.push(fF); colors.push(fC); pesos.push(fP); alin.push(fA);
      });
      sh.getRange(row, 1, alumnes.length, nCols)
        .setValues(vals).setBackgrounds(fons).setFontFamily('Nunito');
      sh.getRange(row, 2, alumnes.length, nCols - 1)
        .setFontColors(colors).setFontWeights(pesos).setHorizontalAlignments(alin);
      row += alumnes.length;
    }

    // Fila buida separadora
    row++;
  });

  // Auto-redimensiona
  if (sh.getLastColumn() > 0) sh.autoResizeColumns(1, sh.getLastColumn());
  return { ok: true };
}

/* ============================================================
   HELPERS GENERALS
   ============================================================ */

function getOrCreateDataSheet(ss, nom) {
  var sh = ss.getSheetByName(nom);
  if (!sh) {
    sh = ss.insertSheet(nom);
    _protegirFull(sh);
    sh.hideSheet(); // Invisible per l'usuari, és una pestanya de dades
  }
  return sh;
}

/* Una cel·la del Google Sheets admet 50.000 caràcters. Les eines que desen
   tota la seva informació en JOSN dins d'UNA cel·la (entrevistes, esmorzars,
   registres del claustre) hi poden arribar amb un curs sencer de dades. Fins
   ara no ho mirava ningú: s'hi escrivia i el full ho tallava o petava, i la
   propera lectura ja no es podia llegir. Ara s'atura ABANS d'escriure, amb
   marge, i no es toca el que ja hi ha. */
/* Quina versió del codi hi ha DESPLEGADA ara mateix a aquest Apps Script.
   Serveix perquè l'app pugui avisar quan el servidor s'ha quedat enrere:
   enganxar el Code.gs nou NO n'hi ha prou, cal desplegar-ne una versió
   nova, i fins llavors tot es veu malament sense que ningú ho digui.
   ⚠ Puja-la al mateix temps que la del sw.js/versio.js/versio.json. */
var BACKEND_VERSIO = 'v156';

var MAX_CELA = 45000;

/* ── LLEGIR UN JSON DESAT SENSE PERDRE'L ─────────────────────────────────
   Aquestes eines fan: llegir el JSON → canviar-hi una cosa → tornar-lo a
   escriure SENCER. Si la lectura fallava, el codi feia
   `catch (e) { return {}; }` i seguia: la desada següent escrivia el buit
   a sobre i s'emportava tot un curs d'entrevistes sense dir ni piu.

   Aquest ajudant distingeix tres casos, i el tercer és el perillós:
     { hi:false }                  → no hi havia res (primer cop, normal)
     { hi:true, dades:… }          → llegit bé
     { hi:true, malament:true }    → hi ha alguna cosa i NO es pot llegir
   Amb _capMalament_ el tercer cas atura la desada en comptes d'esborrar. */
function _jsonDeCela_(ss, nom, clau) {
  var v = sheetGetJSON(ss, nom, clau);
  if (v === null || v === undefined || String(v).trim() === '') return { hi: false };
  try {
    var o = JSON.parse(v);
    if (o === null || typeof o !== 'object') return { hi: true, malament: true, mida: String(v).length };
    return { hi: true, dades: o };
  } catch (e) { return { hi: true, malament: true, mida: String(v).length }; }
}

function _capMalament_(r, que) {
  if (r && r.malament) {
    throw new Error('Les dades de ' + que + ' que hi ha desades no es poden llegir (' +
      r.mida + ' caràcters). NO s\'ha desat res, per no esborrar-les. ' +
      'Avisa en Pol abans de tornar-ho a provar.');
  }
  return r;
}

function sheetSetJSON(ss, nom, clau, valor) {
  var txt = String(valor == null ? '' : valor);
  if (txt.length > MAX_CELA) {
    throw new Error('Ja no hi cap més informació a "' + clau + '": són ' +
      Math.round(txt.length / 1000) + ' mil caràcters i el full n\'admet 50 mil. ' +
      'NO s\'ha desat res, per no fer malbé el que ja hi havia. Avisa en Pol.');
  }
  var sh = getOrCreateDataSheet(ss, nom);
  // Cerca la clau a la columna A
  var lr = sh.getLastRow();
  if (lr > 0) {
    var keys = sh.getRange(1, 1, lr, 1).getValues();
    for (var i = 0; i < keys.length; i++) {
      if (keys[i][0] === clau) {
        sh.getRange(i+1, 2).setValue(valor);
        return;
      }
    }
  }
  sh.appendRow([clau, valor]);
}

function sheetGetJSON(ss, nom, clau) {
  var sh = ss.getSheetByName(nom);
  if (!sh) return null;
  var lr = sh.getLastRow();
  if (lr === 0) return null;
  var data = sh.getRange(1, 1, lr, 2).getValues();
  for (var i = 0; i < data.length; i++) {
    if (data[i][0] === clau) return data[i][1];
  }
  return null;
}

function sheetGetAll(ss, nom) {
  var sh = ss.getSheetByName(nom);
  if (!sh || sh.getLastRow() === 0) return {};
  var data = sh.getRange(1, 1, sh.getLastRow(), 2).getValues();
  var result = {};
  data.forEach(function(r) { if (r[0]) result[r[0]] = r[1]; });
  return result;
}

/* ============================================================
   PLANNING
   ============================================================ */

function savePlanning(ss, weekId, data) {
  // data = { 'dl_f1': {...}, 'dm_f2': {...}, ... }
  // notes setmana: data._notes, notes dia: data._daynote_dl, etc.
  var json = typeof data === 'string' ? data : JSON.stringify(data);
  sheetSetJSON(ss, '_AppData_Planning', weekId, json);
  return { ok: true };
}

function loadPlanning(ss, weekId) {
  var v = sheetGetJSON(ss, '_AppData_Planning', weekId);
  return { ok: true, data: v ? JSON.parse(v) : {} };
}

/* ============================================================
   TASQUES
   ============================================================ */

function saveTasques(ss, data) {
  var json = typeof data === 'string' ? data : JSON.stringify(data);
  sheetSetJSON(ss, '_AppData', 'tasques', json);
  return { ok: true };
}

function loadTasques(ss) {
  var v = sheetGetJSON(ss, '_AppData', 'tasques');
  return { ok: true, data: v ? JSON.parse(v) : [] };
}

/* ============================================================
   DISTRIBUCIÓ DE L'AULA (seients) — layout + historial parelles
   ============================================================ */

/* La clau del plànol al full _AppData.
   · Tutor (sense grup): 'seients_layout', la de sempre. Cap migració.
   · Direcció: una per grup, 'seients_layout__4t B'. No en tenen una classe
     sola: si la compartissin, en canviar de grup hi trobarien les taules
     amb els alumnes de l'altra classe assegudes. */
function _clauSeients(base, grup) {
  var g = (grup || '').toString().trim();
  return g ? (base + '__' + g) : base;
}

function saveSeients(ss, layout, history, markers, grup) {
  if (layout !== undefined && layout !== null)
    sheetSetJSON(ss, '_AppData', _clauSeients('seients_layout', grup), typeof layout === 'string' ? layout : JSON.stringify(layout));
  if (history !== undefined && history !== null)
    sheetSetJSON(ss, '_AppData', _clauSeients('seients_history', grup), typeof history === 'string' ? history : JSON.stringify(history));
  if (markers !== undefined && markers !== null)
    sheetSetJSON(ss, '_AppData', _clauSeients('seients_markers', grup), typeof markers === 'string' ? markers : JSON.stringify(markers));
  return { ok: true };
}

/* ---- Proxy de Gemini: fa la crida amb la clau del backend ----
   El frontend envia { action:'gemini', prompt:'...' } i el backend
   fa la petició a Gemini. Així la clau no surt mai del backend. ---- */
function geminiGenerate(prompt, contents) {
  var key = (_geminiKey() || '').trim();
  if (!key) return { ok:false, error:'No hi ha clau de Gemini configurada al backend' };
  var payloadContents = contents || (prompt ? [{ parts: [{ text: prompt }] }] : null);
  if (!payloadContents) return { ok:false, error:'Prompt buit' };

  // Prova diversos models per si algun està deprecat
  // Els models estan ordenats de manera que si la familia "flash" va saturada,
  // el seguent intent caigui en una GENERACIO DIFERENT (altra capacitat), no en
  // un germa que estara igual de ple.
  var models = ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.5-flash-lite'];
  var lastErr = '', saturat = false;
  for (var i = 0; i < models.length; i++) {
    try {
      var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + models[i] + ':generateContent?key=' + encodeURIComponent(key);
      var resp = UrlFetchApp.fetch(url, {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify({ contents: payloadContents }),
        muteHttpExceptions: true,
      });
      var code = resp.getResponseCode();
      var data = JSON.parse(resp.getContentText() || '{}');
      if (code === 200) {
        var text = data && data.candidates && data.candidates[0] &&
                   data.candidates[0].content && data.candidates[0].content.parts &&
                   data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text;
        if (text) return { ok:true, text: text.trim() };
        lastErr = 'Resposta buida';
      } else {
        lastErr = (data && data.error && data.error.message) || ('HTTP ' + code);
        if (code === 429) return { ok:false, error: lastErr, is429:true };
        // Model ple: esperar una mica abans del seguent. Sense pausa, els
        // intents cauen tots dins del mateix pic de saturacio i no serveixen.
        if (code === 503 || /high demand|overload|unavailable/i.test(lastErr)) {
          saturat = true;
          if (i < models.length - 1) Utilities.sleep(800);
        }
      }
    } catch(e) { lastErr = e.message; }
  }
  return { ok:false, error: lastErr || 'Error desconegut', isBusy: saturat };
}

function loadSeients(ss, grup) {
  var l = sheetGetJSON(ss, '_AppData', _clauSeients('seients_layout', grup));
  var h = sheetGetJSON(ss, '_AppData', _clauSeients('seients_history', grup));
  var m = sheetGetJSON(ss, '_AppData', _clauSeients('seients_markers', grup));
  return {
    ok: true,
    layout:  l ? JSON.parse(l) : [],
    history: h ? JSON.parse(h) : {},
    markers: m ? JSON.parse(m) : [],
  };
}

/* ---- Post-its ---- */
function savePostits(ss, postits) {
  sheetSetJSON(ss, '_AppData', 'postits', typeof postits === 'string' ? postits : JSON.stringify(postits || []));
  return { ok: true };
}
function loadPostits(ss) {
  var p = sheetGetJSON(ss, '_AppData', 'postits');
  return { ok: true, postits: p ? JSON.parse(p) : [] };
}

/* ---- HORARI (plantilla setmanal) ---- */
function saveHorari(ss, horari) {
  sheetSetJSON(ss, '_AppData', 'horari', typeof horari === 'string' ? horari : JSON.stringify(horari || {}));
  return { ok: true };
}
function loadHorari(ss) {
  var h = sheetGetJSON(ss, '_AppData', 'horari');
  return { ok: true, horari: h ? JSON.parse(h) : {} };
}

// Desa la llista de matèries que apareixen a l'horari (perquè l'app les reconegui)
function saveHorariAssigs(ss, assigs) {
  sheetSetJSON(ss, '_AppData', 'horari_assigs', JSON.stringify(assigs || []));
  return { ok: true };
}
function loadHorariAssigs(ss) {
  var a = sheetGetJSON(ss, '_AppData', 'horari_assigs');
  return { ok: true, assigs: a ? JSON.parse(a) : [] };
}

// Aplica l'horari a TOTES les setmanes del curs d'un sol cop (eficient).
// Rep l'horari {dia_franja: assig} i la llista de weekIds; per a cada setmana
// carrega el planning existent, hi posa l'assignatura NOMÉS on la cel·la sigui
// normal i no en tingui ja cap, i torna a desar. No trepitja res escrit.
function aplicarHorariPlanning(ss, horari, weekIds) {
  if (!horari || !weekIds || !weekIds.length) return { ok:false, error:'Falten dades' };
  var claus = Object.keys(horari);
  var tocades = 0;
  for (var w = 0; w < weekIds.length; w++) {
    var weekId = weekIds[w];
    var existent = sheetGetJSON(ss, '_AppData_Planning', weekId);
    var setmana = existent ? JSON.parse(existent) : {};
    var canvis = false;
    for (var c = 0; c < claus.length; c++) {
      var cellKey = claus[c];               // "dl_f1"
      // La zona de vigilància del pati es queda a l'horari; no s'aplica al
      // planning (que renderitza el pati de manera especial).
      if (cellKey.split('_')[1] === 'f3') continue;
      var assig = horari[cellKey];
      if (!assig) continue;
      var cell = setmana[cellKey];
      if (!cell) cell = { tipus: 'normal' };
      if (cell.tipus === 'normal' && !cell.assig) {
        cell.assig = assig;
        setmana[cellKey] = cell;
        canvis = true;
        tocades++;
      }
    }
    if (canvis) {
      sheetSetJSON(ss, '_AppData_Planning', weekId, JSON.stringify(setmana));
    }
  }
  return { ok:true, tocades: tocades };
}

/* ============================================================
   PERFIL DEL MESTRE
   ============================================================ */

function saveProfile(ss, profile) {
  var json = typeof profile === 'string' ? profile : JSON.stringify(profile);
  sheetSetJSON(ss, '_AppData', 'profile', json);
  return { ok: true };
}

function loadProfile(ss) {
  var v = sheetGetJSON(ss, '_AppData', 'profile');
  return { ok: true, profile: v ? JSON.parse(v) : null };
}

/* ============================================================
   CALENDARI
   ============================================================ */

function saveCalendari(ss, year, data) {
  var json = typeof data === 'string' ? data : JSON.stringify(data);
  sheetSetJSON(ss, '_AppData', 'cal_events_' + year, json);
  return { ok: true };
}

function loadCalendari(ss, year) {
  var v = sheetGetJSON(ss, '_AppData', 'cal_events_' + year);
  return { ok: true, data: v ? JSON.parse(v) : [] };
}

function saveCalendariCats(ss, data) {
  var json = typeof data === 'string' ? data : JSON.stringify(data);
  sheetSetJSON(ss, '_AppData', 'cal_cats', json);
  return { ok: true };
}

function loadCalendariCats(ss) {
  var v = sheetGetJSON(ss, '_AppData', 'cal_cats');
  return { ok: true, data: v ? JSON.parse(v) : null };
}

/* ============================================================
   ASSOLIMENTS — objectius i valors
   ============================================================ */

function _assimKey(materia, trimestre) { return materia + '_' + trimestre; }

function saveAssimObjectius(ss, materia, trimestre, data) {
  var json = typeof data === 'string' ? data : JSON.stringify(data);
  sheetSetJSON(ss, '_AppData_Assim', 'obj_' + _assimKey(materia, trimestre), json);
  return { ok: true };
}

function loadAssimObjectius(ss, materia, trimestre) {
  var v = sheetGetJSON(ss, '_AppData_Assim', 'obj_' + _assimKey(materia, trimestre));
  return { ok: true, data: v ? JSON.parse(v) : [] };
}

function saveAssimValors(ss, materia, trimestre, data) {
  // data = { studentId: { objId: val } }
  var json = typeof data === 'string' ? data : JSON.stringify(data);
  sheetSetJSON(ss, '_AppData_Assim', 'vals_' + _assimKey(materia, trimestre), json);
  return { ok: true };
}

function loadAssimValors(ss, materia, trimestre) {
  var v = sheetGetJSON(ss, '_AppData_Assim', 'vals_' + _assimKey(materia, trimestre));
  return { ok: true, data: v ? JSON.parse(v) : {} };
}

/* ============================================================
   ACTITUD
   ============================================================ */

function saveActitudData(ss, materia, trimestre, data) {
  // data = { studentId: { participacio, atencio, ... } }
  var json = typeof data === 'string' ? data : JSON.stringify(data);
  sheetSetJSON(ss, '_AppData_Actitud', materia + '_' + trimestre, json);
  return { ok: true };
}

function loadActitudData(ss, materia, trimestre) {
  var v = sheetGetJSON(ss, '_AppData_Actitud', materia + '_' + trimestre);
  return { ok: true, data: v ? JSON.parse(v) : {} };
}

/* ============================================================
   CÀRREGA CONSOLIDADA — tot en una sola crida (ràpid a l'arrencada)
   ============================================================ */
function parseWeekIds(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw); } catch(e) { return []; }
}

/* Funció de test per executar des de l'editor Apps Script.
   Selecciona aquesta funció al desplegable i clica "Executar" per provar. */
function _testLoadAppData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var r  = loadAppData(ss, []);
  Logger.log(JSON.stringify(r, null, 2));
  return r;
}

function loadAppData(ss, weekIds, appDataPre) {
  var result = { ok: true };

  // Planning de les setmanes demanades. El navegador en demana SEMPRE tres
  // (la d'abans, l'actual i la següent). Abans es cridava `sheetGetJSON` per
  // cada una, i cada crida rellegia el full _AppData_Planning SENCER: tres
  // lectures completes per a tres claus. Ara es llegeix un cop i les claus
  // es busquen en memòria, com ja es feia amb _AppData.
  result.planning = {};
  var ids = weekIds || [];
  if (ids.length) {
    var planTot = sheetGetAll(ss, '_AppData_Planning');
    ids.forEach(function(wid) {
      var v = planTot[wid];
      if (v) { try { result.planning[wid] = JSON.parse(v); } catch(e) {} }
    });
  }

  // Tasques + calendari (de _AppData). Si ja s'ha llegit abans (bootstrap),
  // el reutilitzem per no tornar a llegir tot el full.
  var appData = appDataPre || sheetGetAll(ss, '_AppData');
  result.tasques  = appData['tasques'] ? JSON.parse(appData['tasques']) : [];
  result.calCats  = appData['cal_cats'] ? JSON.parse(appData['cal_cats']) : null;
  result.calEvents = {};
  Object.keys(appData).forEach(function(k) {
    if (k.indexOf('cal_events_') === 0) {
      var year = k.replace('cal_events_', '');
      result.calEvents[year] = JSON.parse(appData[k]);
    }
  });

  // Assoliments (objectius + valors) de _AppData_Assim
  result.assim = sheetGetAll(ss, '_AppData_Assim');

  // Actitud de _AppData_Actitud
  result.actitud = sheetGetAll(ss, '_AppData_Actitud');

  return result;
}

/* ============================================================
   BOOTSTRAP — UNA SOLA CRIDA que ho retorna TOT per a l'arrencada.
   Consolida: dades principals, planning/tasques/calendari/assoliments,
   perfil, IDs dels fulls, i alumnes del grup de tutoria (amb desdoblament).
   Això substitueix 5-7 crides encadenades per una de sola.
   ============================================================ */
function bootstrap(ss, weekIds) {
  var result = { ok: true, backendVersio: BACKEND_VERSIO };

  // Llegim TOT el full _AppData una sola vegada (en comptes de rellegir-lo a
  // cada sheetGetJSON). Estalvia diverses lectures completes del full → més ràpid.
  var appData = {};
  try { appData = sheetGetAll(ss, '_AppData') || {}; } catch(e) { appData = {}; }

  // 1) Perfil
  var perfil = null;
  try {
    var pv = appData['profile'];
    perfil = pv ? JSON.parse(pv) : null;
  } catch(e) {}
  result.profile = perfil;

  // 2) IDs dels fulls compartits (propi o compartit per defecte)
  var grupsIdPropi  = appData['grups_sheet_id'];
  var desdobIdPropi = appData['desdob_sheet_id'];
  result.grupsSheetId  = (grupsIdPropi  && String(grupsIdPropi).trim())  ? String(grupsIdPropi).trim()  : (FULLS_COMPARTITS.grups  || '');
  result.desdobSheetId = (desdobIdPropi && String(desdobIdPropi).trim()) ? String(desdobIdPropi).trim() : (FULLS_COMPARTITS.desdob || '');

  // 3) Grup de tutoria (del perfil)
  var tutorGrup = null;
  if (perfil && perfil.tutorCurs && perfil.tutorLinia) {
    tutorGrup = perfil.tutorCurs + ' ' + perfil.tutorLinia;
  }
  result.tutorGrup = tutorGrup;

  // 4) Alumnes: si hi ha grup de tutoria i full "Grups", agafa'ls d'allà;
  //    si no, del full personal (compatibilitat)
  if (tutorGrup) {
    // L'ID ja el tenim del _AppData llegit a dalt: obrir-lo directament
    // estalvia que getGrupsSpreadsheet() torni a llegir el full sencer.
    var gss = null;
    if (result.grupsSheetId) {
      try { gss = SpreadsheetApp.openById(result.grupsSheetId); } catch(e) { gss = null; }
    }
    if (gss) {
      var ga = getGrupAlumnes(gss, tutorGrup);
      result.grupAlumnes = ga.alumnes || [];
      result.grupAlumnesOk = true;
      // Observacions compartides del grup de tutoria (reusant el gss ja obert)
      try {
        var go = _getGrupObsWith(gss, tutorGrup);
        result.grupObs = go.obs || {};
      } catch(e) { result.grupObs = {}; }
    } else {
      result.grupAlumnes = [];
      result.grupAlumnesOk = false;
    }
  }
  // Sempre inclou els del full personal com a reserva (registre, observacions...)
  result.alumnes      = getAlumnes(ss).alumnes;
  result.registre     = getRegistre(ss);
  result.personal     = getAllPersonal(ss).personal;

  // Observacions llegades (les 21 pestanyes del full personal: 3 trimestres ×
  // 7 assignatures). NOMÉS es calculen si no hi ha les compartides del full
  // "Grups", perquè el navegador, quan les té, aquestes les llença: veure
  // `_processBootstrap` a js/app.js ("else if (boot.observacions)"). Per a un
  // tutor, això eren ~80 anades i tornades a Google a cada arrencada per a
  // res.
  var teCompartides = !!(result.grupObs && result.grupAlumnes && result.grupAlumnes.length);
  result.observacions = teCompartides ? {} : getObservacions(ss).observacions;

  // 5) Planning / tasques / calendari / assoliments / actitud (com loadAppData)
  var appDataBundle = loadAppData(ss, weekIds, appData);
  result.planning  = appDataBundle.planning;
  result.tasques   = appDataBundle.tasques;
  result.calCats   = appDataBundle.calCats;
  result.calEvents = appDataBundle.calEvents;
  result.assim     = appDataBundle.assim;
  result.actitud   = appDataBundle.actitud;

  // 6) Seients (de la lectura única de _AppData; evita 3 lectures redundants)
  try {
    result.seients = {
      ok: true,
      layout:  appData['seients_layout']  ? JSON.parse(appData['seients_layout'])  : [],
      history: appData['seients_history'] ? JSON.parse(appData['seients_history']) : {},
      markers: appData['seients_markers'] ? JSON.parse(appData['seients_markers']) : []
    };
  } catch(e) { result.seients = null; }

  // 7) Post-its (de la lectura única de _AppData)
  try {
    var pvp = appData['postits'];
    result.postits = pvp ? JSON.parse(pvp) : [];
  } catch(e) { result.postits = []; }

  // 8) Horari (de la lectura única de _AppData)
  try {
    var hv = appData['horari'];
    result.horari = hv ? JSON.parse(hv) : {};
  } catch(e) { result.horari = {}; }

  return result;
}

/* ============================================================
   GOOGLE CALENDAR — llegeix events del mes del calendari del compte
   ============================================================ */
function getGoogleCalendarEvents(year, month) {
  try {
    var start = new Date(year, month - 1, 1);
    var end   = new Date(year, month, 0, 23, 59, 59);
    var cals  = CalendarApp.getAllCalendars();
    var result = [];

    cals.forEach(function(cal) {
      // Inclou tots els calendaris visibles excepte els de dies festius i aniversaris
      var name = cal.getName();
      if (!cal.isHidden() && name !== 'Festius a Espanya' && name !== 'Contactes') {
        cal.getEvents(start, end).forEach(function(ev) {
          var startDt = ev.getStartTime();
          var pad     = function(n){ return String(n).padStart(2,'0'); };
          var dateStr = startDt.getFullYear()+'-'+pad(startDt.getMonth()+1)+'-'+pad(startDt.getDate());
          var hora    = '';
          if (!ev.isAllDayEvent()) {
            hora = pad(startDt.getHours())+':'+pad(startDt.getMinutes())+'h';
          }
          result.push({
            id:       'gcal_' + ev.getId().replace(/[^a-zA-Z0-9]/g,'_'),
            titol:    ev.getTitle(),
            data:     dateStr,
            hora:     hora,
            desc:     ev.getDescription() || '',
            link:     ev.getOriginalCalendarId ? '' : '',
            calNom:   cal.getName(),
            calColor: cal.getColor() || '#4285F4',
            fromGCal: true,
          });
        });
      }
    });

    // Ordena per data i hora
    result.sort(function(a,b){ return (a.data+a.hora).localeCompare(b.data+b.hora); });
    return { ok: true, events: result };
  } catch(err) {
    return { ok: false, error: err.message };
  }
}

/* ============================================================
   GOOGLE TASKS — llegeix les tasques pendents de totes les llistes
   ============================================================ */
function getGoogleTasks() {
  try {
    var taskLists = Tasks.Tasklists.list({ maxResults: 10 });
    var result = [];
    if (!taskLists.items || !taskLists.items.length) return { ok: true, tasks: [] };
    taskLists.items.forEach(function(list) {
      var tasks = Tasks.Tasks.list(list.id, { showCompleted: false, showHidden: false, maxResults: 50 });
      if (!tasks.items) return;
      tasks.items.forEach(function(t) {
        if (t.status === 'completed') return;
        result.push({
          id:    t.id,
          titol: t.title || '',
          notes: t.notes || '',
          data:  t.due ? t.due.split('T')[0] : '',
          llista: list.title || '',
          // Fa falta per poder-la marcar com a feta: sense l'id de la
          // llista, l'API de Tasks no sap on buscar-la.
          llistaId: list.id,
        });
      });
    });
    result.sort(function(a,b){ if(a.data&&b.data)return a.data.localeCompare(b.data); if(a.data)return -1; if(b.data)return 1; return 0; });
    return { ok: true, tasks: result };
  } catch(err) {
    return { ok: false, error: err.message };
  }
}


/* Marca (o desmarca) una tasca del Google Tasks.
   Abans no es podia: el botó de la caseta, a les tasques que venien de
   Google, no feia RES, i el rètol deia "Marcar com a feta". La mestra
   clicava i no passava res.

   Si no ens arriba l'id de la llista (una app que encara no ha
   redesplegat el Code.gs), es busca la tasca per totes les llistes. */
function completaGoogleTask(taskId, llistaId, fet) {
  try {
    if (!taskId) return { ok: false, error: 'Falta la tasca' };
    var estat = (fet === false) ? 'needsAction' : 'completed';
    var llistes = llistaId
      ? [{ id: llistaId }]
      : ((Tasks.Tasklists.list({ maxResults: 20 }).items) || []);
    if (!llistes.length) return { ok: false, error: 'No tens cap llista al Google Tasks' };

    for (var i = 0; i < llistes.length; i++) {
      var idLlista = llistes[i].id;
      try {
        var r = _gRetry_(function () {
          return Tasks.Tasks.patch({ status: estat }, idLlista, taskId);
        });
        return { ok: true, id: r.id, llistaId: idLlista, estat: estat };
      } catch (e) {
        // Si no és a AQUESTA llista, prova la següent. Qualsevol altre
        // error (permisos, quota) sí que s'ha de dir.
        if (!_gEsNoHiEs_((e && e.message) || e)) throw e;
      }
    }
    return { ok: false, error: 'No s\'ha trobat aquesta tasca al Google Tasks. Potser ja l\'has esborrada des del Google.' };
  } catch (err) {
    return { ok: false, error: (err && err.message) || String(err) };
  }
}

/* ============================================================
   ESCRIPTURA A GOOGLE CALENDAR I GOOGLE TASKS
   ------------------------------------------------------------
   Regles que se segueixen (i per que):
   1. L'id de Google es desa SEMPRE al costat de l'element. El genera el
      frontend ABANS d'enviar-lo: per aixo crear es repetible sense duplicar.
   2. Calendar: servei avancat (no CalendarApp), perque nomes ell deixa
      enviar l'id propi. Si ja existeix, Google diu "already exists", i aixo
      vol dir que la creacio anterior va funcionar (no es cap avaria).
   3. L'hora de fi surt de la dada. "+1 hora" nomes quan no se'n sap cap.
      Si l'hora de fi es anterior a la d'inici, vol dir l'endema.
   4. Sempre s'envia timeZone.
   5. Tasks: de "due" Google nomes es queda el DIA. L'app no demana hora a
      les tasques, aixi que no promet res que Google llenci.
   ============================================================ */

function _gTz_() {
  try { return Session.getScriptTimeZone() || 'Europe/Madrid'; }
  catch (e) { return 'Europe/Madrid'; }
}

// "17:00h" -> "17:00" | "9h" -> "09:00" | buit -> null
function _gHora_(h) {
  if (!h) return null;
  var m = String(h).match(/(\d{1,2})\s*[:.h]?\s*(\d{2})?/);
  if (!m) return null;
  var hh = parseInt(m[1], 10), mm = m[2] ? parseInt(m[2], 10) : 0;
  if (isNaN(hh) || hh > 23 || mm > 59) return null;
  return (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm;
}
function _gDiaSeguent_(d) {
  var p = String(d).split('-');
  var dt = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
  dt.setDate(dt.getDate() + 1);
  var pad = function (x) { return (x < 10 ? '0' : '') + x; };
  return dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate());
}
function _gMesUnaHora_(hhmm) {
  var p = hhmm.split(':');
  var h = (parseInt(p[0], 10) + 1) % 24;
  return (h < 10 ? '0' : '') + h + ':' + p[1];
}

// Recurs d'esdeveniment (regles 3 i 4)
function _gcalRecurs_(ev, id) {
  var tz = _gTz_();
  var r = { summary: String(ev.titol || 'Sense titol').substring(0, 1024) };
  var desc = [];
  if (ev.desc) desc.push(ev.desc);
  if (ev.link) desc.push(ev.link);
  if (desc.length) r.description = desc.join('\n\n');
  if (id) r.id = id;

  var ini = _gHora_(ev.hora);
  if (!ini) {
    // Tot el dia: "end" es EXCLUSIU, per aixo va a l'endema
    r.start = { date: ev.data };
    r.end   = { date: _gDiaSeguent_(ev.data) };
    return r;
  }
  var fi = _gHora_(ev.horaFi);
  if (!fi) fi = _gMesUnaHora_(ini);                 // nomes quan no se sap la durada
  var dataFi = ev.data;
  if (fi <= ini) dataFi = _gDiaSeguent_(ev.data);   // "de 23:00 a 00:30" = l'endema
  r.start = { dateTime: ev.data + 'T' + ini + ':00', timeZone: tz };
  r.end   = { dateTime: dataFi + 'T' + fi  + ':00', timeZone: tz };
  return r;
}

function _gEsPassatger_(msg) {
  return /rate limit|quota exceeded|backend error|internal error|try again|unavailable|503|429|timed? ?out|deadline/i.test(String(msg || ''));
}
function _gEsNoHiEs_(msg) {
  return /not found|404|has been deleted|deleted/i.test(String(msg || ''));
}
// Reintent amb espera creixent (1s, 4s, 16s). Mai per errors d'autoritzacio.
function _gRetry_(fn) {
  var esperes = [1000, 4000, 16000];
  for (var i = 0; ; i++) {
    try { return fn(); }
    catch (err) {
      var m = String((err && err.message) || err);
      if (!_gEsPassatger_(m) || i >= esperes.length) throw err;
      Utilities.sleep(esperes[i]);
    }
  }
}

/* ---- Calendar ---- */
function _gcalDesa_(ev) {
  var calId = ev.gCal || 'primary';
  if (!ev.data) return { ok: false, error: 'Sense data' };
  if (!ev.gId)  return { ok: false, error: 'Sense id de Google' };

  // 1r intent: CREAR amb el NOSTRE id (reintentar no duplica)
  try {
    var creat = _gRetry_(function () { return Calendar.Events.insert(_gcalRecurs_(ev, ev.gId), calId); });
    return { ok: true, gId: creat.id, gCal: calId };
  } catch (e) {
    if (!/already exists/i.test(String(e.message))) return { ok: false, error: String(e.message) };
  }
  // Ja existia -> la creacio anterior va funcionar. Si el van esborrar des de
  // Google, alla guanya Google i no el ressuscitem.
  try {
    var actual = Calendar.Events.get(calId, ev.gId);
    if (actual && actual.status === 'cancelled') return { ok: false, gone: true, error: 'esborrat-a-google' };
  } catch (eGet) {
    if (_gEsNoHiEs_(eGet.message)) return { ok: false, gone: true, error: 'esborrat-a-google' };
  }
  try {
    var upd = _gRetry_(function () { return Calendar.Events.patch(_gcalRecurs_(ev, null), calId, ev.gId); });
    return { ok: true, gId: upd.id, gCal: calId };
  } catch (e2) {
    if (_gEsNoHiEs_(e2.message)) return { ok: false, gone: true, error: 'esborrat-a-google' };
    return { ok: false, error: String(e2.message) };
  }
}

function _gcalEsborra_(gId, gCal) {
  try {
    _gRetry_(function () { Calendar.Events.remove(gCal || 'primary', gId); });
    return { ok: true };
  } catch (err) {
    if (_gEsNoHiEs_(err.message)) return { ok: true, jaNoHiEra: true };
    return { ok: false, error: String(err.message) };
  }
}

/* ---- Tasks ---- */
function _gtaskRecurs_(t) {
  var r = {
    title:  String(t.titol || 'Sense titol').substring(0, 1024),
    notes:  String(t.desc || '').substring(0, 8192),
    status: t.feta ? 'completed' : 'needsAction'
  };
  // ATENCIO: de "due" Google nomes es queda el DIA (llenca l'hora).
  if (t.data) r.due = t.data + 'T00:00:00.000Z';
  return r;
}

function _gtaskDesa_(t) {
  var llista = t.gList || '@default';
  // Tasks no deixa enviar l'id: l'unica proteccio contra duplicats es no
  // tornar a crear allo que ja te gId desat.
  if (t.gId) {
    try {
      var upd = _gRetry_(function () { return Tasks.Tasks.patch(_gtaskRecurs_(t), llista, t.gId); });
      return { ok: true, gId: upd.id, gList: llista };
    } catch (e) {
      if (_gEsNoHiEs_(e.message)) return { ok: false, gone: true, error: 'esborrada-a-google' };
      return { ok: false, error: String(e.message) };
    }
  }
  try {
    var creat = _gRetry_(function () { return Tasks.Tasks.insert(_gtaskRecurs_(t), llista); });
    return { ok: true, gId: creat.id, gList: llista };
  } catch (err) {
    return { ok: false, error: String(err.message) };
  }
}

function _gtaskEsborra_(gId, gList) {
  try {
    _gRetry_(function () { Tasks.Tasks.remove(gList || '@default', gId); });
    return { ok: true };
  } catch (err) {
    if (_gEsNoHiEs_(err.message)) return { ok: true, jaNoHiEra: true };
    return { ok: false, error: String(err.message) };
  }
}

/* ---- Punt d'entrada: tot en un sol lot (estalvia quota) ----
   canvis = { events:[], tasks:[], esborrarEvents:[{gId,gCal}], esborrarTasks:[{gId,gList}] }
   Torna un resultat per element, indexat per l'id LOCAL de l'app. */
function gwriteSync(canvis) {
  if (!canvis) return { ok: false, error: 'Sense canvis' };
  if (typeof canvis === 'string') {
    try { canvis = JSON.parse(canvis); } catch (e) { return { ok: false, error: 'Canvis illegibles' }; }
  }
  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); }
  catch (e) { return { ok: false, error: 'Hi ha una altra sincronitzacio en marxa' }; }
  try {
    var res = { ok: true, events: {}, tasks: {}, esborrats: { events: {}, tasks: {} } };
    (canvis.events || []).forEach(function (ev) { res.events[ev.id] = _gcalDesa_(ev); });
    (canvis.tasks  || []).forEach(function (t)  { res.tasks[t.id]  = _gtaskDesa_(t); });
    (canvis.esborrarEvents || []).forEach(function (d) { if (d && d.gId) res.esborrats.events[d.gId] = _gcalEsborra_(d.gId, d.gCal); });
    (canvis.esborrarTasks  || []).forEach(function (d) { if (d && d.gId) res.esborrats.tasks[d.gId]  = _gtaskEsborra_(d.gId, d.gList); });
    return res;
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}



/* ============================================================
   DIAGNOSTIC — comprova que es pot ESCRIURE al Calendar i a Tasks
   ------------------------------------------------------------
   Executa aquesta funcio UN COP des de l'editor d'Apps Script
   (tria "provaEscripturaGoogle" i prem Executar).

   Que fa: crea un event de prova i una tasca de prova, comprova que
   s'han creat, i tot seguit ELS ESBORRA. No queda res al teu Google.
   Si falta cap permis, aqui es quan sortira la finestra d'autoritzacio.

   El resultat surt al registre d'execucio (Ctrl+Enter per veure'l).
   ============================================================ */
function provaEscripturaGoogle() {
  var linies = [];
  var diu = function (t) { linies.push(t); Logger.log(t); };

  diu('--- Permisos REALMENT concedits ---');
  var concedits = [];
  try {
    var tok = ScriptApp.getOAuthToken();
    var resp = UrlFetchApp.fetch(
      'https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=' + encodeURIComponent(tok),
      { muteHttpExceptions: true });
    var info = JSON.parse(resp.getContentText() || '{}');
    concedits = String(info.scope || '').split(' ').filter(function (x) { return x; });
    concedits.sort().forEach(function (sc) { diu('  ' + sc); });
    if (!concedits.length) diu('  (no s han pogut llegir)');
  } catch (e) { diu('  no s han pogut llegir: ' + e.message); }

  diu('');
  diu('--- Els que calen ---');
  var calen = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/script.external_request',
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/tasks'
  ];
  calen.forEach(function (sc) {
    var te = concedits.indexOf(sc) !== -1;
    diu('  ' + (te ? '[SI] ' : '[FALTA] ') + sc);
  });

  // ---- CALENDAR ----
  diu('');
  diu('--- Google Calendar ---');
  diu('  Zona horària d\'aquest script: ' + _gTz_());

  /* Provem l'event PAS A PAS per saber QUINA PART rebutja Google. Amb un
     "Bad Request" pelat no es pot fer res; sabent quin tros falla, sí.
     El 4 de setembre del 2026 una reserva d'una família va fallar amb
     "calendar.events.insert ha fallat: Bad Request" i no hi havia manera
     de saber per què. */
  (function () {
    var dm = new Date(); dm.setDate(dm.getDate() + 2);
    var p2 = function (n) { return (n < 10 ? '0' : '') + n; };
    var dia = dm.getFullYear() + '-' + p2(dm.getMonth() + 1) + '-' + p2(dm.getDate());
    var base = function () {
      return { summary: 'PROVA pas a pas (s esborra sola)',
               start: { dateTime: dia + 'T18:00:00', timeZone: _gTz_() },
               end:   { dateTime: dia + 'T18:15:00', timeZone: _gTz_() } };
    };
    var jo = '';
    try { jo = Session.getActiveUser().getEmail() || ''; } catch (e) {}

    var passos = [
      ['el mínim (sense res més)', function () { return Calendar.Events.insert(base(), 'primary'); }],
      ['amb la teva zona horària', function () {
        var e = base(); e.start.timeZone = _gTz_(); e.end.timeZone = _gTz_();
        return Calendar.Events.insert(e, 'primary'); }],
      ['amb un convidat (com una reserva de família)', function () {
        var e = base(); e.attendees = [{ email: jo || 'ningu@example.com' }];
        return Calendar.Events.insert(e, 'primary', { sendUpdates: 'none' }); }],
      ['amb un id nostre (com el calendari de l\'app)', function () {
        var e = base(); e.id = 'provavedruna' + String(Date.now()).slice(-9);
        return Calendar.Events.insert(e, 'primary'); }],
    ];
    passos.forEach(function (p) {
      try {
        var c = p[1]();
        diu('  [BE]    ' + p[0]);
        try { Calendar.Events.remove('primary', c.id); } catch (e) {}
      } catch (e) {
        diu('  [FALLA] ' + p[0] + '  →  ' + (e && e.message ? e.message : e));
      }
    });
  })();

  diu('');
  var idProva = 'provavedruna' + String(Date.now()).slice(-8);
  try {
    var dema = new Date(); dema.setDate(dema.getDate() + 1);
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };
    var d = dema.getFullYear() + '-' + pad(dema.getMonth() + 1) + '-' + pad(dema.getDate());

    var creat = Calendar.Events.insert({
      id: idProva,
      summary: 'PROVA app (s esborra sola)',
      start: { dateTime: d + 'T09:00:00', timeZone: 'Europe/Madrid' },
      end:   { dateTime: d + 'T11:00:00', timeZone: 'Europe/Madrid' }
    }, 'primary');
    diu('  CREAT correctament. id = ' + creat.id);

    // Comprova que l hora de fi es la bona (regla 3)
    var llegit = Calendar.Events.get('primary', idProva);
    diu('  Inici: ' + llegit.start.dateTime);
    diu('  Fi:    ' + llegit.end.dateTime + '   <-- ha de ser a les 11:00, no a les 10:00');

    // Comprova la idempotencia (regla 2): crear-lo un altre cop amb el mateix id
    try {
      Calendar.Events.insert({
        id: idProva, summary: 'x',
        start: { dateTime: d + 'T09:00:00', timeZone: 'Europe/Madrid' },
        end:   { dateTime: d + 'T11:00:00', timeZone: 'Europe/Madrid' }
      }, 'primary');
      diu('  ATENCIO: repetir la creacio NO ha donat error (revisar)');
    } catch (eDup) {
      if (/already exists/i.test(eDup.message)) diu('  Repetir la creacio dona "ja existeix" -> correcte, no duplicara');
      else diu('  Repetir dona un altre error: ' + eDup.message);
    }

    Calendar.Events.remove('primary', idProva);
    diu('  ESBORRAT. No queda res al calendari.');
  } catch (err) {
    diu('  HA FALLAT: ' + err.message);
    if (/permission|authoriz|scope/i.test(err.message)) diu('  >> Sembla un problema de PERMISOS.');
    try { Calendar.Events.remove('primary', idProva); } catch (e2) {}
  }

  // ---- TASKS ----
  diu('');
  diu('--- Google Tasks ---');
  try {
    var t = Tasks.Tasks.insert({ title: 'PROVA app (s esborra sola)', notes: 'diagnostic' }, '@default');
    diu('  CREADA correctament. id = ' + t.id);
    Tasks.Tasks.remove('@default', t.id);
    diu('  ESBORRADA. No queda res a Tasks.');
  } catch (err2) {
    diu('  HA FALLAT: ' + err2.message);
    if (/permission|authoriz|scope/i.test(err2.message)) diu('  >> Sembla un problema de PERMISOS.');
  }

  diu('');
  diu('--- Fi del diagnostic ---');
  return linies.join('\n');
}


/* ============================================================
   RUBRIQUES DEL GENERADOR DE COMENTARIS  +  ASPECTES D'ACTITUD
   ------------------------------------------------------------
   Abans estaven escrits al codi, o sigui que eren els d'un sol mestre.
   Ara cada mestre es defineix els seus des de l'app i es desen al SEU
   full, com la resta de dades.

   rubrica_{materia} = { objectius: [ { id, nom, nivells: [4 textos] } ] }
   actitud_aspectes  = [ { id, nom } ]
   ============================================================ */

/* Comentari d'un alumne sobre UNA activitat concreta.
   Es desa com a nota de la cel·la de la puntuacio: queda al costat de la nota
   i tambe es veu obrint el full de calcul. */
function saveNotaComentari(ss, materia, trimestre, itemId, nom, text, grup) {
  var nomBase = _materiaNomBase(materia);
  if (!nomBase) return { ok:false, error:'Materia desconeguda' };
  var sh = ss.getSheetByName(_notesTabName(trimestre, nomBase, grup));
  if (!sh) return { ok:false, error:'Pestanya no trobada' };

  var lc = sh.getLastColumn();
  var metas = sh.getRange(1, 1, 1, lc).getNotes()[0];
  var col = -1;
  metas.forEach(function (m, i) {
    var p = (m || '').split('|');
    if (p.length === 3 && parseInt(p[2]) === parseInt(itemId)) col = i + 1;
  });
  if (col === -1) return { ok:false, error:'Activitat no trobada' };

  var rowP = _trobaFilaAlumne(sh, nom);
  if (rowP === -1) return { ok:false, error:'Alumne no trobat: ' + nom };

  var net = (text || '').toString().trim();
  sh.getRange(rowP, col).setNote(net || null);
  return { ok:true };
}

function saveRubrica(ss, materia, data) {
  if (!materia) return { ok: false, error: 'Falta la materia' };
  var json = typeof data === 'string' ? data : JSON.stringify(data || {});
  sheetSetJSON(ss, '_AppData', 'rubrica_' + materia, json);
  return { ok: true };
}

function loadRubrica(ss, materia) {
  if (!materia) return { ok: false, error: 'Falta la materia' };
  var v = sheetGetJSON(ss, '_AppData', 'rubrica_' + materia);
  return { ok: true, data: v ? JSON.parse(v) : null };
}

/* Estil de redaccio del mestre per als comentaris: to, llargada i, sobretot,
   exemples de comentaris seus perque la IA els imiti. */
function saveComentEstil(ss, data) {
  var json = typeof data === 'string' ? data : JSON.stringify(data || {});
  sheetSetJSON(ss, '_AppData', 'coment_estil', json);
  return { ok: true };
}
function loadComentEstil(ss) {
  var v = sheetGetJSON(ss, '_AppData', 'coment_estil');
  return { ok: true, data: v ? JSON.parse(v) : null };
}

function saveActitudAspectes(ss, data) {
  var json = typeof data === 'string' ? data : JSON.stringify(data || []);
  sheetSetJSON(ss, '_AppData', 'actitud_aspectes', json);
  return { ok: true };
}

function loadActitudAspectes(ss) {
  var v = sheetGetJSON(ss, '_AppData', 'actitud_aspectes');
  return { ok: true, data: v ? JSON.parse(v) : null };
}

function jsonResponse(data){
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

/* Executa des de l'editor per veure l'estructura del full d'alumnes */
function diagnosticAlumnes() {
  var ss  = SpreadsheetApp.getActiveSpreadsheet();
  var sh  = ss.getSheetByName('Alumnes');
  if (!sh) { Logger.log('NO EXISTEIX pestanya Alumnes'); return; }
  var lr  = sh.getLastRow(), lc = sh.getLastColumn();
  Logger.log('Files: ' + lr + ', Columnes: ' + lc);
  Logger.log('Fila 1 (capçaleres): ' + JSON.stringify(sh.getRange(1,1,1,lc).getValues()[0]));
  if (lr >= 2) Logger.log('Fila 2 (primer alumne): ' + JSON.stringify(sh.getRange(2,1,1,lc).getValues()[0]));
  if (lr >= 3) Logger.log('Fila 3 (segon alumne): ' + JSON.stringify(sh.getRange(3,1,1,lc).getValues()[0]));
}

/* Aplica Nunito a totes les pestanyes del full de càlcul */
function applyNunitoToAll() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.getSheets().forEach(function(sh) {
    var lc = sh.getLastColumn(), lr = sh.getLastRow();
    if (lc > 0 && lr > 0) sh.getRange(1,1,lr,lc).setFontFamily('Nunito');
  });
  SpreadsheetApp.getUi().alert('Nunito aplicat a totes les pestanyes!');
}

function migrateOldFormat(){
  var ss=SpreadsheetApp.getActiveSpreadsheet(),sh=ss.getSheetByName(TABS.registre);if(!sh)return;
  var lc=sh.getLastColumn();if(lc<2)return;
  var hdrs=sh.getRange(1,2,1,lc-1).getValues()[0];
  hdrs.forEach(function(h,idx){
    if(!h)return;var p=h.toString().split('|');
    if(p.length===3&&!isNaN(parseInt(p[2]))){var c=sh.getRange(1,idx+2);c.setValue(p[0]);c.setNote(p[1]+'|'+p[2]);}
  });
}

/* ============================================================
   OMPLIR EL FULL "GRUPS" DES DE LA LLISTA DE L'ESCOLA
   ------------------------------------------------------------
   En Pol té els documents oficials de l'escola (que no es toquen
   mai) i unes CÒPIES seves que s'hi sincronitzen soles amb un
   `onEdit` + `copyTo` de la pestanya sencera. El full de llistes
   d'alumnes n'és una.

   ⚠ AMB "GRUPS" NO ES POT FER AIXÒ. Les còpies són miralls i es
   poden refer senceres perquè ningú més hi escriu. "Grups" no:
   hi escriu l'app (correus, PI, AM, EAP, observacions i les
   condicions de seient), i un `copyTo` s'ho enduria tot.

   I encara hi ha una cosa pitjor. L'app identifica cada alumne
   PER NÚMERO DE FILA (`rowId: i+2`). D'aquest número hi pengen
   les observacions (`obs_<grup>` = { fila: {...} }), les
   entrevistes i fins i tot les incompatibilitats de seient
   (`noAmb: [2,11,15]`, que són files d'altres alumnes). Si la
   llista canviés d'ordre o hi entrés algú pel mig, TOT es
   desplaçaria i l'observació d'un nen sortiria a la fitxa d'un
   altre, sense cap error.

   Per això això és una FUSIÓ i no una còpia:
     · qui ja hi és, NO ES MOU (conserva fila, i doncs, tot)
     · qui és nou, s'AFEGEIX AL FINAL
     · qui ja no hi és a la llista NO S'ESBORRA: s'informa i prou
   ============================================================ */

var LLISTES_ID = '17iWVwC7tHJqAjd-khBRZ1B7WwLKCeuxhKsOh_I0_rtQ';

/* Nom comparable: sense accents, sense majúscules, sense espais de més.
   "Miquel dels Sants  Genís" i "miquel dels sants genis" són el mateix. */
function _nomClau_(nom, cognoms) {
  var s = String(nom || '') + ' ' + String(cognoms || '');
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/* Aparella les pestanyes dels dos fulls pel nom, tolerant accents i
   espais. Torna { '1r A': <full origen>, … } i què no ha sabut aparellar. */
function _llistesAparella_(llistes) {
  var perClau = {};
  llistes.getSheets().forEach(function (sh) {
    perClau[_nomClau_(sh.getName(), '')] = sh;
  });
  var parelles = {}, sense = [];
  GRUPS_PRIMARIA.forEach(function (g) {
    var sh = perClau[_nomClau_(g, '')];
    if (sh) parelles[g] = sh; else sense.push(g);
  });
  return { parelles: parelles, sense: sense, nomsOrigen: llistes.getSheets().map(function (s) { return s.getName(); }) };
}

/* La feina, per a un grup. `prova` = només mirar, no escriure. */
function _grupsFusiona_(gss, grup, shOrigen, prova) {
  var shDesti = gss.getSheetByName(grup);
  if (!shDesti) return { grup: grup, error: 'La pestanya "' + grup + '" no existeix al full Grups' };

  // Origen: Nom | Cognoms | Data naixement
  var lrO = shOrigen.getLastRow();
  var origen = lrO >= 2 ? shOrigen.getRange(2, 1, lrO - 1, 3).getValues() : [];
  var alumnesOrigen = [];
  origen.forEach(function (r) {
    var nom = String(r[0] == null ? '' : r[0]).trim();
    var cog = String(r[1] == null ? '' : r[1]).trim();
    if (!nom && !cog) return;
    alumnesOrigen.push({ nom: nom, cognoms: cog, naix: _reuTxtData_(r[2]) || String(r[2] || '').trim(),
                         clau: _nomClau_(nom, cog) });
  });

  // Destí: qui hi ha ara
  var lrD = shDesti.getLastRow();
  var desti = lrD >= 2 ? shDesti.getRange(2, 1, lrD - 1, 3).getValues() : [];
  var jaHi = {}, ordreDesti = [];
  desti.forEach(function (r, i) {
    var nom = String(r[0] == null ? '' : r[0]).trim();
    var cog = String(r[1] == null ? '' : r[1]).trim();
    if (!nom && !cog) return;
    var k = _nomClau_(nom, cog);
    jaHi[k] = { fila: i + 2, naix: r[2] };
    ordreDesti.push(k);
  });

  var nous = [], marxats = [], naixOmplerts = [];
  alumnesOrigen.forEach(function (a) {
    if (jaHi[a.clau]) {
      // Hi és: NO es toca la fila. Només s'omple la data de naixement si
      // era buida, que és afegir informació, no moure'n cap.
      var actual = jaHi[a.clau].naix;
      if (a.naix && (actual === '' || actual === null || actual === undefined)) {
        naixOmplerts.push({ fila: jaHi[a.clau].fila, naix: a.naix, nom: a.nom + ' ' + a.cognoms });
      }
    } else {
      nous.push(a);
    }
  });
  var clausOrigen = {};
  alumnesOrigen.forEach(function (a) { clausOrigen[a.clau] = true; });
  ordreDesti.forEach(function (k) {
    if (!clausOrigen[k]) marxats.push({ fila: jaHi[k].fila });
  });

  if (!prova) {
    naixOmplerts.forEach(function (x) { shDesti.getRange(x.fila, 3).setValue(x.naix); });
    if (nous.length) {
      var desDe = Math.max(2, lrD + 1);
      shDesti.getRange(desDe, 1, nous.length, 3).setValues(
        nous.map(function (a) { return [a.nom, a.cognoms, a.naix]; }));
      // Neixen amb codi: si no, quedarien identificats per fila i tornaríem
      // a tenir el problema que això venia a resoldre.
      var usats = {};
      var mapa = _grupMapaUids_(gss, grup);
      Object.keys(mapa.perUid).forEach(function (u) { usats[u] = true; });
      shDesti.getRange(desDe, COL_UID, nous.length, 1).setValues(nous.map(function () {
        var u; do { u = _uidNou_(); } while (usats[u]); usats[u] = true; return [u];
      }));
      _oblidaMapaUids_();
    }
  }

  return { grup: grup, aOrigen: alumnesOrigen.length, jaHiEren: Object.keys(jaHi).length,
           afegits: nous.length, naixOmplerts: naixOmplerts.length, jaNoHiSon: marxats.length,
           nomsAfegits: nous.slice(0, 5).map(function (a) { return a.nom + ' ' + a.cognoms; }) };
}

/* Punt d'entrada. `prova` = passada en sec: mira i explica, no escriu.
   Amb el pany posat, perquè dues mestres poden prémer el botó alhora. */
function grupsSincronitza(ss, prova) {
  var gss = getGrupsSpreadsheet(ss);
  if (!gss) return { ok: false, error: 'No s\'ha pogut obrir el full de grups compartit' };
  var llistes;
  try { llistes = SpreadsheetApp.openById(LLISTES_ID); }
  catch (e) { return { ok: false, error: 'No s\'ha pogut obrir el full de llistes de l\'escola: ' + e.message }; }

  var lock = LockService.getScriptLock(), tinc = false;
  try { lock.waitLock(60000); tinc = true; } catch (e) {
    return { ok: false, error: 'Hi ha una altra actualització en marxa. Torna-ho a provar d\'aquí un moment.' };
  }
  try {
    var ap = _llistesAparella_(llistes);
    var resultats = [];
    Object.keys(ap.parelles).forEach(function (g) {
      resultats.push(_grupsFusiona_(gss, g, ap.parelles[g], prova));
    });
    var tot = { afegits: 0, naixOmplerts: 0, jaNoHiSon: 0 };
    resultats.forEach(function (r) {
      tot.afegits += r.afegits || 0;
      tot.naixOmplerts += r.naixOmplerts || 0;
      tot.jaNoHiSon += r.jaNoHiSon || 0;
    });
    // Sempre per ordre alfabètic de cognom: ara que cada alumne porta el
    // seu codi, moure files ja no barreja res.
    var ordenats = 0;
    if (!prova) Object.keys(ap.parelles).forEach(function (g) {
      ordenats += (grupsOrdena(ss, gss, g, false).mogudes || 0);
    });
    tot.ordenats = ordenats;
    if (!prova) sheetSetJSON(gss, '_AppData', 'grups_sync', JSON.stringify({
      quan: Utilities.formatDate(new Date(), _gTz_(), 'yyyy-MM-dd HH:mm'), tot: tot }));
    // Deixa constància de com era el full de l'escola: així el disparador
    // que passa cada quart d'hora no repeteix una feina acabada de fer.
    if (!prova) { try { sheetSetJSON(gss, '_AppData', 'grups_empremta', _llistesEmpremta_(ap.parelles)); } catch (e) {} }
    return { ok: true, prova: !!prova, grups: resultats, total: tot,
             senseParella: ap.sense, pestanyesOrigen: ap.nomsOrigen };
  } finally { if (tinc) { try { lock.releaseLock(); } catch (e) {} } }
}

/* ============================================================
   LA SINCRONITZACIÓ CONSTANT
   ------------------------------------------------------------
   Perquè cap mestra no hagi d'entrar dades d'alumnes mai més,
   "Grups" s'ha de mantenir sol al dia amb el full de l'escola.

   Tres coses expliquen per què està fet així i no d'una altra
   manera:

   1. "Grups" és UN SOL full, compartit per totes les mestres.
      Si totes les instal·lacions el sincronitzessin, hi
      escriurien alhora: el LockService és per script, o sigui
      que NO les protegeix les unes de les altres. Per això la
      sincronització automàtica només s'engega en UNA
      instal·lació (la de direcció), i la resta en veuen el
      resultat. El permís és la propietat SYNC_LLISTES.

   2. Un disparador onEdit NO salta quan qui escriu és un
      script, i el full de l'escola l'omple un script. Per això
      va per temps i no per edició: si anés per edició, no
      saltaria mai.

   3. Cada passada gasta quota (Google en dóna ~90 minuts al
      dia). Per això primer mira si el full de l'escola ha
      canviat gens, i només fa la feina de debò si cal.
   ============================================================ */

var SYNC_CADA_MINUTS = 15;   // 1, 5, 10, 15 o 30: només aquests valors accepta Google

/* L'empremta del full de l'escola: un resum curt de tot el que
   ens importa (qui hi ha a cada grup i quan va néixer). Si no ha
   canviat, no cal tocar res. Un canvi de color o una nota al
   full de l'escola no fa treballar ningú. */
function _llistesEmpremta_(parelles) {
  var trossos = [];
  Object.keys(parelles).sort().forEach(function (g) {
    var sh = parelles[g];
    var lr = sh.getLastRow();
    trossos.push('#' + g);
    if (lr < 2) return;
    sh.getRange(2, 1, lr - 1, 3).getValues().forEach(function (f) {
      var nom = String(f[0] == null ? '' : f[0]).trim();
      var cog = String(f[1] == null ? '' : f[1]).trim();
      if (!nom && !cog) return;
      trossos.push(_nomClau_(nom, cog) + '|' + (_reuTxtData_(f[2]) || String(f[2] || '').trim()));
    });
  });
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, trossos.join('\n'));
  return bytes.map(function (b) { return ('0' + (b & 0xFF).toString(16)).slice(-2); }).join('');
}

/* Sincronitza NOMÉS si el full de l'escola ha canviat.
   És el que crida el disparador cada quart d'hora. */
function grupsSincronitzaSiCal(ss) {
  var gss = getGrupsSpreadsheet(ss);
  if (!gss) return { ok: false, error: 'No s\'ha pogut obrir el full de grups compartit' };
  var llistes;
  try { llistes = SpreadsheetApp.openById(LLISTES_ID); }
  catch (e) { return { ok: false, error: 'No s\'ha pogut obrir el full de llistes de l\'escola: ' + e.message }; }

  var ap = _llistesAparella_(llistes);
  if (!Object.keys(ap.parelles).length) {
    // Cap pestanya aparellada: o el full és un altre, o encara no hi ha res.
    // Val més no fer res que no pas fer-hi mal.
    return { ok: false, error: 'No he sabut aparellar cap pestanya del full de l\'escola' };
  }
  var ara = _llistesEmpremta_(ap.parelles);
  var abans = sheetGetJSON(gss, '_AppData', 'grups_empremta');

  // Deixa dit que s'ha MIRAT, encara que no hi hagués res a fer. Sense
  // això, la mestra veu la data de l'últim CANVI i no pot distingir "fa
  // tres dies que no canvia res" de "fa tres dies que està aturat".
  var quan = Utilities.formatDate(new Date(), _gTz_(), 'yyyy-MM-dd HH:mm');
  try { sheetSetJSON(gss, '_AppData', 'grups_mirat', quan); } catch (e) {}

  if (abans && String(abans) === ara) return { ok: true, calia: false, empremta: ara, mirat: quan };

  var r = grupsSincronitza(ss, false);
  if (r && r.ok) sheetSetJSON(gss, '_AppData', 'grups_empremta', ara);
  r.calia = true;
  r.empremta = ara;
  r.mirat = quan;
  return r;
}

/* Per al disparador: sense arguments i sense sessió de navegador.
   Es reparteix a totes les apps, però només treballa a la que
   té el permís: si no, divuit scripts escriurien el mateix full
   alhora i el LockService no els protegiria (és per script). */
function grupsSincronitzaAuto() {
  try {
    var permis = PropertiesService.getScriptProperties().getProperty('SYNC_LLISTES');
    if (String(permis || '').toLowerCase() !== 'si') return;
    var r = grupsSincronitzaSiCal(SpreadsheetApp.getActiveSpreadsheet());
    if (r && r.ok && r.calia === false) return;         // no ha canviat res: ni ho apuntem
    Logger.log('grupsSincronitzaAuto: ' + JSON.stringify(r && r.total ? r.total : r));
  } catch (e) { Logger.log('grupsSincronitzaAuto ha petat: ' + e.message); }
}

/* ── EL MANIFEST VELL ───────────────────────────────────────
   El Code.gs s'enganxa a mà, però el appsscript.json (on hi ha
   la llista de permisos) no. Si aquell fitxer és vell, tot el
   que toqui disparadors peta amb un error en anglès que no diu
   què s'ha de fer. Va passar a l'app d'en Pol el 4/9/2026.
   ─────────────────────────────────────────────────────────── */
function _faltaPermisDisparadors_(e) {
  var m = String((e && e.message) || e || '');
  return m.indexOf('script.scriptapp') >= 0 ||
         (m.indexOf('permissions') >= 0 && m.indexOf('getProjectTriggers') >= 0) ||
         (m.indexOf('permisos') >= 0 && m.indexOf('getProjectTriggers') >= 0);
}
function _comManifestVell_() {
  return 'FALTA UN PERMIS: el fitxer appsscript.json d aquest projecte es vell.\n' +
         '\nEs arregla en un minut i nomes s ha de fer un cop:\n' +
         '  1. A l esquerra, Configuracio del projecte (la roda dentada).\n' +
         '  2. Marca "Mostra el fitxer de manifest appsscript.json a l editor".\n' +
         '  3. Torna a l editor: ara hi ha un fitxer appsscript.json. Obre l.\n' +
         '  4. Esborra el que hi ha i enganxa hi el appsscript.json que t han passat.\n' +
         '  5. Desa i torna a executar aquesta funcio. Et demanara permis: accepta l.\n' +
         '\n(El Code.gs s enganxa, pero el appsscript.json no: per aixo es queda enrere.)';
}

/* Engega la sincronització constant EN AQUESTA instal·lació.
   S'executa un cop des de l'editor, i NOMÉS a l'app de direcció.
   Es pot repetir sense por: primer treu el disparador vell. */
function configuraSincronitzacioLlistes() {
  var fora = 0, txt;
  try {
    ScriptApp.getProjectTriggers().forEach(function (t) {
      if (t.getHandlerFunction() === 'grupsSincronitzaAuto') { ScriptApp.deleteTrigger(t); fora++; }
    });
    ScriptApp.newTrigger('grupsSincronitzaAuto').timeBased().everyMinutes(SYNC_CADA_MINUTS).create();
  } catch (e) {
    txt = _faltaPermisDisparadors_(e) ? _comManifestVell_()
                                      : 'No s ha pogut posar el disparador: ' + e.message;
    Logger.log(txt);
    return txt;
  }
  PropertiesService.getScriptProperties().setProperty('SYNC_LLISTES', 'si');
  txt = 'Sincronitzacio constant ENGEGADA en aquesta instal lacio: cada ' +
        SYNC_CADA_MINUTS + ' minuts.' + (fora ? ' N he tret ' + fora + ' de vell.' : '') +
        '\nCOMPTE: nomes ha d estar engegada en UNA app (la de direccio).' +
        '\nPer veure si va: executa provaSincronitzacio().';
  Logger.log(txt);
  return txt;
}

/* Per apagar-la (si s'ha engegat a l'app que no tocava). */
function treuSincronitzacioLlistes() {
  var fora = 0;
  try {
    ScriptApp.getProjectTriggers().forEach(function (t) {
      if (t.getHandlerFunction() === 'grupsSincronitzaAuto') { ScriptApp.deleteTrigger(t); fora++; }
    });
  } catch (e) {
    // Encara que no puguem tocar els disparadors, treure li el permis ja
    // l atura: sense SYNC_LLISTES, grupsSincronitzaAuto no fa res.
    PropertiesService.getScriptProperties().setProperty('SYNC_LLISTES', 'no');
    var avis = 'Permis tret (ja no fara res), pero NO he pogut treure el disparador.\n' +
               (_faltaPermisDisparadors_(e) ? _comManifestVell_() : e.message);
    Logger.log(avis);
    return avis;
  }
  PropertiesService.getScriptProperties().setProperty('SYNC_LLISTES', 'no');
  var txt = 'Sincronitzacio constant APAGADA en aquesta instal lacio. Disparadors trets: ' + fora + '.';
  Logger.log(txt);
  return txt;
}

/* Què n'ha de saber la mestra: quan es va portar l'última vegada
   i si va sola. Sense això, tota aquesta feina és invisible i
   ningú no sap si funciona o si fa dies que està aturada. */
function grupsSyncEstat(ss) {
  var gss = getGrupsSpreadsheet(ss);
  if (!gss) return { ok: false, error: 'No s\'ha pogut obrir el full de grups compartit' };
  var quan = null, tot = null, mirat = null;
  try {
    var raw = sheetGetJSON(gss, '_AppData', 'grups_sync');
    if (raw) { var j = JSON.parse(raw); quan = j.quan || null; tot = j.tot || null; }
  } catch (e) {}
  try { mirat = sheetGetJSON(gss, '_AppData', 'grups_mirat') || null; } catch (e) {}
  var auto = false;
  try {
    auto = ScriptApp.getProjectTriggers().some(function (t) {
      return t.getHandlerFunction() === 'grupsSincronitzaAuto';
    }) && String(PropertiesService.getScriptProperties().getProperty('SYNC_LLISTES') || '')
          .toLowerCase() === 'si';
  } catch (e) {}
  return { ok: true, quan: quan, mirat: mirat, tot: tot, auto: auto, cada: SYNC_CADA_MINUTS };
}

/* Per mirar com va, sense esperar el quart d'hora. */
function provaSincronitzacio() {
  var permis = PropertiesService.getScriptProperties().getProperty('SYNC_LLISTES');
  var quants;
  try {
    quants = ScriptApp.getProjectTriggers().filter(function (t) {
      return t.getHandlerFunction() === 'grupsSincronitzaAuto';
    }).length;
  } catch (e) {
    if (_faltaPermisDisparadors_(e)) { Logger.log(_comManifestVell_()); return _comManifestVell_(); }
    quants = '(no s han pogut mirar: ' + e.message + ')';
  }
  var r = grupsSincronitzaSiCal(SpreadsheetApp.getActiveSpreadsheet());
  var txt = 'Permis (SYNC_LLISTES): ' + (permis || '(no posat)') +
            '\nDisparadors posats: ' + quants +
            '\nCada: ' + SYNC_CADA_MINUTS + ' minuts' +
            '\nAra mateix: ' + (r.ok === false ? 'ERROR ' + r.error
              : (r.calia ? 'hi havia canvis i els he portat' : 'el full de l escola no ha canviat, no calia fer res')) +
            '\n' + JSON.stringify(r, null, 2);
  Logger.log(txt);
  return txt;
}

/* ============================================================
   L'IDENTIFICADOR PERMANENT DE CADA ALUMNE
   ------------------------------------------------------------
   Fins al setembre del 2026, l'app identificava cada alumne pel
   NÚMERO DE FILA del full "Grups" (`rowId: i+2`). D'aquest
   número hi penjaven les observacions, les entrevistes, les
   incompatibilitats de seient i les notes compartides.

   Això vol dir que si algú esborrava una fila, tots els de sota
   pujaven una posició i l'observació d'un nen passava a ser
   d'un altre. Sense error i sense avís. En Pol ho va veure venir
   abans que passés, mirant com s'actualitzen els fulls copia de
   l'escola.

   Ara cada alumne té un codi propi a la columna O que NO CANVIA
   MAI: ni si canvia de fila, ni si es reordena la llista, ni si
   li corregeixen un accent al cognom.

   ⚠ REGLA: el NOM serveix per aparellar amb els documents de
   l'escola. L'UID serveix per identificar-lo dins de l'app.
   No s'han de barrejar mai.
   ============================================================ */

/* Un codi curt, únic i que no vol dir res. Que no vulgui dir res és a
   posta: si portés el nom o el curs, deixaria de ser vàlid el dia que
   canviessin. */
function _uidNou_() {
  var lletres = 'abcdefghijkmnpqrstuvwxyz23456789';   // sense l/1/o/0, que es confonen
  var s = '';
  for (var i = 0; i < 10; i++) s += lletres.charAt(Math.floor(Math.random() * lletres.length));
  return s;
}

/* Reparteix identificadors als alumnes que encara no en tenen.
   Idempotent: passar-hi dues vegades no canvia res del que ja hi era. */
function grupsAssignaUids(gss, grup, prova) {
  var sh = gss.getSheetByName(grup);
  if (!sh) return { grup: grup, error: 'no existeix' };
  var lr = sh.getLastRow();
  if (lr < 2) return { grup: grup, posats: 0, jaEnTenien: 0 };

  var vals = sh.getRange(2, 1, lr - 1, COL_UID).getValues();
  var usats = {}, posats = 0, jaEnTenien = 0, nous = [];
  vals.forEach(function (r) {
    var u = String(r[COL_UID - 1] || '').trim();
    if (u) usats[u] = true;
  });
  vals.forEach(function (r, i) {
    var buit = !String(r[0] || '').trim() && !String(r[1] || '').trim();
    var u = String(r[COL_UID - 1] || '').trim();
    if (buit) { nous.push(['']); return; }        // fila sense alumne: es deixa buida
    if (u) { jaEnTenien++; nous.push([u]); return; }
    do { u = _uidNou_(); } while (usats[u]);
    usats[u] = true; posats++;
    nous.push([u]);
  });
  if (!prova && posats) {
    sh.getRange(2, COL_UID, nous.length, 1).setValues(nous);
    _oblidaMapaUids_();
  }
  return { grup: grup, posats: posats, jaEnTenien: jaEnTenien };
}

/* El pont entre el món vell (files) i el nou (uids), per a un grup.
   Torna { perFila: {12:'a7k…'}, perUid: {'a7k…':12} }. */
/* El mapa es demana diverses vegades dins d'una mateixa crida (alumnes,
   observacions, entrevistes…). Llegir-lo cada cop eren viatges a Google
   per res: es recorda mentre dura l'execució, que a l'Apps Script són
   segons. */
var _mapaUidsCache = {};

function _grupMapaUids_(gss, grup) {
  var clauCache = gss.getId ? (gss.getId() + '|' + grup) : ('x|' + grup);
  if (_mapaUidsCache[clauCache]) return _mapaUidsCache[clauCache];
  var sh = gss.getSheetByName(grup);
  var buit = { perFila: {}, perUid: {} };
  if (!sh) return buit;
  var lr = sh.getLastRow();
  if (lr < 2) return buit;
  var vals = sh.getRange(2, 1, lr - 1, COL_UID).getValues();
  var m = { perFila: {}, perUid: {} };
  vals.forEach(function (r, i) {
    var u = String(r[COL_UID - 1] || '').trim();
    if (!u) return;
    var fila = i + 2;
    m.perFila[fila] = u;
    m.perUid[u] = fila;
  });
  _mapaUidsCache[clauCache] = m;
  return m;
}

/* Qui escriu codis al full ha de buidar el record, o el següent que el
   demani tindrà el d'abans. */
function _oblidaMapaUids_() { _mapaUidsCache = {}; }

/* Una clau desada pot ser vella (un número de fila) o nova (un uid).
   Això la torna sempre com a uid, perquè res no es perdi pel camí
   mentre dura la convivència. */
function _clauAUid_(clau, mapa) {
  var k = String(clau);
  if (/^\d+$/.test(k)) return mapa.perFila[k] || k;   // vella: es tradueix
  return k;                                           // ja és un uid
}

/* ── PORTAR EL QUE JA HI HA AL MÓN DELS UIDS ─────────────────────────────
   Quatre coses anaven indexades pel número de fila:
     1. `obs_<grup>`            observacions   (full COMPARTIT)
     2. `entrevistes_<grup>`    entrevistes    (full de la MESTRA)
     3. `noAmb: [fila,…]`       incompatibilitats de seient (columna N)
     4. `<prefix><grup>|<mat>`  notes compartides (full COMPARTIT)

   Abans de convertir res es desa una CÒPIA del valor original. Si algun
   dia surt que la conversió va malament, es pot recuperar. Amb dades de
   criatures no es fa cap conversió sense xarxa.

   Idempotent: passar-hi dues vegades no torna a convertir el que ja és
   un uid, perquè `_clauAUid_` deixa passar els uids tal com són.       */
function _copiaSeguretat_(ss, clau, valor) {
  if (valor === null || valor === undefined || valor === '') return;
  var quan = Utilities.formatDate(new Date(), _gTz_(), 'yyyyMMdd');
  sheetSetJSON(ss, '_AppData', 'backup_' + quan + '_' + clau, String(valor));
}

function _migraClaus_(obj, mapa) {
  var fora = {}, convertits = 0, perduts = 0;
  Object.keys(obj || {}).forEach(function (k) {
    var nova = _clauAUid_(k, mapa);
    if (/^\d+$/.test(String(k))) {
      if (nova === String(k)) { perduts++; fora[k] = obj[k]; return; }  // no s'ha trobat: es deixa
      convertits++;
    }
    fora[nova] = obj[k];
  });
  return { obj: fora, convertits: convertits, perduts: perduts };
}

/* El pany ja no cal: des que la lectura tradueix les claus desades a la que
   el navegador espera (`_reclau_`), l'app funciona igual amb les dades sense
   migrar que amb les migrades. Migrar ha deixat de ser una operació delicada
   i ha passat a ser una NETEJA: deixa les dades indexades pel codi en comptes
   de per la fila, que és més clar de llegir al full i estalvia la traducció.
   Es queda com a interruptor per si algun dia s'ha de tornar a tancar. */
var UIDS_ACTIUS = true;

function grupsMigraAUids(ss, prova) {
  var gss = getGrupsSpreadsheet(ss);
  if (!gss) return { ok: false, error: 'No s\'ha pogut obrir el full de grups compartit' };
  if (!prova && !UIDS_ACTIUS) {
    return { ok: false, error: 'Encara no toca. L\'app encara busca els alumnes per número de ' +
             'fila: si es converteixen ara, les observacions deixarien de sortir. ' +
             'De moment només la passada en sec.' };
  }

  var lock = LockService.getScriptLock(), tinc = false;
  try { lock.waitLock(120000); tinc = true; } catch (e) {
    return { ok: false, error: 'Hi ha una altra feina en marxa. Torna-ho a provar.' };
  }
  try {
    var resum = { uidsPosats: 0, obs: 0, entrevistes: 0, seients: 0, notes: 0, perduts: 0 };
    var detall = [];

    GRUPS_PRIMARIA.forEach(function (grup) {
      var sh = gss.getSheetByName(grup);
      if (!sh || sh.getLastRow() < 2) return;

      // 1) Repartir uids
      var u = grupsAssignaUids(gss, grup, prova);
      resum.uidsPosats += u.posats || 0;
      // En passada en sec encara no hi són al full: es simula el mapa
      var mapa = _grupMapaUids_(gss, grup);
      if (prova && u.posats) {
        var lr = sh.getLastRow();
        var noms = sh.getRange(2, 1, lr - 1, 2).getValues();
        noms.forEach(function (r, i) {
          var fila = i + 2;
          if (!mapa.perFila[fila] && (String(r[0] || '').trim() || String(r[1] || '').trim())) {
            mapa.perFila[fila] = '(nou)';
          }
        });
      }

      var d = { grup: grup, uids: u.posats, obs: 0, entrevistes: 0, seients: 0, notes: 0, perduts: 0 };

      // 2) Observacions (full compartit)
      var vo = sheetGetJSON(gss, '_AppData', 'obs_' + grup);
      if (vo) {
        try {
          var mo = _migraClaus_(JSON.parse(vo), mapa);
          d.obs = mo.convertits; d.perduts += mo.perduts;
          if (!prova && mo.convertits) {
            _copiaSeguretat_(gss, 'obs_' + grup, vo);
            sheetSetJSON(gss, '_AppData', 'obs_' + grup, JSON.stringify(mo.obj));
          }
        } catch (e) {}
      }

      // 3) Entrevistes (full de la mestra)
      var ve = sheetGetJSON(ss, '_AppData', _entrClauDet_(grup));
      if (ve) {
        try {
          var me = _migraClaus_(JSON.parse(ve), mapa);
          d.entrevistes = me.convertits; d.perduts += me.perduts;
          if (!prova && me.convertits) {
            _copiaSeguretat_(ss, _entrClauDet_(grup), ve);
            sheetSetJSON(ss, '_AppData', _entrClauDet_(grup), JSON.stringify(me.obj));
          }
        } catch (e) {}
      }

      // 4) Incompatibilitats de seient (columna N de cada alumne)
      var lr2 = sh.getLastRow();
      if (lr2 >= 2) {
        var col = sh.getRange(2, 14, lr2 - 1, 1).getValues();
        var canviat = false;
        var noves = col.map(function (r) {
          var txt = String(r[0] || '').trim();
          if (!txt) return [''];
          try {
            var o = JSON.parse(txt);
            if (o && o.noAmb && o.noAmb.length) {
              var abans = JSON.stringify(o.noAmb);
              o.noAmb = o.noAmb.map(function (x) { return _clauAUid_(x, mapa); });
              if (JSON.stringify(o.noAmb) !== abans) { canviat = true; d.seients++; }
            }
            return [JSON.stringify(o)];
          } catch (e) { return [txt]; }
        });
        if (!prova && canviat) {
          _copiaSeguretat_(gss, 'seients_' + grup, JSON.stringify(col.map(function (r) { return r[0]; })));
          sh.getRange(2, 14, noves.length, 1).setValues(noves);
        }
      }

      // 5) Notes compartides (full compartit, una clau per assignatura)
      var totes = sheetGetAll(gss, '_AppData');
      Object.keys(totes).forEach(function (k) {
        if (k.indexOf(NOTESCOMP_PREFIX + grup + '|') !== 0) return;
        try {
          var o = JSON.parse(totes[k]);
          if (!o || !o.alumnes) return;
          var mn = _migraClaus_(o.alumnes, mapa);
          if (mn.convertits) {
            d.notes += mn.convertits; d.perduts += mn.perduts;
            if (!prova) {
              _copiaSeguretat_(gss, k, totes[k]);
              o.alumnes = mn.obj;
              sheetSetJSON(gss, '_AppData', k, JSON.stringify(o));
            }
          }
        } catch (e) {}
      });

      resum.obs += d.obs; resum.entrevistes += d.entrevistes;
      resum.seients += d.seients; resum.notes += d.notes; resum.perduts += d.perduts;
      if (d.uids || d.obs || d.entrevistes || d.seients || d.notes) detall.push(d);
    });

    return { ok: true, prova: !!prova, resum: resum, grups: detall };
  } finally { if (tinc) { try { lock.releaseLock(); } catch (e) {} } }
}

/* ── EL PONT: UNA CLAU, UNA FILA ─────────────────────────────────────────
   A partir d'ara, el que viatja entre el servidor i el navegador com a
   `rowId` és EL CODI de l'alumne, no el número de fila. El navegador no se
   n'ha d'assabentar: per a ell sempre ha estat una caixa negra que passa
   d'una banda a l'altra.

   Aquí es tradueix la caixa negra a fila de debò, i s'accepten LES DUES
   coses mentre duri la convivència:
     · un codi ("k7m3q…")  → es busca a la columna O
     · un número ("12")    → és una clau antiga: la fila, tal qual
   Així res es trenca ni abans ni després de la migració.            */
function _filaDeClau_(gss, grup, clau) {
  var k = String(clau == null ? '' : clau).trim();
  if (!k) return -1;
  if (/^\d+$/.test(k)) return parseInt(k, 10);          // clau antiga: ja és la fila
  var m = _grupMapaUids_(gss, grup);
  return m.perUid[k] || -1;
}

/* La clau que s'ha de fer servir per DESAR: sempre el codi si es pot.
   Si l'alumne encara no en té (abans de la migració), es queda la fila,
   i el dia que es migri es traduirà. */
function _clauDeFila_(gss, grup, fila) {
  var m = _grupMapaUids_(gss, grup);
  return m.perFila[String(fila)] || String(fila);
}

/* ── LLEGIR SEMPRE AMB LA CLAU QUE EL NAVEGADOR ESPERA ───────────────────
   El que hi ha desat pot estar indexat per fila (com sempre) o per codi
   (ja migrat). El navegador, en canvi, sempre demanarà pel que li hem
   donat a `getGrupAlumnes`.

   Això tradueix les claus desades a la clau que toca ARA. Amb això, l'app
   funciona igual abans, durant i després de la migració, i migrar deixa
   de ser una operació delicada: passa a ser una neteja.                */
function _reclau_(gss, grup, obj) {
  if (!obj || typeof obj !== 'object') return obj || {};
  var m = _grupMapaUids_(gss, grup);
  var fora = {};
  Object.keys(obj).forEach(function (k) {
    var nova = k;
    if (/^\d+$/.test(String(k)) && m.perFila[String(k)]) nova = m.perFila[String(k)];
    fora[nova] = obj[k];
  });
  return fora;
}

/* ============================================================
   FUNCIONS PER EXECUTAR DES DE L'EDITOR
   ------------------------------------------------------------
   L'editor del Apps Script només pot executar funcions SENSE
   arguments. Aquestes hi són perquè en Pol no hagi d'enganxar
   res per fer una comprovació: es trien al desplegable de dalt
   i es clica Executar. El resultat surt al registre.

   Cap d'aquestes toca res: totes són passades EN SEC.
   ============================================================ */

/* Què faria la neteja dels codis d'alumne, sense fer-la. */
function provaCodis() {
  var r = grupsMigraAUids(SpreadsheetApp.getActiveSpreadsheet(), true);
  Logger.log(JSON.stringify(r, null, 2));
  return r;
}

/* Què faria portar les llistes de l'escola al full "Grups", sense fer-ho.
   També diu com ha aparellat les pestanyes dels dos fulls. */
function provaLlistes() {
  var r = grupsSincronitza(SpreadsheetApp.getActiveSpreadsheet(), true);
  Logger.log(JSON.stringify(r, null, 2));
  return r;
}

/* ⚠ AQUESTA SÍ QUE TOCA LES DADES. Es diu així de lleig a posta, perquè al
   desplegable de l'editor no es cliqui per error al costat de provaCodis().

   Abans d'executar-la cal haver DESPLEGAT una versió nova, no només desat:
   si el que serveix l'app és codi antic, no sabrà llegir les claus noves i
   les observacions no li sortiran. Per això ho comprova ella mateixa. */
function migraCodisDEBO() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var r = grupsMigraAUids(ss, false);
  Logger.log(JSON.stringify(r, null, 2));
  if (r && r.ok) {
    Logger.log('');
    Logger.log('FET. Si a l\'app no et surten les observacions, és que encara');
    Logger.log('serveix codi antic: torna-hi i desplega una versió nova.');
    Logger.log('Les còpies de seguretat són al full ocult _AppData, amb');
    Logger.log('claus que comencen per "backup_".');
  }
  return r;
}

/* ============================================================
   DEIXAR EL FULL "GRUPS" LLEST PER A TOTHOM
   ------------------------------------------------------------
   Fa dues coses seguides:
     1. Treu les dades de PROVA (les columnes que omple l'app,
        les observacions i les entrevistes). En Pol va dir que
        res d'això és real.
     2. Porta els alumnes de la llista de l'escola a les 18
        pestanyes, perquè cada tutora hi trobi els seus.

   ⚠ ES NEGA A NETEJAR SI NO POT OMPLIR. Si les pestanyes dels
   dos fulls no s'aparellen, para abans de tocar res: val més
   deixar-ho com estava que deixar el full buit.

   Els codis dels alumnes (columna O) NO es toquen mai: són
   justament el que no ha de canviar.
   ============================================================ */
function grupsPrepara(ss, prova) {
  var gss = getGrupsSpreadsheet(ss);
  if (!gss) return { ok: false, error: 'No s\'ha pogut obrir el full de grups compartit' };
  var llistes;
  try { llistes = SpreadsheetApp.openById(LLISTES_ID); }
  catch (e) { return { ok: false, error: 'No s\'ha pogut obrir el full de llistes: ' + e.message }; }

  // Primer de tot: es poden aparellar les pestanyes? Si no, no es toca res.
  var ap = _llistesAparella_(llistes);
  var quantes = Object.keys(ap.parelles).length;
  if (!quantes) {
    return { ok: false,
      error: 'No he sabut aparellar cap pestanya, així que no toco res. ' +
             'Al full de llistes hi ha: ' + ap.nomsOrigen.join(', ') + '. ' +
             'I al full Grups hi busco: ' + GRUPS_PRIMARIA.join(', ') + '.',
      pestanyesOrigen: ap.nomsOrigen, senseParella: ap.sense };
  }

  var lock = LockService.getScriptLock(), tinc = false;
  try { lock.waitLock(120000); tinc = true; }
  catch (e) { return { ok: false, error: 'Hi ha una altra feina en marxa.' }; }
  try {
    var net = { files: 0, claus: 0 };

    // 1) Netejar les proves
    GRUPS_PRIMARIA.forEach(function (grup) {
      var sh = gss.getSheetByName(grup);
      if (!sh) return;
      var lr = sh.getLastRow();
      if (lr >= 2) {
        // Columnes D–N: tot el que escriu l'app. La O (el codi) NO es toca.
        var buides = [];
        for (var i = 0; i < lr - 1; i++) buides.push(['', '', '', '', '', '', '', '', '', '', '']);
        var teRes = sh.getRange(2, 4, lr - 1, 11).getValues()
          .some(function (r) { return r.some(function (c) { return String(c || '').trim(); }); });
        if (teRes) {
          net.files += lr - 1;
          if (!prova) sh.getRange(2, 4, lr - 1, 11).setValues(buides);
        }
      }
      // Observacions i entrevistes de proves
      ['obs_' + grup].forEach(function (k) {
        if (sheetGetJSON(gss, '_AppData', k)) { net.claus++; if (!prova) sheetSetJSON(gss, '_AppData', k, ''); }
      });
      var ke = _entrClauDet_(grup);
      if (sheetGetJSON(ss, '_AppData', ke)) { net.claus++; if (!prova) sheetSetJSON(ss, '_AppData', ke, ''); }
    });
    _oblidaMapaUids_();

    // 2) Omplir des de la llista de l'escola
    var resultats = [];
    Object.keys(ap.parelles).forEach(function (g) {
      resultats.push(_grupsFusiona_(gss, g, ap.parelles[g], prova));
    });
    _oblidaMapaUids_();

    // 3) Que tothom tingui codi, i ordenar per cognom
    var uids = 0, ordenats = 0;
    if (!prova) GRUPS_PRIMARIA.forEach(function (g) {
      uids += (grupsAssignaUids(gss, g, false).posats || 0);
      ordenats += (grupsOrdena(ss, gss, g, false).mogudes || 0);
    });

    var tot = { afegits: 0, jaHiEren: 0 };
    resultats.forEach(function (r) { tot.afegits += r.afegits || 0; tot.jaHiEren += r.jaHiEren || 0; });

    return { ok: true, prova: !!prova, pestanyesAparellades: quantes,
             netejat: net, alumnes: tot, codisNous: uids, filesOrdenades: ordenats,
             senseParella: ap.sense,
             grups: resultats.map(function (r) {
               return { grup: r.grup, alumnes: (r.jaHiEren || 0) + (r.afegits || 0) };
             }) };
  } finally { if (tinc) { try { lock.releaseLock(); } catch (e) {} } }
}

/* Per a l'editor: mirar sense tocar res. */
function provaPrepararGrups() {
  var r = grupsPrepara(SpreadsheetApp.getActiveSpreadsheet(), true);
  Logger.log(JSON.stringify(r, null, 2));
  return r;
}

/* ⚠ AQUESTA TOCA EL FULL: neteja les proves i omple els 18 grups. */
function preparaGrupsDEBO() {
  var r = grupsPrepara(SpreadsheetApp.getActiveSpreadsheet(), false);
  Logger.log(JSON.stringify(r, null, 2));
  return r;
}

/* ============================================================
   ELS ALUMNES, PER ORDRE ALFABÈTIC DE COGNOM
   ------------------------------------------------------------
   Això abans hauria estat impensable: quan un alumne s'identificava
   pel número de fila, ordenar el full barrejava les observacions
   de tota la classe. Ara que cada alumne porta el seu codi, les
   files poden anar on calgui.

   ⚠ Es mou la FILA SENCERA (les 15 columnes), no només el nom:
   si es moguessin només els noms, cada nen es quedaria amb el PI
   i l'EAP del que abans hi havia en aquella fila.

   Per seguretat, abans d'ordenar s'assegura que tothom té codi i
   que no queda cap dada indexada per fila. Si en quedés i
   ordenéssim, aquella dada passaria a un altre nen.
   ============================================================ */

/* Per comparar cognoms en català: sense accents ni majúscules, i els
   números al final (perquè "Àlvarez" i "Alvarez" quedin junts). */
function _clauOrdre_(cognom, nom) {
  var s = String(cognom || '') + ' ' + String(nom || '');
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

function grupsOrdena(ss, gss, grup, prova) {
  var sh = gss.getSheetByName(grup);
  if (!sh) return { grup: grup, error: 'no existeix' };
  var lr = sh.getLastRow();
  if (lr < 3) return { grup: grup, mogudes: 0 };      // 0 o 1 alumne: res a fer

  // Que ningú es quedi sense codi, i que no hi hagi dades per fila.
  grupsAssignaUids(gss, grup, false);
  _oblidaMapaUids_();

  var ample = Math.max(sh.getLastColumn(), GRUP_HEADERS.length);
  var files = sh.getRange(2, 1, lr - 1, ample).getValues();

  // Es queden fora les files buides: no s'ordenen ni es perden.
  var amb = [], buides = [];
  files.forEach(function (r) {
    var te = String(r[0] || '').trim() || String(r[1] || '').trim();
    (te ? amb : buides).push(r);
  });

  var abans = amb.map(function (r) { return String(r[COL_UID - 1] || ''); }).join('|');
  amb.sort(function (a, b) {
    var ka = _clauOrdre_(a[1], a[0]), kb = _clauOrdre_(b[1], b[0]);
    return ka < kb ? -1 : (ka > kb ? 1 : 0);
  });
  var despres = amb.map(function (r) { return String(r[COL_UID - 1] || ''); }).join('|');
  if (abans === despres) return { grup: grup, mogudes: 0 };   // ja estava ordenat

  var mogudes = 0;
  amb.forEach(function (r, i) { if (String(r[COL_UID - 1] || '') !== abans.split('|')[i]) mogudes++; });

  if (!prova) {
    sh.getRange(2, 1, amb.concat(buides).length, ample).setValues(amb.concat(buides));
    _oblidaMapaUids_();
  }
  return { grup: grup, mogudes: mogudes, alumnes: amb.length };
}

/* Ordena els 18 grups. */
function grupsOrdenaTots(ss, prova) {
  var gss = getGrupsSpreadsheet(ss);
  if (!gss) return { ok: false, error: 'No s\'ha pogut obrir el full de grups compartit' };
  var lock = LockService.getScriptLock(), tinc = false;
  try { lock.waitLock(120000); tinc = true; }
  catch (e) { return { ok: false, error: 'Hi ha una altra feina en marxa.' }; }
  try {
    var out = [], total = 0;
    GRUPS_PRIMARIA.forEach(function (g) {
      var r = grupsOrdena(ss, gss, g, prova);
      if (r.mogudes) { out.push(r); total += r.mogudes; }
    });
    return { ok: true, prova: !!prova, filesMogudes: total, grups: out };
  } finally { if (tinc) { try { lock.releaseLock(); } catch (e) {} } }
}

/* Per a l'editor. */
function ordenaGrupsDEBO() {
  var r = grupsOrdenaTots(SpreadsheetApp.getActiveSpreadsheet(), false);
  Logger.log(JSON.stringify(r, null, 2));
  return r;
}
