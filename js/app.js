/* ============================================================
   Vedruna Escorial Vic — Gestió de Notes · app.js
   ============================================================ */

const MATERIES = {
  general:      'General',
  matematiques: 'Matemàtiques',
  catala:       'Català',
  medi:         'Medi Natural',
  musica:       'Música',
  angles:       'Anglès',
  carpeta:      'Carpeta Viatgera',
};
const MATERIA_KEYS = ['general','matematiques','catala','medi','musica','angles'];

const MATERIA_COLORS = {
  general:      { bg: '#F1F5F9', text: '#475569' },
  matematiques: { bg: '#EEF2FF', text: '#3730A3' },
  catala:       { bg: '#FEF3C7', text: '#92400E' },
  medi:         { bg: '#ECFDF5', text: '#065F46' },
  musica:       { bg: '#FDF4FF', text: '#7C3AED' },
  angles:       { bg: '#FFF7ED', text: '#9A3412' },
};

const TRIM_LABELS = { '1':'1r Trimestre', '2':'2n Trimestre', '3':'3r Trimestre' };

/* --- Debounce helper (agrupa crides ràpides al servidor) --- */
const _debounceTimers = {};
function debounce(key, fn, ms = 1200) {
  clearTimeout(_debounceTimers[key]);
  _debounceTimers[key] = setTimeout(fn, ms);
}

/* --- State --- */
let config        = JSON.parse(localStorage.getItem('vedruna_cfg') || '{}');
let students      = [];
let observacions  = {};   // { studentId: { '1_matematiques': text, ... } }
let personal      = {};   // { studentId: { mare, pare, emailMare, emailPare, obs } }
let registreItems = [];
let registreData  = {};
let currentObsStudentId      = null;
let currentPersonalStudentId = null;
let currentFitxaStudentId    = null;

/* ============================================================
   NAVEGACIÓ
   ============================================================ */
function showPage(pageId) {
  document.querySelectorAll('.page-content').forEach(p => p.classList.add('page-hidden'));
  document.getElementById('page-' + pageId).classList.remove('page-hidden');
  // títol topbar fix: sempre "2n de Primària C"
  // nav-item actiu
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const match = [...document.querySelectorAll('.nav-item')].find(el =>
    el.getAttribute('onclick') && el.getAttribute('onclick').includes("'" + pageId + "'")
  );
  if (match) match.classList.add('active');
  closeSidebar();
  if (pageId === 'alumnes')      renderAlumnesList();
  if (pageId === 'registres')    renderRegistre();
  if (pageId === 'observacions') renderObsGrid();
  if (pageId === 'home')         renderHome();
  if (pageId === 'planning')     renderPlanning();
  if (pageId === 'assoliments')  { renderAssoliments(); if (!_recentFullLoad()) _assimLoadFromSheets(_assimMateria, _assimTrim).then(() => renderAssoliments()); }
  if (pageId === 'comentaris')   { initComentaris(); renderComentRubrica(); }
  if (pageId === 'grups')        initGrups();
  if (pageId === 'calendari')    { renderCalendari(); if (!_recentFullLoad() && Date.now() - _lastCalLoad > 60000) _calLoadFromSheets(new Date().getFullYear()).then(() => renderCalendari()); }
  if (pageId === 'tasques')      renderTasques();
}

function showFitxa(studentId) {
  currentFitxaStudentId = studentId;
  const s = students.find(x => x.id === studentId);
  if (!s) return;
  document.getElementById('fitxaAvatar').textContent = getInitials(s.nom);
  document.getElementById('fitxaNom').textContent    = s.nom;
  // títol topbar fix — no canviar
  document.querySelectorAll('.page-content').forEach(p => p.classList.add('page-hidden'));
  document.getElementById('page-fitxa').classList.remove('page-hidden');
  closeSidebar();
  renderFitxa(studentId);
}

/* ============================================================
   SIDEBAR
   ============================================================ */
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('open');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('open');
}

/* ============================================================
   DRAWER GESTIONAR ALUMNES
   ============================================================ */
function openPanel() {
  document.getElementById('panelOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  renderPanelStudents(students);
}
function closePanel() {
  document.getElementById('panelOverlay').classList.remove('open');
  document.body.style.overflow = '';
  // Refresca la llista pàgina alumnes si és visible
  if (!document.getElementById('page-alumnes').classList.contains('page-hidden')) renderAlumnesList();
}

/* ============================================================
   DRAWER DADES PERSONALS
   ============================================================ */
async function openPersonalDrawer(studentId) {
  currentPersonalStudentId = studentId;
  const s = students.find(x => x.id === studentId);
  document.getElementById('personalDrawerName').textContent = s ? s.nom : '—';
  fillPersonalForm(personal[studentId] || {});
  document.getElementById('personalOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  if (!personal[studentId] && config.scriptUrl) {
    try {
      const s2 = students.find(x => x.id === studentId);
      const rowId = s2 ? (s2.rowId || studentId) : studentId;
      const r = await appsScriptGet({ action: 'getPersonal', studentId: rowId });
      if (r.ok) { personal[studentId] = r.dades; fillPersonalForm(r.dades); }
    } catch (_) {}
  }
}
function fillPersonalForm(d) {
  document.getElementById('pMare').value      = d.mare      || '';
  document.getElementById('pPare').value      = d.pare      || '';
  document.getElementById('pEmailMare').value = d.emailMare || '';
  document.getElementById('pEmailPare').value = d.emailPare || '';
  document.getElementById('pObs').value       = d.obs       || '';
}
function closePersonalDrawer() {
  document.getElementById('personalOverlay').classList.remove('open');
  document.body.style.overflow = '';
  currentPersonalStudentId = null;
}
async function savePersonalDrawer() {
  const id    = currentPersonalStudentId;
  const dades = {
    mare:      document.getElementById('pMare').value.trim(),
    pare:      document.getElementById('pPare').value.trim(),
    emailMare: document.getElementById('pEmailMare').value.trim(),
    emailPare: document.getElementById('pEmailPare').value.trim(),
    obs:       document.getElementById('pObs').value.trim(),
  };
  personal[id] = dades;
  closePersonalDrawer();
  // Refresca fitxa si és oberta
  if (currentFitxaStudentId === id) renderFitxa(id);
  renderAlumnesList();
  if (config.scriptUrl) {
    try {
      const s2 = students.find(x => x.id === id);
      const rowId = s2 ? (s2.rowId || id) : id;
      const r = await appsScriptPost({ action: 'savePersonal', studentId: rowId, dades });
      if (!r.ok) throw new Error(r.error);
      showToast('Dades guardades', 'success');
    } catch (e) { showToast('Error: ' + e.message, 'error'); }
  }
}

/* ============================================================
   DRAWER OBSERVACIONS (des de pàg. observacions)
   ============================================================ */
function openObsDrawer(studentId) {
  currentObsStudentId = studentId;
  const s   = students.find(x => x.id === studentId);
  const obs = observacions[studentId] || {};
  const tot = Object.values(obs).filter(v => v && v.trim()).length;
  document.getElementById('obsDrawerName').textContent = s ? s.nom : '—';
  document.getElementById('obsDrawerMeta').textContent =
    tot ? tot + (tot !== 1 ? ' assignatures' : ' assignatura') + ' amb observacions' : 'Sense observacions';
  document.getElementById('obsDrawerOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  renderObsDrawerContent(studentId);
}
function closeObsDrawer() {
  document.getElementById('obsDrawerOverlay').classList.remove('open');
  document.body.style.overflow = '';
  currentObsStudentId = null;
}

/* ============================================================
   MODAL NOVA OBSERVACIÓ
   ============================================================ */
function openAddObsModal(studentId) {
  const sel = document.getElementById('obsAlumne');
  sel.innerHTML = students.map(s =>
    `<option value="${s.id}" ${s.id === studentId ? 'selected' : ''}>${s.nom}</option>`
  ).join('');
  document.getElementById('obsText').value      = '';
  document.getElementById('obsMateria').value   = 'general';
  document.getElementById('obsTrimestre').value = '1';
  resetSaveObsBtn();
  document.getElementById('addObsOverlay').classList.add('open');
  setTimeout(() => document.getElementById('obsText').focus(), 100);
}
function closeAddObsModal() { document.getElementById('addObsOverlay').classList.remove('open'); }

/* ============================================================
   CONFIG / REGISTRE MODALS
   ============================================================ */
function openConfig() { document.getElementById('cfgScriptUrl').value = config.scriptUrl || ''; const gk = document.getElementById('cfgGeminiKey'); if(gk) gk.value = config.geminiKey || ''; document.getElementById('configOverlay').classList.add('open'); _renderNotifStatus(); }
function closeConfig() { document.getElementById('configOverlay').classList.remove('open'); }
function saveConfig() {
  const url       = document.getElementById('cfgScriptUrl').value.trim();
  const geminiKey = document.getElementById('cfgGeminiKey')?.value.trim() || '';
  if (!url || !url.includes('script.google.com')) { showToast('La URL no sembla correcta', 'error'); return; }
  config = { scriptUrl: url };
  if (geminiKey) config.geminiKey = geminiKey;
  localStorage.setItem('vedruna_cfg', JSON.stringify(config));
  closeConfig();
  showToast('Configuració guardada!', 'success');
  loadAll();
}
function openNewItemModal() { document.getElementById('newItemName').value = ''; selectTypeByValue('checkbox'); document.getElementById('newItemOverlay').classList.add('open'); setTimeout(() => document.getElementById('newItemName').focus(), 100); }
function closeNewItemModal() { document.getElementById('newItemOverlay').classList.remove('open'); }

/* ============================================================
   API
   ============================================================ */
async function appsScriptGet(params) {
  const url = new URL(config.scriptUrl);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 60000); // 30s timeout
  try {
    const res = await fetch(url.toString(), { signal: ctrl.signal });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } finally { clearTimeout(timeout); }
}
async function appsScriptPost(body) {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 60000);
  try {
    const res = await fetch(config.scriptUrl, { method: 'POST', body: JSON.stringify(body), signal: ctrl.signal });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } finally { clearTimeout(timeout); }
}

/* ============================================================
   CÀRREGA INICIAL
   ============================================================ */
// Pinta la UI amb les dades que tinguem (cache o fresques)
function _paintAllViews() {
  updateHomeCounters();
  const isVisible = id => {
    const el = document.getElementById('page-' + id);
    return el && !el.classList.contains('page-hidden');
  };
  if (isVisible('home'))         renderHome();
  if (isVisible('alumnes'))      renderAlumnesList();
  if (isVisible('registres'))    renderRegistre();
  if (isVisible('observacions')) renderObsGrid();
  if (isVisible('planning'))     renderPlanning();
  if (isVisible('tasques'))      renderTasques();
  if (isVisible('fitxa') && currentFitxaStudentId !== null) renderFitxa(currentFitxaStudentId);
  if (document.getElementById('panelOverlay').classList.contains('open')) renderPanelStudents(students);
  initComentaris();
}

// Carrega l'estat principal des del cache local (instantani, sense xarxa)
function _loadMainFromCache() {
  try {
    const c = JSON.parse(localStorage.getItem('vedruna_cache_main') || 'null');
    if (!c) return false;
    if (c.students)   students      = c.students;
    if (c.registreItems) registreItems = c.registreItems;
    if (c.registreData)  registreData  = c.registreData;
    if (c.observacions)  observacions  = c.observacions;
    if (c.personal)      personal      = c.personal;
    return !!c.students;
  } catch(e) { return false; }
}

function _saveMainToCache() {
  try {
    localStorage.setItem('vedruna_cache_main', JSON.stringify({
      students, registreItems, registreData, observacions, personal,
    }));
  } catch(e) {}
}

async function loadAll() {
  if (!config.scriptUrl) { updateSync('', 'No configurat'); return; }

  // 1) PINTA IMMEDIATAMENT des del cache local (l'app es veu plena a l'instant)
  if (_loadMainFromCache()) {
    document.getElementById('setupBanner').style.display = 'none';
    _paintAllViews();
    updateSync('syncing', 'Actualitzant…');
  } else {
    updateSync('syncing', 'Sincronitzant…');
  }

  // 2) En segon pla, refresca amb les dades fresques del servidor
  try {
    const [alumnesR, registreR, obsR, personalR] = await Promise.all([
      appsScriptGet({ action: 'getAlumnes' }),
      appsScriptGet({ action: 'getRegistre' }),
      appsScriptGet({ action: 'getObservacions' }),
      appsScriptGet({ action: 'getAllPersonal' }),
    ]);
    if (alumnesR.ok)  { students = alumnesR.alumnes; }
    if (registreR.ok) { registreItems = registreR.items; registreData = registreR.data; }
    if (obsR.ok)      { observacions = obsR.observacions; }
    if (personalR.ok && personalR.personal) {
      personal = {};
      personalR.personal.forEach(function(p) {
        personal[p.id] = { mare: p.mare, pare: p.pare, emailMare: p.emailMare, emailPare: p.emailPare, obs: p.obs };
      });
    }
    await loadAllFromSheets();
    _saveMainToCache(); // desa per a la propera arrencada instantània

    updateSync('ok', 'Sincronitzat'); updateStatSync();
    document.getElementById('setupBanner').style.display = 'none';
    _paintAllViews();

    // Tasques en segon pla
    if (typeof _prefetchNotesResum === 'function') _prefetchNotesResum();
    loadGoogleTasksSilent();
    initNotifications();
  } catch (e) {
    updateSync('error', 'Sense connexió'); 
    // Si tenim cache, no mostrem error agressiu (l'app ja funciona offline)
    if (!students.length) showToast('Error: ' + e.message, 'error');
  }
}

/* ============================================================
   ALUMNES — PÀGINA LLISTA
   ============================================================ */
function renderAlumnesList() {
  const container = document.getElementById('alumnesList');
  container.querySelectorAll('.alumne-card').forEach(el => el.remove());
  const empty = document.getElementById('alumnesEmpty');
  if (!students.length) { empty.style.display = 'block'; return; }
  empty.style.display = 'none';

  const _alFrag = document.createDocumentFragment();
  students.forEach(s => {
    const obs      = observacions[s.id] || {};
    const obsCount = Object.values(obs).filter(v => v && v.trim()).length;
    const pd       = personal[s.id] || {};
    const hasAlert = pd.obs && pd.obs.trim();
    const hasData  = pd.mare || pd.pare || pd.emailMare || pd.emailPare || pd.obs;

    const card = document.createElement('div');
    card.className = 'alumne-card';
    card.innerHTML = `
      <div class="alumne-card-top" title="Obrir fitxa">
        <div class="student-avatar alumne-card-avatar">${getInitials(s.nom)}</div>
        <div class="alumne-card-nom">${s.nom}</div>
        ${hasAlert ? '<div class="alumne-card-alert" title="' + escapeHtml(pd.obs) + '">⚠</div>' : ''}
      </div>
      <div class="alumne-card-actions">
        <button class="alumne-card-btn ${hasData ? 'active' : ''}" title="Dades personals">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        </button>
        <button class="alumne-card-btn ${obsCount ? 'active' : ''}" title="${obsCount ? obsCount + ' observacions' : 'Sense observacions'}" style="position:relative">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          ${obsCount ? '<span class="obs-badge" style="top:-4px;right:-4px">' + (obsCount > 9 ? '9+' : obsCount) + '</span>' : ''}
        </button>
      </div>`;

    card.querySelector('.alumne-card-top').addEventListener('click', () => showFitxa(s.id));
    card.querySelectorAll('.alumne-card-btn')[0].addEventListener('click', e => { e.stopPropagation(); openPersonalDrawer(s.id); });
    card.querySelectorAll('.alumne-card-btn')[1].addEventListener('click', e => { e.stopPropagation(); openObsDrawer(s.id); });

    _alFrag.appendChild(card);
  });
  container.appendChild(_alFrag);
}

/* ============================================================
   ALUMNES — DRAWER GESTIONAR (afegir/eliminar)
   ============================================================ */
function renderPanelStudents(list) {
  const container = document.getElementById('studentList');
  container.querySelectorAll('.student-item').forEach(el => el.remove());
  if (!list.length) { setEmptyState(config.scriptUrl ? 'Cap alumne. Afegeix-ne un!' : 'Configura la connexió'); return; }
  document.getElementById('emptyMsg').style.display = 'none';
  list.forEach((s, idx) => {
    const obs      = observacions[s.id] || {};
    const obsCount = Object.values(obs).filter(v => v && v.trim()).length;
    const pd       = personal[s.id] || {};
    const hasData  = pd.mare || pd.pare || pd.emailMare || pd.emailPare || pd.obs;
    const div = document.createElement('div');
    div.className = 'student-item';
    const gen = s.genere === 'f' ? 'f' : 'm';
    div.innerHTML = `
      <span class="student-num">${idx + 1}</span>
      <div class="student-avatar">${getInitials(s.nom)}</div>
      <div class="student-info">
        <div class="student-name">${s.nom}</div>
        <div class="student-meta">2n C · <button class="student-gen-btn" data-gen="${gen}" title="Canviar gènere">${gen === 'f' ? '♀ Femení' : '♂ Masculí'}</button></div>
      </div>
      <div class="student-actions">
        <button class="btn-personal ${hasData ? 'has-data' : ''}" title="Dades personals">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        </button>
        <button class="btn-obs" title="Observacions${obsCount ? ' (' + obsCount + ')' : ''}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          ${obsCount ? '<span class="obs-badge">' + (obsCount > 9 ? '9+' : obsCount) + '</span>' : ''}
        </button>
        <button class="action-btn danger" title="Eliminar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        </button>
      </div>`;
    div.querySelector('.student-gen-btn').addEventListener('click', e => { e.stopPropagation(); toggleStudentGenere(s.id); });
    div.querySelector('.btn-personal').addEventListener('click', e => { e.stopPropagation(); openPersonalDrawer(s.id); });
    div.querySelector('.btn-obs').addEventListener('click', e => { e.stopPropagation(); openObsDrawer(s.id); });
    div.querySelector('.action-btn.danger').addEventListener('click', () => deleteStudent(s.id));
    container.appendChild(div);
  });
  const pcEl = document.getElementById('panelCount'); if (pcEl) pcEl.textContent = list.length + ' alumne' + (list.length!==1?'s':'') + ' · 2n C';
  const acEl = document.getElementById('alumnesCount'); if (acEl) acEl.textContent = '· ' + list.length + ' alumnes';
  document.getElementById('footerInfo').textContent = list.length + ' alumnes al full de càlcul';
}

/* ============================================================
   FITXA ALUMNE
   ============================================================ */
async function renderFitxa(studentId) {
  const s  = students.find(x => x.id === studentId);
  if (!s) return;

  // Carrega dades personals si no les tenim (normalment ja carregades per loadAll)
  if (!personal[studentId] && config.scriptUrl) {
    try {
      const s2 = students.find(x => x.id === studentId);
      const rowId = s2 ? (s2.rowId !== undefined ? s2.rowId : studentId) : studentId;
      const r = await appsScriptGet({ action: 'getPersonal', studentId: rowId });
      if (r.ok) personal[studentId] = r.dades;
    } catch (_) {}
  }

  const pd  = personal[studentId] || {};
  const obs = observacions[studentId] || {};

  // Avís important
  const alert = document.getElementById('fitxaAlert');
  if (pd.obs && pd.obs.trim()) {
    const linies = pd.obs.trim().split('\n').map(l => l.trim()).filter(l => l);
    document.getElementById('fitxaAlertText').innerHTML = linies.map(l => escapeHtml(l)).join(' <span class="obs-sep">|</span> ');
    alert.style.display = 'flex';
  } else { alert.style.display = 'none'; }

  // Dades personals
  const pBody = document.getElementById('fitxaPersonal');
  if (pd.mare || pd.pare || pd.emailMare || pd.emailPare) {
    pBody.innerHTML = [
      pd.mare      ? `<div class="fitxa-field"><div class="fitxa-field-label">Mare</div><div class="fitxa-field-val">${escapeHtml(pd.mare)}</div></div>` : '',
      pd.pare      ? `<div class="fitxa-field"><div class="fitxa-field-label">Pare</div><div class="fitxa-field-val">${escapeHtml(pd.pare)}</div></div>` : '',
      pd.emailMare ? `<div class="fitxa-field"><div class="fitxa-field-label">Email mare</div><div class="fitxa-field-val"><a href="mailto:${pd.emailMare}">${pd.emailMare}</a></div></div>` : '',
      pd.emailPare ? `<div class="fitxa-field"><div class="fitxa-field-label">Email pare</div><div class="fitxa-field-val"><a href="mailto:${pd.emailPare}">${pd.emailPare}</a></div></div>` : '',
    ].join('');
  } else {
    pBody.innerHTML = '<p class="fitxa-empty-field">Sense dades. Clica Editar per afegir-ne.</p>';
  }

  // Observacions agrupades per trimestre
  const obsBody    = document.getElementById('fitxaObservacions');
  const entrades   = Object.entries(obs).filter(([, v]) => v && v.trim());
  if (!entrades.length) {
    obsBody.innerHTML = '<p class="fitxa-empty-field">Sense observacions enregistrades.</p>';
  } else {
    const perTrim = { '1':[], '2':[], '3':[] };
    entrades.forEach(([key, text]) => {
      const [trim, ...matParts] = key.split('_');
      const mat = matParts.join('_');
      if (perTrim[trim]) perTrim[trim].push({ mat, text });
    });
    obsBody.innerHTML = [1,2,3].map(t => {
      const grup = perTrim[String(t)];
      if (!grup.length) return '';
      return `<div class="fitxa-obs-trim">
        <div class="fitxa-obs-trim-label">${TRIM_LABELS[String(t)]}</div>
        ${grup.map(({ mat, text }) => {
          const c = MATERIA_COLORS[mat] || MATERIA_COLORS.general;
          return `<div class="fitxa-obs-item">
            <span class="obs-materia-badge" style="background:${c.bg};color:${c.text};flex-shrink:0">${MATERIES[mat]||mat}</span>
            <span class="fitxa-obs-text">${escapeHtml(text)}</span>
          </div>`;
        }).join('')}
      </div>`;
    }).join('');
  }

  // Notes i activitats no entregades de la fitxa
  const notesBody = document.getElementById('fitxaNotes');
  loadFitxaNotes(studentId, notesBody);
  loadFitxaAssoliments(studentId, document.getElementById('fitxaAssoliments'));
  _updateFitxaNav();
}

/* ============================================================
   ALUMNES — CRUD
   ============================================================ */
// Cache del resum de notes (vàlid 2 min) per evitar recarregar en navegar entre fitxes
let _notesResumCache = null;
let _notesResumTs    = 0;

// Precarrega el resum en segon pla (sense bloquejar). Crida després de l'arrencada.
async function _prefetchNotesResum() {
  if (!config.scriptUrl || (_notesResumCache && Date.now() - _notesResumTs < 120000)) return;
  try {
    const r = await appsScriptGet({ action: 'getNotesResum' });
    if (r.ok) { _notesResumCache = r.resum; _notesResumTs = Date.now(); }
  } catch(e) {}
}

async function loadFitxaNotes(studentId, container) {
  container.innerHTML = '<p class="fitxa-empty-field">Carregant notes…</p>';
  if (!config.scriptUrl) {
    container.innerHTML = '<p class="fitxa-empty-field">Connecta amb Google Sheets per veure les notes.</p>';
    return;
  }

  const MATS_SHOW = ['matematiques','catala','medi','musica','angles','carpeta'];
  const TRIMS = [1, 2, 3];

  // Usa el resum cachejat (1 sola crida per tota la classe, no per alumne)
  let resum;
  if (_notesResumCache && Date.now() - _notesResumTs < 120000) {
    resum = _notesResumCache;
  } else {
    try {
      const r = await appsScriptGet({ action: 'getNotesResum' });
      if (!r.ok) throw new Error(r.error);
      resum = r.resum;
      _notesResumCache = resum; _notesResumTs = Date.now();
    } catch(e) {
      container.innerHTML = '<p class="fitxa-empty-field">Error carregant notes.</p>';
      return;
    }
  }

  // Extreu les dades d'aquest alumne del resum global
  const resultat = {};
  const neTotal  = {};
  MATS_SHOW.forEach(mat => {
    resultat[mat] = {};
    neTotal[mat]  = 0;
    TRIMS.forEach(trim => {
      const d = resum[mat] && resum[mat][trim];
      if (!d) { resultat[mat][trim] = null; return; }
      const arrod = d.notes[studentId] ?? null;
      const ne    = d.ne[studentId] || 0;
      resultat[mat][trim] = { arrod, ne };
      neTotal[mat] += ne;
    });
  });

  // NE per trimestre actual
  const trimActual = getTrimestreActual() || 1;
  const trimLabel  = getTrimLabel(trimActual);

  // NE del trimestre actual per assignatura
  const neTrimActual = {}; // { materia: count }
  MATS_SHOW.forEach(m => {
    neTrimActual[m] = resultat[m][trimActual]?.ne || 0;
  });
  const totalNETrim = Object.values(neTrimActual).reduce((a,b) => a+b, 0);

  const Q = n => {
    if (n === null) return '<span class="nota-badge pendent">—</span>';
    const isSus = n < 5;
    const qual  = n >= 9 ? 'AE' : n >= 7 ? 'AN' : n >= 5 ? 'AS' : 'NA';
    const bg    = isSus ? '#FFCDD2' : '#BBDEFB';
    const fc    = isSus ? '#991B1B' : '#1E40AF';
    return `<span class="nota-badge" style="background:${bg};color:${fc};font-weight:700">${n} <small style="font-weight:500">${qual}</small></span>`;
  };

  container.innerHTML = `
    ${totalNETrim > 0 ? `
    <div class="fitxa-ne-banner">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      <div>
        <strong>${totalNETrim} activitat${totalNETrim!==1?'s':''} no entregada${totalNETrim!==1?'s':''}</strong> al ${trimLabel}
        <div class="fitxa-ne-detail">${MATS_SHOW.filter(m=>neTrimActual[m]>0).map(m=>`${MATERIES[m]}: ${neTrimActual[m]}`).join(' · ')}</div>
      </div>
    </div>` : ''}
    <table class="fitxa-notes-table">
      <thead><tr><th>Assignatura</th><th>1r Trim</th><th>2n Trim</th><th>3r Trim</th></tr></thead>
      <tbody>
        ${MATS_SHOW.map(k => `
          <tr>
            <td>${MATERIES[k]}</td>
            ${TRIMS.map(t => `<td>${Q(resultat[k][t]?.arrod ?? null)}</td>`).join('')}
          </tr>`).join('')}
      </tbody>
    </table>`;
}

function loadFitxaAssoliments(studentId, container) {
  const MATS = ['matematiques','catala','medi','musica','angles'];
  const TRIMS = [1,2,3];
  const TRIM_NOM = ['1r T','2n T','3r T'];

  // Calcula % per cada assignatura i trimestre (lectura directa localStorage)
  const rows = MATS.map(mat => {
    const pcts = TRIMS.map(trim => {
      const objRaw = localStorage.getItem(`assim_obj_${mat}_${trim}`);
      if (!objRaw) return null;
      const objectius = JSON.parse(objRaw);
      if (!objectius.length) return null;
      let punts = 0;
      const prefix = `assim_${mat}_${trim}_${studentId}_`;
      objectius.forEach(obj => {
        const v = localStorage.getItem(prefix + obj.id);
        if (v === 'true') punts += 1;
        else if (v === '"partial"') punts += 0.5;
      });
      return Math.round(punts / objectius.length * 100);
    });
    return { mat, pcts };
  });

  // Comprova si hi ha alguna dada
  const tensDades = rows.some(r => r.pcts.some(p => p !== null));
  if (!tensDades) {
    container.innerHTML = '<p class="fitxa-empty-field">Sense objectius d\'assoliment definits.</p>';
    return;
  }

  const pctBadge = (pct) => {
    if (pct === null) return '<span style="color:var(--text-muted);font-size:12px">—</span>';
    const bg = pct >= 80 ? '#D1FAE5' : pct >= 50 ? '#FEF3C7' : '#FEE2E2';
    const fc = pct >= 80 ? '#065F46' : pct >= 50 ? '#92400E' : '#991B1B';
    return `<span style="background:${bg};color:${fc};padding:2px 8px;border-radius:10px;font-weight:700;font-size:12px">${pct}%</span>`;
  };

  container.innerHTML = `
    <table class="fitxa-notes-table">
      <thead><tr>
        <th>Assignatura</th>
        ${TRIM_NOM.map(t => `<th>${t}</th>`).join('')}
      </tr></thead>
      <tbody>
        ${rows.map(r => `<tr>
          <td>${MATERIES[r.mat] || r.mat}</td>
          ${r.pcts.map(p => `<td style="text-align:center">${pctBadge(p)}</td>`).join('')}
        </tr>`).join('')}
      </tbody>
    </table>`;
}

function navFitxa(delta) {
  const idx = students.findIndex(s => s.id === currentFitxaStudentId);
  if (idx === -1) return;
  const next = idx + delta;
  if (next < 0 || next >= students.length) return;
  // showFitxa actualitza currentFitxaStudentId, nom, avatar i tot
  showFitxa(students[next].id);
}

function _updateFitxaNav() {
  const idx = students.findIndex(s => s.id === currentFitxaStudentId);
  const prev = document.getElementById('fitxaPrevBtn');
  const nxt  = document.getElementById('fitxaNextBtn');
  const pos  = document.getElementById('fitxaNavPos');
  if (prev) prev.disabled = idx <= 0;
  if (nxt)  nxt.disabled  = idx >= students.length - 1;
  if (pos)  pos.textContent = (idx + 1) + ' / ' + students.length;
}

function getInitials(nom) {
  const parts = nom.trim().split(' ');
  return parts.length >= 2 ? (parts[0][0] + parts[parts.length-1][0]).toUpperCase() : (nom[0]||'?').toUpperCase();
}
function toggleAddForm() {
  const f = document.getElementById('addForm');
  f.classList.toggle('open');
  if (f.classList.contains('open')) { document.getElementById('newStudentName').value=''; document.getElementById('newStudentName').focus(); }
}
function filterStudents() {
  const q = document.getElementById('searchInput').value.toLowerCase();
  renderPanelStudents(students.filter(s => s.nom.toLowerCase().includes(q)));
}
async function addStudent() {
  const nom = document.getElementById('newStudentName').value.trim();
  if (!nom) { document.getElementById('newStudentName').focus(); return; }
  const generSel = document.querySelector('input[name="newStudentGenere"]:checked');
  const genere   = generSel ? generSel.value : 'm';
  students.push({ id: students.length, nom, genere });
  // Reset del formulari
  document.getElementById('newStudentName').value = '';
  document.querySelector('input[name="newStudentGenere"][value="m"]').checked = true;
  toggleAddForm();
  renderPanelStudents(students);
  updateHomeCounters();
  initComentaris();
  await saveStudents();
  if (!document.getElementById('page-alumnes').classList.contains('page-hidden')) renderAlumnesList();
  if (!document.getElementById('page-registres').classList.contains('page-hidden')) renderRegistre();
  if (!document.getElementById('page-observacions').classList.contains('page-hidden')) renderObsGrid();
}
async function toggleStudentGenere(id) {
  const s = students.find(x => x.id === id);
  if (!s) return;
  s.genere = s.genere === 'f' ? 'm' : 'f';
  renderPanelStudents(students);
  await saveStudents();
}

async function deleteStudent(id) {
  if (!confirm('Eliminar aquest alumne?')) return;
  students = students.filter(s => s.id !== id).map((s,i) => ({...s, id:i}));
  renderPanelStudents(students);
  updateHomeCounters();
  await saveStudents();
  if (!document.getElementById('page-alumnes').classList.contains('page-hidden')) renderAlumnesList();
  if (!document.getElementById('page-observacions').classList.contains('page-hidden')) renderObsGrid();
}
async function saveStudents() {
  if (!config.scriptUrl) return;
  updateSync('syncing', 'Guardant…');
  try {
    const r = await appsScriptPost({ action: 'setAlumnes', alumnes: students });
    if (!r.ok) throw new Error(r.error);
    await appsScriptPost({ action: 'syncAlumnesARegistre', alumnes: students });
    updateSync('ok', 'Sincronitzat'); updateStatSync();
    showToast('Canvis guardats', 'success');
  } catch (e) { updateSync('error', 'Error'); showToast('Error: ' + e.message, 'error'); }
}
async function syncStudents() {
  document.getElementById('syncBtn').classList.add('spinning');
  await loadAll();
  document.getElementById('syncBtn').classList.remove('spinning');
}

/* ============================================================
   OBSERVACIONS — Grid
   ============================================================ */
function renderObsGrid() {
  const grid  = document.getElementById('obsStudentGrid');
  grid.querySelectorAll('.obs-student-card').forEach(el => el.remove());
  const empty = document.getElementById('obsEmpty');
  if (!students.length) { empty.style.display='block'; return; }
  empty.style.display = 'none';
  students.forEach(s => {
    const obs   = observacions[s.id] || {};
    const count = Object.values(obs).filter(v => v&&v.trim()).length;
    const card  = document.createElement('div');
    card.className = 'obs-student-card';
    card.innerHTML = `
      <div class="student-avatar">${getInitials(s.nom)}</div>
      <div class="obs-student-card-info">
        <div class="obs-student-card-name">${s.nom}</div>
        <div class="obs-student-card-count ${count?'has-obs':''}">
          ${count ? count+(count!==1?' assignatures':' assignatura') : 'Sense observacions'}
        </div>
      </div>
      <svg style="width:16px;height:16px;color:var(--border-strong);flex-shrink:0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>`;
    card.addEventListener('click', () => openObsDrawer(s.id));
    grid.appendChild(card);
  });
}

/* ============================================================
   OBSERVACIONS — Drawer
   ============================================================ */
function renderObsDrawerContent(studentId) {
  const list  = document.getElementById('obsDrawerList');
  const empty = document.getElementById('obsDrawerEmpty');
  list.querySelectorAll('.obs-entry,.obs-trim-label').forEach(el => el.remove());
  const obs      = observacions[studentId] || {};
  const entrades = Object.entries(obs).filter(([,v]) => v&&v.trim());
  if (!entrades.length) { empty.style.display='block'; return; }
  empty.style.display = 'none';
  const perTrim = { '1':[], '2':[], '3':[] };
  entrades.forEach(([key, text]) => {
    const [trim, ...mp] = key.split('_'); const mat = mp.join('_');
    if (perTrim[trim]) perTrim[trim].push({ mat, text, key });
  });
  [1,2,3].forEach(t => {
    const grup = perTrim[String(t)];
    if (!grup.length) return;
    const label = document.createElement('span');
    label.className = 'obs-trim-label'; label.textContent = TRIM_LABELS[String(t)];
    list.appendChild(label);
    grup.forEach(({ mat, text }) => {
      const c = MATERIA_COLORS[mat]||MATERIA_COLORS.general;
      const div = document.createElement('div');
      div.className = 'obs-entry';
      div.innerHTML = `
        <div class="obs-entry-header">
          <span class="obs-materia-badge" style="background:${c.bg};color:${c.text}">${MATERIES[mat]||mat}</span>
          <button class="obs-entry-edit" onclick="editObservacio(${studentId},'${mat}',${t})"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 1 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          <button class="obs-entry-delete" onclick="deleteObservacioMateria(${studentId},'${mat}',${t})"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
        </div>
        <div class="obs-entry-text">${escapeHtml(text)}</div>`;
      list.appendChild(div);
    });
  });
  const tot = entrades.length;
  document.getElementById('obsDrawerMeta').textContent =
    tot+(tot!==1?' assignatures':' assignatura')+' amb observacions';
}

/* ============================================================
   OBSERVACIONS — Save / Edit / Delete
   ============================================================ */
async function saveObservacio() {
  const studentId = parseInt(document.getElementById('obsAlumne').value);
  const materia   = document.getElementById('obsMateria').value;
  const trimestre = document.getElementById('obsTrimestre').value;
  const text      = document.getElementById('obsText').value.trim();
  if (!text) { document.getElementById('obsText').focus(); return; }
  const key = trimestre+'_'+materia;
  if (!observacions[studentId]) observacions[studentId]={};
  const cur = observacions[studentId][key]||'';
  observacions[studentId][key] = cur ? cur+' · '+text : text;
  closeAddObsModal();
  refreshObsViews(studentId);
  if (config.scriptUrl) {
    try {
      const r = await appsScriptPost({ action:'saveObservacio', studentId, materia, trimestre, text });
      if (!r.ok) throw new Error(r.error);
      showToast('Observació guardada','success');
    } catch(e){ showToast('Error: '+e.message,'error'); }
  }
}
function editObservacio(studentId, materia, trimestre) {
  const sel = document.getElementById('obsAlumne');
  sel.innerHTML = students.map(s=>`<option value="${s.id}" ${s.id===studentId?'selected':''}>${s.nom}</option>`).join('');
  document.getElementById('obsMateria').value   = materia;
  document.getElementById('obsTrimestre').value = String(trimestre);
  const key = trimestre+'_'+materia;
  document.getElementById('obsText').value = (observacions[studentId]||{})[key]||'';
  const btn = document.getElementById('saveObsBtn');
  btn.textContent = 'Substituir';
  btn.onclick     = () => replaceObservacio(studentId, materia, trimestre);
  document.getElementById('addObsOverlay').classList.add('open');
  setTimeout(()=>{ const ta=document.getElementById('obsText'); ta.focus(); ta.setSelectionRange(ta.value.length,ta.value.length); },100);
}
async function replaceObservacio(studentId, materia, trimestre) {
  const text = document.getElementById('obsText').value.trim(); if (!text) return;
  const key  = trimestre+'_'+materia;
  if (!observacions[studentId]) observacions[studentId]={};
  observacions[studentId][key] = text;
  resetSaveObsBtn(); closeAddObsModal(); refreshObsViews(studentId);
  if (config.scriptUrl) {
    try { const r = await appsScriptPost({action:'saveObservacio',studentId,materia,trimestre:String(trimestre),text,replace:true}); if(!r.ok) throw new Error(r.error); showToast('Observació actualitzada','success'); }
    catch(e){ showToast('Error: '+e.message,'error'); }
  }
}
async function deleteObservacioMateria(studentId, materia, trimestre) {
  if (!confirm('Esborrar les observacions de '+(MATERIES[materia]||materia)+' ('+TRIM_LABELS[String(trimestre)]+') per aquest alumne?')) return;
  const key = trimestre+'_'+materia;
  if (observacions[studentId]) delete observacions[studentId][key];
  refreshObsViews(studentId);
  if (config.scriptUrl) { try { await appsScriptPost({action:'deleteObservacio',studentId,materia,trimestre:String(trimestre)}); } catch(e){ showToast('Error: '+e.message,'error'); } }
}
function refreshObsViews(studentId) {
  if (!document.getElementById('page-observacions').classList.contains('page-hidden')) renderObsGrid();
  if (currentObsStudentId === studentId) renderObsDrawerContent(studentId);
  if (currentFitxaStudentId === studentId && !document.getElementById('page-fitxa').classList.contains('page-hidden')) renderFitxa(studentId);
  if (!document.getElementById('page-alumnes').classList.contains('page-hidden')) renderAlumnesList();
}
function resetSaveObsBtn() {
  const btn = document.getElementById('saveObsBtn');
  btn.textContent = 'Guardar'; btn.onclick = saveObservacio;
}

/* ============================================================
   REGISTRES D'AULA
   ============================================================ */
function selectType(el) { document.querySelectorAll('.type-option').forEach(o=>o.classList.remove('selected')); el.classList.add('selected'); }
function selectTypeByValue(val) { document.querySelectorAll('.type-option').forEach(o=>o.classList.toggle('selected',o.dataset.type===val)); }
function getSelectedType() { return (document.querySelector('.type-option.selected')||{}).dataset?.type||'checkbox'; }

async function addRegistreItem() {
  const nom=document.getElementById('newItemName').value.trim(), tipus=getSelectedType();
  if (!nom){ document.getElementById('newItemName').focus(); return; }
  closeNewItemModal();
  const item={id:Date.now(),nom,tipus};
  registreItems.push(item); registreData[item.id]={};
  students.forEach(s=>{registreData[item.id][s.id]=tipus==='checkbox'?false:'';});
  renderRegistre();
  if (config.scriptUrl) {
    updateSync('syncing','Creant columna…');
    try { const r=await appsScriptPost({action:'addRegistreItem',item,alumnes:students}); if(!r.ok) throw new Error(r.error); updateSync('ok','Sincronitzat'); showToast('Ítem «'+nom+'» creat','success'); }
    catch(e){ updateSync('error','Error'); showToast('Error: '+e.message,'error'); }
  }
}
async function deleteRegistreItem(itemId) {
  const item=registreItems.find(i=>i.id===itemId);
  if (!item||!confirm('Eliminar «'+item.nom+'»?')) return;
  registreItems=registreItems.filter(i=>i.id!==itemId); delete registreData[itemId];
  renderRegistre();
  if (config.scriptUrl){ try{ await appsScriptPost({action:'deleteRegistreItem',itemId}); showToast('Ítem eliminat','success'); } catch(e){ showToast('Error: '+e.message,'error'); } }
}
async function updateRegistreCell(itemId,studentId,value) {
  if (!registreData[itemId]) registreData[itemId]={};
  registreData[itemId][studentId]=value;
  if (config.scriptUrl){ try{ await appsScriptPost({action:'updateRegistreCell',itemId,studentId,value}); } catch(e){ showToast('Error: '+e.message,'error'); } }
}
async function syncRegistre(){ await loadAll(); renderRegistre(); }

function renderRegistre() {
  const empty=document.getElementById('registreEmpty'), table=document.getElementById('registreTable');
  const tbody=document.getElementById('regTableBody'), thead=document.querySelector('.reg-table thead tr');
  while(thead.children.length>1) thead.removeChild(thead.lastChild);
  tbody.innerHTML='';
  if (!registreItems.length){ empty.style.display='block'; table.style.display='none'; return; }
  empty.style.display='none'; table.style.display='block';
  registreItems.forEach(item=>{
    const th=document.createElement('th'); th.className='reg-th-item';
    th.innerHTML=`<div class="reg-th-inner"><span>${escapeHtml(item.nom)}</span><button class="reg-th-delete" onclick="deleteRegistreItem(${item.id})"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button></div>`;
    thead.appendChild(th);
  });
  const _regFrag = document.createDocumentFragment();
  students.forEach(s=>{
    const tr=document.createElement('tr');
    const tdN=document.createElement('td'); tdN.className='reg-td-name';
    tdN.innerHTML=`<div class="student-avatar" style="width:28px;height:28px;font-size:10px;flex-shrink:0">${getInitials(s.nom)}</div>${escapeHtml(s.nom)}`;
    tr.appendChild(tdN);
    registreItems.forEach(item=>{
      const td=document.createElement('td'); td.className='reg-td-cell';
      const val=(registreData[item.id]||{})[s.id];
      if (item.tipus==='checkbox'){ const cb=document.createElement('input'); cb.type='checkbox'; cb.className='reg-checkbox'; cb.checked=val===true||val==='TRUE'; cb.addEventListener('change',()=>updateRegistreCell(item.id,s.id,cb.checked)); td.appendChild(cb); }
      else { const inp=document.createElement('input'); inp.type='text'; inp.className='reg-text-input'; inp.value=val||''; inp.placeholder='—'; let t; inp.addEventListener('input',()=>{clearTimeout(t);t=setTimeout(()=>updateRegistreCell(item.id,s.id,inp.value),800);}); td.appendChild(inp); }
      tr.appendChild(td);
    });
    _regFrag.appendChild(tr);
  });
  tbody.appendChild(_regFrag);
}

/* ============================================================
   UI HELPERS
   ============================================================ */
function setEmptyState(msg) {
  const em=document.getElementById('emptyMsg');
  em.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg><span>${msg}</span>`;
  em.style.display='block';
  document.getElementById('studentList').querySelectorAll('.student-item').forEach(el=>el.remove());
}
function updateHomeCounters() {
  // Comptador a la pàgina d'alumnes
  const panelCount = document.getElementById('panelCount');
  if (panelCount) panelCount.textContent = students.length + ' alumne' + (students.length !== 1 ? 's' : '') + ' · 2n C';
  // Data al sidebar
  const dateEl = document.getElementById('sidebarDate');
  if (dateEl) {
    const avui = new Date();
    const dies = ['Diumenge','Dilluns','Dimarts','Dimecres','Dijous','Divendres','Dissabte'];
    const mesos = ['gener','febrer','març','abril','maig','juny','juliol','agost','setembre','octubre','novembre','desembre'];
    dateEl.textContent = dies[avui.getDay()] + ', ' + avui.getDate() + ' de ' + mesos[avui.getMonth()] + ' de ' + avui.getFullYear();
  }
}
function updateSync(state,text) { document.getElementById('syncDot').className='sync-dot '+state; document.getElementById('syncText').textContent=text; }
function updateStatSync() {
  const now  = new Date();
  const hora = now.getHours() + ':' + String(now.getMinutes()).padStart(2,'0');
  const el   = document.getElementById('syncHora');
  if (el) { el.textContent = '· ' + hora; el.style.display = 'inline'; }
}
function escapeHtml(str) { return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

let toastTimer;
function showToast(msg,type='info') {
  const icons={success:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>`,error:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>`,info:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>`};
  const t=document.getElementById('toast');
  t.innerHTML=icons[type]+'<span>'+msg+'</span>';
  t.className='toast show'+(type==='success'?' success':type==='error'?' error':'');
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.classList.remove('show'),3500);
}

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  updateHomeCounters(); // inicialitza data sidebar
  document.getElementById('newStudentName').addEventListener('keydown',e=>{if(e.key==='Enter') addStudent();});
  document.getElementById('newItemName').addEventListener('keydown',   e=>{if(e.key==='Enter') addRegistreItem();});
  document.getElementById('obsText').addEventListener('keydown',       e=>{if(e.key==='Enter'&&e.ctrlKey) saveObservacio();});
  // Marca Inici com actiu per defecte
  document.querySelector('.nav-item')?.classList.add('active');
  if (config.scriptUrl) loadAll();
  else updateSync('','No configurat');
});

/* ============================================================
   PLANNING SETMANAL
   Estructura de dades per cel·la (localStorage):
   key: plan_{any}_{setmana}_{dia}_{franja}
   val: JSON { tipus, assig, sub, alerta, link, event, eventSub }
   Notes setmana:
   key: plan_notes_{any}_{setmana}
   val: text multilínia
   ============================================================ */

// Franges horàries (de la plantilla)
const PLAN_FRANGES = [
  { id: 'f1', hora: '08:50 – 09:45' },
  { id: 'f2', hora: '09:45 – 10:40' },
  { id: 'f3', hora: '10:40 – 11:10' },
  { id: 'f4', hora: '11:10 – 12:00' },
  { id: 'f5', hora: '12:00 – 12:50' },
  { id: 'f6', hora: '12:50 – 14:50' },
  { id: 'f7', hora: '14:50 – 15:50' },
  { id: 'f8', hora: '15:50 – 16:50' },
];
const PLAN_DIES = [
  { id: 'dl', nom: 'Dilluns' },
  { id: 'dm', nom: 'Dimarts' },
  { id: 'dc', nom: 'Dimecres' },
  { id: 'dj', nom: 'Dijous' },
  { id: 'dv', nom: 'Divendres' },
];

let _planWeekOffset = 0;
let _planEditKey    = null; // clau de la cel·la que s'està editant
let _planDuradaN    = 2;    // franges personalitzades

/* --- Claus i dades --- */
function getPlanWeekId(offset) {
  const d = new Date();
  d.setDate(d.getDate() + (offset || 0) * 7);
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7));
  const ys = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const wn = Math.ceil((((tmp - ys) / 86400000) + 1) / 7);
  return tmp.getUTCFullYear() + '_S' + String(wn).padStart(2, '0');
}

function getPlanWeekLabel(offset) {
  const d = new Date();
  d.setDate(d.getDate() + (offset || 0) * 7);
  const day = d.getDay() || 7;
  const dl = new Date(d); dl.setDate(d.getDate() - day + 1);
  const dv = new Date(dl); dv.setDate(dl.getDate() + 4);
  const fmt = dt => dt.toLocaleDateString('ca-ES', { day: 'numeric', month: 'long' });
  return fmt(dl) + ' – ' + fmt(dv);
}

function getPlanMondayDate(offset) {
  const d = new Date();
  d.setDate(d.getDate() + (offset || 0) * 7);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
  return d;
}

function planCellKey(diaId, franjaId) {
  return 'plan_' + getPlanWeekId(_planWeekOffset) + '_' + diaId + '_' + franjaId;
}
function planCellLoad(diaId, franjaId) {
  const v = localStorage.getItem(planCellKey(diaId, franjaId));
  return v ? JSON.parse(v) : null;
}
function planWeekNotesKey() { return 'plan_notes_' + getPlanWeekId(_planWeekOffset); }

/* --- Events del calendari dins del planning --- */
// Parseja l'hora d'inici d'una franja ('08:50 – 09:45' → minuts des de mitjanit)
function _franjaInici(franja) {
  const m = (franja.hora || '').match(/(\d{1,2}):(\d{2})/);
  return m ? parseInt(m[1]) * 60 + parseInt(m[2]) : null;
}
function _franjaFi(franja) {
  const m = [...(franja.hora || '').matchAll(/(\d{1,2}):(\d{2})/g)];
  const last = m[m.length - 1];
  return last ? parseInt(last[1]) * 60 + parseInt(last[2]) : null;
}
// Retorna els events del calendari que cauen en un dia+franja determinats
function planCalEvents(diaId, franja) {
  const diaIdx = PLAN_DIES.findIndex(d => d.id === diaId);
  if (diaIdx < 0) return [];
  const dataDia = new Date(getPlanMondayDate(_planWeekOffset));
  dataDia.setDate(dataDia.getDate() + diaIdx);
  const y  = dataDia.getFullYear();
  const ds = `${y}-${String(dataDia.getMonth()+1).padStart(2,'0')}-${String(dataDia.getDate()).padStart(2,'0')}`;

  const ini = _franjaInici(franja), fi = _franjaFi(franja);
  const esPrimera = franja.id === PLAN_FRANGES[0].id;
  const esUltima  = franja.id === PLAN_FRANGES[PLAN_FRANGES.length - 1].id;
  const horariIni = _franjaInici(PLAN_FRANGES[0]);
  const horariFi  = _franjaFi(PLAN_FRANGES[PLAN_FRANGES.length - 1]);

  const evs = JSON.parse(localStorage.getItem('cal2_events_' + y) || '[]');
  return evs.filter(ev => {
    if (ev.data !== ds) return false;
    // Sense hora → es mostra a la primera franja del dia
    if (!ev.hora) return esPrimera;
    const m = ev.hora.match(/(\d{1,2}):(\d{2})/);
    if (!m) return esPrimera;
    const min = parseInt(m[1]) * 60 + parseInt(m[2]);
    // Dins d'aquesta franja
    if (ini !== null && fi !== null && min >= ini && min < fi) return true;
    // Fora de l'horari escolar → a la primera (si és abans) o última franja (si és després)
    if (min < horariIni && esPrimera) return true;
    if (min >= horariFi && esUltima) return true;
    return false;
  });
}

/* --- Render --- */
function renderPlanning() {
  const titleEl = document.getElementById('planWeekTitle');
  if (!titleEl) return; // element no present (pàgina no carregada)
  titleEl.textContent = getPlanWeekLabel(_planWeekOffset);

  // Notes setmana
  const notes = localStorage.getItem(planWeekNotesKey()) || '';
  const notesEl = document.getElementById('planWeekNotes');
  if (notes.trim()) {
    notesEl.style.display = 'block';
    const noteLines = notes.trim().split('\n').map(n => n.trim()).filter(n => n);
    notesEl.innerHTML = noteLines.map((n, i) =>
      `<span class="plan-week-note-tag">⚠ ${escapeHtml(n)}<button class="plan-note-del" onclick="deleteWeekNote(${i})" title="Esborrar">×</button></span>`
    ).join('');
  } else {
    notesEl.style.display = 'none';
    notesEl.innerHTML = '';
  }

  // Dates de cada dia
  const dl = getPlanMondayDate(_planWeekOffset);
  const today = new Date();
  const toStr = d => d.toLocaleDateString('ca-ES', { day: 'numeric', month: 'short' });

  let html = '<thead><tr><th class="plan-th-hora"></th>';
  PLAN_DIES.forEach((dia, i) => {
    const dateD = new Date(dl); dateD.setDate(dl.getDate() + i);
    const isToday = dateD.toDateString() === today.toDateString();
    const _dayNotes = planDayNoteLoad(dia.id);
    const _diaId = dia.id;
    html += `<th class="plan-th-dia${isToday ? ' plan-th-today' : ''}">
      <div class="plan-th-dia-top">${dia.nom}<span class="plan-th-date">${toStr(dateD)}</span>
        <button class="plan-day-add-note" onclick="event.stopPropagation();openPlanNoteDay('${_diaId}')" title="Afegir nota del dia">+</button>
      </div>
      ${_dayNotes.map((n, i) => `<div class="plan-day-note-text"><span>${escapeHtml(n)}</span><button class="plan-note-del" onclick="event.stopPropagation();deleteDayNoteItem('${_diaId}',${i})" title="Esborrar">×</button></div>`).join('')}
    </th>`;
  });
  html += '</tr></thead><tbody>';

  PLAN_FRANGES.forEach(franja => {
    const isPati = franja.id === 'f3' || franja.id === 'f6';
    html += `<tr class="${isPati ? 'plan-row-pati' : 'plan-row'}">`;
    html += `<td class="plan-td-hora">${franja.hora}</td>`;

    PLAN_DIES.forEach(dia => {
      const data = planCellLoad(dia.id, franja.id);
      const key  = planCellKey(dia.id, franja.id);
      const calEvs = planCalEvents(dia.id, franja);
      html += renderPlanCell(data, key, isPati, calEvs);
    });
    html += '</tr>';
  });
  html += '</tbody>';
  document.getElementById('planTable').innerHTML = html;
}

function renderPlanCell(data, key, isPati, calEvs) {
  // Bloc d'events del calendari (alerta visual, no editable des d'aquí)
  let calHtml = '';
  if (calEvs && calEvs.length) {
    calHtml = calEvs.map(ev => {
      const hora = ev.hora ? `<span class="plan-cell-cal-hora">${escapeHtml(ev.hora)}</span> ` : '';
      const tip  = (ev.titol || '') + (ev.desc ? ' — ' + ev.desc : '');
      return `<div class="plan-cell-cal-event" title="${escapeHtml(tip)}" onclick="event.stopPropagation();showPage('calendari')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="11" height="11"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        ${hora}${escapeHtml(ev.titol || 'Event')}
      </div>`;
    }).join('');
  }

  if (!data) {
    const cls = isPati ? 'plan-cell plan-cell-pati' : 'plan-cell plan-cell-empty';
    return `<td class="${cls}" onclick="openPlanCell('${key}')">
      ${calHtml}
      <div class="plan-cell-coment-dot" onclick="event.stopPropagation();openPlanCellComent('${key}')" title="Afegir comentari de sessió">
        <svg viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      </div>
    </td>`;
  }

  if (data.tipus === 'festa') {
    return `<td class="plan-cell plan-cell-festa" onclick="openPlanCell('${key}')">
      ${calHtml}
      <div class="plan-cell-event-name">${escapeHtml(data.event || 'FESTA')}</div>
      ${data.eventSub ? `<div class="plan-cell-event-sub">${escapeHtml(data.eventSub)}</div>` : ''}
    </td>`;
  }
  if (data.tipus === 'especial') {
    return `<td class="plan-cell plan-cell-especial" onclick="openPlanCell('${key}')">
      ${calHtml}
      <div class="plan-cell-event-name">${escapeHtml(data.event || '')}</div>
      ${data.eventSub ? `<div class="plan-cell-event-sub">${escapeHtml(data.eventSub)}</div>` : ''}
    </td>`;
  }
  if (data.tipus === 'sortida') {
    return `<td class="plan-cell plan-cell-sortida" onclick="openPlanCell('${key}')">
      ${calHtml}
      <div class="plan-cell-event-name">${escapeHtml(data.event || '')}</div>
      ${data.eventSub ? `<div class="plan-cell-event-sub">${escapeHtml(data.eventSub)}</div>` : ''}
    </td>`;
  }

  // Normal
  let inner = '';
  inner += calHtml;
  if (data.alerta) inner += `<div class="plan-cell-alerta">⚠ ${escapeHtml(data.alerta)}</div>`;
  if (data.assig)  inner += `<div class="plan-cell-assig">${escapeHtml(data.assig)}</div>`;
  if (data.sub)    inner += `<div class="plan-cell-sub">${escapeHtml(data.sub)}</div>`;
  if (data.link)   inner += `<a class="plan-cell-link" href="${data.link}" target="_blank" onclick="event.stopPropagation()">📄 Programació</a>`;
  const comentClass = data.coment ? 'plan-cell-coment-dot has-coment' : 'plan-cell-coment-dot';
  const comentColor  = data.coment ? '#7A1E2E' : '#9CA3AF';
  inner += `<div class="${comentClass}" onclick="event.stopPropagation();openPlanCellComent('${key}')" title="${data.coment ? escapeHtml(data.coment) : 'Afegir comentari de sessió'}">
    <svg viewBox="0 0 24 24" fill="${data.coment ? '#FBEAED' : 'none'}" stroke="${comentColor}" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
  </div>`;

  const cls = isPati ? 'plan-cell plan-cell-pati' : 'plan-cell';
  return `<td class="${cls}" onclick="openPlanCell('${key}')">${inner}</td>`;
}

/* --- Modal cel·la --- */
function openPlanCellComent(key) {
  _planEditKey = key;
  const data = JSON.parse(localStorage.getItem(key) || 'null') || {};
  const parts = key.split('_');
  const diaId    = parts[parts.length-2];
  const franjaId = parts[parts.length-1];
  const dia    = PLAN_DIES.find(d => d.id === diaId);
  const franja = PLAN_FRANGES.find(f => f.id === franjaId);
  document.getElementById('planComentTitle').textContent = (dia ? dia.nom : '') + ' · ' + (franja ? franja.hora : '');
  document.getElementById('planComentText').value = data.coment || '';
  document.getElementById('planComentOverlay').classList.add('open');
  setTimeout(() => document.getElementById('planComentText').focus(), 100);
}

function savePlanComent() {
  const data   = JSON.parse(localStorage.getItem(_planEditKey) || 'null') || {};
  const coment = document.getElementById('planComentText').value.trim();
  if (coment) data.coment = coment;
  else delete data.coment;
  // Guarda (si no té res més, esborra del tot)
  const hasDades = data.tipus || data.assig || data.event || data.alerta || data.coment;
  if (hasDades) localStorage.setItem(_planEditKey, JSON.stringify(data));
  else localStorage.removeItem(_planEditKey);
  document.getElementById('planComentOverlay').classList.remove('open');
  renderPlanning();
  syncPlanningWeek();
}

function closePlanComent() { document.getElementById('planComentOverlay').classList.remove('open'); }

function openPlanCell(key) {
  _planEditKey = key;
  const data   = JSON.parse(localStorage.getItem(key) || 'null');
  const parts  = key.split('_'); // plan_YYYY_S##_dia_franja
  const diaId  = parts[parts.length - 2];
  const franjaId = parts[parts.length - 1];
  const dia    = PLAN_DIES.find(d => d.id === diaId);
  const franja = PLAN_FRANGES.find(f => f.id === franjaId);

  document.getElementById('planCellTitle').textContent = (dia ? dia.nom : '') + ' · ' + (franja ? franja.hora : '');
  document.getElementById('planCellSub').textContent   = getPlanWeekId(_planWeekOffset).replace('_', ' ');

  const tipus = data?.tipus || 'normal';
  document.querySelectorAll('input[name="planCellType"]').forEach(r => r.checked = r.value === tipus);
  updatePlanCellType(tipus);

  if (tipus === 'normal') {
    document.getElementById('planCellAssig').value  = data?.assig   || '';
    document.getElementById('planCellSub2').value   = data?.sub     || '';
    document.getElementById('planCellAlerta').value = data?.alerta  || '';
    document.getElementById('planCellLink').value   = data?.link    || '';
  } else {
    document.getElementById('planCellEvent').value    = data?.event    || '';
    document.getElementById('planCellEventSub').value = data?.eventSub || '';
  }
  document.getElementById('planCellComent').value = data?.coment || '';
  // Reinicia selector de durada (només per a especials)
  _resetPlanDurada();
  document.getElementById('planCellOverlay').classList.add('open');
  setTimeout(() => document.getElementById('planCellAssig').focus(), 100);
}

function updatePlanCellType(val) {
  document.getElementById('planNormalFields').style.display  = val === 'normal' ? 'block' : 'none';
  document.getElementById('planSpecialFields').style.display = val !== 'normal' ? 'block' : 'none';
}

function _resetPlanDurada() {
  _planDuradaN = 2;
  document.getElementById('planDuradaN').textContent = _planDuradaN;
  document.querySelector('input[name="planCellDurada"][value="1"]').checked = true;
  document.getElementById('planDuradaCustom').style.display = 'none';
}

function updatePlanDurada(val) {
  document.getElementById('planDuradaCustom').style.display = val === 'custom' ? 'block' : 'none';
}

function changePlanDuradaN(delta) {
  const max = PLAN_FRANGES.length;
  // Quantes franges queden a partir de l'actual (inclosa)?
  const parts    = (_planEditKey || '').split('_');
  const franjaId = parts[parts.length - 1];
  const idx      = PLAN_FRANGES.findIndex(f => f.id === franjaId);
  const maxLeft  = idx >= 0 ? PLAN_FRANGES.length - idx : max;
  _planDuradaN   = Math.min(Math.max(2, _planDuradaN + delta), maxLeft);
  document.getElementById('planDuradaN').textContent = _planDuradaN;
}

// Retorna les claus de les franges a omplir (a partir de la cel·la actual)
function _getPlanKeysForDurada() {
  const parts    = (_planEditKey || '').split('_');
  const prefix   = parts.slice(0, -1).join('_'); // tot menys la franja
  const diaId    = parts[parts.length - 2];
  const franjaId = parts[parts.length - 1];
  const idxF     = PLAN_FRANGES.findIndex(f => f.id === franjaId);
  if (idxF < 0) return [_planEditKey];

  const durada = document.querySelector('input[name="planCellDurada"]:checked')?.value || '1';
  let n;
  if (durada === 'dia')    n = PLAN_FRANGES.length - idxF; // fins al final del dia
  else if (durada === 'custom') n = _planDuradaN;
  else n = 1;

  return PLAN_FRANGES.slice(idxF, idxF + n).map(f => {
    const base = _planEditKey.replace(/_[^_]+$/, ''); // plan_YYYY_S##_dia
    return base + '_' + f.id;
  });
}

function closePlanCell() { document.getElementById('planCellOverlay').classList.remove('open'); }

function savePlanCell() {
  const tipus = document.querySelector('input[name="planCellType"]:checked').value;
  let data;
  const coment = document.getElementById('planCellComent').value.trim();
  if (tipus === 'normal') {
    data = {
      tipus,
      assig:  document.getElementById('planCellAssig').value.trim(),
      sub:    document.getElementById('planCellSub2').value.trim(),
      alerta: document.getElementById('planCellAlerta').value.trim(),
      link:   document.getElementById('planCellLink').value.trim(),
      coment,
    };
    if (!data.assig && !data.alerta && !data.coment) { localStorage.removeItem(_planEditKey); }
    else localStorage.setItem(_planEditKey, JSON.stringify(data));
  } else {
    data = {
      tipus,
      event:    document.getElementById('planCellEvent').value.trim(),
      eventSub: document.getElementById('planCellEventSub').value.trim(),
      coment,
    };
    // Aplica a totes les franges de la durada seleccionada
    const keys = _getPlanKeysForDurada();
    keys.forEach(k => {
      if (!data.event && !data.coment) localStorage.removeItem(k);
      else localStorage.setItem(k, JSON.stringify(data));
    });
  }
  closePlanCell();
  renderPlanning();
  syncPlanningWeek();
  _rescheduleIfNeeded();
}

function clearPlanCell() {
  const data = JSON.parse(localStorage.getItem(_planEditKey) || 'null');
  if (data && data.tipus && data.tipus !== 'normal' && data.event) {
    // Esborra totes les franges del dia que tinguin el mateix event
    const base = _planEditKey.replace(/_[^_]+$/, ''); // plan_YYYY_S##_dia
    PLAN_FRANGES.forEach(f => {
      const k = base + '_' + f.id;
      const d = JSON.parse(localStorage.getItem(k) || 'null');
      if (d && d.event === data.event && d.tipus === data.tipus) localStorage.removeItem(k);
    });
  } else {
    localStorage.removeItem(_planEditKey);
  }
  closePlanCell();
  renderPlanning();
  syncPlanningWeek();
}

function deleteWeekNote(idx) {
  const key   = planWeekNotesKey();
  const lines = (localStorage.getItem(key) || '').trim().split('\n').map(n => n.trim()).filter(n => n);
  lines.splice(idx, 1);
  if (lines.length) localStorage.setItem(key, lines.join('\n'));
  else localStorage.removeItem(key);
  renderPlanning();
  syncPlanningWeek();
}

// deleteDayNote eliminat, usar deleteDayNoteItem

/* --- Notes del dia --- */
let _planNoteDaySelected = 'dl';

function planDayNoteKey(diaId) {
  return 'plan_daynote_' + getPlanWeekId(_planWeekOffset) + '_' + diaId;
}
function planDayNoteLoad(diaId) {
  const v = localStorage.getItem(planDayNoteKey(diaId));
  if (!v) return [];
  try { const p = JSON.parse(v); return Array.isArray(p) ? p : (p ? [p] : []); }
  catch(e) { return v ? [v] : []; } // compatibilitat text pla antic
}
function planDayNoteSave(diaId, arr) {
  if (!arr.length) localStorage.removeItem(planDayNoteKey(diaId));
  else localStorage.setItem(planDayNoteKey(diaId), JSON.stringify(arr));
}

function openPlanNoteDay(diaId) {
  const dow = new Date().getDay();
  const dies = ['','dl','dm','dc','dj','dv'];
  _planNoteDaySelected = diaId || ((dow >= 1 && dow <= 5) ? dies[dow] : 'dl');
  document.querySelectorAll('#planNoteDaySelector .trim-sel-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.dia === _planNoteDaySelected);
  });
  document.getElementById('planNoteDayText').value = '';
  document.getElementById('planNoteDayOverlay').classList.add('open');
  setTimeout(() => document.getElementById('planNoteDayText').focus(), 100);
}

function selectPlanNoteDay(diaId, btn) {
  _planNoteDaySelected = diaId;
  document.querySelectorAll('#planNoteDaySelector .trim-sel-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('planNoteDayText').value = '';
}

function savePlanNoteDay() {
  const text = document.getElementById('planNoteDayText').value.trim();
  if (!text) return;
  const arr = planDayNoteLoad(_planNoteDaySelected);
  arr.push(text);
  planDayNoteSave(_planNoteDaySelected, arr);
  document.getElementById('planNoteDayText').value = '';
  closePlanNoteDay();
  renderPlanning();
  syncPlanningWeek();
  _rescheduleIfNeeded();
}

function deleteDayNoteItem(diaId, idx) {
  const arr = planDayNoteLoad(diaId);
  arr.splice(idx, 1);
  planDayNoteSave(diaId, arr);
  renderPlanning();
  syncPlanningWeek();
}

function clearPlanNoteDay() {
  planDayNoteSave(_planNoteDaySelected, []);
  document.getElementById('planNoteDayText').value = '';
  closePlanNoteDay();
  renderPlanning();
  syncPlanningWeek();
}

function closePlanNoteDay() { document.getElementById('planNoteDayOverlay').classList.remove('open'); }

/* --- Notes setmana --- */
function openPlanNoteWeek() {
  document.getElementById('planNoteText').value = localStorage.getItem(planWeekNotesKey()) || '';
  document.getElementById('planNoteOverlay').classList.add('open');
  setTimeout(() => document.getElementById('planNoteText').focus(), 100);
}
function closePlanNoteWeek() { document.getElementById('planNoteOverlay').classList.remove('open'); }
function savePlanNoteWeek() {
  const txt = document.getElementById('planNoteText').value.trim();
  if (txt) localStorage.setItem(planWeekNotesKey(), txt);
  else     localStorage.removeItem(planWeekNotesKey());
  closePlanNoteWeek();
  renderPlanning();
  syncPlanningWeek();
}

async function planningPrevWeek() {
  _planWeekOffset--;
  const wKey = getPlanWeekId(_planWeekOffset);
  const hasLocal = Array.from({length: localStorage.length}, (_, i) => localStorage.key(i)).some(k => k && k.startsWith('plan_' + wKey + '_'));
  if (!hasLocal) await loadPlanningWeekFromSheets(wKey);
  renderPlanning();
}
async function planningNextWeek() {
  _planWeekOffset++;
  const wKey = getPlanWeekId(_planWeekOffset);
  const hasLocal = Array.from({length: localStorage.length}, (_, i) => localStorage.key(i)).some(k => k && k.startsWith('plan_' + wKey + '_'));
  if (!hasLocal) await loadPlanningWeekFromSheets(wKey);
  renderPlanning();
}
function planningThisWeek()  { _planWeekOffset = 0; renderPlanning(); }


/* ============================================================
   CALENDARI MENSUAL
   Categories configurables per l'usuari (localStorage: cal2_cats)
   Events (localStorage: cal2_events_{YYYY})
   Per agendar (localStorage: cal2_agendar)
   ============================================================ */

let _cal2Year      = new Date().getFullYear();
let _cal2Month     = new Date().getMonth();
let _cal2EditEventId = null;
let _cal2GCalEvents  = [];   // events carregats de Google Calendar
let _cal2GCalLoading = false;

const MESOS_CA = ['Gener','Febrer','Març','Abril','Maig','Juny',
  'Juliol','Agost','Setembre','Octubre','Novembre','Desembre'];

/* Categories per defecte */
const CAL2_CATS_DEFAULT = [
  { id:'2nA',     nom:'2nA',     color:'#22C55E' },
  { id:'2nB',     nom:'2nB',     color:'#3B82F6' },
  { id:'2nC',     nom:'2nC',     color:'#F97316' },
  { id:'conjunt', nom:'Conjunt', color:'#8B5CF6' },
];

function cal2LoadCats() {
  const s = localStorage.getItem('cal2_cats');
  return s ? JSON.parse(s) : JSON.parse(JSON.stringify(CAL2_CATS_DEFAULT));
}
function cal2SaveCats(cats)         { localStorage.setItem('cal2_cats', JSON.stringify(cats)); _calSaveCatsToSheets(); }
function cal2CatById(id) { return cal2LoadCats().find(c => c.id === id) || { color:'#888', nom:id }; }

/* Events */
function cal2LoadEvents(year) { return JSON.parse(localStorage.getItem('cal2_events_' + year) || '[]'); }
function cal2SaveEvents(year, evs)  { localStorage.setItem('cal2_events_' + year, JSON.stringify(evs)); _calSaveToSheets(year); }

/* Agendar */
function cal2LoadAgendar() { return JSON.parse(localStorage.getItem('cal2_agendar') || '[]'); }
function cal2SaveAgendar(a) { localStorage.setItem('cal2_agendar', JSON.stringify(a)); }

/* --- Render --- */
function renderCalendari() {
  const year = _cal2Year, month = _cal2Month;
  document.getElementById('cal2MonthTitle').textContent = MESOS_CA[month] + ' ' + year;
  document.getElementById('cal2RightTitle').textContent = 'Events de ' + MESOS_CA[month];

  // Events locals
  const localEvents = cal2LoadEvents(year)
    .filter(e => { const d=new Date(e.data); return d.getFullYear()===year && d.getMonth()===month; })
    .sort((a,b) => a.data.localeCompare(b.data));

  // GCal del mateix any/mes en memòria (si ja estaven carregats)
  const gcalFiltered = _cal2GCalEvents.filter(e => {
    const d = new Date(e.data);
    return d.getFullYear()===year && d.getMonth()===month;
  });
  const allEvents = _mergeEvents(localEvents, gcalFiltered);

  _renderCal2Legend();
  _renderCal2Grid(year, month, allEvents);
  _renderCal2EventList(allEvents);
  _renderCal2Agendar();
  _loadGCalEvents(year, month);
}

function _renderCal2Legend() {
  const cats = cal2LoadCats();
  document.getElementById('cal2Legend').innerHTML = cats.map(c =>
    `<span class="cal2-legend-dot" style="background:${c.color}"></span>${escapeHtml(c.nom)}`
  ).join('');
}

async function _loadGCalEvents(year, month) {
  if (!config.scriptUrl || _cal2GCalLoading) return;
  _cal2GCalLoading = true;
  try {
    const r = await appsScriptGet({ action: 'getGCalEvents', year, month: month + 1 });
    if (r.ok && r.events) {
      _cal2GCalEvents = r.events;
      // Re-renderitza la graella i la llista amb els nous events
      const localEvents = cal2LoadEvents(year)
        .filter(e => { const d=new Date(e.data); return d.getFullYear()===year && d.getMonth()===month; })
        .sort((a,b) => a.data.localeCompare(b.data));
      const allEvents = _mergeEvents(localEvents, _cal2GCalEvents);
      _renderCal2Grid(year, month, allEvents);
      _renderCal2EventList(allEvents);
      _updateGCalIndicator(r.events.length);
    }
  } catch(e) {
    // Silent fail — no és crític
  }
  _cal2GCalLoading = false;
}

function _mergeEvents(local, gcal) {
  // Combina locals + GCal, ordenats per data
  return [...local, ...gcal].sort((a,b) => (a.data + (a.hora||'')).localeCompare(b.data + (b.hora||'')));
}

function _updateGCalIndicator(count) { /* silenced */ }

function _renderCal2Grid(year, month, events) {
  const grid    = document.getElementById('cal2Grid');
  const today   = new Date();
  const first   = new Date(year, month, 1);
  const daysInM = new Date(year, month+1, 0).getDate();
  const startCol = (first.getDay() + 6) % 7;

  const byDay = {};
  events.forEach(e => { const d=parseInt(e.data.split('-')[2]); if(!byDay[d])byDay[d]=[]; byDay[d].push(e); });

  let html = '';
  for (let i=0; i<startCol; i++) html += '<div class="cal2-cell cal2-cell-empty"></div>';

  for (let day=1; day<=daysInM; day++) {
    const isToday   = today.getFullYear()===year && today.getMonth()===month && today.getDate()===day;
    const isWeekend = ((startCol+day-1)%7) >= 5;
    const evs       = byDay[day] || [];
    html += `<div class="cal2-cell${isToday?' cal2-cell-today':''}${isWeekend?' cal2-cell-weekend':''}" onclick="openCal2EventForDay(${year},${month+1},${day})">
      <div class="cal2-cell-num">${day}</div>`;
    evs.slice(0,3).forEach(e => {
      const cat      = e.fromGCal ? { color: e.calColor||'#4285F4' } : cal2CatById(e.catId);
      const dotClick = e.fromGCal ? '' : `onclick="event.stopPropagation();openCal2EventEdit('${e.id}')"`;
      html += `<div class="cal2-event-dot${e.fromGCal?' cal2-dot-gcal':''}" style="background:${cat.color}" title="${escapeHtml(e.titol)}" ${dotClick}>${escapeHtml(e.titol)}</div>`;
    });
    if (evs.length > 3) html += `<div class="cal2-event-more">+${evs.length-3} més</div>`;
    html += '</div>';
  }
  const total = startCol + daysInM;
  for (let i=total%7; i!==0 && i<7; i++) html += '<div class="cal2-cell cal2-cell-empty"></div>';
  grid.innerHTML = html;
}

function _renderCal2EventList(events) {
  const list = document.getElementById('cal2EventList');
  if (!events.length) { list.innerHTML='<p class="fitxa-empty-field" style="padding:12px">Cap event aquest mes.</p>'; return; }
  list.innerHTML = events.map(e => {
    const cat = cal2CatById(e.catId);
    const dat = new Date(e.data);
    const diaStr = dat.toLocaleDateString('ca-ES', { day:'numeric', month:'long' });
    const isGCal   = !!e.fromGCal;
    const barColor = isGCal ? (e.calColor || '#4285F4') : cat.color;
    const titColor = isGCal ? (e.calColor || '#4285F4') : cat.color;
    const catLabel = isGCal ? (e.calNom || 'Google Calendar') : cat.nom;
    const onClick  = isGCal ? '' : `onclick="openCal2EventEdit('${e.id}')"`;
    return `<div class="cal2-ev-item${isGCal?' cal2-ev-gcal':''}" ${onClick} style="${isGCal?'':'cursor:pointer'}">
      <div class="cal2-ev-item-bar" style="background:${barColor}"></div>
      <div class="cal2-ev-item-body">
        <div class="cal2-ev-item-titol" style="color:${titColor}">${escapeHtml(e.titol)}${isGCal?'<svg class="cal2-gcal-icon" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><path fill="#4285F4" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#34A853" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#EA4335" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>':''}</div>
        <div class="cal2-ev-item-meta">${diaStr}${e.hora?' · '+escapeHtml(e.hora):''} · <strong>${escapeHtml(catLabel)}</strong></div>
        ${e.desc?`<div class="cal2-ev-item-desc">${escapeHtml(e.desc)}</div>`:''}
        ${e.link?`<a class="cal2-ev-item-link" href="${e.link}" target="_blank" onclick="event.stopPropagation()">🔗 Enllaç</a>`:''}
      </div>
    </div>`;
  }).join('');
}

function _renderCal2Agendar() {
  const items = cal2LoadAgendar();
  const list  = document.getElementById('cal2AgendarList');
  if (!items.length) { list.innerHTML=''; return; }
  list.innerHTML = items.map((item,i) =>
    `<div class="cal2-agendar-item">
      <span class="cal2-agendar-bullet">•</span>
      <div class="cal2-agendar-body">
        <strong>${escapeHtml(item.titol)}</strong>
        ${item.desc?` · <span style="font-style:italic;color:var(--text-muted)">${escapeHtml(item.desc)}</span>`:''}
      </div>
      <button class="cal2-agendar-del" onclick="deleteCal2Agendar(${i})" title="Eliminar">×</button>
    </div>`
  ).join('');
}

/* Navegació */
function cal2PrevMonth() { _cal2Month--; if(_cal2Month<0){_cal2Month=11;_cal2Year--;} _cal2GCalEvents=[]; renderCalendari(); }
function cal2NextMonth() { _cal2Month++; if(_cal2Month>11){_cal2Month=0;_cal2Year++;} _cal2GCalEvents=[]; renderCalendari(); }
function cal2Today()     { _cal2Year=new Date().getFullYear(); _cal2Month=new Date().getMonth(); _cal2GCalEvents=[]; renderCalendari(); }

/* --- Modal event --- */
function _fillCal2Select() {
  const sel = document.getElementById('cal2EvGrup');
  const cur = sel.value;
  sel.innerHTML = cal2LoadCats().map(c =>
    `<option value="${c.id}"${c.id===cur?' selected':''}>${escapeHtml(c.nom)}</option>`
  ).join('');
}

function openCal2EventForDay(year, month, day) {
  const dateStr = year+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0');
  openCal2Event(null, dateStr);
}
function openCal2EventEdit(id) { openCal2Event(id); }

function openCal2Event(id, prefillDate) {
  _cal2EditEventId = id || null;
  document.getElementById('cal2EventModalTitle').textContent = id ? 'Editar event' : 'Nou event';
  document.getElementById('cal2EvDelBtn').style.display = id ? 'inline-flex' : 'none';
  _fillCal2Select();
  if (id) {
    const ev = [_cal2Year-1,_cal2Year,_cal2Year+1].flatMap(y=>cal2LoadEvents(y)).find(e=>e.id===id);
    if (ev) {
      document.getElementById('cal2EvTitol').value = ev.titol||'';
      document.getElementById('cal2EvData').value  = ev.data||'';
      document.getElementById('cal2EvHora').value  = ev.hora||'';
      document.getElementById('cal2EvGrup').value  = ev.catId||'';
      document.getElementById('cal2EvDesc').value  = ev.desc||'';
      document.getElementById('cal2EvLink').value  = ev.link||'';
    }
  } else {
    document.getElementById('cal2EvTitol').value = '';
    document.getElementById('cal2EvData').value  = prefillDate||(_cal2Year+'-'+String(_cal2Month+1).padStart(2,'0')+'-01');
    document.getElementById('cal2EvHora').value  = '';
    document.getElementById('cal2EvDesc').value  = '';
    document.getElementById('cal2EvLink').value  = '';
  }
  document.getElementById('cal2EventOverlay').classList.add('open');
  setTimeout(()=>document.getElementById('cal2EvTitol').focus(),100);
}

function closeCal2Event() { document.getElementById('cal2EventOverlay').classList.remove('open'); }

function saveCal2Event() {
  const titol = document.getElementById('cal2EvTitol').value.trim(); if(!titol) return;
  const data  = document.getElementById('cal2EvData').value; if(!data){showToast('Cal posar una data','error');return;}
  const year  = parseInt(data.split('-')[0]);
  const evs   = cal2LoadEvents(year);
  const obj   = { titol, data, hora:document.getElementById('cal2EvHora').value.trim(), catId:document.getElementById('cal2EvGrup').value, desc:document.getElementById('cal2EvDesc').value.trim(), link:document.getElementById('cal2EvLink').value.trim() };
  if (_cal2EditEventId) {
    const idx = evs.findIndex(e=>e.id===_cal2EditEventId);
    if (idx!==-1) evs[idx]={...evs[idx],...obj};
    else evs.push({id:_cal2EditEventId,...obj});
  } else { evs.push({id:Date.now().toString(),...obj}); }
  cal2SaveEvents(year,evs); closeCal2Event(); renderCalendari();
  renderPlanning(); // refresca el planning perquè l'event hi aparegui de seguida
}

function deleteCal2Event() {
  if(!_cal2EditEventId||!confirm('Eliminar aquest event?'))return;
  [_cal2Year-1,_cal2Year,_cal2Year+1].forEach(y=>{ cal2SaveEvents(y,cal2LoadEvents(y).filter(e=>e.id!==_cal2EditEventId)); });
  closeCal2Event(); renderCalendari();
  renderPlanning(); // refresca el planning perquè l'event hi desaparegui
}

/* --- Modal agendar --- */
function openCal2Agendar()  { document.getElementById('cal2AgTitol').value=''; document.getElementById('cal2AgDesc').value=''; document.getElementById('cal2AgendarOverlay').classList.add('open'); setTimeout(()=>document.getElementById('cal2AgTitol').focus(),100); }
function closeCal2Agendar() { document.getElementById('cal2AgendarOverlay').classList.remove('open'); }
function saveCal2Agendar()  {
  const titol=document.getElementById('cal2AgTitol').value.trim(); if(!titol)return;
  const items=cal2LoadAgendar(); items.push({id:Date.now().toString(),titol,desc:document.getElementById('cal2AgDesc').value.trim()});
  cal2SaveAgendar(items); closeCal2Agendar(); _renderCal2Agendar();
}
function deleteCal2Agendar(i) { const a=cal2LoadAgendar(); a.splice(i,1); cal2SaveAgendar(a); _renderCal2Agendar(); }

/* --- Modal categories --- */
function openCal2Categories() {
  _renderCal2CatList();
  document.getElementById('cal2CatNom').value='';
  document.getElementById('cal2CatColor').value='#8B5CF6';
  document.getElementById('cal2CatOverlay').classList.add('open');
}
function closeCal2Categories() {
  document.getElementById('cal2CatOverlay').classList.remove('open');
  renderCalendari();
}
function _renderCal2CatList() {
  const cats = cal2LoadCats();
  document.getElementById('cal2CatList').innerHTML = cats.map((c,i) =>
    `<div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--border)">
      <span style="width:18px;height:18px;border-radius:50%;background:${c.color};display:inline-block;flex-shrink:0"></span>
      <span style="flex:1;font-size:14px;font-weight:500">${escapeHtml(c.nom)}</span>
      ${cats.length>1?`<button class="cal2-agendar-del" onclick="deleteCal2Cat(${i})" title="Eliminar">×</button>`:''}
    </div>`
  ).join('');
}
function addCal2Category() {
  const nom = document.getElementById('cal2CatNom').value.trim(); if(!nom)return;
  const color = document.getElementById('cal2CatColor').value;
  const cats = cal2LoadCats();
  cats.push({ id: Date.now().toString(), nom, color });
  cal2SaveCats(cats); _renderCal2CatList();
  document.getElementById('cal2CatNom').value='';
}
function deleteCal2Cat(i) {
  const cats = cal2LoadCats();
  if (cats.length <= 1) return;
  cats.splice(i,1); cal2SaveCats(cats); _renderCal2CatList();
}

/* ============================================================
   TASQUES
   localStorage: tasques → [ { id, titol, desc, cat, data, feta, ts } ]
   Google Tasks: via Apps Script (getGoogleTasks)
   ============================================================ */

const TQ_CATS = {
  tutoria:     { nom: 'Tutoria',      color: '#8B5CF6', bg: '#EDE9FE' },
  comunicacio: { nom: 'Comunicació',  color: '#3B82F6', bg: '#DBEAFE' },
  altres:      { nom: 'Altres',       color: '#6B7280', bg: '#F3F4F6' },
};

let _tqFilter     = 'all';
let _tqEditId     = null;

function tqLoad()        { return JSON.parse(localStorage.getItem('tasques') || '[]'); }
function tqSave(items)              { localStorage.setItem('tasques', JSON.stringify(items)); _tqSaveToSheets(); _rescheduleIfNeeded(); }

/* --- Render --- */
function renderTasques() {
  _renderTqList();
  loadGoogleTasks();
  updateTasquesBadge();
}

function _renderTqList() {
  const all  = [...tqLoad(), ...(_gtaskVirtuals||[])];
  let items;
  if (_tqFilter === 'fetes')   items = all.filter(t => t.feta && !t.fromGoogle);
  else if (_tqFilter === 'all') items = all.filter(t => !t.feta);
  else items = all.filter(t => !t.feta && t.cat === _tqFilter);

  // Ordena: primer les que tenen data límit (les més properes primer), després les sense
  items.sort((a,b) => {
    if (a.data && b.data) return a.data.localeCompare(b.data);
    if (a.data) return -1;
    if (b.data) return 1;
    return b.ts - a.ts;
  });

  const list  = document.getElementById('tasquesList');
  const fetes = all.filter(t => t.feta && !t.fromGoogle).length;
  const pend  = all.filter(t => !t.feta).length;

  // Comptadors als botons de filtre
  document.querySelectorAll('.tq-filter').forEach(btn => {
    const cat = btn.dataset.cat;
    let count;
    if (cat === 'all')   count = pend;
    else if (cat === 'fetes') count = fetes;
    else count = all.filter(t => !t.feta && t.cat === cat).length;
    btn.dataset.count = count;
    const badge = count > 0 ? ` <span class="tq-badge">${count}</span>` : '';
    btn.innerHTML = (cat==='fetes'?'✓ Fetes':btn.textContent.replace(/\s*\d+$/,'').trim()) + badge;
  });

  // Botó netejar llista (només a "fetes" i si n'hi ha)
  const netejaBtnEl = document.getElementById('tqNeteja');
  if (netejaBtnEl) netejaBtnEl.style.display = (_tqFilter === 'fetes' && fetes > 0) ? 'inline-flex' : 'none';

  if (!items.length) {
    list.innerHTML = `<div class="tasques-empty">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" width="40" height="40"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
      <p>${_tqFilter === 'fetes' ? 'Cap tasca completada.' : 'Cap tasca pendent. Bon treball!'}</p>
    </div>`;
    return;
  }

  list.innerHTML = items.map(t => {
    const cat     = TQ_CATS[t.cat] || TQ_CATS.altres;
    const today   = new Date().toISOString().split('T')[0];
    const vencuda = t.data && t.data < today && !t.feta;
    const avui    = t.data === today && !t.feta;
    const dataStr = t.data ? new Date(t.data).toLocaleDateString('ca-ES',{day:'numeric',month:'long'}) : '';
    const isGoogle  = !!t.fromGoogle;
    const itemClick = isGoogle ? '' : `onclick="openTasca('${t.id}')"`;
    const checkClick = isGoogle ? '' : `toggleTasca('${t.id}')`;
    return `<div class="tq-item${t.feta?' tq-item-feta':''}${vencuda?' tq-item-vencuda':''}${isGoogle?' tq-item-google':''}" ${itemClick}>
      <button class="tq-check${t.feta?' tq-check-done':''}" onclick="event.stopPropagation();${checkClick}" title="${t.feta?'Desfer':'Marcar com a feta'}">
        ${isGoogle?`<svg class="gtq-gicon-sm" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><path fill="#4285F4" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#34A853" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#EA4335" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>`:(t.feta?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>':'')}
      </button>
      <div class="tq-item-body">
        <div class="tq-item-titol">${escapeHtml(t.titol)}</div>
        ${t.desc?`<div class="tq-item-desc">${escapeHtml(t.desc)}</div>`:''}
        <div class="tq-item-meta">
          <span class="tq-cat-pill" style="background:${cat.bg};color:${cat.color}">${cat.nom}</span>
          ${t.data?`<span class="tq-data${vencuda?' tq-data-vencuda':''}${avui?' tq-data-avui':''}">${vencuda?'⚠ ':''}${avui?'⏰ ':''}${dataStr}</span>`:''}
        </div>
      </div>
    </div>`;
  }).join('');
}

function netejarTasquesFetes() {
  if (!confirm('Eliminar totes les tasques completades?')) return;
  tqSave(tqLoad().filter(t => !t.feta));
  _renderTqList();
}

function filterTasques(cat, btn) {
  _tqFilter = cat;
  document.querySelectorAll('.tq-filter').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  _renderTqList();
}

function toggleTasca(id) {
  const items = tqLoad();
  const t     = items.find(i => i.id === id);
  if (!t) return;
  t.feta = !t.feta;
  t.fetaTs = t.feta ? Date.now() : null;
  tqSave(items);
  _renderTqList();
}

/* --- Modal --- */
function openTasca(id) {
  _tqEditId = id;
  document.getElementById('tascaModalTitle').textContent = id ? 'Editar tasca' : 'Nova tasca';
  document.getElementById('tascaDelBtn').style.display   = id ? 'inline-flex' : 'none';
  if (id) {
    const t = tqLoad().find(i => i.id === id);
    if (t) {
      document.getElementById('tascaTitol').value = t.titol || '';
      document.getElementById('tascaDesc').value  = t.desc  || '';
      document.getElementById('tascaData').value  = t.data  || '';
      document.querySelectorAll('input[name="tascaCat"]').forEach(r => r.checked = r.value === t.cat);
    }
  } else {
    document.getElementById('tascaTitol').value = '';
    document.getElementById('tascaDesc').value  = '';
    document.getElementById('tascaData').value  = '';
    document.querySelector('input[name="tascaCat"][value="tutoria"]').checked = true;
  }
  document.getElementById('tascaOverlay').classList.add('open');
  setTimeout(() => document.getElementById('tascaTitol').focus(), 100);
}

function closeTasca() { document.getElementById('tascaOverlay').classList.remove('open'); }

function saveTasca() {
  const titol = document.getElementById('tascaTitol').value.trim();
  if (!titol) { document.getElementById('tascaTitol').focus(); return; }
  const cat   = document.querySelector('input[name="tascaCat"]:checked').value;
  const items = tqLoad();
  if (_tqEditId) {
    const t = items.find(i => i.id === _tqEditId);
    if (t) { t.titol=titol; t.desc=document.getElementById('tascaDesc').value.trim(); t.cat=cat; t.data=document.getElementById('tascaData').value; }
  } else {
    items.unshift({ id: Date.now().toString(), titol, desc: document.getElementById('tascaDesc').value.trim(), cat, data: document.getElementById('tascaData').value, feta: false, ts: Date.now() });
  }
  tqSave(items); closeTasca(); _renderTqList();
}

function deleteTasca() {
  if (!_tqEditId || !confirm('Eliminar aquesta tasca?')) return;
  tqSave(tqLoad().filter(i => i.id !== _tqEditId));
  closeTasca(); _renderTqList();
}

/* --- Google Tasks --- */
// Càrrega silenciosa (arrencada): actualitza _gtaskVirtuals i la bombolla sense tocar la UI
async function loadGoogleTasksSilent() {
  if (!config.scriptUrl) return;
  try {
    const r = await appsScriptGet({ action: 'getGoogleTasks' });
    if (r.ok && r.tasks) {
      _integrateGTasksInList(r.tasks);
      updateTasquesBadge();
    }
  } catch(e) { /* silenci, no és crític */ }
}

async function loadGoogleTasks() {
  if (!config.scriptUrl) return;
  const btn = document.getElementById('gtasquesRefreshBtn');
  if (btn) btn.textContent = '↺ Carregant…';
  try {
    const r = await appsScriptGet({ action: 'getGoogleTasks' });
    if (r.ok && r.tasks) _renderGoogleTasks(r.tasks);
    else document.getElementById('gtasquesList').innerHTML =
      '<p class="fitxa-empty-field" style="padding:12px;font-size:12px">No s\'han pogut carregar les tasques de Google Tasks.<br><small>' + (r.error||'') + '</small></p>';
  } catch(e) {
    document.getElementById('gtasquesList').innerHTML =
      '<p class="fitxa-empty-field" style="padding:12px;font-size:12px">Error de connexió amb Google Tasks.</p>';
  }
  if (btn) btn.textContent = '↺ Sincronitzar';
}

// Mapatge nom de llista → categoria de l'app
const GTASK_CAT_MAP = {
  'tutoria':     'tutoria',
  'comunicació': 'comunicacio',
  'comunicacio': 'comunicacio',
  'altres':      'altres',
};
function gtaskCat(llistaNom) {
  return GTASK_CAT_MAP[(llistaNom||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase()] || 'altres';
}

// Icona Google Tasks (G de colors)
const GCAL_ICON_SVG = `<svg class="gtq-gicon" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
  <path fill="#4285F4" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
  <path fill="#34A853" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
  <path fill="#EA4335" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
</svg>`;

function _renderGoogleTasks(tasks) {
  const list = document.getElementById('gtasquesList');
  if (!tasks.length) { list.innerHTML = '<p class="fitxa-empty-field" style="padding:12px;font-size:12px">Cap tasca pendent a Google Tasks.</p>'; return; }

  // Agrupa per categoria mapada
  const byCat = { tutoria: [], comunicacio: [], altres: [] };
  tasks.forEach(t => { const c = gtaskCat(t.llista); (byCat[c] = byCat[c]||[]).push(t); });

  // Integra a la llista principal (afegeix com a tasques virtuals)
  _integrateGTasksInList(tasks);
  updateTasquesBadge(); // actualitza la bombolla amb les Google Tasks incloses

  // Panel lateral ocult — les tasques ja es mostren a la llista principal
}

// Integra les tasques de Google a la llista principal com a items virtuals
let _gtaskVirtuals = [];
function _integrateGTasksInList(tasks) {
  _gtaskVirtuals = tasks.map(t => ({
    id: 'gtask_' + t.id,
    titol: t.titol,
    desc: t.notes || '',
    cat: gtaskCat(t.llista),
    data: t.data || '',
    feta: false,
    fromGoogle: true,
    ts: 0,
  }));
  _renderTqList();
}

/* ============================================================
   GENERADOR DE GRUPS
   ============================================================ */

let _grupsNum        = 3;   // alumnes per grup
let _grupsCondicions = [];  // [ [nomA, nomB] ]  → no poden anar junts

const GRUPS_COLORS = [
  { bg:'#DBEAFE', border:'#93C5FD', text:'#1E40AF' },
  { bg:'#D1FAE5', border:'#6EE7B7', text:'#065F46' },
  { bg:'#FEF3C7', border:'#FCD34D', text:'#92400E' },
  { bg:'#FCE7F3', border:'#F9A8D4', text:'#9D174D' },
  { bg:'#EDE9FE', border:'#C4B5FD', text:'#5B21B6' },
  { bg:'#FEE2E2', border:'#FCA5A5', text:'#991B1B' },
  { bg:'#F0FDF4', border:'#86EFAC', text:'#14532D' },
  { bg:'#FFF7ED', border:'#FED7AA', text:'#9A3412' },
];

function initGrups() {
  _grupsNum = 3;
  _grupsCondicions = [];
  document.getElementById('grupsNumVal').textContent = _grupsNum;
  _renderGrupsCondicions();
  _updateGrupsHint();
  document.getElementById('grupsResultat').innerHTML = `<div class="tasques-empty">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" width="40" height="40"><circle cx="9" cy="7" r="3"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><circle cx="17" cy="7" r="3"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/></svg>
    <p>Configura els paràmetres i clica <strong>Generar grups</strong></p>
  </div>`;
}

function grupsChangeNum(delta) {
  const total = students.length || 20;
  _grupsNum = Math.max(2, Math.min(total, _grupsNum + delta));
  document.getElementById('grupsNumVal').textContent = _grupsNum;
  _updateGrupsHint();
}

function _updateGrupsHint() {
  const total = students.length;
  if (!total) { document.getElementById('grupsHint').textContent = 'Carrega els alumnes primer'; return; }
  const nGrups  = Math.ceil(total / _grupsNum);
  const sobren  = total % _grupsNum;
  let hint = `${total} alumnes → ${nGrups} grup${nGrups!==1?'s':''}`;
  if (sobren > 0) hint += ` (${nGrups-1} de ${_grupsNum} i 1 de ${sobren})`;
  else hint += ` de ${_grupsNum}`;
  document.getElementById('grupsHint').textContent = hint;
}

function afegirCondicio() {
  if (!students.length) { showToast('Carrega els alumnes primer', 'error'); return; }
  _grupsCondicions.push([null, null]);
  _renderGrupsCondicions();
}

function _renderGrupsCondicions() {
  const wrap = document.getElementById('grupsCondicions');
  if (!_grupsCondicions.length) { wrap.innerHTML = ''; return; }

  const opts = students.map((s,i) => `<option value="${i}">${escapeHtml(s.nom)}</option>`).join('');

  wrap.innerHTML = _grupsCondicions.map((cond, ci) => `
    <div class="grups-cond-row">
      <select class="modal-input grups-cond-sel" onchange="updateCondicio(${ci},0,this.value)">
        <option value="">— Alumne A —</option>${opts}
      </select>
      <span class="grups-cond-sep">≠</span>
      <select class="modal-input grups-cond-sel" onchange="updateCondicio(${ci},1,this.value)">
        <option value="">— Alumne B —</option>${opts}
      </select>
      <button class="cal2-agendar-del" onclick="eliminarCondicio(${ci})">×</button>
    </div>`
  ).join('');

  // Restaura valors seleccionats
  _grupsCondicions.forEach((cond, ci) => {
    const sels = wrap.querySelectorAll('.grups-cond-row')[ci]?.querySelectorAll('select');
    if (sels) {
      if (cond[0] !== null) sels[0].value = cond[0];
      if (cond[1] !== null) sels[1].value = cond[1];
    }
  });
}

function updateCondicio(ci, pos, val) {
  _grupsCondicions[ci][pos] = val === '' ? null : parseInt(val);
}

function eliminarCondicio(ci) {
  _grupsCondicions.splice(ci, 1);
  _renderGrupsCondicions();
}

/* --- Algoritme de generació --- */
function generarGrups() {
  if (!students.length) { showToast('No hi ha alumnes carregats', 'error'); return; }

  const MAX_INTENTS = 500;
  let grups = null;

  for (let intent = 0; intent < MAX_INTENTS; intent++) {
    const barrejats = _barrejar([...students.map((s,i) => i)]);
    const candidat  = _formarGrups(barrejats, _grupsNum);
    if (_compleixCondicions(candidat)) { grups = candidat; break; }
  }

  if (!grups) {
    // Si no es pot complir, avisa però mostra igualment el millor intent
    grups = _formarGrups(_barrejar([...students.map((s,i) => i)]), _grupsNum);
    showToast('No s\'han pogut complir totes les condicions', 'error');
  }

  _mostrarGrups(grups);
}

function _barrejar(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function _formarGrups(indexos, mida) {
  const grups = [];
  for (let i = 0; i < indexos.length; i += mida) {
    grups.push(indexos.slice(i, i + mida));
  }
  return grups;
}

function _compleixCondicions(grups) {
  for (const cond of _grupsCondicions) {
    const [a, b] = cond;
    if (a === null || b === null) continue;
    for (const grup of grups) {
      if (grup.includes(a) && grup.includes(b)) return false;
    }
  }
  return true;
}

function _mostrarGrups(grups) {
  const wrap  = document.getElementById('grupsResultat');
  const total = students.length;
  const nG    = grups.length;

  let html = `<div class="grups-result-header">
    <span>${nG} grup${nG!==1?'s':''} · ${total} alumne${total!==1?'s':''}</span>
    <button class="btn btn-ghost btn-sm" onclick="generarGrups()">↺ Regenerar</button>
  </div><div class="grups-cards">`;

  grups.forEach((grup, gi) => {
    const col = GRUPS_COLORS[gi % GRUPS_COLORS.length];
    html += `<div class="grups-card" style="background:${col.bg};border-color:${col.border}">
      <div class="grups-card-num" style="color:${col.text}">Grup ${gi + 1}</div>
      <ul class="grups-card-list">
        ${grup.map(si => `<li style="color:${col.text}">${escapeHtml(students[si]?.nom || '')}</li>`).join('')}
      </ul>
      <div class="grups-card-count" style="color:${col.text}">${grup.length} alumne${grup.length!==1?'s':''}</div>
    </div>`;
  });

  html += '</div>';
  wrap.innerHTML = html;
}

/* ============================================================
   PÀGINA D'INICI — renderHome
   Llegeix: planning (localStorage), calendari (localStorage),
            tasques (localStorage), horari (hardcoded fins config)
   ============================================================ */

// Colors per assignatura (han de coincidir amb el planning)
const HOME_ASSIG_COLORS = {
  'català':        { bg:'#EDE9FE', color:'#5B21B6' },
  'matemàtiques':  { bg:'#DBEAFE', color:'#1E40AF' },
  'medi':          { bg:'#D1FAE5', color:'#065F46' },
  'medi natural':  { bg:'#D1FAE5', color:'#065F46' },
  'música':        { bg:'#FEF3C7', color:'#92400E' },
  "anglès":        { bg:'#FCE7F3', color:'#9D174D' },
  'anglès 2n':     { bg:'#FCE7F3', color:'#9D174D' },
  'anglès 1r':     { bg:'#FCE7F3', color:'#9D174D' },
  'tutoria':       { bg:'#FEE2E2', color:'#991B1B' },
  'permanència':   { bg:'#F3F4F6', color:'#6B7280' },
  'pati':          { bg:'#F3F4F6', color:'#9CA3AF' },
  'pacbal':        { bg:'#FFF7ED', color:'#9A3412' },
  'tallers':       { bg:'#E0F2FE', color:'#0369A1' },
  'festa':         { bg:'#E5E7EB', color:'#374151' },
};

function _assigColor(nom) {
  const key = (nom||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  for (const k of Object.keys(HOME_ASSIG_COLORS)) {
    const kn = k.normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    if (key.includes(kn)) return HOME_ASSIG_COLORS[k];
  }
  return { bg:'#F3F4F6', color:'#6B7280' };
}

function updateTasquesBadge() {
  const badge = document.getElementById('homeTasquesBadge');
  if (!badge) return;
  // Inclou tant les tasques pròpies com les de Google Tasks
  const propies  = (tqLoad ? tqLoad() : JSON.parse(localStorage.getItem('tasques') || '[]')).filter(t => !t.feta).length;
  const google   = (typeof _gtaskVirtuals !== 'undefined' ? _gtaskVirtuals : []).filter(t => !t.feta).length;
  const pendents = propies + google;
  if (pendents > 0) {
    badge.textContent = pendents > 99 ? '99+' : pendents;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

function renderHome() {
  _renderHomeAvui();
  _renderHomeRecordatoris();
  _renderHomeSetmana();
  updateTasquesBadge();
}

/* --- AVUI: horari del dia del planning --- */
function _renderHomeAvui() {
  const avui = new Date();
  const dies = ['Diumenge','Dilluns','Dimarts','Dimecres','Dijous','Divendres','Dissabte'];
  const mesos = ['gener','febrer','març','abril','maig','juny','juliol','agost','setembre','octubre','novembre','desembre'];
  const label = dies[avui.getDay()] + ', ' + avui.getDate() + ' de ' + mesos[avui.getMonth()];
  document.getElementById('homeAvuiLabel').textContent = 'Avui — ' + label;

  const diaId = ['dl','dm','dc','dj','dv','',''][avui.getDay() === 0 ? 6 : avui.getDay() - 1] || null;
  const wKey  = getPlanWeekId(0);
  const franges = PLAN_FRANGES;
  const el = document.getElementById('homeHorari');

  if (!diaId) {
    el.innerHTML = '<p class="home-empty-hint">Cap dia lectiu avui.</p>';
    return;
  }

  let html = '';
  let teContingut = false;
  franges.forEach(f => {
    const key  = 'plan_' + wKey + '_' + diaId + '_' + f.id;
    const data = JSON.parse(localStorage.getItem(key) || 'null');
    if (!data) return;

    if (data.tipus === 'festa') {
      html += `<div class="home-franja home-franja-festa">
        <span class="home-franja-hora">${f.hora}</span>
        <span class="home-franja-pill" style="background:#E5E7EB;color:#374151">${escapeHtml(data.event||'FESTA')}</span>
      </div>`;
      teContingut = true; return;
    }
    if (data.tipus === 'especial' || data.tipus === 'sortida') {
      const bg = data.tipus==='especial' ? '#FEF9C3' : '#DCFCE7';
      const fc = data.tipus==='especial' ? '#92400E'  : '#065F46';
      html += `<div class="home-franja">
        <span class="home-franja-hora">${f.hora}</span>
        <span class="home-franja-pill" style="background:${bg};color:${fc}">⚠ ${escapeHtml(data.event||'')}</span>
        ${data.link?`<a class="home-franja-link" href="${data.link}" target="_blank">📄</a>`:''}
      </div>`;
      teContingut = true; return;
    }
    if (data.assig || data.alerta) {
      const col = _assigColor(data.assig);
      html += `<div class="home-franja">
        <span class="home-franja-hora">${f.hora}</span>
        <div class="home-franja-body">
          ${data.alerta?`<span class="home-franja-alerta">⚠ ${escapeHtml(data.alerta)}</span>`:''}
          <span class="home-franja-pill" style="background:${col.bg};color:${col.color}">${escapeHtml(data.assig||'')}</span>
          ${data.sub?`<span class="home-franja-sub">${escapeHtml(data.sub)}</span>`:''}
        </div>
        ${data.link?`<a class="home-franja-link" href="${data.link}" target="_blank">📄</a>`:''}
      </div>`;
      teContingut = true;
    }
  });

  el.innerHTML = teContingut ? html : '<p class="home-empty-hint">No hi ha res al planning d\'avui. <a onclick="showPage(\'planning\')" style="cursor:pointer;color:var(--crimson)">Obrir planning →</a></p>';
}

/* --- RECORDATORIS: tasques d'avui + del calendari + notes del planning --- */
function _renderHomeRecordatoris() {
  const avui   = new Date();
  const avuiStr = avui.toISOString().split('T')[0];
  const el     = document.getElementById('homeRecordatoris');
  let html = '';

  // 1. Tasques pendents urgents (avui o vençudes)
  const tasques = tqLoad ? tqLoad() : JSON.parse(localStorage.getItem('tasques')||'[]');
  const tasqPend = tasques.filter(t => !t.feta && !t.fromGoogle);
  const tasqAvui = tasqPend.filter(t => t.data === avuiStr);
  const tasqVenc = tasqPend.filter(t => t.data && t.data < avuiStr);
  const tasqProx = tasqPend.filter(t => t.data && t.data > avuiStr)
    .sort((a,b) => a.data.localeCompare(b.data)).slice(0,3);

  if (tasqVenc.length) {
    html += `<div class="home-rec-section-label" style="color:#991B1B">⚠ Vençudes</div>`;
    tasqVenc.forEach(t => {
      const cat = TQ_CATS?.[t.cat] || {color:'#6B7280',nom:t.cat};
      html += `<div class="home-rec-item home-rec-urgent" onclick="showPage('tasques')">
        <span class="home-rec-dot" style="background:${cat.color}"></span>
        <span class="home-rec-nom">${escapeHtml(t.titol)}</span>
        <span class="home-rec-meta">${t.data?new Date(t.data).toLocaleDateString('ca-ES',{day:'numeric',month:'short'}):''}</span>
      </div>`;
    });
  }
  if (tasqAvui.length) {
    html += `<div class="home-rec-section-label">Tasques d'avui</div>`;
    tasqAvui.forEach(t => {
      const cat = TQ_CATS?.[t.cat] || {color:'#6B7280'};
      html += `<div class="home-rec-item" onclick="showPage('tasques')">
        <span class="home-rec-dot" style="background:${cat.color}"></span>
        <span class="home-rec-nom">${escapeHtml(t.titol)}</span>
      </div>`;
    });
  }

  // 2. Events del calendari d'avui i propers (fins 7 dies)
  const prox7 = new Date(avui); prox7.setDate(avui.getDate() + 7);
  const prox7Str = prox7.toISOString().split('T')[0];
  const calEvents = (cal2LoadEvents ? cal2LoadEvents(avui.getFullYear()) : [])
    .filter(e => e.data >= avuiStr && e.data <= prox7Str)
    .sort((a,b) => a.data.localeCompare(b.data));

  if (calEvents.length) {
    html += `<div class="home-rec-section-label">Calendari proper</div>`;
    calEvents.slice(0,5).forEach(e => {
      const cat = cal2CatById ? cal2CatById(e.catId) : {color:'#4285F4'};
      const datStr = e.data === avuiStr ? 'avui' : new Date(e.data).toLocaleDateString('ca-ES',{day:'numeric',month:'short'});
      html += `<div class="home-rec-item" onclick="showPage('calendari')">
        <span class="home-rec-dot" style="background:${cat.color}"></span>
        <span class="home-rec-nom">${escapeHtml(e.titol)}</span>
        <span class="home-rec-meta">${datStr}${e.hora?' · '+e.hora:''}</span>
      </div>`;
    });
  }

  // 3. Notes de la setmana del planning
  const notesSetm = localStorage.getItem('plan_notes_' + getPlanWeekId(0));
  if (notesSetm) {
    html += `<div class="home-rec-section-label">Notes de la setmana</div>`;
    notesSetm.trim().split('\n').filter(n=>n.trim()).slice(0,4).forEach(n => {
      html += `<div class="home-rec-item">
        <span class="home-rec-dot" style="background:#F59E0B"></span>
        <span class="home-rec-nom">${escapeHtml(n.trim())}</span>
      </div>`;
    });
  }

  // 4. Tasques properes (sense data d'avui)
  if (!tasqAvui.length && tasqProx.length) {
    html += `<div class="home-rec-section-label">Properes tasques</div>`;
    tasqProx.forEach(t => {
      const cat = TQ_CATS?.[t.cat] || {color:'#6B7280'};
      const datStr = new Date(t.data).toLocaleDateString('ca-ES',{day:'numeric',month:'short'});
      html += `<div class="home-rec-item" onclick="showPage('tasques')">
        <span class="home-rec-dot" style="background:${cat.color}"></span>
        <span class="home-rec-nom">${escapeHtml(t.titol)}</span>
        <span class="home-rec-meta">${datStr}</span>
      </div>`;
    });
  }

  el.innerHTML = html || '<p class="home-empty-hint">Tot tranquil per avui.</p>';
}

/* --- SETMANA: vista ràpida dels 5 dies --- */
function _renderHomeSetmana() {
  const avui  = new Date();
  // Cache de tasques per evitar llegir localStorage múltiples vegades
  const _homeTasksCache = tqLoad ? tqLoad() : [];
  const dowAvui = avui.getDay(); // 0=dg
  const dl = new Date(avui);
  dl.setDate(avui.getDate() - (dowAvui === 0 ? 6 : dowAvui - 1));

  const wKey = getPlanWeekId(0);
  const DIES_NOM_CURTS = ['Dl','Dm','Dc','Dj','Dv'];
  const DIES_IDS = ['dl','dm','dc','dj','dv'];

  let html = '';
  DIES_IDS.forEach((diaId, i) => {
    const d = new Date(dl); d.setDate(dl.getDate() + i);
    const isAvui = d.toDateString() === avui.toDateString();
    const dNum   = d.getDate();

    // Contingut del planning
    let pills = '';
    let hasExtra = false;
    PLAN_FRANGES.forEach(f => {
      const data = JSON.parse(localStorage.getItem('plan_' + wKey + '_' + diaId + '_' + f.id) || 'null');
      if (!data) return;
      if (data.tipus === 'festa') {
        pills += `<span class="home-setm-pill" style="background:#E5E7EB;color:#374151">FESTA</span>`; hasExtra=true; return;
      }
      if ((data.tipus==='especial'||data.tipus==='sortida') && data.event) {
        pills += `<span class="home-setm-pill home-setm-pill-extra">⚠ ${escapeHtml(data.event)}</span>`; hasExtra=true; return;
      }
      if (data.alerta) {
        pills += `<span class="home-setm-pill home-setm-pill-alerta">⚠ ${escapeHtml(data.alerta)}</span>`; hasExtra=true;
      }
    });

    // Events del calendari en aquest dia
    const dStr = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(dNum).padStart(2,'0');
    const evs  = (cal2LoadEvents ? cal2LoadEvents(d.getFullYear()) : []).filter(e => e.data===dStr);
    evs.slice(0,2).forEach(e => {
      const cat = cal2CatById ? cal2CatById(e.catId) : {color:'#8B5CF6'};
      pills += `<span class="home-setm-pill" style="background:${cat.color}20;color:${cat.color}">${escapeHtml(e.titol)}</span>`;
    });

    // Tasques del dia (ja carregades fora del loop)
    const tasqDia = _homeTasksCache ? _homeTasksCache.filter(t=>!t.feta&&t.data===dStr) : [];
    tasqDia.forEach(t => {
      const cat = TQ_CATS?.[t.cat]||{color:'#6B7280'};
      pills += `<span class="home-setm-pill" style="background:${cat.color}20;color:${cat.color}">✓ ${escapeHtml(t.titol)}</span>`;
    });

    html += `<div class="home-setm-dia${isAvui?' home-setm-avui':''}">
      <div class="home-setm-nom">${DIES_NOM_CURTS[i]}</div>
      <div class="home-setm-num">${dNum}</div>
      <div class="home-setm-pills">${pills||'<span class="home-setm-normal">Normal</span>'}</div>
    </div>`;
  });

  document.getElementById('homeSetmana').innerHTML = html;
}

/* ============================================================
   ASSOLIMENTS
   Objectius: localStorage: assim_obj_{materia}_{trim} → [{id,text}]
   Avaluació: localStorage: assim_{materia}_{trim}_{studentId}_{objId}
              → true (assolit) | false (no assolit) | null (no avaluat)
   ============================================================ */

let _assimTrim    = 1;
let _assimMateria = 'matematiques';
let _assimEditObjId = null;

const ASSIM_MATERIES = {
  matematiques: 'Matemàtiques',
  catala:       'Català',
  medi:         'Medi Natural',
  musica:       'Música',
  angles:       'Anglès',
};

/* --- Persistència --- */
function assimObjKey()   { return `assim_obj_${_assimMateria}_${_assimTrim}`; }
function assimObjLoad()  { return JSON.parse(localStorage.getItem(assimObjKey()) || '[]'); }
function assimObjSave(v) {
  localStorage.setItem(assimObjKey(), JSON.stringify(v));
  _assimSaveObjToSheets(_assimMateria, _assimTrim);   // dades ocultes (sync)
  _autoSyncAssimSheet(_assimTrim);                    // full visible bonic
}

function assimValKey(sid, objId) { return `assim_${_assimMateria}_${_assimTrim}_${sid}_${objId}`; }
function assimValGet(sid, objId) {
  const v = localStorage.getItem(assimValKey(sid, objId));
  return v === null ? null : JSON.parse(v);
}
function assimValSet(sid, objId, val) {
  if (val === null) localStorage.removeItem(assimValKey(sid, objId));
  else localStorage.setItem(assimValKey(sid, objId), JSON.stringify(val));
  _assimSaveValsToSheets(_assimMateria, _assimTrim);  // dades ocultes (sync)
  _autoSyncAssimSheet(_assimTrim);                    // full visible bonic
}

/* --- Render --- */
function renderAssoliments() {
  // Trimestre automàtic (mateixa regla que notes)
  const trimActual = getTrimestreActual();
  if (trimActual !== null && _assimTrim !== trimActual) {
    _assimTrim = trimActual;
    document.querySelectorAll('#assimTrimSelector .trim-sel-btn').forEach(b => {
      b.classList.toggle('active', parseInt(b.dataset.trim) === trimActual);
    });
  }
  _renderAssimTable();
  _renderAssimResum();
}

async function selectAssimTrim(trim, btn) {
  const trimActual = getTrimestreActual();
  if (trimActual !== null && trim !== trimActual && !trimAlertSuprimida()) {
    const ok = await showTrimAlert(trimActual, trim);
    if (!ok) return; // no canvia
  }
  _assimTrim = trim;
  document.querySelectorAll('#assimTrimSelector .trim-sel-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  _renderAssimTable();
  _renderAssimResum();
}

function selectAssimMateria(mat, btn) {
  _assimMateria = mat;
  document.querySelectorAll('#assimMateriaSelector .trim-sel-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderAssoliments();
}

function _renderAssimTable() {
  const objectius = assimObjLoad();
  const wrap = document.getElementById('assimTableWrap');
  const countEl = document.getElementById('assimObjCount');
  if (countEl) countEl.textContent = objectius.length + ' objectiu' + (objectius.length !== 1 ? 's' : '');

  if (!objectius.length) {
    wrap.innerHTML = `<div class="tasques-empty">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" width="36" height="36"><circle cx="12" cy="12" r="10"/><polyline points="16 8 10 14 7 11"/></svg>
      <p>Sense objectius per <strong>${ASSIM_MATERIES[_assimMateria]}</strong> al ${getTrimLabel(_assimTrim)}.<br>
      Clica <strong>+ Afegir objectiu</strong> per crear-ne.</p>
    </div>`;
    return;
  }

  let html = '<div class="assim-table-scroll"><table class="assim-table"><thead><tr>';
  html += '<th class="assim-th-nom">Alumne</th>';
  objectius.forEach((obj, i) => {
    const nomCurt = obj.nom || (obj.text ? obj.text.substring(0,25) : 'Objectiu ' + (i+1));
    const descTitol = obj.text ? escapeHtml(obj.text) : '';
    html += `<th class="assim-th-obj">
      <button class="notes-del-btn" onclick="deleteAssimObjDirect('${obj.id}')" title="Eliminar objectiu" style="top:4px;right:4px">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
      <div class="assim-obj-nom"><strong>${escapeHtml(nomCurt)}</strong></div>
      ${descTitol ? `<button class="assim-obj-info" onclick="showAssimObjInfo('${obj.id}',event)" title="${descTitol}">ⓘ</button>` : ''}
      <button class="assim-obj-edit" onclick="openAssimObj('${obj.id}')" title="Editar">✎</button>
    </th>`;
  });
  html += '<th class="assim-th-pct">%</th></tr></thead><tbody>';

  students.forEach(s => {
    let punts = 0;
    html += `<tr><td class="assim-td-nom">${escapeHtml(s.nom)}</td>`;
    objectius.forEach(obj => {
      const val = assimValGet(s.id, obj.id);
      if (val === true)       punts += 1;
      else if (val === 'partial') punts += 0.5;
      const cls = val === true ? 'assim-cell assolit' : val === 'partial' ? 'assim-cell parcial' : val === false ? 'assim-cell no-assolit' : 'assim-cell buit';
      const icon = val === true ? '✓' : val === 'partial' ? '~' : val === false ? '✗' : '—';
      html += `<td class="${cls}" onclick="toggleAssim(${s.id},'${obj.id}',this)">${icon}</td>`;
    });
    const pct = objectius.length > 0 ? Math.round(punts / objectius.length * 100) : 0;
    const color = pct >= 80 ? '#065F46' : pct >= 50 ? '#92400E' : '#991B1B';
    const bgColor = pct >= 80 ? '#D1FAE5' : pct >= 50 ? '#FEF3C7' : '#FEE2E2';
    html += `<td class="assim-td-pct"><span style="background:${bgColor};color:${color};padding:2px 8px;border-radius:10px;font-weight:700;font-size:12px">${pct}%</span></td>`;
    html += '</tr>';
  });

  html += '</tbody></table></div>';
  wrap.innerHTML = html;
}

function _renderAssimResum() {
  const objectius = assimObjLoad();
  const list = document.getElementById('assimResum');
  if (!objectius.length || !students.length) {
    list.innerHTML = '<p class="home-empty-hint">Afegeix objectius per veure el resum.</p>';
    return;
  }

  list.innerHTML = students.map(s => {
    let puntsR = 0;
    objectius.forEach(obj => {
      const v = assimValGet(s.id, obj.id);
      if (v === true) puntsR += 1;
      else if (v === 'partial') puntsR += 0.5;
    });
    const pct = Math.round(puntsR / objectius.length * 100);
    const color = pct >= 80 ? '#065F46' : pct >= 50 ? '#92400E' : '#991B1B';
    const barBg = pct >= 80 ? '#22C55E' : pct >= 50 ? '#F59E0B' : '#EF4444';

    return `<div class="assim-resum-item">
      <div class="assim-resum-nom">${escapeHtml(s.nom)}</div>
      <div class="assim-resum-bar-wrap">
        <div class="assim-resum-bar" style="width:${pct}%;background:${barBg}"></div>
      </div>
      <span class="assim-resum-pct" style="color:${color}">${pct}%</span>
    </div>`;
  }).join('');
}

/* --- Toggle estat (—→✓→✗→—) --- */
function toggleAssim(sid, objId, cell) {
  const cur = assimValGet(sid, objId);
  // Cicle: null → true → 'partial' → false → null
  let next;
  if (cur === null)         next = true;
  else if (cur === true)    next = 'partial';
  else if (cur === 'partial') next = false;
  else                      next = null;

  assimValSet(sid, objId, next);
  _applyAssimCell(cell, next);
  _updateAssimRowPct(sid);
}

function _applyAssimCell(cell, val) {
  if (val === true)       { cell.className='assim-cell assolit';    cell.textContent='✓'; }
  else if (val==='partial'){ cell.className='assim-cell parcial';   cell.textContent='~'; }
  else if (val === false) { cell.className='assim-cell no-assolit'; cell.textContent='✗'; }
  else                    { cell.className='assim-cell buit';       cell.textContent='—'; }
}

function _updateAssimRowPct(sid) {
  const objectius = assimObjLoad();
  const rows = document.querySelectorAll('.assim-table tbody tr');
  rows.forEach(tr => {
    const nomCell = tr.querySelector('.assim-td-nom');
    if (!nomCell) return;
    const s = students.find(x => x.nom === nomCell.textContent);
    if (!s || s.id !== sid) return;
    let punts = 0;
    objectius.forEach(obj => {
      const v = assimValGet(s.id, obj.id);
      if (v === true) punts += 1;
      else if (v === 'partial') punts += 0.5;
    });
    const pct = objectius.length > 0 ? Math.round(punts / objectius.length * 100) : 0;
    const color = pct >= 80 ? '#065F46' : pct >= 50 ? '#92400E' : '#991B1B';
    const bgColor = pct >= 80 ? '#D1FAE5' : pct >= 50 ? '#FEF3C7' : '#FEE2E2';
    const pctCell = tr.querySelector('.assim-td-pct');
    if (pctCell) pctCell.innerHTML = `<span style="background:${bgColor};color:${color};padding:2px 8px;border-radius:10px;font-weight:700;font-size:12px">${pct}%</span>`;
  });
}

/* --- Modal objectiu --- */
function showAssimObjInfo(objId, event) {
  event.stopPropagation();
  const obj = assimObjLoad().find(o => o.id === objId);
  if (!obj || !obj.text) return;
  // Mostra un tooltip posicionat
  let tip = document.getElementById('assimInfoTip');
  if (!tip) {
    tip = document.createElement('div');
    tip.id = 'assimInfoTip';
    tip.className = 'assim-info-tip';
    document.body.appendChild(tip);
    document.addEventListener('click', () => tip.style.display = 'none');
  }
  tip.innerHTML = `<strong>${escapeHtml(obj.nom || '')}</strong><br>${escapeHtml(obj.text)}`;
  const r = event.target.getBoundingClientRect();
  tip.style.display = 'block';
  tip.style.top     = (r.bottom + window.scrollY + 6) + 'px';
  tip.style.left    = Math.min(r.left + window.scrollX, window.innerWidth - 280) + 'px';
}

function deleteAssimObjDirect(id) {
  if (!confirm('Eliminar aquest objectiu i totes les seves avaluacions?')) return;
  const objectius = assimObjLoad().filter(o => o.id !== id);
  students.forEach(s => localStorage.removeItem(assimValKey(s.id, id)));
  assimObjSave(objectius);
  renderAssoliments();
}

function openAssimObj(id) {
  _assimEditObjId = id;
  const del = document.getElementById('assimObjDelBtn');
  document.getElementById('assimObjTitle').textContent = id ? 'Editar objectiu' : 'Nou objectiu';
  document.getElementById('assimObjSub').textContent   = `${ASSIM_MATERIES[_assimMateria]} · ${getTrimLabel(_assimTrim)}`;
  del.style.display = id ? 'inline-flex' : 'none';

  if (id) {
    const obj = assimObjLoad().find(o => o.id === id);
    document.getElementById('assimObjNom').value  = obj ? (obj.nom  || '') : '';
    document.getElementById('assimObjText').value = obj ? (obj.text || '') : '';
  } else {
    document.getElementById('assimObjNom').value  = '';
    document.getElementById('assimObjText').value = '';
  }
  document.getElementById('assimObjOverlay').classList.add('open');
  setTimeout(() => document.getElementById('assimObjText').focus(), 100);
}

function closeAssimObj() { document.getElementById('assimObjOverlay').classList.remove('open'); }

function saveAssimObj() {
  const nom  = document.getElementById('assimObjNom').value.trim();
  const text = document.getElementById('assimObjText').value.trim();
  if (!nom) { document.getElementById('assimObjNom').focus(); return; }
  const objectius = assimObjLoad();
  if (_assimEditObjId) {
    const obj = objectius.find(o => o.id === _assimEditObjId);
    if (obj) { obj.nom = nom; obj.text = text; }
  } else {
    objectius.push({ id: Date.now().toString(), nom, text });
  }
  assimObjSave(objectius);
  closeAssimObj();
  renderAssoliments();
}

function deleteAssimObj() {
  if (!_assimEditObjId || !confirm('Eliminar aquest objectiu i totes les seves avaluacions?')) return;
  const objectius = assimObjLoad().filter(o => o.id !== _assimEditObjId);
  // Elimina les avaluacions d'aquest objectiu
  students.forEach(s => localStorage.removeItem(assimValKey(s.id, _assimEditObjId)));
  assimObjSave(objectius);
  closeAssimObj();
  renderAssoliments();
}

/* Sincronitza tots els assoliments del trimestre actual al Sheets */
// Recull totes les dades d'assoliments d'un trimestre per al full visible
function _buildAssimSheetData(trim) {
  const MATS = ['matematiques','catala','medi','musica','angles'];
  const data = {};
  MATS.forEach(mat => {
    const objectius = JSON.parse(localStorage.getItem(`assim_obj_${mat}_${trim}`) || '[]');
    if (!objectius.length) return;
    const alumnes = students.map(s => {
      const vals = {};
      objectius.forEach(obj => {
        const v = localStorage.getItem(`assim_${mat}_${trim}_${s.id}_${obj.id}`);
        vals[obj.id] = v !== null ? JSON.parse(v) : null;
      });
      return { id: s.id, nom: s.nom, vals };
    });
    data[mat] = { objectius, alumnes };
  });
  return data;
}

// Sincronització automàtica i silenciosa del full visible (amb debounce).
// Es crida sola cada vegada que es marca una cel·la o s'edita un objectiu.
function _autoSyncAssimSheet(trim) {
  if (!config.scriptUrl) return;
  const t = trim || _assimTrim;
  debounce('assimSheet_' + t, () => {
    const data = _buildAssimSheetData(t);
    appsScriptPost({ action: 'syncAssoliments', trimestre: t, data }).catch(() => {});
  }, 2500);
}

// Sincronització manual (botó) — amb avís visible
async function syncAssimToSheets() {
  if (!config.scriptUrl) { showToast('Configura el Google Sheets primer', 'error'); return; }
  showToast('Sincronitzant assoliments…', 'info');
  try {
    const r = await appsScriptPost({ action: 'syncAssoliments', trimestre: _assimTrim, data: _buildAssimSheetData(_assimTrim) });
    if (r.ok) showToast('Assoliments sincronitzats al Sheets ✓', 'success');
    else showToast('Error en sincronitzar', 'error');
  } catch(e) {
    showToast('Error de connexió', 'error');
  }
}

/* ============================================================
   CAPA DE SINCRONITZACIÓ AL SHEETS
   Cada funció: llegeix del cache local (instant) i sincronitza
   al Sheets en segon pla sense bloquejar la UI.
   ============================================================ */

/* --- PLANNING --- */
function _planningWeekData(weekId) {
  // Recull totes les cel·les i les notes d'una setmana en un sol objecte
  const data = {};
  const prefix = 'plan_' + weekId + '_';
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(prefix)) {
      const subkey = k.slice(prefix.length); // ex: 'dl_f1'
      try { data[subkey] = JSON.parse(localStorage.getItem(k)); } catch(e) { data[subkey] = localStorage.getItem(k); }
    }
  }
  // Notes setmana
  const notesKey = 'plan_notes_' + weekId;
  const notesVal = localStorage.getItem(notesKey);
  if (notesVal) data['_notes'] = notesVal;
  // Notes del dia
  ['dl','dm','dc','dj','dv'].forEach(d => {
    const dk = 'plan_daynote_' + weekId + '_' + d;
    const dv = localStorage.getItem(dk);
    if (dv) data['_daynote_' + d] = dv;
  });
  return data;
}

function syncPlanningWeek(weekId) {
  if (!config.scriptUrl) return;
  const wid = weekId || getPlanWeekId(_planWeekOffset);
  debounce('planning_' + wid, () => {
    appsScriptPost({ action: 'savePlanning', weekId: wid, data: _planningWeekData(wid) }).catch(() => {});
  }, 800);
}

async function loadPlanningWeekFromSheets(weekId) {
  if (!config.scriptUrl) return;
  try {
    const r = await appsScriptGet({ action: 'loadPlanning', weekId });
    if (!r.ok || !r.data) return;
    const prefix = 'plan_' + weekId + '_';
    Object.entries(r.data).forEach(([subkey, val]) => {
      if (subkey === '_notes') {
        localStorage.setItem('plan_notes_' + weekId, val);
      } else if (subkey.startsWith('_daynote_')) {
        const diaId = subkey.replace('_daynote_', '');
        localStorage.setItem('plan_daynote_' + weekId + '_' + diaId, val);
      } else {
        localStorage.setItem(prefix + subkey, typeof val === 'string' ? val : JSON.stringify(val));
      }
    });
  } catch(e) {}
}

/* --- TASQUES --- */
function _tqSaveToSheets() {
  if (!config.scriptUrl) return;
  debounce('tasques', () => {
    const data = JSON.parse(localStorage.getItem('tasques') || '[]');
    appsScriptPost({ action: 'saveTasques', data }).catch(() => {});
  }, 800);
}

async function _tqLoadFromSheets() {
  if (!config.scriptUrl) return;
  try {
    const r = await appsScriptGet({ action: 'loadTasques' });
    if (r.ok && r.data && r.data.length) {
      localStorage.setItem('tasques', JSON.stringify(r.data));
    }
  } catch(e) {}
}

/* --- CALENDARI --- */
function _calSaveToSheets(year) {
  if (!config.scriptUrl) return;
  const data = JSON.parse(localStorage.getItem('cal2_events_' + year) || '[]');
  appsScriptPost({ action: 'saveCalendari', year, data }).catch(() => {});
}

function _calSaveCatsToSheets() {
  if (!config.scriptUrl) return;
  const data = JSON.parse(localStorage.getItem('cal2_cats') || 'null');
  if (data) appsScriptPost({ action: 'saveCalendariCats', data }).catch(() => {});
}

async function _calLoadFromSheets(year) {
  if (!config.scriptUrl) return;
  try {
    const [evR, catR] = await Promise.all([
      appsScriptGet({ action: 'loadCalendari', year }),
      appsScriptGet({ action: 'loadCalendariCats' }),
    ]);
    if (evR.ok && evR.data && evR.data.length) localStorage.setItem('cal2_events_' + year, JSON.stringify(evR.data));
    if (catR.ok && catR.data) localStorage.setItem('cal2_cats', JSON.stringify(catR.data));
    _lastCalLoad = Date.now();
  } catch(e) {}
}

/* --- ASSOLIMENTS --- */
function _assimSaveObjToSheets(materia, trimestre) {
  if (!config.scriptUrl) return;
  const data = JSON.parse(localStorage.getItem(`assim_obj_${materia}_${trimestre}`) || '[]');
  appsScriptPost({ action: 'saveAssimObjectius', materia, trimestre, data }).catch(() => {});
}

function _assimSaveValsToSheets(materia, trimestre) {
  if (!config.scriptUrl) return;
  // Debounce: agrupa marcatges ràpids en una sola crida
  debounce('assimVals_' + materia + '_' + trimestre, () => {
    const objs = JSON.parse(localStorage.getItem(`assim_obj_${materia}_${trimestre}`) || '[]');
    const data = {};
    students.forEach(s => {
      data[s.id] = {};
      objs.forEach(obj => {
        const v = localStorage.getItem(`assim_${materia}_${trimestre}_${s.id}_${obj.id}`);
        data[s.id][obj.id] = v !== null ? JSON.parse(v) : null;
      });
    });
    appsScriptPost({ action: 'saveAssimValors', materia, trimestre, data }).catch(() => {});
  });
}

async function _assimLoadFromSheets(materia, trimestre) {
  if (!config.scriptUrl) return;
  try {
    const [objR, valR] = await Promise.all([
      appsScriptGet({ action: 'loadAssimObjectius', materia, trimestre }),
      appsScriptGet({ action: 'loadAssimValors', materia, trimestre }),
    ]);
    if (objR.ok && objR.data && objR.data.length) {
      localStorage.setItem(`assim_obj_${materia}_${trimestre}`, JSON.stringify(objR.data));
    }
    if (valR.ok && valR.data) {
      Object.entries(valR.data).forEach(([sid, vals]) => {
        if (vals) Object.entries(vals).forEach(([objId, val]) => {
          if (val !== null) localStorage.setItem(`assim_${materia}_${trimestre}_${sid}_${objId}`, JSON.stringify(val));
        });
      });
    }
  } catch(e) {}
}

/* --- ACTITUD --- */
function _actitudSaveToSheets(materia, trimestre) {
  if (!config.scriptUrl) return;
  debounce('actitud_' + materia + '_' + trimestre, () => {
    const data = {};
    students.forEach(s => {
      const v = localStorage.getItem(`actitud_${materia}_${trimestre}_${s.id}`);
      if (v) data[s.id] = JSON.parse(v);
    });
    appsScriptPost({ action: 'saveActitud', materia, trimestre, data }).catch(() => {});
  });
}

async function _actitudLoadFromSheets(materia, trimestre) {
  if (!config.scriptUrl) return;
  try {
    const r = await appsScriptGet({ action: 'loadActitud', materia, trimestre });
    if (r.ok && r.data) {
      Object.entries(r.data).forEach(([sid, dades]) => {
        localStorage.setItem(`actitud_${materia}_${trimestre}_${sid}`, JSON.stringify(dades));
      });
    }
  } catch(e) {}
}

/* Timestamp de l'última càrrega global; evita recàrregues redundants en obrir seccions */
let _lastFullLoadTs = 0;
let _lastCalLoad = 0;
function _recentFullLoad() { return Date.now() - _lastFullLoadTs < 5000; }

/* --- CÀRREGA INICIAL COMPLETA (una sola crida consolidada) --- */
async function loadAllFromSheets() {
  if (!config.scriptUrl) return;
  const year = new Date().getFullYear();
  const weekIds = [getPlanWeekId(-1), getPlanWeekId(0), getPlanWeekId(1)];

  try {
    const r = await appsScriptGet({ action: 'loadAppData', weekIds: JSON.stringify(weekIds) });
    if (!r.ok) return;

    // Planning
    if (r.planning) {
      Object.entries(r.planning).forEach(([weekId, data]) => {
        const prefix = 'plan_' + weekId + '_';
        Object.entries(data).forEach(([subkey, val]) => {
          if (subkey === '_notes') localStorage.setItem('plan_notes_' + weekId, val);
          else if (subkey.startsWith('_daynote_')) localStorage.setItem('plan_daynote_' + weekId + '_' + subkey.replace('_daynote_', ''), val);
          else localStorage.setItem(prefix + subkey, typeof val === 'string' ? val : JSON.stringify(val));
        });
      });
    }

    // Tasques
    if (r.tasques && r.tasques.length) localStorage.setItem('tasques', JSON.stringify(r.tasques));

    // Calendari
    if (r.calCats) localStorage.setItem('cal2_cats', JSON.stringify(r.calCats));
    if (r.calEvents) Object.entries(r.calEvents).forEach(([y, evs]) => {
      if (evs && evs.length) localStorage.setItem('cal2_events_' + y, JSON.stringify(evs));
    });

    // Assoliments (obj_{mat}_{trim} i vals_{mat}_{trim})
    if (r.assim) Object.entries(r.assim).forEach(([key, val]) => {
      if (key.startsWith('obj_')) {
        localStorage.setItem('assim_obj_' + key.slice(4), val);
      } else if (key.startsWith('vals_')) {
        const matTrim = key.slice(5);  // {mat}_{trim}
        const parsed = JSON.parse(val);
        Object.entries(parsed).forEach(([sid, vals]) => {
          if (vals) Object.entries(vals).forEach(([objId, v]) => {
            if (v !== null) localStorage.setItem(`assim_${matTrim}_${sid}_${objId}`, JSON.stringify(v));
          });
        });
      }
    });

    // Actitud ({mat}_{trim} → { sid: {...} })
    if (r.actitud) Object.entries(r.actitud).forEach(([matTrim, val]) => {
      const parsed = JSON.parse(val);
      Object.entries(parsed).forEach(([sid, dades]) => {
        localStorage.setItem(`actitud_${matTrim}_${sid}`, JSON.stringify(dades));
      });
    });
    _lastFullLoadTs = Date.now();
  } catch(e) { /* offline: usa el cache local */ }
}

/* ============================================================
   SISTEMA DE NOTIFICACIONS
   Recull tasques, alertes planning i events del calendari del
   dia d'avui i programa una notificació per les 7:00 del matí.
   ============================================================ */

let _swReg = null; // registre del service worker

/* Demana permís i registra el SW */
async function initNotifications() {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return;
  try {
    _swReg = await navigator.serviceWorker.ready;
  } catch(e) { return; }

  const perm = Notification.permission;
  if (perm === 'denied') return;
  if (perm === 'default') {
    // Demanem el permís quan l'usuari va a configuració
    return;
  }
  // Ja tenim permís → programa la notificació d'avui
  _scheduleDaily();
}

/* Demana el permís explícitament (crida des del botó de config) */
async function requestNotifPermission() {
  if (!('Notification' in window)) {
    showToast('Aquest navegador no suporta notificacions', 'error'); return;
  }
  const perm = await Notification.requestPermission();
  if (perm === 'granted') {
    showToast('Notificacions activades ✓', 'success');
    await initNotifications();
    _scheduleDaily();
  } else {
    showToast('Permís denegat. Activa-les des del navegador.', 'error');
  }
  _renderNotifStatus();
}

/* Desactiva les notificacions */
function cancelNotifications() {
  if (_swReg) _swReg.active?.postMessage({ type: 'CANCEL_NOTIF' });
  localStorage.removeItem('notifEnabled');
  showToast('Notificacions desactivades', 'info');
  _renderNotifStatus();
}

/* Renderitza l'estat al botó de configuració */
function _renderNotifStatus() {
  const btn = document.getElementById('notifToggleBtn');
  if (!btn) return;
  const perm = ('Notification' in window) ? Notification.permission : 'unsupported';
  if (perm === 'unsupported') {
    btn.textContent = '🔔 No disponible en aquest navegador';
    btn.disabled = true;
  } else if (perm === 'granted') {
    btn.innerHTML = '🔔 Notificacions activades · <span style="color:#10B981">actives</span> — <u style="cursor:pointer" onclick="cancelNotifications()">desactivar</u>';
  } else if (perm === 'denied') {
    btn.textContent = '🔕 Notificacions bloquejades (activa-les al navegador)';
    btn.disabled = true;
  } else {
    btn.textContent = '🔔 Activar notificacions diàries a les 7:00';
    btn.onclick = requestNotifPermission;
  }
}

/* Recull totes les coses del dia d'avui */
function _collectTodayItems() {
  const avui  = new Date();
  const any   = avui.getFullYear();
  const mes   = avui.getMonth() + 1;
  const dia   = avui.getDate();
  const avuiStr = `${any}-${String(mes).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
  const items = [];

  // 1. Tasques del dia
  const tasques = JSON.parse(localStorage.getItem('tasques') || '[]');
  tasques.filter(t => !t.feta && t.data === avuiStr).forEach(t => {
    items.push(`📋 ${t.text}`);
  });

  // 2. Alertes del planning (franja amb alerta al dia d'avui)
  const weekId = getPlanWeekId(0);
  const dow    = avui.getDay(); // 0=dg,1=dl...5=dv
  const diaIds = ['','dl','dm','dc','dj','dv'];
  const diaId  = dow >= 1 && dow <= 5 ? diaIds[dow] : null;
  if (diaId) {
    PLAN_FRANGES.forEach(f => {
      const key  = `plan_${weekId}_${diaId}_${f.id}`;
      const data = JSON.parse(localStorage.getItem(key) || 'null');
      if (!data) return;
      if (data.alerta) items.push(`⚠️ ${data.alerta} (${f.hora})`);
      if (data.tipus && data.tipus !== 'normal' && data.event) {
        // Només afegeix la primera franja de l'event (no repetir)
        const prev = `plan_${weekId}_${diaId}_${PLAN_FRANGES[PLAN_FRANGES.indexOf(f)-1]?.id}`;
        const prevData = prev ? JSON.parse(localStorage.getItem(prev) || 'null') : null;
        if (!prevData || prevData.event !== data.event) {
          items.push(`📅 ${data.event}${data.eventSub ? ' – ' + data.eventSub : ''}`);
        }
      }
    });
    // Notes del dia
    const dayNotes = planDayNoteLoad(diaId);
    dayNotes.forEach(n => items.push(`📌 ${n}`));
  }

  // 3. Events del calendari d'avui
  const calEvs = JSON.parse(localStorage.getItem(`cal2_events_${any}`) || '[]');
  calEvs.filter(ev => {
    const d = new Date(ev.data || ev.start || ev.date || '');
    return d.getFullYear() === any && d.getMonth()+1 === mes && d.getDate() === dia;
  }).forEach(ev => {
    items.push(`🗓 ${ev.titol || ev.title || ev.nom || 'Event'}`);
  });

  return { avuiStr, items };
}

/* Programa la notificació per les 7:00 del matí (del dia actual o del dia vinent) */
function _scheduleDaily() {
  if (!_swReg || Notification.permission !== 'granted') return;

  const { avuiStr, items } = _collectTodayItems();

  // Calcula quan és les 7:00 del matí (si ja ha passat, programa per demà)
  const now   = new Date();
  const fire7 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 7, 0, 0, 0);
  if (fire7 <= now) fire7.setDate(fire7.getDate() + 1); // demà

  // Si avui no hi ha res, no cal notificació
  if (!items.length && fire7.toDateString() === now.toDateString()) {
    _swReg.active?.postMessage({ type: 'CANCEL_NOTIF' });
    return;
  }

  const n = items.length;
  const payload = {
    fireAt: fire7.getTime(),
    title:  n > 0 ? `Bon dia! Tens ${n} cosa${n > 1 ? 's' : ''} avui` : 'Bon dia!',
    body:   items.slice(0, 4).map(i => '• ' + i).join('\n') + (n > 4 ? `\n… i ${n - 4} més` : ''),
    items,
  };
  _swReg.active?.postMessage({ type: 'SCHEDULE_NOTIF', payload });
  localStorage.setItem('notifEnabled', '1');
}

/* Envia una notificació de prova immediatament */
function testNotification() {
  if (!_swReg) { showToast('Service worker no disponible', 'error'); return; }
  const { items } = _collectTodayItems();
  const n = items.length;
  _swReg.active?.postMessage({
    type: 'TEST_NOTIF',
    payload: {
      title: n > 0 ? `Bon dia! Tens ${n} cosa${n > 1 ? 's' : ''} avui` : 'Bon dia! No tens res pendent avui',
      body:  items.slice(0, 4).map(i => '• ' + i).join('\n') || 'Dia lliure 🎉',
      items,
    },
  });
}

/* Re-programa cada cop que es guarden dades (tasques, planning...) */
function _rescheduleIfNeeded() {
  if (Notification.permission === 'granted') _scheduleDaily();
}

/* ============================================================
   GENERADOR DE COMENTARIS
   Rubriques per assignatura (format: { nom, nivells:[MBA,ASS,AAJ,NA] })
   ============================================================ */
const RUBRIQUES = {
  matematiques: {
    nom: 'Matemàtiques',
    objectius: [
      {
        nom: 'Sumes amb i sense portar-ne (1–1000)',
        nivells: [
          'Resol sumes amb i sense portar-ne amb nombres fins al 1000 amb seguretat, autonomia i precisió, aplicant correctament el procediment i revisant el resultat quan cal.',
          'Resol correctament sumes amb i sense portar-ne amb nombres fins al 1000, mostrant una bona comprensió del procediment treballat.',
          'Resol sumes amb i sense portar-ne amb nombres fins al 1000, tot i que en alguns moments necessita suport per ordenar bé els nombres, aplicar el procediment o revisar el resultat.',
          'Encara li costa resoldre sumes amb i sense portar-ne amb nombres fins al 1000, i necessita continuar treballant el procediment amb suport i pràctica guiada.',
        ]
      },
      {
        nom: 'Restes sense portar-ne (1–1000)',
        nivells: [
          'Resol restes sense portar-ne amb nombres fins al 1000 amb molta seguretat, autonomia i precisió, col·locant correctament els nombres i aplicant el procediment de manera adequada.',
          'Resol correctament restes sense portar-ne amb nombres fins al 1000 i mostra una bona comprensió del procediment treballat.',
          'Resol restes sense portar-ne amb nombres fins al 1000, però en alguns casos necessita ajuda per col·locar bé els nombres, seguir l\'ordre del procediment o revisar el resultat.',
          'Encara presenta dificultats per resoldre restes sense portar-ne amb nombres fins al 1000 i necessita reforçar aquest contingut amb activitats guiades.',
        ]
      },
      {
        nom: 'Resta portant-ne',
        nivells: [
          'Ha començat a entendre molt bé el funcionament de la resta portant-ne i és capaç de calcular-ne amb seguretat, aplicant el procediment de manera cada vegada més autònoma.',
          'Ha començat a entendre el funcionament de la resta portant-ne i resol aquest tipus de restes de manera adequada en les situacions treballades a l\'aula.',
          'Ha iniciat la comprensió de la resta portant-ne, però encara necessita suport per aplicar correctament els passos i entendre el canvi entre unitats, desenes o centenes.',
          'Encara li costa entendre i aplicar el procediment de la resta portant-ne, i necessita continuar treballant aquest contingut de manera manipulativa, visual i guiada.',
        ]
      },
      {
        nom: 'Descomposició per sumar i restar',
        nivells: [
          'Utilitza l\'estratègia de la descomposició per sumar i restar nombres amb molta seguretat, entenent el valor de cada xifra i aplicant-la de manera autònoma.',
          'Utilitza l\'estratègia de la descomposició per sumar i restar nombres de manera adequada, mostrant una bona comprensió del valor posicional.',
          'Comença a utilitzar l\'estratègia de la descomposició per sumar i restar nombres, tot i que encara necessita suport per separar correctament centenes, desenes i unitats.',
          'Encara li costa utilitzar la descomposició com a estratègia de càlcul i necessita reforçar la comprensió del valor de les xifres dins del nombre.',
        ]
      },
      {
        nom: 'Resolució de problemes',
        nivells: [
          'Participa activament en la resolució de problemes, comprèn bé les situacions plantejades, tria estratègies adequades i explica el seu raonament amb claredat.',
          'Resol problemes adequats al nivell treballat, identificant les dades importants i aplicant estratègies matemàtiques de manera correcta.',
          'Comença a resoldre problemes matemàtics, però sovint necessita ajuda per comprendre l\'enunciat, identificar les dades importants o escollir l\'operació adequada.',
          'Encara presenta dificultats en la resolució de problemes i necessita suport per comprendre els enunciats, organitzar la informació i decidir quina estratègia utilitzar.',
        ]
      },
      {
        nom: 'Dobles dels nombres (1–100)',
        nivells: [
          'Té molt ben automatitzats els dobles dels nombres treballats fins al 100 i els utilitza amb rapidesa i seguretat en situacions de càlcul.',
          'Coneix i calcula correctament els dobles dels nombres treballats fins al 100, mostrant una bona evolució en l\'agilitat del càlcul mental.',
          'Calcula alguns dobles dels nombres treballats fins al 100, però encara necessita temps, suport o estratègies de referència per arribar al resultat.',
          'Encara no té automatitzats els dobles dels nombres treballats fins al 100 i necessita continuar practicant-los per guanyar seguretat i rapidesa.',
        ]
      },
      {
        nom: 'Meitats dels nombres parells (1–100)',
        nivells: [
          'Té molt ben automatitzades les meitats dels nombres parells treballats fins al 100 i les calcula amb rapidesa, seguretat i autonomia.',
          'Calcula correctament les meitats dels nombres parells treballats fins al 100 i mostra una bona comprensió de la relació entre doble i meitat.',
          'Calcula algunes meitats dels nombres parells treballats fins al 100, però encara necessita suport, temps o material de referència per assegurar el resultat.',
          'Encara li costa calcular les meitats dels nombres parells treballats fins al 100 i necessita reforçar la relació entre doble i meitat.',
        ]
      },
      {
        nom: 'Càlcul per deducció de fets',
        nivells: [
          'Utilitza estratègies de deducció per calcular amb molta seguretat, relacionant fets coneguts i aplicant-los de manera flexible en nous càlculs.',
          'Comença a utilitzar fets coneguts per deduir nous resultats i mostra una bona evolució en l\'ús d\'estratègies de càlcul mental.',
          'Comença a establir relacions entre càlculs coneguts i nous resultats, però encara necessita suport per aplicar aquestes deduccions de manera autònoma.',
          'Encara li costa utilitzar fets coneguts per deduir nous càlculs i necessita continuar treballant estratègies de càlcul mental de manera guiada.',
        ]
      },
      {
        nom: 'Representació i descomposició de nombres (1–1000)',
        nivells: [
          'Representa nombres fins al 1000 amb molta seguretat i els descompon correctament en centenes, desenes i unitats, demostrant una molt bona comprensió del sistema decimal.',
          'Representa nombres fins al 1000 i els descompon correctament en centenes, desenes i unitats en les activitats treballades a l\'aula.',
          'Representa i descompon nombres fins al 1000, però encara necessita suport per identificar correctament el valor de les centenes, desenes i unitats.',
          'Encara presenta dificultats per representar i descompondre nombres fins al 1000, i necessita reforçar la comprensió de les centenes, desenes i unitats.',
        ]
      },
      {
        nom: 'Identificar nombres per propietats (1–100)',
        nivells: [
          'Identifica nombres entre 1 i 100 a partir de les seves propietats amb molta seguretat, utilitzant pistes i raonaments matemàtics de manera autònoma.',
          'Identifica nombres entre 1 i 100 a partir de les seves propietats i mostra una bona capacitat per interpretar pistes matemàtiques.',
          'Comença a identificar nombres entre 1 i 100 a partir de les seves propietats, però necessita ajuda per interpretar algunes pistes o comprovar el resultat.',
          'Encara li costa identificar nombres entre 1 i 100 a partir de les seves propietats i necessita suport per relacionar les pistes amb el nombre corresponent.',
        ]
      },
    ]
  },
  catala:       { nom: 'Català',    objectius: [] },
  medi:         { nom: 'Medi Natural', objectius: [] },
  musica:       { nom: 'Música',    objectius: [] },
  angles:       { nom: 'Anglès',    objectius: [] },
};

const NIVELL_INFO = [
  { key: 'mba',  label: 'Molt ben assolit', short: 'MBA',  cls: 'badge-mba'  },
  { key: 'ass',  label: 'Assolit',          short: 'AS',   cls: 'badge-ass'  },
  { key: 'aaj',  label: 'Assolit amb ajuda',short: 'AAJ',  cls: 'badge-aaj'  },
  { key: 'nass', label: 'No assolit',        short: 'NA',   cls: 'badge-nass' },
];

let _comentAssig   = 'matematiques';
let _comentAlumne  = null;
let _comentSeleccions = {}; // { objIdx: nivellIdx (0-3) }

function selectComentAssig(assig, btn) {
  _comentAssig = assig;
  document.querySelectorAll('#comentAssigSelector .trim-sel-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  _comentSeleccions = {};
  renderComentRubrica();
}

function onComentAlumneChange() {
  const sel = document.getElementById('comentAlumneSelect');
  _comentAlumne = sel.value || null;
  _comentSeleccions = {};
  renderComentRubrica();
}

function renderComentRubrica() {
  const rubrica = RUBRIQUES[_comentAssig];
  const container = document.getElementById('comentRubrica');
  const genBtn    = document.getElementById('comentGenBtn');

  if (!rubrica || !rubrica.objectius.length) {
    container.innerHTML = `<p class="fitxa-empty-field" style="margin-top:12px">Rúbrica de ${rubrica?.nom || _comentAssig} encara no disponible. S'afegirà quan tinguis els objectius definitius.</p>`;
    if (genBtn) genBtn.disabled = true;
    return;
  }
  if (!_comentAlumne) {
    container.innerHTML = '<p class="fitxa-empty-field" style="margin-top:12px">Selecciona un alumne per continuar.</p>';
    if (genBtn) genBtn.disabled = true;
    return;
  }

  let html = '';
  rubrica.objectius.forEach((obj, i) => {
    const sel = _comentSeleccions[i] ?? -1;
    html += `<div class="coment-objectiu-row">
      <div class="coment-obj-nom-compact" title="${escapeHtml(obj.nom)}">${i+1}. ${escapeHtml(obj.nom)}</div>
      <div class="coment-nivells-row">`;
    NIVELL_INFO.forEach((niv, j) => {
      const active = sel === j ? ' active' : '';
      const tooltip = escapeHtml(obj.nivells[j]).replace(/"/g, '&quot;');
      html += `<button type="button" class="coment-niv-btn ${niv.cls}${active}"
        onclick="_comentSeleccions[${i}]=${j}; renderComentRubrica();"
        title="${tooltip}">${niv.short}</button>`;
    });
    html += '</div></div>';
  });
  container.innerHTML = html;
  _updateComentBtn();
}

function _updateComentBtn() {
  const rubrica = RUBRIQUES[_comentAssig];
  const genBtn  = document.getElementById('comentGenBtn');
  if (!genBtn || !rubrica) return;
  const omplerts = Object.keys(_comentSeleccions).length;
  // Activat amb almenys 1 objectiu marcat; si en falten t'avisarà per pop-up
  genBtn.disabled = omplerts === 0;
  genBtn.title = '';
}

function resetComentRubrica() {
  _comentSeleccions = {};
  renderComentRubrica();
}

// Construeix l'esborrany base a partir de les frases de la rúbrica
function _buildEsborrany(rubrica, alumne) {
  const grups = { mba: [], ass: [], aaj: [], nass: [] };
  rubrica.objectius.forEach((obj, i) => {
    const nivIdx = _comentSeleccions[i] ?? -1;
    if (nivIdx < 0) return;
    const niv = NIVELL_INFO[nivIdx].key;
    grups[niv].push(obj.nivells[nivIdx]);
  });
  const CONN = {
    mba:  ['En aquest trimestre, ', 'A més, ', 'També destaca que ', 'Cal afegir que '],
    ass:  ['Pel que fa al treball d\'aquest trimestre, ', 'Així mateix, ', 'D\'altra banda, ', 'També '],
    aaj:  ['Tot i això, ', 'Pel que fa als aspectes a reforçar, ', 'D\'altra banda, ', 'A més, '],
    nass: ['Cal continuar treballant alguns aspectes: ', 'D\'altra banda, ', 'A més, ', 'També caldria reforçar que '],
  };
  function ferParagraf(frases, connectors) {
    if (!frases.length) return '';
    return frases.map((f, i) => {
      let frase = f.trim();
      frase = frase.charAt(0).toLowerCase() + frase.slice(1);
      return connectors[Math.min(i, connectors.length - 1)] + frase;
    }).join(' ');
  }
  const parts = [
    ferParagraf(grups.mba, CONN.mba),
    ferParagraf(grups.ass, CONN.ass),
    ferParagraf(grups.aaj, CONN.aaj),
    ferParagraf(grups.nass, CONN.nass),
  ].filter(p => p);
  let text = parts.join(' ');
  const nomCurt = alumne.nom.split(' ')[0];
  const nomAmbArticle = _articleNom(nomCurt, alumne.genere) + nomCurt;
  text = text.replace(/^(En aquest trimestre, )(.)/, (m, intro, lletra) =>
    `En aquest trimestre, ${nomAmbArticle} ` + lletra.toLowerCase()
  );
  return text;
}

// Mostra el resultat (esborrany o text final de la IA)
function _mostrarComentari(text, rubrica, alumne, ambIA) {
  const consell = ambIA
    ? '✅ Redactat per Gemini. Revisa-ho i edita si cal.'
    : '💡 Esborrany sense IA. Configura la clau Gemini a Configuració per redactar automàticament.';
  const overlay = document.getElementById('comentResultOverlay');
  document.getElementById('comentResultTitle').textContent = `${rubrica.nom} · ${alumne.nom}`;
  document.getElementById('comentTextBox').innerHTML = escapeHtml(text);
  document.getElementById('comentResultConsell').textContent = consell;
  overlay.classList.add('open');
}

function closeComentResult() {
  document.getElementById('comentResultOverlay').classList.remove('open');
}

async function generarComentari() {
  const rubrica = RUBRIQUES[_comentAssig];
  const alumne  = students.find(s => s.id == _comentAlumne);
  if (!rubrica || !alumne) return;

  // Comprova si hi ha objectius sense avaluar
  const sensAvaluar = rubrica.objectius
    .map((o, i) => _comentSeleccions[i] === undefined ? (i+1) + '. ' + o.nom : null)
    .filter(x => x);
  if (sensAvaluar.length > 0) {
    const msg = `Hi ha ${sensAvaluar.length} objectiu${sensAvaluar.length>1?'s':''} sense avaluar:\n\n` +
      sensAvaluar.map(s => '• ' + s).join('\n') +
      '\n\nVols generar el comentari igualment? (Es generarà amb els objectius avaluats)';
    if (!confirm(msg)) return;
  }

  const esborrany = _buildEsborrany(rubrica, alumne);
  const nomCurt   = alumne.nom.split(' ')[0];
  const article   = _articleNom(nomCurt, alumne.genere);

  // Si no hi ha clau Gemini → mostra l'esborrany directament
  if (!config.geminiKey) {
    _mostrarComentari(esborrany, rubrica, alumne, false);
    return;
  }

  // Mostra spinner al modal mentre la IA redacta
  document.getElementById('comentResultTitle').textContent = 'Generant…';
  document.getElementById('comentTextBox').innerHTML = '<div class="coment-loading"><div class="coment-spinner"></div>Gemini està redactant el comentari…</div>';
  document.getElementById('comentResultConsell').textContent = '';
  document.getElementById('comentResultOverlay').classList.add('open');

  const prompt = `Ets un mestre de 2n de Primària a Catalunya. Has de redactar el comentari de l'informe trimestral per a ${article}${nomCurt} per a l'àrea de ${rubrica.nom}.

Tens aquest esborrany amb totes les idees que cal incloure:

"""
${esborrany}
"""

Reescriu-lo com un ÚNIC PARÀGRAF cohesionat, natural i fluid. Segueix estrictament aquestes normes:
- Conserva TOTES les idees de l'esborrany, sense afegir-ne de noves ni eliminar-ne cap.
- Usa el nom ${article}${nomCurt} al principi i després pots dir "l'alumne/a" o ometre el subjecte.
- To professional i constructiu, adequat per a pares.
- Escriu en català correcte i natural.
- Longitud: 5-8 línies.
- Sense títol, encapçalament ni firma. Només el paràgraf.`;

  const _callGemini = async () => {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${config.geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const apiMsg = data?.error?.message || ('HTTP ' + res.status);
      const err = new Error(apiMsg);
      err.is429 = res.status === 429;
      err.status = res.status;
      throw err;
    }
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) throw new Error('Resposta buida');
    return text;
  };

  try {
    let text;
    try {
      text = await _callGemini();
    } catch(e) {
      if (e.is429) {
        // Límit de peticions: espera 4 segons i reintenta
        document.getElementById('comentTextBox').innerHTML =
          '<div class="coment-loading"><div class="coment-spinner"></div>Límit de peticions assolit, reintentant en 4 s…</div>';
        await new Promise(r => setTimeout(r, 4000));
        text = await _callGemini();
      } else throw e;
    }
    _mostrarComentari(text, rubrica, alumne, true);
  } catch(e) {
    _mostrarComentari(esborrany, rubrica, alumne, false);
    const msg = e.is429
      ? 'Gemini: massa peticions seguides. Espera uns segons i torna a intentar-ho.'
      : 'Error Gemini: ' + e.message;
    showToast(msg, 'error');
  }
}

// Retorna l'article català correcte: "en ", "la ", "l'"
function _articleNom(nom, genere) {
  if (!nom) return '';
  const primera = nom.charAt(0).toLowerCase();
  const vocals  = ['a','e','i','o','u','à','è','é','í','ò','ó','ú'];
  const muts    = ['h']; // h muda → també l'
  if (vocals.includes(primera) || muts.includes(primera)) return 'l\'';
  const g = (genere || 'm').toString().toLowerCase().charAt(0);
  return g === 'f' ? 'la ' : 'en ';
}

function copiarComentari() {
  const box = document.getElementById('comentTextBox');
  if (!box) return;
  const text = box.innerText || box.textContent;
  navigator.clipboard.writeText(text).then(() => showToast('Comentari copiat! ✓', 'success')).catch(() => {
    // Fallback per navegadors antics
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); document.body.removeChild(ta);
    showToast('Comentari copiat! ✓', 'success');
  });
}

function initComentaris() {
  // Omple el selector d'alumnes
  const sel = document.getElementById('comentAlumneSelect');
  if (!sel) return;
  sel.innerHTML = '<option value="">— Selecciona un alumne —</option>' +
    students.map(s => `<option value="${s.id}">${escapeHtml(s.nom)}</option>`).join('');
}
