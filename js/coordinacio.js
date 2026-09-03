/* ============================================================
   COORDINACIÓ — ELS ESMORZARS DE LA REUNIÓ — coordinacio.js
   ------------------------------------------------------------
   Cada setmana un membre de l'equip de coordinació porta
   l'esmorzar a la reunió. Aquí s'apunta qui li tocava, si l'ha
   portat i quina nota li han posat, i es veu qui és el millor
   esmorzaire i qui se n'oblida sempre.

   És una eina de broma, però les dades són de debò: van al full
   "Grups" COMPARTIT, no al full de qui ho apunta. Si anessin al
   personal, els dos directors tindrien cada un la seva llista i
   no coincidirien mai.

   NOMÉS a l'app de DIRECCIÓ, dins de l'apartat Docents.

   L'EQUIP surt sol de `js/docents.js`: qui coordina un cicle i
   qui és de l'equip directiu. Si un any canvien, es canvia allà
   i aquí ja hi surten els nous.
   ============================================================ */

// Quants gomets vermells fan una penyora.
const ESM_GOMETS_PENYORA = 3;

// Registres: { id, data:'2026-09-03', qui:'Nil Freixa', portat:bool, nota:1..10, que:'…' }
let _esmorzars = [];
// Torns apuntats: { id, data:'2026-09-15' (el dia de la reunió), qui, avisat:'' }
let _torns = [];
let _esmCarregat = false;
let _esmDesant = false;

// La proposta que s'està mirant ara al botó "qui li toca la setmana que ve"
let _esmProposta = null;   // { qui, data, saltats:[noms ja descartats] }

// Què hi ha ara al formulari
let _esmForm = { qui: '', data: '', portat: null, nota: null };

/* L'equip de coordinació: els 3 coordinadors de cicle i els 2 de l'equip
   directiu. Es dedueix del claustre, no s'escriu dues vegades. */
function coordEquip() {
  if (typeof DOCENTS === 'undefined') return [];
  return DOCENTS.filter(d => d.coordina || d.direccio);
}

/* Un identificador que no es pot repetir mai.

   Abans era només `Date.now()`, i dos apunts fets dins del mateix
   mil·lisegon compartien id. Llavors treure'n un en treia DOS, perquè
   l'esborrat va per id. Ho va caçar el banc de proves fent-ne dos seguits. */
let _esmComptador = 0;
function _esmId(prefix) {
  _esmComptador++;
  return prefix + Date.now().toString(36) + '-' + _esmComptador;
}

function _esmAvui() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/* ============================================================
   CÀRREGA I DESAT
   ============================================================ */
async function initCoordinacio() {
  if (typeof _rolDireccio === 'function' && !_rolDireccio()) return;
  if (!_esmForm.data) _esmForm.data = _esmAvui();
  renderCoordinacio();
  if (_esmCarregat || !config.scriptUrl) return;
  try {
    const r = await appsScriptGet({ action: 'loadEsmorzars' });
    if (r && r.ok) { _esmorzars = r.registres || []; _torns = r.torns || []; _esmCarregat = true; }
    else _esmEstat(_esmMissatgeError(r), 'error');
  } catch (e) {
    _esmEstat('No s\'han pogut carregar els esmorzars: ' + e.message + '. Prova de recarregar la pàgina.', 'error');
  }
  renderCoordinacio();
}

function _esmMissatgeError(r) {
  const base = (r && r.error) ? r.error : 'resposta buida';
  return r && r.needsGrupsSheet
    ? 'No s\'ha pogut obrir el full compartit de l\'escola: ' + base + '. Mira-ho a Configuració.'
    : 'No s\'han pogut carregar els esmorzars: ' + base;
}

async function _esmDesa() {
  if (!config.scriptUrl) {
    _esmEstat('Encara no estàs connectat: ves a Configuració i enganxa la URL.', 'error');
    return false;
  }
  _esmDesant = true;
  try {
    /* L'equip hi va sempre: el recordatori del dilluns el fa un disparador
       de l'Apps Script, que no pot llegir js/docents.js. Així el servidor
       sempre té els noms i els correus al dia. */
    const r = await appsScriptPost({
      action: 'saveEsmorzars',
      registres: _esmorzars,
      torns: _torns,
      equip: coordEquip().map(d => ({ nom: d.nom, email: d.email || '' })),
    });
    if (!r || !r.ok) throw new Error((r && r.error) || 'resposta buida');
    _esmDesant = false;
    return true;
  } catch (e) {
    _esmDesant = false;
    _esmEstat('No s\'ha pogut desar: ' + e.message + '. Torna-ho a provar.', 'error');
    return false;
  }
}

function _esmEstat(text, tipus) {
  const el = document.getElementById('esmEstat');
  if (!el) return;
  el.textContent = text || '';
  el.className = 'esm-estat' + (tipus ? ' is-' + tipus : '');
}

/* ============================================================
   ELS NÚMEROS
   ============================================================ */

// El resum d'una persona: quants n'ha portat, la mitjana i els gomets.
function esmResum(nom) {
  const seus = _esmorzars.filter(r => r.qui === nom);
  const portats = seus.filter(r => r.portat);
  const notes = portats.filter(r => typeof r.nota === 'number').map(r => r.nota);
  const gomets = seus.filter(r => !r.portat).length;
  return {
    nom,
    tocats: seus.length,
    portats: portats.length,
    gomets,
    mitjana: notes.length ? (notes.reduce((a, b) => a + b, 0) / notes.length) : null,
    ambNota: notes.length,
  };
}

function esmResums() {
  return coordEquip().map(d => esmResum(d.nom));
}

// "7,8" — amb coma, que és com s'escriuen els decimals en català.
function _esmNum(n, dec) {
  if (n === null || n === undefined) return '—';
  return n.toFixed(dec === undefined ? 1 : dec).replace('.', ',');
}

/* ============================================================
   A QUI LI TOCA — la rotació
   ------------------------------------------------------------
   No hi ha sorteig ni res a discutir: li toca a qui n'ha fet
   menys. Si n'empaten uns quants, al que fa més temps que no li
   toca; i si encara empaten, per ordre alfabètic. Sempre dona el
   mateix resultat amb les mateixes dades, que és tota la gràcia:
   ningú no pot dir que l'app li té mania.
   ============================================================ */

// Quantes vegades li ha tocat (el que ja ha passat + el que ja està apuntat)
// i quan va ser l'última.
function _esmHistorialPerPersona() {
  const compta = {}, ultim = {};
  coordEquip().forEach(d => { compta[d.nom] = 0; ultim[d.nom] = ''; });
  const totes = _esmorzars.concat(_torns);
  totes.forEach(x => {
    if (compta[x.qui] === undefined) return;
    compta[x.qui]++;
    if (String(x.data) > ultim[x.qui]) ultim[x.qui] = String(x.data);
  });
  return { compta, ultim };
}

/* A qui li toca. `saltats` són els que ja s'han descartat amb "un altre"
   (perquè aquell dia no hi seran). Torna null si no queda ningú. */
function esmProperTorn(saltats) {
  const fora = saltats || [];
  const equip = coordEquip().filter(d => fora.indexOf(d.nom) === -1);
  if (!equip.length) return null;
  const { compta, ultim } = _esmHistorialPerPersona();
  const ordenat = equip.slice().sort((a, b) => {
    if (compta[a.nom] !== compta[b.nom]) return compta[a.nom] - compta[b.nom];
    const ua = ultim[a.nom] || '', ub = ultim[b.nom] || '';
    if (ua !== ub) return ua.localeCompare(ub);
    return a.nom.localeCompare(b.nom, 'ca');
  });
  return ordenat[0];
}

function _esmISO(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function _esmData(iso) {
  const p = String(iso || '').split('-');
  if (p.length < 3) return null;
  const d = new Date(+p[0], +p[1] - 1, +p[2]);
  return isNaN(d.getTime()) ? null : d;
}
function _esmDilluns(iso) {
  const d = _esmData(iso);
  if (!d) return null;
  const dia = d.getDay();
  d.setDate(d.getDate() - (dia === 0 ? 6 : dia - 1));
  return d;
}

/* Quin dia serà la propera reunió: el mateix dia de la setmana que l'última
   que hi hagi apuntada. Si no n'hi ha cap, d'avui en set dies i que ho
   ajustin ells. */
function esmProperaData() {
  const totes = _esmorzars.map(r => r.data).concat(_torns.map(t => t.data)).filter(Boolean).sort();
  const avui = new Date(); avui.setHours(0, 0, 0, 0);
  const ultima = totes.length ? _esmData(totes[totes.length - 1]) : null;
  const d = new Date(avui);
  if (!ultima) { d.setDate(d.getDate() + 7); return _esmISO(d); }
  let salt = (ultima.getDay() - d.getDay() + 7) % 7;
  if (salt === 0) salt = 7;          // la propera, no la d'avui
  d.setDate(d.getDate() + salt);
  return _esmISO(d);
}

// El torn que encara no ha passat (si n'hi ha més d'un, el més proper).
function esmTornPendent() {
  const avui = _esmAvui();
  return _torns.filter(t => String(t.data) >= avui)
               .sort((a, b) => String(a.data).localeCompare(String(b.data)))[0] || null;
}

const _ESM_DIES = ['diumenge','dilluns','dimarts','dimecres','dijous','divendres','dissabte'];
const _ESM_MESOS = ['gener','febrer','març','abril','maig','juny','juliol','agost','setembre','octubre','novembre','desembre'];
function _esmDataLlarga(iso) {
  const d = _esmData(iso);
  return d ? (_ESM_DIES[d.getDay()] + ' ' + d.getDate() + ' de ' + _ESM_MESOS[d.getMonth()]) : (iso || '');
}

/* ---------- la targeta del torn ---------- */
function esmMiraQuiLiToca() {
  const d = esmProperTorn([]);
  if (!d) return;
  _esmProposta = { qui: d.nom, data: esmProperaData(), saltats: [] };
  _esmRenderTorn();
}

// "Aquell dia no hi serà": passa al següent de la llista.
function esmUnAltre() {
  if (!_esmProposta) return;
  const saltats = _esmProposta.saltats.concat([_esmProposta.qui]);
  const d = esmProperTorn(saltats);
  if (!d) { _esmTornEstat('Ja no queda ningú més de l\'equip.', 'error'); return; }
  _esmProposta = { qui: d.nom, data: _esmProposta.data, saltats };
  _esmRenderTorn();
}

function esmTornData(v) { if (_esmProposta) _esmProposta.data = v; }

function _esmTornEstat(text, tipus) {
  const el = document.getElementById('esmTornEstat');
  if (!el) return;
  el.textContent = text || '';
  el.className = 'esm-estat' + (tipus ? ' is-' + tipus : '');
}

async function esmApuntaTorn() {
  if (!_esmProposta || !_esmProposta.qui) return;
  if (!_esmProposta.data) { _esmTornEstat('Posa el dia de la reunió.', 'error'); return; }
  const abans = _torns.slice();
  _torns.push({ id: _esmId('t'), data: _esmProposta.data, qui: _esmProposta.qui, avisat: '' });
  _esmProposta = null;
  _esmRenderTorn();
  _esmTornEstat('Desant…');
  const ok = await _esmDesa();
  if (!ok) { _torns = abans; _esmRenderTorn(); return; }
  renderCoordinacio();
  const t = esmTornPendent();
  _esmTornEstat(t ? ('Apuntat. L\'avís li sortirà el ' + _esmDataLlarga(_esmISO(_esmDilluns(t.data))) + '.') : 'Apuntat.', 'ok');
}

async function esmTreuTorn(id) {
  const t = _torns.find(x => x.id === id);
  if (!t) return;
  if (!confirm('Treure el torn de ' + t.qui + ' del ' + _esmDataLlarga(t.data) + '?')) return;
  const abans = _torns.slice();
  _torns = _torns.filter(x => x.id !== id);
  _esmRenderTorn();
  const ok = await _esmDesa();
  if (!ok) { _torns = abans; _esmRenderTorn(); return; }
  _esmTornEstat('Torn tret.', 'ok');
}

/* Enviar l'avís a mà. El de debò surt sol el dilluns, des de l'Apps Script;
   això és per si el volen avançar o comprovar que arriba. */
async function esmEnviaAvis(id) {
  const t = _torns.find(x => x.id === id);
  if (!t) return;
  if (!config.scriptUrl) { _esmTornEstat('Encara no estàs connectat.', 'error'); return; }
  if (!confirm('Enviar-li ara el correu de l\'esmorzar a ' + t.qui + '?')) return;
  _esmTornEstat('Enviant…');
  try {
    const r = await appsScriptPost({ action: 'enviaAvisEsmorzar', tornId: id });
    if (!r || !r.ok) throw new Error((r && r.error) || 'resposta buida');
    t.avisat = 'ara';
    _esmRenderTorn();
    _esmTornEstat('Enviat a ' + (r.a || t.qui) + '.', 'ok');
  } catch (e) {
    _esmTornEstat('No s\'ha pogut enviar: ' + e.message, 'error');
  }
}

function _esmRenderTorn() {
  const cont = document.getElementById('esmTorn');
  if (!cont) return;
  const pendent = esmTornPendent();

  if (pendent) {
    const dilluns = _esmDilluns(pendent.data);
    const correu = (coordEquip().find(d => d.nom === pendent.qui) || {}).email || '';
    const avis = pendent.avisat
      ? '<span class="esm-torn-avis is-fet">Ja se li ha enviat l\'avís</span>'
      : (correu
          ? '<span class="esm-torn-avis">L\'avís li sortirà sol el <strong>' + escapeHtml(_esmDataLlarga(_esmISO(dilluns))) + '</strong></span>'
          : '<span class="esm-torn-avis is-falta">No en sabem el correu: no se li pot enviar res. Cal posar-l\'hi al llistat de docents.</span>');
    cont.innerHTML = `
      <div class="esm-torn-fet">
        <div>
          <p class="esm-torn-etiqueta">La propera reunió</p>
          <p class="esm-torn-nom">${escapeHtml(pendent.qui)}</p>
          <p class="esm-torn-data">${escapeHtml(_esmDataLlarga(pendent.data))}</p>
          ${avis}
        </div>
        <div class="esm-torn-botons">
          ${correu ? `<button type="button" class="esm-torn-btn" onclick="esmEnviaAvis('${pendent.id}')">Enviar-li l'avís ara</button>` : ''}
          <button type="button" class="esm-torn-btn" onclick="esmTreuTorn('${pendent.id}')">Treure el torn</button>
        </div>
      </div>
      <p class="esm-estat" id="esmTornEstat" role="status" aria-live="polite"></p>`;
    return;
  }

  if (_esmProposta) {
    const correu = (coordEquip().find(d => d.nom === _esmProposta.qui) || {}).email || '';
    cont.innerHTML = `
      <div class="esm-torn-proposta">
        <div>
          <p class="esm-torn-etiqueta">La setmana que ve li toca a</p>
          <p class="esm-torn-nom">${escapeHtml(_esmProposta.qui)}</p>
          <p class="esm-torn-perque">És a qui li ha tocat menys vegades. Res de discutir-ho.</p>
          ${correu ? '' : '<p class="esm-torn-avis is-falta">No en sabem el correu: es pot apuntar el torn igualment, però no rebrà l\'avís.</p>'}
        </div>
        <div class="esm-torn-quan">
          <label class="modal-label" for="esmTornData">Dia de la reunió</label>
          <input class="modal-input" id="esmTornData" type="date" value="${escapeHtml(_esmProposta.data)}" onchange="esmTornData(this.value)">
          <p class="modal-hint" style="margin:6px 0 0">El correu li arribarà el dilluns d'aquella setmana.</p>
        </div>
      </div>
      <div class="esm-torn-botons">
        <button class="btn btn-primary" type="button" onclick="esmApuntaTorn()">Apuntar el torn</button>
        <button type="button" class="esm-torn-btn" onclick="esmUnAltre()">Aquell dia no hi serà</button>
      </div>
      <p class="esm-estat" id="esmTornEstat" role="status" aria-live="polite"></p>`;
    return;
  }

  cont.innerHTML = `
    <div class="esm-torn-buit">
      <p>Encara no hi ha ningú apuntat per a la propera reunió.</p>
      <button class="btn btn-primary" type="button" onclick="esmMiraQuiLiToca()">Qui li toca la setmana que ve?</button>
    </div>
    <p class="esm-estat" id="esmTornEstat" role="status" aria-live="polite"></p>`;
}

/* ============================================================
   EL PALMARÈS
   ============================================================ */
function _esmRenderPalmares() {
  const cont = document.getElementById('esmPalmares');
  if (!cont) return;
  const ambNota = _esmorzars.filter(r => r.portat && typeof r.nota === 'number');
  // Amb quatre apunts no hi ha palmarès que valgui: seria fer riure.
  if (_esmorzars.length < 4) {
    cont.innerHTML = '';
    return;
  }

  const resums = esmResums();
  const millorSol = ambNota.slice().sort((a, b) => b.nota - a.nota || String(a.data).localeCompare(String(b.data)))[0];
  const millorMitjana = resums.filter(r => r.ambNota >= 2).sort((a, b) => b.mitjana - a.mitjana)[0];
  const mesConstant = resums.slice().sort((a, b) => b.portats - a.portats || a.nom.localeCompare(b.nom, 'ca'))[0];
  const mesOblits = resums.slice().sort((a, b) => b.gomets - a.gomets || a.nom.localeCompare(b.nom, 'ca'))[0];

  const premis = [];
  if (millorSol) premis.push({
    icona: '🏆', titol: 'L\'esmorzar de l\'any', qui: millorSol.qui,
    detall: (millorSol.que ? millorSol.que + ' · ' : '') + millorSol.nota + ' de 10',
  });
  if (millorMitjana) premis.push({
    icona: '⭐', titol: 'Millor mitjana', qui: millorMitjana.nom,
    detall: _esmNum(millorMitjana.mitjana) + ' de 10, amb ' + millorMitjana.ambNota + ' esmorzars',
  });
  if (mesConstant && mesConstant.portats > 0) premis.push({
    icona: '🧱', titol: 'El més constant', qui: mesConstant.nom,
    detall: mesConstant.portats + (mesConstant.portats === 1 ? ' esmorzar dut' : ' esmorzars duts'),
  });
  if (mesOblits && mesOblits.gomets > 0) premis.push({
    icona: '🙈', titol: 'Rei de l\'oblit', qui: mesOblits.nom,
    detall: mesOblits.gomets + (mesOblits.gomets === 1 ? ' gomet vermell' : ' gomets vermells'),
  });

  cont.innerHTML = `
    <section class="esm-card">
      <h2 class="esm-card-titol">Palmarès</h2>
      <p class="esm-palmares-nota">Amb ${_esmorzars.length} reunions apuntades. Va canviant fins al juny.</p>
      <div class="esm-premis">
        ${premis.map(p => `<div class="esm-premi">
          <span class="esm-premi-icona" aria-hidden="true">${p.icona}</span>
          <span class="esm-premi-titol">${escapeHtml(p.titol)}</span>
          <span class="esm-premi-qui">${escapeHtml(p.qui)}</span>
          <span class="esm-premi-detall">${escapeHtml(p.detall)}</span>
        </div>`).join('')}
      </div>
    </section>`;
}

/* ============================================================
   LA PANTALLA
   ============================================================ */
function renderCoordinacio() {
  _esmRenderTorn();
  _esmRenderForm();
  _esmRenderPanell();
  _esmRenderHistorial();
  _esmRenderPalmares();
}

/* ---------- el formulari ---------- */
function _esmRenderForm() {
  const cont = document.getElementById('esmForm');
  if (!cont) return;
  const equip = coordEquip();
  if (!equip.length) {
    cont.innerHTML = '<p class="modal-hint">No hi ha ningú marcat com a coordinació ni com a equip directiu al llistat de docents.</p>';
    return;
  }

  const opcions = equip.map(d =>
    `<option value="${escapeHtml(d.nom)}"${_esmForm.qui === d.nom ? ' selected' : ''}>${escapeHtml(d.nom)}${d.coordina ? ' · coordinació' : ' · direcció'}</option>`
  ).join('');

  // La nota i què va portar només tenen sentit si l'ha portat.
  const capNota = _esmForm.portat === true;
  const notes = [1,2,3,4,5,6,7,8,9,10].map(n =>
    `<button type="button" class="esm-nota${_esmForm.nota === n ? ' active' : ''}" aria-pressed="${_esmForm.nota === n}" onclick="esmTriaNota(${n})">${n}</button>`
  ).join('');

  cont.innerHTML = `
    <div class="esm-camp">
      <label class="modal-label" for="esmQui">Qui havia de portar l'esmorzar?</label>
      <select class="modal-input" id="esmQui" onchange="esmTriaQui(this.value)">
        <option value="">— Tria un membre —</option>
        ${opcions}
      </select>
    </div>
    <div class="esm-camp">
      <label class="modal-label" for="esmData">Quin dia</label>
      <input class="modal-input" id="esmData" type="date" value="${escapeHtml(_esmForm.data)}" onchange="esmTriaData(this.value)">
    </div>
    <div class="esm-camp">
      <span class="modal-label" id="esmPortatLabel">L'ha portat?</span>
      <div class="esm-siono" role="group" aria-labelledby="esmPortatLabel">
        <button type="button" class="esm-si${_esmForm.portat === true ? ' active' : ''}" aria-pressed="${_esmForm.portat === true}" onclick="esmTriaPortat(true)">Sí, l'ha portat</button>
        <button type="button" class="esm-no${_esmForm.portat === false ? ' active' : ''}" aria-pressed="${_esmForm.portat === false}" onclick="esmTriaPortat(false)">No l'ha portat</button>
      </div>
    </div>
    <div class="esm-camp" id="esmCampNota" style="display:${capNota ? '' : 'none'}">
      <span class="modal-label" id="esmNotaLabel">Quina nota li poseu? <span class="esm-nota-ajuda">(1 = per llençar, 10 = per repetir)</span></span>
      <div class="esm-notes" role="group" aria-labelledby="esmNotaLabel">${notes}</div>
    </div>
    <div class="esm-camp" id="esmCampQue" style="display:${capNota ? '' : 'none'}">
      <label class="modal-label" for="esmQue">Què va portar? <span class="esm-nota-ajuda">(opcional)</span></label>
      <input class="modal-input" id="esmQue" type="text" maxlength="80" placeholder="Coca de vidre, xocolata…">
    </div>
    <div class="esm-accions">
      <button class="btn btn-primary" type="button" onclick="esmApunta()">Apuntar-ho</button>
      <span class="esm-estat" id="esmEstat" role="status" aria-live="polite"></span>
    </div>`;
}

function esmTriaQui(nom)  { _esmForm.qui = nom; _esmEstat(''); }
function esmTriaData(d)   { _esmForm.data = d; }
function esmTriaNota(n)   { _esmForm.nota = n; _esmRenderForm(); }

function esmTriaPortat(val) {
  _esmForm.portat = val;
  if (!val) _esmForm.nota = null;   // sense esmorzar no hi ha nota a posar
  // Es repinta perquè apareguin (o desapareguin) la nota i el "què va portar",
  // conservant el que ja hi hagués escrit.
  const que = document.getElementById('esmQue');
  const guardat = que ? que.value : '';
  _esmRenderForm();
  const que2 = document.getElementById('esmQue');
  if (que2) que2.value = guardat;
}

async function esmApunta() {
  if (!_esmForm.qui)              { _esmEstat('Primer tria de qui parlem.', 'error'); return; }
  if (_esmForm.portat === null)   { _esmEstat('Digues si l\'ha portat o no.', 'error'); return; }
  if (_esmForm.portat && !_esmForm.nota) { _esmEstat('Posa-li una nota, de l\'1 al 10.', 'error'); return; }
  if (_esmDesant) return;

  const que = document.getElementById('esmQue');
  const registre = {
    id: _esmId('e'),
    data: _esmForm.data || _esmAvui(),
    qui: _esmForm.qui,
    portat: !!_esmForm.portat,
    nota: _esmForm.portat ? _esmForm.nota : null,
    que: (_esmForm.portat && que) ? que.value.trim().slice(0, 80) : '',
  };

  const abans = _esmorzars.slice();
  const tornsAbans = _torns.slice();
  _esmorzars.push(registre);
  /* Si hi havia un torn apuntat per a aquell dia i aquella persona, ja està
     fet: es treu, o el rètol de "la propera reunió" es quedaria ensenyant
     una cosa que ja ha passat. */
  _torns = _torns.filter(t => !(t.qui === registre.qui && String(t.data) === String(registre.data)));
  _esmEstat('Desant…');
  renderCoordinacio();

  const ok = await _esmDesa();
  if (!ok) {
    // No ha arribat al full: no ho deixem a la pantalla com si sí.
    _esmorzars = abans;
    _torns = tornsAbans;
    renderCoordinacio();
    return;
  }

  const gomets = esmResum(registre.qui).gomets;
  _esmForm = { qui: '', data: _esmAvui(), portat: null, nota: null };
  renderCoordinacio();
  _esmEstat(registre.portat
    ? 'Apuntat: ' + registre.qui + ', un ' + registre.nota + ' de 10.'
    : 'Apuntat: ' + registre.qui + ' no el va portar. Ja en porta ' + gomets + '.', 'ok');

  // Cada 3 gomets, penyora.
  if (!registre.portat && gomets > 0 && gomets % ESM_GOMETS_PENYORA === 0) {
    esmPenyoraObre(registre.qui, gomets);
  }
}

/* ---------- el panell de buidatge ---------- */
function _esmRenderPanell() {
  const cont = document.getElementById('esmPanell');
  if (!cont) return;
  const resums = esmResums();
  const total = _esmorzars.length;

  if (!total) {
    cont.innerHTML = `<div class="esm-buit">
      <p><strong>Encara no hi ha cap esmorzar apuntat.</strong><br>Apunta el primer al formulari del costat i aquí hi sortiran les mitjanes, el comptador i els gomets.</p>
    </div>`;
    return;
  }

  const portats = _esmorzars.filter(r => r.portat).length;
  const oblidats = total - portats;
  const ambNota = _esmorzars.filter(r => r.portat && typeof r.nota === 'number');
  const mitjanaEquip = ambNota.length ? ambNota.reduce((a, r) => a + r.nota, 0) / ambNota.length : null;

  // Ordre: primer qui té millor mitjana. Els que encara no en tenen, al final.
  const ordenats = resums.slice().sort((a, b) => {
    if (a.mitjana === null && b.mitjana === null) return a.nom.localeCompare(b.nom, 'ca');
    if (a.mitjana === null) return 1;
    if (b.mitjana === null) return -1;
    return b.mitjana - a.mitjana;
  });

  /* El gràfic i la taula són el MATEIX: una barra dins de la cel·la de la
     mitjana. Així qui la mira de lluny veu qui guanya, i qui la llegeix amb
     un lector de pantalla té els números igualment. */
  const files = ordenats.map(r => {
    const pct = r.mitjana === null ? 0 : Math.round((r.mitjana / 10) * 100);
    const gomets = r.gomets
      ? `<span class="esm-gomets" title="${r.gomets} ${r.gomets === 1 ? 'vegada que no el va portar' : 'vegades que no el va portar'}">${
          Array.from({ length: Math.min(r.gomets, 5) }, () => '<span class="esm-gomet" aria-hidden="true"></span>').join('')
        }<span class="esm-gomets-num">${r.gomets}</span></span>`
      : '<span class="esm-cap">cap</span>';
    return `<tr>
      <th scope="row" class="esm-t-nom">${escapeHtml(r.nom)}</th>
      <td class="esm-t-mitjana">
        <span class="esm-barra"><span class="esm-barra-fill" style="width:${pct}%"></span></span>
        <span class="esm-barra-val">${_esmNum(r.mitjana)}</span>
      </td>
      <td class="esm-t-num">${r.portats}</td>
      <td class="esm-t-gomets">${gomets}</td>
    </tr>`;
  }).join('');

  cont.innerHTML = `
    <div class="esm-xifres">
      <div class="esm-xifra"><span class="esm-xifra-num">${total}</span><span class="esm-xifra-txt">reunions apuntades</span></div>
      <div class="esm-xifra"><span class="esm-xifra-num">${portats}</span><span class="esm-xifra-txt">esmorzars duts</span></div>
      <div class="esm-xifra esm-xifra-avis"><span class="esm-xifra-num">${oblidats}</span><span class="esm-xifra-txt">${oblidats === 1 ? 'oblit' : 'oblits'}</span></div>
      <div class="esm-xifra"><span class="esm-xifra-num">${_esmNum(mitjanaEquip)}</span><span class="esm-xifra-txt">nota mitjana de l'equip</span></div>
    </div>
    <div class="esm-taula-caixa"><table class="esm-taula">
      <caption class="esm-taula-cap">Nota mitjana de cadascú, de 0 a 10, ordenats de més a menys</caption>
      <thead>
        <tr><th scope="col">Membre</th><th scope="col">Nota mitjana</th><th scope="col">Duts</th><th scope="col">Gomets</th></tr>
      </thead>
      <tbody>${files}</tbody>
    </table></div>`;
}

/* ---------- l'historial ---------- */
function _esmRenderHistorial() {
  const cont = document.getElementById('esmHistorial');
  if (!cont) return;
  if (!_esmorzars.length) { cont.innerHTML = ''; return; }
  const ordenats = _esmorzars.slice().sort((a, b) => String(b.data).localeCompare(String(a.data)));
  cont.innerHTML = `<h3 class="esm-subtitol">Els últims esmorzars</h3>
    <ul class="esm-hist">
      ${ordenats.slice(0, 12).map(r => `<li class="esm-hist-item${r.portat ? '' : ' es-oblit'}">
        <span class="esm-hist-data">${escapeHtml(_esmDataCurta(r.data))}</span>
        <span class="esm-hist-qui">${escapeHtml(r.qui)}</span>
        <span class="esm-hist-que">${r.portat
          ? (r.que ? escapeHtml(r.que) : 'el va portar')
          : 'no el va portar'}</span>
        <span class="esm-hist-nota">${r.portat && typeof r.nota === 'number' ? r.nota + '/10' : '—'}</span>
        <button type="button" class="esm-hist-treu" onclick="esmTreu('${r.id}')" title="Treure aquest apunt" aria-label="Treure l'apunt de ${escapeHtml(r.qui)}">×</button>
      </li>`).join('')}
    </ul>`;
}

// "2026-09-03" → "3 set."
function _esmDataCurta(iso) {
  const mesos = ['gen.','febr.','març','abr.','maig','juny','jul.','ag.','set.','oct.','nov.','des.'];
  const p = String(iso || '').split('-');
  if (p.length < 3) return iso || '';
  return parseInt(p[2], 10) + ' ' + (mesos[parseInt(p[1], 10) - 1] || '');
}

async function esmTreu(id) {
  const r = _esmorzars.find(x => x.id === id);
  if (!r) return;
  if (!confirm('Treure l\'apunt de ' + r.qui + ' del ' + _esmDataCurta(r.data) + '?')) return;
  const abans = _esmorzars.slice();
  _esmorzars = _esmorzars.filter(x => x.id !== id);
  renderCoordinacio();
  const ok = await _esmDesa();
  if (!ok) { _esmorzars = abans; renderCoordinacio(); return; }
  _esmEstat('Apunt tret.', 'ok');
}

/* ============================================================
   LA PENYORA — el popup dels 3 gomets
   ============================================================ */
function esmPenyoraObre(nom, gomets) {
  const modal = document.getElementById('esmPenyora');
  const txt   = document.getElementById('esmPenyoraText');
  if (!modal || !txt) return;
  txt.innerHTML = `<strong>${escapeHtml(nom)}</strong> ja porta <strong>${gomets} gomets vermells</strong> per no haver dut l'esmorzar.`;
  /* No es bloqueja l'scroll del cos a posta: el gest d'enrere del mòbil
     tanca el modal des de _tancaObertsPerEnrere(), que no el desbloquejaria,
     i la pàgina es quedaria encallada. */
  modal.classList.add('open');
  const btn = document.getElementById('esmPenyoraBtn');
  if (btn) btn.focus();
}

function esmPenyoraTanca() {
  const modal = document.getElementById('esmPenyora');
  if (!modal) return;
  modal.classList.remove('open');
}
