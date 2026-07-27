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

// Tots els grups de primària (3 línies). Cada grup és una pestanya al full centralitzat.
const GRUPS_PRIMARIA = [
  '1r A','1r B','1r C','2n A','2n B','2n C','3r A','3r B','3r C',
  '4t A','4t B','4t C','5è A','5è B','5è C','6è A','6è B','6è C'
];
// Capçaleres del full de grup (les 9 primeres venen del teu full de Grups;
// les 3 últimes són camps propis de l'app).
const GRUP_HEADERS = [
  'Nom','Cognom','Data naixement','Nom mare','Nom pare','Email mare','Email pare',
  'Observació important','Gènere','PI','AM','Aspectes específics','Informe EAP','Condicions seient'
];

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

function doGet(e)  { return handleRequest(e); }
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
      case 'bootstrap':            result = bootstrap(ss, parseWeekIds((body&&body.weekIds)||p.weekIds)); break;
      case 'setAlumnes':           result = setAlumnes(ss, body.alumnes); break;
      case 'getPersonal':          result = getPersonal(ss, (body&&body.studentId)||p.studentId); break;
      case 'getAllPersonal':       result = getAllPersonal(ss); break;
      case 'savePersonal':         result = savePersonal(ss, body.studentId, body.dades); break;
      case 'syncAlumnesARegistre': result = syncAlumnesARegistre(ss, body.alumnes); break;
      case 'getRegistre':          result = getRegistre(ss); break;
      case 'addRegistreItem':      result = addRegistreItem(ss, body.item, body.alumnes); break;
      case 'deleteRegistreItem':   result = deleteRegistreItem(ss, body.itemId); break;
      case 'updateRegistreCell':   result = updateRegistreCell(ss, body.itemId, body.studentId, body.value); break;
      case 'getObservacions':      result = getObservacions(ss); break;
      case 'saveObservacio':       result = saveObservacio(ss, body.studentId, body.materia, body.trimestre, body.text, body.replace||false); break;
      case 'deleteObservacio':     result = deleteObservacio(ss, body.studentId, body.materia, body.trimestre); break;
      case 'getNotes':             result = getNotes(ss, body&&body.materia||p.materia, body&&body.trimestre||p.trimestre, body&&body.grup||p.grup); break;
      case 'getNotesResum':        result = getNotesResum(ss); break;
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
      case 'saveSeients':            result = saveSeients(ss, body.layout, body.history, body.markers); break;
      case 'loadSeients':            result = loadSeients(ss); break;
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
      case 'getGoogleTasks':         result = getGoogleTasks(); break;
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
      rowId: i+2,
      nom: nomComplet,
      nomPila: nom,
      cognom: cognom,
      dataNaix: dataNaix,
      genere: g === 'f' ? 'f' : 'm',
      mare: r[3]||'', pare: r[4]||'',
      emailMare: r[5]||'', emailPare: r[6]||'',
      obs: r[7]||'',
      pi: r[9]||'', am: r[10]||'', especific: r[11]||'', eap: r[12]||'',
      seient: (function(){ try { return r[13] ? JSON.parse(r[13]) : null; } catch(e){ return null; } })()
    });
    idx++;
  });
  return { ok:true, alumnes:alumnes, grup:grup, existeix:true };
}

// Desa les dades personals (PI/AM/específic/família/obs) d'un alumne d'un grup
function saveGrupPersonal(ss, grup, rowId, d) {
  var sh = ss.getSheetByName(grup);
  if (!sh) return { ok:false, error:'Grup no trobat: ' + grup };
  var row = parseInt(rowId);
  if (isNaN(row) || row < 2) return { ok:false, error:'Fila invàlida' };
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
  var row = parseInt(rowId);
  if (isNaN(row) || row < 2) return { ok:false, error:'Fila invàlida' };
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

  // 3) Dins del bloc, troba la columna de la línia demanada (p. ex. "2n C")
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
  var gss = getGrupsSpreadsheet(ss) || ss;
  var v = sheetGetJSON(gss, '_AppData', 'obs_' + grup);
  return { ok:true, obs: v ? JSON.parse(v) : {} };
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
function syncAlumnesARegistre(ss, alumnes) {
  var sh = ss.getSheetByName(TABS.registre); if (!sh) return { ok:true };
  var lr = sh.getLastRow();
  if (alumnes.length > 0) sh.getRange(2,1,alumnes.length,1).setValues(alumnes.map(function(a){return [a.nom];}));
  var old = lr >= 2 ? lr-1 : 0;
  if (old > alumnes.length) sh.getRange(alumnes.length+2,1,old-alumnes.length,1).clearContent();
  _autoAjustaColumnes(sh);
  return { ok:true };
}
function getRegistre(ss) {
  var sh = ss.getSheetByName(TABS.registre);
  if (!sh) return { ok:true, items:[], data:{} };
  var lc = sh.getLastColumn(), lr = sh.getLastRow();
  if (lc < 2) return { ok:true, items:[], data:{} };
  var headers = sh.getRange(1,2,1,lc-1).getValues()[0];
  var notes   = sh.getRange(1,2,1,lc-1).getNotes()[0];
  var items = [], data = {};
  headers.forEach(function(nom,idx) {
    if (!nom) return;
    var parts = (notes[idx]||'').split('|');
    var tipus = parts[0]||'checkbox', id = parseInt(parts[1])||(idx+1000);
    items.push({ id:id, nom:nom.toString(), tipus:tipus }); data[id] = {};
    if (lr >= 2) sh.getRange(2,idx+2,lr-1,1).getValues().forEach(function(row,ri){
      data[id][ri] = tipus==='checkbox'?(row[0]===true):(row[0]?row[0].toString():'');
    });
  });
  return { ok:true, items:items, data:data };
}
function addRegistreItem(ss, item, alumnes) {
  var sh = getOrCreateRegistreSheet(ss, alumnes), nc = sh.getLastColumn()+1;
  var cell = sh.getRange(1,nc); cell.setValue(item.nom).setFontWeight('bold'); cell.setNote(item.tipus+'|'+item.id);
  if (alumnes && alumnes.length > 0) {
    var r = sh.getRange(2,nc,alumnes.length,1);
    item.tipus==='checkbox' ? r.insertCheckboxes() : r.setValues(alumnes.map(function(){return [''];}));
  }
  _autoAjustaColumnes(sh);
  return { ok:true };
}
function deleteRegistreItem(ss, itemId) {
  var sh = ss.getSheetByName(TABS.registre); if (!sh) return { ok:true };
  var lc = sh.getLastColumn(); if (lc < 2) return { ok:true };
  var notes = sh.getRange(1,2,1,lc-1).getNotes()[0];
  for (var i = notes.length-1; i >= 0; i--) if (parseInt((notes[i]||'').split('|')[1])===itemId) sh.deleteColumn(i+2);
  return { ok:true };
}
function updateRegistreCell(ss, itemId, studentId, value) {
  var sh = ss.getSheetByName(TABS.registre); if (!sh) return { ok:false, error:'no sheet' };
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
  for (var t=1; t<=NUM_TRIMS; t++) {
    Object.keys(MATERIA_NOM).forEach(function(key) {
      var sh = ss.getSheetByName(t+'T_'+MATERIA_NOM[key]); if (!sh) return;
      var oc = findObsColumn(sh); if (oc===-1) return;
      var lr = sh.getLastRow(); if (lr < DATA_ROW) return;
      sh.getRange(DATA_ROW,oc,lr-DATA_ROW+1,1).getValues().forEach(function(row,idx){
        var txt = (row[0]||'').toString().trim(); if (!txt) return;
        if (!obs[idx]) obs[idx] = {};
        obs[idx][t+'_'+key] = txt;
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

  return { ok:true, items:items, valors:valors, noEntregats:neMap, rowNoms:rowNoms };
}

/* Retorna la nota final arrodonida i el comptador de NE de CADA alumne
   per TOTES les assignatures i trimestres, en una sola crida.
   Usat per la fitxa de l'alumne (evita 18 crides per alumne). */
function getNotesResum(ss) {
  var MATS  = ['matematiques','catala','medi','musica','angles','carpeta'];
  var TRIMS = [1, 2, 3];
  var resum = {}; // { materia: { trim: { notes:{sid:arrod}, ne:{sid:count} } } }

  MATS.forEach(function(mat) {
    resum[mat] = {};
    var nomBase = MATERIA_NOM[mat];
    if (!nomBase) return;
    TRIMS.forEach(function(trim) {
      var sh = ss.getSheetByName(trim+'T_'+nomBase);
      if (!sh) { resum[mat][trim] = null; return; }
      var lc = sh.getLastColumn(), lr = sh.getLastRow();
      if (lc < 2 || lr < DATA_ROW) { resum[mat][trim] = null; return; }

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

      var notes = {}, neCount = {};
      for (var si = 0; si < numAlumnes; si++) {
        var rowP = DATA_ROW - 1 + si*2;
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
      resum[mat][trim] = { notes: notes, ne: neCount };
    });
  });

  return { ok: true, resum: resum };
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
  var maxP=parseFloat((sh.getRange(1,col).getNote()||'10|1|0').split('|')[0]);

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
function recalcMitjana(sh, rowP) {
  var lc=sh.getLastColumn(); if(lc<2)return;
  // Lectura batch: capçaleres, notes i les 2 files de dades en una sola crida
  var hdrData  = sh.getRange(1,1,1,lc).getValues()[0];
  var metaData = sh.getRange(1,1,1,lc).getNotes()[0];
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
  } else { ensureObsIsLastColumn(s); }
  applyFormatToNotesSheet(s);
  return s;
}
function getOrCreateRegistreSheet(ss, alumnes){
  var s=ss.getSheetByName(TABS.registre);
  if(!s){
    s=ss.insertSheet(TABS.registre);_protegirFull(s);s.getRange(1,1).setValue('Alumne').setFontWeight('bold');
    if(alumnes&&alumnes.length)s.getRange(2,1,alumnes.length,1).setValues(alumnes.map(function(a){return [a.nom];}));
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
    recalcMitjana(sh, rowP);
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

    // Capçalera objectius
    sh.getRange(row, 1).setValue('Alumne').setFontWeight('bold').setBackground(GARNET_M).setFontColor('#7A1E2E').setFontFamily('Nunito');
    objs.forEach(function(obj, i) {
      sh.getRange(row, i+2).setValue(obj.nom || ('Obj.'+(i+1))).setFontWeight('bold')
        .setHorizontalAlignment('center').setWrap(true)
        .setBackground(GARNET_M).setFontColor('#7A1E2E').setFontFamily('Nunito');
    });
    sh.getRange(row, nCols).setValue('%').setFontWeight('bold').setHorizontalAlignment('center')
      .setBackground(GARNET_M).setFontColor('#7A1E2E').setFontFamily('Nunito');
    row++;

    // Files d'alumnes
    alumnes.forEach(function(al) {
      sh.getRange(row, 1).setValue(al.nom).setFontFamily('Nunito').setBackground('#FFFFFF');
      var punts = 0;
      objs.forEach(function(obj, i) {
        var val = al.vals ? al.vals[obj.id] : null;
        var cel = sh.getRange(row, i+2);
        cel.setHorizontalAlignment('center').setFontFamily('Nunito');
        if (val === true)         { cel.setValue('✓').setBackground(GREEN_BG).setFontColor(GREEN_FC).setFontWeight('bold'); punts += 1; }
        else if (val === 'partial'){ cel.setValue('~').setBackground(YELLOW_BG).setFontColor(YELLOW_FC).setFontWeight('bold'); punts += 0.5; }
        else if (val === false)   { cel.setValue('✗').setBackground(RED_BG).setFontColor(RED_FC).setFontWeight('bold'); }
        else                      { cel.setValue('—').setBackground(GREY_BG).setFontColor(GREY_FC); }
      });
      var pct = objs.length > 0 ? Math.round(punts / objs.length * 100) : 0;
      var pctBg = pct >= 80 ? GREEN_BG : pct >= 50 ? YELLOW_BG : RED_BG;
      var pctFc = pct >= 80 ? GREEN_FC  : pct >= 50 ? YELLOW_FC  : RED_FC;
      sh.getRange(row, nCols).setValue(pct + '%').setFontWeight('bold')
        .setHorizontalAlignment('center').setBackground(pctBg).setFontColor(pctFc).setFontFamily('Nunito');
      row++;
    });

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

function sheetSetJSON(ss, nom, clau, valor) {
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

function saveSeients(ss, layout, history, markers) {
  if (layout !== undefined && layout !== null)
    sheetSetJSON(ss, '_AppData', 'seients_layout', typeof layout === 'string' ? layout : JSON.stringify(layout));
  if (history !== undefined && history !== null)
    sheetSetJSON(ss, '_AppData', 'seients_history', typeof history === 'string' ? history : JSON.stringify(history));
  if (markers !== undefined && markers !== null)
    sheetSetJSON(ss, '_AppData', 'seients_markers', typeof markers === 'string' ? markers : JSON.stringify(markers));
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
  var models = ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'];
  var lastErr = '';
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
      }
    } catch(e) { lastErr = e.message; }
  }
  return { ok:false, error: lastErr || 'Error desconegut' };
}

function loadSeients(ss) {
  var l = sheetGetJSON(ss, '_AppData', 'seients_layout');
  var h = sheetGetJSON(ss, '_AppData', 'seients_history');
  var m = sheetGetJSON(ss, '_AppData', 'seients_markers');
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

  // Planning de les setmanes demanades
  result.planning = {};
  (weekIds || []).forEach(function(wid) {
    var v = sheetGetJSON(ss, '_AppData_Planning', wid);
    if (v) result.planning[wid] = JSON.parse(v);
  });

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
  var result = { ok: true };

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
    var gss = getGrupsSpreadsheet(ss);
    if (gss) {
      var ga = getGrupAlumnes(gss, tutorGrup);
      result.grupAlumnes = ga.alumnes || [];
      result.grupAlumnesOk = true;
      // Observacions compartides del grup de tutoria
      try {
        var go = getGrupObs(ss, tutorGrup);
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
  result.observacions = getObservacions(ss).observacions;
  result.personal     = getAllPersonal(ss).personal;

  // 5) Planning / tasques / calendari / assoliments / actitud (com loadAppData)
  var appDataBundle = loadAppData(ss, weekIds, appData);
  result.planning  = appDataBundle.planning;
  result.tasques   = appDataBundle.tasques;
  result.calCats   = appDataBundle.calCats;
  result.calEvents = appDataBundle.calEvents;
  result.assim     = appDataBundle.assim;
  result.actitud   = appDataBundle.actitud;

  // 6) Seients
  try { result.seients = loadSeients(ss); } catch(e) { result.seients = null; }

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
        });
      });
    });
    result.sort(function(a,b){ if(a.data&&b.data)return a.data.localeCompare(b.data); if(a.data)return -1; if(b.data)return 1; return 0; });
    return { ok: true, tasks: result };
  } catch(err) {
    return { ok: false, error: err.message };
  }
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
