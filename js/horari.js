/* ============================================================
   HORARI — plantilla setmanal que omple el planning
   Estructura: _horari = { "dl_f1": "Matemàtiques", "dl_f2": "Català", ... }
   Clau = diaId_franjaId (els mateixos que el planning).
   Es desa al Google Sheets (clau 'horari' a _AppData) i en cache local.
   En aplicar-lo, escriu l'assignatura a cada cel·la del planning de
   totes les setmanes del curs, SENSE esborrar el que ja hi hagi escrit.
   ============================================================ */

let _horari = {};
let _horariEditKey = null;

// Franja de pati/esbarjo (editable per anotar la zona de vigilància) — f3 (10:40–11:10)
const HORARI_FRANJA_PATI = 'f3';

// Zones de vigilància del pati (suggeriments ràpids)
const PATI_ZONES = [
  'Pista 1', 'Pista 2', 'Pista 3', 'Sorrera', 'Placeta',
  'Pati central 1', 'Pati central 2', 'Pedretes 1', 'Pedretes 2'
];

// Rols/icones extra que un mestre pot tenir durant el pati (a més de la zona).
// Es guarden a part de la zona; una casella pot tenir-ne diverses.
const PATI_ROLS = [
  { id: 'bagul',    emoji: '🧰', nom: 'Bagul de material' },
  { id: 'campana',  emoji: '🔔', nom: 'Campana (música)' },
  { id: 'agents',   emoji: '💬', nom: 'Agents del joc' },
  { id: 'referent', emoji: '🧍', nom: 'Referent d\'en Víctor' },
];

// Inicialitza la pàgina
function initHorari() {
  // Cache local immediat
  try {
    const cached = JSON.parse(localStorage.getItem('horari') || 'null');
    if (cached && typeof cached === 'object') _horari = cached;
  } catch(e) {}
  renderHorari();
  _horariLoadFromSheets();
}

async function _horariLoadFromSheets() {
  if (!config.scriptUrl) return;
  if (typeof _recentFullLoad === 'function' && _recentFullLoad()) return; // el bootstrap ja l'ha portat
  try {
    const r = await appsScriptGet({ action: 'loadHorari' });
    if (r.ok && r.horari && typeof r.horari === 'object') {
      _horari = r.horari;
      try { localStorage.setItem('horari', JSON.stringify(_horari)); } catch(e) {}
      renderHorari();
    }
  } catch(e) { /* silenciós: ja tenim el cache */ }
}

// Renderitza la graella de l'horari
function renderHorari() {
  const grid = document.getElementById('horariGrid');
  if (!grid) return;
  const dies = (typeof PLAN_DIES !== 'undefined') ? PLAN_DIES : [
    {id:'dl',nom:'Dilluns'},{id:'dm',nom:'Dimarts'},{id:'dc',nom:'Dimecres'},{id:'dj',nom:'Dijous'},{id:'dv',nom:'Divendres'}
  ];
  const franges = (typeof PLAN_FRANGES !== 'undefined') ? PLAN_FRANGES : [];

  let html = '<thead><tr><th class="horari-hora-head"></th>';
  // Les dues primeres lletres NO serveixen: en català tots els dies comencen
  // per "Di" i les cinc columnes sortien igual ("DI DI DI DI DI"). Fem servir
  // l'abreviatura de sempre (DL, DM, DC, DJ, DV), la mateixa que a la portada.
  dies.forEach(d => { html += `<th title="${d.nom}">${d.id.toUpperCase()}</th>`; });
  html += '</tr></thead><tbody>';

  franges.forEach(franja => {
    html += `<tr><td class="horari-hora">${franja.hora}</td>`;
    dies.forEach(dia => {
      const key = dia.id + '_' + franja.id;
      const esPati = franja.id === HORARI_FRANJA_PATI;
      if (esPati) {
        // El pati és editable. El valor pot ser un text (zona) o un objecte
        // { zona, rols:[] }. Mostra la zona i les icones dels rols.
        const val = _horari[key];
        const zona = _patiZona(val);
        const rols = _patiRols(val);
        const icones = rols.map(rid => {
          const r = PATI_ROLS.find(x => x.id === rid);
          return r ? r.emoji : '';
        }).join(' ');
        const txt = zona || 'Pati';
        const inner = escapeHtml(txt) + (icones ? `<div class="horari-pati-icones">${icones}</div>` : '');
        html += `<td><div class="horari-cell pati" onclick="obreHorariCell('${_idJs(key)}')">${inner}</div></td>`;
      } else {
        const assig = _horari[key] || '';
        const cls = assig ? 'horari-cell' : 'horari-cell buida';
        html += `<td><div class="${cls}" onclick="obreHorariCell('${_idJs(key)}')">${assig ? escapeHtml(assig) : '+'}</div></td>`;
      }
    });
    html += '</tr>';
  });
  html += '</tbody>';
  grid.innerHTML = html;
}

// Llista de matèries que fa l'usuari (del perfil), per a suggeriments
function _horariAssigsDisponibles() {
  const set = new Set();
  // Del perfil
  if (typeof _perfil !== 'undefined' && _perfil && _perfil.classes) {
    Object.values(_perfil.classes).forEach(arr => (arr||[]).forEach(nom => set.add(nom)));
  }
  // De les que ja hi ha a l'horari (només franges normals, no el pati)
  Object.keys(_horari).forEach(k => {
    if (k.split('_')[1] === HORARI_FRANJA_PATI) return;
    const v = _horari[k];
    if (v && typeof v === 'string') set.add(v);
  });
  return [...set].sort();
}

// Obre el modal per editar una casella
function obreHorariCell(key) {
  _horariEditKey = key;
  const parts = key.split('_');
  const dia = PLAN_DIES.find(d => d.id === parts[0]);
  const franja = PLAN_FRANGES.find(f => f.id === parts[1]);
  const esPati = parts[1] === HORARI_FRANJA_PATI;

  document.getElementById('horariCellTitle').textContent =
    (dia ? dia.nom : '') + ' · ' + (franja ? franja.hora : '') + (esPati ? ' · Pati' : '');

  const inputEl = document.getElementById('horariCellAssig');
  const labelEl = document.querySelector('#horariCellOverlay .modal-label');
  const rolsBlock = document.getElementById('horariRolsBlock');
  let suggeriments;

  if (esPati) {
    const val = _horari[key];
    inputEl.value = _patiZona(val);
    _horariRolsSel = _patiRols(val).slice(); // còpia de treball
    if (labelEl) labelEl.textContent = 'Zona de vigilància';
    inputEl.placeholder = 'Ex: Pista 1, Sorrera, Placeta…';
    // Suggeriments: les 8 zones fixes + les ja usades
    suggeriments = [...new Set([...PATI_ZONES, ..._horariZonesPati()])];
    // Mostra el bloc de rols amb l'estat actual
    rolsBlock.style.display = 'block';
    _renderHorariRols();
  } else {
    inputEl.value = _horari[key] || '';
    if (labelEl) labelEl.textContent = 'Matèria';
    inputEl.placeholder = 'Ex: Matemàtiques';
    suggeriments = _horariAssigsDisponibles();
    rolsBlock.style.display = 'none';
    _horariRolsSel = [];
  }

  document.getElementById('horariAssigList').innerHTML =
    suggeriments.map(a => `<option value="${escapeHtml(a)}">`).join('');
  document.getElementById('horariQuickChips').innerHTML =
    suggeriments.map(a => `<span class="horari-quick-chip" onclick="_triaHorariChip('${escapeHtml(a).replace(/'/g,"\\'")}')">${escapeHtml(a)}</span>`).join('');

  document.getElementById('horariCellOverlay').classList.add('open');
  setTimeout(() => inputEl.focus(), 60);
}

// Selecció de rols en curs (mentre el modal és obert)
let _horariRolsSel = [];

// Renderitza els botons de rols del pati (marcats/desmarcats)
function _renderHorariRols() {
  const cont = document.getElementById('horariRolsChips');
  if (!cont) return;
  cont.innerHTML = PATI_ROLS.map(r => {
    const actiu = _horariRolsSel.includes(r.id);
    return `<button type="button" class="horari-rol-chip${actiu ? ' actiu' : ''}" onclick="_toggleHorariRol('${_idJs(r.id)}')">
      <span class="horari-rol-emoji">${r.emoji}</span> ${escapeHtml(r.nom)}
    </button>`;
  }).join('');
}

function _toggleHorariRol(rid) {
  const i = _horariRolsSel.indexOf(rid);
  if (i >= 0) _horariRolsSel.splice(i, 1);
  else _horariRolsSel.push(rid);
  _renderHorariRols();
}

// Zones de pati ja fetes servir (per suggerir-les)
function _horariZonesPati() {
  const set = new Set();
  Object.keys(_horari).forEach(k => {
    if (k.split('_')[1] === HORARI_FRANJA_PATI) {
      const z = _patiZona(_horari[k]);
      if (z) set.add(z);
    }
  });
  return [...set].sort();
}

// Extreu la zona d'un valor de pati (text simple o objecte {zona,rols})
function _patiZona(val) {
  if (!val) return '';
  if (typeof val === 'string') return val;
  return val.zona || '';
}
// Extreu els rols (array d'ids) d'un valor de pati
function _patiRols(val) {
  if (!val || typeof val === 'string') return [];
  return Array.isArray(val.rols) ? val.rols : [];
}

function _triaHorariChip(nom) {
  document.getElementById('horariCellAssig').value = nom;
}

function closeHorariCell() {
  document.getElementById('horariCellOverlay').classList.remove('open');
  _horariEditKey = null;
}

function desarHorariCell() {
  if (!_horariEditKey) return;
  const parts = _horariEditKey.split('_');
  const esPati = parts[1] === HORARI_FRANJA_PATI;
  const val = document.getElementById('horariCellAssig').value.trim();

  if (esPati) {
    // Pati: guarda zona + rols. Si no hi ha ni zona ni cap rol, esborra.
    if (!val && _horariRolsSel.length === 0) {
      delete _horari[_horariEditKey];
    } else if (_horariRolsSel.length === 0) {
      // Només zona: guarda text simple (més net)
      _horari[_horariEditKey] = val;
    } else {
      _horari[_horariEditKey] = { zona: val, rols: _horariRolsSel.slice() };
    }
  } else {
    if (val) _horari[_horariEditKey] = val;
    else delete _horari[_horariEditKey];
  }

  closeHorariCell();
  renderHorari();
  _horariPersist();
}

function buidarHorariCell() {
  if (!_horariEditKey) return;
  delete _horari[_horariEditKey];
  closeHorariCell();
  renderHorari();
  _horariPersist();
}

// Desa l'horari (cache + núvol)
function _horariPersist() {
  try { localStorage.setItem('horari', JSON.stringify(_horari)); } catch(e) {}
  if (config.scriptUrl) {
    _desaAlFull({ action: 'saveHorari', horari: _horari });
  }
}

/* ---- Importació ràpida ---- */
function obreImportHorari() {
  document.getElementById('importHorariText').value = '';
  document.getElementById('importHorariPreview').innerHTML = '';
  document.getElementById('importHorariOverlay').classList.add('open');
  setTimeout(() => document.getElementById('importHorariText').focus(), 60);
}
function closeImportHorari() {
  document.getElementById('importHorariOverlay').classList.remove('open');
}

// Analitza el text enganxat i el converteix a l'estructura de l'horari
/* Una fila enganxada que és la del PATI (o l'esbarjo, o l'esmorzar). */
function _horariFilaEsPati(cols) {
  const junts = (cols || []).join(' ').toLowerCase().trim();
  if (!junts) return true;
  return /\bpati\b|esbarjo|esmorzar|descans|lleure/.test(junts);
}

/* ⚠ LA FILA DEL PATI DESPLAÇAVA TOT L'HORARI UNA FRANJA.

   Trobat a l'auditoria del 6/9/2026. L'horari que passa l'escola porta la
   fila del pati enmig, i aquí les files enganxades s'anaven repartint per
   les franges EDITABLES, que són les mateixes menys el pati. O sigui que a
   partir d'aquella fila tot baixava un lloc i l'última es perdia: el «PATI»
   acabava a les 11:10 i el «DINAR» a les 14:50, i deia «35 caselles
   importades ✓».

   Ara es recorren TOTES les franges (pati inclòs). Quan toca la del pati es
   mira si la fila enganxada també ho és: si ho és, es consumeix i no
   s'escriu enlloc; si no, vol dir que l'horari enganxat no en porta i es
   passa de llarg sense gastar cap fila. Les dues maneres queden alineades. */
function _parseImportHorari(text) {
  const dies = PLAN_DIES.map(d => d.id);
  const totes = PLAN_FRANGES.map(f => f.id);      // amb el pati inclòs
  const files = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length)
                    .map(l => l.split(/\t|,|;/).map(c => c.trim()));
  const nou = {};
  let f = 0;
  for (let s = 0; s < totes.length && f < files.length; s++) {
    const franja = totes[s];
    if (franja === HORARI_FRANJA_PATI) {
      if (_horariFilaEsPati(files[f])) f++;       // l'horari en porta: es descarta
      continue;                                    // el pati no s'omple mai
    }
    files[f].forEach((assig, j) => {
      if (j >= dies.length) return;
      /* ⚠ Això admetia qualsevol text i de qualsevol llargada: enganxant una
         taula que no era un horari, les caselles s'omplien amb paràgrafs
         sencers i la graella quedava impracticable (auditoria 6/9/2026). Un
         nom de matèria no passa de 40 caràcters; el que passi es talla, i així
         la mestra veu de seguida que allò no era un horari. */
      if (assig) nou[dies[j] + '_' + franja] = String(assig).slice(0, 40);
    });
    f++;
  }
  return nou;
}

// Actualitza la previsualització mentre s'escriu
function _renderImportPreview() {
  const text = document.getElementById('importHorariText').value;
  const preview = document.getElementById('importHorariPreview');
  if (!text.trim()) { preview.innerHTML = ''; return; }
  const parsed = _parseImportHorari(text);
  const n = Object.keys(parsed).length;
  preview.innerHTML = `<strong>${n}</strong> caselles detectades.`;
}

function aplicarImportHorari() {
  const text = document.getElementById('importHorariText').value;
  if (!text.trim()) { showToast('Enganxa primer l\'horari', 'error'); return; }
  const parsed = _parseImportHorari(text);
  if (!Object.keys(parsed).length) { showToast('No s\'ha pogut llegir cap matèria', 'error'); return; }
  // Fusiona amb l'horari existent (l'import té prioritat)
  _horari = Object.assign({}, _horari, parsed);
  closeImportHorari();
  renderHorari();
  _horariPersist();
  showToast(`${Object.keys(parsed).length} caselles importades ✓`, 'success');
}

/* ---- Aplicar l'horari al planning de tot el curs ---- */
async function aplicarHorariAlPlanning() {
  const claus = Object.keys(_horari);
  if (!claus.length) { showToast('Primer omple l\'horari', 'error'); return; }
  /* Que digui SEMPRE de quin curs parla. Aplicar-lo al curs que no toca omple
     34 setmanes on ningú no mirarà i deixa buides les que sí. */
  const _curs = _horariNomDelCurs();
  if (!confirm('Aplicar l\'horari a totes les setmanes del curs ' + _curs + '?\n\n' +
               'S\'omplirà la matèria a cada franja, del 8 de setembre al 18 de juny. ' +
               'No s\'esborrarà res del que ja hagis escrit (comentaris, alertes…).')) return;
  if (!config.scriptUrl) { showToast('Cal estar connectat', 'error'); return; }

  showToast('Aplicant horari a tot el curs…', 'success');
  const setmanes = _horariSetmanesDelCurs();
  /* ⚠ OMPLIA TAMBE LES SETMANES DE VACANCES.

     Trobat a l auditoria del 6/9/2026: «Aplicar al planning» posava
     l horari a les 41 setmanes del curs, Nadal i Setmana Santa incloses. El
     planning d aquells dies quedava ple d assignatures que ningu no fara, i
     la mestra les havia d anar esborrant una per una.

     El calendari de l escola ja el sap l app: aqui es diu al servidor quins
     dies ha de saltar-se. */
  const fora = _horariDiesDeVacances(setmanes);

  try {
    // Una sola crida: el backend ho aplica a totes les setmanes de cop
    const r = await appsScriptPost({ action: 'aplicarHorariPlanning', horari: _horari, weekIds: setmanes, fora: fora });
    // Crea/registra les matèries de l'horari
    await _horariCreaAssignatures();
    if (r && r.ok) {
      /* «0 saltades» pot voler dir dues coses molt diferents: que no hi ha cap
         festa en aquestes setmanes, o que l'app no sap quan són les festes
         d'aquest curs. Si no ho sap, s'ha de dir (segona auditoria, 8/9/2026):
         si no, la mestra es troba Nadal ple d'assignatures i no entén per què. */
      const _sap = _horariSapLesFestes(_horariAnyDelCurs(new Date()));
      /* ⚠ «0 CASELLES OMPLERTES ✓» ES LLEGIA COM SI HAGUÉS ANAT BÉ.

         Segona auditoria (8/9/2026): un horari on només hi ha el pati donava
         aquest missatge en verd, amb la ✓ i tot. El servidor salta la franja
         del pati a posta —al planning no hi va—, però aquí no es distingia 0
         de N. La mestra creia que ja tenia l'horari aplicat i el planning
         seguia buit. */
      if (!r.tocades) {
        showToast('No he omplert cap casella. Al planning només hi van les matèries: ' +
                  'la franja del pati no s\'hi posa. Escriu les assignatures a l\'horari ' +
                  'i torna-ho a provar.', 'error');
        return;
      }
      showToast('Horari aplicat al curs ' + _curs + ': ' + r.tocades + ' caselles omplertes ✓' +
        (r.saltades ? ' (' + r.saltades + ' saltades: festius i vacances)'
                    : (_sap ? '' : ' — compte: encara no tinc el calendari de festes d\'aquest curs, ' +
                                   'o sigui que també he omplert Nadal i Setmana Santa')), 'success');

      /* ⚠ LES SETMANES QUE JA S'HAVIEN OBERT ES VEIEN BUIDES.

         El planning es queda al navegador setmana per setmana, i en canviar
         de setmana només es demana al full si el navegador no en té res
         (`hasLocal`). Just després d'aplicar l'horari, les setmanes que la
         mestra ja havia visitat en tenien —buides— i per tant no es tornaven
         a demanar mai: 0 assignatures pintades de 34, i ella pensant que
         l'horari no s'havia aplicat (auditoria 6/9/2026).

         Es treu la còpia local de les setmanes que s'acaben d'omplir, i així
         la propera vegada que hi passi es demanen fresques. El que la mestra
         hagi escrit (comentaris, notes del dia) no es toca: això ja és al
         full, que és d'on es tornaran a llegir. */
      try {
        const _sufixos = new Set(setmanes.map(w => 'plan_' + w + '_'));
        const _fora = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (!k || k.indexOf('plan_') !== 0) continue;
          for (const p of _sufixos) { if (k.indexOf(p) === 0) { _fora.push(k); break; } }
        }
        _fora.forEach(k => { try { localStorage.removeItem(k); } catch (e) {} });
      } catch (e) {}

      // Refresca la setmana visible del planning des del núvol
      if (typeof getPlanWeekId === 'function' && typeof loadPlanningWeekFromSheets === 'function') {
        try {
          const wid = getPlanWeekId(typeof _planWeekOffset !== 'undefined' ? _planWeekOffset : 0);
          await loadPlanningWeekFromSheets(wid);
        } catch(e) {}
      }
      if (typeof renderPlanning === 'function') { try { renderPlanning(); } catch(e) {} }
    } else {
      showToast('No s\'ha pogut aplicar: ' + ((r && r.error) || 'error'), 'error');
    }
  } catch(e) {
    showToast('Error aplicant l\'horari: ' + (typeof errorHuma === 'function' ? errorHuma(e) : (e && e.message) || ''), 'error');
  }
}

// Retorna els IDs de setmana de tot el curs (format YYYY_S##)
/* ⚠ EL CURS NO POT ESTAR ESCRIT A MÀ.

   Aquí hi deia «8 setembre 2026 → 18 juny 2027» amb els anys clavats. El
   14/9/2027 l'app deia «410 caselles omplertes ✓» i les escrivia totes al
   curs 2026-27: el planning de la mestra quedava buit i ella es pensava que
   ja el tenia fet (auditoria 6/9/2026).

   Ara el curs es dedueix de la data d'avui: de setembre a agost, el curs és
   el que comença aquell setembre; de gener a agost, el que va començar el
   setembre passat. Els dies (8 de setembre i 18 de juny) es queden com
   estaven, que són els del calendari de l'escola. */
/* L'any en què comença el curs que toca ARA.

   ⚠ Abans el tall era l'1 de setembre. Però l'horari te'l passa la direcció
   a finals d'agost, i és llavors quan la mestra el posa: el 28 d'agost
   `getMonth()` val 7, es prenia per «curs passat» i les 34 setmanes anaven a
   parar al curs que ja s'havia acabat. Ella veia «410 caselles omplertes ✓»
   i el planning buit (auditoria 6/9/2026). Ara el tall és l'1 d'agost: des
   d'agost, el curs que ve és el que compta. */
function _horariAnyDelCurs(avui) {
  const d = avui || new Date();
  return (d.getMonth() >= 7) ? d.getFullYear() : d.getFullYear() - 1;
}
function _horariNomDelCurs(avui) {
  const a = _horariAnyDelCurs(avui);
  return a + '-' + String(a + 1).slice(2);
}

function _horariSetmanesDelCurs() {
  const avui = new Date();
  const anyInici = _horariAnyDelCurs(avui);
  const inici = new Date(anyInici, 8, 8);        // 8 de setembre
  const fi    = new Date(anyInici + 1, 5, 18);   // 18 de juny
  const setmanes = [];
  const d = new Date(inici);
  while (d <= fi) {
    setmanes.push(_weekIdDeData(d));
    d.setDate(d.getDate() + 7);
  }
  return setmanes;
}

/* Els dies de vacances o festius de tot el curs, com a «2026_S52|dl». */
/* Sap l'app quins dies són festa aquest curs?

   ⚠ Segona auditoria (8/9/2026): l'arranjament del 6/9 —no omplir Nadal ni
   Setmana Santa— depèn del calendari escolar que hi ha al navegador, que està
   escrit a mà i només cobreix el curs 2026-27. El curs següent, sense saber
   res, es tornaria a omplir Nadal exactament com abans de l'arranjament… i el
   missatge diria «0 saltades», que és el mateix que diu quan de debò no n'hi
   ha cap. «Cap» i «no ho sé» no es poden dir igual. */
function _horariSapLesFestes(anyInici) {
  if (typeof allEventsForDate !== 'function') return false;
  try {
    const evs = [].concat(cal2LoadEvents(anyInici) || [], cal2LoadEvents(anyInici + 1) || []);
    const NO_LECTIU = (typeof PLAN_NO_LECTIU !== 'undefined') ? PLAN_NO_LECTIU : [];
    return evs.some(e => NO_LECTIU.indexOf(e.catId) !== -1);
  } catch (e) { return false; }
}

function _horariDiesDeVacances(setmanes) {
  const fora = [];
  if (typeof esDiaNoLectiu !== 'function') return fora;
  const DIES = ['dl','dm','dc','dj','dv'];
  const avui = new Date();
  const anyInici = _horariAnyDelCurs(avui);
  const d = new Date(anyInici, 8, 8);
  // Comenca al dilluns de la setmana del 8 de setembre
  d.setDate(d.getDate() - ((d.getDay() || 7) - 1));
  const fi = new Date(anyInici + 1, 5, 25);
  const iso = x => x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
  /* ⚠ PROMETIA «DEL 8 DE SETEMBRE» I OMPLIA TAMBÉ EL DILLUNS 7.

     Segona auditoria (8/9/2026). Es treballa per setmanes senceres, i la
     primera i l'última del curs no ho són: el 8 de setembre de 2026 és
     dimarts, o sigui que el dilluns 7 —quan encara no hi ha classe— també
     s'omplia d'assignatures. El mateix a l'altra punta, després del 18 de
     juny. Ara els dies de fora del curs se salten pel mateix camí que els
     festius, que ja existeix i ja el compta. */
  /* Els dos dies del calendari de l'escola, els mateixos que fa servir
     `_horariSetmanesDelCurs`: 8 de setembre i 18 de juny. (El `fi` del bucle
     va fins al 25 només per no deixar-se l'última setmana a mitges.) */
  const iniciISO = iso(new Date(anyInici, 8, 8));
  const fiISO    = iso(new Date(anyInici + 1, 5, 18));
  while (d <= fi) {
    const wid = _weekIdDeData(d);
    if (setmanes.indexOf(wid) !== -1) {
      for (let i = 0; i < DIES.length; i++) {
        const dia = new Date(d); dia.setDate(d.getDate() + i);
        const ds = iso(dia);
        if (ds < iniciISO || ds > fiISO) { fora.push(wid + '|' + DIES[i]); continue; }
        try { if (esDiaNoLectiu(ds)) fora.push(wid + '|' + DIES[i]); } catch (e) {}
      }
    }
    d.setDate(d.getDate() + 7);
  }
  return fora;
}

// Calcula l'ID de setmana (YYYY_S##) d'una data, igual que getPlanWeekId
function _weekIdDeData(date) {
  const tmp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((tmp - yearStart) / 86400000) + 1) / 7);
  return tmp.getUTCFullYear() + '_S' + String(weekNo).padStart(2, '0');
}

// Crea a l'app les assignatures que apareixen a l'horari i encara no existeixen
async function _horariCreaAssignatures() {
  // Només les matèries de les franges normals (exclou el pati, que pot ser objecte)
  const assigs = [...new Set(
    Object.keys(_horari)
      .filter(k => k.split('_')[1] !== HORARI_FRANJA_PATI)
      .map(k => _horari[k])
      .filter(v => v && typeof v === 'string')
  )];
  if (!assigs.length) return;
  // Desa la llista de matèries de l'horari perquè l'app les reconegui.
  // (Es guarden com a matèries personalitzades a _AppData.)
  if (config.scriptUrl) {
    try { await appsScriptPost({ action: 'saveHorariAssigs', assigs }); } catch(e) {}
  }
}

/* ============================================================
   OMPLIR L'HORARI AMB EL PDF DE L'ESCOLA
   ------------------------------------------------------------
   El lector és a js/pdfhorari.js i treballa aquí mateix, al navegador:
   el PDF no puja enlloc. Aquí només hi ha el que veu la mestra —triar
   la seva pàgina, veure com queda i decidir— perquè omplir l'horari
   d'algú altre per equivocació seria pitjor que escriure'l a mà.
   ============================================================ */

let _pdfHorariPagines = [];
let _pdfHorariTriada  = -1;

function obrePdfHorari() {
  _pdfHorariPagines = []; _pdfHorariTriada = -1;
  const f = document.getElementById('pdfHorariFitxer'); if (f) f.value = '';
  document.getElementById('pdfHorariQui').style.display = 'none';
  document.getElementById('pdfHorariQui').innerHTML = '';
  document.getElementById('pdfHorariPrevi').innerHTML = '';
  document.getElementById('pdfHorariBtn').disabled = true;
  document.getElementById('pdfHorariOverlay').classList.add('open');
}
function tancaPdfHorari() {
  document.getElementById('pdfHorariOverlay').classList.remove('open');
}

/* Del nom del perfil al del PDF: "Pol del Pozo" ha de trobar
   "POL DEL POZO MURGOU" encara que hi falti el segon cognom. */
function _pdfHorariSembla(nomPdf, nomMeu) {
  const net = s => String(s || '').toLowerCase()
    .normalize('NFD').replace(new RegExp('[\u0300-\u036f]', 'g'), '')
    .replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
  const a = net(nomPdf).split(' ').filter(x => x.length > 2);
  const b = net(nomMeu).split(' ').filter(x => x.length > 2);
  if (!a.length || !b.length) return 0;
  let encerts = 0;
  b.forEach(p => { if (a.indexOf(p) !== -1) encerts++; });
  return encerts / b.length;
}

async function _pdfHorariObre(fitxer) {
  if (!fitxer) return;
  const previ = document.getElementById('pdfHorariPrevi');
  previ.innerHTML = '<p class="modal-hint">Llegint el PDF…</p>';
  document.getElementById('pdfHorariBtn').disabled = true;
  try {
    const dades = await fitxer.arrayBuffer();
    const r = await esperaVisual(pdfHorariLlegeix(dades), 'Llegint l\'horari…');
    _pdfHorariPagines = r.pagines;
  } catch (e) {
    previ.innerHTML = '<p class="modal-hint" style="color:var(--crimson)">' +
      escapeHtml(e.message || 'No he pogut llegir el PDF') + '</p>';
    return;
  }

  /* Quina pàgina és la seva. Si el fitxer en porta una, aquella; si en
     porta moltes, la que s'assembli al nom del perfil. Mai se'n tria una
     "a l'atzar": val més preguntar-ho que omplir-li l'horari d'una altra. */
  const meu = (typeof _perfil !== 'undefined' && _perfil && _perfil.nom) ? _perfil.nom : '';
  let millor = -1, punts = 0;
  _pdfHorariPagines.forEach((p, i) => {
    const s = _pdfHorariSembla(p.nom, meu);
    if (s > punts) { punts = s; millor = i; }
  });
  _pdfHorariTriada = (_pdfHorariPagines.length === 1) ? 0 : (punts >= 0.5 ? millor : -1);
  _pdfHorariRenderQui();
  _pdfHorariRenderPrevi();
}

function _pdfHorariRenderQui() {
  const cont = document.getElementById('pdfHorariQui');
  if (_pdfHorariPagines.length < 2) { cont.style.display = 'none'; return; }
  cont.style.display = 'block';
  cont.innerHTML =
    '<label class="modal-label" for="pdfHorariSel">Quin horari és el teu?</label>' +
    '<select class="modal-input" id="pdfHorariSel" onchange="_pdfHorariTria(this.value)">' +
      (_pdfHorariTriada === -1 ? '<option value="-1">Tria\'l…</option>' : '') +
      _pdfHorariPagines.map((p, i) =>
        '<option value="' + i + '"' + (i === _pdfHorariTriada ? ' selected' : '') + '>' +
        escapeHtml(p.nom || '(sense nom)') + (p.tutoria ? ' · ' + escapeHtml(p.tutoria) : '') +
        '</option>').join('') +
    '</select>' +
    '<div class="modal-hint">' + _pdfHorariPagines.length + ' horaris al PDF' +
    (_pdfHorariTriada >= 0 ? '. He triat el teu pel nom; canvia\'l si no toca.' : '') + '</div>';
}

function _pdfHorariTria(i) {
  _pdfHorariTriada = parseInt(i, 10);
  _pdfHorariRenderPrevi();
}

function _pdfHorariRenderPrevi() {
  const previ = document.getElementById('pdfHorariPrevi');
  const btn = document.getElementById('pdfHorariBtn');
  if (_pdfHorariTriada < 0 || !_pdfHorariPagines[_pdfHorariTriada]) {
    previ.innerHTML = '<p class="modal-hint">Tria de qui és l\'horari per veure com quedarà.</p>';
    btn.disabled = true;
    return;
  }
  const g = _pdfHorariPagines[_pdfHorariTriada];
  const dies = PLAN_DIES;
  const n = Object.keys(g.cel).length;
  /* Es veu SENCER abans de tocar res: és l'única manera que la mestra
     s'adoni que ha triat la pàgina d'una altra. */
  let html = '<div class="pdfh-taula-wrap"><table class="pdfh-taula"><thead><tr><th></th>' +
    dies.map(d => '<th>' + d.nom + '</th>').join('') + '</tr></thead><tbody>';
  PLAN_FRANGES.forEach(f => {
    const pati = (f.id === HORARI_FRANJA_PATI);
    html += '<tr class="' + (pati ? 'pdfh-pati' : '') + '"><th>' + f.hora.split('–')[0].trim() + '</th>' +
      dies.map(d => {
        const v = g.cel[d.id + '_' + f.id] || '';
        const ara = _horari[d.id + '_' + f.id] || '';
        const canvia = v && ara && v !== ara;
        return '<td class="' + (v ? 'te' : '') + (canvia ? ' canvia' : '') + '">' +
               (v ? escapeHtml(v) : '') + '</td>';
      }).join('') + '</tr>';
  });
  html += '</tbody></table></div>';

  const trepitja = Object.keys(g.cel).filter(k => _horari[k] && _horari[k] !== g.cel[k]).length;
  html += '<p class="modal-hint" style="margin-top:10px"><strong>' + n + '</strong> caselles' +
    (trepitja ? '. <strong>' + trepitja + '</strong> canvien el que ja tens (en groc); la resta s\'afegeixen.'
              : '. No es canvia res del que ja tens.') +
    ' El que tinguis en una casella que el PDF deixa buida, es queda.</p>';
  previ.innerHTML = html;
  btn.disabled = false;
}

function _pdfHorariAplica() {
  const g = _pdfHorariPagines[_pdfHorariTriada];
  if (!g) return;
  const n = Object.keys(g.cel).length;
  if (!n) { showToast('Aquest horari no té cap casella', 'error'); return; }
  _horari = Object.assign({}, _horari, g.cel);
  tancaPdfHorari();
  renderHorari();
  _horariPersist();
  showToast(n + ' caselles omplertes ✓', 'success');
}
