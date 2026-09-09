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
  /* ⚠ LA NOTA TRIADA ES QUEDAVA TRIADA D UNA VISITA A L ALTRA.

     Segona auditoria (8/9/2026). Es toca una nota per moure-la, es canvia de
     pantalla sense acabar, i en tornar a Notes la tria encara hi era —sense
     que res ho digués, perque el retol tampoc no es tornava a pintar—: el
     primer toc a qualsevol altra nota la movia sense voler.

     Entrar a la pantalla es un començament: aqui no hi ha res triat. */
  _postitTriat = null;
  if (typeof _postitAvisTria === 'function') { try { _postitAvisTria(); } catch (e) {} }
  // Cache local immediat
  try {
    const cached = JSON.parse(localStorage.getItem('postits') || 'null');
    /* ⚠ UN «null» DINS LA LLISTA DEIXAVA EL TAULELL EN BLANC.

       Segona auditoria (8/9/2026): amb una entrada nul·la, el primer
       `p.color` de `renderPostits()` llançava i el taulell es quedava buit,
       sense cap nota i sense dir res. S'hi pot colar per una sincronització a
       mig fer o per una còpia vella; el que no pot passar és que se
       n'emporti la pantalla sencera. */
    if (Array.isArray(cached)) _postits = cached.filter(p => p && typeof p === 'object');
  } catch(e) {}
  renderPostits();
  // Refresca del núvol en segon pla
  _postitsLoadFromSheets();
}

async function _postitsLoadFromSheets() {
  if (!config.scriptUrl) return;
  if (typeof _recentFullLoad === 'function' && _recentFullLoad()) return; // el bootstrap ja els ha portat
  try {
    const r = await appsScriptGet({ action: 'loadPostits' });
    if (r.ok && Array.isArray(r.postits) && !(typeof _pendentsTe === 'function' && _pendentsTe('savePostits'))) {
      _postits = r.postits.filter(p => p && typeof p === 'object');
      try { localStorage.setItem('postits', JSON.stringify(_postits)); } catch(e) {}
      if (r.base) { try { localStorage.setItem('postits_base', String(r.base)); } catch(e) {} }
      renderPostits();
      _postitsComprovaRecordatoris();
    }
  } catch(e) { /* silenciós: ja tenim el cache */ }
}

/* ============================================================
   LES NOTES TAMBÉ PODEN SER LLISTES
   ------------------------------------------------------------
   En Pol, 5/9/2026: «m'agrada tot tal com està, el format dels post-its és
   un toc guai… però vull fer que es puguin crear checklists ràpides: coses
   a fer, idees».

   No és cap eina nova ni cap tipus de nota a part: una nota pot tenir
   `items`, i llavors es veu com una llista. Manté el color, el pin
   d'important, el recordatori, l'ordre i el poder-la arrossegar —tot el que
   ja li agrada—, i qui no en vulgui no en veu ni rastre.

   Es marquen DES DEL TAULELL. Haver d'obrir la nota per dir «això ja està
   fet» seria tres clics per a una cosa que se'n mereix un, i llavors ningú
   no les marcaria i la llista mentiria.

   Estructura d'un item: { t: 'el text', fet: false }
   ============================================================ */

/* Els items mentre s'edita la nota (encara no desats). */
let _postitItems = [];

function _postitRenderItemsEdit() {
  const cont = document.getElementById('postitItemsEdit');
  if (!cont) return;
  if (!_postitItems.length) { cont.innerHTML = ''; return; }
  cont.innerHTML = _postitItems.map(function (it, i) {
    return '<div class="pt-item-edit">' +
      '<span>' + escapeHtml(it.t) + '</span>' +
      '<button type="button" class="pt-item-treu" onclick="_postitTreuItem(' + i + ')" ' +
        'aria-label="Treure ' + escapeHtml(it.t) + '">&times;</button>' +
    '</div>';
  }).join('');
}

function _postitAfegeixItem() {
  const camp = document.getElementById('postitItemNou');
  if (!camp) return;
  const t = (camp.value || '').trim();
  if (!t) return;
  _postitItems.push({ t: t, fet: false });
  camp.value = '';
  /* El focus es queda: així se'n poden escriure sis seguides sense tocar
     el ratolí, que és tota la gràcia d'una llista ràpida. */
  camp.focus();
  _postitRenderItemsEdit();
}

function _postitTreuItem(i) {
  _postitItems.splice(i, 1);
  _postitRenderItemsEdit();
}

/* La llista, tal com es veu al taulell. */
function _postitItemsHtml(p) {
  const items = (p.items || []).filter(function (it) { return it && it.t; });
  if (!items.length) return '';
  const fets = items.filter(function (it) { return it.fet; }).length;
  return '<div class="pt-llista">' +
    items.map(function (it, i) {
      return '<label class="pt-item' + (it.fet ? ' fet' : '') + '">' +
        '<input type="checkbox"' + (it.fet ? ' checked' : '') +
          ' onchange="postitMarca(\'' + p.id + '\',' + i + ')">' +
        '<span>' + escapeHtml(it.t) + '</span>' +
      '</label>';
    }).join('') +
    /* El compte va amb NÚMEROS i no amb cap barra de color: dins d'un
       post-it de colors, una barra més seria soroll. */
    '<div class="pt-compte' + (fets === items.length ? ' tot' : '') + '">' +
      (fets === items.length ? 'Fet ✓' : fets + ' de ' + items.length) +
    '</div>' +
  '</div>';
}

/* Marcar des del taulell. Es desa sol i de seguida: si calgués desar-ho a
   mà, la llista no diria la veritat i deixaria de servir. */
let _postitMarcaTemps = null;
function postitMarca(id, i) {
  const p = _postits.find(function (x) { return x.id === id; });
  if (!p || !p.items || !p.items[i]) return;
  p.items[i].fet = !p.items[i].fet;
  renderPostits();
  if (_postitMarcaTemps) clearTimeout(_postitMarcaTemps);
  _postitMarcaTemps = setTimeout(function () { _postitMarcaTemps = null; _postitsPersist(); }, 600);
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
    return `<div class="postit postit-${color} ${p.important ? 'postit-important' : ''}${_postitTriat === p.id ? ' postit-triat' : ''}"
      draggable="true" data-id="${p.id}"
      onclick="_postitToca(event,'${_idJs(p.id)}')"
      ondragstart="_postitDragStart(event,'${p.id}')"
      ondragover="_postitDragOver(event,'${p.id}')"
      ondragleave="_postitDragLeave(event)"
      ondrop="_postitDrop(event,'${p.id}')"
      ondragend="_postitDragEnd(event)">
      ${p.important ? '<div class="postit-pin" title="Important">📌</div>' : ''}
      ${p.titol ? `<div class="postit-titol">${escapeHtml(p.titol)}</div>` : ''}
      ${p.text ? `<div class="postit-text">${escapeHtml(p.text)}</div>` : ''}
      ${_postitItemsHtml(p)}
      ${recordatori}
      <div class="postit-data">${data}</div>
      <div class="postit-actions">
        <button class="postit-act-btn" onclick="postitEditar('${_idJs(p.id)}')" title="Editar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
        </button>
        <button class="postit-act-btn" onclick="postitEsborrar('${_idJs(p.id)}')" title="Esborrar">
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
    // Una data que no s entén no es pinta (segona auditoria, 8/9/2026).
    if (isNaN(d.getTime())) return '';
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

/* ⚠ «NaN/NaN» I «undefined» A LA NOTA.

   Segona auditoria (8/9/2026): amb una data o una marca de temps que no
   s entenen —una sincronitzacio a mig fer, una copia vella—, aixo pintava
   etiquetes amb «NaN/NaN» i «undefined» a dins. Val mes no pintar res que
   pintar una cosa que no vol dir res. */
function _postitDataCurta(ts) {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return '';
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
  _postitItems = [];
  const nou = document.getElementById('postitItemNou');
  if (nou) nou.value = '';
  _postitRenderItemsEdit();
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
  /* Còpia: si s'edita i es cancel·la, la nota no s'ha de quedar tocada. */
  _postitItems = (p.items || []).map(function (it) { return { t: it.t, fet: !!it.fet }; });
  const nouI = document.getElementById('postitItemNou');
  if (nouI) nouI.value = '';
  _postitRenderItemsEdit();
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
      onclick="_postitTriaColor('${_idJs(c)}')"></div>`
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
  /* Una nota amb només llista és perfectament vàlida: «coses a fer» i sis
     línies, sense cap text. */
  const pendent = (document.getElementById('postitItemNou') || {}).value || '';
  if (pendent.trim()) { _postitAfegeixItem(); }   // no perdis el que estava escrivint
  const items = _postitItems.filter(function (it) { return it && it.t; });
  if (!titol && !text && !items.length) { showToast('Escriu alguna cosa al post-it', 'error'); return; }

  if (_postitEditId) {
    // Editar
    const p = _postits.find(x => x.id === _postitEditId);
    if (p) { p.titol = titol; p.text = text; p.color = _postitColor; p.data = data; p.important = important; p.items = items; p.ts = p.ts || Date.now(); }
  } else {
    // Nou: l'ordre és el més baix (apareix primer entre els de la seva categoria)
    const minOrdre = _postits.length ? Math.min(..._postits.map(p => p.ordre || 0)) : 0;
    _postits.push({
      id: 'pt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      titol, text, color: _postitColor, data, important, items,
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
/* Desar un post-it. Abans deia «es desaran quan tornis a tenir connexio»
   i no era veritat: no hi havia cap cua, i el primer refresc que arribava
   del servidor —que encara no el portava— l esborrava de la pantalla i del
   navegador. Ara va per la cua de debo (_desaAlFull). */
function _postitsPersist() {
  try { localStorage.setItem('postits', JSON.stringify(_postits)); } catch(e) {}
  if (!config.scriptUrl) return;
  const cos = { action: 'savePostits', postits: _postits };
  /* Amb la cua si hi és; si no hi fos, desa igualment. Un post-it que deixa
     de pujar en silenci és justament el que s'intentava arreglar. */
  /* El  diu al servidor què havia vist aquesta pestanya: sense això,
     dues pestanyes obertes s esborraven els post-its l una a l altra. */
  try { cos.base = localStorage.getItem('postits_base') || ''; } catch (e) {}
  if (typeof _desaAlFull === 'function') {
    _desaAlFull(cos).then(function (r) {
      if (r && r.ok && r.ts) { try { localStorage.setItem('postits_base', String(r.ts)); } catch (e) {} }
    });
  }
  else appsScriptPost(cos).then(r => { if (r && r.ok === false) showToast('Error desant: ' + r.error, 'error'); })
                          .catch(() => showToast('No s\'ha pogut desar el post-it', 'error'));
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
  _postitMou(_postitDragId, targetId);
}

/* ⚠ AL MOBIL I A LA TAULETA NO ES PODIA MOURE CAP NOTA.

   Trobat a l auditoria del 6/9/2026: reordenar nomes es podia fer
   arrossegant, i l arrossegar del navegador (HTML5 drag-and-drop) no existeix
   a les pantalles tactils. Ara tambe va tocant: toques la nota que vols moure
   i despres on la vols. Amb el ratoli, l arrossegar de sempre segueix igual.

   La feina de moure viu aqui, en un sol lloc, perque les dues maneres facin
   exactament el mateix. */
function _postitMou(quinId, targetId) {
  if (!quinId || quinId === targetId) return;
  const drag = _postits.find(p => p.id === quinId);
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
  const senseDrag = ordreVisual.filter(p => p.id !== quinId);
  const idx = senseDrag.findIndex(p => p.id === targetId);
  senseDrag.splice(idx, 0, drag);
  // Reassigna ordre seqüencial
  senseDrag.forEach((p, i) => { p.ordre = i; });

  _postitDragId = null;
  _postitTriat = null;
  renderPostits();
  _postitsPersist();
}

let _postitTriat = null;
function _postitToca(e, id) {
  /* Si s ha clicat un boto (editar, esborrar, una casella de la llista) aixo
     no hi te res a veure. */
  if (e.target.closest && e.target.closest('button, input, a, label, .postit-item')) return;
  if (_postitDragId) return;              // s esta arrossegant amb el ratoli
  if (!_postitTriat) { _postitTriat = id; renderPostits(); _postitAvisTria(); return; }
  if (_postitTriat === id) { _postitTriat = null; renderPostits(); _postitAvisTria(); return; }
  _postitMou(_postitTriat, id);
  _postitAvisTria();
}
function _postitAvisTria() {
  const el = document.getElementById('postitTriaHint');
  if (!el) return;
  if (!_postitTriat) { el.textContent = ''; el.style.display = 'none'; return; }
  const p = _postits.find(x => x.id === _postitTriat);
  el.textContent = 'Has triat «' + ((p && (p.titol || p.text)) || 'aquesta nota').slice(0, 40) +
                   '». Ara toca on la vols posar (o torna a tocar-la per deixar-ho estar).';
  el.style.display = '';
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
