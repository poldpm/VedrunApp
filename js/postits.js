/* ============================================================
   NOTES I POST-ITS
   Crear, editar, esborrar notes ràpides. Es desen al Google Sheets
   (clau 'postits' a _AppData) i en cache local per rapidesa.
   Estructura d'un post-it: { id, titol, text, color, ts }
   ============================================================ */

let _postits = [];
let _postitEditId = null;
let _postitColor = 'groc';

const POSTIT_COLORS = ['groc', 'rosa', 'blau', 'verd', 'taronja', 'lila'];
const POSTIT_COLOR_HEX = {
  groc: '#FFF3B0', rosa: '#FFD1DC', blau: '#B8E4F0',
  verd: '#C7EFCF', taronja: '#FFD9A8', lila: '#E0C3F0',
};

// Inicialitza la pàgina: carrega del cache i després del núvol
function initPostits() {
  // Cache local immediat
  try {
    const cached = JSON.parse(localStorage.getItem('postits') || 'null');
    if (Array.isArray(cached)) _postits = cached;
  } catch(e) {}
  renderPostits();
  // Refresca del núvol en segon pla
  _postitsLoadFromSheets();
}

async function _postitsLoadFromSheets() {
  if (!config.scriptUrl) return;
  try {
    const r = await appsScriptGet({ action: 'loadPostits' });
    if (r.ok && Array.isArray(r.postits)) {
      _postits = r.postits;
      try { localStorage.setItem('postits', JSON.stringify(_postits)); } catch(e) {}
      renderPostits();
      _postitsComprovaRecordatoris();
    }
  } catch(e) { /* silenciós: ja tenim el cache */ }
}

// Renderitza tots els post-its al taulell
function renderPostits() {
  const board = document.getElementById('postitsBoard');
  if (!board) return;
  if (!_postits.length) {
    board.innerHTML = `<div class="postits-empty">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" width="48" height="48" style="margin-bottom:12px"><path d="M15 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h9l7-7V5a2 2 0 0 0-2-2z"/><path d="M15 21v-6a2 2 0 0 1 2-2h4"/></svg>
      <p>Encara no tens cap post-it.<br>Clica <strong>Nou post-it</strong> per apuntar la teva primera idea.</p>
    </div>`;
    return;
  }
  // Ordre: primer els importants, després per ordre manual, i per data de creació
  const ordenats = _postits.slice().sort((a, b) => {
    if (!!b.important !== !!a.important) return b.important ? 1 : -1;
    const oa = a.ordre != null ? a.ordre : 0, ob = b.ordre != null ? b.ordre : 0;
    if (oa !== ob) return oa - ob;
    return (b.ts || 0) - (a.ts || 0);
  });

  board.innerHTML = ordenats.map(p => {
    const color = POSTIT_COLORS.includes(p.color) ? p.color : 'groc';
    const data = p.ts ? _postitDataCurta(p.ts) : '';
    const recordatori = p.data ? _postitRecordatoriBadge(p.data) : '';
    return `<div class="postit postit-${color} ${p.important ? 'postit-important' : ''}"
      draggable="true" data-id="${p.id}"
      ondragstart="_postitDragStart(event,'${p.id}')"
      ondragover="_postitDragOver(event,'${p.id}')"
      ondragleave="_postitDragLeave(event)"
      ondrop="_postitDrop(event,'${p.id}')"
      ondragend="_postitDragEnd(event)">
      ${p.important ? '<div class="postit-pin" title="Important">📌</div>' : ''}
      ${p.titol ? `<div class="postit-titol">${escapeHtml(p.titol)}</div>` : ''}
      <div class="postit-text">${escapeHtml(p.text || '')}</div>
      ${recordatori}
      <div class="postit-data">${data}</div>
      <div class="postit-actions">
        <button class="postit-act-btn" onclick="postitEditar('${p.id}')" title="Editar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
        </button>
        <button class="postit-act-btn" onclick="postitEsborrar('${p.id}')" title="Esborrar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
        </button>
      </div>
    </div>`;
  }).join('');
}

// Badge del recordatori amb data (vermell si ja ha passat o és avui)
function _postitRecordatoriBadge(dataStr) {
  try {
    const d = new Date(dataStr + 'T00:00:00');
    const avui = new Date(); avui.setHours(0,0,0,0);
    const diff = Math.round((d - avui) / 86400000);
    let classe = 'postit-recordatori', txt = '';
    const dd = d.getDate(), mm = d.getMonth() + 1;
    if (diff < 0) { classe += ' vencut'; txt = `Vençut · ${dd}/${mm}`; }
    else if (diff === 0) { classe += ' avui'; txt = 'Avui!'; }
    else if (diff === 1) { txt = 'Demà'; }
    else if (diff <= 7) { txt = `En ${diff} dies · ${dd}/${mm}`; }
    else { txt = `${dd}/${mm}`; }
    return `<div class="${classe}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
      ${txt}
    </div>`;
  } catch(e) { return ''; }
}

function _postitDataCurta(ts) {
  const d = new Date(ts);
  const avui = new Date();
  const mateixDia = d.toDateString() === avui.toDateString();
  if (mateixDia) return 'Avui ' + d.toTimeString().slice(0, 5);
  const dies = ['dg', 'dl', 'dt', 'dc', 'dj', 'dv', 'ds'];
  return dies[d.getDay()] + ' ' + d.getDate() + '/' + (d.getMonth() + 1);
}

// Obre el modal per crear un post-it nou
function postitNou() {
  _postitEditId = null;
  _postitColor = 'groc';
  document.getElementById('postitModalTitol').textContent = 'Nou post-it';
  document.getElementById('postitTitol').value = '';
  document.getElementById('postitText').value = '';
  document.getElementById('postitData').value = '';
  document.getElementById('postitImportant').checked = false;
  _renderPostitColorSel();
  document.getElementById('postitOverlay').classList.add('open');
  setTimeout(() => document.getElementById('postitText').focus(), 50);
}

// Obre el modal per editar un post-it existent
function postitEditar(id) {
  const p = _postits.find(x => x.id === id);
  if (!p) return;
  _postitEditId = id;
  _postitColor = POSTIT_COLORS.includes(p.color) ? p.color : 'groc';
  document.getElementById('postitModalTitol').textContent = 'Editar post-it';
  document.getElementById('postitTitol').value = p.titol || '';
  document.getElementById('postitText').value = p.text || '';
  document.getElementById('postitData').value = p.data || '';
  document.getElementById('postitImportant').checked = !!p.important;
  _renderPostitColorSel();
  document.getElementById('postitOverlay').classList.add('open');
}

function closePostitModal() {
  document.getElementById('postitOverlay').classList.remove('open');
  _postitEditId = null;
}

// Renderitza el selector de colors
function _renderPostitColorSel() {
  const sel = document.getElementById('postitColorSel');
  if (!sel) return;
  sel.innerHTML = POSTIT_COLORS.map(c =>
    `<div class="postit-color-opt ${c === _postitColor ? 'active' : ''}"
      style="background:${POSTIT_COLOR_HEX[c]}"
      onclick="_postitTriaColor('${c}')"></div>`
  ).join('');
}

function _postitTriaColor(c) {
  _postitColor = c;
  _renderPostitColorSel();
}

// Desa el post-it (nou o editat)
async function postitDesar() {
  const titol = document.getElementById('postitTitol').value.trim();
  const text = document.getElementById('postitText').value.trim();
  const data = document.getElementById('postitData').value || '';
  const important = document.getElementById('postitImportant').checked;
  if (!titol && !text) { showToast('Escriu alguna cosa al post-it', 'error'); return; }

  if (_postitEditId) {
    // Editar
    const p = _postits.find(x => x.id === _postitEditId);
    if (p) { p.titol = titol; p.text = text; p.color = _postitColor; p.data = data; p.important = important; p.ts = p.ts || Date.now(); }
  } else {
    // Nou: l'ordre és el més baix (apareix primer entre els de la seva categoria)
    const minOrdre = _postits.length ? Math.min(..._postits.map(p => p.ordre || 0)) : 0;
    _postits.push({
      id: 'pt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      titol, text, color: _postitColor, data, important,
      ordre: minOrdre - 1, ts: Date.now(),
    });
  }
  closePostitModal();
  renderPostits();
  _postitsPersist();
}

// Esborra un post-it (amb confirmació)
async function postitEsborrar(id) {
  const p = _postits.find(x => x.id === id);
  if (!p) return;
  const nom = p.titol || (p.text || '').slice(0, 30);
  if (!confirm(`Esborrar el post-it "${nom}"?`)) return;
  _postits = _postits.filter(x => x.id !== id);
  renderPostits();
  _postitsPersist();
}

// Desa a cache local i al núvol
function _postitsPersist() {
  try { localStorage.setItem('postits', JSON.stringify(_postits)); } catch(e) {}
  if (config.scriptUrl) {
    appsScriptPost({ action: 'savePostits', postits: _postits })
      .then(r => { if (r && r.ok === false) showToast('Error desant: ' + r.error, 'error'); })
      .catch(() => showToast('Els post-its es desaran quan tornis a tenir connexió', 'info'));
  }
}

/* ---- Arrossegar per reordenar ---- */
let _postitDragId = null;

function _postitDragStart(e, id) {
  _postitDragId = id;
  e.dataTransfer.effectAllowed = 'move';
  try { e.dataTransfer.setData('text/plain', id); } catch(err) {}
  const el = e.currentTarget;
  setTimeout(() => { if (el) el.classList.add('postit-dragging'); }, 0);
}

function _postitDragOver(e, id) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  if (id !== _postitDragId) {
    const el = e.currentTarget;
    if (el) el.classList.add('postit-dropzone');
  }
}

function _postitDragLeave(e) {
  const el = e.currentTarget;
  if (el) el.classList.remove('postit-dropzone');
}

function _postitDrop(e, targetId) {
  e.preventDefault();
  const el = e.currentTarget;
  if (el) el.classList.remove('postit-dropzone');
  if (!_postitDragId || _postitDragId === targetId) return;

  const drag = _postits.find(p => p.id === _postitDragId);
  const target = _postits.find(p => p.id === targetId);
  if (!drag || !target) return;

  // No permetis barrejar importants amb no-importants en reordenar:
  // el post-it arrossegat adopta l'estat "important" de la zona on cau,
  // perquè l'ordre visual (importants a dalt) es mantingui coherent.
  drag.important = target.important;

  // Recalcula l'ordre: dona a tots un ordre seqüencial segons la vista actual,
  // i insereix el drag just abans del target.
  const ordreVisual = _postits.slice().sort((a, b) => {
    if (!!b.important !== !!a.important) return b.important ? 1 : -1;
    const oa = a.ordre != null ? a.ordre : 0, ob = b.ordre != null ? b.ordre : 0;
    if (oa !== ob) return oa - ob;
    return (b.ts || 0) - (a.ts || 0);
  });
  // Treu el drag i insereix-lo abans del target
  const senseDrag = ordreVisual.filter(p => p.id !== _postitDragId);
  const idx = senseDrag.findIndex(p => p.id === targetId);
  senseDrag.splice(idx, 0, drag);
  // Reassigna ordre seqüencial
  senseDrag.forEach((p, i) => { p.ordre = i; });

  _postitDragId = null;
  renderPostits();
  _postitsPersist();
}

function _postitDragEnd(e) {
  const el = e.currentTarget;
  if (el) el.classList.remove('postit-dragging');
  document.querySelectorAll('.postit-dropzone').forEach(x => x.classList.remove('postit-dropzone'));
  _postitDragId = null;
}

/* ---- Recordatoris: comprova si algun post-it venç avui ---- */
function _postitsComprovaRecordatoris() {
  if (!_postits || !_postits.length) return;
  const avui = new Date(); avui.setHours(0,0,0,0);
  const venuts = _postits.filter(p => {
    if (!p.data) return false;
    const d = new Date(p.data + 'T00:00:00');
    return d.getTime() === avui.getTime();
  });
  if (venuts.length && typeof showToast === 'function') {
    const noms = venuts.map(p => p.titol || (p.text||'').slice(0,25)).join(', ');
    showToast(`📌 Recordatori d'avui: ${noms}`, 'info');
  }
}
