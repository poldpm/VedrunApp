/* ============================================================
   DOCENTS — docents.js
   ------------------------------------------------------------
   El claustre de primària: qui és tutor de cada grup, qui són
   les especialistes, qui coordina cada cicle, qui és de l'equip
   directiu i qui és de l'equip SIEI.

   NOMÉS a l'app de DIRECCIÓ (`esDireccio()`). Als tutors i a les
   especialistes ni l'apartat ni el botó del menú hi surten.

   ⚠ LES DADES SÓN AQUÍ, AL CODI, I ÉS A POSTA.
   És la mateixa llista per a tota l'escola i canvia un cop l'any,
   com el calendari escolar. Tenir-la aquí vol dir que no cal ni
   backend ni redesplegar el Code.gs: s'actualitza canviant
   `DOCENTS` aquí sota i passant `node eines/sync-totes.js`.

   Per actualitzar-la a principi de curs:
     · `grup` → el grup que tutoritza. Sense `grup` = especialista.
     · `coordina: true` → coordina el seu cicle.
     · `direccio: true` → equip directiu.
     · `siei: true` → equip SIEI (no van per cicle).
     · `email` → NOMÉS cal a qui és de coordinació o de direcció: és on
       li arriba el recordatori de l'esmorzar. Sense correu, l'eina de
       Coordinació ho diu i no envia res.

   Les funcions de sota (docentDelGrup, docentsDelCicle,
   coordinadorDelCicle…) són públiques a posta: d'aquí en poden
   sortir més eines sense haver de tornar a escriure la llista.
   ============================================================ */

// Els tres cicles de primària. Els colors són els que ja fan servir ells al
// document de l'escola: verd, blau i taronja. Aquí es fan servir suaus,
// perquè acompanyin i no es mengin el granat de l'app.
const DOCENTS_CICLES = [
  { id: 'c1', nom: 'Primer cicle',  cursos: ['1r', '2n'] },
  { id: 'c2', nom: 'Segon cicle',   cursos: ['3r', '4t'] },
  { id: 'c3', nom: 'Tercer cicle',  cursos: ['5è', '6è'] },
];

// El claustre. Curs 2026-27.
const DOCENTS = [
  /* --- Primer cicle --- */
  { nom: 'Laura Vila',       cicle: 'c1', grup: '1r A', coordina: true, email: 'lauravila@escorialvic.cat' },
  { nom: 'Carme Tria',       cicle: 'c1', grup: '1r B' },
  { nom: 'Marta Salarich',   cicle: 'c1', grup: '1r C' },
  { nom: 'Cristina Mataró',  cicle: 'c1', grup: '2n A' },
  { nom: 'Mireia Duran',     cicle: 'c1', grup: '2n B' },
  { nom: 'Pol del Pozo',     cicle: 'c1', grup: '2n C' },
  { nom: 'Sílvia Ferreira',  cicle: 'c1' },
  { nom: 'Meri Garolera',    cicle: 'c1' },
  { nom: 'Marta Peraire',    cicle: 'c1' },
  { nom: 'Sira Puig',        cicle: 'c1' },
  { nom: 'Roser Sierra',     cicle: 'c1' },
  { nom: 'Imma Solà',        cicle: 'c1' },
  { nom: 'Ester Verdaguer',  cicle: 'c1' },

  /* --- Segon cicle --- */
  { nom: 'Arnau Cirera',     cicle: 'c2', grup: '3r A', coordina: true, email: 'arnaucirera@escorialvic.cat' },
  { nom: 'Aida Riera',       cicle: 'c2', grup: '3r B' },
  { nom: 'Maria Molas',      cicle: 'c2', grup: '3r C' },
  { nom: 'Gemma Muntadas',   cicle: 'c2', grup: '4t A' },
  { nom: 'Tània Coll',       cicle: 'c2', grup: '4t B' },
  { nom: 'David Muntadas',   cicle: 'c2', grup: '4t C' },
  { nom: 'Núria Canals',     cicle: 'c2' },
  { nom: 'Eva Galik',        cicle: 'c2' },
  { nom: 'Glòria Prat',      cicle: 'c2' },
  { nom: 'Imma Valls',       cicle: 'c2', direccio: true, email: 'immavalls@escorialvic.cat' },
  { nom: 'Teresa Vilaregut', cicle: 'c2' },

  /* --- Tercer cicle --- */
  { nom: 'Lourdes Molet',    cicle: 'c3', grup: '5è A' },
  { nom: 'Albert Bertran',   cicle: 'c3', grup: '5è B' },
  { nom: 'Miquel Roquet',    cicle: 'c3', grup: '5è C' },
  { nom: 'Elisabeth Prat',   cicle: 'c3', grup: '6è A' },
  { nom: 'Carlos Lozano',    cicle: 'c3', grup: '6è B', coordina: true, email: 'carloslozano@escorialvic.cat' },
  { nom: 'Mariona Parareda', cicle: 'c3', grup: '6è C' },
  { nom: 'Montse Caballeria',cicle: 'c3' },
  { nom: 'Gerard Casas',     cicle: 'c3' },
  { nom: 'Nil Freixa',       cicle: 'c3', direccio: true, email: 'nilfreixa@escorialvic.cat' },
  { nom: 'Núria Molas',      cicle: 'c3' },
  { nom: 'Alba Serra',       cicle: 'c3' },
  { nom: 'Roser Pugès',      cicle: 'c3' },

  /* --- Equip SIEI (no va per cicle) --- */
  { nom: 'Hermínia Bau',     siei: true },
  { nom: 'Yousra Enniya',    siei: true },
  { nom: 'Griselda Riera',   siei: true },
  { nom: 'Berta Serra',      siei: true },
];

/* ============================================================
   CONSULTES — públiques a posta, per a les eines que vindran
   ============================================================ */

// El tutor d'un grup ("4t B"), o null si no en consta cap.
function docentDelGrup(grup) {
  if (!grup) return null;
  return DOCENTS.find(d => d.grup === grup) || null;
}

// Tots els docents d'un cicle ('c1', 'c2', 'c3').
function docentsDelCicle(cicleId) {
  return DOCENTS.filter(d => d.cicle === cicleId);
}

// A quin cicle és un curs ("3r" → 'c2'). Torna null si no ho sap.
function cicleDelCurs(curs) {
  const c = DOCENTS_CICLES.find(x => x.cursos.indexOf(curs) !== -1);
  return c ? c.id : null;
}

// A quin cicle és un grup ("3r A" → 'c2').
function cicleDelGrup(grup) {
  return cicleDelCurs(String(grup || '').split(' ')[0]);
}

// Qui coordina un cicle.
function coordinadorDelCicle(cicleId) {
  return DOCENTS.find(d => d.cicle === cicleId && d.coordina) || null;
}

// L'equip directiu.
function docentsDireccio() { return DOCENTS.filter(d => d.direccio); }

// L'equip SIEI.
function docentsSIEI() { return DOCENTS.filter(d => d.siei); }

// Què és aquest docent, en una paraula. Un mateix pot ser més d'una cosa
// (l'Imma Valls és especialista I de l'equip directiu): això és el que fa
// dins de l'aula, i els distintius de sota hi afegeixen la resta.
function docentTipus(d) {
  if (!d) return '';
  if (d.siei) return 'siei';
  return d.grup ? 'tutor' : 'especialista';
}

// Els distintius que li toquen ("Coordinació de cicle", "Equip directiu"…).
// Sense gènere a posta: la llista té homes i dones i no cal endevinar-ho.
function docentDistintius(d) {
  const out = [];
  if (d.coordina) out.push({ clau: 'coordina', text: 'Coordinació de cicle' });
  if (d.direccio) out.push({ clau: 'direccio', text: 'Equip directiu' });
  if (d.siei)     out.push({ clau: 'siei',     text: 'Equip SIEI' });
  return out;
}

/* ============================================================
   L'APARTAT DOCENTS — la portada amb les eines
   ------------------------------------------------------------
   Docents no és una llista: és el lloc on hi ha tot el que té a
   veure amb el claustre. La portada són botons, i cada botó obre
   una eina dins de la mateixa pàgina. Per afegir-ne una de nova
   n'hi ha prou amb una entrada aquí sota i el seu contenidor a
   l'index.html.
   ============================================================ */

const DOCENTS_EINES = [
  {
    clau: 'llistat',
    titol: 'Llistat de docents',
    desc: 'Qui tutoritza cada grup, les especialistes de cada cicle i qui coordina.',
    icona: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  },
  {
    clau: 'coordinacio',
    titol: 'Coordinació',
    desc: 'Les reunions de l\'equip de coordinació. De moment, els esmorzars.',
    icona: '<path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>',
  },
  {
    clau: 'registres',
    titol: 'Registres',
    desc: 'El mateix que els registres d\'aula, però amb tot el claustre a les files.',
    icona: '<path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><path d="M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/>',
  },
  {
    clau: 'entrevistes',
    titol: 'Seguiment d\'entrevistes',
    desc: 'Quantes entrevistes ha fet cada tutor amb les famílies, i qui no en té cap.',
    icona: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 11l-3 3-2-2"/>',
  },
];

const _DOCENTS_CONT = { hub: 'docentsHub', llistat: 'docentsLlistat', coordinacio: 'docentsCoordinacio', registres: 'docentsRegistres', entrevistes: 'docentsEntrevistes' };
let _docentsVistaActual = 'hub';

function initDocents() {
  if (typeof _rolDireccio === 'function' && !_rolDireccio()) return;
  docentsVista(_docentsVistaActual, true);
}

/* Canvia d'eina dins de l'apartat. `_fromPop` vol dir que hi arribem pel
   botó d'enrere: llavors no s'afegeix una entrada nova a l'historial, o el
   gest d'enrere del mòbil es quedaria donant voltes. */
function docentsVista(vista, _fromPop) {
  if (!_DOCENTS_CONT[vista]) vista = 'hub';
  _docentsVistaActual = vista;
  Object.keys(_DOCENTS_CONT).forEach(k => {
    const el = document.getElementById(_DOCENTS_CONT[k]);
    if (el) el.style.display = (k === vista) ? '' : 'none';
  });
  if (!_fromPop) {
    try { history.pushState({ page: 'docents', vista: vista }, '', '#docents'); } catch(e) {}
  }
  if (vista === 'hub') _docentsRenderHub();
  if (vista === 'llistat') renderDocents();
  if (vista === 'coordinacio' && typeof initCoordinacio === 'function') initCoordinacio();
  if (vista === 'registres' && typeof initRegistreDocents === 'function') initRegistreDocents();
  if (vista === 'entrevistes' && typeof initSeguimentEntrevistes === 'function') initSeguimentEntrevistes();
}

function _docentsRenderHub() {
  const cont = document.getElementById('docentsHubEines');
  if (!cont) return;
  cont.innerHTML = DOCENTS_EINES.map(e =>
    `<button type="button" class="doc-eina" onclick="docentsVista('${e.clau}')">
       <svg class="doc-eina-icona" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">${e.icona}</svg>
       <span class="doc-eina-titol">${escapeHtml(e.titol)}</span>
       <span class="doc-eina-desc">${escapeHtml(e.desc)}</span>
     </button>`
  ).join('');
}

/* ============================================================
   EINA: LLISTAT DE DOCENTS
   ============================================================ */

let _docentsFiltre = 'tots';   // tots | tutors | especialistes | siei
let _docentsCerca  = '';

// Els docents que s'han de veure ara (filtre + cerca).
function _docentsVisibles() {
  const q = _docentsCerca.trim().toLowerCase();
  return DOCENTS.filter(d => {
    const tipus = docentTipus(d);
    if (_docentsFiltre === 'tutors'        && tipus !== 'tutor') return false;
    if (_docentsFiltre === 'especialistes' && tipus !== 'especialista') return false;
    if (_docentsFiltre === 'siei'          && tipus !== 'siei') return false;
    if (!q) return true;
    // Es busca pel nom i també pel grup: escrivint "4t B" surt el seu tutor.
    const dins = [d.nom, d.grup || '', ...docentDistintius(d).map(x => x.text)].join(' ').toLowerCase();
    return dins.indexOf(q) !== -1;
  });
}

function renderDocents() {
  const cont = document.getElementById('docentsLlista');
  if (!cont) return;

  const visibles = _docentsVisibles();
  _docentsPintaComptador(visibles);
  _docentsPintaFiltres();

  if (!visibles.length) {
    cont.innerHTML = `<div class="empty-page">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
      <p><strong>Cap docent amb «${escapeHtml(_docentsCerca)}»</strong><br>Prova amb el nom, o amb un grup com ara «4t B».</p>
    </div>`;
    return;
  }

  let html = '';
  DOCENTS_CICLES.forEach(c => {
    const delCicle = visibles.filter(d => d.cicle === c.id);
    if (!delCicle.length) return;
    const tutors = delCicle.filter(d => d.grup).sort((a, b) => a.grup.localeCompare(b.grup));
    const espec  = delCicle.filter(d => !d.grup).sort((a, b) => a.nom.localeCompare(b.nom, 'ca'));
    const coord  = coordinadorDelCicle(c.id);
    html += `<section class="doc-cicle doc-cicle-${c.id}">
      <div class="doc-cicle-head">
        <h2 class="doc-cicle-nom">${escapeHtml(c.nom)}</h2>
        <span class="doc-cicle-meta">${escapeHtml(c.cursos.join(' i '))}${coord ? ' · coordina ' + escapeHtml(coord.nom) : ''}</span>
      </div>
      ${tutors.length ? `<div class="doc-subtitol">Tutories</div><div class="doc-graella">${tutors.map(_docentCard).join('')}</div>` : ''}
      ${espec.length  ? `<div class="doc-subtitol">Especialistes</div><div class="doc-graella">${espec.map(_docentCard).join('')}</div>` : ''}
    </section>`;
  });

  const siei = visibles.filter(d => d.siei);
  if (siei.length) {
    html += `<section class="doc-cicle doc-cicle-siei">
      <div class="doc-cicle-head">
        <h2 class="doc-cicle-nom">Equip SIEI</h2>
        <span class="doc-cicle-meta">Suport intensiu a l'escola inclusiva</span>
      </div>
      <div class="doc-graella">${siei.map(_docentCard).join('')}</div>
    </section>`;
  }
  cont.innerHTML = html;
}

// La targeta d'un docent.
function _docentCard(d) {
  const inicials = d.nom.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const distintius = docentDistintius(d)
    .map(x => `<span class="doc-badge doc-badge-${x.clau}">${escapeHtml(x.text)}</span>`).join('');
  // Als tutors, un botó per anar directament als seus alumnes: és la feina
  // que direcció hi ve a fer (omplir el que falta d'un grup sense tutor a l'app).
  const accio = d.grup
    ? `<button type="button" class="doc-veure" onclick="docentsVeureGrup('${d.grup}')" title="Veure els alumnes de ${escapeHtml(d.grup)}">
         Veure els alumnes
       </button>`
    : '';
  return `<article class="doc-card">
    <div class="doc-card-top">
      <span class="doc-avatar" aria-hidden="true">${escapeHtml(inicials)}</span>
      <div class="doc-card-txt">
        <p class="doc-nom">${escapeHtml(d.nom)}</p>
        <p class="doc-rol">${d.grup ? 'Tutoria de <strong>' + escapeHtml(d.grup) + '</strong>' : (d.siei ? 'SIEI' : 'Especialista')}</p>
      </div>
    </div>
    ${distintius ? `<div class="doc-badges">${distintius}</div>` : ''}
    ${accio}
  </article>`;
}

function _docentsPintaComptador(visibles) {
  const el = document.getElementById('docentsCount');
  if (!el) return;
  const n = visibles.length;
  el.textContent = n === DOCENTS.length
    ? DOCENTS.length + ' docents'
    : n + ' de ' + DOCENTS.length;
}

function _docentsPintaFiltres() {
  const cont = document.getElementById('docentsFiltres');
  if (!cont) return;
  const opcions = [
    { clau: 'tots',          text: 'Tots' },
    { clau: 'tutors',        text: 'Tutories' },
    { clau: 'especialistes', text: 'Especialistes' },
    { clau: 'siei',          text: 'SIEI' },
  ];
  cont.innerHTML = opcions.map(o =>
    `<button type="button" class="doc-filtre${_docentsFiltre === o.clau ? ' active' : ''}" aria-pressed="${_docentsFiltre === o.clau}" onclick="docentsFiltra('${o.clau}')">${o.text}</button>`
  ).join('');
}

function docentsFiltra(clau) {
  _docentsFiltre = clau;
  renderDocents();
}

function docentsCerca(text) {
  _docentsCerca = text || '';
  renderDocents();
}

/* Del docent als seus alumnes. Carrega el grup (com si l'haguessin triat al
   selector d'Alumnes) i hi va. Així, veient que 4t B és de la Tània, hi
   poden entrar de seguida a completar el que falti. */
function docentsVeureGrup(grup) {
  if (!grup) return;
  if (typeof _dirCarregaGrup === 'function') _dirCarregaGrup(grup);
  if (typeof showPage === 'function') showPage('alumnes');
}
