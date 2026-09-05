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
let _currentPage = 'home';

// Pàgines que només tenen sentit si ets tutor/a d'un grup: la pàgina d'Alumnes
// (que treballa amb "els teus" alumnes) i la distribució de l'aula (un sol
// plànol de la teva classe). A l'app dels especialistes no hi surten.
const PAGINES_NOMES_TUTOR = ['alumnes', 'seients'];

// Pàgines que només són a l'app de direcció: el claustre de primària (qui
// tutoritza cada grup, qui coordina cada cicle). Als altres dos rols ni el
// botó del menú hi surt, però es tanca també aquí per si algú hi arriba per
// l'adreça (#docents) o pel botó d'enrere.
const PAGINES_NOMES_DIRECCIO = ['docents'];

function showPage(pageId, _fromPop) {
  if (typeof esEspecialista === 'function' && esEspecialista() && PAGINES_NOMES_TUTOR.indexOf(pageId) !== -1) {
    pageId = 'home';
  }
  if (!_rolDireccio() && PAGINES_NOMES_DIRECCIO.indexOf(pageId) !== -1) {
    pageId = 'home';
  }
  document.querySelectorAll('.page-content').forEach(p => p.classList.add('page-hidden'));
  document.getElementById('page-' + pageId).classList.remove('page-hidden');
  _currentPage = pageId;
  // Gestió de l'historial: si anem a una secció interna (no home) i no venim
  // del botó "enrere", afegim una entrada perquè el gest enrere torni a home.
  if (!_fromPop) {
    try {
      if (pageId !== 'home') {
        history.pushState({ page: pageId }, '', '#' + pageId);
      } else {
        // A home, substituïm l'estat (no acumulem entrades de home)
        history.replaceState({ page: 'home' }, '', '#home');
      }
    } catch(e) {}
  }
  // títol topbar fix: sempre "2n de Primària C"
  // nav-item actiu
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const match = [...document.querySelectorAll('.nav-item')].find(el =>
    el.getAttribute('onclick') && el.getAttribute('onclick').includes("'" + pageId + "'")
  );
  if (match) match.classList.add('active');
  closeSidebar();
  // Alumnes, Registres i Observacions són del grup SENCER. Si venim de les
  // notes d'una assignatura desdoblada, `students` només té mitja classe:
  // s'ha de tornar a posar la llista de la tutoria abans de pintar-les.
  // (A l'app dels especialistes això no fa res: no hi ha tutoria, i el grup
  // el tria ella amb el selector de dalt.)
  if (pageId === 'alumnes')      { if (typeof _restoreTutoriaStudents === 'function') _restoreTutoriaStudents(); if (typeof _dirRenderGrupPicker === 'function') _dirRenderGrupPicker(); renderAlumnesList(); }
  if (pageId === 'registres')    { if (typeof _restoreTutoriaStudents === 'function') _restoreTutoriaStudents(); _rolRenderGrupPicker('registres'); _dirAvisRegistres(); renderRegistre(); }
  if (pageId === 'observacions') { if (typeof _restoreTutoriaStudents === 'function') _restoreTutoriaStudents(); _rolRenderGrupPicker('observacions'); _dirAvisObservacions(); if (typeof _perfilRenderObsSelector === 'function') _perfilRenderObsSelector(); renderObsGrid(); }
  if (pageId === 'home')         renderHome();
  if (pageId === 'planning')     renderPlanning();
  if (pageId === 'assoliments')  { _initAssolimentsPage(); }
  if (pageId === 'comentaris')   { initComentaris(); renderComentRubrica(); }
  if (pageId === 'grups')        initGrups();
  if (pageId === 'seients')      initSeients();
  if (pageId === 'postits')      initPostits();
  if (pageId === 'reunions')     { if (typeof initReunions === 'function') initReunions(); }
  if (pageId === 'perfil')       initPerfil();
  if (pageId === 'calendari')    { renderCalendari(); }
  if (pageId === 'tasques')      renderTasques();
  if (pageId === 'horari')       { if (typeof initHorari === 'function') initHorari(); }
  if (pageId === 'docents')      { if (typeof initDocents === 'function') initDocents(); }
}

function showFitxa(studentId, _fromPop) {
  currentFitxaStudentId = studentId;
  const s = students.find(x => x.id === studentId);
  if (!s) return;
  document.getElementById('fitxaAvatar').textContent = getInitials(s.nom);
  document.getElementById('fitxaNom').textContent    = s.nom;
  // títol topbar fix — no canviar
  document.querySelectorAll('.page-content').forEach(p => p.classList.add('page-hidden'));
  document.getElementById('page-fitxa').classList.remove('page-hidden');
  _currentPage = 'fitxa';
  if (!_fromPop) {
    try { history.pushState({ page: 'fitxa', studentId }, '', '#fitxa'); } catch(e) {}
  }
  closeSidebar();
  renderFitxa(studentId);
}

// Tanca qualsevol modal/panell/menú obert. Retorna true si n'ha tancat algun.
function _tancaObertsPerEnrere() {
  // Menú lateral obert
  const sidebar = document.querySelector('.sidebar.open, #sidebar.open');
  if (sidebar) { if (typeof closeSidebar === 'function') closeSidebar(); return true; }
  // Qualsevol modal-overlay obert (el darrer obert primer)
  const oberts = [...document.querySelectorAll('.modal-overlay.open, .panel-overlay.open')];
  if (oberts.length) {
    const ultim = oberts[oberts.length - 1];
    ultim.classList.remove('open');
    return true;
  }
  return false;
}

// Gestor del botó/gest "enrere" del mòbil
function _onPopState(e) {
  // 1) Si hi ha coses obertes (modals, menú), tanca-les primer i no naveguis
  if (_tancaObertsPerEnrere()) {
    // Reposem una entrada perquè el següent "enrere" torni a funcionar
    try { history.pushState({ page: _currentPage }, '', '#' + _currentPage); } catch(err) {}
    return;
  }
  // 2) Determina on tornar segons l'estat de l'historial
  const st = e.state || {};
  const desti = st.page || 'home';
  if (desti === 'fitxa' && st.studentId != null) {
    showFitxa(st.studentId, true);
  } else if (desti === 'docents') {
    // Docents té eines a dins (llistat, coordinació): l'enrere ha de tornar
    // a la portada de l'apartat, no fer-ne fora d'una revolada.
    showPage('docents', true);
    if (typeof docentsVista === 'function') docentsVista(st.vista || 'hub', true);
  } else if (desti === 'home') {
    // Ja tornem a home (o hi som): mostra home sense afegir historial
    showPage('home', true);
  } else {
    showPage(desti, true);
  }
}

// Inicialitza la gestió d'historial (crida-ho un cop a l'arrencada)
function _initHistoryNav() {
  try {
    // Estat inicial = home
    history.replaceState({ page: 'home' }, '', '#home');
  } catch(e) {}
  window.addEventListener('popstate', _onPopState);
}

/* ============================================================
   SIDEBAR
   ============================================================ */
function toggleNavSection(name) {
  const items = document.getElementById(name + 'Items');
  const toggle = document.getElementById(name + 'Toggle');
  if (!items || !toggle) return;
  const collapsed = items.classList.toggle('collapsed');
  toggle.classList.toggle('collapsed', collapsed);
}

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
// Assignatures per a PI/AM
const PIAM_ASSIGS = ['Matemàtiques','Català','Castellà','Medi','Anglès','Música','Ed. Física','Plàstica'];
let _piAssigs = [];  // assignatures marcades amb PI
let _amAssigs = [];  // assignatures marcades amb AM

function fillPersonalForm(d) {
  // El gènere: l'única dada de l'alumne que es tria aquí. La resta ve dels
  // documents de l'escola i només es mostra.
  var g = document.getElementById('pGenere');
  if (g) {
    var st = students.filter(function (x) { return x.id === currentPersonalStudentId; })[0];
    g.value = (st && st.genere === 'f') ? 'f' : 'm';
  }
  document.getElementById('pMare').value      = d.mare      || '';
  document.getElementById('pPare').value      = d.pare      || '';
  document.getElementById('pEmailMare').value = d.emailMare || '';
  document.getElementById('pEmailPare').value = d.emailPare || '';
  document.getElementById('pObs').value       = d.obs       || '';
  document.getElementById('pEspecific').value = d.especific || '';

  // Informe de l'EAP
  const eap = d.eap || '';
  document.getElementById('pEAPCheck').checked = !!(eap && eap.trim());
  document.getElementById('pEAP').value = eap;
  document.getElementById('pEAPWrap').style.display = (eap && eap.trim()) ? 'block' : 'none';

  // Condicions de seient
  const seient = d.seient || {};
  document.getElementById('pSeatMestre').checked   = !!seient.mestre;
  document.getElementById('pSeatPorta').checked    = !!seient.llunyPorta;
  document.getElementById('pSeatFinestra').checked = !!seient.llunyFinestra;
  document.getElementById('pSeatFixat').checked    = !!seient.fixat;
  _toggleSeatFixat();
  // Companys incompatibles: desats per rowId, els convertim a id actual
  _seatIncompatibles = [];
  if (seient.noAmb && seient.noAmb.length) {
    seient.noAmb.forEach(rowId => {
      const comp = students.find(s => {
        const sRow = (personal[s.id] && personal[s.id].rowId) || s.rowId;
        return String(sRow) === String(rowId);
      });
      if (comp) _seatIncompatibles.push(comp.id);
    });
  }
  _renderIncompatibles();

  // PI / AM: la cadena guardada és una llista d'assignatures separades per '|'
  _piAssigs = d.pi ? d.pi.split('|').filter(Boolean) : [];
  _amAssigs = d.am ? d.am.split('|').filter(Boolean) : [];
  document.getElementById('pPICheck').checked = _piAssigs.length > 0;
  document.getElementById('pAMCheck').checked = _amAssigs.length > 0;
  document.getElementById('pPIAssigWrap').style.display = _piAssigs.length > 0 ? 'block' : 'none';
  document.getElementById('pAMAssigWrap').style.display = _amAssigs.length > 0 ? 'block' : 'none';
  _renderPIAMAssigs('pi');
  _renderPIAMAssigs('am');
}

function _togglePIAM(tipus) {
  const checked = document.getElementById(tipus === 'pi' ? 'pPICheck' : 'pAMCheck').checked;
  document.getElementById(tipus === 'pi' ? 'pPIAssigWrap' : 'pAMAssigWrap').style.display = checked ? 'block' : 'none';
  if (!checked) { // desmarcar → buida les assignatures
    if (tipus === 'pi') _piAssigs = []; else _amAssigs = [];
  }
  _renderPIAMAssigs(tipus);
}

function _toggleEAP() {
  const checked = document.getElementById('pEAPCheck').checked;
  document.getElementById('pEAPWrap').style.display = checked ? 'block' : 'none';
  if (!checked) document.getElementById('pEAP').value = '';
}

function _toggleSeatFixat() {
  const checked = document.getElementById('pSeatFixat').checked;
  const hint = document.getElementById('pSeatFixatHint');
  if (hint) hint.style.display = checked ? 'block' : 'none';
}

// Companys amb qui l'alumne actual no pot seure (llista d'ids)
let _seatIncompatibles = [];

// Renderitza les etiquetes i el selector de companys incompatibles
function _renderIncompatibles() {
  const cont = document.getElementById('pSeatIncompatibles');
  const sel = document.getElementById('pSeatIncompatSel');
  if (!cont || !sel) return;
  const currentId = currentPersonalStudentId;

  // Etiquetes dels ja seleccionats
  cont.innerHTML = _seatIncompatibles.map(id => {
    const s = students.find(x => x.id === id);
    const nom = s ? s.nom : '(?)';
    return `<span class="seient-incompat-tag">${escapeHtml(nom)}<button type="button" onclick="_treureIncompatible(${id})" title="Treure">×</button></span>`;
  }).join('');

  // Opcions del selector: tots els companys menys ell mateix i els ja triats
  const opcions = students
    .filter(s => s.id !== currentId && !_seatIncompatibles.includes(s.id))
    .map(s => `<option value="${s.id}">${escapeHtml(s.nom)}</option>`)
    .join('');
  sel.innerHTML = '<option value="">+ Afegir company…</option>' + opcions;
}

function _afegirIncompatible() {
  const sel = document.getElementById('pSeatIncompatSel');
  const id = parseInt(sel.value);
  if (isNaN(id)) return;
  if (!_seatIncompatibles.includes(id)) _seatIncompatibles.push(id);
  _renderIncompatibles();
}

function _treureIncompatible(id) {
  _seatIncompatibles = _seatIncompatibles.filter(x => x !== id);
  _renderIncompatibles();
}

// Assignatures per a PI/AM segons el curs de l'alumne que s'està editant.
// El curs es dedueix del grup carregat (tutoria o el grup en edició).
function _piamAssigsDelCurs() {
  // Grup actual: el de tutoria o l'últim grup carregat
  let grup = null;
  if (typeof _tutoriaGrup !== 'undefined' && _tutoriaGrup) grup = _tutoriaGrup;
  if (typeof _grupStudentsCarregat !== 'undefined' && _grupStudentsCarregat) {
    const g = _grupStudentsCarregat.split('|')[0];
    if (g) grup = g;
  }
  if (grup) {
    const curs = grup.split(' ')[0]; // "4t B" → "4t"
    if (typeof PERFIL_ASSIGS_PER_CURS !== 'undefined' && PERFIL_ASSIGS_PER_CURS[curs]) {
      return PERFIL_ASSIGS_PER_CURS[curs];
    }
  }
  // Reserva: llista genèrica
  return PIAM_ASSIGS;
}

function _renderPIAMAssigs(tipus) {
  const wrap = document.getElementById(tipus === 'pi' ? 'pPIAssigs' : 'pAMAssigs');
  if (!wrap) return;
  const sel = tipus === 'pi' ? _piAssigs : _amAssigs;
  const assigs = _piamAssigsDelCurs();
  wrap.innerHTML = assigs.map(a =>
    `<button type="button" class="pi-am-assig-btn ${sel.includes(a)?'active':''}" onclick="_togglePIAMAssig('${tipus}','${a.replace(/'/g,"\\'")}')">${a}</button>`
  ).join('');
}

function _togglePIAMAssig(tipus, assig) {
  const sel = tipus === 'pi' ? _piAssigs : _amAssigs;
  const idx = sel.indexOf(assig);
  if (idx === -1) sel.push(assig); else sel.splice(idx, 1);
  _renderPIAMAssigs(tipus);
}
function closePersonalDrawer() {
  document.getElementById('personalOverlay').classList.remove('open');
  document.body.style.overflow = '';
  currentPersonalStudentId = null;
}
/* El botó "Dades de contacte alumnes" encara no té document. Però un botó
   que no fa res és el pitjor que hi pot haver: la mestra hi clica, no passa
   res, i deixa de fiar-se de tota l'app. O sigui que, mentre no en tingui,
   diu que no en té. */
function _dadesContacte() {
  const msg = 'Aquest botó encara no té document. Digues-li al Pol quin ha de ser i l\'hi posem.';
  if (typeof showToast === 'function') showToast(msg, 'info');
  else alert(msg);
}

/* Treu l alumne des del calaix. És el mateix esborrat de sempre; només
   canvia des d on es demana, perquè el botó de "Gestionar alumnes" ja no hi
   és. */
async function _esborraDesDelCalaix() {
  const id = currentPersonalStudentId;
  const st = students.filter(function (x) { return x.id === id; })[0];
  const nom = st ? st.nom : "aquest alumne";
  if (!confirm('Treure ' + nom + ' de la llista?\n\nPerdràs les seves observacions i entrevistes, i no es pot desfer.')) return;
  if (typeof closePersonalDrawer === "function") closePersonalDrawer();
  await deleteStudent(id);
}

async function savePersonalDrawer() {
  const id    = currentPersonalStudentId;
  // El gènere es desa amb la llista d alumnes, no amb les dades del full.
  const gSel = document.getElementById("pGenere");
  if (gSel) {
    const st = students.filter(function (x) { return x.id === id; })[0];
    if (st && st.genere !== gSel.value) { st.genere = gSel.value; try { await saveStudents(); } catch (e) {} }
  }
  const dades = {
    mare:      document.getElementById('pMare').value.trim(),
    pare:      document.getElementById('pPare').value.trim(),
    emailMare: document.getElementById('pEmailMare').value.trim(),
    emailPare: document.getElementById('pEmailPare').value.trim(),
    obs:       document.getElementById('pObs').value.trim(),
    pi:        document.getElementById('pPICheck').checked ? _piAssigs.join('|') : '',
    am:        document.getElementById('pAMCheck').checked ? _amAssigs.join('|') : '',
    especific: document.getElementById('pEspecific').value.trim(),
    eap:       document.getElementById('pEAPCheck').checked ? document.getElementById('pEAP').value.trim() : '',
    seient: {
      mestre:        document.getElementById('pSeatMestre').checked,
      llunyPorta:    document.getElementById('pSeatPorta').checked,
      llunyFinestra: document.getElementById('pSeatFinestra').checked,
      fixat:         document.getElementById('pSeatFixat').checked,
      noAmb:         _seatIncompatibles.map(cid => {
        const c = students.find(s => s.id === cid);
        return (c && ((personal[c.id] && personal[c.id].rowId) || c.rowId)) || cid;
      }),
    },
  };
  // Conserva camps que no s'editen al drawer (rowId, dataNaix del full grups)
  const prev = personal[id] || {};
  dades.rowId = prev.rowId;
  dades.dataNaix = prev.dataNaix;
  personal[id] = dades;
  // Tanca la finestra i torna a la pàgina de gestió d'alumnes
  closePersonalDrawer();
  // Refresca fitxa si és oberta
  if (currentFitxaStudentId === id) renderFitxa(id);
  renderAlumnesList();
  if (config.scriptUrl) {
    try {
      const s2 = students.find(x => x.id === id);
      const rowId = (personal[id] && personal[id].rowId) || (s2 && s2.rowId) || id;
      let r;
      // Si treballem amb el grup de tutoria del full "grups", desa allà
      if (typeof _tutoriaGrup !== 'undefined' && _tutoriaGrup) {
        // conserva el rowId a personal per a properes desades
        personal[id].rowId = rowId;
        r = await appsScriptPost({ action: 'saveGrupPersonal', grup: _tutoriaGrup, rowId: rowId, dades });
      } else {
        r = await appsScriptPost({ action: 'savePersonal', studentId: rowId, dades });
      }
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
  if (typeof _perfilRenderObsSelector === 'function') _perfilRenderObsSelector();
  const sel = document.getElementById('obsAlumne');
  sel.innerHTML = students.map(s =>
    `<option value="${s.id}" ${s.id === studentId ? 'selected' : ''}>${escapeHtml(s.nom)}</option>`
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
function openConfig() { document.getElementById('cfgScriptUrl').value = config.scriptUrl || ''; const gk = document.getElementById('cfgGeminiKey'); if(gk) gk.value = config.geminiKey || ''; document.getElementById('configOverlay').classList.add('open'); _renderNotifStatus(); _loadGrupsSheetCfg(); }

// Obre els fulls de càlcul construint la URL des dels IDs guardats localment
// (mai hardcodejats al codi públic).
function _obreFull(id, event) {
  if (event) event.preventDefault();
  if (!id) { showToast('Configura primer l\'enllaç del full a la configuració', 'error'); return false; }
  window.open('https://docs.google.com/spreadsheets/d/' + id + '/edit', '_blank');
  return false;
}
function _obreFullPrincipal(event) {
  // El full principal és el que conté el teu Apps Script; guardem el seu ID a config
  return _obreFull(config.mainSheetId || localStorage.getItem('main_sheet_id') || '', event);
}
function _obreFullGrups(event) {
  return _obreFull(config.grupsSheetId || localStorage.getItem('grups_sheet_id_local') || '', event);
}
function _obreFullDesdob(event) {
  return _obreFull(config.desdobSheetId || localStorage.getItem('desdob_sheet_id_local') || '', event);
}
async function _loadGrupsSheetCfg() {
  if (!config.scriptUrl) return;
  try {
    const rM = await appsScriptGet({ action: 'getMainSheetId' });
    if (rM.ok && rM.id) {
      config.mainSheetId = rM.id;
      try { localStorage.setItem('main_sheet_id', rM.id); } catch(e) {}
    }
  } catch(e) {}
  try {
    const r = await appsScriptGet({ action: 'getGrupsSheetId' });
    const el = document.getElementById('cfgGrupsSheet');
    if (r.ok && r.id) {
      if (el) el.value = r.id;
      config.grupsSheetId = r.id;
      try { localStorage.setItem('grups_sheet_id_local', r.id); } catch(e) {}
    }
  } catch(e) {}
  try {
    const r2 = await appsScriptGet({ action: 'getDesdobSheetId' });
    const el2 = document.getElementById('cfgDesdobSheet');
    if (r2.ok && r2.id) {
      if (el2) el2.value = r2.id;
      config.desdobSheetId = r2.id;
      try { localStorage.setItem('desdob_sheet_id_local', r2.id); } catch(e) {}
    }
  } catch(e) {}
  _actualitzaEnllacosFulls();
}

// Actualitza el text i estat dels enllaços als fulls (sense exposar IDs al codi)
function _actualitzaEnllacosFulls() {
  const l1 = document.getElementById('linkFullPrincipal');
  if (l1) l1.textContent = 'Full de càlcul';
  const l2 = document.getElementById('linkFullGrups');
  const l3 = document.getElementById('linkFullDesdob');
  // El text ja és a l'HTML; aquí només ens assegurem que els botons hi són
}
function closeConfig() { document.getElementById('configOverlay').classList.remove('open'); }
// Extreu l'ID d'un enllaç de Google Sheets (o accepta l'ID directament)
function _extractSheetId(input) {
  if (!input) return '';
  const s = input.trim();
  const m = s.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  return s; // ja és un ID
}

async function diagGrupsSheet() {
  if (!config.scriptUrl) { showToast('Primer configura la connexió', 'error'); return; }
  const res = document.getElementById('diagGrupsResult');
  const btn = document.getElementById('diagGrupsBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Comprovant…'; }
  res.textContent = 'Comprovant accés al full "Grups"…';
  try {
    const r = await appsScriptGet({ action: 'diagGrups' });
    if (r.ok) {
      res.innerHTML = `✅ Accés correcte al full <strong>"${escapeHtml(r.nom)}"</strong>.<br>Pestanyes: ${r.pestanyes.length} (${r.pestanyes.slice(0,6).map(escapeHtml).join(', ')}${r.pestanyes.length>6?'…':''})`;
      res.style.color = '#166534';
    } else {
      res.innerHTML = `⚠ ${escapeHtml(r.error || 'error desconegut')}`;
      res.style.color = '#B91C1C';
    }
  } catch(e) {
    res.innerHTML = '⚠ Error: ' + escapeHtml(e.message);
    res.style.color = '#B91C1C';
  }
  if (btn) { btn.disabled = false; btn.textContent = 'Comprovar accés'; }
}

async function saveGrupsSheetCfg() {
  if (!config.scriptUrl) { showToast('Primer configura la connexio', 'error'); return; }
  const rawG = document.getElementById('cfgGrupsSheet').value.trim();
  const rawD = document.getElementById('cfgDesdobSheet').value.trim();
  const idG = rawG ? _extractSheetId(rawG) : null;
  const idD = rawD ? _extractSheetId(rawD) : null;
  if (!idG && !idD) { showToast('Enganxa almenys un enllac', 'error'); return; }
  const btn = document.getElementById('saveGrupsSheetBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Desant...'; }
  let oks = [];
  try {
    if (idG) {
      const r = await appsScriptPost({ action: 'saveGrupsSheetId', id: idG });
      if (r.ok) { oks.push('grups'); config.grupsSheetId = idG; try { localStorage.setItem('grups_sheet_id_local', idG); } catch(e){} }
    }
    if (idD) {
      const r2 = await appsScriptPost({ action: 'saveDesdobSheetId', id: idD });
      if (r2.ok) { oks.push('desdoblaments'); config.desdobSheetId = idD; try { localStorage.setItem('desdob_sheet_id_local', idD); } catch(e){} }
    }
    if (oks.length) showToast('Fulls desats: ' + oks.join(' i ') + ' \u2713', 'success');
    else showToast('No s\'ha pogut desar cap full', 'error');
  } catch(e) {
    showToast('Error desant: ' + e.message, 'error');
  }
  if (btn) { btn.disabled = false; btn.textContent = 'Desar fulls'; }
}

async function setupGrupsSheets() {
  if (!config.scriptUrl) { showToast('Primer configura la connexió', 'error'); return; }
  const btn = document.getElementById('setupGrupsBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Creant…'; }
  try {
    const r = await appsScriptPost({ action: 'setupGrups' });
    if (r.ok) {
      const nous = r.creats && r.creats.length ? r.creats.length : 0;
      showToast(nous ? `${nous} pestanyes creades ✓` : 'Les pestanyes ja existien', 'success');
    } else {
      showToast('Error: ' + (r.error || 'desconegut'), 'error');
    }
  } catch(e) {
    showToast('Error creant les pestanyes: ' + e.message, 'error');
  }
  if (btn) { btn.disabled = false; btn.textContent = 'Crear les pestanyes de grup'; }
}

async function ajustarColumnesSheets() {
  if (!config.scriptUrl) { showToast('Primer configura la connexió', 'error'); return; }
  const btn = document.getElementById('ajustarColumnesBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Ajustant…'; }
  try {
    const r = await appsScriptPost({ action: 'ajustarColumnes' });
    if (r.ok !== false) {
      showToast(`${r.ajustats || 0} fulls ajustats ✓`, 'success');
    } else {
      showToast('Error: ' + (r.error || 'desconegut'), 'error');
    }
  } catch(e) {
    showToast('Error ajustant les columnes: ' + e.message, 'error');
  }
  if (btn) { btn.disabled = false; btn.textContent = 'Ajustar amplada columnes'; }
}

async function protegirFullsSheets() {
  if (!config.scriptUrl) { showToast('Primer configura la connexió', 'error'); return; }
  const btn = document.getElementById('protegirFullsBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Protegint…'; }
  try {
    const r = await appsScriptPost({ action: 'protegirFulls' });
    if (r.ok !== false) {
      const total = (r.personal||0) + (r.grups||0) + (r.desdob||0);
      showToast(`${total} fulls protegits ✓`, 'success');
    } else {
      showToast('Error: ' + (r.error || 'desconegut'), 'error');
    }
  } catch(e) {
    showToast('Error protegint els fulls: ' + e.message, 'error');
  }
  if (btn) { btn.disabled = false; btn.textContent = 'Protegir tots els fulls'; }
}

function saveConfig() {
  const url       = document.getElementById('cfgScriptUrl').value.trim();
  const geminiKey = document.getElementById('cfgGeminiKey')?.value.trim() || '';
  // Validació amb missatges específics
  if (!url) { showToast('Enganxa la URL del Web App', 'error'); return; }
  if (!url.includes('script.google.com')) {
    showToast('Aquesta no és una URL de Google Apps Script. Ha de començar per https://script.google.com/…', 'error');
    return;
  }
  if (!url.endsWith('/exec')) {
    showToast('La URL ha d\'acabar en /exec. Assegura\'t de copiar la URL del desplegament (Implementa → Web App), no la de l\'editor.', 'error');
    return;
  }
  config = { scriptUrl: url };
  if (geminiKey) config.geminiKey = geminiKey;
  localStorage.setItem('vedruna_cfg', JSON.stringify(config));
  closeConfig();
  showToast('Connectant…', 'success');
  // Posada en marxa automàtica: crea pestanyes, protegeix i ajusta (un sol cop)
  _autoSetupInicial().then(() => loadAll());
}

// Fa tota la posada en marxa automàticament, sense que el mestre cliqui res.
// Es marca a localStorage perquè no es repeteixi a cada connexió.
async function _autoSetupInicial(forcar) {
  if (!config.scriptUrl) return;
  const fet = localStorage.getItem('vedruna_autosetup_fet');
  if (fet && !forcar) return; // ja s'ha fet en aquest dispositiu
  try {
    // 1) Crear les pestanyes de grup si no existeixen
    await appsScriptPost({ action: 'setupGrups' });
    // 2) Protegir tots els fulls
    await appsScriptPost({ action: 'protegirFulls' });
    // 3) Ajustar amplada de columnes
    await appsScriptPost({ action: 'ajustarColumnes' });
    localStorage.setItem('vedruna_autosetup_fet', '1');
  } catch(e) {
    // Silenciós: si falla, es pot reintentar; no bloqueja l'app
  }
}
/* El mateix modal serveix per als dos registres: el d'aula (files = alumnes)
   i el de docents de l'app de direcció (files = mestres). Nomes canvia on va
   a parar l'item i els textos que parlen d'alumnes. */
let _newItemDesti = 'aula';

function openNewItemModal(desti) {
  _newItemDesti = (desti === 'docents') ? 'docents' : 'aula';
  const doc = _newItemDesti === 'docents';
  const sub = document.getElementById('newItemSub');
  if (sub) sub.textContent = doc
    ? 'Es crearà una nova columna al registre de docents'
    : 'Es crearà una nova columna al full «Registres d\'aula»';
  const perA = doc ? 'per cada docent' : 'per cada alumne';
  const cb = document.getElementById('newItemSubCasella');
  if (cb) cb.textContent = 'Sí / No ' + perA;
  document.getElementById('newItemName').value = '';
  selectTypeByValue('checkbox');
  document.getElementById('newItemOverlay').classList.add('open');
  setTimeout(() => document.getElementById('newItemName').focus(), 100);
}

// El botó "Crear ítem" del modal: cadascú al seu registre.
function newItemCrear() {
  if (_newItemDesti === 'docents' && typeof regdocAfegeixItem === 'function') return regdocAfegeixItem();
  return addRegistreItem();
}
function closeNewItemModal() { document.getElementById('newItemOverlay').classList.remove('open'); }

/* ============================================================
   API
   ============================================================ */
// Token de seguretat: es llegeix de js/config.local.js (window.APP_TOKEN),
// un fitxer que NO se substitueix en actualitzar l'app, així no l'has de
// tornar a posar mai. Ha de coincidir amb el token de les propietats del
// Code.gs (clau APP_TOKEN). És una cadena que TU inventes, no és cap
// credencial de Google (per això és segur al codi; GitHub no el bloqueja).
const APP_TOKEN = (typeof window !== 'undefined' && window.APP_TOKEN) ? window.APP_TOKEN : '';

// La clau de Gemini viu al backend (Apps Script), MAI al codi públic.
// Les crides a Gemini es fan a través del backend (acció 'gemini').
// Si un mestre configura una clau pròpia al dispositiu, s'usa directament.
function _getGeminiKey() {
  return (config.geminiKey && config.geminiKey.trim()) ? config.geminiKey.trim() : '';
}

// Genera text amb Gemini. Si hi ha clau local la fa servir directament;
// si no, passa la petició pel backend (que té la clau compartida).
// Retorna el text generat o llança un error (amb .is429 si és límit de quota).
// Detecta si l'error de Gemini es "model saturat" (Google respon en angles:
// "high demand", "overloaded", "UNAVAILABLE", HTTP 503). Es temporal: reintentant
// sol funcionar, per aixo es tracta diferent d'un error de debo.
function _geminiEsSaturat(msg) {
  return /high demand|overload|unavailable|try again later|503/i.test(String(msg || ''));
}

async function _geminiGenerate(prompt) {
  const localKey = _getGeminiKey();
  if (localKey) {
    // Crida directa amb la clau del dispositiu
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${localKey}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data?.error?.message || ('HTTP ' + res.status));
      err.is429  = res.status === 429;
      err.isBusy = res.status === 503 || _geminiEsSaturat(err.message);
      throw err;
    }
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) throw new Error('Resposta buida');
    return text;
  }
  // Sense clau local: via backend
  const r = await appsScriptPost({ action: 'gemini', prompt });
  if (!r || r.ok === false) {
    const err = new Error((r && r.error) || 'Error de Gemini');
    err.is429  = !!(r && r.is429);
    err.isBusy = _geminiEsSaturat(err.message);
    throw err;
  }
  return r.text;
}

/* ============================================================
   NO DEMANIS DUES VEGADES EL MATEIX
   ------------------------------------------------------------
   Cada crida al servidor de Google són uns quants segons, i n'hi ha que
   es demanen una vegada i una altra: la mestra va i torna entre els grups
   de Tallers per mirar si les llistes estan bé, i cada tornada tornava a
   esperar el mateix que ja havia esperat.

   Dues coses, i les dues només per a LECTURES:

   · Si la MATEIXA petició ja està en marxa, no se'n fa una altra: s'espera
     la que hi ha. Això sol ja mata el mal de clicar tres vegades el mateix
     botó —les tres esperen la mateixa resposta.
   · I la resposta es guarda un minut. Tornar a un grup que acabes de mirar
     és instantani.

   NOMÉS lectures, i NOMÉS un minut: aquests fulls els comparteix tota
   l'escola i ensenyar dades velles seria pitjor que anar lent. I qualsevol
   cosa que ESCRIU (`appsScriptPost`) buida el guardat de cop, perquè just
   després de desar no es pugui veure el d'abans.
   ============================================================ */
const _GET_ES_LECTURA = new Set([
  'getGrupAlumnes', 'getDesdobGrup', 'getGrupObs', 'getRegistre',
  'getDesdoblament', 'getDesdoblaments', 'getGrupsCurs'
]);
const _GET_DURA = 60000;            // 1 minut
const _getGuardat = new Map();      // clau → { ts, dades }
const _getEnMarxa = new Map();      // clau → promesa que encara no ha tornat

function _oblidaLectures() { _getGuardat.clear(); }

async function appsScriptGet(params, _retry = true) {
  const clau = JSON.stringify(params);
  const esLectura = _GET_ES_LECTURA.has(params.action);

  if (esLectura) {
    const g = _getGuardat.get(clau);
    if (g && Date.now() - g.ts < _GET_DURA) {
      /* Còpia: qui ho rep de vegades hi escriu a sobre, i no ha de tocar
         el que tenim guardat per als altres. */
      try { return JSON.parse(JSON.stringify(g.dades)); } catch (e) { return g.dades; }
    }
  }
  const jaHiVa = _getEnMarxa.get(clau);
  if (jaHiVa) return jaHiVa;

  const p = _appsScriptGetXarxa(params, _retry).then(r => {
    if (esLectura && r && r.ok) _getGuardat.set(clau, { ts: Date.now(), dades: r });
    return r;
  }).finally(() => { _getEnMarxa.delete(clau); });

  _getEnMarxa.set(clau, p);
  return p;
}

/* Envolta qualsevol crida al servidor amb el que s'ha de veure mentre dura:
   la ratlla de dalt sempre, i el vel només si la mestra acaba de clicar (o
   sigui, si està esperant de cara). Tot passa per aquí, i per això no cal
   anar posant-ho botó per botó: hi entren tots, també els de demà. */
function _ambSenyalDEspera(fer, text) {
  if (typeof _ocupatEntra === 'function') _ocupatEntra();
  let p = (async () => {
    try { return await fer(); }
    finally { if (typeof _ocupatSurt === 'function') _ocupatSurt(); }
  })();
  if (typeof _veniaDUnClic === 'function' && typeof esperaVisual === 'function' && _veniaDUnClic()) {
    p = esperaVisual(p, text);
  }
  return p;
}

async function _appsScriptGetXarxa(params, _retry = true) {
  return _ambSenyalDEspera(() => _appsScriptGetFetch(params, _retry), 'Carregant…');
}

async function _appsScriptGetFetch(params, _retry = true) {
  const url = new URL(config.scriptUrl);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  if (APP_TOKEN) url.searchParams.set('token', APP_TOKEN);
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 45000); // 45s timeout
  try {
    const res = await fetch(url.toString(), { signal: ctrl.signal });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } catch (e) {
    // Reintent automàtic: la 1a crida a Apps Script pot fallar si estava "adormit"
    if (_retry) {
      clearTimeout(timeout);
      await new Promise(r => setTimeout(r, 1500));
      // Va al fetch directament, no a `appsScriptGet`: si hi tornés, es
      // trobaria la seva pròpia crida "en marxa" i s'esperaria a si mateixa.
      return _appsScriptGetFetch(params, false); // segon intent sense més reintents
    }
    // Error final: retorna un objecte segur (mai llança) perquè cap crida peti l'app
    return { ok: false, error: (e && e.message) || 'Error de connexió', _networkError: true };
  } finally { clearTimeout(timeout); }
}
/* Escriptures que NO toquen res del que llegim dels fulls compartits: no cal
   llençar el guardat. `saveProfile` és el cas que importa —desar quin grup
   estàs mirant no canvia cap llista d'alumnes— i si no fos aquí, cada canvi
   de grup buidaria el guardat i tornar enrere tornaria a esperar. */
const _POST_NO_TOCA_LECTURES = new Set(['saveProfile']);

async function appsScriptPost(body, _retry = true) {
  // Acabem d'escriure: el que teníem guardat pot haver quedat vell.
  if (!_POST_NO_TOCA_LECTURES.has(body && body.action)) _oblidaLectures();
  return _ambSenyalDEspera(() => _appsScriptPostFetch(body, _retry), 'Desant…');
}

async function _appsScriptPostFetch(body, _retry = true) {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 45000);
  try {
    const bodyAmbToken = APP_TOKEN ? Object.assign({}, body, { token: APP_TOKEN }) : body;
    const res = await fetch(config.scriptUrl, { method: 'POST', body: JSON.stringify(bodyAmbToken), signal: ctrl.signal });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } catch (e) {
    if (_retry) {
      clearTimeout(timeout);
      await new Promise(r => setTimeout(r, 1500));
      return _appsScriptPostFetch(body, false);
    }
    throw e;
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
  if (isVisible('assoliments'))  renderAssoliments();
  if (isVisible('calendari'))    renderCalendari();
  if (isVisible('fitxa') && currentFitxaStudentId !== null) renderFitxa(currentFitxaStudentId);
  if (document.getElementById('panelOverlay').classList.contains('open')) renderPanelStudents(students);
  if (isVisible('comentaris')) initComentaris();
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
  /* I d'aquí surt si l'arrencada s'ha de tapar o no. Si el cache ha pintat,
     l'app JA es veu plena: tapar-la seria bloquejar-la per res i faria l'efecte
     contrari, semblar més lenta. Si NO ha pintat —el primer cop, un ordinador
     nou, o just després d'una versió nova— tot són pantalles buides: la mestra
     obriria apartats i els trobaria sense res, que és exactament el que fa
     pensar que l'app està espatllada. Llavors sí que s'espera. */
  const _hiHaviaDades = _loadMainFromCache();
  if (_hiHaviaDades) {
    document.getElementById('setupBanner').style.display = 'none';
    _paintAllViews();
    updateSync('syncing', 'Actualitzant…');
  } else {
    updateSync('syncing', 'Sincronitzant…');
  }

  // 2) UNA SOLA CRIDA que ho porta TOT (bootstrap): dades principals, planning,
  //    tasques, calendari, assoliments, perfil, IDs dels fulls i alumnes del
  //    grup de tutoria. Substitueix 5-7 crides encadenades → molt més ràpid.
  try {
    const weekIds = [getPlanWeekId(-1), getPlanWeekId(0), getPlanWeekId(1)];
    let _peticio = appsScriptGet({ action: 'bootstrap', weekIds: JSON.stringify(weekIds) });
    /* Arrencada amb l'app buida: es tapa. Ningú no ha clicat res —o sigui que
       el vel no sortiria sol— però és el moment en què més fàcil és pensar que
       està espatllada, perquè tot es veu buit. */
    if (!_hiHaviaDades && typeof esperaVisual === 'function') {
      _peticio = esperaVisual(_peticio, 'Carregant les teves dades…');
    }
    const boot = await _peticio;

    // Error d'autorització: el token no coincideix
    if (boot && boot._authError) {
      updateSync('error', 'No autoritzat');
      _mostraErrorConnexio('auth');
      return;
    }
    // Error de xarxa: no s'ha pogut arribar al servidor
    if (boot && boot._networkError) {
      updateSync('error', 'Sense connexió');
      if (!students.length) _mostraErrorConnexio('network');
      return;
    }
    if (boot.ok) {
      _applyBootstrap(boot);
    } else {
      // Resposta rebuda però amb error del backend
      updateSync('error', 'Error');
      if (!students.length) _mostraErrorConnexio('backend', boot && boot.error);
      return;
    }

    _saveMainToCache(); // desa per a la propera arrencada instantània
    updateSync('ok', 'Sincronitzat'); updateStatSync();
    document.getElementById('setupBanner').style.display = 'none';
    _paintAllViews();

    // A l'app de direcció el bootstrap no porta cap grup (no en tenen de
    // tutoria): es torna a obrir el que miraven l'últim cop.
    if (_rolDireccio() && _dirGrup()) _dirCarregaGrup(_dirGrup());

    // === CÀRREGUES EN SEGON PLA (no bloquegen; el botó ja és verd) ===
    loadGoogleTasksSilent();

    // Google Calendar del mes actual (i el següent) — a 1s
    setTimeout(() => {
      const _now = new Date();
      const _y = _now.getFullYear(), _m = _now.getMonth();
      const _nextY = _m === 11 ? _y + 1 : _y;
      const _nextM = _m === 11 ? 0 : _m + 1;
      _loadGCalEvents(_y, _m).then(() => {
        const planVisible = !document.getElementById('page-planning').classList.contains('page-hidden');
        const homeVisible = !document.getElementById('page-home').classList.contains('page-hidden');
        if (planVisible) renderPlanning();
        if (homeVisible) renderHome();
        // El mes següent, encara més tard
        setTimeout(() => _loadGCalEvents(_nextY, _nextM), 3000);
      });
    }, 1000);

    // Resum de notes per a les fitxes — a 4s
    setTimeout(() => { if (typeof _prefetchNotesResum === 'function') _prefetchNotesResum(); }, 4000);

    // Notes de totes les assignatures — l'últim, a 6s (i internament una rere l'altra)
    setTimeout(() => { if (typeof prefetchAllNotes === 'function') prefetchAllNotes(); }, 6000);

    initNotifications();

    // Activa el refresc automàtic en segon pla (només un cop)
    _startBackgroundRefresh();
  } catch (e) {
    updateSync('error', 'Sense connexió');
    // Si tenim cache, no mostrem error agressiu (l'app ja funciona offline)
    if (!students.length) _mostraErrorConnexio('network', e && e.message);
  }
}

// Mostra un missatge d'error de connexió clar segons el tipus de problema.
// Ajuda els companys a saber què passa sense haver de demanar ajuda.
function _mostraErrorConnexio(tipus, detall) {
  let titol, missatge;
  switch (tipus) {
    case 'auth':
      titol = 'No autoritzat';
      missatge = 'La clau de seguretat (token) no coincideix amb la del servidor. Comprova que el token de config.local.js és el mateix que el del Google Apps Script.';
      break;
    case 'network':
      titol = 'No es pot connectar';
      missatge = 'No s\'ha pogut arribar al servidor. Revisa que la URL del Web App acabi en /exec i que tinguis connexió a internet. Si acabes de canviar el codi del Apps Script, recorda desplegar una NOVA versió.';
      break;
    case 'backend':
      titol = 'Error del servidor';
      missatge = (detall || 'El servidor ha respost amb un error.') +
        ' Si parla de permisos, potser no tens accés al full de grups o desdoblaments: cal que el propietari te\'ls comparteixi.';
      break;
    default:
      titol = 'Error';
      missatge = detall || 'Hi ha hagut un problema desconegut.';
  }
  showToast(titol + ': ' + missatge, 'error');
  // El toast se'n va als 8 segons i abans el bàner es quedava dient
  // "Pas 1: Configura la connexió" — que és fals si ja està configurada i el
  // que passa és que el servidor no respon. El bàner ha de dir QUÈ passa i
  // quedar-s'hi fins que es resolgui.
  const banner = document.getElementById('setupBanner');
  if (banner) {
    banner.style.display = 'block';
    const bt = banner.querySelector('.setup-banner-text');
    if (bt) {
      bt.innerHTML = '<strong>' + escapeHtml(titol) + ':</strong> ' + escapeHtml(missatge) +
        ' <a onclick="openConfig()">Obrir configuració →</a>';
    }
  }
}

/* ============================================================
   REFRESC AUTOMÀTIC EN SEGON PLA
   Manté totes les dades al dia sense entrar a cada pàgina.
   ============================================================ */
let _bgRefreshTimer = null;
let _bgRefreshing   = false;
// Bloqueig: quan l'usuari està editant, el refresc en segon pla s'espera
// per no sobreescriure el que està fent (evita pèrdua de dades i salts d'scroll).
let _editingLock    = false;
function _isEditing() {
  // Hi ha algun drawer/modal d'edició obert?
  const editSelectors = ['#personalOverlay.open', '#addObsOverlay.open', '#obsDrawerOverlay.open'];
  for (const sel of editSelectors) {
    if (document.querySelector(sel)) return true;
  }
  return _editingLock;
}

function _startBackgroundRefresh() {
  if (_bgRefreshTimer) return; // ja actiu
  // Refresc periòdic cada 3 minuts (prou per mantenir-ho al dia sense saturar)
  _bgRefreshTimer = setInterval(_backgroundRefresh, 180000);
  // Refresc quan la pestanya torna a ser visible (tornes a l'app)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) _backgroundRefresh();
  });
}

async function _backgroundRefresh() {
  if (!config.scriptUrl || _bgRefreshing || document.hidden) return;
  // No refresquis mentre l'usuari està editant (evita sobreescriure el seu treball)
  if (_isEditing()) return;
  _bgRefreshing = true;
  try {
    // Una sola crida consolidada (bootstrap): ho porta tot i respecta el grup de tutoria
    const weekIds = [getPlanWeekId(-1), getPlanWeekId(0), getPlanWeekId(1)];
    const boot = await appsScriptGet({ action: 'bootstrap', weekIds: JSON.stringify(weekIds) }, false);
    if (boot && boot.ok) {
      _applyBootstrap(boot);
      // Només es desa al cache si el bootstrap ha arribat de debò. Si falla,
      // `students` pot ser mitja classe (venim d'una assignatura desdoblada)
      // i desar-ho congelaria aquella llista per a la propera arrencada.
      _saveMainToCache();
    }

    // Repinta NOMÉS la pàgina visible
    _paintAllViews();
    updateSync('ok', 'Sincronitzat'); updateStatSync();
  } catch(e) {
    // Silenciós: ja ho reintentarà al pròxim cicle
  }
  _bgRefreshing = false;
}

/* ============================================================
   ALUMNES — PÀGINA LLISTA
   ============================================================ */
/* Per què no hi ha alumnes? No és el mateix no estar connectada que no tenir
   tutoria. Abans sempre deia "Connecta amb Google Sheets per veure els alumnes",
   fins i tot estant connectada: una especialista pensava que li fallava la
   connexió i anava a Configuració a buscar-hi un problema que no hi era. */
function _motiuSenseAlumnes() {
  if (!config.scriptUrl) {
    return { titol: 'Encara no estàs connectada',
             text: 'Ves a <strong>Configuració</strong> i enganxa la URL que et van donar.' };
  }
  if (typeof esEspecialista === 'function' && esEspecialista()) {
    return { titol: 'Tria un grup',
             text: 'Al selector de dalt tria de quin dels teus grups vols veure els alumnes. Si no n\'hi surt cap, digues a <strong>El meu perfil</strong> a quins grups fas classe.' };
  }
  if (_rolDireccio()) {
    return _dirGrup()
      ? { titol: _dirGrup() + ' encara no té cap alumne',
          text: 'Aquest grup no té ningú al full compartit de l\'escola. Quan hi siguin, sortiran aquí sols.' }
      : { titol: 'Tria un grup',
          text: 'A dalt, tria el curs i la línia del grup que vols mirar. Pots entrar a qualsevol grup de primària.' };
  }
  const teTutoria = (typeof grupActual === 'function') && grupActual();
  if (!teTutoria) {
    return { titol: 'No ets tutor/a de cap grup',
             text: 'Aquesta pantalla mostra els alumnes de la teva tutoria. Per veure els d\'un curs on fas classe, tria l\'assignatura al menú de l\'esquerra i clica <strong>Veure alumnes</strong>.' };
  }
  return { titol: 'Encara no hi ha cap alumne a ' + teTutoria,
           text: 'Quan els alumnes del teu grup siguin al full compartit, sortiran aquí sols.' };
}

function _pintaEstatBuitAlumnes(el) {
  if (!el) return;
  const m = _motiuSenseAlumnes();
  const p = el.querySelector('p');
  if (p) p.innerHTML = '<strong>' + m.titol + '</strong><br>' + m.text;
}

function renderAlumnesList() {
  const container = document.getElementById('alumnesList');
  container.querySelectorAll('.alumne-card').forEach(el => el.remove());
  const empty = document.getElementById('alumnesEmpty');
  if (!students.length) { _pintaEstatBuitAlumnes(empty); empty.style.display = 'block'; return; }
  empty.style.display = 'none';

  const _alFrag = document.createDocumentFragment();
  students.forEach(s => {
    const obs      = observacions[s.id] || {};
    const obsCount = Object.values(obs).filter(v => v && v.trim()).length;
    const pd       = personal[s.id] || {};
    const hasMedic = pd.obs && pd.obs.trim();
    const hasEspec = pd.especific && pd.especific.trim();
    const hasAlert = hasMedic || hasEspec;
    const alertTip = [hasMedic ? '✚ ' + pd.obs : '', hasEspec ? '⚠ ' + pd.especific : ''].filter(Boolean).join('\n');
    const hasData  = pd.mare || pd.pare || pd.emailMare || pd.emailPare || pd.obs || pd.especific;
    const hasPI    = pd.pi && pd.pi.trim();
    const hasAM    = pd.am && pd.am.trim();

    const card = document.createElement('div');
    card.className = 'alumne-card';
    card.innerHTML = `
      <div class="alumne-card-corner">
        ${hasPI ? '<span class="alumne-badge-pi" title="Pla Individualitzat: ' + escapeHtml(pd.pi.replace(/\|/g,', ')) + '">PI</span>' : ''}
        ${hasAM ? '<span class="alumne-badge-am" title="Adaptació Metodològica: ' + escapeHtml(pd.am.replace(/\|/g,', ')) + '">AM</span>' : ''}
        ${hasAlert ? '<span class="alumne-card-alert" title="' + escapeHtml(alertTip) + '">⚠</span>' : ''}
      </div>
      <div class="alumne-card-top" title="Obrir fitxa">
        <div class="student-avatar alumne-card-avatar">${getInitials(s.nom)}</div>
        <div class="alumne-card-nom">${escapeHtml(s.nom)}</div>
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
    const hasData  = pd.mare || pd.pare || pd.emailMare || pd.emailPare || pd.obs || pd.especific || pd.pi || pd.am;
    const div = document.createElement('div');
    div.className = 'student-item';
    const gen = s.genere === 'f' ? 'f' : 'm';
    div.innerHTML = `
      <span class="student-num">${idx + 1}</span>
      <div class="student-avatar">${getInitials(s.nom)}</div>
      <div class="student-info">
        <div class="student-name">${escapeHtml(s.nom)}</div>
        <div class="student-meta">${grupActual() ? escapeHtml(grupActual()) + ' · ' : ''}<button class="student-gen-btn" data-gen="${gen}" title="Canviar gènere">${gen === 'f' ? '♀ Femení' : '♂ Masculí'}</button></div>
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
  const pcEl = document.getElementById('panelCount'); if (pcEl) pcEl.textContent = list.length + ' alumne' + (list.length!==1?'s':'') + _sufixGrup();
  const acEl = document.getElementById('alumnesCount'); if (acEl) acEl.textContent = '· ' + list.length + ' alumnes';
  document.getElementById('footerInfo').textContent = list.length + ' alumnes al full de càlcul';
}

/* ============================================================
   FITXA ALUMNE
   ============================================================ */
async function renderFitxa(studentId) {
  const s  = students.find(x => x.id === studentId);
  if (!s) return;

  // El grup de la fitxa: abans l'HTML portava un grup escrit a pèl, o sigui
  // que a la fitxa de cada alumne hi sortia un grup que no era el seu.
  const _fm = document.getElementById('fitxaMeta');
  if (_fm) { const g = grupActual(); _fm.textContent = g ? g + ' · Primària' : 'Primària'; }

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

  // Àrea d'avisos (mèdic + PI/AM + específics)
  const alert = document.getElementById('fitxaAlert');
  const alertText = document.getElementById('fitxaAlertText');
  let avisos = [];
  if (pd.obs && pd.obs.trim()) {
    const linies = pd.obs.trim().split('\n').map(l => l.trim()).filter(l => l);
    avisos.push('<span class="fitxa-avis-tag fitxa-avis-medic">✚ Mèdic</span> ' + linies.map(l => escapeHtml(l)).join(' <span class="obs-sep">|</span> '));
  }
  if (pd.especific && pd.especific.trim()) {
    const linies = pd.especific.trim().split('\n').map(l => l.trim()).filter(l => l);
    avisos.push('<span class="fitxa-avis-tag fitxa-avis-espec">⚠ Específic</span> ' + linies.map(l => escapeHtml(l)).join(' <span class="obs-sep">|</span> '));
  }
  // Els trastorns tenen etiqueta pròpia: al document de l'escola són una
  // categoria a part, i barrejats amb els aspectes conductuals es perdien.
  if (pd.trastorns && pd.trastorns.trim()) {
    avisos.push('<span class="fitxa-avis-tag fitxa-avis-trast">◆ Trastorn</span> ' +
                escapeHtml(pd.trastorns.trim()));
  }
  if (pd.acollida && pd.acollida.trim()) {
    avisos.push('<span class="fitxa-avis-tag fitxa-avis-acoll">Aula d\'acollida</span> ' +
                escapeHtml(pd.acollida.trim()));
  }
  if (pd.pi && pd.pi.trim()) {
    avisos.push('<span class="fitxa-avis-tag fitxa-avis-pi">PI</span> Pla Individualitzat: ' + escapeHtml(pd.pi.replace(/\|/g, ', ')));
  }
  if (pd.am && pd.am.trim()) {
    avisos.push('<span class="fitxa-avis-tag fitxa-avis-am">AM</span> Adaptació Metodològica: ' + escapeHtml(pd.am.replace(/\|/g, ', ')));
  }
  if (pd.eap && pd.eap.trim()) {
    avisos.push('<span class="fitxa-avis-tag fitxa-avis-eap">EAP</span> Informe de l\'EAP: ' + escapeHtml(pd.eap.trim()));
  }
  // Els drets d'imatge no són cap avís pedagògic, però val més tenir-los a
  // la vista: és el que s'ha de mirar abans de penjar una foto.
  if (pd.drets && pd.drets.trim()) {
    avisos.push('<span class="fitxa-avis-tag fitxa-avis-drets">📷 Drets d\'imatge</span> ' +
                escapeHtml(pd.drets.trim()));
  }
  if (pd.emvic && pd.emvic.trim()) {
    avisos.push('<span class="fitxa-avis-tag fitxa-avis-emvic">EMVic</span> Hi va');
  }
  if (avisos.length) {
    alertText.innerHTML = avisos.join('<br>');
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

  // Entrevistes amb la família. Es carreguen un cop per grup i es queden
  // en memòria, així passar de fitxa en fitxa no demana res al servidor.
  if (typeof carregaEntrevistes === 'function') {
    carregaEntrevistes().then(() => {
      // Si mentrestant ha canviat d'alumne, no li pintem les d'un altre.
      const c = document.getElementById('fitxaEntrevistes');
      if (c && String(c.getAttribute('data-alumne')) === String(studentId)) pintaEntrevistes(studentId);
    }).catch(() => {});
    const c0 = document.getElementById('fitxaEntrevistes');
    if (c0) c0.setAttribute('data-alumne', String(studentId));
    pintaEntrevistes(studentId);
  }
  _updateFitxaNav();
}

/* ============================================================
   ALUMNES — CRUD
   ============================================================ */
// Cache del resum de notes (vàlid 2 min) per evitar recarregar en navegar entre fitxes
let _notesResumCache = null;
let _notesResumMats  = null; // llista [{key,nom}] d'assignatures amb pestanya de notes
let _notesResumTs    = 0;

// Precarrega el resum en segon pla (sense bloquejar). Crida després de l'arrencada.
async function _prefetchNotesResum() {
  if (!config.scriptUrl || (_notesResumCache && Date.now() - _notesResumTs < 120000)) return;
  try {
    const grup = (typeof _perfilTutorGrupKey === 'function') ? _perfilTutorGrupKey() : null;
    const r = await appsScriptGet({ action: 'getNotesResum', grup: grup || '' });
    if (r.ok) { _notesResumCache = r.resum; _notesResumMats = r.mats || null; _notesResumTs = Date.now(); }
  } catch(e) {}
}

// Troba la posició d'un alumne a la pestanya de notes pel NOM (rowNoms del backend),
// perquè l'ordre de files pot diferir del roster. -1 si no el troba.
function _fitxaPosPerNom(nom, rowNoms) {
  if (!nom || !Array.isArray(rowNoms)) return -1;
  const norm = (typeof _normNomSimple === 'function') ? _normNomSimple
    : (s => (s||'').toString().normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim());
  const target = norm(nom);
  for (let i = 0; i < rowNoms.length; i++) {
    if (rowNoms[i] && norm(rowNoms[i]) === target) return i;
  }
  return -1;
}

async function loadFitxaNotes(studentId, container) {
  container.innerHTML = '<p class="fitxa-empty-field">Carregant notes…</p>';
  if (!config.scriptUrl) {
    container.innerHTML = '<p class="fitxa-empty-field">Connecta amb Google Sheets per veure les notes.</p>';
    return;
  }

  const TRIMS = [1, 2, 3];
  const tutorGrup = (typeof _perfilTutorGrupKey === 'function') ? _perfilTutorGrupKey() : null;

  // Usa el resum cachejat (1 sola crida per tota la classe, no per alumne). El
  // resum es demana pel grup de tutoria: així llegeix les pestanyes reals
  // per-grup ("1T_Matemàtiques_4t B") i cobreix qualsevol assignatura del perfil.
  let resum, mats;
  if (_notesResumCache && Date.now() - _notesResumTs < 120000) {
    resum = _notesResumCache; mats = _notesResumMats;
  } else {
    try {
      const r = await appsScriptGet({ action: 'getNotesResum', grup: tutorGrup || '' });
      if (!r.ok) throw new Error(r.error);
      resum = r.resum; mats = r.mats || null;
      _notesResumCache = resum; _notesResumMats = mats; _notesResumTs = Date.now();
    } catch(e) {
      container.innerHTML = '<p class="fitxa-empty-field">Error carregant notes.</p>';
      return;
    }
  }

  // Assignatures a mostrar = les del perfil al grup de tutoria (etiqueta real),
  // més qualsevol pestanya de notes que no hi sigui (p. ex. Carpeta Viatgera).
  // La clau normalitzada coincideix amb la del backend, així es casen les dades.
  const _kn = s => (s||'').toString().normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
  let _showList = (typeof _perfil !== 'undefined' && _perfil.classes && _perfil.classes[tutorGrup])
    ? _perfil.classes[tutorGrup].map(nom => ({ key: _kn(nom), nom }))
    : [];
  if (Array.isArray(mats)) {
    const _have = new Set(_showList.map(x => x.key));
    mats.forEach(m => { if (!_have.has(m.key)) { _showList.push({ key: m.key, nom: m.nom }); _have.add(m.key); } });
  }
  if (!_showList.length) {
    _showList = (Array.isArray(mats) && mats.length) ? mats.slice()
      : Object.keys(resum || {}).map(k => ({ key: k, nom: (typeof MATERIES !== 'undefined' && MATERIES[k]) || k }));
  }
  const MATS_SHOW = _showList.map(x => x.key);
  const LBL = {}; _showList.forEach(x => { LBL[x.key] = x.nom; });

  // Nom de l'alumne (per remapejar per nom, ja que l'ordre del full pot diferir del roster)
  const _stud = (typeof students !== 'undefined') ? students.find(s => String(s.id) === String(studentId)) : null;
  const _nomAl = _stud ? _stud.nom : null;

  // Extreu les dades d'aquest alumne del resum global
  const resultat = {};
  const neTotal  = {};
  MATS_SHOW.forEach(mat => {
    resultat[mat] = {};
    neTotal[mat]  = 0;
    TRIMS.forEach(trim => {
      const d = resum[mat] && resum[mat][trim];
      if (!d) { resultat[mat][trim] = null; return; }
      // Posició pel NOM (rowNoms); si no hi ha rowNoms o no casa, cau a studentId (compat.)
      let pos = studentId;
      if (_nomAl && Array.isArray(d.rowNoms)) {
        const idx = _fitxaPosPerNom(_nomAl, d.rowNoms);
        if (idx !== -1) pos = idx;
      }
      const arrod = d.notes[pos] ?? null;
      const ne    = d.ne[pos] || 0;
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
        <div class="fitxa-ne-detail">${MATS_SHOW.filter(m=>neTrimActual[m]>0).map(m=>`${LBL[m]}: ${neTrimActual[m]}`).join(' · ')}</div>
      </div>
    </div>` : ''}
    <table class="fitxa-notes-table">
      <thead><tr><th>Assignatura</th><th>1r Trim</th><th>2n Trim</th><th>3r Trim</th></tr></thead>
      <tbody>
        ${MATS_SHOW.map(k => `
          <tr>
            <td>${LBL[k]}</td>
            ${TRIMS.map(t => `<td>${Q(resultat[k][t]?.arrod ?? null)}</td>`).join('')}
          </tr>`).join('')}
      </tbody>
    </table>
    <div id="fitxaNotesAltres" data-alumne="${studentId}"></div>`;

  /* Privilegi del tutor: les assignatures que li fan ALTRES mestres.
     Cada mestra decideix si comparteix les seves notes; si no, aquí hi
     surt "Notes no compartides". Va a part i en segon pla, perquè les
     seves notes no s'endarrereixin esperant el full compartit. */
  if (tutorGrup && typeof carregaNotesCompartides === 'function') {
    const _rowId = (personal[studentId] && personal[studentId].rowId) || null;
    if (_rowId) {
      carregaNotesCompartides(tutorGrup).then(assigs => {
        const cont = document.getElementById('fitxaNotesAltres');
        if (!cont) return;   // ha canviat de pantalla mentrestant
        // ⚠ CARRERA: passant fitxes de pressa, la resposta d'un alumne pot
        // arribar quan ja se n'està mirant un altre. Sense aquesta
        // comprovació li pintaríem les notes del primer: notes d'un altre
        // nen a la seva fitxa. El contenidor porta de qui és.
        if (String(cont.getAttribute('data-alumne')) !== String(studentId)) return;
        try { cont.innerHTML = pintaNotesAltresMestres(assigs, _rowId, MATS_SHOW); }
        catch (e) { /* que no peti la fitxa per això */ }
      }).catch(() => {});
    }
  }
}

function loadFitxaAssoliments(studentId, container) {
  const TRIMS = [1,2,3];
  const TRIM_NOM = ['1r T','2n T','3r T'];

  // Assignatures que faig al grup de tutoria (del perfil)
  const tutorGrup = (typeof _perfilTutorGrupKey === 'function') ? _perfilTutorGrupKey() : null;
  let assigs = [];
  if (tutorGrup && typeof _perfil !== 'undefined' && _perfil.classes && _perfil.classes[tutorGrup]) {
    assigs = _perfil.classes[tutorGrup].slice();
  }
  if (!assigs.length) assigs = ['Matemàtiques','Català','Medi','Música','Anglès']; // reserva

  // Id estable de l'alumne (rowId)
  const st = students.find(x => x.id === studentId);
  const rowId = (st && st.rowId !== undefined && st.rowId !== null && st.rowId !== '') ? st.rowId : studentId;
  const _norm = s => (s||'').toString().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const grupKey = tutorGrup ? _norm(tutorGrup).replace(/[^a-z0-9]/g,'') : '';

  // Calcula % per cada assignatura i trimestre (lectura directa localStorage)
  const rows = assigs.map(nomAssig => {
    const baseKey = _norm(nomAssig).replace(/[^a-z0-9]/g,'');
    const mat = grupKey ? (baseKey + '__' + grupKey) : baseKey;
    const pcts = TRIMS.map(trim => {
      const objRaw = localStorage.getItem(`assim_obj_${mat}_${trim}`);
      if (!objRaw) return null;
      const objectius = JSON.parse(objRaw);
      if (!objectius.length) return null;
      let punts = 0;
      const prefix = `assim_${mat}_${trim}_${rowId}_`;
      objectius.forEach(obj => {
        const v = localStorage.getItem(prefix + obj.id);
        if (v === 'true') punts += 1;
        else if (v === '"partial"') punts += 0.5;
      });
      return Math.round(punts / objectius.length * 100);
    });
    return { mat, nom: nomAssig, pcts };
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
          <td>${escapeHtml(r.nom || MATERIES[r.mat] || r.mat)}</td>
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
  // Actualitza també la còpia a _tutoriaAlumnes si hi és (perquè no es reverteixi)
  if (typeof _tutoriaAlumnes !== 'undefined' && _tutoriaAlumnes) {
    const ta = _tutoriaAlumnes.find(x => x.id === id);
    if (ta) ta.genere = s.genere;
  }
  renderPanelStudents(students);
  _saveMainToCache();

  if (!config.scriptUrl) return;
  try {
    // Determina el grup actual per desar al full "Grups"
    let grup = (typeof _tutoriaGrup !== 'undefined' && _tutoriaGrup) ? _tutoriaGrup : null;
    if (typeof _grupStudentsCarregat !== 'undefined' && _grupStudentsCarregat) {
      const g = _grupStudentsCarregat.split('|')[0]; if (g) grup = g;
    }
    const rowId = (personal[id] && personal[id].rowId) || s.rowId || id;
    if (grup) {
      const r = await appsScriptPost({ action: 'saveGrupGenere', grup, rowId, genere: s.genere });
      if (!r.ok) throw new Error(r.error);
    } else {
      await saveStudents();
    }
  } catch (e) { showToast('Error desant el gènere: ' + e.message, 'error'); }
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
  // Mateix motiu que a Alumnes: abans deia "Carrega els alumnes", que no és
  // cap instrucció (no hi ha res per clicar que els carregui).
  if (!students.length) { _pintaEstatBuitAlumnes(empty); empty.style.display='block'; return; }
  empty.style.display = 'none';
  students.forEach(s => {
    const obs   = observacions[s.id] || {};
    const count = Object.values(obs).filter(v => v&&v.trim()).length;
    const card  = document.createElement('div');
    card.className = 'obs-student-card';
    card.innerHTML = `
      <div class="student-avatar">${getInitials(s.nom)}</div>
      <div class="obs-student-card-info">
        <div class="obs-student-card-name">${escapeHtml(s.nom)}</div>
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
  const nouText = cur ? cur+' · '+text : text;
  observacions[studentId][key] = nouText;
  closeAddObsModal();
  refreshObsViews(studentId);
  if (config.scriptUrl) {
    try {
      // Les observacions es desen al full "Grups" compartit (les veu tot el claustre).
      // Necessitem el rowId de l'alumne i el grup de l'assignatura.
      const grup = (personal[studentId] && personal[studentId].grupOrigen)
        ? personal[studentId].grupOrigen
        : ((typeof _assigGrupMap !== 'undefined' && _assigGrupMap[materia])
            ? _assigGrupMap[materia]
            : ((typeof _perfilTutorGrupKey === 'function') ? _perfilTutorGrupKey() : null));
      const rowId = (personal[studentId] && personal[studentId].rowId) || studentId;
      let r;
      if (grup) {
        // materia amb la clau (pot incloure grup) → desa el text acumulat
        r = await appsScriptPost({ action:'saveGrupObs', grup, rowId, materia: key, text: nouText });
      } else {
        r = await appsScriptPost({ action:'saveObservacio', studentId, materia, trimestre, text });
      }
      if (!r.ok) throw new Error(r.error);
      showToast('Observació guardada','success');
    } catch(e){ showToast('Error: '+e.message,'error'); }
  }
}
function editObservacio(studentId, materia, trimestre) {
  const sel = document.getElementById('obsAlumne');
  sel.innerHTML = students.map(s=>`<option value="${s.id}" ${s.id===studentId?'selected':''}>${escapeHtml(s.nom)}</option>`).join('');
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
    try {
      const grup = (personal[studentId] && personal[studentId].grupOrigen)
        ? personal[studentId].grupOrigen
        : ((typeof _assigGrupMap !== 'undefined' && _assigGrupMap[materia])
            ? _assigGrupMap[materia]
            : ((typeof _perfilTutorGrupKey === 'function') ? _perfilTutorGrupKey() : null));
      const rowId = (personal[studentId] && personal[studentId].rowId) || studentId;
      let r;
      if (grup) r = await appsScriptPost({ action:'saveGrupObs', grup, rowId, materia: key, text });
      else r = await appsScriptPost({action:'saveObservacio',studentId,materia,trimestre:String(trimestre),text,replace:true});
      if(!r.ok) throw new Error(r.error);
      showToast('Observació actualitzada','success');
    }
    catch(e){ showToast('Error: '+e.message,'error'); }
  }
}
async function deleteObservacioMateria(studentId, materia, trimestre) {
  if (!confirm('Esborrar les observacions de '+(MATERIES[materia]||materia)+' ('+TRIM_LABELS[String(trimestre)]+') per aquest alumne?')) return;
  const key = trimestre+'_'+materia;
  if (observacions[studentId]) delete observacions[studentId][key];
  refreshObsViews(studentId);
  if (config.scriptUrl) {
    try {
      const grup = (personal[studentId] && personal[studentId].grupOrigen)
        ? personal[studentId].grupOrigen
        : ((typeof _assigGrupMap !== 'undefined' && _assigGrupMap[materia])
            ? _assigGrupMap[materia]
            : ((typeof _perfilTutorGrupKey === 'function') ? _perfilTutorGrupKey() : null));
      const rowId = (personal[studentId] && personal[studentId].rowId) || studentId;
      if (grup) await appsScriptPost({ action:'saveGrupObs', grup, rowId, materia: key, text: '' });
      else await appsScriptPost({action:'deleteObservacio',studentId,materia,trimestre:String(trimestre)});
    } catch(e){ showToast('Error: '+e.message,'error'); }
  }
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
    try { const r=await appsScriptPost({action:'addRegistreItem',item,alumnes:students,grup:_registreGrup()}); if(!r.ok) throw new Error(r.error); updateSync('ok','Sincronitzat'); showToast('Ítem «'+nom+'» creat','success'); }
    catch(e){ updateSync('error','Error'); showToast('Error: '+e.message,'error'); }
  }
}
async function deleteRegistreItem(itemId) {
  const item=registreItems.find(i=>i.id===itemId);
  if (!item||!confirm('Eliminar «'+item.nom+'»?')) return;
  registreItems=registreItems.filter(i=>i.id!==itemId); delete registreData[itemId];
  renderRegistre();
  if (config.scriptUrl){ try{ await appsScriptPost({action:'deleteRegistreItem',itemId,grup:_registreGrup()}); showToast('Ítem eliminat','success'); } catch(e){ showToast('Error: '+e.message,'error'); } }
}
async function updateRegistreCell(itemId,studentId,value) {
  if (!registreData[itemId]) registreData[itemId]={};
  registreData[itemId][studentId]=value;
  if (config.scriptUrl){ try{ await appsScriptPost({action:'updateRegistreCell',itemId,studentId,value,grup:_registreGrup()}); } catch(e){ showToast('Error: '+e.message,'error'); } }
}
async function syncRegistre(){
  // A l'app dels especialistes el registre és el del grup triat, no el del
  // full personal: recarregar-ho tot el trepitjaria.
  if (typeof esEspecialista === 'function' && esEspecialista()) {
    if (typeof _grupStudentsCarregat !== 'undefined') _grupStudentsCarregat = null; // força rellegir
    await _rolCarregaGrupTreball(_entradaTreball, 'registres');
    return;
  }
  // A direcció, el registre és el del grup triat: recarrega'l sencer.
  if (_rolDireccio()) {
    if (_dirGrup()) await _dirCarregaGrup(_dirGrup());
    return;
  }
  await loadAll(); renderRegistre();
}

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
/* El grup de qui fa servir l'app ARA. Abans hi havia un grup escrit a pèl a
   quatre llocs, i el veia tothom tant si era el seu com si no. Torna null si
   encara no se sap (mestra nova) o si no té tutoria (especialista): en aquest
   cas val més no dir cap grup que dir-ne un de fals. */
function grupActual() {
  if (typeof _tutoriaGrup !== 'undefined' && _tutoriaGrup) return _tutoriaGrup;
  if (typeof _perfilTutorGrupKey === 'function') { const g = _perfilTutorGrupKey(); if (g) return g; }
  return null;
}
// " · 4t B" quan se sap el grup, i res quan no.
function _sufixGrup() { const g = grupActual(); return g ? ' · ' + g : ''; }

/* El grup del qual ETS tutor/a, o null si no en tens (especialistes i
   direcció). NO és el mateix que `grupActual()`: a l'app de direcció, el grup
   que es veu a la pantalla és el que han triat ells, i no en són tutors.
   Confondre-ho amagava la casella de compartir notes amb el tutor, justament
   a qui més falta li fa que hi arribin. */
function grupTutoria() {
  if (_rolDireccio()) return null;
  if (typeof _perfilTutorGrupKey === 'function') { const g = _perfilTutorGrupKey(); if (g) return g; }
  if (typeof _tutoriaGrup !== 'undefined' && _tutoriaGrup) return _tutoriaGrup;
  return null;
}

function updateHomeCounters() {
  // Comptador a la pàgina d'alumnes
  const panelCount = document.getElementById('panelCount');
  if (panelCount) panelCount.textContent = students.length + ' alumne' + (students.length !== 1 ? 's' : '') + _sufixGrup();
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
  // Els errors solen tenir instruccions: es mostren més estona per poder-los llegir
  const durada = (type === 'error' && msg.length > 60) ? 8000 : 3500;
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.classList.remove('show'), durada);
}

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  _rolAplicaInterficie(); // subtítol del logo i apartats segons el rol de l'app
  updateHomeCounters(); // inicialitza data sidebar
  // Mostra el nom del perfil al menú des del cache local (immediat)
  try {
    const pc = localStorage.getItem('vedruna_perfil');
    if (pc) { _perfil = JSON.parse(pc); if (typeof _perfilUpdateNav === 'function') _perfilUpdateNav(); }
  } catch(e) {}
  // Sempre, també amb el perfil BUIT (mestra nova): si no, l'apartat
  // "Assignatures" del menú es quedava mut, sense ni dir què s'hi ha de fer.
  try { if (typeof perfilRenderAllSelectors === 'function') perfilRenderAllSelectors(); } catch(e) {}
  document.getElementById('newStudentName').addEventListener('keydown',e=>{if(e.key==='Enter') addStudent();});
  document.getElementById('newItemName').addEventListener('keydown',   e=>{if(e.key==='Enter') addRegistreItem();});
  document.getElementById('obsText').addEventListener('keydown',       e=>{if(e.key==='Enter'&&e.ctrlKey) saveObservacio();});
  // Marca Inici com actiu per defecte
  document.querySelector('.nav-item')?.classList.add('active');
  _initHistoryNav(); // gestió del botó "enrere" del mòbil
  if (config.scriptUrl) loadAll();
  else updateSync('','No configurat');
});

/* ============================================================
   ROL DE L'APP (tutor / especialista)
   ------------------------------------------------------------
   El rol el fixa js/rol.js i no canvia mai dins d'una còpia de
   l'app. Aquí només s'hi adapta la interfície: el subtítol de sota
   el logo, els apartats que no hi són i el selector de grup que
   necessiten les especialistes (elles entren a molts grups i cada
   pantalla ha de saber de quin parlem).
   ============================================================ */

// Assignatura+grup amb què treballen ARA Observacions i Registres d'aula
// (especialistes). _entradaTreball és la clau de l'entrada del perfil
// ("musica__3ra") i _clauRegistre el nom llegible que va al full ("3r A · Música").
let _entradaTreball = null;
let _clauRegistre = null;

/* True si aquesta còpia de l'app és la de direcció.

   ⚠ Es pregunta amb `typeof` perquè `js/rol.js` no se sincronitza mai: a les
   apps que ja estan repartides aquell fitxer és el vell i `esDireccio` no hi
   és. Sense la comprovació, l'app d'una mestra petaria al primer clic. */
function _rolDireccio() {
  return (typeof esDireccio === 'function') && esDireccio();
}

function _rolAplicaInterficie() {
  const esp = (typeof esEspecialista === 'function') && esEspecialista();
  const titol = document.getElementById('sidebarBrandTitle');
  if (titol && typeof rolSubtitol === 'function') titol.textContent = rolSubtitol();
  if (_rolDireccio()) {
    // Direcció ho veu tot, com un tutor. L'única diferència és que el grup
    // no és fix: el trien a Alumnes i els segueix per tota l'app. I hi tenen
    // un apartat més, el claustre de primària.
    const nd = document.getElementById('navDocents');
    if (nd) nd.style.display = '';
    _dirAplicaTextos();
    return;
  }
  if (!esp) return;
  ['navAlumnes', 'navSeients', 'homeAccioAlumnes'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  // Recupera l'última assignatura amb què treballava
  try { _entradaTreball = localStorage.getItem('grup_treball') || null; } catch(e) {}
}

// Pinta el selector de grup d'Observacions o de Registres d'aula.
function _rolRenderGrupPicker(pagina) {
  if (!(typeof esEspecialista === 'function' && esEspecialista())) return;
  const esObs  = pagina === 'observacions';
  const picker = document.getElementById(esObs ? 'obsGrupPicker' : 'regGrupPicker');
  const sel    = document.getElementById(esObs ? 'obsGrupSel'    : 'regGrupSel');
  const hint   = document.getElementById(esObs ? 'obsGrupHint'   : 'regGrupHint');
  if (!picker || !sel) return;
  picker.style.display = '';
  const entrades = (typeof _perfilEntradesAmbGrup === 'function') ? _perfilEntradesAmbGrup() : [];
  if (!entrades.length) {
    sel.innerHTML = '<option value="">—</option>';
    if (hint) hint.innerHTML = 'Encara no has dit a quins grups fas classe. Ves a <strong>El meu perfil</strong>.';
    return;
  }
  if (!_entradaTreball || !entrades.some(e => e.key === _entradaTreball)) _entradaTreball = entrades[0].key;
  sel.innerHTML = entrades.map(e =>
    `<option value="${e.key}"${e.key === _entradaTreball ? ' selected' : ''}>${escapeHtml(e.label)}</option>`
  ).join('');
  if (hint) hint.textContent = '';
  _rolCarregaGrupTreball(_entradaTreball, pagina);
}

// La clau del registre d'aula d'una entrada. Cada assignatura a cada grup té
// el seu registre, perquè la llista d'alumnes pot ser diferent: si l'Anglès
// de 3r A és desdoblat, la mestra només hi té mig grup.
function _clauEntrada(e) {
  if (!e) return '';
  if (e.altres) {
    const g = (typeof _desdobGrupActual === 'function') ? _desdobGrupActual(e.curs, e.nom) : null;
    return (e.curs + (g ? ' ' + g : '') + ' · ' + e.nom).trim();
  }
  return (e.grup + ' · ' + e.nom).trim();
}

/* Carrega els alumnes de l'assignatura+grup triats, i les observacions
   compartides si som a Observacions.

   Els alumnes els porta el MATEIX camí que la pàgina de notes
   (_ensureGrupStudents / _loadDesdobStudents), i per això **el desdoblament
   s'hi aplica**: si la mestra només té mig grup d'Anglès a 3r A, aquí veu
   aquell mig grup, no la classe sencera. */
async function _rolCarregaGrupTreball(clau, pagina) {
  if (!clau || !config.scriptUrl) return;
  const esObs = pagina === 'observacions';
  const hint  = document.getElementById(esObs ? 'obsGrupHint' : 'regGrupHint');
  const entrades = (typeof _perfilEntradesAmbGrup === 'function') ? _perfilEntradesAmbGrup() : [];
  const e = entrades.find(x => x.key === clau);
  if (!e) return;
  if (hint) hint.textContent = 'Carregant alumnes…';

  try {
    if (e.altres) {
      // Assignatura d'un altre curs (o de grup rotatori, com el Tallers)
      if (typeof _loadDesdobStudents === 'function') await _loadDesdobStudents(e.curs, e.nom);
    } else if (typeof _ensureGrupStudents === 'function') {
      await _ensureGrupStudents(e.grup, e.key);
    }
  } catch(err) {
    if (hint) hint.textContent = 'No s\'han pogut carregar els alumnes: ' + err.message;
    return;
  }

  if (!students.length) {
    if (hint) hint.textContent = 'Aquest grup encara no té alumnes al full compartit.';
    return;
  }
  // Deixa constància de quin grup són, perquè les observacions vagin a la
  // pestanya que toca del full compartit.
  const grupReal = e.altres ? ((typeof _desdobGrupActual === 'function') ? _desdobGrupActual(e.curs, e.nom) : null) : e.grup;
  students.forEach(st => {
    if (personal[st.id] && !personal[st.id].grupOrigen && grupReal) personal[st.id].grupOrigen = grupReal;
  });
  _clauRegistre = _clauEntrada(e);
  if (hint) hint.textContent = students.length + ' alumnes';

  if (esObs) {
    // Observacions compartides del grup (les veu tot el claustre)
    observacions = {};
    if (grupReal && /^(1r|2n|3r|4t|5è|6è) [ABC]$/.test(grupReal)) {
      try {
        const ro = await appsScriptGet({ action: 'getGrupObs', grup: grupReal });
        if (ro.ok && ro.obs) {
          const rowIdToId = {};
          students.forEach(st => {
            const rid = personal[st.id] && personal[st.id].rowId;
            if (rid !== undefined) rowIdToId[String(rid)] = st.id;
          });
          Object.keys(ro.obs).forEach(rowId => {
            const id = rowIdToId[String(rowId)];
            if (id !== undefined) observacions[id] = ro.obs[rowId];
          });
        }
      } catch(err) {}
    }
    if (typeof _perfilRenderObsSelector === 'function') _perfilRenderObsSelector();
    // Deixa triada l'assignatura del selector: és de la que acaba de triar
    const selMat = document.getElementById('obsMateria');
    if (selMat && selMat.querySelector('option[value="' + e.key + '"]')) selMat.value = e.key;
    renderObsGrid();
  } else {
    // Registres d'aula: cada assignatura de cada grup té la seva pestanya
    try {
      const rr = await appsScriptGet({ action: 'getRegistre', grup: _clauRegistre });
      registreItems = (rr.ok && rr.items) ? rr.items : [];
      registreData  = (rr.ok && rr.data)  ? rr.data  : {};
    } catch(err) { registreItems = []; registreData = {}; }
    renderRegistre();
  }
}

function canviaGrupObservacions(clau) {
  _entradaTreball = clau;
  try { localStorage.setItem('grup_treball', clau); } catch(e) {}
  _rolCarregaGrupTreball(clau, 'observacions');
}

function canviaGrupRegistre(clau) {
  _entradaTreball = clau;
  try { localStorage.setItem('grup_treball', clau); } catch(e) {}
  _rolCarregaGrupTreball(clau, 'registres');
}

/* Què s'envia al backend als registres d'aula.
   · Tutors: res. Es manté la pestanya "Registres d'aula" de sempre.
   · Especialistes: l'assignatura i el grup ("3r A · Anglès").
   · Direcció: el grup triat ("4t B"). Cada grup té la seva pestanya, o les
     creus d'un grup acabarien a les files d'un altre. */
function _registreGrup() {
  if (typeof esEspecialista === 'function' && esEspecialista()) return _clauRegistre || '';
  if (_rolDireccio()) return (typeof _direccioGrup !== 'undefined' && _direccioGrup) ? _direccioGrup : '';
  return '';
}

/* ============================================================
   DIRECCIÓ — el grup de treball
   ------------------------------------------------------------
   Direcció té els mateixos permisos que un tutor, però no ho és de
   cap grup: a Alumnes hi trien de quin dels 18 grups de primària
   volen veure (i modificar) les fitxes. El grup que trien els
   segueix per tota l'app: observacions, registres d'aula i
   distribució de l'aula.

   Per què serveix: si el tutor d'un grup no fa servir l'app, aquell
   grup es queda sense correus, PI, AM ni observacions. Des d'aquí
   els hi poden posar ells, i veure què hi va escrivint la resta.
   ============================================================ */

let _dirCursObert = null;   // curs desplegat al selector (pot no ser el carregat)
let _dirCarregaId  = 0;     // per no deixar que una resposta lenta pinti un grup vell

// Textos que donen per fet que tens tutoria i a direcció no encaixen.
function _dirAplicaTextos() {
  const d = document.getElementById('alumnesHeroDesc');
  if (d) d.textContent = 'Tria un grup i tindràs la fitxa de cada alumne: dades de la família, PI, AM i observacions. Les pots modificar, com ho faria el seu tutor.';
  _dirRenderGrupPicker();
}

// El grup triat, o null si encara no n'hi ha cap.
function _dirGrup() {
  return (typeof _direccioGrup !== 'undefined' && _direccioGrup) ? _direccioGrup : null;
}

/* Un avís d'una línia que diu de quin grup és el que hi ha a la pantalla.
   Als tutors no hi surt: només en tenen un i ja ho saben. A direcció n'hi ha
   18, i sense dir-ho no hi ha manera de saber a qui estàs posant les creus. */
function _dirAvisGrup(idElement, amb, sense) {
  const el = document.getElementById(idElement);
  if (!el) return;
  if (!_rolDireccio()) { el.style.display = 'none'; return; }
  const g = _dirGrup();
  el.style.display = '';
  el.className = 'dir-avis-grup' + (g ? '' : ' is-buit');
  el.textContent = g ? amb.replace('{grup}', g) : sense;
}

function _dirAvisRegistres() {
  _dirAvisGrup('regGrupAvis',
    'Aquest és el registre de {grup}. Cada grup té el seu.',
    'Primer tria un grup a Alumnes: el registre i els alumnes són els d\'aquell grup.');
}
function _dirAvisObservacions() {
  _dirAvisGrup('obsGrupAvis',
    'Observacions de {grup}. Les veu tot el claustre.',
    'Primer tria un grup a Alumnes: hi veuràs els seus alumnes i les seves observacions.');
}

function _dirEstat(text, tipus) {
  const el = document.getElementById('dirGrupEstat');
  if (!el) return;
  el.textContent = text || '';
  el.className = 'dir-grup-estat' + (tipus ? ' is-' + tipus : '');
}

// Pinta el selector: una fila de cursos i, del curs obert, les tres línies.
function _dirRenderGrupPicker() {
  if (!_rolDireccio()) return;
  const box = document.getElementById('dirGrupPicker');
  const files = document.getElementById('dirGrupFiles');
  if (!box || !files) return;
  box.style.display = '';

  const grup = _dirGrup();
  if (!_dirCursObert) _dirCursObert = grup ? grup.split(' ')[0] : null;

  const cursos = (typeof PERFIL_CURSOS !== 'undefined') ? PERFIL_CURSOS : ['1r','2n','3r','4t','5è','6è'];
  const linies = (typeof PERFIL_LINIES !== 'undefined') ? PERFIL_LINIES : ['A','B','C'];

  const cursosHtml = cursos.map(c =>
    `<button type="button" class="dir-grup-btn${_dirCursObert === c ? ' active' : ''}" aria-pressed="${_dirCursObert === c}" onclick="dirObreCurs('${c}')">${escapeHtml(c)}</button>`
  ).join('');

  let liniesHtml = '';
  if (_dirCursObert) {
    liniesHtml = `<div class="dir-grup-linies" role="group" aria-labelledby="dirGrupLinLabel">
      <span class="dir-grup-lin-label" id="dirGrupLinLabel">Línia:</span>
      ${linies.map(l => {
        const g = _dirCursObert + ' ' + l;
        return `<button type="button" class="dir-linia-btn${grup === g ? ' active' : ''}" aria-pressed="${grup === g}" onclick="dirTriaGrup('${g}')">${escapeHtml(g)}</button>`;
      }).join('')}
    </div>`;
  }
  files.innerHTML = `<div class="dir-grup-cursos" role="group" aria-label="Curs">${cursosHtml}</div>${liniesHtml}`;
  const estat = document.getElementById('dirGrupEstat');
  if (!grup) _dirEstat('Tria un curs i una línia per començar.');
  else if (estat && !estat.textContent.trim()) {
    _dirEstat(students.length
      ? (grup + ' · ' + students.length + ' alumne' + (students.length !== 1 ? 's' : ''))
      : (grup + ' · carregant…'));
  }
}

function dirObreCurs(curs) {
  _dirCursObert = curs;
  _dirRenderGrupPicker();
}

function dirTriaGrup(grup) {
  if (!grup) return;
  _dirCarregaGrup(grup);
}

/* Carrega TOT el que depèn del grup: alumnes, observacions compartides,
   registre d'aula i distribució de l'aula. Es fa en un sol lloc perquè no hi
   pugui haver mai mitja pantalla parlant d'un grup i mitja d'un altre. */
async function _dirCarregaGrup(grup) {
  if (!grup || !_rolDireccio()) return;
  const meu = ++_dirCarregaId;

  _direccioGrup = grup;
  try { localStorage.setItem('direccio_grup', grup); } catch(e) {}
  _tutoriaGrup = grup;
  _dirCursObert = grup.split(' ')[0];
  _dirRenderGrupPicker();

  if (!config.scriptUrl) {
    _dirEstat('Encara no estàs connectat: ves a Configuració i enganxa la URL.', 'error');
    return;
  }
  _dirEstat('Carregant ' + grup + '…');

  /* Les TRES peticions alhora, no una darrere l'altra.
     Abans s'encadenaven —alumnes, després observacions, després registre— i
     com que cada crida al servidor de Google són uns segons, canviar de grup
     eren tres esperes seguides. No depenen l'una de l'altra per demanar-se
     (només per aplicar-se), o sigui que van juntes i s'espera la més lenta.
     Amb el vel a sobre, perquè aquesta és una espera que la mestra mira. */
  const [rAlum, rObs, rReg] = await esperaVisual(Promise.all([
    appsScriptGet({ action: 'getGrupAlumnes', grup: grup }),
    appsScriptGet({ action: 'getGrupObs',     grup: grup }),
    appsScriptGet({ action: 'getRegistre',    grup: grup })
  ]), 'Carregant els alumnes de ' + grup + '…');

  // 1) Alumnes del full "Grups" compartit
  let alumnes = [];
  try {
    const r = rAlum;
    if (r && r.ok) alumnes = r.alumnes || [];
    else throw new Error((r && r.error) || 'resposta buida');
  } catch (e) {
    if (meu !== _dirCarregaId) return;
    _dirEstat('No s\'han pogut carregar els alumnes de ' + grup + ': ' + e.message +
              '. Torna a clicar el grup; si continua, mira la connexió a Configuració.', 'error');
    return;
  }
  if (meu !== _dirCarregaId) return;   // ja n'han triat un altre

  /* Buida SEMPRE el grup anterior, també quan el nou no té ningú al full.
     Si no, canviaves de grup, el nou sortia buit i a la pantalla hi quedaven
     els alumnes de l'altre: hi hauries pogut escriure dades a qui no toca. */
  _tutoriaAlumnes = [];
  students = []; personal = {}; observacions = {};
  if (alumnes.length) {
    if (typeof _aplicaTutoriaAlumnes === 'function') _aplicaTutoriaAlumnes(alumnes);
    try { localStorage.setItem('tutoriacache_' + grup, JSON.stringify({ alumnes: alumnes, ts: Date.now(), v: (window.versioApp && window.versioApp.actual) || '' })); } catch(e) {}
  } else {
    _grupStudentsCarregat = grup + '|';
  }

  // 2) Observacions compartides del grup (les que hi va escrivint tothom)
  try {
    const ro = rObs;                       // ja demanada a dalt, alhora
    if (meu !== _dirCarregaId) return;
    if (ro && ro.ok && ro.obs) {
      const rowIdToId = {};
      students.forEach(st => {
        const rid = personal[st.id] && personal[st.id].rowId;
        if (rid !== undefined) rowIdToId[String(rid)] = st.id;
      });
      Object.keys(ro.obs).forEach(rowId => {
        const id = rowIdToId[String(rowId)];
        if (id !== undefined) observacions[id] = ro.obs[rowId];
      });
    }
  } catch(e) { /* silenciós: les fitxes ja hi són */ }

  // 3) Registre d'aula d'aquest grup (pestanya pròpia, "Registres 4t B")
  try {
    const rr = rReg;                       // ja demanada a dalt, alhora
    if (meu !== _dirCarregaId) return;
    registreItems = (rr && rr.ok && rr.items) ? rr.items : [];
    registreData  = (rr && rr.ok && rr.data)  ? rr.data  : {};
  } catch(e) { registreItems = []; registreData = {}; }

  if (meu !== _dirCarregaId) return;
  _clauRegistre = grup;
  if (typeof _seientsCanviaGrup === 'function') _seientsCanviaGrup(grup);
  _dirAvisRegistres(); _dirAvisObservacions();
  if (typeof _saveMainToCache === 'function') _saveMainToCache();
  if (typeof _paintAllViews === 'function') _paintAllViews();
  _dirEstat(alumnes.length
    ? (grup + ' · ' + alumnes.length + ' alumne' + (alumnes.length !== 1 ? 's' : ''))
    : (grup + ' encara no té cap alumne al full compartit.'), alumnes.length ? 'ok' : 'avis');
}

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
// Cache d'events del planning per a UN render (s'invalida a l'inici de renderPlanning).
// Evita reparsejar l'array anual d'events a cada cel·la (40×) i per dia (5×).
let _planEvsMemo = null;
function _planLoadEvs(y) {
  if (!_planEvsMemo) _planEvsMemo = {};
  if (_planEvsMemo[y] === undefined) {
    try { _planEvsMemo[y] = JSON.parse(localStorage.getItem('cal2_events_' + y) || '[]'); }
    catch(e) { _planEvsMemo[y] = []; }
  }
  return _planEvsMemo[y];
}
function _planLoadGcal() {
  if (!_planEvsMemo) _planEvsMemo = {};
  if (_planEvsMemo._gcal === undefined) {
    let g = [];
    try { _hydrateGCalCache(); Object.values(_cal2GCalCache || {}).forEach(arr => { g = g.concat(arr || []); }); } catch(e) {}
    _planEvsMemo._gcal = g;
  }
  return _planEvsMemo._gcal;
}

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

  // Events locals de l'app + Google Calendar (memoïtzats: es parsegen 1 cop per render)
  const locals = _planLoadEvs(y);
  const gcal = _planLoadGcal();
  const evs = gcal.length ? locals.concat(gcal) : locals;

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
// Classifica un dia del planning segons el calendari escolar:
//  { festa } → dia sencer no lectiu (festiu/vacances/local/lliure)
//  { tarda } → dia amb la tarda no lectiva (p. ex. Mercat del Ram, últim dia)
function _planDiaCal(diaId) {
  const diaIdx = PLAN_DIES.findIndex(d => d.id === diaId);
  if (diaIdx < 0) return { festa: null, tarda: null };
  const dataDia = new Date(getPlanMondayDate(_planWeekOffset));
  dataDia.setDate(dataDia.getDate() + diaIdx);
  const y = dataDia.getFullYear();
  const ds = `${y}-${String(dataDia.getMonth()+1).padStart(2,'0')}-${String(dataDia.getDate()).padStart(2,'0')}`;
  const evs = (typeof _planLoadEvs === 'function') ? _planLoadEvs(y) : (function(){ try { return JSON.parse(localStorage.getItem('cal2_events_' + y) || '[]'); } catch(e) { return []; } })();
  // Tots els dies d'escola són catId 'festiu' (gris); acceptem també les catIds
  // antigues per compatibilitat. Distingim pel títol: "tarda no lectiva" → només
  // tarda; "inici de classes" → dia normal (no buida res).
  const NO_LECTIU = ['festiu', 'vacances', 'local', 'lliure'];
  const esNoLectiu = e => NO_LECTIU.indexOf(e.catId) !== -1 && !/tarda no lectiva|inici de classes/i.test(e.titol || '');
  const festa = evs.find(e => e.data === ds && esNoLectiu(e)) || null;
  const tarda = festa ? null : (evs.find(e => e.data === ds && /tarda no lectiva/i.test(e.titol || '')) || null);
  return { festa, tarda };
}

function renderPlanning() {
  const titleEl = document.getElementById('planWeekTitle');
  if (!titleEl) return; // element no present (pàgina no carregada)
  titleEl.textContent = getPlanWeekLabel(_planWeekOffset);
  _planEvsMemo = null; // invalida el cache d'events: es reparsejarà 1 cop en aquest render

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

  const festes = {}, tardes = {}; // diaId → event (o null)
  let html = '<thead><tr><th class="plan-th-hora"></th>';
  PLAN_DIES.forEach((dia, i) => {
    const dateD = new Date(dl); dateD.setDate(dl.getDate() + i);
    const isToday = dateD.toDateString() === today.toDateString();
    const _dayNotes = planDayNoteLoad(dia.id);
    const _diaId = dia.id;
    const cal = _planDiaCal(dia.id);
    festes[dia.id] = cal.festa;
    tardes[dia.id] = cal.tarda;
    // Aniversaris automàtics d'aquest dia (alumnes del grup de tutoria)
    let _aniv = [];
    if (typeof aniversarisDelDia === 'function') _aniv = aniversarisDelDia(dateD);
    html += `<th class="plan-th-dia${isToday ? ' plan-th-today' : ''}">
      <div class="plan-th-dia-top">${dia.nom}<span class="plan-th-date">${toStr(dateD)}</span>
        <button class="plan-day-add-note" onclick="event.stopPropagation();openPlanNoteDay('${_diaId}')" title="Afegir nota del dia">+</button>
      </div>
      ${_aniv.map(nom => `<div class="plan-day-aniversari" title="Aniversari"><span>🎂 Aniversari ${escapeHtml(nom.split(' ')[0])}</span></div>`).join('')}
      ${_dayNotes.map((n, i) => `<div class="plan-day-note-text"><span>${escapeHtml(n)}</span><button class="plan-note-del" onclick="event.stopPropagation();deleteDayNoteItem('${_diaId}',${i})" title="Esborrar">×</button></div>`).join('')}
    </th>`;
  });
  html += '</tr></thead><tbody>';

  PLAN_FRANGES.forEach((franja, fi) => {
    const isPati = franja.id === 'f3' || franja.id === 'f6';
    html += `<tr class="${isPati ? 'plan-row-pati' : 'plan-row'}">`;
    html += `<td class="plan-td-hora">${franja.hora}</td>`;

    PLAN_DIES.forEach(dia => {
      // Dia sencer no lectiu: UNA sola cel·la unida per tot el dia, amb el nom centrat.
      if (festes[dia.id]) {
        if (fi === 0) html += `<td class="plan-td-festa" rowspan="${PLAN_FRANGES.length}"><div class="plan-festa-tag">🎉 ${escapeHtml(festes[dia.id].titol)}</div></td>`;
        return; // fi>0: ja cobert pel rowspan
      }
      // Tarda no lectiva: hores de tarda (f7 i f8) buides i grises, unides.
      if (tardes[dia.id] && (franja.id === 'f7' || franja.id === 'f8')) {
        if (franja.id === 'f7') html += `<td class="plan-td-festa" rowspan="2"><div class="plan-festa-tag plan-festa-tag-sm">Tarda no lectiva</div></td>`;
        return; // f8: cobert pel rowspan
      }
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

  // Si algun text de la cel·la conté "permanència", es pinta de granat clar
  const _txt = ((data.assig || '') + ' ' + (data.sub || '') + ' ' + (data.event || '')).toLowerCase();
  const esPermanencia = _txt.includes('permanència') || _txt.includes('permanencia');

  let cls = isPati ? 'plan-cell plan-cell-pati' : 'plan-cell';
  if (esPermanencia) cls += ' plan-cell-permanencia';
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
let _cal2GCalCache     = {};  // cache de GCal per mes (clau "year-month")
let _cal2GCalCacheMeta = {};  // timestamp de l'última càrrega per mes
let _cal2NavToken      = 0;   // token per ignorar respostes de mesos antics

// Retorna TOTS els events (locals app + Google Calendar) d'una data 'YYYY-MM-DD'
function allEventsForDate(dateStr) {
  if (!dateStr) return [];
  _hydrateGCalCache();
  const year = parseInt(dateStr.split('-')[0]);
  const locals = (typeof cal2LoadEvents === 'function' ? cal2LoadEvents(year) : [])
    .filter(e => e.data === dateStr);
  let gcal = [];
  Object.values(_cal2GCalCache || {}).forEach(arr => {
    (arr || []).forEach(e => { if (e.data === dateStr) gcal.push(e); });
  });
  return [...locals, ...gcal];
}

// Carrega el cache de GCal persistit a localStorage cap a memòria (una sola vegada)
let _gcalHydrated = false;
function _hydrateGCalCache() {
  if (_gcalHydrated) return;
  _gcalHydrated = true;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('gcal_')) {
        const key = k.slice(5); // "year-month"
        if (!_cal2GCalCache[key]) _cal2GCalCache[key] = JSON.parse(localStorage.getItem(k) || '[]');
      }
    }
  } catch(e) {}
}

const MESOS_CA = ['Gener','Febrer','Març','Abril','Maig','Juny',
  'Juliol','Agost','Setembre','Octubre','Novembre','Desembre'];

/* Categories per defecte (només per a qui encara no en té cap).
   Abans eren tres línies d'un curs concret, i una mestra d'un altre curs
   obria el calendari i es trobava categories que no eren seves. Ara són
   neutres i les pot reanomenar des de ⚙ Categories.
   Cap id pot ser una de les que el calendari escolar es reserva
   ('festiu','vacances','local','lliure','escola'): les esborraria. */
const CAL2_CATS_DEFAULT = [
  { id:'sortides',   nom:'Sortides',   color:'#22C55E' },
  { id:'reunions',   nom:'Reunions',   color:'#3B82F6' },
  { id:'activitats', nom:'Activitats', color:'#F97316' },
  { id:'conjunt',    nom:'Conjunt',    color:'#8B5CF6' },
];

function cal2LoadCats() {
  const s = localStorage.getItem('cal2_cats');
  return s ? JSON.parse(s) : JSON.parse(JSON.stringify(CAL2_CATS_DEFAULT));
}
function cal2SaveCats(cats)         { localStorage.setItem('cal2_cats', JSON.stringify(cats)); _calSaveCatsToSheets(); }
function cal2CatById(id) {
  return cal2LoadCats().find(c => c.id === id) || { color: '#9AA0A6', nom: 'Sense categoria' };
}

// Quants events fan servir una categoria (de tots els anys desats)
function _cal2QuantsEvents(catId) {
  var total = 0;
  try {
    Object.keys(localStorage).filter(function (k) { return k.indexOf('cal2_events_') === 0; })
      .forEach(function (k) {
        var evs = [];
        try { evs = JSON.parse(localStorage.getItem(k) || '[]'); } catch (e) {}
        (evs || []).forEach(function (e) { if (e && e.catId === catId) total++; });
      });
  } catch (e) {}
  return total;
}

/* Events */
function cal2LoadEvents(year) { return JSON.parse(localStorage.getItem('cal2_events_' + year) || '[]'); }
function cal2SaveEvents(year, evs)  { localStorage.setItem('cal2_events_' + year, JSON.stringify(evs)); _calSaveToSheets(year); }

/* ── CALENDARI ESCOLAR (Vedruna Escorial Vic) — sembra automàtica ──
   Es "sembra" un sol cop per mestre (flag a localStorage). Així una còpia
   nova de l'app ja porta els festius i vacances. Idempotent: no duplica.
   Per actualitzar el curs vinent: canvia les dades i puja CAL_ESCOLA_SEED_VER. */
const CAL_ESCOLA_SEED_VER = 'escola-2026-27-v2';
// Un sol color (gris) per a tots els dies d'escola: el nom ja diu què és.
const CAL_ESCOLA_CATS = [
  { id:'festiu', nom:'Festiu', color:'#9AA0A6' },
];
const CAL_ESCOLA_EVENTS = {
  '2026': [
    ['2026-09-08','Inici de classes','escola'],
    ['2026-09-11','Diada de Catalunya','festiu'],
    ['2026-10-12','Festa Nacional (Hispanitat)','festiu'],
    ['2026-11-02','Lliure disposició','lliure'],
    ['2026-12-07','Lliure disposició','lliure'],
    ['2026-12-08','La Immaculada','festiu'],
    ['2026-12-22','Vacances de Nadal','vacances'],
    ['2026-12-23','Vacances de Nadal','vacances'],
    ['2026-12-24','Vacances de Nadal','vacances'],
    ['2026-12-25','Nadal','festiu'],
    ['2026-12-26','Sant Esteve','festiu'],
    ['2026-12-28','Vacances de Nadal','vacances'],
    ['2026-12-29','Vacances de Nadal','vacances'],
    ['2026-12-30','Vacances de Nadal','vacances'],
    ['2026-12-31','Vacances de Nadal','vacances'],
  ],
  '2027': [
    ['2027-01-01',"Cap d'Any",'festiu'],
    ['2027-01-04','Vacances de Nadal','vacances'],
    ['2027-01-05','Vacances de Nadal','vacances'],
    ['2027-01-06','Reis','festiu'],
    ['2027-02-08','Lliure disposició','lliure'],
    ['2027-03-19','Tarda no lectiva (Mercat del Ram)','escola'],
    ['2027-03-22','Vacances de Setmana Santa','vacances'],
    ['2027-03-23','Vacances de Setmana Santa','vacances'],
    ['2027-03-24','Vacances de Setmana Santa','vacances'],
    ['2027-03-25','Vacances de Setmana Santa','vacances'],
    ['2027-03-26','Divendres Sant','festiu'],
    ['2027-03-29','Dilluns de Pasqua','festiu'],
    ['2027-04-30','Lliure disposició','lliure'],
    ['2027-05-01','Festa del Treball','festiu'],
    ['2027-05-14','Lliure disposició','lliure'],
    ['2027-05-17','Festa Local','local'],
    ['2027-06-21','Últim dia (tarda no lectiva)','escola'],
    ['2027-06-24','Sant Joan','festiu'],
    ['2027-07-05','Festa Local (Festa Major de Vic)','local'],
  ],
};
function _calSeedEscola() {
  try {
    if (localStorage.getItem('cal_escola_seed') === CAL_ESCOLA_SEED_VER) return; // ja fet
    const SCHOOL = ['festiu','vacances','local','lliure','escola']; // catIds (nou + versions antigues)
    // Una sola categoria grisa "Festiu"; treu les de colors de versions anteriors.
    //
    // IMPORTANT: si el mestre ja té la categoria "festiu", es RESPECTA tal com
    // la tingui (nom i color). Abans se substituïa per la de fàbrica, o sigui
    // que en pujar el calendari d'un curs nou tothom perdia la seva.
    const totes  = cal2LoadCats();
    const propia = totes.find(c => c.id === 'festiu');
    const cats   = totes.filter(c => SCHOOL.indexOf(c.id) === -1);
    if (propia) cats.push(propia);                        // la seva, intacta
    else CAL_ESCOLA_CATS.forEach(nc => cats.push(nc));    // encara no en tenia
    cal2SaveCats(cats);
    Object.keys(CAL_ESCOLA_EVENTS).forEach(any => {
      const evs = cal2LoadEvents(any);
      // Recolora els events d'escola ja existents cap a 'festiu' (gris)
      evs.forEach(e => { if (SCHOOL.indexOf(e.catId) !== -1) e.catId = 'festiu'; });
      // Afegeix els que falten (per data+títol → respecta el que ja hi hagi)
      CAL_ESCOLA_EVENTS[any].forEach((t, i) => {
        const data = t[0], titol = t[1];
        if (!evs.find(e => e.data === data && e.titol === titol)) {
          evs.push({ id:'esc_'+data+'_'+i, titol, data, hora:'', catId:'festiu', desc:'', link:'' });
        }
      });
      cal2SaveEvents(any, evs);
    });
    localStorage.setItem('cal_escola_seed', CAL_ESCOLA_SEED_VER);
  } catch(e) { /* silenciós */ }
}

/* Agendar */
function cal2LoadAgendar() { return JSON.parse(localStorage.getItem('cal2_agendar') || '[]'); }
function cal2SaveAgendar(a) { localStorage.setItem('cal2_agendar', JSON.stringify(a)); }

/* --- Render --- */
function renderCalendari() {
  _hydrateGCalCache();
  // Diu si el que es faci aquí anirà al Google Calendar o es quedarà a l'app.
  if (window.gwrite && gwrite.pintaCalendari) { try { gwrite.pintaCalendari(); } catch (e) {} }
  const year = _cal2Year, month = _cal2Month;
  const titleEl = document.getElementById('cal2MonthTitle');
  if (!titleEl) return;
  titleEl.textContent = MESOS_CA[month] + ' ' + year;
  document.getElementById('cal2RightTitle').textContent = 'Events de ' + MESOS_CA[month];

  // Events locals d'aquest mes
  const localEvents = cal2LoadEvents(year)
    .filter(e => { const p=(e.data||'').split('-'); return parseInt(p[0])===year && parseInt(p[1])===month+1; })
    .sort((a,b) => a.data.localeCompare(b.data));

  // GCal d'aquest mes (del cache per mes, si ja el tenim)
  const gcalKey = year + '-' + month;
  const gcalCached = _cal2GCalCache[gcalKey] || [];
  const allEvents = _mergeEvents(localEvents, gcalCached);

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

// Cache de GCal per mes (clau "year-month") i token de navegació

async function _loadGCalEvents(year, month) {
  if (!config.scriptUrl) return;
  const gcalKey = year + '-' + month;
  // Si ja tenim aquest mes en cache i és recent (< 2 min), no recarreguis
  const cached = _cal2GCalCacheMeta[gcalKey];
  if (cached && Date.now() - cached < 120000) return;

  try {
    const r = await appsScriptGet({ action: 'getGCalEvents', year, month: month + 1 });
    if (r.ok && r.events) {
      // Treu els events que hem escrit NOSALTRES al Google: si no, es veurien
      // dos cops (el de l'app i el mateix tornant de Google).
      try { if (window.gwrite) r.events = window.gwrite.filtraPropis(r.events); } catch (e) {}
      // SEMPRE desa al cache (encara que l'usuari ja no miri aquest mes)
      _cal2GCalCache[gcalKey]     = r.events;
      _cal2GCalCacheMeta[gcalKey] = Date.now();
      try { localStorage.setItem('gcal_' + gcalKey, JSON.stringify(r.events)); } catch(e) {}
      // Re-renderitza la graella NOMÉS si encara estem veient aquest mes
      if (_cal2Year === year && _cal2Month === month) {
        const localEvents = cal2LoadEvents(year)
          .filter(e => { const p=(e.data||'').split('-'); return parseInt(p[0])===year && parseInt(p[1])===month+1; })
          .sort((a,b) => a.data.localeCompare(b.data));
        const allEvents = _mergeEvents(localEvents, r.events);
        _renderCal2Grid(year, month, allEvents);
        _renderCal2EventList(allEvents);
      }
    }
  } catch(e) { /* silent */ }
}

function _mergeEvents(local, gcal) {
  // Combina locals + GCal, ordenats per data
  return [...local, ...gcal].sort((a,b) => (a.data + (a.hora||'')).localeCompare(b.data + (b.hora||'')));
}

function _updateGCalIndicator(count) { /* silenced */ }

function _renderCal2Grid(year, month, events) {
  const grid    = document.getElementById('cal2Grid');
  if (!grid) return;
  const today   = new Date();
  const first   = new Date(year, month, 1);
  const daysInM = new Date(year, month+1, 0).getDate();
  const startCol = (first.getDay() + 6) % 7;

  // Filtre ESTRICTE: només events d'aquest any+mes (evita pintar dies d'altres mesos)
  const monthEvents = events.filter(e => {
    if (!e.data) return false;
    const parts = e.data.split('-');
    return parseInt(parts[0]) === year && parseInt(parts[1]) === month + 1;
  });

  const byDay = {};
  monthEvents.forEach(e => { const d=parseInt(e.data.split('-')[2]); if(!byDay[d])byDay[d]=[]; byDay[d].push(e); });

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
function cal2PrevMonth() { _cal2Month--; if(_cal2Month<0){_cal2Month=11;_cal2Year--;} renderCalendari(); }
function cal2NextMonth() { _cal2Month++; if(_cal2Month>11){_cal2Month=0;_cal2Year++;} renderCalendari(); }
function cal2Today()     { _cal2Year=new Date().getFullYear(); _cal2Month=new Date().getMonth(); renderCalendari(); }

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
      { const _hf=document.getElementById('cal2EvHoraFi'); if(_hf) _hf.value = ev.horaFi||''; }
      document.getElementById('cal2EvGrup').value  = ev.catId||'';
      document.getElementById('cal2EvDesc').value  = ev.desc||'';
      document.getElementById('cal2EvLink').value  = ev.link||'';
    }
  } else {
    document.getElementById('cal2EvTitol').value = '';
    document.getElementById('cal2EvData').value  = prefillDate||(_cal2Year+'-'+String(_cal2Month+1).padStart(2,'0')+'-01');
    document.getElementById('cal2EvHora').value  = '';
    { const _hf=document.getElementById('cal2EvHoraFi'); if(_hf) _hf.value = ''; }
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
  document.getElementById('cal2CatList').innerHTML = cats.map((c, i) => {
    const usats = _cal2QuantsEvents(c.id);
    return `<div class="cal2-cat-fila">
      <input type="color" class="cal2-cat-color" value="${c.color}"
             title="Canviar el color"
             onchange="updateCal2Cat(${i}, 'color', this.value)">
      <input type="text" class="modal-input cal2-cat-nom" value="${escapeHtml(c.nom)}"
             placeholder="Nom de la categoria"
             onchange="updateCal2Cat(${i}, 'nom', this.value)">
      <span class="cal2-cat-us" title="Events que la fan servir">${usats || ''}</span>
      ${cats.length > 1
        ? `<button class="cal2-agendar-del" onclick="deleteCal2Cat(${i})" title="Eliminar">×</button>`
        : '<span class="cal2-cat-us"></span>'}
    </div>`;
  }).join('');
}

// Canviar el nom o el color d'una entrada de la llegenda
function updateCal2Cat(i, camp, valor) {
  const cats = cal2LoadCats();
  if (!cats[i]) return;
  if (camp === 'nom') {
    const net = (valor || '').trim();
    if (!net) { _renderCal2CatList(); return; }   // no deixem noms buits
    cats[i].nom = net;
  } else {
    cats[i].color = valor;
  }
  cal2SaveCats(cats);
  _renderCal2CatList();
  try { renderCalendari(); } catch (e) {}
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
  const cat = cats[i];
  if (!cat) return;
  // Els events no s'esborren, pero es quedarien sense color ni nom: val mes
  // dir-ho abans que trobar-s'ho despres.
  const usats = _cal2QuantsEvents(cat.id);
  if (usats > 0) {
    const msg = 'Hi ha ' + usats + ' event' + (usats > 1 ? 's' : '') + ' amb la categoria "' + cat.nom + '".\n\n' +
      'Si l\'esborres, aquests events NO es perden, pero es quedaran sense categoria (en gris).\n\n' +
      'Vols eliminar-la igualment?';
    if (!confirm(msg)) return;
  }
  cats.splice(i, 1);
  cal2SaveCats(cats);
  _renderCal2CatList();
  try { renderCalendari(); } catch (e) {}
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
    // Les de Google ara també es poden marcar: es marquen al Google Tasks.
    const checkClick = isGoogle ? `toggleGTask('${t.id}')` : `toggleTasca('${t.id}')`;
    return `<div class="tq-item${t.feta?' tq-item-feta':''}${vencuda?' tq-item-vencuda':''}${isGoogle?' tq-item-google':''}" ${itemClick}>
      <button class="tq-check${t.feta?' tq-check-done':''}" onclick="event.stopPropagation();${checkClick}" title="${t.feta?'Desfer':'Marcar com a feta'}">
        ${(isGoogle && !t.feta)?`<svg class="gtq-gicon-sm" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><path fill="#4285F4" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#34A853" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#EA4335" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>`:(t.feta?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>':'')}
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
    gId: t.id,                    // l'id de debò al Google Tasks
    gLlista: t.llistaId || '',    // i de quina llista és
    ts: 0,
  }));
  _renderTqList();
}

/* Marcar com a feta una tasca que ve del Google Tasks.
   Abans el botó de la caseta d'aquestes tasques no feia res: es pintava
   com a clicable i amb el rètol "Marcar com a feta", i no passava res.
   Ara es marca de debò al Google Tasks, que és on viu. */
async function toggleGTask(id) {
  const t = (_gtaskVirtuals || []).find(x => x.id === id);
  if (!t) return;
  if (!config.scriptUrl) { showToast('Primer configura la connexió', 'error'); return; }

  const nou = !t.feta;
  t.feta = nou;            // es pinta de seguida: la mestra veu que ha passat alguna cosa
  _renderTqList();
  updateTasquesBadge();

  const r = await appsScriptPost({
    action: 'completaGoogleTask', taskId: t.gId, llistaId: t.gLlista, fet: nou
  });

  if (r && r.ok) {
    showToast(nou
      ? "Feta ✓ Marcada al teu Google Tasks. Si t'has equivocat, desfés-ho des del Google Tasks."
      : 'Tornada a pendent', 'success');
  } else {
    t.feta = !nou;         // no ha anat: es desfà, no la deixem mentint
    _renderTqList();
    updateTasquesBadge();
    const msg = (r && r.error) || 'No s\'ha pogut marcar';
    showToast(/no s'ha trobat|not found/i.test(msg)
      ? 'Aquesta tasca ja no és al teu Google Tasks. Refresca amb el botó de sincronitzar.'
      : 'No s\'ha pogut marcar al Google Tasks: ' + msg, 'error');
  }
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
  // Els grups heterogenis es reparteixen per nota real: assegura que el resum
  // de notes esta carregat abans que el mestre premi "Generar grups".
  if (typeof _prefetchNotesResum === "function") { try { _prefetchNotesResum(); } catch (e) {} }
  _grupsNum = 3;
  _grupsCondicions = [];
  _grupsPoblarSelector();
  document.getElementById('grupsNumVal').textContent = _grupsNum;
  _renderGrupsCondicions();
  _updateGrupsHint();
  document.getElementById('grupsResultat').innerHTML = `<div class="tasques-empty">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" width="40" height="40"><circle cx="9" cy="7" r="3"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><circle cx="17" cy="7" r="3"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/></svg>
    <p>Configura els paràmetres i clica <strong>Generar grups</strong></p>
  </div>`;
}

// Alumnes que fa servir l'eina de grups (per defecte, els de tutoria)
let _grupsAlumnes = [];
// Tipus de grups: 'homo' (aleatori) o 'hetero' (equilibrat per nivell)
let _grupsTipus = 'homo';

function grupsSetTipus(tipus, btn) {
  _grupsTipus = tipus;
  document.querySelectorAll('.grups-tipus-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
}

// Pobla el selector d'assignatura amb les meves assignatures (amb grup)
function _grupsPoblarSelector() {
  const sel = document.getElementById('grupsAssigSelector');
  if (!sel) return;
  const entrades = (typeof _perfilEntradesAmbGrup === 'function') ? _perfilEntradesAmbGrup() : [];
  if (!entrades.length) {
    // Sense perfil: usa el grup de tutoria amb els students actuals
    sel.innerHTML = '<option value="">Tutoria</option>';
    _grupsAlumnes = students.slice();
    return;
  }
  sel.innerHTML = entrades.map((e,i) =>
    `<option value="${e.key}"${i===0?' selected':''}>${escapeHtml(e.label)}</option>`
  ).join('');
  // Carrega la primera assignatura
  grupsCanviaAssig();
}

// Quan es canvia d'assignatura: carrega els alumnes d'aquell grup (amb desdoblament)
async function grupsCanviaAssig() {
  const sel = document.getElementById('grupsAssigSelector');
  const hint = document.getElementById('grupsAssigHint');
  if (!sel) return;
  const matKey = sel.value;

  // Assignatura de desdoblament rotatori: carrega el grup actual (barrejant classes)
  const dd = (typeof _assigDesdobMap !== 'undefined') ? _assigDesdobMap[matKey] : null;
  if (dd) {
    if (typeof _renderDesdobControl === 'function') _renderDesdobControl('grupsDesdobBar', dd, () => grupsCanviaAssig());
    if (hint) hint.textContent = 'Carregant alumnes…';
    let alumnes = [];
    try {
      if (typeof _desdobCarregaGrups === 'function') await _desdobCarregaGrups(dd.curs, dd.assig);
      const o = (typeof _desdobOpcions === 'function') ? _desdobOpcions(dd.curs, dd.assig) : { desdob:true };
      const g = (typeof _desdobGrupActual === 'function') ? _desdobGrupActual(dd.curs, dd.assig) : null;
      if (g && o.desdob) {
        const r = await appsScriptGet({ action:'getDesdobGrup', curs:dd.curs, assignatura:dd.assig, grup:g });
        alumnes = (r && r.ok && r.alumnes) ? r.alumnes : [];
      } else if (g) {
        const r = await appsScriptGet({ action:'getGrupAlumnes', grup:g });
        alumnes = (r && r.ok && r.alumnes) ? r.alumnes : [];
      }
    } catch(e) {}
    _grupsAlumnes = alumnes.length ? alumnes : students.slice();
    if (hint) hint.textContent = `${_grupsAlumnes.length} alumnes`;
    _grupsCondicions = [];
    _renderGrupsCondicions();
    _updateGrupsHint();
    return;
  }
  const _gb = document.getElementById('grupsDesdobBar'); if (_gb) _gb.innerHTML = '';

  const grup = (typeof _assigGrupMap !== 'undefined') ? _assigGrupMap[matKey] : null;
  const nomBase = (typeof _assigNomMap !== 'undefined') ? _assigNomMap[matKey] : null;

  if (!grup) {
    // Tutoria o sense grup: usa els students actuals
    _grupsAlumnes = students.slice();
    if (hint) hint.textContent = `${_grupsAlumnes.length} alumnes`;
    _grupsCondicions = [];
    _renderGrupsCondicions();
    _updateGrupsHint();
    return;
  }

  if (hint) hint.textContent = 'Carregant alumnes…';
  // Carrega els alumnes del grup amb desdoblament SENSE tocar l'estat global
  if (typeof _carregaAlumnesGrupNet === 'function') {
    const alumnes = await _carregaAlumnesGrupNet(grup, nomBase || matKey);
    _grupsAlumnes = alumnes.length ? alumnes : students.slice();
  } else {
    _grupsAlumnes = students.slice();
  }
  if (hint) hint.textContent = `${_grupsAlumnes.length} alumnes${grup ? ' a ' + grup : ''}`;
  _grupsCondicions = []; // reinicia condicions en canviar d'assignatura
  _renderGrupsCondicions();
  _updateGrupsHint();
}

function grupsChangeNum(delta) {
  const total = ((_grupsAlumnes && _grupsAlumnes.length) ? _grupsAlumnes.length : students.length) || 20;
  _grupsNum = Math.max(2, Math.min(total, _grupsNum + delta));
  document.getElementById('grupsNumVal').textContent = _grupsNum;
  _updateGrupsHint();
}

function _updateGrupsHint() {
  const total = (_grupsAlumnes && _grupsAlumnes.length) ? _grupsAlumnes.length : students.length;
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

  const _al = (_grupsAlumnes && _grupsAlumnes.length) ? _grupsAlumnes : students;
  const opts = _al.map((s,i) => `<option value="${i}">${escapeHtml(s.nom)}</option>`).join('');

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
  const alumnes = (_grupsAlumnes && _grupsAlumnes.length) ? _grupsAlumnes : students;
  if (!alumnes.length) { showToast('No hi ha alumnes carregats', 'error'); return; }

  let grups = null;

  if (_grupsTipus === 'hetero') {
    // Heterogeni: reparteix equilibradament per nivell i PI/AM
    grups = _generarHeterogenis(alumnes);
    // Intenta respectar les condicions reordenant si cal
    if (!_compleixCondicions(grups)) {
      // Un parell d'intents més barrejant l'ordre de repartiment
      for (let intent = 0; intent < 200; intent++) {
        const candidat = _generarHeterogenis(alumnes, true);
        if (_compleixCondicions(candidat)) { grups = candidat; break; }
      }
      if (!_compleixCondicions(grups)) showToast('Grups equilibrats, però no s\'han pogut complir totes les condicions', 'error');
    }
  } else {
    // Homogeni: aleatori
    const MAX_INTENTS = 500;
    for (let intent = 0; intent < MAX_INTENTS; intent++) {
      const barrejats = _barrejar([...alumnes.map((s,i) => i)]);
      const candidat  = _formarGrups(barrejats, _grupsNum);
      if (_compleixCondicions(candidat)) { grups = candidat; break; }
    }
    if (!grups) {
      grups = _formarGrups(_barrejar([...alumnes.map((s,i) => i)]), _grupsNum);
      showToast('No s\'han pogut complir totes les condicions', 'error');
    }
  }

  _mostrarGrups(grups);
}

// Genera grups HETEROGENIS: cada grup té una barreja equilibrada de nivells.
// Reparteix PI (1/grup), AM (1/grup) i la resta ordenats per nota en serpentina.
function _generarHeterogenis(alumnes, aleatoritzar) {
  const nGrups = Math.ceil(alumnes.length / _grupsNum);
  const grups = Array.from({ length: nGrups }, () => []);

  // Classifica els alumnes per índex
  const ambPI = [], ambAM = [], resta = [];
  alumnes.forEach((s, i) => {
    const pd = personal[s.id] || {};
    const tePI = (pd.pi && pd.pi.trim()) || (s.pi && s.pi.toString().trim());
    const teAM = (pd.am && pd.am.trim()) || (s.am && s.am.toString().trim());
    if (tePI) ambPI.push(i);
    else if (teAM) ambAM.push(i);
    else resta.push(i);
  });

  // La resta, ordenats per nota mitjana de l'assignatura (de més alta a més baixa)
  const notaDe = (idx) => _grupsNotaAlumne(alumnes[idx]);
  resta.sort((a, b) => {
    const na = notaDe(a), nb = notaDe(b);
    if (na === null && nb === null) return 0;
    if (na === null) return 1;   // sense nota, al final
    if (nb === null) return -1;
    return nb - na;              // de més alta a més baixa
  });

  // Si demanem aleatoritzar (per provar condicions), barreja lleugerament
  // els empats mantenint l'ordre global aproximat
  if (aleatoritzar) {
    _barrejar(ambPI); _barrejar(ambAM);
  }

  // Reparteix PI: un a cada grup, rotant
  let g = 0;
  ambPI.forEach(idx => { grups[g % nGrups].push(idx); g++; });
  // Reparteix AM: continua la rotació perquè no s'acumulin al mateix grup
  ambAM.forEach(idx => { grups[g % nGrups].push(idx); g++; });

  // Reparteix la resta en SERPENTINA (0,1,2,2,1,0,0,1,2…) perquè els nivells
  // quedin equilibrats: cada grup rep alternativament dels forts i dels fluixos
  let dir = 1, col = g % nGrups;
  resta.forEach(idx => {
    grups[col].push(idx);
    if (dir === 1) { if (col === nGrups - 1) { dir = -1; } else col++; }
    else { if (col === 0) { dir = 1; } else col--; }
  });

  return grups;
}

// Nota mitjana d'un alumne per a l'assignatura seleccionada al generador
// (usa el cache de notes; retorna null si no en té)
/* ============================================================
   NOTA REAL D'UN ALUMNE EN UNA ASSIGNATURA
   ------------------------------------------------------------
   Font unica per a tot allo que necessita saber com va un alumne:
   el generador de grups (nivells) i el generador de comentaris.

   Prioritza el RESUM DEL FULL (fiable, hi son totes les assignatures i
   trimestres) i nomes cau al cache local si el resum encara no hi es.
   Abans nomes es mirava el cache local: si el mestre no havia obert les
   notes d'aquella assignatura, no hi havia nivell i no es deia enlloc.
   ============================================================ */
function notaAlumneMateria(nomAlumne, matKey) {
  if (!nomAlumne || !matKey) return null;
  var _pos = (typeof _fitxaPosPerNom === 'function')
    ? _fitxaPosPerNom
    : function (nom, rowNoms) {
        var nm = function (x) { return (x || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); };
        for (var i = 0; i < (rowNoms || []).length; i++) if (nm(rowNoms[i]) === nm(nom)) return i;
        return -1;
      };

  // 1) Resum del full: mitjana dels trimestres que tinguin nota
  try {
    if (typeof _notesResumCache !== 'undefined' && _notesResumCache && _notesResumCache[matKey]) {
      var per = _notesResumCache[matKey], vals = [];
      [1, 2, 3].forEach(function (t) {
        var d = per[t];
        if (!d || !Array.isArray(d.rowNoms)) return;
        var idx = _pos(nomAlumne, d.rowNoms);
        if (idx === -1) return;
        var v = d.notes ? d.notes[idx] : null;
        if (v !== null && v !== undefined && !isNaN(parseFloat(v))) vals.push(parseFloat(v));
      });
      if (vals.length) return vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
    }
  } catch (e) {}

  // 2) Cache local de notes (mitjana ponderada dels items, per trimestre)
  try {
    var _norm = function (x) { return (x || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim(); };
    var mitjanes = [];
    [1, 2, 3].forEach(function (trim) {
      var raw = localStorage.getItem('notescache_' + matKey + '_' + trim);
      if (!raw) return;
      var c = JSON.parse(raw);
      if (!c || !c.items || !c.rowNoms) return;
      var pos = null;
      c.rowNoms.forEach(function (nm, i) { if (_norm(nm) === _norm(nomAlumne)) pos = i; });
      if (pos === null) return;
      var sumaPond = 0, sumaPes = 0;
      (c.items || []).forEach(function (it) {
        if (it.id === 'actitud_ref') return;
        var v = c.valors && c.valors[it.id] ? c.valors[it.id][pos] : '';
        if (v === '' || v === null || v === undefined) return;
        var nota10 = parseFloat(v) / (it.maxPunts || 10) * 10;
        var pes = it.pes || 1;
        if (!isNaN(nota10)) { sumaPond += nota10 * pes; sumaPes += pes; }
      });
      if (sumaPes > 0) mitjanes.push(sumaPond / sumaPes);
    });
    if (mitjanes.length) return mitjanes.reduce(function (a, b) { return a + b; }, 0) / mitjanes.length;
  } catch (e) {}

  return null;
}

// Qualificacio en paraules a partir de la nota (mateixos talls que les notes)
function qualificacioText(nota) {
  if (nota === null || nota === undefined || isNaN(nota)) return null;
  if (nota >= 9) return 'Assoliment excel·lent';
  if (nota >= 7) return 'Assoliment notable';
  if (nota >= 5) return 'Assoliment satisfactori';
  return 'No assoliment';
}

function _grupsNotaAlumne(alumne) {
  try {
    var sel = document.getElementById('grupsAssigSelector');
    var matKey = sel ? sel.value : '';
    if (!matKey || !alumne) return null;
    return notaAlumneMateria(alumne.nom, matKey);
  } catch (e) { return null; }
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

  // Diu si els grups s han pogut equilibrar per nota de debo. Si no hi ha
  // notes, val mes dir-ho que deixar creure que estan repartits per nivell.
  let _avis = "";
  if (_grupsTipus === "hetero") {
    const _llista = (_grupsAlumnes && _grupsAlumnes.length) ? _grupsAlumnes : students;
    const _ambNota = _llista.filter(a => _grupsNotaAlumne(a) !== null).length;
    if (_ambNota === 0) {
      _avis = `<div class="grups-avis grups-avis-warn">Encara no hi ha notes d'aquesta assignatura, o sigui que els grups estan fets a l'atzar (tenint en compte PI i AM). Posa-hi notes i torna a generar-los per equilibrar-los per nivell.</div>`;
    } else if (_ambNota < _llista.length) {
      _avis = `<div class="grups-avis">Equilibrats per nota de ${_ambNota} de ${_llista.length} alumnes. Els altres encara no en tenen i s han repartit igualment.</div>`;
    } else {
      _avis = `<div class="grups-avis grups-avis-ok">Equilibrats per la nota mitjana dels ${_ambNota} alumnes.</div>`;
    }
  }
  let html = `<div class="grups-result-header">
    <span>${nG} grup${nG!==1?'s':''} · ${total} alumne${total!==1?'s':''}</span>
    <button class="btn btn-ghost btn-sm" onclick="generarGrups()">↺ Regenerar</button>
  </div>${_avis}<div class="grups-cards">`;

  grups.forEach((grup, gi) => {
    const col = GRUPS_COLORS[gi % GRUPS_COLORS.length];
    html += `<div class="grups-card" style="background:${col.bg};border-color:${col.border}">
      <div class="grups-card-num" style="color:${col.text}">Grup ${gi + 1}</div>
      <ul class="grups-card-list">
        ${grup.map(si => `<li style="color:${col.text}">${escapeHtml(((_grupsAlumnes && _grupsAlumnes.length) ? _grupsAlumnes : students)[si]?.nom || '')}</li>`).join('')}
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
  if (typeof _perfilUpdateGreeting === 'function') _perfilUpdateGreeting();
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

  // 2. Events del calendari d'avui i propers (fins 7 dies) — locals + Google Calendar
  const prox7 = new Date(avui); prox7.setDate(avui.getDate() + 7);
  const prox7Str = prox7.toISOString().split('T')[0];
  // Recull events de tots dos orígens per al rang de dates
  let _calProp = (cal2LoadEvents ? cal2LoadEvents(avui.getFullYear()) : []).slice();
  Object.values(_cal2GCalCache || {}).forEach(arr => { _calProp = _calProp.concat(arr || []); });
  const calEvents = _calProp
    .filter(e => e.data >= avuiStr && e.data <= prox7Str)
    .sort((a,b) => (a.data + (a.hora||'')).localeCompare(b.data + (b.hora||'')));

  if (calEvents.length) {
    html += `<div class="home-rec-section-label">Calendari proper</div>`;
    calEvents.slice(0,5).forEach(e => {
      const cat = e.fromGCal ? { color: e.calColor || '#4285F4' } : (cal2CatById ? cal2CatById(e.catId) : {color:'#4285F4'});
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

    // Events del calendari en aquest dia (locals + Google Calendar)
    const dStr = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(dNum).padStart(2,'0');
    const evs  = allEventsForDate(dStr);
    evs.slice(0,2).forEach(e => {
      const cat = e.fromGCal ? { color: e.calColor || '#4285F4' } : (cal2CatById ? cal2CatById(e.catId) : {color:'#8B5CF6'});
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
// Identificador ESTABLE d'un alumne per als assoliments: rowId si existeix
// (estable entre càrregues), si no l'id de posició (compatibilitat).
function _assimSid(s) {
  if (s && s.rowId !== undefined && s.rowId !== null && s.rowId !== '') return s.rowId;
  if (typeof s === 'object' && s) return s.id;
  // Si ens passen un id directe, mira si té rowId a personal o students
  const st = students.find(x => x.id === s);
  if (st && st.rowId !== undefined) return st.rowId;
  return s;
}
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

async function selectAssimMateria(mat, btn) {
  _assimMateria = mat;
  document.querySelectorAll('#assimMateriaSelector .trim-sel-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  // Carrega els alumnes del grup d'aquesta assignatura ABANS de renderitzar
  await _assimLoadGrupStudents(mat);
}

// Inicialitza la pàgina d'Assoliments: genera el selector i carrega els
// alumnes del grup de l'assignatura seleccionada (crític: han de ser els correctes)
async function _initAssolimentsPage() {
  if (typeof _perfilRenderAssimSelector === 'function') _perfilRenderAssimSelector();
  await _assimLoadGrupStudents(_assimMateria);
}

// Carrega els alumnes del grup associat a l'assignatura d'assoliments seleccionada
async function _assimLoadGrupStudents(matKey) {
  // Assegura't que els mapes estan poblats (selector generat)
  if ((typeof _assigGrupMap === 'undefined' || Object.keys(_assigGrupMap).length === 0)
      && typeof _perfilRenderAssimSelector === 'function') {
    _perfilRenderAssimSelector();
  }
  // Assignatura de desdoblament rotatori (p. ex. Tallers 3r): mostra el
  // selector de grup i carrega el grup actual (barrejant classes).
  const dd = (typeof _assigDesdobMap !== 'undefined') ? _assigDesdobMap[matKey] : null;
  if (dd) {
    if (typeof _renderDesdobControl === 'function') _renderDesdobControl('assimDesdobBar', dd, () => _assimLoadGrupStudents(matKey));
    if (typeof _loadDesdobStudents === 'function') await _loadDesdobStudents(dd.curs, dd.assig);
    renderAssoliments();
    return;
  }
  const _bar = document.getElementById('assimDesdobBar'); if (_bar) _bar.innerHTML = '';

  const grup = (typeof _assigGrupMap !== 'undefined') ? _assigGrupMap[matKey] : null;
  const nomBase = (typeof _assigNomMap !== 'undefined') ? _assigNomMap[matKey] : null;
  if (!grup) {
    // Sense grup associat: usa el grup de tutoria
    if (typeof _restoreTutoriaStudents === 'function') _restoreTutoriaStudents();
    renderAssoliments();
    return;
  }
  if (typeof _ensureGrupStudents === 'function') {
    // _ensureGrupStudents ja aplica el desdoblament si l'assignatura n'és
    await _ensureGrupStudents(grup, nomBase || matKey);
    renderAssoliments();
  }
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
      const val = assimValGet(_assimSid(s), obj.id);
      if (val === true)       punts += 1;
      else if (val === 'partial') punts += 0.5;
      const cls = val === true ? 'assim-cell assolit' : val === 'partial' ? 'assim-cell parcial' : val === false ? 'assim-cell no-assolit' : 'assim-cell buit';
      const icon = val === true ? '✓' : val === 'partial' ? '~' : val === false ? '✗' : '—';
      html += `<td class="${cls}" onclick="toggleAssim(${_assimSid(s)},'${obj.id}',this)">${icon}</td>`;
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
  if (!list) return; // el resum no es mostra en aquesta pantalla: no facis res
  if (!objectius.length || !students.length) {
    list.innerHTML = '<p class="home-empty-hint">Afegeix objectius per veure el resum.</p>';
    return;
  }

  list.innerHTML = students.map(s => {
    let puntsR = 0;
    objectius.forEach(obj => {
      const v = assimValGet(_assimSid(s), obj.id);
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
    if (!s || _assimSid(s) !== sid) return;
    let punts = 0;
    objectius.forEach(obj => {
      const v = assimValGet(_assimSid(s), obj.id);
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
  students.forEach(s => localStorage.removeItem(assimValKey(_assimSid(s), id)));
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
  students.forEach(s => localStorage.removeItem(assimValKey(_assimSid(s), _assimEditObjId)));
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
      const sid = _assimSid(s);
      data[sid] = {};
      objs.forEach(obj => {
        const v = localStorage.getItem(`assim_${materia}_${trimestre}_${sid}_${obj.id}`);
        data[sid][obj.id] = v !== null ? JSON.parse(v) : null;
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
// True si el bootstrap ha portat TOTES les dades fa poc: els carregadors per
// pàgina (perfil/horari/post-its/seients) el fan servir per no refer una crida
// redundant en navegar (segueixen pintant del cache local igualment).
function _recentFullLoad() { return _lastFullLoadTs > 0 && Date.now() - _lastFullLoadTs < 60000; }

/* --- CÀRREGA INICIAL COMPLETA (una sola crida consolidada) --- */
async function loadAllFromSheets() {
  if (!config.scriptUrl) return;
  const year = new Date().getFullYear();
  const weekIds = [getPlanWeekId(-1), getPlanWeekId(0), getPlanWeekId(1)];

  try {
    const r = await appsScriptGet({ action: 'loadAppData', weekIds: JSON.stringify(weekIds) });
    if (!r.ok) return;
    _processAppData(r);
    _lastFullLoadTs = Date.now();
  } catch(e) { /* offline: usa el cache local */ }
}

// Processa les dades de planning/tasques/calendari/assoliments/actitud
// (compartit entre loadAllFromSheets i _applyBootstrap)
function _processAppData(r) {
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
  // Sembra el calendari escolar (un cop per mestre; una còpia nova ja el porta)
  if (typeof _calSeedEscola === 'function') _calSeedEscola();
  // Assoliments
  if (r.assim) Object.entries(r.assim).forEach(([key, val]) => {
    if (key.startsWith('obj_')) {
      localStorage.setItem('assim_obj_' + key.slice(4), val);
    } else if (key.startsWith('vals_')) {
      const matTrim = key.slice(5);
      const parsed = JSON.parse(val);
      Object.entries(parsed).forEach(([sid, vals]) => {
        if (vals) Object.entries(vals).forEach(([objId, v]) => {
          if (v !== null) localStorage.setItem(`assim_${matTrim}_${sid}_${objId}`, JSON.stringify(v));
        });
      });
    }
  });
  // Actitud
  if (r.actitud) Object.entries(r.actitud).forEach(([matTrim, val]) => {
    const parsed = JSON.parse(val);
    Object.entries(parsed).forEach(([sid, dades]) => {
      localStorage.setItem(`actitud_${matTrim}_${sid}`, JSON.stringify(dades));
    });
  });
}

// Aplica TOT el que retorna la crida única bootstrap
function _applyBootstrap(boot) {
  // 0) El servidor està al dia? Enganxar el Code.gs nou al Apps Script NO
  //    n'hi ha prou: cal desplegar-ne una versió nova, i si no es fa tot es
  //    veu malament sense que res ho digui. Va passar el 4 de setembre del
  //    2026: la pàgina de les famílies ensenyava "UNDEFINED, NAN DE
  //    UNDEFINED" i dates de 1899 perquè servia codi vell.
  _avisaBackendVell(boot && boot.backendVersio);

  // 1) Perfil (i menú d'assignatures)
  if (boot.profile) {
    _perfil = (typeof _perfilMigrar === 'function')
      ? _perfilMigrar(Object.assign({ nom:'', tutorCurs:null, tutorLinia:null, classes:{} }, boot.profile))
      : boot.profile;
    try { localStorage.setItem('vedruna_perfil', JSON.stringify(_perfil)); } catch(e) {}
    if (typeof _perfilRender === 'function') _perfilRender();
    if (typeof _perfilUpdateNav === 'function') _perfilUpdateNav();
    if (typeof perfilRenderAllSelectors === 'function') perfilRenderAllSelectors();
  }

  // 2) Alumnes: prioritza els del grup de tutoria (full "Grups").
  // Protecció: no toquis la llista d'alumnes si l'usuari està editant ara mateix.
  const editant = (typeof _isEditing === 'function') && _isEditing();
  const teTutoria = boot.tutorGrup && boot.grupAlumnes && boot.grupAlumnes.length;
  if (teTutoria && !editant) {
    if (typeof _aplicaTutoriaAlumnes === 'function') {
      _tutoriaGrup = boot.tutorGrup;
      _aplicaTutoriaAlumnes(boot.grupAlumnes);
      try { localStorage.setItem('tutoriacache_' + boot.tutorGrup, JSON.stringify({ alumnes: boot.grupAlumnes, ts: Date.now(), v: (window.versioApp && window.versioApp.actual) || '' })); } catch(e) {}
    }
  } else if (boot.alumnes && boot.alumnes.length && !editant && !boot.tutorGrup && !_rolDireccio()) {
    // (a direcció, els alumnes són sempre els del grup triat, mai els del
    //  full personal: si no, en arrencar hi sortiria una llista que no és
    //  de cap grup i s'hi podrien escriure dades a qui no toca)
    students = boot.alumnes;
    if (boot.personal) {
      personal = {};
      boot.personal.forEach(function(p) {
        personal[p.id] = { mare: p.mare, pare: p.pare, emailMare: p.emailMare, emailPare: p.emailPare, obs: p.obs, pi: p.pi||'', am: p.am||'', especific: p.especific||'' };
      });
    }
  }

  // 3) Registre i observacions
  if (boot.registre) { registreItems = boot.registre.items; registreData = boot.registre.data; }
  // Observacions: prioritza les compartides del full "Grups" (per rowId → id)
  if (boot.grupObs && boot.grupAlumnes && boot.grupAlumnes.length) {
    observacions = {};
    const rowIdToId = {};
    boot.grupAlumnes.forEach(a => { rowIdToId[String(a.rowId)] = a.id; });
    Object.keys(boot.grupObs).forEach(rowId => {
      const id = rowIdToId[String(rowId)];
      if (id !== undefined) observacions[id] = boot.grupObs[rowId];
    });
  } else if (boot.observacions) {
    observacions = boot.observacions;
  }

  // 4) Planning/tasques/calendari/assoliments/actitud
  _processAppData(boot);
  _lastFullLoadTs = Date.now();

  // 5) Seients
  if (boot.seients && typeof _applySeientsData === 'function') {
    try { _applySeientsData(boot.seients); } catch(e) {}
  }

  // 6) Post-its
  if (boot.postits && Array.isArray(boot.postits)) {
    try {
      if (typeof _postits !== 'undefined') _postits = boot.postits;
      localStorage.setItem('postits', JSON.stringify(boot.postits));
    } catch(e) {}
  }
  if (boot.horari && typeof boot.horari === 'object') {
    try {
      if (typeof _horari !== 'undefined') _horari = boot.horari;
      localStorage.setItem('horari', JSON.stringify(boot.horari));
    } catch(e) {}
  }
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
/* Els objectius d'avaluació de cada assignatura.
   BUIT a posta: aquesta és la plantilla mare. Cada mestra es fa els seus
   des del generador de comentaris → "Editar objectius" (o els importa d'un
   document), i es desen al SEU full. Quan l'app els carrega, rubriques.js
   els posa aquí dins amb la mateixa forma { nom, objectius: [...] }.
   Mentre una assignatura no en tingui, el generador ho diu clarament en
   comptes d'inventar-se res. */
const RUBRIQUES = {};

const NIVELL_INFO = [
  { key: 'mba',  label: 'Molt ben assolit', short: 'MBA',  cls: 'badge-mba'  },
  { key: 'ass',  label: 'Assolit',          short: 'AS',   cls: 'badge-ass'  },
  { key: 'aaj',  label: 'Assolit amb ajuda',short: 'AAJ',  cls: 'badge-aaj'  },
  { key: 'nass', label: 'No assolit',        short: 'NA',   cls: 'badge-nass' },
];

let _comentAssig   = 'matematiques';
let _comentAlumne  = null;
let _comentSeleccions = {}; // { objIdx: nivellIdx (0-3) }

async function selectComentAssig(assig, btn) {
  _comentAssig = assig;
  document.querySelectorAll('#comentAssigSelector .trim-sel-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  _comentSeleccions = {};
  renderComentRubrica();
  try { _comentPintaApunts(); } catch (e) {}
  // Cada assignatura pot ser d'un grup diferent: canvia també els alumnes.
  await _comentCarregaAlumnesDelGrup(assig);
  renderComentRubrica();
}

function onComentAlumneChange() {
  const sel = document.getElementById('comentAlumneSelect');
  _comentAlumne = sel.value || null;
  _comentSeleccions = {};
  renderComentRubrica();
  try { _comentPintaApunts(); } catch (e) {}
}

function renderComentRubrica() {
  const rubrica = RUBRIQUES[_comentAssig];
  const container = document.getElementById('comentRubrica');
  const genBtn    = document.getElementById('comentGenBtn');

  if (!rubrica || !rubrica.objectius.length) {
    // Abans deia "s'afegirà quan tinguis els objectius definitius": en passiva,
    // com si els hagués de posar algú altre. Els objectius se'ls fa cada mestra,
    // així que ha de quedar clar què ha de fer ella i on ho fa.
    const nomAssig = rubrica?.nom || document.querySelector('#comentAssigSelector .trim-sel-btn.active')?.textContent.trim() || _comentAssig;
    container.innerHTML =
      `<div class="tasques-empty" style="margin-top:12px">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" width="36" height="36"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
        <p>Encara no has escrit els objectius de <strong>${escapeHtml(nomAssig)}</strong>.<br>
        Clica <strong>Editar objectius</strong> per escriure'ls, o importa'ls d'un document que ja tinguis.</p>
        <button class="btn btn-primary btn-sm" style="margin-top:10px"
          onclick="rubriques && rubriques.obreEditor()">Editar objectius</button>
      </div>`;
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
      // Un objectiu sense criteris (o incomplet) no ha de fer petar la pagina
      const tooltip = escapeHtml((obj.nivells || [])[j] || '').replace(/"/g, '&quot;');
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

/* ============================================================
   COM ES DEMANA EL COMENTARI A LA IA
   ------------------------------------------------------------
   El problema d'abans: el prompt era SEMPRE identic ("un unic paragraf
   de 5-8 linies"), o sigui que els 25 comentaris d'un grup sortien tots
   amb la mateixa forma. I deia "mestre de 2n de Primaria" escrit a ma,
   quan cada mestre fa un curs diferent.

   Ara:
   - El curs surt del perfil del mestre.
   - L'estructura VARIA a cada comentari (obertura, ordre, paragrafs).
   - El mestre pot definir el seu estil, i sobretot ENGANXAR comentaris
     seus perque la IA els imiti. Aixo es el que fa que soni a ell.
   - La nota real de l'alumne entra al comentari com a context.
   ============================================================ */

// Estil de redaccio del mestre (es desa al seu full; el gestiona rubriques.js)
function comentEstilLlegeix() {
  try { return JSON.parse(localStorage.getItem('coment_estil') || '{}') || {}; }
  catch (e) { return {}; }
}

// Curs del mestre, del perfil. Sense perfil, res inventat.
function _comentCursText() {
  try {
    if (typeof _perfil !== 'undefined' && _perfil && _perfil.tutorCurs) {
      return _perfil.tutorCurs + ' de Primaria';
    }
    // Sense tutoria (especialista): el curs surt del grup de l'assignatura
    // que té triada ara mateix. Abans deia nomes "Primaria".
    var k = (typeof _comentAssig !== 'undefined') ? _comentAssig : null;
    if (k) {
      var g = (typeof _assigGrupMap !== 'undefined' && _assigGrupMap[k]) ? _assigGrupMap[k] : null;
      if (!g && typeof _assigDesdobMap !== 'undefined' && _assigDesdobMap[k]) g = _assigDesdobMap[k].curs;
      if (g) return g.toString().split(' ')[0] + ' de Primaria';
    }
  } catch (e) {}
  return 'Primaria';
}

// Estructures possibles. Se n'agafa una a l'atzar perque dos comentaris
// seguits no tinguin la mateixa forma.
var _COMENT_FORMES = [
  { id: 'fortalesa', pauta: 'Comenca destacant allo que li surt millor i despres passa al que encara ha de consolidar.' },
  { id: 'progres',   pauta: 'Comenca per com ha anat el trimestre en conjunt i despres concreta punt per punt.' },
  { id: 'proces',    pauta: 'Comenca per la manera de treballar i l\'actitud a l\'aula, i despres entra en els continguts.' },
  { id: 'directe',   pauta: 'Entra directament en els continguts treballats, sense preambul, i tanca amb una mirada endavant.' },
  { id: 'evolucio',  pauta: 'Explica-ho com una evolucio: d\'on partia, on es ara i cap on ha d\'anar.' },
];
var _COMENT_LONG = {
  curt:   'Entre 3 i 4 linies. Ves al gra.',
  mitja:  'Entre 5 i 7 linies.',
  llarg:  'Entre 8 i 10 linies, amb mes detall.',
};
var _COMENT_FORMA_ULT = null;

function _comentTriaForma() {
  var opcions = _COMENT_FORMES.filter(function (f) { return f.id !== _COMENT_FORMA_ULT; });
  var f = opcions[Math.floor(Math.random() * opcions.length)] || _COMENT_FORMES[0];
  _COMENT_FORMA_ULT = f.id;
  return f;
}

// Construeix el prompt: esborrany + estil del mestre + nota + forma variable
/* ---- Apunts que el mestre ha escrit activitat per activitat ----
   Es recullen de les notes de cada trimestre d'aquesta assignatura. Son
   el material mes valuos que hi ha per al comentari: son seus i concrets. */
function comentApuntsActivitats(nomAlumne, matKey) {
  if (!nomAlumne || !matKey) return [];
  var out = [];
  var _pos = (typeof _fitxaPosPerNom === 'function') ? _fitxaPosPerNom : null;
  [1, 2, 3].forEach(function (trim) {
    // Pot estar desat amb grup o sense: mirem les dues formes
    var claus = Object.keys(localStorage).filter(function (k) {
      return k.indexOf('notescache_' + matKey + '_' + trim) === 0;
    });
    claus.forEach(function (clau) {
      var c = null;
      try { c = JSON.parse(localStorage.getItem(clau) || 'null'); } catch (e) {}
      if (!c || !c.comentaris || !c.rowNoms) return;
      var idx = _pos ? _pos(nomAlumne, c.rowNoms) : -1;
      if (idx === -1) return;
      (c.items || []).forEach(function (it) {
        var txt = (c.comentaris[it.id] || {})[idx];
        if (txt && String(txt).trim()) {
          out.push({ activitat: it.nom || 'Activitat', text: String(txt).trim() });
        }
      });
    });
  });
  return out;
}

// Interruptor: es recorda amb la resta de preferencies de redaccio
function comentToggleApunts(valor) {
  var e = {};
  try { e = JSON.parse(localStorage.getItem('coment_estil') || '{}') || {}; } catch (err) {}
  e.usarApunts = !!valor;
  try { localStorage.setItem('coment_estil', JSON.stringify(e)); } catch (err) {}
  if (typeof config !== 'undefined' && config.scriptUrl) {
    appsScriptPost({ action: 'saveComentEstil', data: e }).catch(function () {});
  }
  _comentPintaApunts();
}

// Diu quants apunts te aquest alumne, perque el mestre sapiga si serviran
function _comentPintaApunts() {
  var info = document.getElementById('comentApuntsInfo');
  var cb = document.getElementById('comentUsarApunts');
  if (!info || !cb) return;
  var e = {};
  try { e = JSON.parse(localStorage.getItem('coment_estil') || '{}') || {}; } catch (err) {}
  cb.checked = !!e.usarApunts;

  var al = (typeof students !== 'undefined' && _comentAlumne)
    ? students.find(function (s) { return String(s.id) === String(_comentAlumne); }) : null;
  if (!al) { info.textContent = 'Tria un alumne per veure quants n\'hi ha.'; return; }
  var ap = comentApuntsActivitats(al.nom, _comentAssig);
  if (!ap.length) {
    info.textContent = 'Aquest alumne encara no té cap apunt en aquesta assignatura.';
  } else {
    info.textContent = ap.length === 1
      ? 'Es farà servir 1 apunt que has escrit.'
      : 'Es faran servir ' + ap.length + ' apunts que has escrit.';
  }
}

function _comentPrompt(rubrica, alumne, esborrany) {
  var estil   = comentEstilLlegeix();
  var nomCurt = alumne.nom.split(' ')[0];
  var article = _articleNom(nomCurt, alumne.genere);
  var forma   = _comentTriaForma();
  var llarg   = _COMENT_LONG[estil.llargada] || _COMENT_LONG.mitja;

  var parts = [];
  parts.push('Ets un mestre de ' + _comentCursText() + ' a Catalunya i escrius el comentari de l\'informe trimestral ' +
             'de ' + article + nomCurt + ' per a l\'area de ' + rubrica.nom + '.');

  // Exemples del mestre: el que de debo fa que soni a ell
  if (estil.exemples && estil.exemples.trim()) {
    parts.push('\nAQUESTS son comentaris escrits per MI en altres ocasions. Fixa\'t en com escric ' +
               '(vocabulari, longitud de les frases, com comenco i com tanco, com dic les coses ' +
               'delicades) i escriu com escriuria jo. NO en copiis el contingut, nomes la manera:\n"""\n' +
               estil.exemples.trim() + '\n"""');
  }

  parts.push('\nIDEES QUE HA DE CONTENIR (venen de la rubrica que he marcat jo):\n"""\n' + esborrany + '\n"""');

  // Apunts que el mestre ha escrit activitat per activitat
  if (estil.usarApunts) {
    var ap = comentApuntsActivitats(alumne.nom, _comentAssig);
    if (ap.length) {
      parts.push('\nAPUNTS MEUS D\'AQUEST ALUMNE, activitat per activitat. Son observacions ' +
        'que he escrit jo mentre corregia. Fes-los servir per concretar el comentari amb coses ' +
        'que han passat de debo, pero NO els copiïs literalment ni anomenis les activitats ' +
        'una per una:\n"""\n' +
        ap.map(function (a) { return '- ' + a.activitat + ': ' + a.text; }).join('\n') +
        '\n"""');
    }
  }

  // La nota real, com a context
  var nota = (typeof notaAlumneMateria === 'function') ? notaAlumneMateria(alumne.nom, _comentAssig) : null;
  if (nota !== null && !isNaN(nota)) {
    var qual = (typeof qualificacioText === 'function') ? qualificacioText(nota) : null;
    parts.push('\nCONTEXT: la seva nota mitjana en aquesta area es ' + (Math.round(nota * 10) / 10) +
               ' sobre 10' + (qual ? ' (' + qual + ')' : '') + '. El to del comentari ha de ser coherent amb ' +
               'aquesta nota, pero NO la mencionis ni parlis de xifres.');
  }

  parts.push('\nCOM HO HAS D\'ESCRIURE:');
  parts.push('- ' + forma.pauta);
  parts.push('- ' + llarg);
  parts.push('- Conserva TOTES les idees que t\'he donat. No n\'afegeixis de noves ni te\'n deixis cap.');
  parts.push('- Anomena\'l ' + article + nomCurt + ' una sola vegada; despres evita repetir el nom.');
  if (estil.to === 'proper')      parts.push('- To proper i calid, com qui parla amb la familia de tu a tu.');
  else if (estil.to === 'formal') parts.push('- To formal i professional.');
  else                            parts.push('- To professional pero proper, adequat per a families.');
  parts.push('- Catala correcte i natural. Res de formules fetes ni de llenguatge de manual.');
  parts.push('- NO comencis amb la mateixa formula que faria servir tothom ("Al llarg d\'aquest trimestre...", ' +
             '"Cal destacar que..."). Busca una obertura propia.');
  parts.push('- Nomes el text del comentari: sense titol, sense encapcalament i sense firma.');
  if (estil.extra && estil.extra.trim()) parts.push('- ' + estil.extra.trim());

  return parts.join('\n');
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

  // Es prova sempre de generar amb IA (clau local o backend). Si no n'hi ha
  // cap disponible o falla, el catch mostrarà l'esborrany directament.

  // Mostra spinner al modal mentre la IA redacta
  document.getElementById('comentResultTitle').textContent = 'Generant…';
  document.getElementById('comentTextBox').innerHTML = '<div class="coment-loading"><div class="coment-spinner"></div>Gemini està redactant el comentari…</div>';
  document.getElementById('comentResultConsell').textContent = '';
  document.getElementById('comentResultOverlay').classList.add('open');

  const prompt = _comentPrompt(rubrica, alumne, esborrany);

  const _callGemini = async () => {
    return await _geminiGenerate(prompt);
  };

  try {
    let text;
    try {
      text = await _callGemini();
    } catch(e) {
      if (e.is429 || e.isBusy) {
        // Saturat o massa peticions: son casos temporals. Avisem en catala i
        // reintentem sol (fins a 2 cops), que sol ser prou per resoldre'l.
        const _espera = e.isBusy ? 3000 : 4000;
        const _txt = e.isBusy
          ? 'La IA de Google va plena ara mateix. Ho torno a provar…'
          : 'Límit de peticions assolit, reintentant…';
        let _ok = false;
        for (let _i = 0; _i < 2 && !_ok; _i++) {
          document.getElementById('comentTextBox').innerHTML =
            '<div class="coment-loading"><div class="coment-spinner"></div>' + _txt + '</div>';
          await new Promise(r => setTimeout(r, _espera));
          try { text = await _callGemini(); _ok = true; }
          catch(e2) { if (!(e2.is429 || e2.isBusy) || _i === 1) throw e2; }
        }
      } else throw e;
    }
    _mostrarComentari(text, rubrica, alumne, true);
  } catch(e) {
    _mostrarComentari(esborrany, rubrica, alumne, false);
    const msg = e.isBusy
      ? "La IA de Google està saturada en aquest moment. T'he deixat l'esborrany de la rúbrica; torna-ho a provar d'aquí un minut."
      : e.is429
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
  // Botons d'assignatura: des del perfil (grup de tutoria), no una llista fixa.
  // Així no surt "Música" si no la fas, i hi surten les teves (Castellà, L'art
  // del traç…). Les que encara no tenen rúbrica ho indiquen en seleccionar-les.
  const selBar = document.getElementById('comentAssigSelector');
  if (selBar) {
    // Abans això només mirava les assignatures de la TUTORIA. Una especialista
    // (sense tutoria) es quedava amb la llista de reserva —Matemàtiques, Català,
    // Medi, Anglès— i no podia triar la seva assignatura de cap manera.
    // Ara fem servir la mateixa font que Assoliments i el Generador de grups:
    // totes les seves entrades, tutoria i altres cursos.
    const entrades = (typeof _perfilEntradesAmbGrup === 'function') ? _perfilEntradesAmbGrup() : [];
    if (entrades.length) {
      entrades.forEach(e => {
        if (typeof MATERIES !== 'undefined' && !MATERIES[e.key]) MATERIES[e.key] = e.label;
        if (e.altres) { if (typeof _assigDesdobMap !== 'undefined') _assigDesdobMap[e.key] = { curs: e.curs, assig: e.nom, rotatori: e.rotatori }; }
        else if (typeof _assigGrupMap !== 'undefined') _assigGrupMap[e.key] = e.grup;
        if (typeof _assigNomMap !== 'undefined') _assigNomMap[e.key] = e.nom;
      });
      if (!entrades.some(e => e.key === _comentAssig)) _comentAssig = entrades[0].key;
      selBar.innerHTML = entrades.map(e =>
        `<button class="trim-sel-btn${e.key===_comentAssig?' active':''}" data-assig="${e.key}" onclick="selectComentAssig('${e.key}',this)">${escapeHtml(e.label)}</button>`
      ).join('');
    } else {
      // Encara no ha omplert el perfil: no inventem assignatures que no fa.
      selBar.innerHTML = '<span class="modal-hint">Omple el teu perfil per triar assignatura.</span>';
    }
  }
  // Deixa l interruptor dels apunts i el seu avis al dia
  try { _comentPintaApunts(); } catch (e) {}
  _comentOmpleAlumnes();
  // Carrega els alumnes del grup d'aquesta assignatura (una especialista no en
  // té cap de "seu": els seus alumnes són els del curs on fa classe).
  _comentCarregaAlumnesDelGrup(_comentAssig);
}

/* Omple el desplegable amb els alumnes que hi ha ara a `students`. */
function _comentOmpleAlumnes() {
  const sel = document.getElementById('comentAlumneSelect');
  if (!sel) return;
  const anterior = sel.value;
  sel.innerHTML = '<option value="">— Selecciona un alumne —</option>' +
    students.map(s => `<option value="${s.id}">${escapeHtml(s.nom)}</option>`).join('');
  // Manté l'alumne triat si encara hi és
  if (anterior && students.some(s => String(s.id) === String(anterior))) sel.value = anterior;
  else if (_comentAlumne && !students.some(s => String(s.id) === String(_comentAlumne))) _comentAlumne = null;
}

/* Els alumnes que toquen per a l'assignatura triada, igual que fa Assoliments. */
async function _comentCarregaAlumnesDelGrup(matKey) {
  if (!matKey) return;
  const dd = (typeof _assigDesdobMap !== 'undefined') ? _assigDesdobMap[matKey] : null;
  if (dd) {
    if (typeof _loadDesdobStudents === 'function') await _loadDesdobStudents(dd.curs, dd.assig);
    _comentOmpleAlumnes();
    return;
  }
  const grup = (typeof _assigGrupMap !== 'undefined') ? _assigGrupMap[matKey] : null;
  const nomBase = (typeof _assigNomMap !== 'undefined') ? _assigNomMap[matKey] : null;
  if (!grup) {
    if (typeof _restoreTutoriaStudents === 'function') _restoreTutoriaStudents();
    _comentOmpleAlumnes();
    return;
  }
  if (typeof _ensureGrupStudents === 'function') {
    await _ensureGrupStudents(grup, nomBase || matKey);
    _comentOmpleAlumnes();
  }
}

/* ============================================================
   EL SERVIDOR ESTÀ AL DIA?
   ------------------------------------------------------------
   L'app (aquest codi) s'actualitza sola des del GitHub Pages.
   El Code.gs, en canvi, viu al Apps Script i NO s'actualitza
   sol: s'hi ha d'enganxar el codi nou i, sobretot, desplegar-ne
   una VERSIÓ NOVA. Si això no es fa, l'app nova parla amb un
   servidor vell i surten coses rares —dates de 1899, pantalles
   buides— sense que res ho expliqui.

   Aquest avís ho fa visible. Surt a dalt de tot i no se'n va
   fins que el servidor està al dia.
   ============================================================ */
/* De 'v153' a 153. Torna null si no ho sap llegir. */
function _numVersio(v) {
  const m = /^v(\d+)$/.exec(String(v || '').trim());
  return m ? parseInt(m[1], 10) : null;
}

function _avisaBackendVell(versioServidor) {
  const va = (typeof window.versioApp === 'object' && window.versioApp) || {};
  const meva = va.actual || null;
  const id = 'avisBackendVell';
  const vell = document.getElementById(id);

  // ⚠ NO es compara la igualtat, sinó el MÍNIM que aquesta app necessita.
  // Amb la igualtat, un canvi de només CSS ja treia la franja groga i
  // obligava a redesplegar el servidor per no res.
  const minim = _numVersio(va.minimServidor);
  const servidor = _numVersio(versioServidor);
  const prouNou = (minim === null || servidor === null) ? true : servidor >= minim;

  // Sense resposta del servidor, sense saber la nostra versió, o amb un
  // servidor prou nou: no diem res.
  if (!meva || !versioServidor || prouNou) { if (vell) vell.remove(); return; }
  if (vell) return;                                  // ja hi és

  const d = document.createElement('div');
  d.id = id;
  d.className = 'avis-backend';
  d.setAttribute('role', 'status');
  d.innerHTML =
    '<strong>El servidor s\'ha quedat enrere.</strong> ' +
    'L\'app és la ' + escapeHtml(meva) + ' i el Google Apps Script encara serveix la ' +
    escapeHtml(versioServidor) + '. Fins que no el tornis a desplegar, hi haurà coses ' +
    'que es veuran malament (dates estranyes, pantalles buides).' +
    '<span class="avis-backend-com">Al teu full: <b>Extensions → Apps Script</b>, ' +
    'enganxa-hi el <b>Code.gs</b> nou i després <b>Implementa → Gestiona implementacions → ' +
    'el llapis → Versió: Nova versió → Desplega</b>. ' +
    '<b>No facis «Nova implementació»</b>: això crea una adreça nova i la teva app seguiria ' +
    'parlant amb la vella.</span>';
  document.body.insertBefore(d, document.body.firstChild);
}

/* ⚠ Aquí hi havia «Portar les llistes de l'escola» i «Alumnes que l'app no
   sap qui són». Van fora el 5/9/2026, a petició d'en Pol: «són coses que
   només he de poder tocar jo com a desenvolupador des de l'script».

   No s'han perdut: viuen a l'Apps Script, que és on toca —`provaLlistes()`
   i `grupsSincronitzaDEBO()` per a les llistes; `veureAlies()`, `posaAlies()`
   i `aplicaFitxesDEBO()` per als alumnes que no se sap qui són. I des de la
   v183 tot plegat ja es fa sol cada quart d'hora, o sigui que ni ell hi ha
   d'anar gairebé mai. */
