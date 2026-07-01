/* ============================================================
   Vedruna Escorial Vic — notes.js
   ============================================================ */

/* --- Estat global --- */
let notesItems   = [];
let notesValors  = {};
let noEntregats  = {};
let notesContext = { materia: null, trimestre: null };

/* --- Cua de guardament serial (evita pèrdues) --- */
let _saveQueue  = Promise.resolve();
let _pendingMap = {};

/* --- Cache local per assignatura+trimestre (TTL 10 min, persistent) --- */
const _cache   = {};
const CACHE_MS = 10 * 60 * 1000;
function _cacheKey()        { return notesContext.materia + '_' + notesContext.trimestre; }
function _cachePersistKey() { return 'notescache_' + _cacheKey(); }
function _cacheGet() {
  let c = _cache[_cacheKey()];
  if (!c) {
    try {
      const raw = localStorage.getItem(_cachePersistKey());
      if (raw) { c = JSON.parse(raw); _cache[_cacheKey()] = c; }
    } catch(e) {}
  }
  if (!c || Date.now() - c.ts > CACHE_MS) { _cacheDel(); return null; }
  return c;
}
function _cacheSet(d) {
  const entry = { ...d, ts: Date.now() };
  _cache[_cacheKey()] = entry;
  try { localStorage.setItem(_cachePersistKey(), JSON.stringify(entry)); } catch(e) {}
}
function _cacheDel() {
  delete _cache[_cacheKey()];
  try { localStorage.removeItem(_cachePersistKey()); } catch(e) {}
}

// Precarrega en segon pla les notes de TOTES les assignatures del trimestre actual.
// Es desen al cache persistent perquè obrir qualsevol assignatura sigui instantani.
async function prefetchAllNotes() {
  if (!config.scriptUrl) return;
  const MATS  = ['matematiques','catala','medi','musica','angles'];
  const trim  = (typeof getTrimestreActual === 'function' ? getTrimestreActual() : null) || 1;
  // Carrega en sèrie suau (una rere l'altra) per no saturar Apps Script
  for (const mat of MATS) {
    const persistKey = 'notescache_' + mat + '_' + trim;
    try {
      // Si ja hi ha cache fresc, salta
      const raw = localStorage.getItem(persistKey);
      if (raw) {
        const c = JSON.parse(raw);
        if (c && Date.now() - c.ts < CACHE_MS) continue;
      }
      const r = await appsScriptGet({ action: 'getNotes', materia: mat, trimestre: trim });
      if (r.ok) {
        const entry = { items: r.items || [], valors: r.valors || {}, noEntregats: r.noEntregats || {}, ts: Date.now() };
        _cache[mat + '_' + trim] = entry;
        localStorage.setItem(persistKey, JSON.stringify(entry));
      }
    } catch(e) { /* silent, es carregarà quan s'obri */ }
  }
}

/* --- Qualificacions --- */
const QUALS = [
  { min: 0,   max: 4.99, codi: 'NA', bg: '#FEE2E2', color: '#991B1B' },
  { min: 5,   max: 6.99, codi: 'AS', bg: '#FEF3C7', color: '#92400E' },
  { min: 7,   max: 8.99, codi: 'AN', bg: '#DBEAFE', color: '#1E40AF' },
  { min: 9,   max: 10,   codi: 'AE', bg: '#D1FAE5', color: '#065F46' },
];
function getQual(n)      { if (n === null || n === undefined || isNaN(n)) return null; for (const q of QUALS) if (n >= q.min && n <= q.max) return q; return QUALS[0]; }
function getQualCodi(n)  { const q = getQual(n); return q ? q.codi : ''; }
function sobre10(p, max) { if (!max || p === '' || p === null || p === undefined) return null; const n = parseFloat(p); return isNaN(n) ? null : Math.round(n / max * 10 * 100) / 100; }
function arrod(mitj)     { return mitj === null || mitj === undefined ? null : Math.floor(mitj + 0.5); }

/* --- Càlcul mitjana local --- */
function calcMitjana(sid) {
  let sumV = 0, sumP = 0;
  for (const item of notesItems) {
    const p = (notesValors[item.id] || {})[sid];
    if (p === '' || p === null || p === undefined) continue;
    const n = item.readonly ? parseFloat(p) : sobre10(p, item.maxPunts);
    if (n === null || isNaN(n)) continue;
    sumV += n * item.pes; sumP += item.pes;
  }
  return sumP === 0 ? null : Math.round(sumV / sumP * 100) / 100;
}

/* --- Ordre: Carpeta sempre al final --- */
function sortCarpetaLast(items) {
  const normal   = items.filter(i => !i.readonly && !i.isActitud);
  const actitud  = items.filter(i => i.isActitud);
  const carpeta  = items.filter(i => i.readonly && !i.isActitud);
  return [...normal, ...actitud, ...carpeta];
}

/* ============================================================
   TRIMESTRE AUTOMÀTIC
   ============================================================ */
function getTrimestreActual() {
  const d = new Date(), m = d.getMonth() + 1, dia = d.getDate();
  if ((m === 6 && dia >= 24) || m === 7 || m === 8) return null; // fora de curs
  if (m >= 9 && m <= 12) return 1;
  if (m === 1 && dia <= 7) return 1;
  if ((m === 1 && dia >= 8) || m === 2 || (m === 3 && dia <= 29)) return 2;
  return 3;
}
function getTrimLabel(t) { return ['','1r Trimestre','2n Trimestre','3r Trimestre'][t] || ''; }

function trimAlertSuprimida() {
  const v = localStorage.getItem('trimAlertSup');
  return v && Date.now() < parseInt(v);
}
function suprimeixTrimAlert() {
  localStorage.setItem('trimAlertSup', String(Date.now() + 60 * 60 * 1000));
}

function showTrimAlert(trimActual, trimSel) {
  return new Promise(resolve => {
    const overlay = document.getElementById('trimAlertOverlay');
    document.getElementById('trimAlertMsg').innerHTML =
      `Estàs editant el <strong>${getTrimLabel(trimSel)}</strong> però ara estem al <strong>${getTrimLabel(trimActual)}</strong>.<br><br>Vols continuar editant el ${getTrimLabel(trimSel)}?`;
    const cb = document.getElementById('trimAlertNoMostrar');
    if (cb) cb.checked = false;
    overlay.classList.add('open');
    ['trimAlertSi','trimAlertNo'].forEach(id => {
      const old = document.getElementById(id);
      const neu = old.cloneNode(true);
      old.parentNode.replaceChild(neu, old);
      neu.addEventListener('click', () => {
        overlay.classList.remove('open');
        if (id === 'trimAlertSi' && cb && cb.checked) suprimeixTrimAlert();
        resolve(id === 'trimAlertSi');
      });
    });
  });
}

/* ============================================================
   OBRIR NOTES
   ============================================================ */
async function openNotesAuto(materia) {
  const t = getTrimestreActual();
  openNotes(materia, t !== null ? t : 1);
}

async function openNotes(materia, trimestre) {
  const trimActual = getTrimestreActual();
  if (trimActual !== null && parseInt(trimestre) !== trimActual && !trimAlertSuprimida()) {
    const ok = await showTrimAlert(trimActual, parseInt(trimestre));
    if (!ok) { openNotes(materia, trimActual); return; }
  }

  notesContext = { materia, trimestre };

  // Aplica cache immediatament (zero delay visual)
  const cached = _cacheGet();
  if (cached) {
    notesItems  = sortCarpetaLast(cached.items || []);
    notesValors = cached.valors || {};
    noEntregats = cached.noEntregats || {};
  } else {
    notesItems = []; notesValors = {}; noEntregats = {};
  }
  // Injecta l'ítem d'actitud (sempre present, entre Carpeta i Mitjana)
  _injectActitudItem(materia, parseInt(trimestre));

  // Navega immediatament
  showPage('notes');
  _updateNotesHeader(materia, trimestre);

  if (cached) {
    // Tenim dades en cache → renderitza immediatament
    renderNotesTable();
    // Refresca en segon pla silenciosament
    _loadNotesBackground();
  } else {
    // Sense cache → mostra spinner mentre carrega
    _showNotesLoading();
    _loadNotesBackground();
  }
}

function _updateNotesHeader(materia, trimestre) {
  document.getElementById('notesTitle').textContent     = MATERIES[materia] || materia;
  document.getElementById('notesTrimLabel').textContent = TRIM_LABELS[String(trimestre)];
  const backBtn = document.getElementById('notesBackBtn');
  if (backBtn) backBtn.onclick = () => showPage('home');
  const trimSel = document.getElementById('notesTrimSelector');
  if (trimSel) {
    trimSel.style.display = 'flex';
    trimSel.querySelectorAll('.trim-sel-btn').forEach(b => {
      b.classList.toggle('active', String(b.dataset.trim) === String(trimestre));
    });
  }
}

async function _loadNotesBackground() {
  if (!config.scriptUrl) return;
  try {
    const r = await appsScriptGet({
      action: 'getNotes',
      materia: notesContext.materia,
      trimestre: notesContext.trimestre,
    });
    if (!r.ok) throw new Error(r.error);
    const newItems  = sortCarpetaLast(r.items || []);
    const newValors = r.valors || {};
    const newNE     = r.noEntregats || {};
    _cacheSet({ items: r.items || [], valors: newValors, noEntregats: newNE });

    // Detecta canvis abans de sobreescriure (evita re-render innecessari).
    // Compara només les dades del servidor (l'actitud ve del localStorage).
    const prevItemsServer  = notesItems.filter(i => i.id !== 'actitud_ref');
    const prevValorsServer = {};
    Object.keys(notesValors).forEach(k => { if (k !== 'actitud_ref') prevValorsServer[k] = notesValors[k]; });
    const changed = JSON.stringify(newItems)  !== JSON.stringify(prevItemsServer) ||
                    JSON.stringify(newValors) !== JSON.stringify(prevValorsServer);

    notesItems  = newItems;
    notesValors = newValors;
    noEntregats = newNE;
    // Actitud ve del localStorage (no del servidor): re-injecta sempre
    _injectActitudItem(notesContext.materia, parseInt(notesContext.trimestre));
    if (changed) renderNotesTable();
    _hideNotesLoading();
    updateSync('ok', 'Sincronitzat'); updateStatSync();
  } catch (e) {
    _hideNotesLoading();
    updateSync('error', 'Error');
    showToast('Error carregant notes: ' + e.message, 'error');
  }
}

async function syncNotes() { _cacheDel(); _showNotesLoading(); await _loadNotesBackground(); }

function _showNotesLoading() {
  const empty = document.getElementById('notesEmpty');
  const wrap  = document.getElementById('notesTableWrap');
  if (empty) {
    empty.innerHTML = `
      <div class="notes-loading-spinner"></div>
      <p>Carregant notes…</p>`;
    empty.style.display = 'block';
  }
  if (wrap) wrap.style.display = 'none';
}

function _hideNotesLoading() {
  // Si el contingut del empty és el spinner, el restaura al missatge original
  const empty = document.getElementById('notesEmpty');
  if (empty && empty.querySelector('.notes-loading-spinner')) {
    empty.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M12 20V10M18 20V4M6 20v-4"/></svg>
      <p>Cap ítem de notes. Clica <strong>Nou ítem</strong> per afegir la primera prova o activitat.</p>`;
  }
}

/* ============================================================
   MODAL — Nou ítem
   ============================================================ */
function openNewNotaModal() {
  document.getElementById('notaItemNom').value = '';
  document.getElementById('notaItemMax').value = '10';
  selectPesByVal('1');
  document.getElementById('newNotaOverlay').classList.add('open');
  setTimeout(() => document.getElementById('notaItemNom').focus(), 100);
}
function closeNewNotaModal() { document.getElementById('newNotaOverlay').classList.remove('open'); }

function selectPes(btn) {
  document.querySelectorAll('.pes-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('notaItemPes').value = btn.dataset.val;
}
function selectPesByVal(val) {
  document.querySelectorAll('.pes-btn').forEach(b => b.classList.toggle('active', b.dataset.val === val));
  document.getElementById('notaItemPes').value = val;
}

async function addNotaItem() {
  const nom      = document.getElementById('notaItemNom').value.trim();
  const maxPunts = parseFloat(document.getElementById('notaItemMax').value) || 10;
  const pes      = parseFloat(document.getElementById('notaItemPes').value) || 1;
  if (!nom) { document.getElementById('notaItemNom').focus(); return; }
  const item = { id: Date.now(), nom, maxPunts, pes };
  notesItems.push(item);
  notesValors[item.id] = {};
  notesItems = sortCarpetaLast(notesItems);
  _cacheDel();
  closeNewNotaModal();
  renderNotesTable();
  if (!config.scriptUrl) return;
  updateSync('syncing', 'Creant ítem…');
  try {
    const r = await appsScriptPost({ action:'addNotaItem', materia:notesContext.materia, trimestre:notesContext.trimestre, item, alumnes:students });
    if (!r.ok) throw new Error(r.error);
    updateSync('ok', 'Sincronitzat');
    showToast('Ítem «' + nom + '» creat', 'success');
  } catch (e) { updateSync('error','Error'); showToast('Error: '+e.message,'error'); }
}

async function deleteNotaItem(itemId) {
  const item = notesItems.find(i => i.id === itemId);
  if (!item || !confirm('Eliminar «' + item.nom + '» i totes les seves notes?')) return;
  notesItems = notesItems.filter(i => i.id !== itemId);
  delete notesValors[itemId];
  _cacheDel();
  renderNotesTable();
  if (!config.scriptUrl) return;
  try {
    await appsScriptPost({ action:'deleteNotaItem', materia:notesContext.materia, trimestre:notesContext.trimestre, itemId });
    showToast('Ítem eliminat', 'success');
  } catch (e) { showToast('Error: '+e.message,'error'); }
}

/* ============================================================
   ACTUALITZAR NOTA — cua serial, sense pèrdues
   ============================================================ */
async function updateNota(itemId, studentId, punts) {
  if (!notesValors[itemId]) notesValors[itemId] = {};
  notesValors[itemId][studentId] = punts;
  refreshStudentRow(studentId);
  _cacheDel();
  if (typeof _notesResumCache !== 'undefined') _notesResumCache = null; // invalida resum fitxa
  if (!config.scriptUrl) return;
  const key = String(itemId) + '_' + studentId;
  _pendingMap[key] = { itemId, studentId, punts };
  _saveQueue = _saveQueue.then(async () => {
    const p = _pendingMap[key]; if (!p) return; delete _pendingMap[key];
    try {
      const r = await appsScriptPost({ action:'updateNota', materia:notesContext.materia, trimestre:notesContext.trimestre, itemId:p.itemId, studentId:p.studentId, punts:p.punts });
      if (r && !r.ok) showToast('Error guardant: '+r.error,'error');
    } catch (e) { showToast('Error guardant nota: '+e.message,'error'); }
  });
}

/* ============================================================
   NO ENTREGAT
   ============================================================ */
async function toggleNoEntregat(item, studentId, inp, chip) {
  if (!noEntregats[item.id]) noEntregats[item.id] = {};
  const era = noEntregats[item.id][studentId] === true;
  const isNE = !era;
  noEntregats[item.id][studentId] = isNE;

  // Botó: cerca des del td (és fill directe de td, fora de inner)
  const btnNE = chip.closest('td').querySelector('.ne-btn');
  if (btnNE) {
    btnNE.classList.toggle('ne-active', isNE);
    btnNE.title = isNE ? 'Marcat com a No Entregat. Clica per desfer.' : 'Marcar com a No Entregat';
  }
  inp.disabled     = isNE;
  inp.placeholder  = isNE ? 'NE' : '—';
  inp.style.opacity = isNE ? '0.4' : '1';
  if (isNE) inp.value = '';

  if (isNE) {
    chip.textContent = '0.00'; chip.style.background = '#FEE2E2'; chip.style.color = '#991B1B';
    // Actualitza l'estat local com si fos 0 (per al càlcul de mitjana local)
    if (!notesValors[item.id]) notesValors[item.id] = {};
    notesValors[item.id][studentId] = 0;
  } else {
    chip.textContent = '—'; chip.style.background = 'transparent'; chip.style.color = 'var(--text-muted)';
    if (!notesValors[item.id]) notesValors[item.id] = {};
    notesValors[item.id][studentId] = '';
  }
  refreshStudentRow(studentId);
  _cacheDel();

  // Envia NOMÉS setNoEntregat al servidor (que ja fa el recalc intern)
  // NO crida updateNota per evitar que sobreescrigui el valor 'NE'
  if (config.scriptUrl) {
    try { await appsScriptPost({ action:'setNoEntregat', materia:notesContext.materia, trimestre:notesContext.trimestre, itemId:item.id, studentId, valor:isNE }); }
    catch (e) { showToast('Error guardant NE: '+e.message,'error'); }
  }
}

/* ============================================================
   REFRESCA UNA FILA (després d'entrar nota)
   ============================================================ */
function refreshStudentRow(sid) {
  for (const item of notesItems) {
    const chip = document.getElementById('c_' + item.id + '_' + sid);
    if (!chip) continue;
    const p = (notesValors[item.id] || {})[sid];
    const isNE = !item.readonly && (noEntregats[item.id] || {})[sid] === true;
    if (isNE) { chip.textContent = '0.00'; chip.style.background = '#FEE2E2'; chip.style.color = '#991B1B'; continue; }
    const n = item.readonly ? (p !== '' && p !== null && p !== undefined ? parseFloat(p) : null) : sobre10(p, item.maxPunts);
    const q = n !== null ? getQual(n) : null;
    chip.textContent      = n !== null ? n.toFixed(2) : '—';
    chip.style.background = q ? q.bg    : (item.readonly ? 'var(--surface-alt)' : 'transparent');
    chip.style.color      = q ? q.color : 'var(--text-muted)';
  }
  const mitj = calcMitjana(sid);
  const mCell = document.getElementById('mitj_' + sid);
  if (mCell) {
    const qM = mitj !== null ? getQual(mitj) : null;
    mCell.innerHTML = mitj !== null
      ? `<span class="nota10-chip" style="background:${qM?qM.bg:'var(--surface-alt)'};color:${qM?qM.color:'var(--text-sub)'};font-size:15px;font-weight:700">${mitj.toFixed(2)}</span>`
      : '<span style="color:var(--text-muted)">—</span>';
  }
  const nCell = document.getElementById('nota_' + sid);
  if (nCell) {
    const nota = arrod(mitj);
    if (nota !== null) {
      const isSus = nota < 5;
      const bgN = isSus ? '#FEE2E2' : '#D1FAE5';
      const fcN = isSus ? '#991B1B' : '#065F46';
      nCell.innerHTML = `<span class="nota10-chip" style="background:${bgN};color:${fcN};font-size:16px;font-weight:800;min-width:44px">${nota}</span><span class="qual-badge" style="background:${bgN};color:${fcN};font-size:11px">${getQualCodi(nota)}</span>`;
    } else { nCell.innerHTML = '<span style="color:var(--text-muted)">—</span>'; }
  }
}

/* ============================================================
   RENDERITZA LA TAULA COMPLETA
   ============================================================ */
function renderNotesTable() {
  const empty = document.getElementById('notesEmpty');
  const wrap  = document.getElementById('notesTableWrap');
  const thead = document.getElementById('notesTableHead');
  const tbody = document.getElementById('notesTableBody');
  thead.innerHTML = ''; tbody.innerHTML = '';

  if (!notesItems.length) { empty.style.display='block'; wrap.style.display='none'; return; }
  empty.style.display = 'none'; wrap.style.display = 'block';

  // Capçalera
  const trH = document.createElement('tr');
  const thNom = document.createElement('th'); thNom.className='notes-th-name'; thNom.textContent='Alumne'; trH.appendChild(thNom);
  notesItems.forEach(item => {
    const th = document.createElement('th');
    if (item.isActitud) {
      th.className = 'notes-th-item notes-th-actitud';
      th.innerHTML = `<div class="notes-th-item-nom special-col-nom" onclick="openActitudPanel()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
        ${escapeHtml(item.nom)}</div>
        <div class="notes-th-item-meta">Pes ${item.pes} · clica per editar</div>`;
    } else if (item.readonly) {
      th.className = 'notes-th-item notes-th-carpeta';
      th.innerHTML = `<div class="notes-th-item-nom special-col-nom">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
        ${escapeHtml(item.nom)}</div>
        <div class="notes-th-item-meta">Pes ${item.pes} · automàtic</div>`;
    } else {
      th.className = 'notes-th-item';
      th.innerHTML = `<button class="notes-del-btn" onclick="deleteNotaItem(${item.id})" title="Eliminar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button><div class="notes-th-item-nom">${escapeHtml(item.nom)}</div><div class="notes-th-item-meta">Pes ${item.pes} · sobre ${item.maxPunts}</div>`;
    }
    trH.appendChild(th);
  });
  const thM = document.createElement('th'); thM.className='notes-th-mitj';
  thM.innerHTML='<div class="special-col-nom"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> Mitjana</div><small>/10</small>';
  trH.appendChild(thM);
  const thN = document.createElement('th'); thN.className='notes-th-mitj';
  thN.innerHTML='<div class="special-col-nom"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><polyline points="20 6 9 17 4 12"/></svg> Nota</div><small>arrodonida</small>';
  trH.appendChild(thN);
  thead.appendChild(trH);

  // Files d'alumnes (DocumentFragment per evitar reflows múltiples)
  const fragBody = document.createDocumentFragment();
  students.forEach(s => {
    const tr = document.createElement('tr');
    // Nom
    const tdNom = document.createElement('td'); tdNom.className='notes-td-name';
    tdNom.innerHTML = `<div class="notes-td-name-inner"><div class="student-avatar" style="width:28px;height:28px;font-size:10px;flex-shrink:0">${getInitials(s.nom)}</div><span>${escapeHtml(s.nom)}</span></div>`;
    tr.appendChild(tdNom);

    notesItems.forEach(item => {
      const td = document.createElement('td'); td.className='notes-td-item';
      const inner = document.createElement('div'); inner.className='notes-td-item-inner';
      const val = (notesValors[item.id] || {})[s.id];

      if (item.readonly) {
        td.classList.add('notes-td-item-readonly');
        const nota = (val !== '' && val !== null && val !== undefined) ? parseFloat(val) : null;
        const q    = nota !== null ? getQual(nota) : null;
        const chip = document.createElement('div');
        chip.id = 'c_' + item.id + '_' + s.id;
        chip.className = item.isActitud ? 'nota10-chip nota10-actitud' : 'nota10-chip nota10-carpeta';
        chip.textContent = nota !== null ? nota.toFixed(2) : '—';
        chip.style.background = q ? q.bg : '#EEEEEE'; chip.style.color = q ? q.color : 'var(--text-muted)';
        chip.title = item.isActitud ? 'Actitud (mitjana dels 5 aspectes) · clica per editar' : 'Carpeta Viatgera (automàtic)';
        if (item.isActitud) chip.style.cursor = 'pointer';
        if (item.isActitud) chip.onclick = () => openActitudPanel();
        inner.appendChild(chip);
      } else {
        const isNE = (noEntregats[item.id] || {})[s.id] === true;
        const n    = isNE ? 0 : sobre10(val, item.maxPunts);
        const q    = (n !== null && !isNE) ? getQual(n) : (isNE ? QUALS[0] : null);

        const btnNE = document.createElement('button');
        btnNE.className = 'ne-btn' + (isNE ? ' ne-active' : '');
        btnNE.title     = isNE ? 'No Entregat — clica per desfer' : 'Marcar com a No Entregat';
        btnNE.textContent = 'NE';

        const inp = document.createElement('input');
        inp.type='number'; inp.min='0'; inp.max=String(item.maxPunts); inp.step='0.5';
        inp.className='notes-input-punts';
        inp.value       = (!isNE && val !== undefined && val !== '') ? val : '';
        inp.placeholder = isNE ? 'NE' : '—';
        inp.disabled    = isNE;
        if (isNE) inp.style.opacity = '0.4';

        const chip = document.createElement('div');
        chip.id = 'c_' + item.id + '_' + s.id; chip.className = 'nota10-chip';
        if (isNE) {
          chip.textContent = '0.00'; chip.style.background = '#FEE2E2'; chip.style.color = '#991B1B';
        } else {
          chip.textContent = n !== null ? n.toFixed(2) : '—';
          chip.style.background = q ? q.bg : 'transparent'; chip.style.color = q ? q.color : 'var(--text-muted)';
        }

        btnNE.addEventListener('click', () => toggleNoEntregat(item, s.id, inp, chip));
        let t;
        inp.addEventListener('input', () => {
          clearTimeout(t);
          const v = parseFloat(inp.value.trim());
          if (!isNaN(v) && v > item.maxPunts) { inp.style.borderColor='#EF4444'; showToast(`Màxim: ${item.maxPunts} punts`,'error'); return; }
          inp.style.borderColor = '';
          t = setTimeout(() => updateNota(item.id, s.id, inp.value.trim()==='' ? '' : v), 400);
        });
        inp.addEventListener('blur', () => {
          const v = parseFloat(inp.value.trim());
          if (!isNaN(v) && v > item.maxPunts) { inp.value = item.maxPunts; inp.style.borderColor=''; updateNota(item.id, s.id, item.maxPunts); }
        });

        td.appendChild(btnNE);
        inner.appendChild(inp); inner.appendChild(chip);
      }
      td.appendChild(inner); tr.appendChild(td);
    });

    // Mitjana
    const mitj = calcMitjana(s.id);
    const tdM = document.createElement('td'); tdM.className='notes-td-mitj notes-td-item-readonly';
    const divM = document.createElement('div'); divM.id='mitj_'+s.id; divM.className='mitj-cell';
    const qM = mitj !== null ? getQual(mitj) : null;
    divM.innerHTML = mitj !== null
      ? `<span class="nota10-chip" style="background:${qM?qM.bg:'var(--surface-alt)'};color:${qM?qM.color:'var(--text-sub)'};font-size:15px;font-weight:700">${mitj.toFixed(2)}</span>`
      : '<span style="color:var(--text-muted)">—</span>';
    tdM.appendChild(divM); tr.appendChild(tdM);

    // Nota arrodonida
    const nota = arrod(mitj);
    const tdN = document.createElement('td'); tdN.className='notes-td-mitj notes-td-item-readonly';
    const divN = document.createElement('div'); divN.id='nota_'+s.id; divN.className='mitj-cell';
    if (nota !== null) {
      const isSus = nota < 5;
      const bg    = isSus ? '#FEE2E2' : '#D1FAE5';
      const fc    = isSus ? '#991B1B' : '#065F46';
      const qual  = getQualCodi(nota);
      divN.innerHTML = `<span class="nota10-chip" style="background:${bg};color:${fc};font-size:16px;font-weight:800;min-width:44px">${nota}</span><span class="qual-badge" style="background:${bg};color:${fc};font-size:11px">${qual}</span>`;
    } else { divN.innerHTML = '<span style="color:var(--text-muted)">—</span>'; }
    tdN.appendChild(divN); tr.appendChild(tdN);
    fragBody.appendChild(tr);
  });
  tbody.appendChild(fragBody);
}

// Àlies per compatibilitat
function loadNotes() { _loadNotesBackground(); }

function _injectActitudItem(materia, trimestre) {
  // Elimina l'actitud anterior si existia
  notesItems = notesItems.filter(i => i.id !== 'actitud_ref');
  // Afegeix l'ítem d'actitud amb els valors actuals del localStorage
  const actItem = { id: 'actitud_ref', nom: 'Actitud', maxPunts: 10, pes: 2, readonly: true, isActitud: true };
  notesItems.push(actItem);
  notesValors['actitud_ref'] = notesValors['actitud_ref'] || {};
  students.forEach(s => {
    const dades = getActitud(materia, trimestre, s.id);
    const mitj  = calcMitjanaActitud(dades);
    notesValors['actitud_ref'][s.id] = mitj !== null ? mitj : '';
  });
}

/* ============================================================
   ACTITUD
   5 aspectes × N alumnes × per assignatura × per trimestre
   Clau localStorage: actitud_{materia}_{trimestre}_{studentId}
   → { participacio, atencio, comportament, saberEstar, realitzacio }
   La mitjana s'injecta com a columna readonly «Actitud» (pes 2)
   entre Carpeta Viatgera i Mitjana.
   ============================================================ */

const ACTITUD_ASPECTES = [
  { id: 'participacio',  nom: 'Participació' },
  { id: 'atencio',       nom: 'Atenció' },
  { id: 'comportament',  nom: 'Comportament' },
  { id: 'saberEstar',    nom: 'Saber estar' },
  { id: 'realitzacio',   nom: 'Realització activitats' },
];

function _actitudKey(materia, trimestre, studentId) {
  return `actitud_${materia}_${trimestre}_${studentId}`;
}

function getActitud(materia, trimestre, studentId) {
  const v = localStorage.getItem(_actitudKey(materia, trimestre, studentId));
  return v ? JSON.parse(v) : {};
}

function setActitud(materia, trimestre, studentId, dades) {
  localStorage.setItem(_actitudKey(materia, trimestre, studentId), JSON.stringify(dades));
  if (typeof _actitudSaveToSheets === 'function') _actitudSaveToSheets(materia, trimestre);
}

function calcMitjanaActitud(dades) {
  const vals = ACTITUD_ASPECTES.map(a => parseFloat(dades[a.id])).filter(v => !isNaN(v) && v >= 0);
  if (!vals.length) return null;
  return Math.round(vals.reduce((s,v) => s+v, 0) / vals.length * 100) / 100;
}

/* Obre el panel d'actitud */
function openActitudPanel() {
  const { materia, trimestre } = notesContext;
  if (!materia) return;

  document.getElementById('actitudTitle').textContent =
    `Actitud · ${MATERIES[materia] || materia} · ${getTrimLabel(trimestre)}`;

  // Construeix la taula
  const wrap = document.getElementById('actitudTable');
  let html = `<div class="actitud-table-wrap"><table class="actitud-table">
    <thead><tr>
      <th class="actitud-th-nom">Alumne</th>
      ${ACTITUD_ASPECTES.map(a => `<th class="actitud-th-asp">${escapeHtml(a.nom)}</th>`).join('')}
      <th class="actitud-th-mitj">Mitjana</th>
    </tr></thead><tbody>`;

  students.forEach(s => {
    const dades = getActitud(materia, trimestre, s.id);
    const mitj  = calcMitjanaActitud(dades);
    const q     = mitj !== null ? getQual(mitj) : null;
    html += `<tr>
      <td class="actitud-td-nom">${escapeHtml(s.nom)}</td>
      ${ACTITUD_ASPECTES.map(a => {
        const val = dades[a.id] !== undefined ? dades[a.id] : '';
        return `<td class="actitud-td-inp">
          <input class="actitud-input" type="number" min="1" max="10" step="0.5"
            value="${val}" placeholder="—"
            data-sid="${s.id}" data-asp="${a.id}"
            oninput="onActitudInput(this)">
        </td>`;
      }).join('')}
      <td class="actitud-td-mitj" id="actm_${s.id}">
        ${mitj !== null ? `<span class="nota10-chip" style="background:${q?q.bg:'transparent'};color:${q?q.color:'var(--text-muted)'};">${mitj.toFixed(2)}</span>` : '<span style="color:var(--text-muted)">—</span>'}
      </td>
    </tr>`;
  });

  html += '</tbody></table></div>';
  wrap.innerHTML = html;
  document.getElementById('actitudOverlay').classList.add('open');
}

function closeActitudPanel() {
  document.getElementById('actitudOverlay').classList.remove('open');
}

function onActitudInput(inp) {
  const sid = parseInt(inp.dataset.sid);
  const asp = inp.dataset.asp;
  const val = parseFloat(inp.value);
  if (!isNaN(val) && val > 10) { inp.value = 10; return; }

  // Recalcula la mitjana en temps real
  const { materia, trimestre } = notesContext;
  const dades = getActitud(materia, trimestre, sid);
  if (inp.value === '') delete dades[asp];
  else if (!isNaN(val)) dades[asp] = val;

  const mitj = calcMitjanaActitud(dades);
  const q    = mitj !== null ? getQual(mitj) : null;
  const cell = document.getElementById('actm_' + sid);
  if (cell) cell.innerHTML = mitj !== null
    ? `<span class="nota10-chip" style="background:${q?q.bg:'transparent'};color:${q?q.color:'var(--text-muted)'};">${mitj.toFixed(2)}</span>`
    : '<span style="color:var(--text-muted)">—</span>';
}

function saveActitud() {
  const { materia, trimestre } = notesContext;
  // Recull tots els inputs i guarda
  document.querySelectorAll('.actitud-input').forEach(inp => {
    const sid = parseInt(inp.dataset.sid);
    const asp = inp.dataset.asp;
    const val = parseFloat(inp.value);
    const dades = getActitud(materia, trimestre, sid);
    if (inp.value === '' || isNaN(val)) delete dades[asp];
    else dades[asp] = val;
    setActitud(materia, trimestre, sid, dades);
  });

  // Actualitza la columna d'actitud a la taula de notes
  _updateActitudColumn();
  // Sincronitza la mitjana d'actitud al servidor per cada alumne
  _syncActitudToServer();
  closeActitudPanel();
  showToast('Actitud guardada', 'success');
}

async function _syncActitudToServer() {
  if (!config.scriptUrl) return;
  const { materia, trimestre } = notesContext;
  // Recull totes les mitjanes i les envia en UNA sola crida (batch)
  const mitjanes = {};
  students.forEach(s => {
    const mitj = calcMitjanaActitud(getActitud(materia, trimestre, s.id));
    if (mitj !== null) mitjanes[s.id] = mitj;
  });
  if (!Object.keys(mitjanes).length) return;
  try {
    await appsScriptPost({ action: 'updateActitudBatch', materia, trimestre, mitjanes });
  } catch(e) { /* silenci, ja està al localStorage */ }
}

/* Injecta/actualitza els valors d'actitud a notesValors i re-renderitza */
function _updateActitudColumn() {
  const { materia, trimestre } = notesContext;
  const actItem = notesItems.find(i => i.id === 'actitud_ref');
  if (!actItem) return;
  students.forEach(s => {
    const dades = getActitud(materia, trimestre, s.id);
    const mitj  = calcMitjanaActitud(dades);
    if (!notesValors[actItem.id]) notesValors[actItem.id] = {};
    notesValors[actItem.id][s.id] = mitj !== null ? mitj : '';
  });
  renderNotesTable();
}
