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
      document.getElementById('grupviewEmpty').style.display = 'block';
    }
  } catch(e) {
    document.getElementById('grupviewList').innerHTML = '';
    document.getElementById('grupviewEmpty').style.display = 'block';
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
        </button>
        <button class="grupview-btn" onclick="_grupviewShowAssim(${idx})" title="Marcar assoliments">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
        </button>
      </div>
    </div>`;
  }).join('');
}

// Mostra la fitxa d'un alumne del grup (només consulta, enfocada al no-tutor)
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
  _grupviewRenderFitxa(a);
}

function _grupviewRenderFitxa(a) {
  const pi = (a.pi||'').toString().replace(/\|/g,', ');
  const am = (a.am||'').toString().replace(/\|/g,', ');
  let html = '';

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

  // 3) Atenció a la diversitat (PI/AM)
  if (pi || am) {
    html += `<div class="gvf-block gvf-diversitat">
      <div class="gvf-block-title">Atenció a la diversitat</div>
      ${pi ? `<div class="gvf-tag-line"><span class="gvf-tag gvf-tag-pi">PI</span> ${escapeHtml(pi)}</div>` : ''}
      ${am ? `<div class="gvf-tag-line"><span class="gvf-tag gvf-tag-am">AM</span> ${escapeHtml(am)}</div>` : ''}
    </div>`;
  }

  // 4) Observacions de les diferents assignatures
  const obsAlumne = _grupviewObs[(a.rowId||'').toString()] || {};
  const obsKeys = Object.keys(obsAlumne);
  if (obsKeys.length) {
    html += `<div class="gvf-block gvf-obs">
      <div class="gvf-block-title">Observacions de les assignatures</div>
      ${obsKeys.map(k => `<div class="gvf-obs-item"><span class="gvf-obs-mat">${escapeHtml(_grupviewMatLabel(k))}</span> ${escapeHtml(obsAlumne[k])}</div>`).join('')}
    </div>`;
  }

  if (!html) {
    html = '<p class="modal-hint">Aquest alumne no té informació mèdica, necessitats ni observacions registrades.</p>';
  }
  document.getElementById('grupviewFitxaBody').innerHTML = html;
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
