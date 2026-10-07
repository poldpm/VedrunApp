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
  cursos: [],       // qui no té tutoria: els cursos que ha afegit al perfil
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
  /* Els cursos on fa classe qui no té tutoria (29/9/2026). Als perfils
     d'abans no hi és: es dedueixen dels grups i de les assignatures que
     ja hi tingués, i per això no cal migrar-hi res (veure
     `_perfilCursosEsp`). */
  if (!Array.isArray(p.cursos)) p.cursos = [];
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
  /* ⚠ «4t A A»: UN CURS QUE PORTAVA LA LÍNIA ENGANXADA.

     Trobat a l'auditoria del 6/9/2026. Les assignatures d'«altres cursos»
     van indexades pel CURS («4t»), però hi ha camins vells que hi deixaven el
     grup sencer («4t A»). Llavors l'app hi tornava a enganxar la línia i
     demanava el grup «4t A A», que no existeix: el desplegable sortia buit,
     els alumnes no arribaven mai i no ho deia enlloc.

     Aquí es reparen aquestes claus: es queda el curs i, si la línia s'havia
     colat, ja la posarà el selector de grup. Es fa a la migració perquè es
     repari sol el dia que la mestra obri l'app, sense que hagi de fer res. */
  /* ⚠ I LA LÍNIA QUE ES LLENÇAVA AQUÍ LA TRIAVA DESPRÉS L'APP, SOLA.

     Segona auditoria (8/9/2026). El comentari de sobre deia «ja la posarà el
     selector de grup», i el selector, sense saber res, es queda amb la
     PRIMERA línia. Una especialista amb el perfil «2n C · Música» acabava
     treballant amb els alumnes de 2n A —observacions, registres, assoliments
     i generador de grups— sense que res ho digués.

     La línia la sabíem: era escrita a la clau. Ara es desa a `desdobGrup`,
     que és on el selector la va a buscar. Si la mestra en vol una altra, la
     canvia al selector, com sempre. */
  const CURSOS_OK = ['1r','2n','3r','4t','5è','6è'];
  Object.keys(p.altres).forEach(k => {
    const parts = String(k).trim().split(/\s+/);
    const curs = parts[0];
    const linia = parts[1] || '';
    if (k === curs) return;                            // ja està bé
    if (CURSOS_OK.indexOf(curs) === -1) return;        // no ho sabem arreglar: es deixa
    if (!p.altres[curs]) p.altres[curs] = [];
    (p.altres[k] || []).forEach(a => {
      if (p.altres[curs].indexOf(a) === -1) p.altres[curs].push(a);
      if (linia) {
        if (!p.desdobGrup || typeof p.desdobGrup !== 'object') p.desdobGrup = {};
        const mk = (typeof _desdobMapKey === 'function') ? _desdobMapKey(curs, a) : (curs + '|' + a);
        if (!p.desdobGrup[mk]) p.desdobGrup[mk] = curs + ' ' + linia;
      }
    });
    delete p.altres[k];
  });

  return p;
}

function _grupKey(curs, linia) { return curs + ' ' + linia; }

function initPerfil() {
  const cached = localStorage.getItem('vedruna_perfil');
  if (cached) { try { _perfil = _perfilMigrar(JSON.parse(cached)); } catch(e) {} }
  /* Les assignatures marcades i encara sense lloc són d'aquesta estada a la
     pàgina: si es quedessin d'una visita per l'altra, un dia qualsevol el
     Desar li quedaria blocat per una marca que ni recorda. */
  _perfilSensePosar = {};
  _perfilTocat = false;
  _perfilRender();
  _perfilLoadFromSheets();
}

/* ⚠ EL REFRESC DEL FULL NO POT REPINTAR EL PERFIL MENTRE ELLA HI CLICA.

   `_perfilLoadFromSheets` torna al cap d'un parell de segons i reemplaça
   `_perfil` sencer. Amb el perfil nou per cursos (v250), aquells dos segons
   són just quan s'estan clicant els xips: el que hagués marcat desapareixia
   sense dir res. Trobat a l'auditoria del 29/9/2026.

   Ara, si ja hi ha tocat res, el que ve del full es deixa per a la propera
   vegada: el que mana és el que té a les mans. */
let _perfilTocat = false;
function _perfilMarcaTocat() { _perfilTocat = true; }

async function _perfilLoadFromSheets() {
  if (!config.scriptUrl) return;
  if (typeof _recentFullLoad === 'function' && _recentFullLoad()) return; // el bootstrap ja l'ha portat
  try {
    // El perfil ja es veu (del navegador): el refresc no el tapa amb el vel.
    const r = await appsScriptGet({ action: 'loadProfile', _fons: true });
    // Mentre esperàvem, ha començat a marcar coses: no li repintem a sobre.
    if (_perfilTocat) return;
    if (r.ok && r.profile) {
      _perfil = _perfilMigrar(Object.assign({ nom:'', tutorCurs:null, tutorLinia:null, classes:{}, altres:{}, desdobGrup:{}, cursos:[] }, r.profile));
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
  /* ⚠ La targeta «Assignatures amb grup rotatori» s'amaga a qui no té
     tutoria (28/9/2026). Demanava a la mestra que sabés ella quines
     assignatures van per desdoblament; ara ho mira l'app tota sola, a la
     targeta de dalt, en marcar l'assignatura. El que ja hi hagués desat
     segueix funcionant: no s'esborra res, només deixa de demanar-se. */
  if (esp) mostra('perfilCardAltres', false);
}

/* ============================================================
   PERFIL DE QUI NO TÉ TUTORIA — els cursos on fa classe
   (especialistes i direcció)
   ------------------------------------------------------------
   ⚠ REFET EL 29/9/2026. En Pol: «ha de poder triar entre 1r o 6è.
   Quan selecciona una assignatura d'aquell grup és quan ha de poder
   triar: A, B, C, Desdoblament o rotatiu. Si aquella assignatura no
   té desdoblament, només mostra A, B o C». I, de seguida: «ha de
   poder marcar-ne més d'un, potser fa educació física a 3r A i 3r B».

   Abans s'afegia el GRUP sencer («3r A») i s'hi marcaven les
   assignatures a dins. Qui fa Educació Física a les tres línies de 3r
   havia d'afegir tres grups i repetir-hi tres cops la mateixa
   assignatura, i el desdoblament li sortia en un desplegable a part,
   al capdavall del bloc.

   Ara s'afegeix el CURS i, per cada assignatura que marca, diu ON la
   fa: les línies A, B i C —totes les que calgui— i, si aquella
   assignatura va per desdoblament, també els grups del desdoblament
   (o del grup rotatori, com el Tallers).

   ON ES DESA CADA COSA (això no canvia: són els dos camins que l'app
   ja sabia fer servir, i els alumnes, les observacions i els
   registres hi van al darrere sols):
     · una línia     → `classes["3r A"] = [assignatures]`
     · desdoblament  → `altres["3r"] = [assignatures]`, amb el grup
                       triat a `desdobGrup["3r|assignatura"]`
   ============================================================ */

/* Els cursos que surten al perfil: els que ha afegit i els que se
   saben de les dades. `_perfil.cursos` és el que fa que un curs
   acabat d'afegir no desaparegui abans de marcar-hi res. */
function _perfilCursosEsp() {
  const out = [];
  const posa = c => { if (PERFIL_CURSOS.indexOf(c) !== -1 && out.indexOf(c) === -1) out.push(c); };
  if (Array.isArray(_perfil.cursos)) _perfil.cursos.forEach(posa);
  Object.keys(_perfil.classes || {}).forEach(g => posa(String(g).split(' ')[0]));
  Object.keys(_perfil.altres  || {}).forEach(posa);
  return out.sort((a, b) => PERFIL_CURSOS.indexOf(a) - PERFIL_CURSOS.indexOf(b));
}

/* Les assignatures que es poden marcar d'un curs: les del pla
   d'estudis i, al darrere, les que ella ja tingués marcades encara
   que no hi siguin (noms escrits a mà en perfils vells). Si no es
   fes, una assignatura seva es quedaria activa sense sortir enlloc:
   no la podria ni veure ni treure. */
function _perfilAssigsDelCurs(curs) {
  const out = _assigsDeCurs(curs).slice();
  const mes = a => { if (a && out.indexOf(a) === -1) out.push(a); };
  PERFIL_LINIES.forEach(l => ((_perfil.classes || {})[curs + ' ' + l] || []).forEach(mes));
  ((_perfil.altres || {})[curs] || []).forEach(mes);
  return out;
}

// Les línies (A, B, C) on fa una assignatura d'aquest curs.
function _perfilLiniesDe(curs, assig) {
  return PERFIL_LINIES.filter(l => ((_perfil.classes || {})[curs + ' ' + l] || []).indexOf(assig) !== -1);
}

// El grup de desdoblament triat, si n'hi ha cap.
function _perfilDesdobDe(curs, assig) {
  if (((_perfil.altres || {})[curs] || []).indexOf(assig) === -1) return null;
  return (_perfil.desdobGrup || {})[_desdobMapKey(curs, assig)] || null;
}

/* Assignatures marcades que encara no diuen ON es fan. Viuen només
   mentre la pàgina és oberta: sense línia ni grup no hi ha res a
   desar, i en desar el perfil es reclamen (veure `perfilSave`). */
let _perfilSensePosar = {};

function _perfilMarcaClau(curs, assig) { return curs + '|' + assig; }

function _perfilAssigMarcada(curs, assig) {
  /* ⚠ També compta ser a `altres[curs]` encara que no s'hagi triat cap grup.

     Els perfils fets abans del 29/9/2026 (la targeta vella «Assignatures amb
     grup rotatori») hi tenen assignatures sense cap entrada a `desdobGrup`.
     Sense aquesta línia sortien AQUÍ com si no les fes —el xip apagat— però
     seguien al menú, a Observacions i a les notes. Trobat a l'auditoria del
     29/9/2026. Ara surten marcades i l'app li demana a quin grup les fa, que
     és la informació que hi falta. */
  return _perfilLiniesDe(curs, assig).length > 0 ||
         _perfilDesdobDe(curs, assig) !== null ||
         (((_perfil.altres || {})[curs] || []).indexOf(assig) !== -1) ||
         !!_perfilSensePosar[_perfilMarcaClau(curs, assig)];
}

function _perfilRenderGrupsEspecialista() {
  const cont = document.getElementById('perfilGrupsEspecialista');
  if (!cont) return;
  if (!_perfil.classes || typeof _perfil.classes !== 'object') _perfil.classes = {};
  if (!_perfil.altres  || typeof _perfil.altres  !== 'object') _perfil.altres  = {};
  const cursos = _perfilCursosEsp();
  let html = '';

  /* Si alguna cosa impedeix saber els desdoblaments, es diu UN cop a dalt
     de tot: afecta totes les assignatures, no cap en particular. */
  const problemes = [];
  /* ⚠ SENSE CONNEXIÓ NO ES POT SABER, I S'HA DE DIR (29/9/2026).
     En Pol, provant-ho a una app acabada d'instal·lar: «hi ha assignatures
     que tenen grup de desdoblaments i no surt… no surt ni a tallers». No
     estava connectada: l'app no pot preguntar res al full de l'escola, i
     fins ara s'ho callava i ensenyava només A, B i C, com si cap
     assignatura no es desdoblés. */
  if (!config.scriptUrl && cursos.length) {
    problemes.push('Aquesta app encara no està connectada al servidor, o sigui que no pot saber ' +
                   'quines assignatures van per desdoblament: de moment només et pot oferir A, B i C. ' +
                   'Connecta-la a Configuració i torna a obrir el perfil.');
  }
  cursos.forEach(curs => {
    _perfilAssigsDelCurs(curs).forEach(a => {
      if (!_perfilAssigMarcada(curs, a)) return;
      const p = _desdobProblema(curs, a);
      if (p && problemes.indexOf(p) === -1) problemes.push(p);
    });
  });
  if (problemes.length) {
    html += '<div class="grups-avis grups-avis-warn" role="status">' +
            problemes.map(p => escapeHtml(p)).join('<br>') + '</div>';
  }

  cursos.forEach(curs => {
    const assigs = _perfilAssigsDelCurs(curs);
    const chips = assigs.map(a => {
      const hi = _perfilAssigMarcada(curs, a);
      return `<button type="button" class="perfil-assig-chip ${hi ? 'active' : ''}" aria-pressed="${hi}"
               onclick="_perfilToggleAssigCurs('${_idJs(curs)}','${_idJs(a)}')">${escapeHtml(a)}</button>`;
    }).join('');
    const files = assigs.filter(a => _perfilAssigMarcada(curs, a))
                        .map(a => _perfilFilaOn(curs, a)).join('');
    html += `<div class="perfil-grup-block">
      <div class="perfil-grup-block-head">
        <span class="perfil-grup-block-title">${escapeHtml(curs)}</span>
        <button class="perfil-grup-remove" onclick="_perfilTreuCursEsp('${_idJs(curs)}')"
                title="Treure ${escapeHtml(curs)}" aria-label="Treure ${escapeHtml(curs)} del perfil">×</button>
      </div>
      <div class="perfil-assig-chips">${chips}</div>
      ${files ? `<div class="perfil-on-llista">${files}</div>` : ''}
    </div>`;
  });

  if (!cursos.length) {
    html += '<p class="modal-hint">Encara no hi ha cap curs. Afegeix-ne un aquí sota.</p>';
  }
  const disponibles = PERFIL_CURSOS.filter(c => cursos.indexOf(c) === -1);
  html += `<div class="perfil-desdob-add" style="margin-top:10px;display:flex;gap:8px;align-items:center">
    <select class="modal-input" id="perfilCursAdd" style="max-width:170px" aria-label="Afegir un curs on fas classe"
            onchange="_perfilAfegeixCursEsp(this.value)">
      <option value="">+ Afegir curs…</option>
      ${disponibles.map(c => `<option value="${c}">${c}</option>`).join('')}
    </select>
  </div>`;
  cont.innerHTML = html;
  _perfilMiraDesdoblaments(cursos);   // en segon pla; quan ho sap, repinta
}

/* La fila d'una assignatura marcada: on la fa.
   Les línies hi són sempre; el desdoblament, només si aquella
   assignatura d'aquell curs en té al full de Desdoblaments. Mentre no
   se sap, s'hi diu: si no, podria triar la línia i marxar sense
   arribar a veure mai que hi havia grups. */
function _perfilFilaOn(curs, assig) {
  const linies = _perfilLiniesDe(curs, assig);
  const triat  = _perfilDesdobDe(curs, assig);
  const sapDesdob = _desdobGrupsCache[_desdobMapKey(curs, assig)] !== undefined;
  const o = _desdobOpcions(curs, assig);

  const chipsLinia = PERFIL_LINIES.map(l => {
    const hi = linies.indexOf(l) !== -1;
    return `<button type="button" class="perfil-on-chip ${hi ? 'active' : ''}" aria-pressed="${hi}"
      aria-label="${escapeHtml(assig)} a ${escapeHtml(curs + ' ' + l)}"
      onclick="_perfilToggleLinia('${_idJs(curs)}','${_idJs(assig)}','${l}')">${l}</button>`;
  }).join('');

  let desdob = '';
  if (!sapDesdob && config.scriptUrl) {
    desdob = '<span class="perfil-on-espera">mirant si té desdoblament…</span>';
  } else if (sapDesdob && o.desdob) {
    const etiq = (typeof _esRotatori === 'function' && _esRotatori(assig)) ? 'Grup rotatiu:' : 'Desdoblament:';
    desdob = `<span class="perfil-on-etiq">${etiq}</span>` + o.grups.map(g =>
      `<button type="button" class="perfil-on-chip desdob ${triat === g ? 'active' : ''}" aria-pressed="${triat === g}"
        aria-label="${escapeHtml(assig)} amb el grup ${escapeHtml(g)}"
        onclick="_perfilToggleDesdob('${_idJs(curs)}','${_idJs(assig)}','${_idJs(g)}')">${escapeHtml(g)}</button>`
    ).join('');
  }

  const falta = !linies.length && !triat;
  return `<div class="perfil-on-fila${falta ? ' falta' : ''}">
    <span class="perfil-on-assig">${escapeHtml(assig)}</span>
    <div class="perfil-on-opcions">${chipsLinia}${desdob}</div>
    ${falta ? '<span class="perfil-on-avis">digues on la fas</span>' : ''}
  </div>`;
}

function _perfilAfegeixCursEsp(curs) {
  _perfilMarcaTocat();
  if (!curs || PERFIL_CURSOS.indexOf(curs) === -1) return;
  if (!Array.isArray(_perfil.cursos)) _perfil.cursos = [];
  if (_perfil.cursos.indexOf(curs) === -1) _perfil.cursos.push(curs);
  _perfilRenderGrupsEspecialista();
  if (typeof perfilRenderAllSelectors === 'function') perfilRenderAllSelectors();
}

function _perfilTreuCursEsp(curs) {
  _perfilMarcaTocat();
  const marcades = _perfilAssigsDelCurs(curs).filter(a => _perfilAssigMarcada(curs, a));
  const detall = marcades.length
    ? ' Perdràs les ' + marcades.length + ' assignatures que hi tens marcades (' + marcades.join(', ') + ').'
    : '';
  if (!confirm('Vols treure ' + curs + ' del teu perfil?' + detall)) return;
  PERFIL_LINIES.forEach(l => { delete _perfil.classes[curs + ' ' + l]; });
  if (_perfil.altres) delete _perfil.altres[curs];
  if (_perfil.desdobGrup) {
    Object.keys(_perfil.desdobGrup).forEach(k => {
      if (k.indexOf(curs + '|') === 0) delete _perfil.desdobGrup[k];
    });
  }
  Object.keys(_perfilSensePosar).forEach(k => {
    if (k.indexOf(curs + '|') === 0) delete _perfilSensePosar[k];
  });
  if (Array.isArray(_perfil.cursos)) _perfil.cursos = _perfil.cursos.filter(c => c !== curs);
  _perfilRenderGrupsEspecialista();
  if (typeof perfilRenderAllSelectors === 'function') perfilRenderAllSelectors();
}

/* Marcar o desmarcar una assignatura del curs. En marcar-la NO se li
   posa cap línia: la tria ella. Posar-n'hi una per defecte seria
   pitjor que no posar-n'hi cap —acabaria passant llista als alumnes
   d'una altra classe sense que res ho digués. */
function _perfilToggleAssigCurs(curs, assig) {
  _perfilMarcaTocat();
  if (_perfilAssigMarcada(curs, assig)) {
    PERFIL_LINIES.forEach(l => _perfilTreuDeLinia(curs, assig, l));
    _perfilTreuDesdob(curs, assig);
    delete _perfilSensePosar[_perfilMarcaClau(curs, assig)];
  } else {
    _perfilSensePosar[_perfilMarcaClau(curs, assig)] = true;
  }
  _perfilRenderGrupsEspecialista();
  if (typeof perfilRenderAllSelectors === 'function') perfilRenderAllSelectors();
}

function _perfilTreuDeLinia(curs, assig, linia) {
  const k = curs + ' ' + linia;
  const arr = (_perfil.classes || {})[k];
  if (!arr) return;
  const i = arr.indexOf(assig);
  if (i !== -1) arr.splice(i, 1);
  if (!arr.length) delete _perfil.classes[k];
}

function _perfilToggleLinia(curs, assig, linia) {
  _perfilMarcaTocat();
  const k = curs + ' ' + linia;
  if (_perfilLiniesDe(curs, assig).indexOf(linia) !== -1) {
    _perfilTreuDeLinia(curs, assig, linia);
    /* Es queda marcada encara que es quedi sense on: si no, li
       desapareixeria de sota els dits mentre canvia de línia. */
    if (!_perfilLiniesDe(curs, assig).length && !_perfilDesdobDe(curs, assig)) {
      _perfilSensePosar[_perfilMarcaClau(curs, assig)] = true;
    }
  } else {
    if (!_perfil.classes[k]) _perfil.classes[k] = [];
    _perfil.classes[k].push(assig);
    /* ⚠ O LÍNIES O DESDOBLAMENT, MAI TOTS DOS.

       Són dos camins diferents de desar (`classes["3r A"]` i `altres["3r"]`),
       i tenir-los tots dos alhora feia sortir l'assignatura DUES vegades a
       tot arreu —al menú, a Observacions, a les notes— amb dos registres
       diferents i sense manera de saber quina era quina. Trobat a
       l'auditoria del 29/9/2026. En Pol ho va dir com una tria: «A, B, C,
       Desdoblament o rotatiu». */
    _perfilTreuDesdob(curs, assig);
    delete _perfilSensePosar[_perfilMarcaClau(curs, assig)];
  }
  _perfilRenderGrupsEspecialista();
  if (typeof perfilRenderAllSelectors === 'function') perfilRenderAllSelectors();
}

function _perfilTreuDesdob(curs, assig) {
  const arr = (_perfil.altres || {})[curs];
  if (arr) {
    const i = arr.indexOf(assig);
    if (i !== -1) arr.splice(i, 1);
    if (!arr.length) delete _perfil.altres[curs];
  }
  if (_perfil.desdobGrup) delete _perfil.desdobGrup[_desdobMapKey(curs, assig)];
}

/* El grup de desdoblament és UN: triar-ne un altre canvia el d'abans.
   Tornar a clicar el que ja hi és el treu, i llavors l'assignatura es
   queda marcada esperant que digui on la fa. */
function _perfilToggleDesdob(curs, assig, grup) {
  _perfilMarcaTocat();
  if (!grup) return;
  if (_perfilDesdobDe(curs, assig) === grup) {
    _perfilTreuDesdob(curs, assig);
    if (!_perfilLiniesDe(curs, assig).length) {
      _perfilSensePosar[_perfilMarcaClau(curs, assig)] = true;
    }
  } else {
    if (!_perfil.altres[curs]) _perfil.altres[curs] = [];
    if (_perfil.altres[curs].indexOf(assig) === -1) _perfil.altres[curs].push(assig);
    if (!_perfil.desdobGrup || typeof _perfil.desdobGrup !== 'object') _perfil.desdobGrup = {};
    _perfil.desdobGrup[_desdobMapKey(curs, assig)] = grup;
    // O línies o desdoblament (veure `_perfilToggleLinia`): triar un grup
    // treu les línies que hi hagués marcades d'aquella assignatura.
    PERFIL_LINIES.forEach(function (l) { _perfilTreuDeLinia(curs, assig, l); });
    delete _perfilSensePosar[_perfilMarcaClau(curs, assig)];
  }
  _perfilRenderGrupsEspecialista();
  if (typeof perfilRenderAllSelectors === 'function') perfilRenderAllSelectors();
}

/* Mira, sense fer esperar ningú, quines de les assignatures marcades
   van per desdoblament. Quan ho sap, repinta. Cada curs+assignatura
   es demana un sol cop per sessió (queda al cache). */
let _perfilMirantDesdob = false;
async function _perfilMiraDesdoblaments(cursos) {
  if (_perfilMirantDesdob || !config.scriptUrl) return;
  const pendents = [];
  (cursos || []).forEach(curs => {
    _perfilAssigsDelCurs(curs).forEach(a => {
      if (!_perfilAssigMarcada(curs, a)) return;
      if (_desdobGrupsCache[_desdobMapKey(curs, a)] === undefined) pendents.push([curs, a]);
    });
  });
  if (!pendents.length) return;
  _perfilMirantDesdob = true;
  try {
    for (const [curs, a] of pendents) { await _desdobCarregaGrups(curs, a); }
  } finally { _perfilMirantDesdob = false; }
  _perfilRenderGrupsEspecialista();
}

/* Les assignatures marcades que encara no diuen on es fan, per
   reclamar-les en desar. Torna [] quan està tot posat. */
function _perfilFaltaDirOn() {
  const falten = [];
  _perfilCursosEsp().forEach(curs => {
    _perfilAssigsDelCurs(curs).forEach(a => {
      if (!_perfilAssigMarcada(curs, a)) return;
      if (!_perfilLiniesDe(curs, a).length && !_perfilDesdobDe(curs, a)) falten.push({ curs: curs, assig: a });
    });
  });
  return falten;
}



// Selector de tutoria: curs + línia
function _perfilRenderTutorSel() {
  const cont = document.getElementById('perfilTutorSel');
  if (!cont) return;
  const cursos = PERFIL_CURSOS.map(c =>
    `<button class="perfil-grup-btn ${_perfil.tutorCurs===c?'active':''}" onclick="_perfilSetTutorCurs('${_idJs(c)}')">${c}</button>`
  ).join('');
  let liniesHtml = '';
  if (_perfil.tutorCurs) {
    liniesHtml = `<div class="perfil-tutor-linies">
      <span class="perfil-tutor-lin-label">Línia:</span>
      ${PERFIL_LINIES.map(l =>
        `<button class="perfil-linia-btn ${_perfil.tutorLinia===l?'active':''}" onclick="_perfilSetTutorLinia('${_idJs(l)}')">${_perfil.tutorCurs} ${l}</button>`
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
    `<button type="button" class="perfil-assig-chip ${sel.includes(a)?'active':''}" onclick="_perfilToggleAssig('${_idJs(tutorKey)}','${a.replace(/'/g,"\\'")}')">${escapeHtml(a)}</button>`
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
  /* ⚠ Aquí hi deia `_perfilRenderGrupBlocks()`, que no existeix enlloc: un canvi
     de nom a mitges. Cada clic a una assignatura llançava un ReferenceError, el
     xip no es repintava mai i la mestra el clicava un segon cop —i llavors se li
     desmarcava sense veure-ho. El bessó de les especialistes
     (`_perfilToggleAssigGrup`) sempre havia cridat el seu render; aquest, el seu. */
  _perfilRenderGrups();
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
      showToast('Afegeix almenys un curs i marca-hi una assignatura', 'error'); return;
    }
    /* ⚠ Una assignatura marcada que no diu a quina línia es fa no es
       desa enlloc: desapareixeria en tancar l'app i ella no en sabria
       res. Val més reclamar-ho ara que no pas que ho descobreixi el dia
       que no trobi el grup. */
    const falten = (typeof _perfilFaltaDirOn === 'function') ? _perfilFaltaDirOn() : [];
    if (falten.length) {
      const f = falten[0];
      showToast('Digues on fas ' + f.assig + ' de ' + f.curs + ': A, B, C o el grup de desdoblament' +
                (falten.length > 1 ? ' (i ' + (falten.length - 1) + ' més)' : ''), 'error');
      const cont = document.getElementById('perfilGrupsEspecialista');
      const prim = cont && cont.querySelector('.perfil-on-fila.falta');
      if (prim && prim.scrollIntoView) {
        /* Amb «reduir el moviment» posat, res de desplaçament suau: el CSS no
           pot aturar un  demanat des del codi. */
        var _suau = true;
        try { _suau = !window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
        prim.scrollIntoView({ block: 'center', behavior: _suau ? 'smooth' : 'auto' });
      }
      return;
    }
  } else if (!_perfil.tutorCurs || !_perfil.tutorLinia) {
    showToast('Tria de quin curs i línia ets tutor/a', 'error'); return;
  }
  localStorage.setItem('vedruna_perfil', JSON.stringify(_perfil));
  _perfilTocat = false;   // desat: el refresc del full ja hi pot tornar
  _perfilUpdateNav();
  perfilRenderAllSelectors();
  if (config.scriptUrl) {
    try {
      /* ⚠ `appsScriptPost` NO llança quan el servidor respon `{ok:false}` —
         per exemple amb la clau de seguretat canviada. Sense mirar-ho, aquí
         es deia «Perfil desat ✓» amb el perfil sense desar (auditoria
         6/9/2026): la mestra donava per fet que ja ho tenia. */
      const r = await appsScriptPost({ action: 'saveProfile', profile: JSON.stringify(_perfil) });
      if (r && r.ok === false) throw new Error(r.error || 'el servidor no l\'ha pogut desar');
      showToast('Perfil desat ✓', 'success');
      /* ⚠ I ARA VE'S A BUSCAR ELS ALUMNES.

         Trobat a l'auditoria del 6/9/2026: en desar el perfil per primera
         vegada, la pantalla d'Alumnes deia «Encara no hi ha cap alumne a
         2n C — quan siguin al full compartit, sortiran aquí sols», amb els
         dotze ja al full. Només calia recarregar, però una mestra nova no ho
         sap: en treu la conclusió que la direcció no ha penjat la llista.

         Ara, tot just desat el perfil, es demanen els alumnes del grup i es
         repinta el que hi hagi obert. */
      try {
        if (typeof _loadTutoriaGrup === 'function') await _loadTutoriaGrup(true);
        if (typeof renderAlumnesList === 'function') renderAlumnesList();
        if (typeof updateHomeCounters === 'function') updateHomeCounters();
        if (typeof renderObsGrid === 'function') renderObsGrid();
      } catch (e) {}
    } catch(e) {
      showToast('El perfil s\'ha desat en aquest ordinador, però NO al full: ' + (typeof errorHuma === 'function' ? errorHuma(e) : (e && e.message) || ''), 'error');
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

async function _loadTutoriaGrup(forca) {
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
        _aplicaTutoriaAlumnes(c.alumnes, false, forca);
        // Si és recent (<10 min), no refresquis
        if (Date.now() - (c.ts||0) < 600000) return;
      }
    }
  } catch(e) {}

  try {
    const r = await appsScriptGet({ action: 'getGrupAlumnes', grup: grup });
    if (r.ok && r.alumnes && r.alumnes.length) {
      if (typeof _ultimaFallidaAlumnes !== 'undefined') _ultimaFallidaAlumnes = null;
      _aplicaTutoriaAlumnes(r.alumnes, false, forca);
      try { localStorage.setItem(cacheKey, JSON.stringify({ alumnes: r.alumnes, ts: Date.now(), v: versioAra })); } catch(e) {}
    } else if (r && r.ok && r.existeix !== false) {
      /* El grup hi es i no te ningu: aixo tambe es una resposta, i s ha de
         fer cas. Si no, hi queden els alumnes del grup anterior. */
      if (typeof _ultimaFallidaAlumnes !== 'undefined') _ultimaFallidaAlumnes = null;
      _aplicaTutoriaAlumnes([], true, forca);
      try { localStorage.setItem(cacheKey, JSON.stringify({ alumnes: [], ts: Date.now(), v: versioAra })); } catch(e) {}
    } else if (r && r.ok === false) {
      if (typeof _ultimaFallidaAlumnes !== 'undefined') _ultimaFallidaAlumnes = (r.error || 'el servidor no ha pogut donar la llista');
      _avisAlumnesVells(r.error || 'el servidor no ha pogut donar la llista');
    }
  } catch(e) {
    /* ⚠ Abans això era silenciós, i és el pitjor que podia ser: si el
       servidor fallava, a la pantalla hi quedava la còpia vella i semblava
       la bona. Val més dir-ho. */
    if (typeof _ultimaFallidaAlumnes !== 'undefined') _ultimaFallidaAlumnes = (e && e.message) ? e.message : 'sense connexió amb el servidor';
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
  await _loadTutoriaGrup(true);
  if (typeof showToast === 'function') showToast('Alumnes al dia ✓', 'success');
}

/* `buitDeDebo` = el servidor ha respost i aquest grup NO té ningú.

   Sense aquest segon argument la funció es planta i deixa la classe
   anterior a la pantalla, que és el que volem quan la petició ha fallat
   —no esborrar la feina de la mestra per un mal moment del servidor— però
   NO quan el grup és buit de veritat: llavors s'hi quedaven els alumnes de
   l'altre grup amb el nom del nou a sobre, i tot el que s'hi escrivia
   anava a parar on no tocava (auditoria 6/9/2026). */
let _grupCarregaId = 0;

/* ⚠ LA LLISTA DE L'ASSIGNATURA QUE ES TORNAVA LA CLASSE SENCERA (7/10/2026).

   En Pol: «estic posant notes i algunes vegades em carrega tota la llista
   sencera; si torno a refrescar em mostra el grup que toca».

   Per què: cada pocs minuts l'app es posa al dia sola (el bootstrap), i
   això tornava a posar els alumnes de la TUTORIA a la pantalla, fos la que
   fos. Si estaves a les notes de Mates (mitja classe, per desdoblament) o
   d'una assignatura d'un altre grup, de cop tenies la classe sencera de la
   tutoria. Pitjor: invalidava la càrrega de l'assignatura que encara venia
   (`_grupCarregaId`), o sigui que la bona ja no arribava mai.

   Ara se sap quan la pantalla treballa amb els alumnes d'UNA assignatura
   (`_llistaDAssignatura`). Mentre és així, la posada al dia de la tutoria
   només actualitza la còpia de la tutoria (`_tutoriaAlumnes`), que és la
   que es tornarà a posar en anar a Alumnes, Registres o Observacions
   (`_restoreTutoriaStudents`). La llista de la pantalla no es toca.

   `forca` = ho ha demanat la mestra ara (canviar de grup a direcció,
   «Refresca els alumnes», desar el perfil): llavors sí que mana. */
let _llistaDAssignatura = null;   // "4t B|Mates", "altres|…", o null = la tutoria

function _aplicaTutoriaAlumnes(alumnes, buitDeDebo, forca) {
  if ((!alumnes || !alumnes.length) && !buitDeDebo) return;
  alumnes = alumnes || [];
  if (_llistaDAssignatura && !forca) {
    _tutoriaAlumnes = alumnes;   // la tutoria, al dia per quan s'hi torni
    if (typeof _refreshAniversaris === 'function') _refreshAniversaris();
    return;
  }
  _llistaDAssignatura = null;
  /* Aquesta llista passa a ser la bona: qualsevol càrrega de grup que encara
     estigui en marxa queda invalidada. Sense això, una petició d'un grup que
     s'ha deixat enrere podia arribar tard i buidar la pantalla del grup que
     s'acaba de triar (ho va destapar `comprova-rols.js` a direcció). */
  if (typeof _grupCarregaId !== 'undefined') _grupCarregaId++;
  _tutoriaAlumnes = alumnes;
  _grupStudentsCarregat = (_grupDeTreball() || '') + '|';
  /* El rowId (el codi permanent del full «Grups») viatja amb l alumne.
     Sense ell, tot el que es desa per alumne cau a la POSICIO: el dia que
     la sincronitzacio reordena la llista, els assoliments d un nen surten
     a un altre. _assimSid() ja el buscava; no el trobava mai perque aqui
     no s hi posava. */
  students = alumnes.map(function(a) { return { id: a.id, nom: a.nom, genere: a.genere, rowId: a.rowId }; });
  personal = {};
  alumnes.forEach(function(a) {
    personal[a.id] = {
      tutor1: a.tutor1, correu1: a.correu1, tutor2: a.tutor2, correu2: a.correu2,
      telefons: a.telefons,
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

/* ⚠ A LA DIRECTORA LI SORTIEN ELS ANIVERSARIS D'UNA CLASSE QUE NO ÉS SEVA.

   En Pol, 28/9/2026, instal·lant-la-hi: al planning li sortien els
   aniversaris de 2n C —el SEU grup—, perquè això mirava `_tutoriaAlumnes`,
   que a qui no té tutoria val «el grup amb què s'ha treballat l'últim cop».
   Amb un tutor no falla mai (només en té un); a direcció i a les
   especialistes, ensenyava el primer grup que haguessin obert.

   Ara, qui no té tutoria veu els aniversaris dels alumnes de TOTS els grups
   que ha dit al seu perfil, i de cap més. */
let _anivPerGrup = {};      // grup → [{nom, dataNaix}]
let _anivCarregant = false;

function _anivGrupsDelPerfil() {
  const out = [];
  if (_perfil && _perfil.classes) Object.keys(_perfil.classes).forEach(g => {
    if (/^(1r|2n|3r|4t|5è|6è) [ABC]$/.test(g) && out.indexOf(g) === -1) out.push(g);
  });
  /* I les classes que fa per una assignatura d'un altre curs, quan el
     grup triat és una classe sencera (29/9/2026). Els grups de
     desdoblament de debò no hi entren: són mitges classes barrejades i
     el seu aniversari ja el veurà el tutor. */
  if (_perfil && _perfil.desdobGrup) Object.values(_perfil.desdobGrup).forEach(g => {
    if (/^(1r|2n|3r|4t|5è|6è) [ABC]$/.test(g) && out.indexOf(g) === -1) out.push(g);
  });
  return out;
}

/* Els va a buscar en segon pla, d'un en un, i repinta quan en té. No fa
   esperar ningú: el planning es pinta igual i els pastissos hi apareixen
   quan arriben. */
async function _anivCarrega() {
  if (_anivCarregant || !config.scriptUrl) return;
  const falten = _anivGrupsDelPerfil().filter(g => _anivPerGrup[g] === undefined);
  if (!falten.length) return;
  _anivCarregant = true;
  try {
    for (const g of falten) {
      try {
        const r = await appsScriptGet({ action: 'getGrupAlumnes', grup: g, _fons: true });
        _anivPerGrup[g] = (r && r.ok && Array.isArray(r.alumnes))
          ? r.alumnes.filter(a => a && a.dataNaix).map(a => ({ nom: a.nom, dataNaix: a.dataNaix }))
          : [];
      } catch (e) { _anivPerGrup[g] = []; }
    }
  } finally { _anivCarregant = false; }
  if (typeof _refreshAniversaris === 'function') _refreshAniversaris();
}

// Retorna els noms dels alumnes que fan anys en una data (Date o 'YYYY-MM-DD')
function aniversarisDelDia(data) {
  /* Qui no té tutoria: els dels seus grups del perfil. */
  if (_perfilSenseTutoria()) {
    const grups = _anivGrupsDelPerfil();
    if (!grups.length) return [];
    let llista = [];
    let faltaAlgun = false;
    grups.forEach(g => {
      if (_anivPerGrup[g] === undefined) { faltaAlgun = true; return; }
      llista = llista.concat(_anivPerGrup[g]);
    });
    if (faltaAlgun) _anivCarrega();
    return _anivDelDia(llista, data);
  }
  if (!_tutoriaAlumnes || !_tutoriaAlumnes.length) return [];
  return _anivDelDia(_tutoriaAlumnes, data);
}

/* Qui fa anys, d'una llista, en una data. */
function _anivDelDia(llista, data) {
  let mes, dia;
  if (data instanceof Date) {
    mes = data.getMonth() + 1; dia = data.getDate();
  } else {
    const p = data.toString().split('-'); // YYYY-MM-DD
    if (p.length < 3) return [];
    mes = parseInt(p[1]); dia = parseInt(p[2]);
  }
  const noms = [];
  (llista || []).forEach(a => {
    if (!a || !a.dataNaix) return;
    const pn = a.dataNaix.toString().split('-'); // YYYY-MM-DD
    if (pn.length < 3) return;
    const m = parseInt(pn[1]), d = parseInt(pn[2]);
    if (m === mes && d === dia && noms.indexOf(a.nom) === -1) noms.push(a.nom);
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
    return `<a class="nav-item" href="#" onclick="openNotesAuto('${_idJs(key)}','${_idJs(e.grup)}'); return false;">
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

/* ============================================================
   DE QUI ÉS LA LLISTA QUE HI HA A LA PANTALLA
   ------------------------------------------------------------
   ⚠ ELS NENS D'UNA ALTRA CLASSE SOTA EL TÍTOL D'AQUESTA ASSIGNATURA.

   La Mireia, 6/10/2026: és tutora de 2n B, obre les notes d'«Ambients de
   1r» i li surt la llista de nens de 2n B. Qualsevol nota que hi escrivís
   aniria al full d'Ambients, a la fila d'un nen de 1r que ella no veu.

   Per què passava: `students` és UNA SOLA llista per a tota l'app, i les
   assignatures d'un altre curs o d'un altre grup la demanen al servidor
   —dues crides en sèrie— mentre la pantalla ja s'ha pintat. Fins que no
   arribava, es pintava la llista que hi havia: la de la tutoria. I si
   alguna de les dues crides fallava, s'hi quedava per sempre.

   `_grupStudentsCarregat` ja diu de qui és la llista carregada. El que
   faltava era MIRAR-HO abans de pintar. Aquestes dues funcions ho fan:
   diuen quina etiqueta hauria de tenir la llista d'una assignatura, i si
   la que hi ha hi correspon.

   ⚠ «No ho sé» (etiqueta buida, tot just arrencant) NO és «no correspon»:
   a l'arrencada els alumnes vénen del cache del bootstrap i encara no
   estan etiquetats. Buidar-los allà deixaria la mestra sense classe per
   no res. Només es buida quan la llista és d'un grup que SABEM que no és
   el d'aquesta assignatura.
   ============================================================ */

/* De quin GRUP són els alumnes que hi ha ara a la pantalla. Es compara el
   grup i no l'etiqueta sencera: «4t B|» (la classe sencera) i «4t B|Anglès»
   (la meitat, per desdoblament) són nens del MATEIX grup, i barrejar-los no
   és el problema d'aquí —d'això ja se'n cuida `_ensureGrupStudents`. El que
   no pot passar mai és veure nens d'una ALTRA classe. */
function _grupDeLaLlistaCarregada() {
  if (!_grupStudentsCarregat) return null;          // no en sabem res
  if (_grupStudentsCarregat.indexOf('altres|') === 0) {
    const p = _grupStudentsCarregat.split('|');     // altres | curs | assig | grup
    return 'altres|' + p[1] + '|' + p[2];
  }
  return _grupStudentsCarregat.split('|')[0];
}

/* I de quin grup haurien de ser per a l'assignatura que s'està obrint. Les
   d'un altre curs no es poden dir pel grup: la rotació els barreja de dues
   classes, o sigui que el que les identifica és curs + assignatura. */
function _grupQueTocaA(grup, desdob) {
  if (desdob && desdob.curs) return 'altres|' + _desdobMapKey(desdob.curs, desdob.assig);
  if (grup) return grup;
  return (typeof _grupDeTreball === 'function' ? _grupDeTreball() : '') || '';
}

function _alumnesSonDUnAltreGrup(grup, desdob) {
  const ara = _grupDeLaLlistaCarregada();
  if (ara === null) return false;                   // encara no està etiquetada
  return ara !== _grupQueTocaA(grup, desdob);
}

/* Treu de la pantalla una llista que és d'un altre grup, ABANS que s'hi pinti
   res. Torna true si l'ha treta (qui la crida ho pot dir a la mestra).

   Es crida a cada pantalla que ensenya els alumnes d'UNA assignatura: notes,
   assoliments, el generador de comentaris i l'avaluació de rúbriques. Les
   quatre carregaven la llista bona del servidor i, mentrestant —o per sempre,
   si la crida fallava— pintaven la que hi havia. */
function _netejaAlumnesSiSonDUnAltre(grup, desdob) {
  if (!_alumnesSonDUnAltreGrup(grup, desdob)) return false;
  students = []; personal = {};
  _grupStudentsCarregat = null;      // que la càrrega que ve no se l'estalviï
  return true;
}

async function _ensureGrupStudents(grup, materia) {
  if (!grup || !config.scriptUrl) return;
  const clau = grup + '|' + (materia||'');
  _llistaDAssignatura = clau;   // la tutoria que s'actualitzi sola no la trepitgi
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
  /* El rowId (el codi permanent del full «Grups») viatja amb l alumne.
     Sense ell, tot el que es desa per alumne cau a la POSICIO: el dia que
     la sincronitzacio reordena la llista, els assoliments d un nen surten
     a un altre. _assimSid() ja el buscava; no el trobava mai perque aqui
     no s hi posava. */
  students = alumnes.map(a => ({ id: a.id, nom: a.nom, genere: a.genere, rowId: a.rowId }));
  personal = {};
  alumnes.forEach(a => {
    personal[a.id] = { tutor1:a.tutor1, correu1:a.correu1, tutor2:a.tutor2, correu2:a.correu2, telefons:a.telefons,
      obs:a.obs, pi:a.pi, am:a.am, especific:a.especific, eap:a.eap, seient:a.seient, dataNaix:a.dataNaix, rowId:a.rowId,
      grupOrigen:a.grupOrigen || null };
  });
}

// Carrega els alumnes del grup del backend (aplica desdoblament) i desa en cache
/* Quina càrrega de grup mana. Cada vegada que se'n demana una, agafa número;
   quan torna, només s'aplica si encara és l'última. Sense això, una petició
   d'un grup que has deixat enrere pot arribar tard i trepitjar el grup que
   estàs mirant ara —i des que un grup buit també s'aplica (que és el que
   toca), això voldria dir quedar-se amb la pantalla en blanc. */


/* Noms del full de desdoblaments que no casen amb cap alumne del grup. Són
   nens que no sortiran a la llista d'aquesta assignatura (normalment perquè
   el nom hi està escrit diferent que al full «Grups»). Es diu un cop per
   sessió: si no, la mestra només veu que en falta un i no sap per què. */
const _noTrobatsAvisats = {};
function _avisaNoTrobatsDesdob(grup, assig, noTrobats) {
  if (!noTrobats || !noTrobats.length) return;
  const k = grup + '|' + assig;
  if (_noTrobatsAvisats[k]) return;
  _noTrobatsAvisats[k] = true;
  if (typeof showToast === 'function') {
    showToast('Al full de desdoblaments de «' + assig + ' · ' + grup + '» hi ha ' +
              (noTrobats.length === 1 ? 'un nom que no trobo' : noTrobats.length + ' noms que no trobo') +
              ' a la llista del grup: ' + noTrobats.join(', ') +
              '. No surten aquí fins que el nom no hi estigui escrit igual que al full «Grups».', 'error');
  }
}

async function _refreshGrupStudents(grup, materia, clau, cacheKey) {
  const meu = ++_grupCarregaId;
  try {
    const r = await appsScriptGet({ action:'getGrupAlumnes', grup: grup });
    if (meu !== _grupCarregaId) return;      // ja n'hi ha una de més nova
    let alumnes = (r.ok && r.alumnes) ? r.alumnes : [];

    /* ⚠ SI NO SE SAP SI ÉS MITJA CLASSE, NO ES DONA PER BONA LA SENCERA.

       Abans, si la pregunta del desdoblament fallava (un mal moment del
       servidor), es queia en silenci a la classe sencera, es desava a la
       còpia del navegador i es donava per carregada: durant deu minuts, i
       fins que no es recarregués l'app, la mestra veia tota la classe a una
       assignatura de mitja. Ara es torna a provar un cop i, si torna a
       fallar, es diu i no es guarda res: la propera vegada es tornarà a
       demanar. */
    let desdobDubtos = false;
    if (materia && alumnes.length) {
      const parts = grup.split(' ');
      const matNom = _assigNomNet(materia);
      let d = null;
      for (let intent = 0; intent < 2 && !(d && d.ok); intent++) {
        try { d = await appsScriptGet({ action:'getDesdoblament', curs:parts[0], linia:parts[1], assignatura:matNom }); }
        catch (e) { d = null; }
        if (meu !== _grupCarregaId) return;
      }
      if (!d || !d.ok) {
        desdobDubtos = true;
      } else if (d.existeix && d.alumnes && d.alumnes.length && !d.sensDesdob) {
        /* Es casen pel CODI de l'alumne (no canvia mai) i, si no en té, pel
           nom normalitzat. Abans era el nom exacte: un espai de més o un
           accent diferent i el nen desapareixia de la llista. */
        const nn = x => _normNomSimple(x).replace(/\s+/g, ' ');
        const codis = new Set(), noms = new Set();
        d.alumnes.forEach(a => {
          if (a.uid) codis.add(String(a.uid));
          else noms.add(nn(a.nom));            // sense codi: només pel nom
        });
        const filtrats = alumnes.filter(a => a.uid && codis.has(String(a.uid)) ? true : noms.has(nn(a.nom)));
        if (filtrats.length) alumnes = filtrats;
        _avisaNoTrobatsDesdob(grup, matNom, d.noTrobats);
      }
    }

    /* ⚠ UN GRUP BUIT DE DEBÒ NO ÉS EL MATEIX QUE UNA PETICIÓ QUE HA FALLAT.

       Abans aquí hi deia només `if (alumnes.length)`. La idea era bona —no
       esborrar la classe perquè el servidor hagi tingut un mal moment— però
       es menjava també el cas de veritat: triaves un grup que encara no té
       ningú al full de l'escola (3r B, al setembre) i la pantalla es quedava
       els alumnes del grup ANTERIOR, amb el nom del grup nou a sobre. Tot el
       que s'hi escrivia anava al grup equivocat: observacions, creus de
       registre, notes. Ho van trobar els tres rols alhora a l'auditoria del
       6/9/2026.

       El servidor ja ho sap distingir: si la pestanya del grup hi és, torna
       `existeix:true` encara que no tingui ningú. O sigui que:
         · ha respost i el grup és buit  → es buida la llista (és la veritat);
         · la petició ha fallat          → es deixa el que hi havia. */
    const haRespost = !!(r && r.ok);
    /* ⚠ I només si aquest grup és el que s'està mirant ARA. A direcció, i a
       una especialista amb diversos grups, hi ha peticions de grups que ja
       s'han deixat enrere: si una d'aquelles tornava buida i es feia cas,
       buidava la pantalla del grup bo. Ho va destapar `comprova-rols.js`. */
    const grupAra = (typeof _grupDeTreball === 'function') ? _grupDeTreball() : null;
    const encaraHiSom = !grupAra || grupAra === grup;
    const grupBuitDeDebo = haRespost && !alumnes.length && r.existeix !== false && encaraHiSom;

    if (meu !== _grupCarregaId) return;      // ha arribat tard: no toquis res
    if (alumnes.length || grupBuitDeDebo) {
      alumnes.forEach(a => { if (!a.grupOrigen) a.grupOrigen = grup; });
      _aplicaGrupStudents(alumnes);
      if (desdobDubtos) {
        _grupStudentsCarregat = null;   // que la propera vegada es torni a demanar
        try { localStorage.removeItem(cacheKey); } catch(e) {}
        if (typeof showToast === 'function') {
          showToast('No he pogut saber si «' + _assigNomNet(materia) + ' · ' + grup + '» va per desdoblament: ' +
                    'et surt la classe sencera. Torna-la a obrir d\'aquí a una estona.', 'error');
        }
      } else {
        _grupStudentsCarregat = clau;
        try { localStorage.setItem(cacheKey, JSON.stringify({ alumnes, ts: Date.now() })); } catch(e) {}
      }
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
  _llistaDAssignatura = null;    // tornem a la classe sencera
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
  students = _tutoriaAlumnes.map(a => ({ id:a.id, nom:a.nom, genere:a.genere, rowId:a.rowId }));
  personal = {};
  _tutoriaAlumnes.forEach(a => {
    personal[a.id] = { tutor1:a.tutor1, correu1:a.correu1, tutor2:a.tutor2, correu2:a.correu2, telefons:a.telefons,
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
  /* SENSE PERFIL NO S'INVENTEN ASSIGNATURES.
     Trobat a l'auditoria del 6/9/2026: aqui es deixaven els cinc botons per
     defecte (Mates, Catala, Medi, Musica, Angles) i una mestra que no fa cap
     d'aquestes —o la direccio, que no en fa cap— es posava a avaluar objectius
     dins d'una assignatura que no existeix. Ara s'hi diu on s'arregla. */
  if (!entrades.length) {
    cont.innerHTML = '<span class="modal-hint">Encara no has dit quines assignatures fas. Ves a <strong>El meu perfil</strong>.</span>';
    return;
  }

  cont.innerHTML = entrades.map((e, i) => {
    if (typeof MATERIES !== 'undefined' && !MATERIES[e.key]) MATERIES[e.key] = e.label;
    if (typeof ASSIM_MATERIES !== 'undefined' && !ASSIM_MATERIES[e.key]) ASSIM_MATERIES[e.key] = e.label;
    if (e.altres) _assigDesdobMap[e.key] = { curs: e.curs, assig: e.nom, rotatori: e.rotatori };
    else _assigGrupMap[e.key] = e.grup;
    _assigNomMap[e.key] = e.nom;
    return `<button class="trim-sel-btn${i===0?' active':''}" data-mat="${e.key}" onclick="selectAssimMateria('${_idJs(e.key)}',this)">${escapeHtml(e.label)}</button>`;
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
/* ⚠ QUAN NO HI HA GRUPS, EL PERQUÈ IMPORTA (29/9/2026).

   En Pol, provant el perfil nou: «hi ha assignatures que tenen grup de
   desdoblaments i no surt… no surt ni a tallers». Aquí es veia igual un
   «aquesta assignatura no va per desdoblament» que un «no he pogut ni
   mirar-ho»: les dues coses deixaven la llista buida i la pantalla
   ensenyava només A, B i C, sense dir res.

   El servidor sí que ho diu, al camp `motiu`: si no sap quin és el full
   de Desdoblaments, si no hi ha pestanya d'aquell curs, o si no hi troba
   el bloc de l'assignatura. Els dos primers casos i una crida fallada
   afecten TOTES les assignatures i s'han de dir; el tercer és el cas
   normal d'una assignatura que no es desdobla i no s'ha de dir res. */
let _desdobMotius = {};   // "curs|assig" → { motiu, fallat }

async function _desdobCarregaGrups(curs, assig) {
  const k = _desdobMapKey(curs, assig);
  if (_desdobGrupsCache[k]) return _desdobGrupsCache[k];
  /* Sense connexió no s'hi apunta cap motiu: la pantalla del perfil es
     pinta abans que la configuració arribi, i deixar-hi un avís aquí el
     faria sortir a qui només va un pèl lent de connexió. */
  if (!config.scriptUrl) return [];
  try {
    const r = await appsScriptGet({ action: 'getDesdobGrups', curs: curs, assignatura: assig });
    /* ⚠ `appsScriptGet` NO llança mai: quan falla torna `{ok:false}`. Sense
       mirar-ho, una lectura fallada es guardava com «no en té». */
    if (!r || r.ok === false) {
      _desdobMotius[k] = { fallat: true, motiu: (r && r.error) || 'el servidor no ha contestat' };
      _desdobGrupsCache[k] = [];
    } else {
      _desdobGrupsCache[k] = Array.isArray(r.grups) ? r.grups : [];
      _desdobMotius[k] = { fallat: false, motiu: r.motiu || '' };
    }
  } catch(e) {
    _desdobMotius[k] = { fallat: true, motiu: (e && e.message) || 'error desconegut' };
    _desdobGrupsCache[k] = [];
  }
  return _desdobGrupsCache[k];
}

/* Si no hi ha grups, què ho impedeix? Torna una frase per a la mestra, o
   null quan simplement aquella assignatura no va per desdoblament. */
function _desdobProblema(curs, assig) {
  const k = _desdobMapKey(curs, assig);
  if ((_desdobGrupsCache[k] || []).length) return null;
  const m = _desdobMotius[k];
  if (!m) return null;
  if (m.fallat) {
    return 'No s\'ha pogut preguntar al servidor quins grups de desdoblament hi ha (' +
           m.motiu + '). El que veus no vol dir que no n\'hi hagi.';
  }
  const t = (m.motiu || '').toLowerCase();
  if (t.indexOf('sense full') !== -1) {
    return 'Aquesta app no sap quin és el full de Desdoblaments de l\'escola, o sigui que no pot ' +
           'saber quines assignatures es desdoblen. S\'arregla a Configuració → Fulls de l\'escola.';
  }
  if (t.indexOf('sense pestanya') !== -1) {
    return 'Al full de Desdoblaments no hi ha cap pestanya per a ' + curs +
           ' (hi hauria de dir «Desdoblaments ' + curs + ' (26-27)»), o sigui que d\'aquest curs no ' +
           'se\'n pot oferir cap grup.';
  }
  return null;   // «no trobo el bloc»: aquesta assignatura no es desdobla
}

// Carrega els alumnes del grup ACTUAL i els aplica (students/personal).
// Si l'assignatura té grups de desdoblament, usa getDesdobGrup (barreja classes);
// si no, carrega la classe sencera (getGrupAlumnes).
async function _loadDesdobStudents(curs, assig) {
  if (!config.scriptUrl) return;
  _llistaDAssignatura = 'altres|' + _desdobMapKey(curs, assig);  // veure `_aplicaTutoriaAlumnes`
  /* Número de càrrega, com a `_refreshGrupStudents`: si mentrestant se'n
     demana una altra (un altre grup del desdoblament, una altra assignatura),
     aquesta, quan arribi, ja no mana. Sense això, clicar dos grups seguits
     podia deixar a la pantalla el primer amb el nom del segon. */
  const meu = ++_grupCarregaId;
  await _desdobCarregaGrups(curs, assig);
  if (meu !== _grupCarregaId) return;
  const o = _desdobOpcions(curs, assig);
  const grup = _desdobGrupActual(curs, assig);
  if (!grup) {
    /* ⚠ AQUEST «return» MUT ERA EL QUE DEIXAVA LA CLASSE D'ABANS (6/10/2026).

       Sense saber de quin grup és l'assignatura no es pot carregar ningú, i
       aquí es marxava sense tocar res: a la pantalla es quedava la llista
       anterior —la tutoria— amb el títol d'aquesta assignatura a sobre. És
       el mateix forat que es va tapar el 8/9 per al grup buit i a
       `_ensureGrupStudents` per als grups normals; aquesta sortida se'n va
       escapar perquè passa abans.

       Ara es deixa buit i es diu per què. Millor cap nen que el nen d'una
       altra classe: el que s'hi escrivís aniria a un full que no és el seu. */
    if (_alumnesSonDUnAltreGrup(null, { curs: curs, assig: assig })) {
      _aplicaGrupStudents([]);
      _grupStudentsCarregat = null;
      const perque = (typeof _desdobProblema === 'function') ? _desdobProblema(curs, assig) : null;
      if (typeof showToast === 'function') {
        showToast('Encara no sé de quins alumnes és «' + assig + ' · ' + curs + '». ' +
                  (perque || 'Tria el grup a dalt, o mira-ho al teu Perfil.') +
                  ' Mentre no ho sàpiga no hi pots escriure notes.', 'error');
      }
      if (typeof renderNotesTable === 'function') { try { renderNotesTable(); } catch (e) {} }
    }
    return;
  }
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
    /* La resposta es guarda fora de les dues branques: mes avall cal saber si
       el servidor ha CONTESTAT que el grup es buit o si la crida ha fallat.
       No es el mateix, i barrejar-ho es el que deixava els alumnes de
       l assignatura d abans a la pantalla (segona auditoria, 8/9/2026). */
    let resposta = null;
    if (o.desdob) {
      resposta = await appsScriptGet({ action: 'getDesdobGrup', curs: curs, assignatura: assig, grup: grup });
      alumnes = (resposta && resposta.ok && resposta.alumnes) ? resposta.alumnes : [];
    } else {
      // Classe sencera: el "grup" és una línia (p. ex. "3r A")
      resposta = await appsScriptGet({ action: 'getGrupAlumnes', grup: grup });
      alumnes = (resposta && resposta.ok && resposta.alumnes) ? resposta.alumnes : [];
      alumnes.forEach(a => { a.grupOrigen = grup; });
    }
    if (meu !== _grupCarregaId) return;      // ha arribat tard: ja en manen una altra
    if (alumnes.length) {
      _aplicaGrupStudents(alumnes);
      _grupStudentsCarregat = clau;
      try { localStorage.setItem(cacheKey, JSON.stringify({ alumnes, ts: Date.now() })); } catch(e) {}
    } else {
      /* ⚠ EL GRUP BUIT QUE DEIXAVA ELS ALUMNES DE L'ASSIGNATURA ANTERIOR.

         Trobat a la segona auditoria (8/9/2026). Aquí, amb la llista buida,
         no es feia RES: ni s'aplicava res ni es deia res. `students` es
         quedava amb els alumnes de l'assignatura d'abans, sota el nom del
         grup nou, i tot el que s'hi escrivia —observacions, creus, notes—
         anava al grup equivocat.

         És la mateixa crítica que ja es va arreglar a `_ensureGrupStudents`
         per als grups normals; aquest camí —el de les assignatures d'altres
         cursos i els grups rotatoris— no s'hi va incloure.

         ⚠ Només es buida si el servidor ha CONTESTAT que no hi ha ningú. Si
         la crida ha fallat, es cau al `catch` i no es toca res: amb la
         connexió dolenta val més deixar-li la classe a la pantalla. */
      const haRespost = !!(resposta && resposta.ok !== false);
      if (haRespost) {
        _aplicaGrupStudents([]);
        _grupStudentsCarregat = clau;
        try { localStorage.removeItem(cacheKey); } catch(e) {}
        if (typeof showToast === 'function') {
          showToast('«' + (assig || '') + ' · ' + grup + '» encara no té cap alumne al full de l\'escola. ' +
                    'Mentre no n\'hi hagi, aquí no hi pots escriure res.', 'error');
        }
      }
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
        return `<button type="button" class="desdob-chip${g === actual ? ' actiu' : ''}" onclick="_desdobTriaGrup('${_idJs(curs)}','${assig.replace(/'/g,"\\'")}','${gEsc}','${containerId}')">${escapeHtml(g)}</button>`;
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
/* ⚠ NO ES PODIA CANVIAR DE LÍNIA DINS D'UN ALTRE CURS.

   Trobat a l'auditoria del 6/9/2026. Aquí, si l'assignatura no era
   «rotatòria» (com el Tallers), es pintava una etiqueta fixa —«Grup: 3r A»—
   i prou. Però una especialista que fa Música a 3r A, 3r B i 3r C hi té tres
   grups, i no en podia triar cap: es quedava sempre amb el primer, i tot el
   que hi feia (assoliments, comentaris, grups) era d'aquell.

   Ara mana el nombre de grups que hi ha de debò: si n'hi ha més d'un, es
   poden triar; si només n'hi ha un, es queda l'etiqueta, que és la que toca. */
async function _renderDesdobControl(containerId, dd, onChange) {
  const el = document.getElementById(containerId);
  if (!dd) { if (el) el.innerHTML = ''; return; }
  if (dd.rotatori) { _renderDesdobBar(containerId, dd.curs, dd.assig, onChange); return; }
  try { await _desdobCarregaGrups(dd.curs, dd.assig); } catch (e) {}
  const o = (typeof _desdobOpcions === 'function') ? _desdobOpcions(dd.curs, dd.assig) : { grups: [] };
  if (o && o.grups && o.grups.length > 1) _renderDesdobBar(containerId, dd.curs, dd.assig, onChange);
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
      `<button type="button" class="perfil-assig-chip ${sel.includes(a)?'active':''}" onclick="_perfilToggleAltre('${_idJs(curs)}','${a.replace(/'/g,"\\'")}')">${escapeHtml(a)}</button>`
    ).join('');
    let grupsHtml = '';
    sel.forEach(a => {
      const rot = _esRotatori(a);
      grupsHtml += `<div class="perfil-altre-grup"><span class="perfil-altre-assig">${escapeHtml(a)}${rot?' <span class="es-tutor">rotatori</span>':''}</span><div id="${_perfilAltreBarId(curs, a)}"></div></div>`;
    });
    html += `<div class="perfil-grup-block">
      <div class="perfil-grup-block-head">
        <span class="perfil-grup-block-title">${escapeHtml(curs)}</span>
        <button class="perfil-grup-remove" onclick="_perfilTreuCursAltre('${_idJs(curs)}')"
                title="Treure curs" aria-label="Treure ${escapeHtml(curs)} del perfil">×</button>
      </div>
      <div class="perfil-assig-chips">${chips}</div>
      ${grupsHtml}
    </div>`;
  });
  const disponibles = cursos.filter(c => afegits.indexOf(c) === -1);
  html += `<div class="perfil-desdob-add" style="margin-top:10px;display:flex;gap:8px;align-items:center">
    <select class="modal-input" id="perfilAltreCursAdd" aria-label="Afegir un curs on faig classe" style="max-width:130px" onchange="_perfilAfegeixCursAltre(this.value)">
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
  /* ⚠ I el selector de grup d'Observacions i de Registres (28/9/2026).

     Es pintava un sol cop, en entrar a la pàgina. Si el perfil encara no
     havia arribat del full —que és el cas normal en obrir l'app—, la mestra
     es quedava sense selector i sense manera de fer-lo sortir si no canviava
     de pàgina i tornava. Ara, quan arriba el perfil, es repinta. */
  if (typeof _rolRenderGrupPicker === 'function') {
    ['registres', 'observacions'].forEach(p => {
      const pag = document.getElementById('page-' + p);
      if (pag && !pag.classList.contains('page-hidden')) _rolRenderGrupPicker(p);
    });
  }
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
  if (nom) {
    el.innerHTML = (_nomEsFemeni(nom) ? 'Benvinguda' : 'Benvingut') + ', <em>' + escapeHtml(nom) + '!</em>';
  } else {
    /* ⚠ Sense nom, `_nomEsFemeni('')` és fals i sortia «Benvingut!».
       La primera pantalla que veu una mestra que s'acaba de donar d'alta
       —i encara no ha omplert el perfil— la tractava en masculí. L'HTML ja
       porta el neutre; aquí només cal no trepitjar-lo. Auditoria 11/9/2026. */
    el.textContent = 'Benvingut/da!';
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
    /* ⚠ SI NO SE SAP SI ÉS MITJA CLASSE, NO ES DONA PER BONA LA SENCERA.

       Abans, si la pregunta del desdoblament fallava (un mal moment del
       servidor), es queia en silenci a la classe sencera, es desava a la
       còpia del navegador i es donava per carregada: durant deu minuts, i
       fins que no es recarregués l'app, la mestra veia tota la classe a una
       assignatura de mitja. Ara es torna a provar un cop i, si torna a
       fallar, es diu i no es guarda res: la propera vegada es tornarà a
       demanar. */
    let desdobDubtos = false;
    if (materia && alumnes.length) {
      const parts = grup.split(' ');
      const matNom = _assigNomNet(materia);
      let d = null;
      for (let intent = 0; intent < 2 && !(d && d.ok); intent++) {
        try { d = await appsScriptGet({ action:'getDesdoblament', curs:parts[0], linia:parts[1], assignatura:matNom }); }
        catch (e) { d = null; }
        if (meu !== _grupCarregaId) return;
      }
      if (!d || !d.ok) {
        desdobDubtos = true;
      } else if (d.existeix && d.alumnes && d.alumnes.length && !d.sensDesdob) {
        /* Es casen pel CODI de l'alumne (no canvia mai) i, si no en té, pel
           nom normalitzat. Abans era el nom exacte: un espai de més o un
           accent diferent i el nen desapareixia de la llista. */
        const nn = x => _normNomSimple(x).replace(/\s+/g, ' ');
        const codis = new Set(), noms = new Set();
        d.alumnes.forEach(a => {
          if (a.uid) codis.add(String(a.uid));
          else noms.add(nn(a.nom));            // sense codi: només pel nom
        });
        const filtrats = alumnes.filter(a => a.uid && codis.has(String(a.uid)) ? true : noms.has(nn(a.nom)));
        if (filtrats.length) alumnes = filtrats;
        _avisaNoTrobatsDesdob(grup, matNom, d.noTrobats);
      }
    }

    if (alumnes.length) {
      try { localStorage.setItem(cacheKey, JSON.stringify({ alumnes, ts: Date.now() })); } catch(e) {}
    }
    return alumnes;
  } catch(e) { return []; }
}
