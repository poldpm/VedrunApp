/* ============================================================
   PERFIL DEL MESTRE — perfil.js
   Nom, curs de tutoria i assignatures per grup (tota la primària).
   TOT es guarda al Google Sheets (premissa: res només en local).
   ============================================================ */

// Cursos de primària (cada un amb 3 línies: A, B, C)
const PERFIL_CURSOS = ['1r', '2n', '3r', '4t', '5è', '6è'];
const PERFIL_LINIES = ['A', 'B', 'C'];

// Assignatures per curs. Cada curs pot tenir la seva llista.
const PERFIL_ASSIGS_PER_CURS = {
  '1r': ['Matemàtiques','Català','Castellà','Anglès','Medi','Tallers','Ambients','Educació Física','Superequip','Cultura Religiosa','Música'],
  '2n': ['Matemàtiques','Català','Castellà','Anglès','Medi','Tallers','Ambients','Educació Física','L\'art del traç','Cultura Religiosa','Música'],
  '3r': ['Català','Castellà','Anglès','Matemàtiques','Medi','Música','Tallers','Educació Física','Cultura Religiosa','Tutoria','Lectura','Pràcticum'],
  '4t': ['Català','Castellà','Anglès','Matemàtiques','Medi','Música','Tallers','Educació Física','Cultura Religiosa','Tutoria','Lectura','Pràcticum'],
  '5è': ['Català','Castellà','Anglès','Matemàtiques','Medi','Música','Tallers','Educació Física','Cultura Religiosa','Lectura','Emprenedoria','Laboratori'],
  '6è': ['Català','Castellà','Anglès','Matemàtiques','Medi','Música','Tallers','Educació Física','Cultura Religiosa','Lectura','Hort/Francès','Educació en valors'],
};
function _assigsDeCurs(curs) { return PERFIL_ASSIGS_PER_CURS[curs] || []; }

// Estat del perfil
// tutorCurs: '4t', tutorLinia: 'B'  → tutor de 4t B
// classes: { "4t B": ['Matemàtiques', ...], "5è A": ['Música'], ... }
let _perfil = {
  nom: '',
  cognom: '',
  tutorCurs: null,
  tutorLinia: null,
  classes: {},      // NOMÉS la tutoria: { "4t B": [assignatures] }
  altres: {},       // altres cursos on fa classe: { "3r": [assignatures] }
  desdobGrup: {},   // grup triat per assignatura d'altre curs: { "curs|assig": "3r A" }
};

// És una assignatura de grup rotatori? (de moment, només Tallers)
function _esRotatori(assig) { return _normNomSimple(assig) === 'tallers'; }

// Compatibilitat: migra perfils antics (tutor:'A', classes:{A:[...]})
function _perfilMigrar(p) {
  if (!p) return p;
  if (p.tutor && !p.tutorLinia) {
    p.tutorCurs = '2n';
    p.tutorLinia = p.tutor;
    const noves = {};
    Object.keys(p.classes || {}).forEach(k => {
      if (['A','B','C'].includes(k)) noves['2n ' + k] = p.classes[k];
      else noves[k] = p.classes[k];
    });
    p.classes = noves;
    delete p.tutor;
  }
  // Estructures noves
  if (!p.classes || typeof p.classes !== 'object') p.classes = {};
  if (!p.altres || typeof p.altres !== 'object' || Array.isArray(p.altres)) p.altres = {};
  if (!p.desdobGrup || typeof p.desdobGrup !== 'object') p.desdobGrup = {};
  const tutorKey = (p.tutorCurs && p.tutorLinia) ? (p.tutorCurs + ' ' + p.tutorLinia) : null;
  // Mou els grups de classe que NO són la tutoria cap a "altres" (per curs).
  // NOMÉS quan hi ha tutoria: sense tutoria (especialista) "classes" és la
  // llista de grups on fa classe, i migrar-la l'hi esborraria.
  if (tutorKey) {
    Object.keys(p.classes).forEach(k => {
      if (k === tutorKey) return;
      const curs = k.split(' ')[0];
      if (['1r','2n','3r','4t','5è','6è'].indexOf(curs) === -1) return;
      if (!p.altres[curs]) p.altres[curs] = [];
      (p.classes[k] || []).forEach(a => { if (p.altres[curs].indexOf(a) === -1) p.altres[curs].push(a); });
      delete p.classes[k];
    });
  }
  // Migra el desdob antic (array) cap a "altres"
  if (Array.isArray(p.desdob)) {
    p.desdob.forEach(d => {
      if (d && d.curs && d.assig) {
        if (!p.altres[d.curs]) p.altres[d.curs] = [];
        if (p.altres[d.curs].indexOf(d.assig) === -1) p.altres[d.curs].push(d.assig);
      }
    });
    delete p.desdob;
  }
  return p;
}

function _grupKey(curs, linia) { return curs + ' ' + linia; }

function initPerfil() {
  const cached = localStorage.getItem('vedruna_perfil');
  if (cached) { try { _perfil = _perfilMigrar(JSON.parse(cached)); } catch(e) {} }
  _perfilRender();
  _perfilLoadFromSheets();
}

async function _perfilLoadFromSheets() {
  if (!config.scriptUrl) return;
  if (typeof _recentFullLoad === 'function' && _recentFullLoad()) return; // el bootstrap ja l'ha portat
  try {
    const r = await appsScriptGet({ action: 'loadProfile' });
    if (r.ok && r.profile) {
      _perfil = _perfilMigrar(Object.assign({ nom:'', tutorCurs:null, tutorLinia:null, classes:{}, altres:{}, desdobGrup:{} }, r.profile));
      localStorage.setItem('vedruna_perfil', JSON.stringify(_perfil));
      _perfilRender();
      _perfilUpdateNav();
      perfilRenderAllSelectors();
    }
  } catch(e) { /* silenciós */ }
}

function _perfilRender() {
  const nomEl = document.getElementById('perfilNom');
  if (nomEl) nomEl.value = _perfil.nom || '';
  const cognomEl = document.getElementById('perfilCognom');
  if (cognomEl) cognomEl.value = _perfil.cognom || '';
  _perfilUpdateAvatar();
  _perfilAplicaRol();
  if (_perfilSenseTutoria()) {
    _perfilRenderGrupsEspecialista();
  } else {
    _perfilRenderTutorSel();
    _perfilRenderGrups();
  }
  if (typeof _perfilRenderAltres === 'function') _perfilRenderAltres();
}

// True si aquesta còpia de l'app és la dels especialistes (js/rol.js).
function _perfilEsEspecialista() {
  return (typeof esEspecialista === 'function') ? esEspecialista() : false;
}

// True si aquesta còpia és la de direcció (js/rol.js).
function _perfilEsDireccio() {
  return (typeof esDireccio === 'function') ? esDireccio() : false;
}

/* True quan en aquesta còpia el mestre NO tutoritza cap grup: les
   especialistes i direcció. Totes dues trien els GRUPS on fan classe en
   comptes de dir de quin grup són tutores.

   ⚠ Es comprova aquí i no cridant `senseTutoria()` directament perquè
   `js/rol.js` no se sincronitza mai: a les apps que ja estan repartides,
   aquell fitxer és el vell i la funció no hi és. */
function _perfilSenseTutoria() {
  if (typeof senseTutoria === 'function') return senseTutoria();
  return _perfilEsEspecialista() || _perfilEsDireccio();
}

// Ensenya o amaga les targetes del perfil segons el rol de l'app.
function _perfilAplicaRol() {
  const esp = _perfilSenseTutoria();
  const mostra = (id, visible) => { const el = document.getElementById(id); if (el) el.style.display = visible ? '' : 'none'; };
  mostra('perfilCardGrups', esp);
  mostra('perfilCardTutoria', !esp);
  mostra('perfilCardTutoriaAssigs', !esp);
  if (esp) {
    const t = document.getElementById('perfilCardAltresTitol');
    const h = document.getElementById('perfilCardAltresHint');
    if (t) t.textContent = 'Assignatures amb grup rotatori';
    if (h) h.textContent = 'Només per a les assignatures on els grups roten i no són una classe sencera (com el Tallers). Afegeix-hi el curs, marca l\'assignatura i tria el grup que tens ara. La resta de classes van a dalt, a «A quins grups fas classe?».';
  }
}

/* ============================================================
   PERFIL DE L'ESPECIALISTA — grups on fa classe
   Sense tutoria, "classes" és { "3r A": [assignatures], "3r B": [...] }.
   Cada grup és una classe sencera de l'escola, i per cada un s'hi
   marquen les assignatures que hi fa.
   ============================================================ */
function _perfilTotsElsGrups() {
  const out = [];
  PERFIL_CURSOS.forEach(c => PERFIL_LINIES.forEach(l => out.push(c + ' ' + l)));
  return out;
}

function _perfilRenderGrupsEspecialista() {
  const cont = document.getElementById('perfilGrupsEspecialista');
  if (!cont) return;
  if (!_perfil.classes || typeof _perfil.classes !== 'object') _perfil.classes = {};
  const afegits = Object.keys(_perfil.classes).sort();
  let html = '';
  afegits.forEach(grup => {
    const curs = grup.split(' ')[0];
    const sel = _perfil.classes[grup] || [];
    const chips = _assigsDeCurs(curs).map(a =>
      `<button type="button" class="perfil-assig-chip ${sel.includes(a)?'active':''}" onclick="_perfilToggleAssigGrup('${grup}','${a.replace(/'/g,"\\'")}')">${escapeHtml(a)}</button>`
    ).join('');
    html += `<div class="perfil-grup-block">
      <div class="perfil-grup-block-head">
        <span class="perfil-grup-block-title">${escapeHtml(grup)}</span>
        <button class="perfil-grup-remove" onclick="_perfilTreuGrupEsp('${grup}')" title="Treure aquest grup">×</button>
      </div>
      <div class="perfil-assig-chips">${chips}</div>
    </div>`;
  });
  if (!afegits.length) {
    html += '<p class="modal-hint">Encara no hi ha cap grup. Afegeix-ne un aquí sota.</p>';
  }
  const disponibles = _perfilTotsElsGrups().filter(g => afegits.indexOf(g) === -1);
  html += `<div class="perfil-desdob-add" style="margin-top:10px;display:flex;gap:8px;align-items:center">
    <select class="modal-input" id="perfilGrupAdd" style="max-width:150px" onchange="_perfilAfegeixGrupEsp(this.value)">
      <option value="">+ Afegir grup…</option>
      ${disponibles.map(g=>`<option value="${g}">${g}</option>`).join('')}
    </select>
  </div>`;
  cont.innerHTML = html;
}

function _perfilAfegeixGrupEsp(grup) {
  if (!grup) return;
  if (!_perfil.classes[grup]) _perfil.classes[grup] = [];
  _perfilRenderGrupsEspecialista();
  if (typeof perfilRenderAllSelectors === 'function') perfilRenderAllSelectors();
}

function _perfilTreuGrupEsp(grup) {
  const assigs = (_perfil.classes && _perfil.classes[grup]) || [];
  const detall = assigs.length
    ? ' Perdràs les ' + assigs.length + ' assignatures que hi tens marcades (' + assigs.join(', ') + ').'
    : '';
  if (!confirm('Vols treure ' + grup + ' del teu perfil?' + detall)) return;
  delete _perfil.classes[grup];
  _perfilRenderGrupsEspecialista();
  if (typeof perfilRenderAllSelectors === 'function') perfilRenderAllSelectors();
}

function _perfilToggleAssigGrup(grup, assig) {
  if (!_perfil.classes[grup]) _perfil.classes[grup] = [];
  const arr = _perfil.classes[grup];
  const i = arr.indexOf(assig);
  if (i === -1) arr.push(assig); else arr.splice(i, 1);
  _perfilRenderGrupsEspecialista();
  if (typeof perfilRenderAllSelectors === 'function') perfilRenderAllSelectors();
}



// Selector de tutoria: curs + línia
function _perfilRenderTutorSel() {
  const cont = document.getElementById('perfilTutorSel');
  if (!cont) return;
  const cursos = PERFIL_CURSOS.map(c =>
    `<button class="perfil-grup-btn ${_perfil.tutorCurs===c?'active':''}" onclick="_perfilSetTutorCurs('${c}')">${c}</button>`
  ).join('');
  let liniesHtml = '';
  if (_perfil.tutorCurs) {
    liniesHtml = `<div class="perfil-tutor-linies">
      <span class="perfil-tutor-lin-label">Línia:</span>
      ${PERFIL_LINIES.map(l =>
        `<button class="perfil-linia-btn ${_perfil.tutorLinia===l?'active':''}" onclick="_perfilSetTutorLinia('${l}')">${_perfil.tutorCurs} ${l}</button>`
      ).join('')}
    </div>`;
  }
  cont.innerHTML = `<div class="perfil-tutor-cursos">${cursos}</div>${liniesHtml}`;
}

function _perfilSetTutorCurs(curs) {
  _perfil.tutorCurs = curs;
  _perfil.tutorLinia = null; // reinicia la línia en canviar de curs
  _perfilRenderTutorSel();
  _perfilRenderGrups();
}
function _perfilSetTutorLinia(linia) {
  _perfil.tutorLinia = linia;
  _perfilRenderTutorSel();
  _perfilRenderGrups();
}

// Assignatures de la teva tutoria (només el grup que tutoritzes)
function _perfilRenderGrups() {
  const cont = document.getElementById('perfilGrupsAssigs');
  if (!cont) return;
  if (!_perfil.tutorCurs || !_perfil.tutorLinia) {
    cont.innerHTML = '<p class="modal-hint">Primer tria de quin curs i línia ets tutor/a.</p>';
    return;
  }
  const tutorKey = _grupKey(_perfil.tutorCurs, _perfil.tutorLinia);
  const sel = _perfil.classes[tutorKey] || [];
  const chips = _assigsDeCurs(_perfil.tutorCurs).map(a =>
    `<button type="button" class="perfil-assig-chip ${sel.includes(a)?'active':''}" onclick="_perfilToggleAssig('${tutorKey}','${a.replace(/'/g,"\\'")}')">${escapeHtml(a)}</button>`
  ).join('');
  cont.innerHTML = `<div class="perfil-assig-chips">${chips}</div>`;
}

function _perfilAddGrup(key) {
  if (!key) return;
  if (!_perfil.classes[key]) _perfil.classes[key] = [];
  _perfilRenderGrups();
}
function _perfilRemoveGrup(key) {
  // Treu el curs I totes les assignatures que hi tingués marcades. No es pot
  // desfer, i la × és petita i fàcil de clicar sense voler.
  const assigs = (_perfil.classes && _perfil.classes[key]) || [];
  const detall = assigs.length
    ? ' Perdràs les ' + assigs.length + ' assignatures que hi tens marcades (' + assigs.join(', ') + ').'
    : '';
  if (!confirm('Vols treure ' + key + ' del teu perfil?' + detall)) return;
  delete _perfil.classes[key];
  _perfilRenderGrups();
}

function _perfilToggleAssig(key, assig) {
  if (!_perfil.classes[key]) _perfil.classes[key] = [];
  const arr = _perfil.classes[key];
  const idx = arr.indexOf(assig);
  if (idx === -1) arr.push(assig); else arr.splice(idx, 1);
  // No esborrem el grup encara que quedi buit si és un afegit manualment;
  // però si no és el de tutoria i queda buit, el deixem (l'usuari el pot treure amb ×)
  _perfilRenderGrupBlocks();
}

function _perfilUpdateAvatar() {
  const nom = (document.getElementById('perfilNom')?.value || _perfil.nom || '').trim();
  const cognom = (document.getElementById('perfilCognom')?.value || _perfil.cognom || '').trim();
  const complet = (nom + ' ' + cognom).trim() || 'M';
  const inicials = complet ? complet.split(/\s+/).map(w=>w[0]).slice(0,2).join('').toUpperCase() : 'M';
  const big = document.getElementById('perfilAvatarBig');
  if (big) big.textContent = inicials || 'M';
}

function _perfilUpdateNav() {
  const av = document.getElementById('navProfileAvatar');
  const nm = document.getElementById('navProfileName');
  const nom = (_perfil.nom || '').trim();
  const cognom = (_perfil.cognom || '').trim();
  const complet = (nom + ' ' + cognom).trim();
  const inicials = complet ? complet.split(/\s+/).map(w=>w[0]).slice(0,2).join('').toUpperCase() : 'M';
  if (av) av.textContent = inicials || 'M';
  if (nm) nm.textContent = complet || 'El meu perfil';
  if (typeof _perfilUpdateGreeting === 'function') _perfilUpdateGreeting();
}

async function perfilSave() {
  _perfil.nom = (document.getElementById('perfilNom')?.value || '').trim();
  _perfil.cognom = (document.getElementById('perfilCognom')?.value || '').trim();

  /* Nom I cognom, tots dos. En Pol, 5/9/2026: hi ha mestres que es diuen
     igual de nom, i el nom del perfil és el que ell veu quan algú demana una
     actualització o quan es comparteix una nota amb el tutor. Amb només el
     nom de pila no sap de qui és, i no ho pot saber de cap altra manera.
     Es demana en desar i no en escriure: corregir algú a mitja paraula
     mentre teclegen és nosa, no ajuda. */
  if (!_perfil.nom || !_perfil.cognom) {
    const quin = !_perfil.nom ? 'perfilNom' : 'perfilCognom';
    showToast(!_perfil.nom ? 'Posa-hi el teu nom' : 'Posa-hi el teu cognom: hi ha mestres que es diuen igual', 'error');
    const camp = document.getElementById(quin);
    if (camp) { camp.classList.add('camp-cal'); camp.focus(); }
    return;
  }
  ['perfilNom', 'perfilCognom'].forEach(id => {
    const c = document.getElementById(id);
    if (c) c.classList.remove('camp-cal');
  });

  if (_perfilSenseTutoria()) {
    const ambAssig = Object.keys(_perfil.classes || {}).filter(g => (_perfil.classes[g] || []).length);
    const ambAltres = Object.keys(_perfil.altres || {}).filter(c => (_perfil.altres[c] || []).length);
    if (!ambAssig.length && !ambAltres.length) {
      showToast('Afegeix almenys un grup i marca-hi una assignatura', 'error'); return;
    }
  } else if (!_perfil.tutorCurs || !_perfil.tutorLinia) {
    showToast('Tria de quin curs i línia ets tutor/a', 'error'); return;
  }
  localStorage.setItem('vedruna_perfil', JSON.stringify(_perfil));
  _perfilUpdateNav();
  perfilRenderAllSelectors();
  if (config.scriptUrl) {
    try {
      await appsScriptPost({ action: 'saveProfile', profile: JSON.stringify(_perfil) });
      showToast('Perfil desat ✓', 'success');
    } catch(e) {
      showToast('Desat localment; error desant al servidor: ' + e.message, 'error');
    }
  } else {
    showToast('Perfil desat localment (configura la connexió per sincronitzar)', 'info');
  }
}

/* ============================================================
   CÀRREGA DELS ALUMNES DEL GRUP DE TUTORIA (full centralitzat)
   ============================================================ */
// Guarda les dades completes dels alumnes del grup de tutoria
let _tutoriaAlumnes = [];   // amb dataNaix, mare, pare, etc.
let _tutoriaGrup    = null; // "4t B"

function _perfilTutorGrupKey() {
  if (_perfil && _perfil.tutorCurs && _perfil.tutorLinia) return _perfil.tutorCurs + ' ' + _perfil.tutorLinia;
  return null;
}

/* EL GRUP AMB QUÈ ES TREBALLA ARA.

   Per a un tutor és sempre el seu, i no canvia mai. A l'app de direcció no
   hi ha tutoria: el grup és el que hagin triat al selector d'Alumnes, i pot
   ser qualsevol dels 18 de primària. Tot el que penja del grup (fitxes,
   observacions, registres, distribució de l'aula) passa per aquí, així no hi
   ha dos llocs que puguin acabar parlant de grups diferents. */
let _direccioGrup = null;
try { _direccioGrup = localStorage.getItem('direccio_grup') || null; } catch(e) {}

function _grupDeTreball() {
  if (typeof esDireccio === 'function' && esDireccio()) return _direccioGrup || null;
  return _perfilTutorGrupKey();
}

async function _loadTutoriaGrup() {
  const grup = _grupDeTreball();
  if (!grup || !config.scriptUrl) return;
  _tutoriaGrup = grup;

  // Cache: aplica immediatament si el tenim
  const cacheKey = 'tutoriacache_' + grup;
  const versioAra = (window.versioApp && window.versioApp.actual) || '';
  try {
    const raw = localStorage.getItem(cacheKey);
    if (raw) {
      const c = JSON.parse(raw);
      /* ⚠ La còpia guardada NO val si és d'una versió anterior de l'app.
         Va passar el 4/9/2026: en Pol veia un alumne que ja no és al full i
         cap dada dels altres. La còpia era de fa hores i tapava el que hi
         havia de debò. Una còpia serveix per anar de pressa, no per decidir
         què és cert: si l'app ha canviat, es llença i es torna a demanar. */
      const mateixaVersio = !versioAra || c.v === versioAra;
      if (c && c.alumnes && c.alumnes.length && mateixaVersio) {
        _aplicaTutoriaAlumnes(c.alumnes);
        // Si és recent (<10 min), no refresquis
        if (Date.now() - (c.ts||0) < 600000) return;
      }
    }
  } catch(e) {}

  try {
    const r = await appsScriptGet({ action: 'getGrupAlumnes', grup: grup });
    if (r.ok && r.alumnes && r.alumnes.length) {
      _aplicaTutoriaAlumnes(r.alumnes);
      try { localStorage.setItem(cacheKey, JSON.stringify({ alumnes: r.alumnes, ts: Date.now(), v: versioAra })); } catch(e) {}
    } else if (r && r.ok === false) {
      _avisAlumnesVells(r.error || 'el servidor no ha pogut donar la llista');
    }
  } catch(e) {
    /* ⚠ Abans això era silenciós, i és el pitjor que podia ser: si el
       servidor fallava, a la pantalla hi quedava la còpia vella i semblava
       la bona. Val més dir-ho. */
    _avisAlumnesVells(e && e.message ? e.message : 'sense connexió amb el servidor');
  }
}

/* Diu que el que es veu pot no ser el que hi ha al full. */
function _avisAlumnesVells(motiu) {
  if (document.getElementById('avisAlumnesVells')) return;
  const d = document.createElement('div');
  d.id = 'avisAlumnesVells';
  d.className = 'ver-franja';
  d.setAttribute('role', 'status');
  d.innerHTML = '<span><strong>Els alumnes que veus poden no estar al dia.</strong> ' +
    'No he pogut demanar la llista al full: ' + (typeof escapeHtml === 'function' ? escapeHtml(motiu) : motiu) +
    '</span><button class="btn btn-secondary btn-sm" id="avisAlumnesX">D\'acord</button>';
  document.body.insertBefore(d, document.body.firstChild);
  const x = document.getElementById('avisAlumnesX');
  if (x) x.addEventListener('click', () => d.remove());
}

/* Llença la còpia guardada de tots els grups i torna a demanar-ho tot.
   És la sortida quan la pantalla i el full no diuen el mateix. */
async function refrescaAlumnes() {
  try {
    Object.keys(localStorage).forEach(k => {
      if (k.indexOf('tutoriacache_') === 0) localStorage.removeItem(k);
    });
  } catch (e) {}
  const av = document.getElementById('avisAlumnesVells');
  if (av) av.remove();
  if (typeof showToast === 'function') showToast('Demanant els alumnes al full…', 'info');
  await _loadTutoriaGrup();
  if (typeof showToast === 'function') showToast('Alumnes al dia ✓', 'success');
}

function _aplicaTutoriaAlumnes(alumnes) {
  // Protecció: mai substitueixis per una llista buida (evita pèrdua de dades
  // si el servidor retorna buit per un error temporal)
  if (!alumnes || !alumnes.length) return;
  _tutoriaAlumnes = alumnes;
  _grupStudentsCarregat = (_grupDeTreball() || '') + '|';
  students = alumnes.map(function(a) { return { id: a.id, nom: a.nom, genere: a.genere }; });
  personal = {};
  alumnes.forEach(function(a) {
    personal[a.id] = {
      mare: a.mare, pare: a.pare, emailMare: a.emailMare, emailPare: a.emailPare,
      obs: a.obs, pi: a.pi, am: a.am, especific: a.especific, eap: a.eap, seient: a.seient,
      // ⚠ Les columnes noves han de passar per aquí. El servidor les enviava i
      // la fitxa les sabia pintar, però aquest pas del mig no les copiava: a
      // la pantalla no hi sortia res i semblava que el full estigués buit.
      trastorns: a.trastorns, acollida: a.acollida, drets: a.drets, emvic: a.emvic,
      dataNaix: a.dataNaix, rowId: a.rowId,
    };
  });
  _saveMainToCache();
  _paintAllViews();
  if (typeof _refreshAniversaris === 'function') _refreshAniversaris();
}

/* ============================================================
   ANIVERSARIS AL PLANNING
   Per cada alumne del grup de tutoria amb data de naixement,
   posa una nota automàtica el dia del seu aniversari.
   ============================================================ */

// Retorna els noms dels alumnes que fan anys en una data (Date o 'YYYY-MM-DD')
function aniversarisDelDia(data) {
  if (!_tutoriaAlumnes || !_tutoriaAlumnes.length) return [];
  let mes, dia;
  if (data instanceof Date) {
    mes = data.getMonth() + 1; dia = data.getDate();
  } else {
    const p = data.toString().split('-'); // YYYY-MM-DD
    if (p.length < 3) return [];
    mes = parseInt(p[1]); dia = parseInt(p[2]);
  }
  const noms = [];
  _tutoriaAlumnes.forEach(a => {
    if (!a.dataNaix) return;
    const pn = a.dataNaix.toString().split('-'); // YYYY-MM-DD
    if (pn.length < 3) return;
    const m = parseInt(pn[1]), d = parseInt(pn[2]);
    if (m === mes && d === dia) noms.push(a.nom);
  });
  return noms;
}

// Recalcula i repinta el planning (perquè apareguin els aniversaris)
function _refreshAniversaris() {
  if (typeof renderPlanning === 'function') {
    const page = document.getElementById('page-planning');
    if (page && !page.classList.contains('page-hidden')) renderPlanning();
  }
}

/* ============================================================
   PONT PERFIL → MENÚ D'ASSIGNATURES
   Genera la llista d'assignatures del menú lateral a partir
   de les assignatures triades al perfil (de tots els grups).
   ============================================================ */

// Converteix un nom d'assignatura del perfil a una clau interna estable
// Clau interna d'una assignatura (nom normalitzat). El grup es gestiona
// per separat (a notesContext.grup i _notesTabName al backend), així que
// aquesta clau NO porta el grup — dues assignatures iguals de grups
// diferents comparteixen clau de matèria però tenen pestanyes separades.
function _assigKey(nom) {
  return _normNomSimple(nom).replace(/[^a-z0-9]/g, '');
}
function _normNomSimple(s) {
  return (s||'').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

// Icona SVG per a cada assignatura (per nom normalitzat)
function _assigIcon(nom) {
  const n = _normNomSimple(nom);
  const ic = {
    matematiques: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 12h8M12 8v8"/>',
    catala:       '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
    castella:     '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
    angles:       '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    medi:         '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20"/><path d="M2 12h20"/>',
    musica:       '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
    tallers:      '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
    ambients:     '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20"/><path d="M2 12h20"/>',
    educaciofisica:'<circle cx="12" cy="5" r="2"/><path d="M12 7v6l-3 8M12 13l3 8M7 10h10"/>',
    superequip:   '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>',
    culturareligiosa:'<path d="M12 2v20M5 9h14"/>',
    tutoria:      '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>',
    lectura:      '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
    practicum:    '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    emprenedoria: '<path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>',
    laboratori:   '<path d="M9 3h6M10 3v6l-4 8a2 2 0 0 0 2 3h8a2 2 0 0 0 2-3l-4-8V3"/>',
    horfrances:   '<path d="M12 2v20M5 9h14"/>',
    educacioenvalors:'<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
  };
  return ic[n] || '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 12h8"/>';
}

// Recull totes les assignatures úniques que fa el mestre (de tots els grups)
function _perfilAssignaturesUniques() {
  const set = new Map(); // nom normalitzat → nom original (per mostrar)
  if (_perfil && _perfil.classes) {
    Object.values(_perfil.classes).forEach(arr => {
      (arr||[]).forEach(a => {
        const k = _normNomSimple(a);
        if (!set.has(k)) set.set(k, a);
      });
    });
  }
  return Array.from(set.values());
}

// Genera el menú lateral d'assignatures a partir del perfil
function perfilRenderNavAssigs() {
  const cont = document.getElementById('navAssignatures');
  if (!cont) return;

  // Construeix la llista d'entrades: tutoria + altres cursos (mateixa font que
  // la resta de selectors, així les assignatures d'altres cursos també hi surten).
  const entrades = (typeof _perfilEntradesAmbGrup === 'function') ? _perfilEntradesAmbGrup() : [];

  if (!entrades.length) {
    cont.innerHTML = '<div class="nav-assig-empty">Configura les teves assignatures al Perfil</div>';
    return;
  }

  // Saber si una assignatura apareix a més d'un grup (per mostrar el grup al costat)
  const compta = {};
  entrades.forEach(e => { const k = _normNomSimple(e.nom); compta[k] = (compta[k]||0) + 1; });

  const tutorKey = (typeof _perfilTutorGrupKey === 'function') ? _perfilTutorGrupKey() : null;

  // Ordena: primer el grup de tutoria, després la resta
  entrades.sort((a, b) => {
    if (a.grup === tutorKey && b.grup !== tutorKey) return -1;
    if (b.grup === tutorKey && a.grup !== tutorKey) return 1;
    return a.grup.localeCompare(b.grup) || a.nom.localeCompare(b.nom);
  });

  cont.innerHTML = entrades.map(e => {
    const key = _navMateriaKey(e);
    const multi = compta[_normNomSimple(e.nom)] > 1;
    // Mostra el grup si l'assignatura es fa a més d'un grup, o si no és el grup de tutoria
    const mostraGrup = multi || e.grup !== tutorKey;
    const sufix = mostraGrup ? ` <span class="nav-assig-grup">${escapeHtml(e.grup)}</span>` : '';
    return `<a class="nav-item" href="#" onclick="openNotesAuto('${key}','${e.grup}'); return false;">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">${_assigIcon(e.nom)}</svg>
      <span class="nav-assig-label">${escapeHtml(e.nom)}${sufix}</span>
    </a>`;
  }).join('');

  // Registra els noms al mapa MATERIES i els desdoblaments amb la MATEIXA clau
  // (qualificada pel curs a "altres cursos", perquè Tallers 3r ≠ Tallers 4t).
  entrades.forEach(e => {
    const key = _navMateriaKey(e);
    if (typeof MATERIES !== 'undefined' && !MATERIES[key]) MATERIES[key] = e.altres ? (e.nom + ' · ' + e.curs) : e.nom;
    if (e.altres) _assigDesdobMap[key] = { curs: e.curs, assig: e.nom, rotatori: e.rotatori };
  });
}

// Clau de "matèria" per al menú de Notes. A la tutoria, clau simple (com sempre).
// A altres cursos, s'hi afegeix el curs perquè la mateixa assignatura a dos cursos
// no comparteixi ni clau ni pestanya de notes (p. ex. tallers_3r vs tallers_4t).
function _navMateriaKey(e) {
  return e.altres
    ? _assigKey(e.nom) + '_' + _normNomSimple(e.curs || '').replace(/[^a-z0-9]/g, '')
    : _assigKey(e.nom);
}

/* ============================================================
   CARREGAR ALUMNES D'UN GRUP PER AVALUAR (notes d'assignatura)
   Si el grup és el de tutoria, ja hi són. Si no, els carrega
   del full "grups" i, si l'assignatura és desdoblada, filtra.
   ============================================================ */
let _grupStudentsCarregat = null; // "4t B|Matemàtiques"

async function _ensureGrupStudents(grup, materia) {
  if (!grup || !config.scriptUrl) return;
  const clau = grup + '|' + (materia||'');
  if (_grupStudentsCarregat === clau) return; // ja carregat en memòria

  // 1) CACHE: si tenim els alumnes d'aquest grup+assignatura en cache, usa'ls ja
  const cacheKey = 'grupcache_' + clau;
  try {
    const raw = localStorage.getItem(cacheKey);
    if (raw) {
      const c = JSON.parse(raw);
      if (c && c.alumnes && c.alumnes.length) {
        _aplicaGrupStudents(c.alumnes);
        _grupStudentsCarregat = clau;
        // Si el cache té menys de 10 min, no cal refrescar
        if (Date.now() - (c.ts||0) < 600000) return;
        // Si és més vell, refresca en segon pla (sense bloquejar)
        _refreshGrupStudents(grup, materia, clau, cacheKey);
        return;
      }
    }
  } catch(e) {}

  // 2) Sense cache: carrega ara (bloquejant només la primera vegada)
  await _refreshGrupStudents(grup, materia, clau, cacheKey);
}

// Aplica una llista d'alumnes a students/personal
function _aplicaGrupStudents(alumnes) {
  students = alumnes.map(a => ({ id: a.id, nom: a.nom, genere: a.genere }));
  personal = {};
  alumnes.forEach(a => {
    personal[a.id] = { mare:a.mare, pare:a.pare, emailMare:a.emailMare, emailPare:a.emailPare,
      obs:a.obs, pi:a.pi, am:a.am, especific:a.especific, eap:a.eap, seient:a.seient, dataNaix:a.dataNaix, rowId:a.rowId,
      grupOrigen:a.grupOrigen || null };
  });
}

// Carrega els alumnes del grup del backend (aplica desdoblament) i desa en cache
async function _refreshGrupStudents(grup, materia, clau, cacheKey) {
  try {
    const r = await appsScriptGet({ action:'getGrupAlumnes', grup: grup });
    let alumnes = (r.ok && r.alumnes) ? r.alumnes : [];

    if (materia && alumnes.length) {
      const parts = grup.split(' ');
      const matNom = _assigNomNet(materia);
      try {
        const d = await appsScriptGet({ action:'getDesdoblament', curs:parts[0], linia:parts[1], assignatura:matNom });
        if (d.ok && d.existeix && d.alumnes && d.alumnes.length && !d.sensDesdob) {
          const queden = new Set(d.alumnes.map(a => a.nom));
          const filtrats = alumnes.filter(a => queden.has(a.nom));
          if (filtrats.length) alumnes = filtrats;
        }
      } catch(e) {}
    }

    if (alumnes.length) {
      alumnes.forEach(a => { if (!a.grupOrigen) a.grupOrigen = grup; });
      _aplicaGrupStudents(alumnes);
      _grupStudentsCarregat = clau;
      try { localStorage.setItem(cacheKey, JSON.stringify({ alumnes, ts: Date.now() })); } catch(e) {}
      // Repinta si estem a la pàgina de notes d'aquest grup
      if (typeof renderNotesTable === 'function' && notesContext && notesContext.grup === grup) {
        try { renderNotesTable(); } catch(e) {}
      }
    }
  } catch(e) { /* silenciós */ }
}

// Restaura els alumnes del grup de tutoria (per a la pàgina Alumnes,
// registres, observacions... que sempre són del grup propi).
function _restoreTutoriaStudents() {
  if (!_tutoriaAlumnes || !_tutoriaAlumnes.length) return;
  const grup = (typeof _grupDeTreball === 'function') ? _grupDeTreball() : null;
  // Només es pot estalviar la feina si el que hi ha carregat és la llista
  // SENCERA de la tutoria, que és la clau "4t B|" (sense assignatura).
  //
  // Abans es comparava només la part del grup, i "4t B|Matemàtiques" també
  // passava. Però aquesta clau vol dir "els alumnes de Matemàtiques de 4t B",
  // que amb desdoblament són NOMÉS LA MEITAT. Resultat: obries les notes
  // d'una assignatura desdoblada, tornaves a Alumnes i hi veies 15 alumnes
  // en comptes de tots, sense cap avís.
  if (grup && _grupStudentsCarregat === grup + '|') return;
  students = _tutoriaAlumnes.map(a => ({ id:a.id, nom:a.nom, genere:a.genere }));
  personal = {};
  _tutoriaAlumnes.forEach(a => {
    personal[a.id] = { mare:a.mare, pare:a.pare, emailMare:a.emailMare, emailPare:a.emailPare,
      obs:a.obs, pi:a.pi, am:a.am, especific:a.especific, eap:a.eap, seient:a.seient, dataNaix:a.dataNaix, rowId:a.rowId };
  });
  _grupStudentsCarregat = grup ? (grup + '|') : null;
}

/* ============================================================
   PONT PERFIL → SELECTORS D'ASSIGNATURA (Observacions, Assoliments)
   Fa que aquests selectors mostrin les assignatures del perfil,
   no la llista fixa per defecte.
   ============================================================ */

// Recull totes les entrades assignatura+grup del perfil (com el menú)
// Retorna [{nom, grup, key, label}] on key inclou el grup i label el mostra
function _perfilEntradesAmbGrup() {
  const entrades = [];
  if (_perfil && _perfil.classes) {
    Object.keys(_perfil.classes).forEach(grup => {
      (_perfil.classes[grup] || []).forEach(nom => {
        entrades.push({ nom, grup });
      });
    });
  }
  // Assignatures d'altres cursos (una entrada per curs+assignatura, p. ex. "Tallers · 3r")
  if (_perfil && _perfil.altres && typeof _perfil.altres === 'object') {
    Object.keys(_perfil.altres).forEach(curs => {
      (_perfil.altres[curs] || []).forEach(nom => {
        entrades.push({ nom, grup: curs, altres: true, curs, rotatori: _esRotatori(nom) });
      });
    });
  }
  const tutorKey = (typeof _perfilTutorGrupKey === 'function') ? _perfilTutorGrupKey() : null;
  // Compta per saber si una assignatura es repeteix a diversos grups
  const compta = {};
  entrades.forEach(e => { const k = _normNomSimple(e.nom); compta[k] = (compta[k]||0) + 1; });
  // Ordena: tutoria primer
  entrades.sort((a, b) => {
    if (a.grup === tutorKey && b.grup !== tutorKey) return -1;
    if (b.grup === tutorKey && a.grup !== tutorKey) return 1;
    return a.grup.localeCompare(b.grup) || a.nom.localeCompare(b.nom);
  });
  return entrades.map(e => {
    // Clau única que inclou el grup (perquè Tallers 4t B ≠ Tallers 3r C)
    const key = _assigKey(e.nom) + '__' + _normNomSimple(e.grup).replace(/[^a-z0-9]/g, '');
    // L'etiqueta del grup només es mostra si NO és el grup de tutoria
    // (el grup de tutoria ja se sobreentén).
    const esTutoria = tutorKey && e.grup === tutorKey;
    const label = esTutoria ? e.nom : (e.nom + ' · ' + e.grup);
    return { nom: e.nom, grup: e.grup, key, label, altres: !!e.altres, curs: e.curs || null, rotatori: !!e.rotatori };
  });
}

// Actualitza el <select> d'Observacions amb assignatura+grup del perfil
function _perfilRenderObsSelector() {
  const sel = document.getElementById('obsMateria');
  if (!sel) return;
  const entrades = _perfilEntradesAmbGrup();
  if (!entrades.length) return; // sense perfil, deixa les opcions per defecte

  const prev = sel.value;
  // "General" (observació sense assignatura) és cosa del tutor.
  let html = _perfilEsEspecialista() ? '' : '<option value="general">General</option>';
  entrades.forEach(e => {
    // Registra al mapa MATERIES perquè es mostri bé el títol amb grup
    if (typeof MATERIES !== 'undefined' && !MATERIES[e.key]) MATERIES[e.key] = e.label;
    // Guarda el grup (o el desdoblament) associat a la clau
    if (e.altres) _assigDesdobMap[e.key] = { curs: e.curs, assig: e.nom, rotatori: e.rotatori };
    else _assigGrupMap[e.key] = e.grup;
    _assigNomMap[e.key] = e.nom;
    html += `<option value="${e.key}">${escapeHtml(e.label)}</option>`;
  });
  sel.innerHTML = html;
  if (prev && sel.querySelector(`option[value="${prev}"]`)) sel.value = prev;
}

// Actualitza els botons del selector d'Assoliments amb assignatura+grup del perfil
function _perfilRenderAssimSelector() {
  const cont = document.getElementById('assimMateriaSelector');
  if (!cont) return;
  const entrades = _perfilEntradesAmbGrup();
  if (!entrades.length) return; // sense perfil, deixa els botons per defecte

  cont.innerHTML = entrades.map((e, i) => {
    if (typeof MATERIES !== 'undefined' && !MATERIES[e.key]) MATERIES[e.key] = e.label;
    if (typeof ASSIM_MATERIES !== 'undefined' && !ASSIM_MATERIES[e.key]) ASSIM_MATERIES[e.key] = e.label;
    if (e.altres) _assigDesdobMap[e.key] = { curs: e.curs, assig: e.nom, rotatori: e.rotatori };
    else _assigGrupMap[e.key] = e.grup;
    _assigNomMap[e.key] = e.nom;
    return `<button class="trim-sel-btn${i===0?' active':''}" data-mat="${e.key}" onclick="selectAssimMateria('${e.key}',this)">${escapeHtml(e.label)}</button>`;
  }).join('');

  // Si la matèria activa ja no existeix, selecciona la primera
  if (typeof _assimMateria !== 'undefined') {
    const existeix = entrades.some(e => e.key === _assimMateria);
    if (!existeix && entrades.length) _assimMateria = entrades[0].key;
  }
}

// Mapes clau→grup i clau→nom base (per als selectors amb grup)
let _assigGrupMap = {};
let _assigNomMap = {};

/* El NOM de debò d'una assignatura a partir de qualsevol clau que faci
   servir l'app. És el que s'ha d'enviar al full de desdoblaments: allà hi
   diu "Anglès", no "angles" (clau del menú) ni "Anglès · 3r A" (etiqueta
   dels selectors). Si s'hi envia una clau, el bloc no es troba i la
   mestra acaba veient la classe sencera en comptes del seu mig grup. */
function _assigNomNet(clau) {
  if (!clau) return '';
  if (typeof _assigNomMap !== 'undefined' && _assigNomMap[clau]) return _assigNomMap[clau];
  if (typeof _assigDesdobMap !== 'undefined' && _assigDesdobMap[clau] && _assigDesdobMap[clau].assig) {
    return _assigDesdobMap[clau].assig;
  }
  // Clau del menú (p. ex. "educaciofisica"): busca-la a les entrades del perfil
  try {
    const entrades = _perfilEntradesAmbGrup();
    const e = entrades.find(x => x.key === clau) ||
              entrades.find(x => (typeof _navMateriaKey === 'function') && _navMateriaKey(x) === clau) ||
              entrades.find(x => _assigKey(x.nom) === clau);
    if (e) return e.nom;
  } catch (err) {}
  // Últim recurs: l'etiqueta, sense el grup del darrere
  if (typeof MATERIES !== 'undefined' && MATERIES[clau]) return MATERIES[clau].split(' · ')[0];
  return clau;
}

/* ============================================================
   DESDOBLAMENTS ROTATORIS (p. ex. Tallers 3r)
   Una assignatura amb grups que roten cada X sessions. El grup
   actual es guarda al perfil (i, per tant, al Google Sheet) i es
   manté fix fins que el mestre el canvia. Els alumnes es carreguen
   barrejant totes les classes del curs (backend getDesdobGrup).
   ============================================================ */
let _assigDesdobMap = {};    // clau d'assignatura → { curs, assig }
let _desdobGrupsCache = {};  // "curs|assig" → [noms de grup]

function _desdobMapKey(curs, assig) { return curs + '|' + assig; }

// Grup actual (persistit). Si no n'hi ha cap, agafa el primer conegut.
// Opcions de grup d'una assignatura d'altre curs: els grups del desdoblament si
// en té; si no, les línies de classe (classe sencera). Cal haver cridat abans
// _desdobCarregaGrups (si no, tornem null a _desdobGrupActual).
function _desdobOpcions(curs, assig) {
  const gs = _desdobGrupsCache[_desdobMapKey(curs, assig)];
  if (gs && gs.length) return { grups: gs, desdob: true };
  const L = (typeof PERFIL_LINIES !== 'undefined') ? PERFIL_LINIES : ['A','B','C'];
  return { grups: L.map(l => curs + ' ' + l), desdob: false };
}

function _desdobGrupActual(curs, assig) {
  const k = _desdobMapKey(curs, assig);
  if (_perfil.desdobGrup && _perfil.desdobGrup[k]) return _perfil.desdobGrup[k];
  if (_desdobGrupsCache[k] === undefined) return null; // encara no carregat
  const o = _desdobOpcions(curs, assig);
  return o.grups.length ? o.grups[0] : null;
}

// Fixa el grup actual i el desa al perfil (Sheet + cache local).
async function _desdobSetGrup(curs, assig, grup) {
  if (!_perfil.desdobGrup || typeof _perfil.desdobGrup !== 'object') _perfil.desdobGrup = {};
  _perfil.desdobGrup[_desdobMapKey(curs, assig)] = grup;
  try { localStorage.setItem('vedruna_perfil', JSON.stringify(_perfil)); } catch(e) {}
  if (config.scriptUrl) {
    /* NO s'espera. Desar quin grup mires és cosa nostra i la mestra no n'ha
       de veure res; si s'esperava, canviar de grup eren DUES esperes seguides
       (desar el perfil i, després, demanar els alumnes) quan només n'hi ha
       una que li importi. Si el desat falla, el grup ja és al navegador i es
       tornara a desar al proper canvi. */
    appsScriptPost({ action: 'saveProfile', profile: JSON.stringify(_perfil) }).catch(function(){});
  }
}

// Carrega (i cacheja) la llista de grups d'un bloc de desdoblament.
async function _desdobCarregaGrups(curs, assig) {
  const k = _desdobMapKey(curs, assig);
  if (_desdobGrupsCache[k]) return _desdobGrupsCache[k];
  if (!config.scriptUrl) return [];
  try {
    const r = await appsScriptGet({ action: 'getDesdobGrups', curs: curs, assignatura: assig });
    _desdobGrupsCache[k] = (r && r.ok && Array.isArray(r.grups)) ? r.grups : [];
  } catch(e) { _desdobGrupsCache[k] = []; }
  return _desdobGrupsCache[k];
}

// Carrega els alumnes del grup ACTUAL i els aplica (students/personal).
// Si l'assignatura té grups de desdoblament, usa getDesdobGrup (barreja classes);
// si no, carrega la classe sencera (getGrupAlumnes).
async function _loadDesdobStudents(curs, assig) {
  if (!config.scriptUrl) return;
  await _desdobCarregaGrups(curs, assig);
  const o = _desdobOpcions(curs, assig);
  const grup = _desdobGrupActual(curs, assig);
  if (!grup) return;
  const clau = 'altres|' + _desdobMapKey(curs, assig) + '|' + grup;
  if (_grupStudentsCarregat === clau) return;
  const cacheKey = 'altrescache_' + clau;
  try {
    const raw = localStorage.getItem(cacheKey);
    if (raw) {
      const c = JSON.parse(raw);
      if (c && c.alumnes && c.alumnes.length) {
        _aplicaGrupStudents(c.alumnes);
        _grupStudentsCarregat = clau;
        if (Date.now() - (c.ts || 0) < 600000) return;
      }
    }
  } catch(e) {}
  try {
    let alumnes = [];
    if (o.desdob) {
      const r = await appsScriptGet({ action: 'getDesdobGrup', curs: curs, assignatura: assig, grup: grup });
      alumnes = (r && r.ok && r.alumnes) ? r.alumnes : [];
    } else {
      // Classe sencera: el "grup" és una línia (p. ex. "3r A")
      const r = await appsScriptGet({ action: 'getGrupAlumnes', grup: grup });
      alumnes = (r && r.ok && r.alumnes) ? r.alumnes : [];
      alumnes.forEach(a => { a.grupOrigen = grup; });
    }
    if (alumnes.length) {
      _aplicaGrupStudents(alumnes);
      _grupStudentsCarregat = clau;
      try { localStorage.setItem(cacheKey, JSON.stringify({ alumnes, ts: Date.now() })); } catch(e) {}
    }
  } catch(e) {}
}

// Renderitza la barra de chips per triar/canviar el grup de desdoblament.
// onChange() es crida quan es canvia de grup (perquè la pàgina recarregui).
let _desdobBarRegistry = {};
function _renderDesdobBar(containerId, curs, assig, onChange) {
  const cont = document.getElementById(containerId);
  if (!cont) return;
  _desdobBarRegistry[containerId] = { curs, assig, onChange };
  const pintar = () => {
    const el = document.getElementById(containerId);
    if (!el) return;
    if (_desdobGrupsCache[_desdobMapKey(curs, assig)] === undefined) { el.innerHTML = ''; return; }
    const o = _desdobOpcions(curs, assig);
    const actual = _desdobGrupActual(curs, assig);
    if (!o.grups.length) { el.innerHTML = ''; return; }
    const etiqueta = o.desdob ? ('Grup de ' + escapeHtml(assig)) : 'Grup (classe)';
    el.innerHTML = '<div class="desdob-bar"><span class="desdob-bar-label">' + etiqueta + ':</span>' +
      o.grups.map(g => {
        const gEsc = g.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        return `<button type="button" class="desdob-chip${g === actual ? ' actiu' : ''}" onclick="_desdobTriaGrup('${curs}','${assig.replace(/'/g,"\\'")}','${gEsc}','${containerId}')">${escapeHtml(g)}</button>`;
      }).join('') + '</div>';
  };
  pintar();
  if (_desdobGrupsCache[_desdobMapKey(curs, assig)] === undefined) _desdobCarregaGrups(curs, assig).then(pintar);
}

// Etiqueta de només lectura amb el grup actual (per a assignatures de grup fix).
async function _renderDesdobLabel(containerId, curs, assig) {
  const el = document.getElementById(containerId);
  if (!el) return;
  await _desdobCarregaGrups(curs, assig);
  const g = _desdobGrupActual(curs, assig);
  el.innerHTML = g
    ? '<div class="desdob-bar desdob-bar-info"><span class="desdob-bar-label">Grup: ' + escapeHtml(g) + '</span></div>'
    : '';
}

// Mostra el control adequat segons si l'assignatura és rotatòria (selector) o
// de grup fix (només etiqueta). dd = { curs, assig, rotatori }.
function _renderDesdobControl(containerId, dd, onChange) {
  const el = document.getElementById(containerId);
  if (!dd) { if (el) el.innerHTML = ''; return; }
  if (dd.rotatori) _renderDesdobBar(containerId, dd.curs, dd.assig, onChange);
  else _renderDesdobLabel(containerId, dd.curs, dd.assig);
}

async function _desdobTriaGrup(curs, assig, grup, containerId) {
  await _desdobSetGrup(curs, assig, grup);
  _grupStudentsCarregat = null; // força recàrrega
  // Repinta totes les barres d'aquest desdoblament
  Object.keys(_desdobBarRegistry).forEach(id => {
    const b = _desdobBarRegistry[id];
    if (b && b.curs === curs && b.assig === assig) _renderDesdobBar(id, curs, assig, b.onChange);
  });
  const b = _desdobBarRegistry[containerId];
  /* Amb el vel: aquesta és l'espera que la mestra mira de cara. Sense res a
     la pantalla, semblava que el botó del grup no fes res i es clicava un
     altre cop —i cada clic era una altra crida al servidor. */
  if (b && typeof b.onChange === 'function') {
    await esperaVisual(Promise.resolve(b.onChange(grup)), 'Carregant el grup ' + grup + '…');
  }
}

// --- Gestió al Perfil: ALTRES CURSOS on fas classe ---
function _perfilAltreBarId(curs, assig) {
  return 'perfilAltreBar_' + _assigKey(assig) + '_' + _normNomSimple(curs).replace(/[^a-z0-9]/g, '');
}

function _perfilRenderAltres() {
  const cont = document.getElementById('perfilAltresCursos');
  if (!cont) return;
  if (!_perfil.altres || typeof _perfil.altres !== 'object') _perfil.altres = {};
  const cursos = (typeof PERFIL_CURSOS !== 'undefined') ? PERFIL_CURSOS : ['1r','2n','3r','4t','5è','6è'];
  const afegits = Object.keys(_perfil.altres);
  let html = '';
  afegits.forEach(curs => {
    const sel = _perfil.altres[curs] || [];
    const chips = _assigsDeCurs(curs).map(a =>
      `<button type="button" class="perfil-assig-chip ${sel.includes(a)?'active':''}" onclick="_perfilToggleAltre('${curs}','${a.replace(/'/g,"\\'")}')">${escapeHtml(a)}</button>`
    ).join('');
    let grupsHtml = '';
    sel.forEach(a => {
      const rot = _esRotatori(a);
      grupsHtml += `<div class="perfil-altre-grup"><span class="perfil-altre-assig">${escapeHtml(a)}${rot?' <span class="es-tutor">rotatori</span>':''}</span><div id="${_perfilAltreBarId(curs, a)}"></div></div>`;
    });
    html += `<div class="perfil-grup-block">
      <div class="perfil-grup-block-head">
        <span class="perfil-grup-block-title">${escapeHtml(curs)}</span>
        <button class="perfil-grup-remove" onclick="_perfilTreuCursAltre('${curs}')" title="Treure curs">×</button>
      </div>
      <div class="perfil-assig-chips">${chips}</div>
      ${grupsHtml}
    </div>`;
  });
  const disponibles = cursos.filter(c => afegits.indexOf(c) === -1);
  html += `<div class="perfil-desdob-add" style="margin-top:10px;display:flex;gap:8px;align-items:center">
    <select class="modal-input" id="perfilAltreCursAdd" style="max-width:130px" onchange="_perfilAfegeixCursAltre(this.value)">
      <option value="">+ Afegir curs…</option>
      ${disponibles.map(c=>`<option value="${c}">${c}</option>`).join('')}
    </select>
  </div>`;
  cont.innerHTML = html;
  // Selectors de grup de cada assignatura seleccionada
  afegits.forEach(curs => {
    (_perfil.altres[curs] || []).forEach(a => {
      if (typeof _renderDesdobBar === 'function') _renderDesdobBar(_perfilAltreBarId(curs, a), curs, a, () => {});
    });
  });
}

function _perfilAfegeixCursAltre(curs) {
  if (!curs) return;
  if (!_perfil.altres || typeof _perfil.altres !== 'object') _perfil.altres = {};
  if (!_perfil.altres[curs]) _perfil.altres[curs] = [];
  _perfilRenderAltres();
}

function _perfilTreuCursAltre(curs) {
  if (_perfil.altres) delete _perfil.altres[curs];
  _perfilRenderAltres();
  if (typeof perfilRenderAllSelectors === 'function') perfilRenderAllSelectors();
}

function _perfilToggleAltre(curs, assig) {
  if (!_perfil.altres[curs]) _perfil.altres[curs] = [];
  const arr = _perfil.altres[curs];
  const i = arr.indexOf(assig);
  if (i === -1) arr.push(assig); else arr.splice(i, 1);
  _perfilRenderAltres();
  if (typeof perfilRenderAllSelectors === 'function') perfilRenderAllSelectors();
}

// Actualitza TOTS els selectors d'assignatura del perfil d'un cop
function perfilRenderAllSelectors() {
  if (typeof perfilRenderNavAssigs === 'function') perfilRenderNavAssigs();
  _perfilRenderObsSelector();
  _perfilRenderAssimSelector();
}

/* ============================================================
   BENVINGUDA PERSONALITZADA (nom del perfil + gènere pel nom)
   ============================================================ */

// Noms masculins habituals acabats en -a (excepcions a la regla general)
const _NOMS_MASC_EXCEPCIONS = [
  'josep maria','joan maria','pere maria','andrea','borja',
  'luca','lluca','cosma','nikola','mustafa','zakaria'
];
// Noms femenins que NO acaben en -a (excepcions)
const _NOMS_FEM_EXCEPCIONS = [
  'montse','montserrat','mariam','miriam','carmen','pilar','isabel','raquel',
  'ester','esther','ingrid','astrid','meritxell','nuria','núria','iris','beatriz',
  'dolors','mercè','merce','judith','edith','elisabet','abril','ruth','sol',
  'carme','elisabeth','roser','imma','sonia','tania','laia','gemma'
];

// Detecta si un nom és femení (per decidir Benvingut / Benvinguda)
function _nomEsFemeni(nom) {
  if (!nom) return false;
  const n = nom.toString().trim().toLowerCase().split(/\s+/)[0]; // només el primer nom
  if (_NOMS_MASC_EXCEPCIONS.includes(nom.toString().trim().toLowerCase())) return false;
  if (_NOMS_MASC_EXCEPCIONS.includes(n)) return false;
  if (_NOMS_FEM_EXCEPCIONS.includes(n)) return true;
  // Regla general: acabat en 'a' → femení
  return /a$/.test(n);
}

// Actualitza el títol de benvinguda de la pàgina d'inici
function _perfilUpdateGreeting() {
  const el = document.getElementById('heroGreeting');
  if (!el) return;
  const nom = (_perfil.nom || '').trim().split(/\s+/)[0] || ''; // només el nom
  const salutacio = _nomEsFemeni(nom) ? 'Benvinguda' : 'Benvingut';
  if (nom) {
    el.innerHTML = salutacio + ', <em>' + escapeHtml(nom) + '!</em>';
  } else {
    el.textContent = salutacio + '!';
  }
}

/* ============================================================
   CÀRREGA NETA D'ALUMNES D'UN GRUP+ASSIGNATURA
   Retorna la llista d'alumnes (amb desdoblament aplicat) SENSE
   modificar la variable global 'students'. Ideal per a eines que
   només necessiten consultar (com el generador de grups).
   ============================================================ */
async function _carregaAlumnesGrupNet(grup, materia) {
  if (!grup || !config.scriptUrl) return [];
  // Mira primer el cache
  const cacheKey = 'grupcache_' + grup + '|' + (materia || '');
  try {
    const raw = localStorage.getItem(cacheKey);
    if (raw) {
      const c = JSON.parse(raw);
      if (c && c.alumnes && c.alumnes.length && (Date.now() - (c.ts||0) < 600000)) {
        return c.alumnes.slice();
      }
    }
  } catch(e) {}

  try {
    const r = await appsScriptGet({ action:'getGrupAlumnes', grup: grup });
    let alumnes = (r.ok && r.alumnes) ? r.alumnes : [];

    // Aplica desdoblament si l'assignatura n'és
    if (materia && alumnes.length) {
      const parts = grup.split(' ');
      const matNom = _assigNomNet(materia);
      try {
        const d = await appsScriptGet({ action:'getDesdoblament', curs:parts[0], linia:parts[1], assignatura:matNom });
        if (d.ok && d.existeix && d.alumnes && d.alumnes.length && !d.sensDesdob) {
          const queden = new Set(d.alumnes.map(a => a.nom));
          const filtrats = alumnes.filter(a => queden.has(a.nom));
          if (filtrats.length) alumnes = filtrats;
        }
      } catch(e) {}
    }

    if (alumnes.length) {
      try { localStorage.setItem(cacheKey, JSON.stringify({ alumnes, ts: Date.now() })); } catch(e) {}
    }
    return alumnes;
  } catch(e) { return []; }
}
