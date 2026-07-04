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

// _seientsMarkers: marcadors de l'aula (taula del mestre, porta, finestres)
// marker = { tipus:'mestre'|'porta'|'finestra', x, y }
let _seientsMarkers = [];
let _seientsMarkerDrag = null;

const _MARKER_INFO = {
  mestre:   { emoji: '👩‍🏫', nom: 'Taula del mestre' },
  porta:    { emoji: '🚪', nom: 'Porta' },
  finestra: { emoji: '🪟', nom: 'Finestres' },
};

// Afegeix un marcador al centre del canvas (si no existeix ja)
function seientsAddMarker(tipus) {
  if (_seientsMarkers.some(m => m.tipus === tipus)) {
    showToast('Aquest marcador ja hi és. Arrossega\'l per moure\'l.', 'info');
    return;
  }
  const canvas = document.getElementById('seientsCanvas');
  const w = canvas ? canvas.clientWidth : 600;
  const h = canvas ? canvas.clientHeight : 400;
  // Posició per defecte segons el tipus
  let x = w/2, y = h/2;
  if (tipus === 'mestre') { x = w/2; y = 20; }        // davant, prop pissarra
  else if (tipus === 'porta') { x = 20; y = h - 60; } // cantonada
  else if (tipus === 'finestra') { x = w - 70; y = h/2; } // lateral
  _seientsMarkers.push({ tipus, x, y });
  renderSeients();
}

function seientsRemoveMarker(tipus) {
  _seientsMarkers = _seientsMarkers.filter(m => m.tipus !== tipus);
  renderSeients();
}

// Drag dels marcadors pel canvas
function _seientsMarkerDragStart(e, tipus) {
  e.preventDefault();
  const marker = _seientsMarkers.find(m => m.tipus === tipus);
  if (!marker) return;
  const canvas = document.getElementById('seientsCanvas');
  const rect = canvas.getBoundingClientRect();
  _seientsMarkerDrag = {
    tipus,
    offsetX: e.clientX - rect.left - marker.x,
    offsetY: e.clientY - rect.top - marker.y,
  };
  document.addEventListener('mousemove', _seientsMarkerDragMove);
  document.addEventListener('mouseup', _seientsMarkerDragEnd);
}
function _seientsMarkerDragMove(e) {
  if (!_seientsMarkerDrag) return;
  const canvas = document.getElementById('seientsCanvas');
  const rect = canvas.getBoundingClientRect();
  const marker = _seientsMarkers.find(m => m.tipus === _seientsMarkerDrag.tipus);
  if (!marker) return;
  marker.x = Math.max(0, Math.min(rect.width - 40, e.clientX - rect.left - _seientsMarkerDrag.offsetX));
  marker.y = Math.max(0, Math.min(rect.height - 30, e.clientY - rect.top - _seientsMarkerDrag.offsetY));
  const el = canvas.querySelector(`[data-marker="${_seientsMarkerDrag.tipus}"]`);
  if (el) { el.style.left = marker.x + 'px'; el.style.top = marker.y + 'px'; }
}
function _seientsMarkerDragEnd() {
  _seientsMarkerDrag = null;
  document.removeEventListener('mousemove', _seientsMarkerDragMove);
  document.removeEventListener('mouseup', _seientsMarkerDragEnd);
  try { localStorage.setItem('seients_markers', JSON.stringify(_seientsMarkers)); } catch(e) {}
}

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
  // Marcadors de l'aula
  if (!_seientsMarkers.length) {
    try {
      const savedM = JSON.parse(localStorage.getItem('seients_markers') || 'null');
      if (savedM && Array.isArray(savedM)) _seientsMarkers = savedM;
    } catch(e) {}
  }
  // Assegura que hi ha alumnes de tutoria SENSE desdoblament
  _seientsAssegurraAlumnes();
  renderSeients();
  // 2) En segon pla, carrega la versió del Sheets (per sincronitzar entre dispositius)
  _seientsLoadFromSheets();
}

// L'eina de seients usa SEMPRE tots els alumnes del grup de tutoria,
// sense aplicar desdoblaments (tots els nens del curs).
async function _seientsAssegurraAlumnes() {
  // Si ja tenim els students de tutoria carregats, prou.
  const tutorGrup = (typeof _perfilTutorGrupKey === 'function') ? _perfilTutorGrupKey() : null;
  if (!tutorGrup || !config.scriptUrl) return;
  // students ja hauria de ser el grup de tutoria (sense desdoblament) per defecte.
  // Si en algun moment s'ha filtrat, el restaurem.
  if (typeof _restoreTutoriaStudents === 'function') {
    try { _restoreTutoriaStudents(); } catch(e) {}
  }
}

async function _seientsLoadFromSheets() {
  if (!config.scriptUrl) return;
  try {
    const r = await appsScriptGet({ action: 'loadSeients' });
    if (r.ok) _applySeientsData(r);
  } catch(e) { /* silenciós; ja tenim el cache local */ }
}

// Aplica dades de seients (del loadSeients o del bootstrap)
function _applySeientsData(r) {
  if (!r) return;
  if (r.layout && Array.isArray(r.layout) && r.layout.length) {
    _seientsLayout = r.layout;
    try { localStorage.setItem('seients_layout', JSON.stringify(r.layout)); } catch(e) {}
  }
  if (r.markers && Array.isArray(r.markers)) {
    _seientsMarkers = r.markers;
    try { localStorage.setItem('seients_markers', JSON.stringify(r.markers)); } catch(e) {}
  }
  if (r.history) {
    try { localStorage.setItem('seients_history', JSON.stringify(r.history)); } catch(e) {}
  }
  if (typeof renderSeients === 'function') { try { renderSeients(); } catch(e) {} }
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

/* ---- Repartiment automàtic tenint MOLT en compte les condicions ---- */
function seientsAutoAssign() {
  const totalSeats = _seientsLayout.reduce((n, g) => n + g.seats.length, 0);
  if (totalSeats === 0) { showToast('Primer crea alguna fila de taules', 'error'); return; }

  // Calcula la geometria de cada seient (posició al canvas) i les distàncies
  // als marcadors (mestre, porta, finestres)
  const seatGeom = _seientsCalculaGeometria();

  // Historial de parelles (per evitar repeticions)
  const history = _loadPairHistory();

  // 1) ALUMNES FIXATS: si un alumne té "sempre al mateix lloc" i ja té un
  //    seient assignat, respecta'l i no el mogu is.
  const fixats = {}; // studentId → seatRef
  _seientsLayout.forEach(g => g.seats.forEach(s => {
    if (s.studentId != null && _seientsAlumneFixat(s.studentId)) {
      fixats[s.studentId] = s;
    }
  }));

  // Buida tots els seients EXCEPTE els fixats
  _seientsLayout.forEach(g => g.seats.forEach(s => {
    if (!(s.studentId != null && fixats[s.studentId] === s)) s.studentId = null;
  }));

  // Alumnes pendents (els que no estan fixats)
  const totsAlumnes = students.slice();
  const pending = totsAlumnes
    .filter(s => !(fixats[s.id]))
    .sort(() => Math.random() - 0.5)
    .map(s => s.id);

  // Ordre de seients a omplir: prioritza els que tenen característiques especials
  // (prop del mestre, lluny de porta/finestra) perquè s'assignin primer als
  // alumnes que ho necessiten.
  const seatsLliures = [];
  _seientsLayout.forEach(g => g.seats.forEach((s, i) => {
    if (s.studentId == null) seatsLliures.push({ seat: s, grup: g, idx: i });
  }));

  // 2) Assigna primer els alumnes amb MÉS condicions (els més exigents)
  const pendingOrdenat = pending.slice().sort((a, b) =>
    _seientsNumCondicions(b) - _seientsNumCondicions(a)
  );

  for (const sid of pendingOrdenat) {
    // Troba el millor seient lliure per a aquest alumne segons les seves condicions
    let millorSeat = null, millorScore = -Infinity;
    for (const sl of seatsLliures) {
      if (sl.seat.studentId != null) continue; // ja ocupat
      const score = _seientsPuntuaSeient(sid, sl, seatGeom, history);
      if (score > millorScore) { millorScore = score; millorSeat = sl; }
    }
    if (millorSeat) {
      millorSeat.seat.studentId = sid;
    }
  }

  renderSeients();

  // Avís de condicions no complertes
  const incompliments = _seientsComprovaIncompliments(seatGeom);
  const sobren = totsAlumnes.length - totalSeats;
  if (incompliments > 0) {
    showToast(`Repartits! Però ${incompliments} condició${incompliments>1?'ns':''} no s'ha${incompliments>1?'n':''} pogut complir (potser falten llocs adequats).`, 'error');
  } else if (sobren > 0) {
    showToast(`Repartits! ${sobren} alumne${sobren>1?'s':''} sense lloc (falten taules).`, 'info');
  } else {
    showToast('Alumnes repartits tenint en compte totes les condicions ✓', 'success');
  }
}

// Nombre de condicions de seient d'un alumne (per prioritzar-lo)
function _seientsNumCondicions(sid) {
  const s = (personal[sid] && personal[sid].seient) || _seientsAlumneSeient(sid);
  if (!s) return 0;
  let n = 0;
  if (s.mestre) n++;
  if (s.llunyPorta) n++;
  if (s.llunyFinestra) n++;
  if (s.noAmb && s.noAmb.length) n += s.noAmb.length;
  if (s.fixat) n += 5; // molt prioritari
  return n;
}

// Retorna les condicions de seient d'un alumne (de personal o de students)
function _seientsAlumneSeient(sid) {
  if (personal[sid] && personal[sid].seient) return personal[sid].seient;
  const s = students.find(x => x.id === sid);
  if (s && s.seient) return s.seient;
  return null;
}

// Un alumne està fixat sempre al mateix lloc?
function _seientsAlumneFixat(sid) {
  const s = _seientsAlumneSeient(sid);
  return !!(s && s.fixat);
}

// Puntua com de bo és un seient per a un alumne segons les seves condicions.
// Com més alt, millor. Les condicions tenen MOLT pes.
function _seientsPuntuaSeient(sid, seatLoc, seatGeom, history) {
  const cond = _seientsAlumneSeient(sid) || {};
  const geo = seatGeom[seatLoc.seat.id];
  let score = 0;

  if (geo) {
    // Prop del mestre: com més a prop, més punts (pes ALT)
    if (cond.mestre) {
      if (geo.distMestre != null) score += (1 - geo.distMestreNorm) * 1000;
      else score -= 200; // no hi ha marcador de mestre: penalitza lleu
    }
    // Lluny de la porta: com més lluny, més punts (pes ALT)
    if (cond.llunyPorta) {
      if (geo.distPorta != null) score += geo.distPortaNorm * 1000;
      else score -= 100;
    }
    // Lluny de les finestres: com més lluny, més punts (pes ALT)
    if (cond.llunyFinestra) {
      if (geo.distFinestra != null) score += geo.distFinestraNorm * 1000;
      else score -= 100;
    }
  }

  // Evita repetir parelles amb els veïns ja asseguts (pes moderat)
  const veins = _seientsVeinsDe(seatLoc);
  for (const v of veins) {
    if (v != null) score -= (history[_pairKey(sid, v)] || 0) * 50;
  }

  // INCOMPATIBILITATS: no pot seure AL COSTAT d'aquests companys (pes molt alt)
  const incompatibles = _seientsIncompatiblesDe(sid);
  for (const v of veins) {
    if (v != null && incompatibles.has(v)) score -= 100000; // pràcticament prohibit
  }

  // Una mica d'aleatorietat perquè no sigui sempre idèntic
  score += Math.random() * 5;
  return score;
}

// Retorna el conjunt d'ids d'alumnes amb qui 'sid' NO pot seure al costat.
// La relació és bidireccional: si A no pot amb B, B tampoc amb A.
function _seientsIncompatiblesDe(sid) {
  const set = new Set();
  const _rowIdDe = (id) => {
    const s = students.find(x => x.id === id);
    return (s && ((personal[id] && personal[id].rowId) || s.rowId)) || id;
  };
  // Els que aquest alumne té marcats
  const cond = _seientsAlumneSeient(sid);
  if (cond && cond.noAmb && cond.noAmb.length) {
    students.forEach(s => {
      const sRow = _rowIdDe(s.id);
      if (cond.noAmb.some(r => String(r) === String(sRow))) set.add(s.id);
    });
  }
  // Els que tenen a AQUEST alumne marcat (bidireccional)
  const meuRow = _rowIdDe(sid);
  students.forEach(s => {
    const c = _seientsAlumneSeient(s.id);
    if (c && c.noAmb && c.noAmb.some(r => String(r) === String(meuRow))) set.add(s.id);
  });
  return set;
}

// Veïns immediats d'un seient (esquerra-dreta dins del grup)
function _seientsVeinsDe(seatLoc) {
  const g = seatLoc.grup, i = seatLoc.idx;
  const veins = [];
  if (i > 0 && g.seats[i-1].studentId != null) veins.push(g.seats[i-1].studentId);
  if (i < g.seats.length-1 && g.seats[i+1].studentId != null) veins.push(g.seats[i+1].studentId);
  return veins;
}

// Calcula la geometria de cada seient: posició i distàncies (normalitzades) als marcadors
function _seientsCalculaGeometria() {
  const geom = {};
  const mestre = _seientsMarkers.find(m => m.tipus === 'mestre');
  const porta = _seientsMarkers.find(m => m.tipus === 'porta');
  const finestra = _seientsMarkers.find(m => m.tipus === 'finestra');

  // Recull totes les posicions dels seients
  const posicions = [];
  _seientsLayout.forEach(g => {
    g.seats.forEach((s, i) => {
      // Posició aproximada del seient dins del canvas
      let sx = g.x, sy = g.y;
      if (g.orient === 'h') { sx = g.x + i * 46; sy = g.y; }
      else { sx = g.x; sy = g.y + i * 46; }
      posicions.push({ id: s.id, x: sx, y: sy });
    });
  });

  const dist = (ax, ay, bx, by) => Math.sqrt((ax-bx)**2 + (ay-by)**2);
  // Distàncies màximes per normalitzar
  let maxM = 1, maxP = 1, maxF = 1;
  posicions.forEach(p => {
    if (mestre) maxM = Math.max(maxM, dist(p.x, p.y, mestre.x, mestre.y));
    if (porta) maxP = Math.max(maxP, dist(p.x, p.y, porta.x, porta.y));
    if (finestra) maxF = Math.max(maxF, dist(p.x, p.y, finestra.x, finestra.y));
  });

  posicions.forEach(p => {
    const g = { x: p.x, y: p.y };
    if (mestre) { g.distMestre = dist(p.x,p.y,mestre.x,mestre.y); g.distMestreNorm = g.distMestre/maxM; }
    else { g.distMestre = null; }
    if (porta) { g.distPorta = dist(p.x,p.y,porta.x,porta.y); g.distPortaNorm = g.distPorta/maxP; }
    else { g.distPorta = null; }
    if (finestra) { g.distFinestra = dist(p.x,p.y,finestra.x,finestra.y); g.distFinestraNorm = g.distFinestra/maxF; }
    else { g.distFinestra = null; }
    geom[p.id] = g;
  });
  return geom;
}

// Compta quantes condicions no s'han pogut complir (per avisar l'usuari)
function _seientsComprovaIncompliments(seatGeom) {
  let incompliments = 0;
  _seientsLayout.forEach(g => g.seats.forEach((s, i) => {
    if (s.studentId == null) return;
    const cond = _seientsAlumneSeient(s.studentId);
    const geo = seatGeom[s.id];
    // Incompatibilitats: mira només el veí de la DRETA per no comptar doble
    const incompatibles = _seientsIncompatiblesDe(s.studentId);
    if (i < g.seats.length-1 && g.seats[i+1].studentId != null && incompatibles.has(g.seats[i+1].studentId)) incompliments++;
    if (!cond || !geo) return;
    // Condicions de posició
    if (cond.mestre && geo.distMestreNorm != null && geo.distMestreNorm > 0.6) incompliments++;
    if (cond.llunyPorta && geo.distPortaNorm != null && geo.distPortaNorm < 0.4) incompliments++;
    if (cond.llunyFinestra && geo.distFinestraNorm != null && geo.distFinestraNorm < 0.4) incompliments++;
  }));
  return incompliments;
}

/* ---- Desar ---- */
function seientsSave() {
  localStorage.setItem('seients_layout', JSON.stringify(_seientsLayout));
  try { localStorage.setItem('seients_markers', JSON.stringify(_seientsMarkers)); } catch(e) {}
  // Desa també al núvol (layout + marcadors)
  if (config.scriptUrl) {
    appsScriptPost({ action: 'saveSeients', layout: _seientsLayout, markers: _seientsMarkers }).catch(()=>{});
  }
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
  // Marcadors de l'aula (mestre, porta, finestres)
  let markersHtml = '';
  _seientsMarkers.forEach(m => {
    const info = _MARKER_INFO[m.tipus] || { emoji:'📍', nom:m.tipus };
    markersHtml += `<div class="seients-marker seients-marker-${m.tipus}" data-marker="${m.tipus}"
      style="left:${m.x}px;top:${m.y}px"
      onmousedown="_seientsMarkerDragStart(event,'${m.tipus}')" title="${info.nom} — arrossega per moure">
      <span class="seients-marker-emoji">${info.emoji}</span>
      <span class="seients-marker-nom">${info.nom}</span>
      <span class="seients-marker-del" onmousedown="event.stopPropagation()" onclick="seientsRemoveMarker('${m.tipus}')" title="Treure">×</span>
    </div>`;
  });
  // Preserva l'element buit
  canvas.innerHTML = (emptyEl ? emptyEl.outerHTML : '') + html + markersHtml;
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
