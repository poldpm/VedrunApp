/* ============================================================
   Vedruna Escorial Vic — Code.gs  (versió optimitzada)
   PRINCIPI: mínimes crides a Sheets. Llegir/escriure per rangs.
   ============================================================ */

const TABS = { alumnes: 'Alumnes', registre: "Registres d'aula" };
const MATERIA_NOM = {
  general:'General', matematiques:'Matemàtiques', catala:'Català',
  medi:'Medi Natural', musica:'Música', angles:'Anglès', carpeta:'Carpeta Viatgera'
};
const MATERIES_AMB_CARPETA = ['matematiques','catala','medi'];
const COL_OBS      = 'Observacions';
const NUM_TRIMS    = 3;
const CARPETA_NOTE = '10|2|carpeta_ref';
const DATA_ROW     = 4; // files 1-3 capçaleres; dades des d'aquí

function doGet(e)  { return handleRequest(e); }
function doPost(e) { return handleRequest(e); }

function handleRequest(e) {
  try {
    var body, action;
    if (e.postData && e.postData.contents) { body = JSON.parse(e.postData.contents); action = body.action; }
    else action = e.parameter.action;
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var p  = e.parameter; // shortcut per paràmetres GET
    var result;
    switch (action) {
      case 'getAlumnes':           result = getAlumnes(ss); break;
      case 'getMainData':          result = getMainData(ss); break;
      case 'setAlumnes':           result = setAlumnes(ss, body.alumnes); break;
      case 'getPersonal':          result = getPersonal(ss, body.studentId); break;
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
      case 'getNotes':             result = getNotes(ss, body&&body.materia||p.materia, body&&body.trimestre||p.trimestre); break;
      case 'getNotesResum':        result = getNotesResum(ss); break;
      case 'addNotaItem':          result = addNotaItem(ss, body.materia, body.trimestre, body.item, body.alumnes); break;
      case 'deleteNotaItem':       result = deleteNotaItem(ss, body.materia, body.trimestre, body.itemId); break;
      case 'updateNota':           result = updateNota(ss, body.materia, body.trimestre, body.itemId, body.studentId, body.punts); break;
      case 'setNoEntregat':        result = setNoEntregat(ss, body.materia, body.trimestre, body.itemId, body.studentId, body.valor); break;
      case 'updateActitud':         result = updateActitud(ss, body.materia, body.trimestre, body.studentId, body.mitja); break;
      case 'updateActitudBatch':    result = updateActitudBatch(ss, body.materia, body.trimestre, body.mitjanes); break;
      case 'syncAssoliments':        result = syncAssoliments(ss, body.trimestre, body.data); break;

      // Planning
      case 'savePlanning':           result = savePlanning(ss, body.weekId, body.data); break;
      case 'loadPlanning':           result = loadPlanning(ss, body.weekId); break;
      case 'saveSeients':            result = saveSeients(ss, body.layout, body.history); break;
      case 'loadSeients':            result = loadSeients(ss); break;

      // Tasques
      case 'saveTasques':            result = saveTasques(ss, body.data); break;
      case 'loadTasques':            result = loadTasques(ss); break;

      // Calendari
      case 'saveCalendari':          result = saveCalendari(ss, body.year, body.data); break;
      case 'loadCalendari':          result = loadCalendari(ss, body.year); break;
      case 'saveCalendariCats':      result = saveCalendariCats(ss, body.data); break;
      case 'loadCalendariCats':      result = loadCalendariCats(ss); break;

      // Assoliments (objectius + avaluacions)
      case 'saveAssimObjectius':     result = saveAssimObjectius(ss, body.materia, body.trimestre, body.data); break;
      case 'loadAssimObjectius':     result = loadAssimObjectius(ss, body.materia, body.trimestre); break;
      case 'saveAssimValors':        result = saveAssimValors(ss, body.materia, body.trimestre, body.data); break;
      case 'loadAssimValors':        result = loadAssimValors(ss, body.materia, body.trimestre); break;

      // Actitud
      case 'saveActitud':            result = saveActitudData(ss, body.materia, body.trimestre, body.data); break;
      case 'loadActitud':            result = loadActitudData(ss, body.materia, body.trimestre); break;
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
  var nomBase = MATERIA_NOM[materia]; if (!nomBase) return { ok:false, error:'Materia desconeguda' };
  var sh = getOrCreateMateriaSheet(ss, trimestre+'T_'+nomBase);
  var oc = findOrCreateObsColumn(sh);
  var rowObs = parseInt(sid)*2 + DATA_ROW;
  var cell = sh.getRange(rowObs, oc);
  var cur = (cell.getValue()||'').toString().trim();
  cell.setValue(replace ? text : (cur ? cur+' · '+text : text)).setWrap(true);
  return { ok:true };
}
function deleteObservacio(ss, sid, materia, trimestre) {
  var nomBase = MATERIA_NOM[materia]; if (!nomBase) return { ok:true };
  var sh = ss.getSheetByName(trimestre+'T_'+nomBase); if (!sh) return { ok:true };
  var oc = findObsColumn(sh); if (oc===-1) return { ok:true };
  sh.getRange(parseInt(sid)*2+DATA_ROW, oc).clearContent();
  return { ok:true };
}

/* ============================================================
   NOTES — Lectura OPTIMITZADA (1 sola lectura de tot el rang)
   ============================================================ */
function getNotes(ss, materia, trimestre) {
  if (!materia||!trimestre) return { ok:false, error:'Falten parametres' };
  var nomBase = MATERIA_NOM[materia];
  if (!nomBase) return { ok:false, error:'Materia desconeguda: '+materia };
  var sh = ss.getSheetByName(trimestre+'T_'+nomBase);
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

  return { ok:true, items:items, valors:valors, noEntregats:neMap };
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
function addNotaItem(ss, materia, trimestre, item, alumnes) {
  var nomBase = MATERIA_NOM[materia]; if (!nomBase) return { ok:false, error:'Materia desconeguda' };
  var sh = getOrCreateMateriaSheet(ss, trimestre+'T_'+nomBase);
  initAlumnesRows(sh, alumnes, trimestre+'T_'+nomBase);

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
function deleteNotaItem(ss, materia, trimestre, itemId) {
  var nomBase=MATERIA_NOM[materia]; if(!nomBase)return{ok:true};
  var sh=ss.getSheetByName(trimestre+'T_'+nomBase); if(!sh)return{ok:true};
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
function updateNota(ss, materia, trimestre, itemId, studentId, punts) {
  var nomBase=MATERIA_NOM[materia]; if(!nomBase)return{ok:false,error:'Materia desconeguda'};
  var sh=ss.getSheetByName(trimestre+'T_'+nomBase); if(!sh)return{ok:false,error:'Pestanya no trobada'};

  var lc=sh.getLastColumn();
  var metas=sh.getRange(1,1,1,lc).getNotes()[0];
  var col=-1;
  metas.forEach(function(m,i){ var p=(m||'').split('|'); if(p.length===3&&parseInt(p[2])===itemId) col=i+1; });
  if(col===-1)return{ok:false,error:'Columna no trobada: '+itemId};

  var si=parseInt(studentId);
  var rowP=si*2+DATA_ROW, rowN=rowP+1;
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
function setNoEntregat(ss, materia, trimestre, itemId, studentId, valor) {
  var nomBase=MATERIA_NOM[materia]; if(!nomBase)return{ok:false,error:'Materia desconeguda'};
  var sh=ss.getSheetByName(trimestre+'T_'+nomBase); if(!sh)return{ok:false,error:'Pestanya no trobada'};
  var lc=sh.getLastColumn();
  var metas=sh.getRange(1,1,1,lc).getNotes()[0];
  var col=-1;
  metas.forEach(function(m,i){ var p=(m||'').split('|'); if(p.length===3&&parseInt(p[2])===itemId) col=i+1; });
  if(col===-1)return{ok:false,error:'Columna no trobada'};
  var si=parseInt(studentId), rowP=si*2+DATA_ROW, rowN=rowP+1;
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
  if(!s){s=ss.insertSheet(TABS.alumnes);s.getRange(1,1,1,6).setValues([['Nom','Nom mare','Nom pare','Email mare','Email pare','Observació']]).setFontWeight('bold');}
  return s;
}
function getOrCreateMateriaSheet(ss, tabName){
  var s=ss.getSheetByName(tabName);
  if(!s){
    s=ss.insertSheet(tabName);
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
    s=ss.insertSheet(TABS.registre);s.getRange(1,1).setValue('Alumne').setFontWeight('bold');
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
  var nomBase = MATERIA_NOM[materia];
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
  var nomBase = MATERIA_NOM[materia];
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

function saveSeients(ss, layout, history) {
  if (layout !== undefined && layout !== null)
    sheetSetJSON(ss, '_AppData', 'seients_layout', typeof layout === 'string' ? layout : JSON.stringify(layout));
  if (history !== undefined && history !== null)
    sheetSetJSON(ss, '_AppData', 'seients_history', typeof history === 'string' ? history : JSON.stringify(history));
  return { ok: true };
}

function loadSeients(ss) {
  var l = sheetGetJSON(ss, '_AppData', 'seients_layout');
  var h = sheetGetJSON(ss, '_AppData', 'seients_history');
  return {
    ok: true,
    layout:  l ? JSON.parse(l) : [],
    history: h ? JSON.parse(h) : {},
  };
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

function loadAppData(ss, weekIds) {
  var result = { ok: true };

  // Planning de les setmanes demanades
  result.planning = {};
  (weekIds || []).forEach(function(wid) {
    var v = sheetGetJSON(ss, '_AppData_Planning', wid);
    if (v) result.planning[wid] = JSON.parse(v);
  });

  // Tasques + calendari (de _AppData)
  var appData = sheetGetAll(ss, '_AppData');
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
