/* ============================================================
   ON ÉS CADA MESTRE — horariclaustre.js
   ------------------------------------------------------------
   Per a direcció: busques un mestre i et diu què està fent en
   aquell moment —quina assignatura i a quin grup— o si té
   permanència i, per tant, el pots anar a trobar.

   A sota, la llista de qui té permanència ARA: qui està
   disponible sense haver de buscar-lo un per un.

   NOMÉS a l'app de DIRECCIÓ, dins de l'apartat Docents.

   ------------------------------------------------------------
   D'ON SURTEN LES DADES

   Del PDF d'horaris que passa l'escola («26-27 Horaris
   mestres.pdf»), que porta una pàgina per mestra. El llegeix el
   navegador amb `js/pdfhorari.js` —el mateix lector que fa
   servir cada mestra per omplir-se el seu horari— i el resultat
   es desa al full de grups COMPARTIT: l'adjunta un director i
   el veuen tots, sense tornar-ho a fer.

   ⚠ AIXÒ ÉS LA PLANTILLA DEL CURS, NO EL DIA A DIA. No sap res
   de substitucions, de sortides ni de baixes. Diu el que TOCA,
   que no sempre és el que passa, i la pantalla ho ha de dir
   sempre: si no, algú hi confiarà un dia que no toca.

   ------------------------------------------------------------
   LA «P» ÉS LA PERMANÈNCIA

   Als 36 horaris del curs 26-27 la casella «P» hi surt 143
   cops: és, de molt, el valor més repetit i no apareix mai ni a
   l'esbarjo ni al dinar. És l'estona que el mestre és a
   l'escola sense classe.

   ⚠ UNA CASELLA BUIDA NO ÉS UNA «P», i aquí no es barregen. Al
   PDF hi ha caselles sense res (a qui no fa jornada sencera,
   per exemple), i dir que aquell mestre «està disponible»
   faria baixar un director a buscar algú que no hi és. A la
   llista de permanències hi van NOMÉS les «P»; les buides es
   diuen a part i amb unes altres paraules.
   ============================================================ */

/* Les vuit franges, amb l'hora d'inici i de final en minuts. Són les
   mateixes del PDF i les mateixes de PLAN_FRANGES; aquí hi van els
   números perquè cal saber quina toca ARA. */
const HORCLA_FRANGES = [
  { id: 'f1', de: 8 * 60 + 50, a: 9 * 60 + 45,  hora: '08:50 – 09:45' },
  { id: 'f2', de: 9 * 60 + 45, a: 10 * 60 + 40, hora: '09:45 – 10:40' },
  { id: 'f3', de: 10 * 60 + 40, a: 11 * 60 + 10, hora: '10:40 – 11:10', fora: 'Esbarjo' },
  { id: 'f4', de: 11 * 60 + 10, a: 12 * 60,      hora: '11:10 – 12:00' },
  { id: 'f5', de: 12 * 60,      a: 12 * 60 + 50, hora: '12:00 – 12:50' },
  { id: 'f6', de: 12 * 60 + 50, a: 14 * 60 + 50, hora: '12:50 – 14:50', fora: 'Dinar' },
  { id: 'f7', de: 14 * 60 + 50, a: 15 * 60 + 50, hora: '14:50 – 15:50' },
  { id: 'f8', de: 15 * 60 + 50, a: 16 * 60 + 50, hora: '15:50 – 16:50' },
];

const HORCLA_DIES = [
  { id: 'dl', nom: 'Dilluns' }, { id: 'dm', nom: 'Dimarts' }, { id: 'dc', nom: 'Dimecres' },
  { id: 'dj', nom: 'Dijous' },  { id: 'dv', nom: 'Divendres' },
];

let _horClaMestres  = [];     // [{ nom, tutoria, cel:{dia_franja: text} }]
let _horClaInfo     = {};     // { curs, actualitzat, per }
let _horClaCarregat = false;
let _horClaCerca    = '';
let _horClaObert    = null;   // el nom del mestre que té la fitxa desplegada
let _horClaQuan     = null;   // { data:'2026-10-15', dia:'dc', franja:'f4' } — null = ara mateix
let _horClaPagines  = [];     // les pàgines del PDF que s'està adjuntant

/* ============================================================
   CÀRREGA
   ============================================================ */
async function initHorariClaustre() {
  if (typeof _rolDireccio === 'function' && !_rolDireccio()) return;
  /* Els horaris que venen amb l'app, abans de res: així la pantalla ja
     serveix d'entrada, encara que l'app no estigui connectada o el
     servidor trigui. Si al full compartit n'hi ha uns altres, els
     substitueixen en un segon. */
  if (!_horClaCarregat && !_horClaMestres.length) _horClaPosaBase();
  renderHorariClaustre();
  if (_horClaCarregat || !config.scriptUrl) return;
  await horClaCarrega();
}

async function horClaCarrega() {
  if (!config.scriptUrl) {
    /* Sense connexió, els horaris que venen amb l'app ja es veuen. L'avís
       hi és igualment: sense connectar no se'n podran adjuntar de nous ni
       es veuran els que hagi penjat l'altre director. */
    _horClaPosaBase();
    _horClaEstat('Encara no estàs connectat: el que veus són els horaris que venen amb l\'app. Ves a Configuració i enganxa la URL per veure si n\'hi ha de més nous.', 'error');
    renderHorariClaustre();
    return;
  }
  _horClaEstat('Llegint l\'horari del claustre…');
  try {
    const r = await appsScriptGet({ action: 'loadHorariClaustre', _fons: true });
    if (!r || !r.ok) throw new Error((r && r.error) || 'resposta buida');
    if (r.mestres && r.mestres.length) {
      _horClaMestres = r.mestres;
      _horClaInfo = { curs: r.curs || '', actualitzat: r.actualitzat || '', per: r.per || '' };
    } else {
      _horClaPosaBase();
    }
    _horClaCarregat = true;
    _horClaEstat('');
  } catch (e) {
    /* Si el servidor no respon però l'app porta els horaris a dins, val
       més ensenyar-los que deixar la pantalla buida: són els del curs i
       no caduquen cada dia. L'error es diu igualment. */
    _horClaPosaBase();
    _horClaEstat(_horClaDiuError(e, 'llegir'), 'error');
  }
  renderHorariClaustre();
}

/* ⚠ EL SERVIDOR VELL NO TÉ AQUESTA EINA, I S'HA DE DIR AMB PARAULES QUE
   NO FACIN ANAR NINGÚ A L'APPS SCRIPT. Les dues accions són noves al
   servidor: amb el d'abans, la resposta és «Accio desconeguda», que no
   diu enlloc què s'ha de fer.

   Qui ho llegeix NO ho ha d'arreglar ella: només avisar en Pol. Aquí no
   s'hi expliquen els passos a posta —la norma del projecte és que, un
   cop instal·lada l'app, cap mestra no torni a obrir mai l'editor—, i
   eines/comprova-molestar.js ho vigila.

   Tampoc no s'ha pujat el BACKEND_MINIM: faria sortir la franja groga
   de «servidor endarrerit» a tot el claustre —tutors i especialistes
   inclosos— per una eina que només té direcció, i aquell avís deixaria
   de voler dir res (veure js/versio.js). L'avís, doncs, es dona aquí i
   només a qui li fa falta. */
function _horClaDiuError(e, què) {
  const txt = String((e && e.message) || e || '');
  if (/desconeguda/i.test(txt)) {
    return 'Aquesta eina encara no està activada al teu servidor. Avisa en Pol i te la deixarà a punt: ' +
           'no l\'has de fer tu. Mentrestant, la resta de l\'app funciona igual.';
  }
  return 'No s\'ha pogut ' + què + ': ' +
    (typeof errorHuma === 'function' ? errorHuma(e) : txt) +
    '. Clica Actualitzar per tornar-ho a provar.';
}

/* ELS HORARIS QUE JA VENEN AMB L'APP.
   ------------------------------------------------------------
   En Pol, 15/10/2026: «que els directors ja ho tinguin penjat, que no
   hagin de penjar res». Si ningú no n'ha adjuntat cap de nou, es fan
   servir els que porta l'app (js/horariclaustre-dades.js).

   El que hi ha al full compartit MANA sempre: el dia que algú hi
   adjunti un PDF nou, aquell substitueix aquests i ja no es tornen a
   mirar. Així els horaris d'un curs vell no ressusciten.

   A les apps que no són de direcció el fitxer de dades hi és buit, i
   llavors això no fa res (veure NOMES_DIRECCIO a eines/_compara.js). */
function _horClaPosaBase() {
  const base = (typeof window !== 'undefined' && window.HORCLA_DADES) || null;
  if (!base || !base.mestres || !base.mestres.length) { _horClaMestres = []; _horClaInfo = {}; return; }
  _horClaMestres = base.mestres;
  _horClaInfo = { curs: base.curs || '', actualitzat: '', per: '', deLApp: true };
}

async function horClaActualitza() {
  _horClaCarregat = false;
  await horClaCarrega();
}

function _horClaEstat(text, tipus) {
  const el = document.getElementById('horClaEstat');
  if (!el) return;
  el.textContent = text || '';
  el.className = 'esm-estat' + (tipus ? ' is-' + tipus : '');
}

/* ============================================================
   QUIN MOMENT S'ESTÀ MIRANT
   ============================================================ */

/* Ara mateix: el dia de la setmana i la franja que toca.
   `fora` vol dir que en aquest moment no hi ha classe (cap de setmana,
   abans de les 8:50, després de les 16:50, l'esbarjo o el dinar): llavors
   es proposa una franja, però la pantalla ho diu ben clar. */
function horClaAra() {
  const ara = new Date();
  const jsDia = ara.getDay();              // 0 diumenge … 6 dissabte
  const minuts = ara.getHours() * 60 + ara.getMinutes();
  const capDeSetmana = (jsDia === 0 || jsDia === 6);
  const dia = capDeSetmana ? 'dl' : HORCLA_DIES[jsDia - 1].id;

  if (capDeSetmana) return { dia: dia, franja: 'f1', fora: 'cap de setmana', data: _horClaAvuiISO() };
  if (minuts < HORCLA_FRANGES[0].de) return { dia: dia, franja: 'f1', fora: 'encara no han començat les classes', data: _horClaAvuiISO() };
  const ultima = HORCLA_FRANGES[HORCLA_FRANGES.length - 1];
  if (minuts >= ultima.a) return { dia: dia, franja: ultima.id, fora: 'les classes ja s\'han acabat', data: _horClaAvuiISO() };

  const f = HORCLA_FRANGES.filter(x => minuts >= x.de && minuts < x.a)[0] || HORCLA_FRANGES[0];
  return { dia: dia, franja: f.id, fora: f.fora ? f.fora.toLowerCase() : '', data: _horClaAvuiISO() };
}

function _horClaAvuiISO() {
  const d = new Date();
  const p = n => (n < 10 ? '0' : '') + n;
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

// El moment que s'està mirant: el que hagi triat, o ara mateix.
function horClaQuan() {
  return _horClaQuan || horClaAra();
}

// De '2026-10-15' al dia de la setmana ('dc'), o null si és cap de setmana.
function _horClaDiaDeData(iso) {
  const p = String(iso || '').split('-');
  if (p.length < 3) return null;
  const d = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
  if (isNaN(d.getTime())) return null;
  const n = d.getDay();
  if (n === 0 || n === 6) return null;
  return HORCLA_DIES[n - 1].id;
}

function horClaTornaAra() {
  _horClaQuan = null;
  renderHorariClaustre();
}

/* El «no hi ha classe» d'un moment TRIAT a mà. Es calcula, no s'arrossega:
   si es guardés el de l'estona d'abans, triar l'esbarjo al desplegable no
   diria res i la pantalla ensenyaria una hora buida sense explicar per què
   ho és. */
function _horClaForaDe(dia, fid) {
  if (!dia) return 'cap de setmana';
  const f = HORCLA_FRANGES.filter(x => x.id === fid)[0];
  return (f && f.fora) ? f.fora.toLowerCase() : '';
}

function horClaCanviaData(iso) {
  const dia = _horClaDiaDeData(iso);
  const q = horClaQuan();
  /* Un dissabte o un diumenge no tenen horari. Es deixa triar igualment
     —val més dir-li per què no hi ha res que no pas no deixar-l'hi
     clicar— i s'ensenya el DILLUNS, amb l'avís ben clar a sobre.

     ⚠ Abans es deixava sense dia i no s'ensenyava res, però l'avís deia
     «el que es veu aquí sota és l'hora de 12:00 d'un dilluns» i a sota
     no hi havia res: prometia una cosa que no hi era. Ara fa el mateix
     que quan s'obre l'app en cap de setmana, que ja proposava el
     dilluns: una sola manera de comportar-se, i l'avís diu la veritat. */
  _horClaQuan = { data: iso, dia: dia || 'dl', franja: q.franja, fora: _horClaForaDe(dia, q.franja) };
  renderHorariClaustre();
}

function horClaCanviaFranja(fid) {
  const q = horClaQuan();
  _horClaQuan = { data: q.data, dia: q.dia, franja: fid, fora: _horClaForaDe(q.dia, fid) };
  renderHorariClaustre();
}

/* ============================================================
   QUÈ FA CADA MESTRE
   ============================================================ */

/* Els cursos tal com s'escriuen aquí: 1r 2n 3r 4t 5è 6è, amb la lletra
   del grup si n'hi ha. Serveix per treure «2n C» de dins d'«Educació
   física 2n C». */
const HORCLA_RE_GRUP = /(1r|2n|3r|4t|5è|6è)\s*([ABC])?\b/g;

/* Les caselles que NO són una classe amb nens: reunions i coordinació.
   ⚠ Aquí el número no és una aula, és un equip: «Reunió equip 2n» vol dir
   l'equip de 2n, no la classe de 2n. Si se'n digués el grup, la Laura
   sortiria «Coordinació · a 1r A» i un director se'n baixaria a 1r A a
   buscar-la, que és just el que aquesta eina ha d'evitar.

   ⚠ El final és `(\s|$)` i no pas `\b` a posta: `\b` mira el pas d'una
   lletra a una no-lletra, i per a una expressió regular la «ó» NO és
   lletra. «Coordinació» sol, doncs, no hi casava, i la Laura seguia
   sortint «a 1r A». */
const HORCLA_RE_REUNIO = /^(reuni[óo]|coordinaci[óo])(\s|$)/i;

/* Què hi diu, la casella d'aquest mestre en aquest moment.
   estat: 'classe' | 'permanencia' | 'buit' */
function horClaQueFa(m, dia, franja) {
  const v = String(((m && m.cel) || {})[dia + '_' + franja] || '').trim();
  if (!v) return { estat: 'buit' };
  if (v === 'P') return { estat: 'permanencia' };
  if (HORCLA_RE_REUNIO.test(v)) return { estat: 'classe', text: v, grup: '', reunio: true };
  return { estat: 'classe', text: v, grup: _horClaGrupDe(v, m) };
}

/* A quin grup. Primer, el que digui la mateixa casella («Educació física
   2n C», «Ed. Artística Música (6è A)»); si no en diu cap i el mestre és
   tutor, és la seva classe: a l'horari d'un tutor les assignatures de la
   seva tutoria van sense posar-hi el grup. Si no se'n pot saber res, no
   se n'inventa cap. */
function _horClaGrupDe(text, m) {
  HORCLA_RE_GRUP.lastIndex = 0;
  let trobat = null, x;
  while ((x = HORCLA_RE_GRUP.exec(text)) !== null) {
    trobat = x[1] + (x[2] ? ' ' + x[2] : '');
  }
  if (trobat) return trobat;
  return horClaTutoriaDe(m) || '';
}

// De «Tutoria 1r A» a «1r A». Torna '' per a qui no és tutor.
function horClaTutoriaDe(m) {
  const t = String((m && m.tutoria) || '').replace(/^Tutoria\s*/i, '').trim();
  return t;
}

/* L'assignatura sense el grup: «Educació física 2n C» → «Educació
   física». Si després de treure'l no en queda res (una casella que només
   diu «1r»), es deixa el text tal com és. */
function horClaAssignaturaDe(text) {
  const net = String(text || '').replace(HORCLA_RE_GRUP, '').replace(/\(\s*\)/g, '').replace(/\s+/g, ' ').trim();
  return net || String(text || '').trim();
}

/* ============================================================
   BUSCAR UN MESTRE
   ============================================================ */

// Sense accents i en minúscules, per poder buscar «nuria» i trobar «NÚRIA».
function _horClaNet(s) {
  return String(s || '').toLowerCase()
    .normalize('NFD').replace(new RegExp('[̀-ͯ]', 'g'), '')
    .replace(/\s+/g, ' ').trim();
}

function horClaCerca(q) {
  _horClaCerca = q || '';
  _horClaObert = null;
  _horClaPintaResultats();
}

/* Els mestres que casen amb el que s'ha escrit. Es busca per qualsevol
   tros del nom («molas» troba la Núria Molas i la Maria Molas) i també
   pel grup que tutoritza, que de vegades és el que un recorda. */
function horClaCoincidents() {
  const q = _horClaNet(_horClaCerca);
  if (!q) return [];
  return _horClaMestres.filter(m => {
    const dins = _horClaNet((m.nom || '') + ' ' + (m.tutoria || ''));
    return dins.indexOf(q) !== -1;
  }).sort((a, b) => String(a.nom).localeCompare(String(b.nom), 'ca'));
}

function horClaObre(nom) {
  _horClaObert = (_horClaObert === nom) ? null : nom;
  _horClaPintaResultats();
}

/* ============================================================
   LA PANTALLA
   ============================================================ */
function renderHorariClaustre() {
  _horClaPintaQuan();
  _horClaPintaResultats();
  _horClaPintaPermanencies();
  _horClaPintaPeu();
}

/* --- El selector de dia i hora --- */
function _horClaPintaQuan() {
  const cont = document.getElementById('horClaQuan');
  if (!cont) return;
  if (!_horClaMestres.length) { cont.innerHTML = ''; return; }

  const q = horClaQuan();
  const esAra = !_horClaQuan;
  const f = HORCLA_FRANGES.filter(x => x.id === q.franja)[0] || HORCLA_FRANGES[0];
  const diaNom = (HORCLA_DIES.filter(d => d.id === q.dia)[0] || {}).nom || '';

  cont.innerHTML = `
    <div class="horcla-quan">
      <div class="horcla-quan-camps">
        <label class="horcla-camp">
          <span class="horcla-camp-nom">Dia</span>
          <input class="modal-input" type="date" id="horClaData" value="${escapeHtml(q.data || '')}"
                 onchange="horClaCanviaData(this.value)">
        </label>
        <label class="horcla-camp">
          <span class="horcla-camp-nom">Hora</span>
          <select class="modal-input" id="horClaFranja" onchange="horClaCanviaFranja(this.value)">
            ${HORCLA_FRANGES.map(x => `<option value="${x.id}"${x.id === q.franja ? ' selected' : ''}>${escapeHtml(x.hora)}${x.fora ? ' · ' + escapeHtml(x.fora) : ''}</option>`).join('')}
          </select>
        </label>
        ${esAra ? '' : `<button class="btn btn-ghost horcla-ara" type="button" onclick="horClaTornaAra()">Tornar a ara mateix</button>`}
      </div>
      <p class="horcla-quan-diu">
        ${esAra ? '<strong>Ara mateix</strong> · ' : ''}${escapeHtml(diaNom || 'Cap de setmana')}${diaNom ? ' · ' + escapeHtml(f.hora) : ''}
      </p>
      ${q.fora ? `<div class="callout-app warn"><strong>En aquest moment no hi ha classe:</strong> ${escapeHtml(q.fora)}. El que es veu aquí sota és l'hora de ${escapeHtml(f.hora)}${q.fora === 'cap de setmana' ? ' d\'un dilluns' : ''}.</div>` : ''}
    </div>`;
}

/* --- El cercador i el que en surt --- */
function _horClaPintaResultats() {
  const cont = document.getElementById('horClaResultats');
  if (!cont) return;

  if (!_horClaMestres.length) { cont.innerHTML = ''; return; }
  if (!_horClaCerca.trim()) { cont.innerHTML = ''; return; }

  const q = horClaQuan();
  const trobats = horClaCoincidents();

  if (!trobats.length) {
    cont.innerHTML = `<div class="esm-buit"><p><strong>Cap mestre amb «${escapeHtml(_horClaCerca)}»</strong><br>
      Prova amb el cognom, o amb un grup com ara «3r B».</p></div>`;
    return;
  }

  // Sense dia (cap de setmana) no es pot dir què fa ningú.
  if (!q.dia) {
    cont.innerHTML = `<div class="esm-buit"><p><strong>${trobats.length === 1 ? 'Un mestre trobat' : trobats.length + ' mestres trobats'}.</strong><br>
      Tria un dia de dilluns a divendres per veure què fan.</p></div>`;
    return;
  }

  cont.innerHTML = `<div class="horcla-resultats">${trobats.map(m => {
    const fa = horClaQueFa(m, q.dia, q.franja);
    const obert = _horClaObert === m.nom;
    return `<div class="horcla-fitxa horcla-${fa.estat}${obert ? ' es-obert' : ''}">
      <button type="button" class="horcla-fitxa-cap" aria-expanded="${obert}" onclick="horClaObre('${_idJs(m.nom)}')">
        <span class="horcla-nom">${escapeHtml(_horClaNomCurt(m.nom))}</span>
        ${horClaTutoriaDe(m) ? `<span class="horcla-tut">Tutor de ${escapeHtml(horClaTutoriaDe(m))}</span>` : '<span class="horcla-tut">Especialista</span>'}
        <span class="horcla-ara-diu">${_horClaFrase(fa)}</span>
      </button>
      ${obert ? _horClaDiaSencer(m, q.dia) : ''}
    </div>`;
  }).join('')}</div>`;
}

/* La frase que ho diu tot d'un cop d'ull. És el que es ve a saber:
   es pot anar a trobar ara, o no. */
function _horClaFrase(fa) {
  if (fa.estat === 'permanencia') return '<strong class="horcla-lliure">Permanència</strong> · el pots anar a trobar';
  if (fa.estat === 'buit') return '<span class="horcla-nores">A l\'horari no hi té res apuntat en aquesta hora</span>';
  return '<strong>' + escapeHtml(_horClaTextDe(fa)) + '</strong>' + (fa.grup ? ' · a ' + escapeHtml(fa.grup) : '');
}

/* El que es llegeix a la pantalla. D'una classe se'n treu el grup, que ja
   es diu a part; d'una reunió es deixa el text sencer, perquè «Reunió
   equip 2n» sense el «2n» no diu quina reunió és. */
function _horClaTextDe(fa) {
  return fa.reunio ? String(fa.text || '') : horClaAssignaturaDe(fa.text);
}

/* De «LAURA VILA MAJÓ» a «Laura Vila Majó»: a la pantalla, tot en
   majúscules crida massa i costa més de llegir. */
function _horClaNomCurt(nom) {
  return String(nom || '').toLowerCase().replace(/(^|[\s'·-])([a-zà-öø-þ])/g, (t, a, b) => a + b.toUpperCase());
}

/* El dia sencer d'un mestre, perquè un director pugui veure d'un cop
   quan el tindrà lliure si ara no pot ser. */
function _horClaDiaSencer(m, dia) {
  const q = horClaQuan();
  const files = HORCLA_FRANGES.map(f => {
    const fa = horClaQueFa(m, dia, f.id);
    const ara = f.id === q.franja;
    let diu;
    if (f.fora) diu = `<span class="horcla-nores">${escapeHtml(f.fora)}</span>`;
    else if (fa.estat === 'permanencia') diu = '<strong class="horcla-lliure">Permanència</strong>';
    else if (fa.estat === 'buit') diu = '<span class="horcla-nores">—</span>';
    else diu = escapeHtml(_horClaTextDe(fa)) + (fa.grup ? ` <span class="horcla-grup">${escapeHtml(fa.grup)}</span>` : '');
    return `<tr${ara ? ' class="es-ara"' : ''}><th scope="row">${escapeHtml(f.hora)}</th><td>${diu}</td></tr>`;
  }).join('');
  const diaNom = (HORCLA_DIES.filter(d => d.id === dia)[0] || {}).nom || '';
  return `<div class="horcla-dia">
    <p class="horcla-dia-tit">Tot el ${escapeHtml(diaNom.toLowerCase())}</p>
    <table class="horcla-taula"><tbody>${files}</tbody></table>
  </div>`;
}

/* --- Qui té permanència ara --- */
function _horClaPintaPermanencies() {
  const cont = document.getElementById('horClaPermanencies');
  if (!cont) return;
  if (!_horClaMestres.length) { cont.innerHTML = ''; return; }

  const q = horClaQuan();
  if (!q.dia) { cont.innerHTML = ''; return; }

  const lliures = _horClaMestres.filter(m => horClaQueFa(m, q.dia, q.franja).estat === 'permanencia')
    .sort((a, b) => String(a.nom).localeCompare(String(b.nom), 'ca'));
  const buits = _horClaMestres.filter(m => horClaQueFa(m, q.dia, q.franja).estat === 'buit').length;

  const f = HORCLA_FRANGES.filter(x => x.id === q.franja)[0] || HORCLA_FRANGES[0];

  cont.innerHTML = `
    <section class="horcla-perm">
      <div class="horcla-perm-cap">
        <h2 class="horcla-perm-tit">En permanència</h2>
        <span class="horcla-perm-sub">${escapeHtml(f.hora)}${f.fora ? ' · ' + escapeHtml(f.fora) : ''}</span>
      </div>
      ${lliures.length ? `<ul class="horcla-perm-llista">${lliures.map(m => `
        <li><button type="button" onclick="horClaTriaDeLlista('${_idJs(m.nom)}')">
          <span class="horcla-perm-nom">${escapeHtml(_horClaNomCurt(m.nom))}</span>
          <span class="horcla-perm-rol">${horClaTutoriaDe(m) ? 'Tutor de ' + escapeHtml(horClaTutoriaDe(m)) : 'Especialista'}</span>
        </button></li>`).join('')}</ul>`
      : `<p class="modal-hint">En aquesta hora no hi ha ningú amb permanència.</p>`}
      ${buits ? `<p class="modal-hint">I ${buits === 1 ? 'un mestre no té' : buits + ' mestres no tenen'} res apuntat en aquesta hora: no vol dir que ${buits === 1 ? 'estigui' : 'estiguin'} disponible${buits === 1 ? '' : 's'}, sinó que l'horari no ho diu.</p>` : ''}
    </section>`;
}

/* Clicar algú de la llista de permanències és com haver-lo escrit al
   cercador: a sobre se li obre la fitxa amb el dia sencer. El cercador i
   el que s'ha buscat han de dir el MATEIX, o la mestra veuria un nom a
   la casella i un altre a la cerca. */
function horClaTriaDeLlista(nom) {
  const net = _horClaNomCurt(nom);
  const el = document.getElementById('horClaCercaInput');
  if (el) { el.value = net; el.focus(); }
  horClaCerca(net);
  horClaObre(nom);
}

/* --- El peu: d'on surt i quan es va adjuntar --- */
function _horClaPintaPeu() {
  const cont = document.getElementById('horClaPeu');
  if (!cont) return;

  if (!_horClaMestres.length) {
    cont.innerHTML = `<div class="esm-buit">
      <p><strong>Encara no hi ha cap horari adjuntat.</strong><br>
      Clica <strong>Adjuntar el PDF</strong> i tria el fitxer d'horaris que passa l'escola
      (el que porta una pàgina per mestra). Només cal fer-ho un cop: la resta de l'equip
      directiu ja el veurà.</p></div>`;
    return;
  }

  /* D'on surten: els que venen amb l'app, o els que algú hi ha adjuntat.
     S'ha de distingir, o ningú no sabrà mai si el que veu és d'aquest curs
     o d'un PDF que es va penjar fa mesos. */
  const d = _horClaInfo.deLApp
    ? `${_horClaMestres.length} mestres${_horClaInfo.curs ? ' · curs ' + escapeHtml(_horClaInfo.curs) : ''} · venen amb l'app. Si l'escola en reparteix de nous, adjunta'ls amb el botó de dalt.`
    : `${_horClaMestres.length} mestres${_horClaInfo.curs ? ' · curs ' + escapeHtml(_horClaInfo.curs) : ''}${_horClaInfo.actualitzat ? ' · adjuntat el ' + escapeHtml(_horClaInfo.actualitzat) : ''}${_horClaInfo.per ? ' per ' + escapeHtml(_horClaInfo.per) : ''}.`;

  cont.innerHTML = `
    <div class="callout-app warn">
      <strong>Això és l'horari del curs, no el d'avui.</strong> No sap res de substitucions,
      de sortides ni de baixes: diu el que <em>toca</em>, que no sempre és el que passa.
    </div>
    <p class="modal-hint">${d}</p>`;
}

/* ============================================================
   ADJUNTAR EL PDF DE L'ESCOLA
   ============================================================ */
function horClaObrePdf() {
  _horClaPagines = [];
  const f = document.getElementById('horClaFitxer');
  if (f) f.value = '';
  const previ = document.getElementById('horClaPdfPrevi');
  if (previ) previ.innerHTML = '<p class="modal-hint">Tria el PDF d\'horaris de l\'escola: el que porta una pàgina per mestra.</p>';
  const btn = document.getElementById('horClaPdfBtn');
  if (btn) btn.disabled = true;
  document.getElementById('horClaPdfOverlay').classList.add('open');
}

function tancaHorClaPdf() {
  document.getElementById('horClaPdfOverlay').classList.remove('open');
}

async function _horClaLlegeixPdf(fitxer) {
  if (!fitxer) return;
  const previ = document.getElementById('horClaPdfPrevi');
  const btn = document.getElementById('horClaPdfBtn');
  previ.innerHTML = '<p class="modal-hint">Llegint el PDF…</p>';
  btn.disabled = true;
  try {
    const dades = await fitxer.arrayBuffer();
    const r = await esperaVisual(pdfHorariLlegeix(dades), 'Llegint els horaris…');
    _horClaPagines = (r.pagines || []).filter(p => p.nom && Object.keys(p.cel || {}).length);
  } catch (e) {
    previ.innerHTML = '<p class="modal-hint" style="color:var(--crimson)">' +
      escapeHtml((e && e.message) || 'No he pogut llegir el PDF') + '</p>';
    return;
  }

  if (!_horClaPagines.length) {
    previ.innerHTML = '<p class="modal-hint" style="color:var(--crimson)">' +
      'No hi he trobat cap horari amb nom. Comprova que sigui el PDF d\'horaris de l\'escola, ' +
      'el que porta una pàgina per mestra.</p>';
    return;
  }

  /* Es veu QUI hi ha abans de desar res: és l'única manera que un
     director s'adoni que ha adjuntat el PDF d'un altre curs o que
     n'hi falta mig claustre. */
  const ambTut = _horClaPagines.filter(p => p.tutoria).length;
  previ.innerHTML = `
    <p class="modal-hint"><strong>${_horClaPagines.length} mestres</strong> al PDF, ${ambTut} amb tutoria.
    Repassa que hi siguin tots abans de desar-ho.</p>
    <div class="horcla-previ">${_horClaPagines.map(p =>
      `<span class="horcla-previ-un">${escapeHtml(_horClaNomCurt(p.nom))}${p.tutoria ? ' <em>' + escapeHtml(horClaTutoriaDe(p)) + '</em>' : ''}</span>`
    ).join('')}</div>`;
  btn.disabled = false;
}

async function horClaDesaPdf() {
  if (!_horClaPagines.length) return;
  const btn = document.getElementById('horClaPdfBtn');
  btn.disabled = true;
  const jo = (typeof _perfil !== 'undefined' && _perfil && _perfil.nom) ? _perfil.nom : '';
  const curs = (document.getElementById('horClaCurs') || {}).value || '';
  try {
    const r = await esperaVisual(appsScriptPost({
      action: 'saveHorariClaustre',
      mestres: _horClaPagines.map(p => ({ nom: p.nom, tutoria: p.tutoria || '', cel: p.cel })),
      curs: curs,
      per: jo,
    }), 'Desant l\'horari del claustre…');
    if (!r || !r.ok) throw new Error((r && r.error) || 'no s\'ha pogut desar');
    tancaHorClaPdf();
    _horClaCarregat = false;
    await horClaCarrega();
    _horClaEstat('Horari desat: ' + _horClaMestres.length + ' mestres. Tot l\'equip directiu ja el veu.', 'ok');
  } catch (e) {
    const previ = document.getElementById('horClaPdfPrevi');
    if (previ) previ.innerHTML = '<p class="modal-hint" style="color:var(--crimson)">' +
      escapeHtml(_horClaDiuError(e, 'desar')) + '</p>';
    btn.disabled = false;
  }
}
