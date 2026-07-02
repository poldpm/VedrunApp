/* ============================================================
   DISTRIBUCIÓ DE L'AULA — seients.js
   Files de taules a mida (nombre + orientació), movibles
   lliurement pel taulell. Reparteix evitant repetir parelles.
   ============================================================ */

// _seientsLayout: llista de grups posicionables
// grup = { id, orient:'h'|'v', x, y, seats:[{id, studentId}] }
let _seientsLayout = [];
let _seientsNum = 2;          // nombre de taules de la nova fila
let _seientsOrient = 'h';     // orientació de la nova fila
let _seientsDragData = null;  // drag d'alumnes
let _seientsGroupDrag = null; // drag de grups (moure per canvas)

/* ---- Historial de parelles ---- */
function _pairKey(a, b) { return [a, b].sort().join('_'); }

// Retorna les parelles de VEÏNS IMMEDIATS d'un grup (esquerra-dreta consecutius).
// Un grup de 4 en quadrat es munta com dues files de 2, així que la veïnança
// és la de cada fila; per files llargues, cada alumne només toca l'anterior i el següent.
function _neighborPairs(g) {
  const pairs = [];
  const seats = g.seats;
  for (let i = 0; i < seats.length - 1; i++) {
    const a = seats[i].studentId, b = seats[i+1].studentId;
    if (a && b) pairs.push([a, b]);
  }
  return pairs;
}
function _loadPairHistory() {
  try { return JSON.parse(localStorage.getItem('seients_history') || '{}'); }
  catch(e) { return {}; }
}
function _savePairHistory(h) {
  try { localStorage.setItem('seients_history', JSON.stringify(h)); } catch(e) {}
  _seientsSyncToSheets(); // persisteix també al Google Sheets
}

// Desa layout + historial al Google Sheets (en segon pla, sense bloquejar)
function _seientsSyncToSheets() {
  if (!config.scriptUrl) return;
  const layout  = _seientsLayout;
  const history = _loadPairHistory();
  appsScriptPost({ action: 'saveSeients', layout: JSON.stringify(layout), history: JSON.stringify(history) })
    .catch(() => { /* silenciós; ja hi ha còpia local */ });
}

function initSeients() {
  // 1) Pinta immediatament amb el cache local (instantani)
  if (!_seientsLayout.length) {
    try {
      const saved = JSON.parse(localStorage.getItem('seients_layout') || 'null');
      if (saved && Array.isArray(saved)) _seientsLayout = saved;
    } catch(e) {}
  }
  renderSeients();
  // 2) En segon pla, carrega la versió del Sheets (per sincronitzar entre dispositius)
  _seientsLoadFromSheets();
}

async function _seientsLoadFromSheets() {
  if (!config.scriptUrl) return;
  try {
    const r = await appsScriptGet({ action: 'loadSeients' });
    if (r.ok) {
      if (r.layout && Array.isArray(r.layout) && r.layout.length) {
        _seientsLayout = r.layout;
        localStorage.setItem('seients_layout', JSON.stringify(r.layout));
      }
      if (r.history) {
        localStorage.setItem('seients_history', JSON.stringify(r.history));
      }
      renderSeients();
    }
  } catch(e) { /* silenciós; ja tenim el cache local */ }
}

/* ---- Creador de files ---- */
function _seientsStep(d) {
  _seientsNum = Math.max(1, Math.min(10, _seientsNum + d));
  document.getElementById('seientsNum').textContent = _seientsNum;
}
function _seientsSetOrient(o) {
  _seientsOrient = o;
  document.getElementById('orientH').classList.toggle('active', o === 'h');
  document.getElementById('orientV').classList.toggle('active', o === 'v');
}
function _newSeat() { return { id: 's' + Date.now() + Math.random().toString(36).slice(2,6), studentId: null }; }
function seientsAddRow() {
  const n = _seientsNum;
  // Posició inicial esglaonada perquè no se solapin
  const count = _seientsLayout.length;
  const grup = {
    id: 'g' + Date.now() + Math.random().toString(36).slice(2,6),
    orient: _seientsOrient,
    x: 20 + (count % 4) * 40,
    y: 20 + (count % 6) * 30,
    seats: Array.from({ length: n }, _newSeat),
  };
  _seientsLayout.push(grup);
  renderSeients();
  _seientsSyncToSheets();
}
function seientsDeleteGroup(gid) {
  _seientsLayout = _seientsLayout.filter(x => x.id !== gid);
  renderSeients();
  _seientsSyncToSheets();
}
function seientsClearLayout() {
  if (!_seientsLayout.length) return;
  if (!confirm('Segur que vols buidar tot el taulell? Els alumnes tornaran a la llista.')) return;
  _seientsLayout = [];
  renderSeients();
  _seientsSyncToSheets();
}

/* ---- Repartiment automàtic evitant repeticions ---- */
function seientsAutoAssign() {
  const totalSeats = _seientsLayout.reduce((n, g) => n + g.seats.length, 0);
  if (totalSeats === 0) { showToast('Primer crea alguna fila de taules', 'error'); return; }

  _seientsLayout.forEach(g => g.seats.forEach(s => s.studentId = null));
  const history = _loadPairHistory();
  const pending = students.slice().sort(() => Math.random() - 0.5).map(s => s.id);

  for (const g of _seientsLayout) {
    for (let i = 0; i < g.seats.length; i++) {
      if (!pending.length) break;
      const seat = g.seats[i];
      // Només mira els VEÏNS immediats d'aquest seient (l'anterior i el següent)
      const veins = [];
      if (i > 0 && g.seats[i-1].studentId) veins.push(g.seats[i-1].studentId);
      if (i < g.seats.length-1 && g.seats[i+1].studentId) veins.push(g.seats[i+1].studentId);
      let best = pending[0], bestScore = Infinity;
      for (const cand of pending) {
        let score = 0;
        for (const v of veins) score += (history[_pairKey(cand, v)] || 0) * 10;
        score += Math.random();
        if (score < bestScore) { bestScore = score; best = cand; }
      }
      seat.studentId = best;
      pending.splice(pending.indexOf(best), 1);
    }
  }
  renderSeients();
  const sobren = students.length - totalSeats;
  if (sobren > 0) showToast(`Repartits! ${sobren} alumne${sobren>1?'s':''} sense lloc (falten taules).`, 'info');
  else showToast('Alumnes repartits evitant repeticions ✓', 'success');
}

/* ---- Desar ---- */
function seientsSave() {
  localStorage.setItem('seients_layout', JSON.stringify(_seientsLayout));
  const history = _loadPairHistory();
  _seientsLayout.forEach(g => {
    // Només registra els veïns immediats (esquerra-dreta), no tota la fila
    _neighborPairs(g).forEach(([a, b]) => {
      const k = _pairKey(a, b);
      history[k] = (history[k] || 0) + 1;
    });
  });
  _savePairHistory(history);
  showToast('Distribució desada i parelles registrades ✓', 'success');
  renderSeients();
}

/* ---- Render ---- */
function _initials(id) {
  const s = students.find(x => x.id == id);
  if (!s) return '';
  return s.nom.trim().split(/\s+/).map(w => w[0]).slice(0,2).join('').toUpperCase();
}
function renderSeients() {
  const canvas = document.getElementById('seientsCanvas');
  const emptyEl = document.getElementById('seientsEmpty');
  if (!canvas) return;
  if (emptyEl) emptyEl.style.display = _seientsLayout.length ? 'none' : 'flex';

  const history = _loadPairHistory();
  const nameById = id => { const s = students.find(x => x.id == id); return s ? s.nom : ''; };

  // Renderitza els grups posicionats
  let html = '';
  _seientsLayout.forEach(g => {
    const seatsHtml = g.seats.map((seat, idx) => {
      if (!seat.studentId) {
        return `<div class="seient buit" data-seat="${seat.id}"
          ondragover="_seientsDragOver(event,'${seat.id}')" ondragleave="_seientsDragLeave(event)"
          ondrop="_seientsDrop(event,'${seat.id}')">buit</div>`;
      }
      const nom = nameById(seat.studentId);
      const primer = nom.split(' ')[0];
      // Només mira els veïns immediats (anterior i següent de la fila)
      const veins = [];
      if (idx > 0 && g.seats[idx-1].studentId) veins.push(g.seats[idx-1].studentId);
      if (idx < g.seats.length-1 && g.seats[idx+1].studentId) veins.push(g.seats[idx+1].studentId);
      const repeteix = veins.some(v => (history[_pairKey(seat.studentId, v)] || 0) > 0);
      return `<div class="seient ocupat" data-seat="${seat.id}" draggable="true"
        ondragstart="_seientsDragStart(event,'seat','${seat.studentId}','${seat.id}')"
        ondragend="_seientsDragEnd(event)"
        ondragover="_seientsDragOver(event,'${seat.id}')" ondragleave="_seientsDragLeave(event)"
        ondrop="_seientsDrop(event,'${seat.id}')"
        title="${escapeHtml(nom)}">
        <span class="seient-avatar">${_initials(seat.studentId)}</span>
        ${repeteix ? '<span class="seient-warn">⚠</span>' : ''}
        ${escapeHtml(primer)}
      </div>`;
    }).join('');
    html += `<div class="seients-group ${g.orient === 'v' ? 'vertical' : ''}" data-group="${g.id}"
      style="left:${g.x}px; top:${g.y}px"
      onmousedown="_seientsGroupMouseDown(event,'${g.id}')">
      <div class="seients-group-handle" title="Arrossega per moure">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="11" height="11"><path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20"/></svg>
      </div>
      <div class="seients-group-del" onmousedown="event.stopPropagation()" onclick="seientsDeleteGroup('${g.id}')" title="Treure fila">×</div>
      ${seatsHtml}
    </div>`;
  });
  // Preserva l'element buit
  canvas.innerHTML = (emptyEl ? emptyEl.outerHTML : '') + html;
  // Re-oculta el buit si cal
  const newEmpty = document.getElementById('seientsEmpty');
  if (newEmpty) newEmpty.style.display = _seientsLayout.length ? 'none' : 'flex';

  // Pool
  const asseguts = new Set();
  _seientsLayout.forEach(g => g.seats.forEach(s => { if (s.studentId) asseguts.add(String(s.studentId)); }));
  const pool = students.filter(s => !asseguts.has(String(s.id)));
  const poolEl = document.getElementById('seientsPool');
  if (poolEl) {
    poolEl.innerHTML = pool.length ? pool.map(s =>
      `<div class="seients-pool-item" draggable="true"
        ondragstart="_seientsDragStart(event,'pool','${s.id}',null)" ondragend="_seientsDragEnd(event)">
        <span class="seients-pool-avatar">${_initials(s.id)}</span>${escapeHtml(s.nom)}
      </div>`
    ).join('') : '<div class="seients-pool-empty">Tots asseguts 🎉</div>';
  }
  const pc = document.getElementById('seientsPoolCount');
  if (pc) pc.textContent = pool.length ? '(' + pool.length + ')' : '';
  const cnt = document.getElementById('seientsCount');
  if (cnt) {
    const totalSeats = _seientsLayout.reduce((n, g) => n + g.seats.length, 0);
    cnt.textContent = totalSeats + ' seients · ' + students.length + ' alumnes';
  }
}

/* ---- Moure grups pel canvas (mouse) ---- */
function _seientsGroupMouseDown(ev, gid) {
  // No iniciar si s'arrossega un alumne (els seients tenen draggable)
  if (ev.target.closest('.seient.ocupat')) return;
  const g = _seientsLayout.find(x => x.id === gid);
  if (!g) return;
  const canvas = document.getElementById('seientsCanvas');
  const groupEl = ev.currentTarget;
  const rect = canvas.getBoundingClientRect();
  const offsetX = ev.clientX - rect.left - g.x + canvas.scrollLeft;
  const offsetY = ev.clientY - rect.top - g.y + canvas.scrollTop;
  groupEl.classList.add('dragging-group');

  function onMove(e) {
    let nx = e.clientX - rect.left - offsetX + canvas.scrollLeft;
    let ny = e.clientY - rect.top - offsetY + canvas.scrollTop;
    nx = Math.max(0, nx);
    ny = Math.max(0, ny);
    g.x = nx; g.y = ny;
    groupEl.style.left = nx + 'px';
    groupEl.style.top = ny + 'px';
  }
  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    groupEl.classList.remove('dragging-group');
    localStorage.setItem('seients_layout', JSON.stringify(_seientsLayout));
    _seientsSyncToSheets();
  }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
  ev.preventDefault();
}

/* ---- Drag & drop d'alumnes ---- */
function _seientsDragStart(ev, from, studentId, seatId) {
  _seientsDragData = { from, studentId, seatId };
  ev.dataTransfer.effectAllowed = 'move';
  ev.target.classList.add('dragging');
  ev.stopPropagation();
}
function _seientsDragEnd(ev) {
  ev.target.classList.remove('dragging');
  _seientsDragData = null;
}
function _seientsDragOver(ev, seatId) { ev.preventDefault(); ev.currentTarget.classList.add('dragover'); }
function _seientsDragLeave(ev) { ev.currentTarget.classList.remove('dragover'); }
function _seientsDrop(ev, targetSeatId) {
  ev.preventDefault(); ev.stopPropagation();
  ev.currentTarget.classList.remove('dragover');
  if (!_seientsDragData) return;
  const { from, studentId, seatId } = _seientsDragData;
  const targetSeat = _findSeat(targetSeatId);
  if (!targetSeat) return;
  if (from === 'pool') {
    targetSeat.studentId = studentId;
  } else if (from === 'seat') {
    const origSeat = _findSeat(seatId);
    if (!origSeat) return;
    const tmp = targetSeat.studentId;
    targetSeat.studentId = studentId;
    origSeat.studentId = tmp;
  }
  _seientsDragData = null;
  localStorage.setItem('seients_layout', JSON.stringify(_seientsLayout));
  _seientsSyncToSheets();
  renderSeients();
}
function _findSeat(seatId) {
  for (const g of _seientsLayout) {
    const s = g.seats.find(x => x.id === seatId);
    if (s) return s;
  }
  return null;
}

// Deixar anar alumnes al pool per treure'ls
document.addEventListener('DOMContentLoaded', () => {
  const pool = document.getElementById('seientsPool');
  if (pool) {
    pool.addEventListener('dragover', e => e.preventDefault());
    pool.addEventListener('drop', e => {
      e.preventDefault();
      if (_seientsDragData && _seientsDragData.from === 'seat') {
        const s = _findSeat(_seientsDragData.seatId);
        if (s) s.studentId = null;
        _seientsDragData = null;
        renderSeients();
      }
    });
  }
});
