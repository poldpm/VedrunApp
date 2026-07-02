/* ============================================================
   VEURE ALUMNES D'UN GRUP — grupview.js
   Mostra les targetes dels alumnes d'un grup (del full "grups"),
   perquè qualsevol mestre que hi fa classe pugui consultar
   fitxes i observacions. No interfereix amb la pàgina Alumnes.
   ============================================================ */

let _grupviewGrup = null;      // "2n C"
let _grupviewAlumnes = [];     // dades completes carregades del full "grups"
let _grupviewObs = {};         // observacions compartides del grup
let _grupviewObsLoaded = false;
let _grupviewLastError = null;

// Determina el grup a mostrar segons el context de notes.
// De moment, si hi ha un grup de tutoria, s'usa aquest; si l'assignatura
// porta grup propi en el futur, s'agafarà d'allà (notesContext.grup).
function _grupviewResolveGrup() {
  if (typeof notesContext !== 'undefined' && notesContext && notesContext.grup) return notesContext.grup;
  if (typeof _tutoriaGrup !== 'undefined' && _tutoriaGrup) return _tutoriaGrup;
  if (typeof _perfilTutorGrupKey === 'function') { const g = _perfilTutorGrupKey(); if (g) return g; }
  return null;
}

async function openGrupAlumnesModal() {
  const grup = _grupviewResolveGrup();
  if (!grup) { showToast('No sé de quin grup és aquesta assignatura', 'error'); return; }
  if (!config.scriptUrl) { showToast('Configura la connexió', 'error'); return; }

  _grupviewGrup = grup;
  _grupviewObsLoaded = false;
  document.getElementById('grupAlumnesTitle').textContent = 'Alumnes de ' + grup;
  document.getElementById('grupAlumnesSub').textContent = 'Consulta les fitxes i observacions';
  document.getElementById('grupviewEmpty').style.display = 'none';
  document.getElementById('grupviewList').innerHTML = '<div class="grupview-loading">Carregant alumnes…</div>';
  document.getElementById('grupAlumnesOverlay').classList.add('open');

  // Assignatura actual (si venim de notes)
  const assignatura = (typeof notesContext !== 'undefined' && notesContext) ? notesContext.materia : null;

  try {
    // 1) Carrega tots els alumnes del grup
    const r = await appsScriptGet({ action: 'getGrupAlumnes', grup: grup });
    let alumnes = (r.ok && r.alumnes) ? r.alumnes : [];
    // Guarda un possible error del backend per mostrar-lo
    _grupviewLastError = (!r.ok && r.error) ? r.error : (r.existeix === false ? (r.debug || ('La pestanya "' + grup + '" no existeix al full "Grups"')) : null);

    // 2) Si hi ha assignatura, comprova si és desdoblada i filtra
    if (assignatura && alumnes.length) {
      const parts = grup.split(' '); // "2n C" → ["2n","C"]
      try {
        const d = await appsScriptGet({ action:'getDesdoblament', curs:parts[0], linia:parts[1], assignatura:assignatura });
        if (d.ok && d.existeix && d.alumnes && d.alumnes.length && !d.sensDesdob) {
          // Filtra: només els que es queden (match per nom)
          const quedenNoms = new Set(d.alumnes.map(a => a.nom));
          const filtrats = alumnes.filter(a => quedenNoms.has(a.nom));
          if (filtrats.length) {
            alumnes = filtrats;
            document.getElementById('grupAlumnesSub').textContent =
              `${assignatura} · ${d.bloc || 'desdoblament'} — ${filtrats.length} alumnes es queden`;
          }
        }
      } catch(e) { /* si falla el desdoblament, mostra tots */ }
    }

    if (alumnes.length) {
      _grupviewAlumnes = alumnes;
      _grupviewRenderCards();
    } else {
      _grupviewAlumnes = [];
      document.getElementById('grupviewList').innerHTML = '';
      const emptyEl = document.getElementById('grupviewEmpty');
      emptyEl.style.display = 'block';
      if (_grupviewLastError) {
        emptyEl.innerHTML = '<p>⚠ ' + escapeHtml(_grupviewLastError) + '</p><p class="modal-hint">Ves a Configuració → «Comprovar accés» per diagnosticar-ho.</p>';
      }
    }
  } catch(e) {
    document.getElementById('grupviewList').innerHTML = '';
    const emptyEl = document.getElementById('grupviewEmpty');
    emptyEl.style.display = 'block';
    emptyEl.innerHTML = '<p>⚠ ' + escapeHtml(e.message) + '</p>';
  }
}

function closeGrupAlumnesModal() {
  document.getElementById('grupAlumnesOverlay').classList.remove('open');
}

function _grupviewInitials(nom) {
  return (nom||'').trim().split(/\s+/).map(w=>w[0]).slice(0,2).join('').toUpperCase();
}

function _grupviewRenderCards() {
  const cont = document.getElementById('grupviewList');
  cont.innerHTML = _grupviewAlumnes.map((a, idx) => {
    const hasMedic = a.obs && a.obs.toString().trim();
    const hasEspec = a.especific && a.especific.toString().trim();
    const hasAlert = hasMedic || hasEspec;
    const hasPI = a.pi && a.pi.toString().trim();
    const hasAM = a.am && a.am.toString().trim();
    const alertTip = [hasMedic ? '⚕ ' + a.obs : '', hasEspec ? '⚠ ' + a.especific : ''].filter(Boolean).join('\n');
    return `<div class="grupview-card">
      <div class="grupview-card-corner">
        ${hasPI ? '<span class="grupview-badge grupview-badge-pi" title="PI: '+escapeHtml((a.pi||'').replace(/\|/g,', '))+'">PI</span>' : ''}
        ${hasAM ? '<span class="grupview-badge grupview-badge-am" title="AM: '+escapeHtml((a.am||'').replace(/\|/g,', '))+'">AM</span>' : ''}
        ${hasAlert ? '<span class="grupview-alert" title="'+escapeHtml(alertTip)+'">⚠</span>' : ''}
      </div>
      <div class="grupview-avatar">${_grupviewInitials(a.nom)}</div>
      <div class="grupview-nom">${escapeHtml(a.nom)}</div>
      <div class="grupview-actions">
        <button class="grupview-btn ${(a.mare||a.pare||a.emailMare||a.emailPare||a.obs||a.especific)?'active':''}"
          onclick="_grupviewShowFitxa(${idx})" title="Veure fitxa i informació">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          Fitxa
        </button>
      </div>
    </div>`;
  }).join('');
}

// Mostra la fitxa d'un alumne del grup (només consulta, enfocada a l'especialista)
async function _grupviewShowFitxa(idx) {
  const a = _grupviewAlumnes[idx];
  if (!a) return;
  document.getElementById('grupviewFitxaName').textContent = a.nom;
  document.getElementById('grupviewFitxaInit').textContent = _grupviewInitials(a.nom);
  document.getElementById('grupviewFitxaBody').innerHTML = '<div class="grupview-loading">Carregant…</div>';
  document.getElementById('grupviewFitxaOverlay').classList.add('open');

  // Carrega les observacions compartides del grup (si no estan carregades)
  if (!_grupviewObsLoaded) {
    try {
      const r = await appsScriptGet({ action:'getGrupObs', grup:_grupviewGrup });
      if (r.ok) { _grupviewObs = r.obs || {}; _grupviewObsLoaded = true; }
    } catch(e) {}
  }

  // Precarrega notes i assoliments de LES MEVES assignatures al grup
  await _grupviewPreloadNotesIAssim();

  _grupviewRenderFitxa(a);
}

// Precarrega al cache les notes i assoliments de les assignatures que faig al grup
let _grupviewNotesCarregades = null;
async function _grupviewPreloadNotesIAssim() {
  const grup = _grupviewGrup;
  const assigs = _grupviewMevesAssigsDelGrup();
  if (!assigs.length || !config.scriptUrl) return;
  if (_grupviewNotesCarregades === grup) return; // ja carregat per aquest grup

  const _norm = s => (s||'').toString().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const grupKey = _norm(grup).replace(/[^a-z0-9]/g,'');

  for (const nom of assigs) {
    const baseKey = _norm(nom).replace(/[^a-z0-9]/g,'');
    const matKey = baseKey + '__' + grupKey;
    for (const t of [1,2,3]) {
      try {
        const r = await appsScriptGet({ action:'getNotes', materia: baseKey, grup, trimestre: t });
        if (r.ok) {
          const entry = { items: r.items||[], valors: r.valors||{}, noEntregats: r.noEntregats||{}, rowNoms: r.rowNoms||[], ts: Date.now() };
          try { localStorage.setItem('notescache_' + matKey + '_' + t, JSON.stringify(entry)); } catch(e) {}
        }
      } catch(e) {}
    }
  }
  _grupviewNotesCarregades = grup;
}

function _grupviewRenderFitxa(a) {
  const pi = (a.pi||'').toString().replace(/\|/g,', ');
  const am = (a.am||'').toString().replace(/\|/g,', ');
  let html = '';

  // 0) Dades de contacte i família
  const contacte = [];
  if (a.dataNaix) contacte.push(['Data de naixement', a.dataNaix]);
  if (a.mare) contacte.push(['Mare', a.mare]);
  if (a.pare) contacte.push(['Pare', a.pare]);
  if (a.emailMare) contacte.push(['Email mare', a.emailMare]);
  if (a.emailPare) contacte.push(['Email pare', a.emailPare]);
  if (contacte.length) {
    html += `<div class="gvf-block gvf-contacte">
      <div class="gvf-block-title">Dades de contacte</div>
      ${contacte.map(([k,v]) => `<div class="gvf-contacte-row"><span class="gvf-contacte-k">${k}</span><span class="gvf-contacte-v">${escapeHtml(v.toString())}</span></div>`).join('')}
    </div>`;
  }

  // 1) Informació mèdica rellevant
  if (a.obs && a.obs.toString().trim()) {
    html += `<div class="gvf-block gvf-medic">
      <div class="gvf-block-title">⚕ Informació mèdica</div>
      <div class="gvf-block-text">${escapeHtml(a.obs.toString())}</div>
    </div>`;
  }

  // 2) Aspectes conductuals / necessitats concretes
  if (a.especific && a.especific.toString().trim()) {
    html += `<div class="gvf-block gvf-especific">
      <div class="gvf-block-title">⚠ Aspectes conductuals i necessitats</div>
      <div class="gvf-block-text">${escapeHtml(a.especific.toString())}</div>
    </div>`;
  }

  // 3) Atenció a la diversitat (PI/AM/EAP)
  const eap = (a.eap||'').toString().trim();
  if (pi || am || eap) {
    html += `<div class="gvf-block gvf-diversitat">
      <div class="gvf-block-title">Atenció a la diversitat</div>
      ${pi ? `<div class="gvf-tag-line"><span class="gvf-tag gvf-tag-pi">PI</span> ${escapeHtml(pi)}</div>` : ''}
      ${am ? `<div class="gvf-tag-line"><span class="gvf-tag gvf-tag-am">AM</span> ${escapeHtml(am)}</div>` : ''}
      ${eap ? `<div class="gvf-tag-line"><span class="gvf-tag gvf-tag-eap">EAP</span> ${escapeHtml(eap)}</div>` : ''}
    </div>`;
  }

  // 4) Notes finals i assoliments — NOMÉS de les assignatures que JO li faig a aquest grup
  html += _grupviewNotesIAssim(a);

  // 5) Observacions de les diferents assignatures
  const obsAlumne = _grupviewObs[(a.rowId||'').toString()] || {};
  const obsKeys = Object.keys(obsAlumne);
  if (obsKeys.length) {
    html += `<div class="gvf-block gvf-obs">
      <div class="gvf-block-title">Observacions de les assignatures</div>
      ${obsKeys.map(k => `<div class="gvf-obs-item"><span class="gvf-obs-mat">${escapeHtml(_grupviewMatLabel(k))}</span> ${escapeHtml(obsAlumne[k])}</div>`).join('')}
    </div>`;
  }

  if (!html) {
    html = '<p class="modal-hint">Aquest alumne no té informació registrada.</p>';
  }
  document.getElementById('grupviewFitxaBody').innerHTML = html;
}

// Retorna les assignatures que l'usuari fa al grup actual (del perfil)
function _grupviewMevesAssigsDelGrup() {
  const grup = _grupviewGrup;
  if (!grup || typeof _perfil === 'undefined' || !_perfil.classes) return [];
  return (_perfil.classes[grup] || []).slice();
}

// Genera els blocs de notes finals i assoliments per a un alumne,
// només de les assignatures que l'usuari fa a aquest grup.
function _grupviewNotesIAssim(a) {
  const assigs = _grupviewMevesAssigsDelGrup();
  if (!assigs.length) return '';

  const _norm = s => (s||'').toString().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const TRIMS = [1,2,3];
  let html = '';

  // Per cada assignatura que faig al grup
  const filesNotes = [];
  const filesAssim = [];
  assigs.forEach(nom => {
    // Clau que inclou el grup (com als selectors): matematiques__3rc
    const baseKey = _norm(nom).replace(/[^a-z0-9]/g,'');
    const grupKey = _norm(_grupviewGrup).replace(/[^a-z0-9]/g,'');
    const matKey = baseKey + '__' + grupKey;

    // NOTES FINALS per trimestre (de localStorage, cache de notes)
    // La nota final es calcula del cache de notes si el tenim
    const notesTrim = TRIMS.map(t => _grupviewNotaFinal(matKey, t, a));
    if (notesTrim.some(n => n !== null && n !== '')) {
      filesNotes.push({ nom, notes: notesTrim });
    }

    // ASSOLIMENTS per trimestre (% d'objectius assolits)
    const assimTrim = TRIMS.map(t => _grupviewAssimPct(matKey, t, a));
    if (assimTrim.some(p => p !== null)) {
      filesAssim.push({ nom, pcts: assimTrim });
    }
  });

  // Bloc notes finals
  if (filesNotes.length) {
    html += `<div class="gvf-block gvf-notes">
      <div class="gvf-block-title">Notes finals <span class="gvf-block-sub">(les meves assignatures)</span></div>
      <table class="gvf-taula">
        <thead><tr><th></th><th>1r T</th><th>2n T</th><th>3r T</th></tr></thead>
        <tbody>
        ${filesNotes.map(f => `<tr><td class="gvf-taula-mat">${escapeHtml(f.nom)}</td>${f.notes.map(n => `<td>${n!==null&&n!==''?n:'–'}</td>`).join('')}</tr>`).join('')}
        </tbody>
      </table>
    </div>`;
  }

  // Bloc assoliments
  if (filesAssim.length) {
    html += `<div class="gvf-block gvf-assim">
      <div class="gvf-block-title">Assoliments <span class="gvf-block-sub">(les meves assignatures)</span></div>
      <table class="gvf-taula">
        <thead><tr><th></th><th>1r T</th><th>2n T</th><th>3r T</th></tr></thead>
        <tbody>
        ${filesAssim.map(f => `<tr><td class="gvf-taula-mat">${escapeHtml(f.nom)}</td>${f.pcts.map(p => `<td>${p!==null?p+'%':'–'}</td>`).join('')}</tr>`).join('')}
        </tbody>
      </table>
    </div>`;
  }

  return html;
}

// Nota final d'un alumne per a una assignatura+trimestre (del cache de notes)
function _grupviewNotaFinal(matKey, trim, a) {
  try {
    const raw = localStorage.getItem('notescache_' + matKey + '_' + trim);
    if (!raw) return null;
    const c = JSON.parse(raw);
    if (!c || !c.items) return null;
    // Busca la posició de l'alumne pel nom a rowNoms
    let pos = null;
    if (c.rowNoms) {
      const _norm = s => (s||'').toString().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
      const target = _norm(a.nom);
      c.rowNoms.forEach((n, i) => { if (_norm(n) === target) pos = i; });
    }
    if (pos === null) return null;
    // Calcula la mitjana ponderada dels ítems (simplificat: mitjana de notes/10)
    // Millor: usar la nota final si el cache la té; si no, calcula
    let sumaPond = 0, sumaPes = 0;
    (c.items || []).forEach(it => {
      if (it.id === 'actitud_ref') return;
      const v = c.valors && c.valors[it.id] ? c.valors[it.id][pos] : '';
      if (v === '' || v === null || v === undefined) return;
      const maxP = it.maxPunts || 10;
      const pes = it.pes || 1;
      const nota10 = parseFloat(v) / maxP * 10;
      if (!isNaN(nota10)) { sumaPond += nota10 * pes; sumaPes += pes; }
    });
    if (sumaPes === 0) return null;
    return Math.round(sumaPond / sumaPes);
  } catch(e) { return null; }
}

// % d'assoliments d'un alumne per a una assignatura+trimestre
function _grupviewAssimPct(matKey, trim, a) {
  try {
    const objRaw = localStorage.getItem('assim_obj_' + matKey + '_' + trim);
    if (!objRaw) return null;
    const objectius = JSON.parse(objRaw);
    if (!objectius.length) return null;
    // Els assoliments s'indexen per rowId de l'alumne
    const rowId = a.rowId;
    let punts = 0, algun = false;
    objectius.forEach(obj => {
      const v = localStorage.getItem('assim_' + matKey + '_' + trim + '_' + rowId + '_' + obj.id);
      if (v === '"A"' || v === 'true') { punts += 1; algun = true; }
      else if (v === '"AS"' || v === '"partial"') { punts += 0.5; algun = true; }
      else if (v === '"NA"') { algun = true; }
    });
    if (!algun) return null;
    return Math.round(punts / objectius.length * 100);
  } catch(e) { return null; }
}

// Neteja el nom de la matèria (treu prefix de trimestre si n'hi ha)
function _grupviewMatLabel(key) {
  // key pot ser "1_matematiques" o "matematiques"
  let k = key;
  const m = key.match(/^(\d)_(.+)$/);
  let trim = '';
  if (m) { trim = ' (T' + m[1] + ')'; k = m[2]; }
  if (typeof MATERIES !== 'undefined' && MATERIES[k]) return MATERIES[k] + trim;
  return k.charAt(0).toUpperCase() + k.slice(1) + trim;
}

function closeGrupviewFitxa() {
  document.getElementById('grupviewFitxaOverlay').classList.remove('open');
}

/* ============================================================
   MARCAR ASSOLIMENTS D'UN ALUMNE (des de la fitxa de consulta)
   ============================================================ */
let _grupviewAssimAlumne = null;

function _grupviewShowAssim(idx) {
  const a = _grupviewAlumnes[idx];
  if (!a) return;
  _grupviewAssimAlumne = a;

  // Determina l'assignatura del context de notes
  const materia = (typeof notesContext !== 'undefined' && notesContext && notesContext.materia) ? notesContext.materia : null;
  const matLabel = materia && typeof MATERIES !== 'undefined' && MATERIES[materia] ? MATERIES[materia] : (materia || 'assignatura');

  document.getElementById('grupviewAssimName').textContent = a.nom;
  document.getElementById('grupviewAssimSub').textContent = 'Assoliments · ' + matLabel;

  if (!materia) {
    document.getElementById('grupviewAssimBody').innerHTML =
      '<p class="modal-hint">Obre aquesta finestra des d\'una assignatura per marcar-ne els assoliments.</p>';
    document.getElementById('grupviewAssimOverlay').classList.add('open');
    return;
  }

  // Carrega objectius de l'assignatura (usa el sistema existent d'assoliments)
  _grupviewRenderAssim(a, materia);
  document.getElementById('grupviewAssimOverlay').classList.add('open');
}

function _grupviewRenderAssim(a, materia) {
  const body = document.getElementById('grupviewAssimBody');
  // Recupera objectius per trimestre del sistema d'assoliments (localStorage/cache)
  const trims = [1, 2, 3];
  const VALORS = [
    { v: 'A',  txt: 'Assolit',            cls: 'gva-a' },
    { v: 'AS', txt: 'Assolit parcialment', cls: 'gva-as' },
    { v: 'NA', txt: 'No assolit',          cls: 'gva-na' },
  ];
  let html = '';
  let algunObjectiu = false;

  trims.forEach(t => {
    const objs = JSON.parse(localStorage.getItem(`assim_obj_${materia}_${t}`) || '[]');
    if (!objs.length) return;
    algunObjectiu = true;
    html += `<div class="gva-trim"><div class="gva-trim-title">${getTrimLabel ? getTrimLabel(t) : 'Trimestre ' + t}</div>`;
    objs.forEach(obj => {
      const key = `assim_${materia}_${t}_${a.rowId}_${obj.id}`;
      const cur = localStorage.getItem(key);
      const curVal = cur === null ? null : JSON.parse(cur);
      html += `<div class="gva-obj">
        <div class="gva-obj-nom">${escapeHtml(obj.nom || obj.text || 'Objectiu')}</div>
        <div class="gva-btns">
          ${VALORS.map(V => `<button class="gva-btn ${V.cls} ${curVal===V.v?'active':''}"
            onclick="_grupviewSetAssim('${materia}',${t},'${a.rowId}','${obj.id}','${V.v}')" title="${V.txt}">${V.v}</button>`).join('')}
          <button class="gva-btn gva-clear ${curVal===null?'active':''}"
            onclick="_grupviewSetAssim('${materia}',${t},'${a.rowId}','${obj.id}','')" title="Sense avaluar">—</button>
        </div>
      </div>`;
    });
    html += `</div>`;
  });

  if (!algunObjectiu) {
    html = '<p class="modal-hint">Aquesta assignatura encara no té objectius d\'assoliment definits. Defineix-los primer a la pàgina d\'Assoliments.</p>';
  }
  body.innerHTML = html;
}

function _grupviewSetAssim(materia, trim, rowId, objId, val) {
  const key = `assim_${materia}_${trim}_${rowId}_${objId}`;
  if (val === '') localStorage.removeItem(key);
  else localStorage.setItem(key, JSON.stringify(val));
  // Sincronitza al Sheets si existeix la funció del sistema d'assoliments
  if (typeof _assimSaveValsToSheets === 'function') {
    try { _assimSaveValsToSheets(materia, trim); } catch(e) {}
  }
  // Repinta el panell
  if (_grupviewAssimAlumne) _grupviewRenderAssim(_grupviewAssimAlumne, materia);
  if (typeof showToast === 'function') showToast('Assoliment marcat ✓', 'success');
}

function closeGrupviewAssim() {
  document.getElementById('grupviewAssimOverlay').classList.remove('open');
}
