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

/* DE QUIN GRUP ÉS EL PLÀNOL.

   Un tutor només en té un, el de la seva classe, i es desa tal com sempre
   (claus `seients_layout`, `seients_markers`, `seients_history`).

   A l'app de DIRECCIÓ no hi ha una classe sola: el plànol és el del grup que
   hagin triat a Alumnes, i cada grup té el seu (`seients_layout__4t B`). Si
   en compartissin un, en canviar de grup hi trobarien les taules amb els
   alumnes de l'altra classe assegudes. */
function _seientsGrup() {
  if (typeof esDireccio !== 'function' || !esDireccio()) return '';
  return (typeof _grupDeTreball === 'function' && _grupDeTreball()) || '';
}
function _seientsLS(base) {
  const g = _seientsGrup();
  return g ? base + '__' + g : base;
}

/* A direcció, diu de quin grup és el plànol que s'està tocant. Sense això,
   amb 18 grups possibles no hi ha manera de saber-ho mirant les taules.
   L'avís el pinta `_dirAvisGrup` (a app.js), igual que el de Registres i el
   d'Observacions, perquè els tres diguin el mateix i de la mateixa manera. */
function _seientsPintaAvisGrup() {
  if (typeof _dirAvisGrup !== 'function') return;
  _dirAvisGrup('seientsGrupAvis',
    'Estàs col·locant l\'aula de {grup}. Cada grup té el seu plànol.',
    'Primer tria un grup a Alumnes: el plànol i els alumnes són els d\'aquell grup.');
}

/* Direcció canvia de grup: el plànol que hi havia a la pantalla és de l'altre
   grup, s'ha de buidar i tornar a carregar el que toca. */
function _seientsCanviaGrup() {
  _seientsLayout = [];
  _seientsMarkers = [];
  try {
    const l = JSON.parse(localStorage.getItem(_seientsLS('seients_layout')) || 'null');
    if (l && Array.isArray(l)) _seientsLayout = _seientsLligaPerCodi(l);
    const m = JSON.parse(localStorage.getItem(_seientsLS('seients_markers')) || 'null');
    if (m && Array.isArray(m)) _seientsMarkers = m;
  } catch(e) {}
  if (typeof renderSeients === 'function') { try { renderSeients(); } catch(e) {} }
  _seientsPintaAvisGrup();
  _seientsLoadFromSheets(true);
}

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
  if (_seientsCalGrup()) return;
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
  _seientsPersistMarkers();
}

function seientsRemoveMarker(tipus) {
  _seientsMarkers = _seientsMarkers.filter(m => m.tipus !== tipus);
  renderSeients();
  _seientsPersistMarkers();
}

// Desa els marcadors (cache local + Google Sheets). Abans els marcadors només
// arribaven al full en prémer "Desar distribució"; si no, es perdien.
function _seientsPersistMarkers() {
  try { localStorage.setItem(_seientsLS('seients_markers'), JSON.stringify(_seientsMarkers)); } catch(e) {}
  if (config.scriptUrl) {
    _desaAlFull({ action: 'saveSeients', grup: _seientsGrup(), markers: JSON.stringify(_seientsMarkers) });
  }
}

// Drag dels marcadors pel canvas
function _seientsMarkerDragStart(e, tipus) {
  e.preventDefault();
  const marker = _seientsMarkers.find(m => m.tipus === tipus);
  if (!marker) return;
  const canvas = document.getElementById('seientsCanvas');
  const rect = canvas.getBoundingClientRect();
  // Cachegem rect + element + marcador a l'inici (com el drag de grups): així el
  // moviment no fa getBoundingClientRect ni querySelector a cada mousemove.
  _seientsMarkerDrag = {
    tipus, marker, rect,
    el: canvas.querySelector(`[data-marker="${tipus}"]`),
    raf: 0,
    offsetX: e.clientX - rect.left - marker.x,
    offsetY: e.clientY - rect.top - marker.y,
  };
  document.addEventListener('mousemove', _seientsMarkerDragMove);
  document.addEventListener('mouseup', _seientsMarkerDragEnd);
}
function _seientsMarkerDragMove(e) {
  const d = _seientsMarkerDrag;
  if (!d) return;
  const rect = d.rect, marker = d.marker;
  marker.x = Math.max(0, Math.min(rect.width - 40, e.clientX - rect.left - d.offsetX));
  marker.y = Math.max(0, Math.min(rect.height - 30, e.clientY - rect.top - d.offsetY));
  if (!d.raf && typeof requestAnimationFrame === 'function') {
    d.raf = requestAnimationFrame(() => {
      d.raf = 0;
      if (d.el) { d.el.style.left = marker.x + 'px'; d.el.style.top = marker.y + 'px'; }
    });
  } else if (d.el) { d.el.style.left = marker.x + 'px'; d.el.style.top = marker.y + 'px'; }
}
function _seientsMarkerDragEnd() {
  if (_seientsMarkerDrag && _seientsMarkerDrag.raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(_seientsMarkerDrag.raf);
  _seientsMarkerDrag = null;
  document.removeEventListener('mousemove', _seientsMarkerDragMove);
  document.removeEventListener('mouseup', _seientsMarkerDragEnd);
  _seientsPersistMarkers();
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
    // 0 és un alumne: amb `if (a && b)` el primer de la llista no comptava mai
    // com a parella i se li repetia el company curs rere curs.
    if (a != null && a !== '' && b != null && b !== '') pairs.push([a, b]);
  }
  return pairs;
}
function _loadPairHistory() {
  try { return JSON.parse(localStorage.getItem(_seientsLS('seients_history')) || '{}'); }
  catch(e) { return {}; }
}
function _savePairHistory(h) {
  try { localStorage.setItem(_seientsLS('seients_history'), JSON.stringify(h)); } catch(e) {}
  _seientsSyncToSheets(); // persisteix també al Google Sheets
}

/* ⚠ EL PLÀNOL ES BARREJAVA SOL.

   Trobat a la segona auditoria (8/9/2026). Cada seient guardava
   `studentId`, que és la POSICIÓ de l'alumne dins de `students` —el propi
   codi ho deia: «0 és un alumne, el primer de la llista». El full «Grups» de
   l'escola es reordena sol cada quart d'hora, i quan ho feia el plànol
   sencer es desmuntava: cada nen acabava en un altre lloc. És feina de tot
   el curs, i l'historial de parelles (el que evita repetir company) hi anava
   al darrere.

   Ara cada seient hi porta també el CODI PERMANENT (`rowId`), que és el que
   no canvia mai. Es desa afegit —`studentId` es manté— perquè un plànol
   guardat abans es pugui seguir llegint, i en carregar-lo es torna a lligar
   cada nen pel codi. */
function _seientsPosaCodis(layout) {
  (layout || []).forEach(g => (g.seats || []).forEach(s => {
    if (s.studentId == null || s.studentId === '') { delete s.rowId; return; }
    const al = students.find(x => String(x.id) === String(s.studentId));
    const codi = al && al.rowId !== undefined && al.rowId !== null && al.rowId !== '' ? al.rowId : null;
    if (codi !== null) s.rowId = codi;
  }));
  return layout;
}

/* En carregar: cada seient torna al seu nen pel codi, passi el que passi amb
   l'ordre de la llista. Un plànol antic (sense codis) es deixa tal com està:
   no es pot fer res millor, i estripar-lo seria pitjor. */
function _seientsLligaPerCodi(layout) {
  if (!Array.isArray(layout) || !students.length) return layout;
  const perCodi = {};
  students.forEach(s => {
    if (s.rowId !== undefined && s.rowId !== null && s.rowId !== '') perCodi[String(s.rowId)] = s.id;
  });
  if (!Object.keys(perCodi).length) return layout;   // aquest grup no porta codis
  layout.forEach(g => (g.seats || []).forEach(s => {
    if (!s.rowId) return;                            // seient buit o plànol antic
    const idAra = perCodi[String(s.rowId)];
    if (idAra !== undefined) s.studentId = idAra;
    else { s.studentId = null; delete s.rowId; }     // ja no és al grup
  }));
  return layout;
}

// Desa layout + historial al Google Sheets (en segon pla, sense bloquejar)
function _seientsSyncToSheets() {
  if (!config.scriptUrl) return;
  const layout  = _seientsPosaCodis(_seientsLayout);
  const history = _loadPairHistory();
  /* Per la cua: si no es pot desar ara, s'apunta i es torna a provar sol.
     Abans queia en un `catch` buit i el plànol es quedava només en aquest
     ordinador sense que ho digués ningú. */
  _desaAlFull({ action: 'saveSeients', grup: _seientsGrup(), layout: JSON.stringify(layout), history: JSON.stringify(history) });
}

function initSeients() {
  // 1) Pinta immediatament amb el cache local (instantani)
  if (!_seientsLayout.length) {
    try {
      const saved = JSON.parse(localStorage.getItem(_seientsLS('seients_layout')) || 'null');
      if (saved && Array.isArray(saved)) _seientsLayout = _seientsLligaPerCodi(saved);
    } catch(e) {}
  }
  // Marcadors de l'aula
  if (!_seientsMarkers.length) {
    try {
      const savedM = JSON.parse(localStorage.getItem(_seientsLS('seients_markers')) || 'null');
      if (savedM && Array.isArray(savedM)) _seientsMarkers = savedM;
    } catch(e) {}
  }
  _seientsPintaAvisGrup();
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
  const tutorGrup = (typeof _grupDeTreball === 'function') ? _grupDeTreball() : null;
  if (!tutorGrup || !config.scriptUrl) return;
  // students ja hauria de ser el grup de tutoria (sense desdoblament) per defecte.
  // Si en algun moment s'ha filtrat, el restaurem.
  if (typeof _restoreTutoriaStudents === 'function') {
    try { _restoreTutoriaStudents(); } catch(e) {}
  }
}

async function _seientsLoadFromSheets(forcat) {
  if (!config.scriptUrl) return;
  // El bootstrap ja els ha portat... tret que acabem de canviar de grup.
  if (!forcat && typeof _recentFullLoad === 'function' && _recentFullLoad()) return;
  try {
    const r = await appsScriptGet({ action: 'loadSeients', grup: _seientsGrup() });
    if (r.ok) _applySeientsData(r);
  } catch(e) { /* silenciós; ja tenim el cache local */ }
}

// Aplica dades de seients (del loadSeients o del bootstrap)
function _applySeientsData(r) {
  if (!r) return;
  if (r.layout && Array.isArray(r.layout) && r.layout.length) {
    // Cada nen torna al seu lloc pel codi permanent, no per la posició.
    _seientsLayout = _seientsLligaPerCodi(r.layout);
    try { localStorage.setItem(_seientsLS('seients_layout'), JSON.stringify(_seientsPosaCodis(_seientsLayout))); } catch(e) {}
  }
  // Només aplica els marcadors remots si en porten. Si el full encara no en té
  // (loadSeients retorna []), NO s'han de buidar els que ja tenim a la pantalla:
  // això és el que els feia desaparèixer de cop i esborrava també la còpia local.
  if (r.markers && Array.isArray(r.markers) && r.markers.length) {
    _seientsMarkers = r.markers;
    try { localStorage.setItem(_seientsLS('seients_markers'), JSON.stringify(r.markers)); } catch(e) {}
  }
  if (r.history) {
    try { localStorage.setItem(_seientsLS('seients_history'), JSON.stringify(r.history)); } catch(e) {}
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
/* Quant ocupa una fila de taules al taulell, en píxels. Ha d'anar de la mà
   del CSS: un seient fa 72×56, la separació entre seients és de 5 i la fila
   té 8 de coixí a cada costat. */
function _seientsMida(g) {
  const n = ((g && g.seats) || []).length || 1;
  const llarg = 16 + n * 72 + (n - 1) * 5;   // fila horitzontal
  const alt   = 16 + n * 56 + (n - 1) * 5;   // fila vertical
  return (g && g.orient === 'vertical')
    ? { w: 16 + 72, h: alt }
    : { w: llarg,   h: 16 + 56 };
}

/* ⚠ LES FILES NOVES SORTIEN UNES DAMUNT DE LES ALTRES.

   Trobat a la segona auditoria (8/9/2026). Aquí les files s'esglaonaven 40 px
   en horitzontal i 30 en vertical, quan una fila de quatre seients en fa 321
   d'ample i 74 d'alt: quedaven encavalcades. Amb tres files i els alumnes
   repartits, 8 dels 12 tenien el centre tapat per la fila de sobre i no es
   podien ni tocar ni arrossegar —ni amb el dit ni amb el ratolí—, o sigui que
   no es podien moure ni intercanviar. El comentari deia «esglaonada perquè no
   se solapin»; els números no ho aconseguien.

   Ara la fila nova es posa SOTA de tot el que ja hi ha, amb una separació de
   debò, i quan el taulell s'acaba per avall comença una columna nova a la
   dreta. Cap fila nova no en tapa una altra. */
/* A direcció, sense grup triat el plànol no és de ningú.

   ⚠ Segona auditoria (8/9/2026): la Distribució de l'aula deixava muntar
   taules, repartir-hi els alumnes i desar-ho tot sense haver triat cap grup.
   El plànol s'anava a la clau base (`seients_layout`, sense grup) i, en triar
   un grup després, desapareixia: la feina no era enlloc. Registres d'aula ja
   ho para des de l'auditoria anterior i diu exactament això. */
function _seientsCalGrup() {
  if (typeof esDireccio !== 'function' || !esDireccio()) return false;
  if (_seientsGrup()) return false;
  showToast('Primer tria el grup a dalt: sense grup no sé de quina aula és aquest plànol.', 'error');
  return true;
}

function seientsAddRow() {
  if (_seientsCalGrup()) return;
  const n = _seientsNum;
  const grup = {
    id: 'g' + Date.now() + Math.random().toString(36).slice(2,6),
    orient: _seientsOrient,
    x: 20,
    y: 20,
    seats: Array.from({ length: n }, _newSeat),
  };
  const SEP = 16;
  const mida = _seientsMida(grup);
  const taulell = document.getElementById('seientsBoard');
  const altMax = Math.max(320, (taulell && taulell.clientHeight) || 600);
  // Sota de tot el que ja hi ha; si no hi cap, columna nova a la dreta.
  let baix = 20, dreta = 20;
  (_seientsLayout || []).forEach(g => {
    const m = _seientsMida(g);
    baix  = Math.max(baix,  (g.y || 0) + m.h + SEP);
    dreta = Math.max(dreta, (g.x || 0) + m.w + SEP);
  });
  if (baix + mida.h <= altMax) { grup.y = baix; }
  else { grup.x = dreta; grup.y = 20; }
  _seientsLayout.push(grup);
  renderSeients();
  _seientsSyncToSheets();
}
function seientsDeleteGroup(gid) {
  // Esborrar una fila de taules també treu del plànol els alumnes que hi
  // seien, i es desa a l'instant. Val més preguntar-ho.
  const g = _seientsLayout.find(x => x.id === gid);
  const ocupats = g ? (g.seats || []).filter(s => s && s.studentId != null && s.studentId !== '').length : 0;
  const detall = ocupats ? ' Els ' + ocupats + ' alumnes que hi seuen tornaran a la llista.' : '';
  if (!confirm('Vols esborrar aquesta fila de taules?' + detall)) return;
  _seientsLayout = _seientsLayout.filter(x => x.id !== gid);
  renderSeients();
  _seientsSyncToSheets();
}
/* Desa el taulell: al navegador I al full. Abans hi havia llocs que
   nomes feien una de les dues coses —repartir no en feia cap— i el
   taulell tornava a com estava en recarregar (auditoria 6/9/2026). */
function _seientsDesaTaulell() {
  try { localStorage.setItem(_seientsLS('seients_layout'), JSON.stringify(_seientsLayout)); } catch(e) {}
  _seientsSyncToSheets();
}

function seientsClearLayout() {
  if (!_seientsLayout.length) return;
  if (!confirm('Segur que vols buidar tot el taulell? Els alumnes tornaran a la llista.')) return;
  _seientsLayout = [];
  renderSeients();
  _seientsDesaTaulell();
}

/* ---- Repartiment automàtic tenint MOLT en compte les condicions ---- */
function seientsAutoAssign() {
  if (_seientsCalGrup()) return;
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
  /* ⚠ Amb 0 alumnes deia «Alumnes repartits tenint en compte totes les
     condicions ✓» (auditoria 6/9/2026). */
  if (!totsAlumnes.length) {
    showToast('No hi ha cap alumne per repartir.', 'error');
    return;
  }
  if (!totalSeats) {
    showToast('No hi ha cap lloc on asseure ningú. Afegeix taules amb «Afegir al taulell».', 'error');
    return;
  }
  const incompliments = _seientsComprovaIncompliments(seatGeom);
  const sobren = totsAlumnes.length - totalSeats;
  if (incompliments > 0) {
    showToast(`Repartits! Però ${incompliments} condició${incompliments>1?'ns':''} no s'ha${incompliments>1?'n':''} pogut complir (potser falten llocs adequats).`, 'error');
  } else if (sobren > 0) {
    showToast(`Repartits! ${sobren} alumne${sobren>1?'s':''} sense lloc (falten taules).`, 'info');
  } else {
    showToast('Alumnes repartits tenint en compte totes les condicions ✓', 'success');
  }
  _seientsDesaTaulell();   // sense aixo el repartiment es perdia en recarregar
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
  if (_seientsCalGrup()) return;
  localStorage.setItem(_seientsLS('seients_layout'), JSON.stringify(_seientsLayout));
  try { localStorage.setItem(_seientsLS('seients_markers'), JSON.stringify(_seientsMarkers)); } catch(e) {}
  // Desa també al núvol (layout + marcadors)
  if (config.scriptUrl) {
    _desaAlFull({ action: 'saveSeients', grup: _seientsGrup(), layout: _seientsLayout, markers: _seientsMarkers });
  }
  /* ⚠ Amb 0 taules i 0 alumnes deia «Distribucio desada i parelles
     registrades ✓», que no es veritat: no hi ha res a desar ni cap parella.
     La mestra ho donava per fet (auditoria 6/9/2026). */
  const _asseguts = _seientsLayout.reduce((t, g) =>
    t + (g.seats || []).filter(s => s.studentId != null && s.studentId !== '').length, 0);
  if (!_seientsLayout.length) {
    showToast('Encara no hi ha cap taula al plànol. Afegeix-ne una amb «Afegir al taulell».', 'error');
    return;
  }
  if (!_asseguts) {
    showToast('No hi seu ningú: no hi ha cap parella per registrar. Reparteix els alumnes o posa-n’hi tu.', 'error');
    return;
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
      /* ⚠ `seat.studentId` pot valer 0, i 0 és un alumne —el primer de la
         llista—, no pas un lloc buit. Amb `if (!seat.studentId)` es pintava
         com a buit tot i estar-hi assegut, es quedava a «Alumnes sense lloc»
         i, si l'arrossegaves, acabava assegut a dos llocs alhora i en feia
         desaparèixer un altre del plànol (auditoria 6/9/2026). */
      if (seat.studentId == null || seat.studentId === '') {
        return `<div class="seient buit" data-seat="${seat.id}"
          ondragover="_seientsDragOver(event,'${seat.id}')" ondragleave="_seientsDragLeave(event)"
          ondrop="_seientsDrop(event,'${seat.id}')"
          onclick="_seientsToca(event,'buit',null,'${_idJs(seat.id)}')">buit</div>`;
      }
      const nom = nameById(seat.studentId);
      const primer = nom.split(' ')[0];
      // Només mira els veïns immediats (anterior i següent de la fila)
      const veins = [];
      if (idx > 0 && g.seats[idx-1].studentId != null) veins.push(g.seats[idx-1].studentId);
      if (idx < g.seats.length-1 && g.seats[idx+1].studentId != null) veins.push(g.seats[idx+1].studentId);
      const repeteix = veins.some(v => (history[_pairKey(seat.studentId, v)] || 0) > 0);
      const _triat = _seientsTriat && _seientsTriat.from === 'seat' && _seientsTriat.seatId === seat.id;
      return `<div class="seient ocupat${_triat ? ' seient-triat' : ''}" data-seat="${seat.id}" draggable="true"
        ondragstart="_seientsDragStart(event,'seat','${seat.studentId}','${seat.id}')"
        ondragend="_seientsDragEnd(event)"
        ondragover="_seientsDragOver(event,'${seat.id}')" ondragleave="_seientsDragLeave(event)"
        ondrop="_seientsDrop(event,'${seat.id}')"
        onclick="_seientsToca(event,'seat','${_idJs(seat.studentId)}','${_idJs(seat.id)}')"
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
      <div class="seients-group-del" onmousedown="event.stopPropagation()" onclick="seientsDeleteGroup('${_idJs(g.id)}')" title="Treure fila">×</div>
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
      <span class="seients-marker-del" onmousedown="event.stopPropagation()" onclick="seientsRemoveMarker('${_idJs(m.tipus)}')" title="Treure">×</span>
    </div>`;
  });
  // Preserva l'element buit
  canvas.innerHTML = (emptyEl ? emptyEl.outerHTML : '') + html + markersHtml;
  // Re-oculta el buit si cal
  const newEmpty = document.getElementById('seientsEmpty');
  if (newEmpty) newEmpty.style.display = _seientsLayout.length ? 'none' : 'flex';

  // Pool
  const asseguts = new Set();
  /* Igual que a dalt: l alumne 0 tambe seu. Amb el falsy es quedava sempre
     a la llista d Alumnes sense lloc encara que tingues cadira. */
  _seientsLayout.forEach(g => g.seats.forEach(s => { if (s.studentId != null && s.studentId !== '') asseguts.add(String(s.studentId)); }));
  const pool = students.filter(s => !asseguts.has(String(s.id)));
  const poolEl = document.getElementById('seientsPool');
  if (poolEl) {
    poolEl.innerHTML = pool.length ? pool.map(s =>
      `<div class="seients-pool-item${_seientsTriat && _seientsTriat.from === 'pool' && String(_seientsTriat.studentId) === String(s.id) ? ' seients-pool-triat' : ''}" draggable="true"
        ondragstart="_seientsDragStart(event,'pool','${s.id}',null)" ondragend="_seientsDragEnd(event)"
        onclick="_seientsToca(event,'pool','${_idJs(s.id)}',null)">
        <span class="seients-pool-avatar">${_initials(s.id)}</span>${escapeHtml(typeof nomAlumne==='function'?nomAlumne(s):s.nom)}
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
    localStorage.setItem(_seientsLS('seients_layout'), JSON.stringify(_seientsLayout));
    _seientsSyncToSheets();
  }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
  ev.preventDefault();
}

/* ---- Drag & drop d'alumnes ---- */
/* ⚠ EL PLÀNOL DE L'AULA NO ES PODIA FER SERVIR AMB EL DIT.

   Trobat a l'auditoria del 6/9/2026. Moure un alumne de lloc només es podia
   fer arrossegant, i l'arrossegar del navegador (HTML5 drag-and-drop) NO
   existeix a les pantalles tàctils. Una mestra amb tauleta —que és
   precisament qui es passeja per l'aula amb el plànol a la mà— podia mirar
   el plànol i prou: tocava un nen, no passava res, i no hi havia cap altra
   manera de moure'l.

   Ara també va tocant: toques el nen (o el seu lloc), es marca, i toques on
   el vols. Torna a tocar-lo per deixar-ho estar. Amb el ratolí funciona
   igual, i l'arrossegar de sempre no s'ha tocat. */
let _seientsTriat = null;

function _seientsAvisTria() {
  const el = document.getElementById('seientsTriaHint');
  if (!el) return;
  if (!_seientsTriat) { el.textContent = ''; el.style.display = 'none'; return; }
  const _s = students.find(x => String(x.id) === String(_seientsTriat.studentId));
  const nom = _s ? (typeof nomAlumne === 'function' ? nomAlumne(_s) : _s.nom) : 'aquest alumne';
  el.textContent = 'Has triat ' + nom + '. Ara toca el lloc on el vols (o torna a tocar-lo per deixar-ho estar).';
  el.style.display = '';
}

/* ⚠ ELS CODIS ARA VIATGEN ENTRE COMETES, I PER TANT ARRIBEN COM A TEXT.

   Segona auditoria (8/9/2026): aquests tres `onclick` eren els únics de l'app
   que enganxaven el codi cru dins de l'atribut —la resta (77 llocs) ja hi
   passa per `_idJs()`. És el patró que va deixar els Assoliments morts.

   Ara van entre cometes, i aquí es torna a fer número el que ho era: la
   posició de l'alumne dins de `students` és un número i es desa així al
   plànol; guardar-hi text el trencaria en comparar-lo. */
function _seientsNum_(v) {
  if (v === null || v === undefined || v === '') return v;
  return /^-?\d+$/.test(String(v)) ? parseInt(v, 10) : v;
}

function _seientsToca(ev, from, studentId, seatId) {
  ev.stopPropagation();
  studentId = _seientsNum_(studentId);
  /* Si s'estava arrossegant amb el ratolí, el click de després no ha de
     desfer-ho: el drag ja ha fet la feina. */
  if (_seientsDragData) return;

  // Res triat encara: es tria (només si hi ha algú)
  if (!_seientsTriat) {
    if (studentId == null || studentId === '') return;   // un lloc buit no es tria
    _seientsTriat = { from, studentId, seatId };
    renderSeients();
    _seientsAvisTria();
    return;
  }

  // Tornar a tocar el mateix: es deixa estar
  if (_seientsTriat.from === from &&
      String(_seientsTriat.studentId) === String(studentId) &&
      String(_seientsTriat.seatId) === String(seatId)) {
    _seientsTriat = null;
    renderSeients();
    _seientsAvisTria();
    return;
  }

  // Hi ha algú triat i s'ha tocat un lloc: es mou (o s'intercanvia)
  if (!seatId) { _seientsTriat = null; renderSeients(); _seientsAvisTria(); return; }
  const desti = _findSeat(seatId);
  if (!desti) { _seientsTriat = null; _seientsAvisTria(); return; }

  if (_seientsTriat.from === 'pool') {
    desti.studentId = _seientsTriat.studentId;
  } else {
    const origen = _findSeat(_seientsTriat.seatId);
    if (origen) {
      const tmp = desti.studentId;
      desti.studentId = _seientsTriat.studentId;
      origen.studentId = tmp;
    }
  }
  _seientsTriat = null;
  localStorage.setItem(_seientsLS('seients_layout'), JSON.stringify(_seientsLayout));
  _seientsSyncToSheets();
  renderSeients();
  _seientsAvisTria();
}

function _seientsDragStart(ev, from, studentId, seatId) {
  _seientsTriat = null;   // arrossegant es mana: es deixa el que s'hagi triat
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
  localStorage.setItem(_seientsLS('seients_layout'), JSON.stringify(_seientsLayout));
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
