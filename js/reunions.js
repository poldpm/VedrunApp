/* ============================================================
   CONVOCAR REUNIONS — reunions.js
   ------------------------------------------------------------
   La mestra marca les hores que té lliures, l'app li dona un
   enllaç, l'envia per correu i cada família tria la seva hora.
   La reserva li entra al seu Google Calendar.

   ⚠ Aquí NO hi ha res que decideixi si una hora està lliure.
   Qui ho decideix és SEMPRE el servidor (Code.gs), amb el pany
   posat: dues famílies poden clicar el mateix segon des de dos
   mòbils, i el navegador no pot saber-ho. Aquesta pantalla
   només ensenya el que el servidor li diu.
   ============================================================ */

let _reuCals = [];
let _reuCarregant = false;

/* ---------- utilitats ---------- */
const _REU_DIES = ['Diumenge','Dilluns','Dimarts','Dimecres','Dijous','Divendres','Dissabte'];
const _REU_MESOS = ['gener','febrer','març','abril','maig','juny','juliol','agost','setembre','octubre','novembre','desembre'];

function _reuDataText(d) {
  if (!d) return '';
  const p = String(d).split('-');
  const dt = new Date(+p[0], +p[1] - 1, +p[2]);
  return _REU_DIES[dt.getDay()] + ', ' + (+p[2]) + ' de ' + _REU_MESOS[+p[1] - 1];
}
function _reuDataCurta(d) {
  const p = String(d).split('-');
  return (+p[2]) + '/' + (+p[1]);
}
function _reuAvui() {
  const d = new Date(), p = n => (n < 10 ? '0' : '') + n;
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

/* ============================================================
   PANTALLA PRINCIPAL
   ============================================================ */
async function initReunions() {
  const cont = document.getElementById('reunionsCont');
  if (!cont) return;
  if (!config.scriptUrl) {
    cont.innerHTML = '<div class="tasques-empty"><p><strong>Encara no estàs connectada.</strong><br>' +
      'Ves a <strong>Configuració</strong> i enganxa la URL que et van donar.</p></div>';
    return;
  }
  if (_reuCarregant) return;
  _reuCarregant = true;
  cont.innerHTML = '<div class="tasques-empty"><p>Carregant els teus calendaris de reunions…</p></div>';
  try {
    const r = await appsScriptGet({ action: 'reunionsLlista' });
    _reuCals = (r && r.ok && r.calendaris) ? r.calendaris : [];
    _renderReunions();
  } catch (e) {
    cont.innerHTML = '<div class="tasques-empty"><p>No s\'han pogut carregar. Torna-ho a provar.</p></div>';
  } finally { _reuCarregant = false; }
}

function _renderReunions() {
  const cont = document.getElementById('reunionsCont');
  if (!cont) return;

  if (!_reuCals.length) {
    cont.innerHTML =
      `<div class="tasques-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" width="38" height="38"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        <p><strong>Encara no has convocat cap reunió.</strong><br>
        Crea un calendari amb les hores que tinguis lliures, envia l'enllaç a les famílies
        i cadascuna triarà la seva. Les reserves et van soles al Google Calendar.</p>
        <button class="btn btn-primary btn-sm" style="margin-top:10px" onclick="obreReuNou()">+ Nou calendari de reunions</button>
      </div>`;
    return;
  }

  cont.innerHTML = _reuCals.map(c => {
    const tancat = !c.actiu;
    const reserves = c.reserves || [];
    const ambError = reserves.filter(r => r.error).length;
    return `
    <div class="reu-card${c.acabat ? ' reu-acabat' : ''}">
      <div class="reu-card-head">
        <div class="reu-card-titol">
          <strong>${escapeHtml(c.titol)}</strong>
          ${tancat ? '<span class="reu-badge reu-badge-tancat">Tancat</span>' : ''}
          ${c.acabat ? '<span class="reu-badge">Ja ha passat</span>' : ''}
        </div>
        <div class="reu-card-meta">
          ${c.durada} min${c.lloc ? ' · ' + escapeHtml(c.lloc) : ''}
          ${c.desDe ? ' · del ' + _reuDataCurta(c.desDe) + ' al ' + _reuDataCurta(c.finsA) : ''}
        </div>
      </div>

      ${c.descripcio ? `<p class="reu-desc">${escapeHtml(c.descripcio)}</p>` : ''}

      <div class="reu-xifres">
        <span class="reu-xifra"><b>${c.lliures}</b> lliures</span>
        <span class="reu-xifra"><b>${c.ocupades}</b> reservades</span>
        ${ambError ? `<span class="reu-xifra reu-xifra-avis"><b>${ambError}</b> sense posar al calendari</span>` : ''}
      </div>

      ${c.acabat ? '' : `
      <div class="reu-enllac">
        <input class="modal-input" readonly value="${escapeHtml(c.enllac || '')}" onclick="this.select()">
        <button class="btn btn-primary btn-sm" onclick="copiaReuEnllac('${c.id}', this)">Copiar</button>
      </div>
      <p class="modal-hint">Envia aquest enllaç a les famílies. Qui hi entri veurà només les hores que et queden lliures.</p>`}

      ${(c.acabat || !(c.horesLliures || []).length) ? '' : `
      <div class="reu-reserves">
        <div class="reu-reserves-tit">Hores encara lliures — clica-hi per treure-la</div>
        ${_reuLliuresPerDia(c)}
        <p class="modal-hint">Si et surt un imprevist, treu l'hora i deixarà de sortir a les famílies a l'instant.</p>
      </div>`}

      ${reserves.length ? `
      <div class="reu-reserves">
        <div class="reu-reserves-tit">Hores reservades</div>
        ${reserves.map(r => `
          <div class="reu-reserva${r.error ? ' reu-reserva-avis' : ''}">
            <div class="reu-reserva-quan">
              <b>${_reuDataCurta(r.data)}</b> ${escapeHtml(r.inici)}–${escapeHtml(r.fi)}
            </div>
            <div class="reu-reserva-qui">
              ${escapeHtml(r.nom)}${r.email ? `<span class="reu-reserva-mail">${escapeHtml(r.email)}</span>` : ''}
              ${r.error ? `<span class="reu-reserva-err">⚠ No s'ha pogut posar al Google Calendar</span>` : ''}
            </div>
            <div class="reu-reserva-acc">
              ${r.error ? `<button class="btn btn-ghost btn-sm" onclick="reuReintenta('${c.id}','${r.slotId}')">Tornar-ho a provar</button>` : ''}
              <button class="btn btn-ghost btn-sm" onclick="reuAllibera('${c.id}','${r.slotId}','${escapeHtml(r.nom).replace(/'/g,'')}')">Alliberar</button>
            </div>
          </div>`).join('')}
      </div>` : (c.acabat ? '' : '<p class="modal-hint">Encara no hi ha cap hora reservada.</p>')}

      <div class="reu-card-acc">
        ${c.acabat ? '' : `<button class="btn btn-ghost btn-sm" onclick="reuActiva('${c.id}', ${tancat ? 'true' : 'false'})">${tancat ? 'Tornar a obrir' : 'Tancar reserves'}</button>`}
        <button class="btn btn-ghost btn-sm reu-del" onclick="reuEsborra('${c.id}')">Esborrar</button>
      </div>
    </div>`;
  }).join('');
}

/* Les hores lliures, agrupades per dia, cadascuna clicable per treure-la.
   És el cas d'en Pol: ja ha enviat l'enllaç i el dia 12 li surt una cosa. */
function _reuLliuresPerDia(c) {
  const perDia = {}, ordre = [];
  (c.horesLliures || []).forEach(h => {
    if (!perDia[h.data]) { perDia[h.data] = []; ordre.push(h.data); }
    perDia[h.data].push(h);
  });
  return ordre.map(d => `
    <div class="reu-prev-dia">
      <div class="reu-prev-data">${escapeHtml(_reuDataText(d))}</div>
      <div class="reu-prev-hores">
        ${perDia[d].map(h => `<button class="reu-prev-h reu-prev-treure"
            title="Treure les ${escapeHtml(h.inici)} del ${escapeHtml(_reuDataText(d))}"
            onclick="reuTreuHora('${c.id}','${h.slotId}','${escapeHtml(_reuDataText(d))}','${escapeHtml(h.inici)}')"
          >${escapeHtml(h.inici)}<span class="reu-prev-x">×</span></button>`).join('')}
      </div>
    </div>`).join('');
}

async function reuTreuHora(calId, slotId, dataText, hora) {
  if (!confirm('Treure les ' + hora + ' del ' + dataText + '?\n\nDeixarà de sortir a les famílies. Encara no l\'ha reservat ningú.')) return;
  const r = await appsScriptPost({ action: 'reunionsTreuHora', calId, slotId });
  if (r && r.ok) { showToast('Hora treta ✓', 'success'); initReunions(); }
  else showToast((r && r.error) || 'No s\'ha pogut treure', 'error');
}

/* ---------- accions sobre un calendari ---------- */
function copiaReuEnllac(calId, btn) {
  const c = _reuCals.find(x => x.id === calId);
  if (!c || !c.enllac) return;
  const fet = () => { if (btn) { const t = btn.textContent; btn.textContent = 'Copiat ✓'; setTimeout(() => btn.textContent = t, 1800); } };
  if (navigator.clipboard) navigator.clipboard.writeText(c.enllac).then(fet).catch(fet);
  else fet();
}

async function reuActiva(calId, actiu) {
  const r = await appsScriptPost({ action: 'reunionsActiva', calId, actiu });
  if (r && r.ok) { showToast(actiu ? 'Reserves obertes' : 'Reserves tancades', 'success'); initReunions(); }
  else showToast('No s\'ha pogut canviar', 'error');
}

async function reuAllibera(calId, slotId, nom) {
  if (!confirm('Vols alliberar l\'hora de ' + nom + '?\n\nEs treurà del teu Google Calendar i qualsevol altra persona la podrà reservar. ' + nom + ' NO rebrà cap avís: si cal, avisa-l\'en tu.')) return;
  const r = await appsScriptPost({ action: 'reunionsAllibera', calId, slotId });
  if (r && r.ok) { showToast('Hora alliberada', 'success'); initReunions(); }
  else showToast('No s\'ha pogut alliberar', 'error');
}

async function reuReintenta(calId, slotId) {
  const r = await appsScriptPost({ action: 'reunionsReintenta', calId, slotId });
  if (r && r.ok) { showToast('Ja és al teu Google Calendar ✓', 'success'); initReunions(); }
  else showToast((r && r.error) || 'No s\'ha pogut posar al calendari', 'error');
}

async function reuEsborra(calId) {
  const c = _reuCals.find(x => x.id === calId);
  if (!c) return;
  const n = (c.reserves || []).length;
  let avis = 'Vols esborrar «' + c.titol + '»?\n\nL\'enllaç deixarà de funcionar.';
  if (n) avis += '\n\nATENCIÓ: hi ha ' + n + ' hora' + (n > 1 ? 'es' : '') + ' reservada' + (n > 1 ? 'es' : '') +
    ' i també s\'esborrarà' + (n > 1 ? 'n' : '') + ' del teu Google Calendar. Les famílies no rebran cap avís.';
  if (!confirm(avis)) return;
  const r = await appsScriptPost({ action: 'reunionsEsborra', calId });
  if (r && r.ok) { showToast('Calendari esborrat', 'success'); initReunions(); }
  else showToast('No s\'ha pogut esborrar', 'error');
}

/* ============================================================
   CREAR UN CALENDARI NOU
   ------------------------------------------------------------
   Els horaris reals no són iguals cada dia: dilluns a les 11,
   dimarts a les 15, dimecres només al migdia. Per això les hores
   es diuen PER DIA DE LA SETMANA, i no una llista de dates.

   Dos passos, i el segon és el que salva el dia: repassar les
   hores que sortiran i treure les que aquell dia concret no vagin.
   ============================================================ */

const _REU_DOW = [
  { n: 1, nom: 'Dilluns' }, { n: 2, nom: 'Dimarts' }, { n: 3, nom: 'Dimecres' },
  { n: 4, nom: 'Dijous' },  { n: 5, nom: 'Divendres' },
];
let _reuPerDia = {};      // { 1: [{inici,fi}], ... }
let _reuExclou = {};      // { "2026-09-12 13:00": true }
let _reuPreview = [];     // el que ha dit el servidor que sortirà
let _reuPas = 1;

function obreReuNou() {
  _reuPerDia = {}; _reuExclou = {}; _reuPreview = []; _reuPas = 1;
  let ov = document.getElementById('reuNouOverlay');
  if (!ov) ov = _reuMuntaModal();

  document.getElementById('reuTitol').value = '';
  document.getElementById('reuDesc').value = '';
  document.getElementById('reuLloc').value = '';
  document.getElementById('reuDurada').value = '15';
  document.getElementById('reuBuffer').value = '0';
  document.getElementById('reuMaxPersona').checked = true;
  document.getElementById('reuEvitar').checked = true;
  document.getElementById('reuAvisar').checked = true;

  // Per defecte: de dilluns que ve a dues setmanes després
  const p = n => (n < 10 ? '0' : '') + n;
  const avui = new Date();
  const dl = new Date(avui); dl.setDate(avui.getDate() + ((8 - (avui.getDay() || 7)) % 7 || 7));
  const fi = new Date(dl); fi.setDate(dl.getDate() + 11);
  document.getElementById('reuDesDe').value = dl.getFullYear() + '-' + p(dl.getMonth() + 1) + '-' + p(dl.getDate());
  document.getElementById('reuFinsA').value = fi.getFullYear() + '-' + p(fi.getMonth() + 1) + '-' + p(fi.getDate());

  _reuPintaDies();
  _reuVesAPas(1);
  ov.classList.add('open');
  setTimeout(() => document.getElementById('reuTitol').focus(), 80);
}
function tancaReuNou() {
  const ov = document.getElementById('reuNouOverlay');
  if (ov) ov.classList.remove('open');
}

function _reuVesAPas(n) {
  _reuPas = n;
  const p1 = document.getElementById('reuPas1'), p2 = document.getElementById('reuPas2');
  if (p1) p1.style.display = n === 1 ? '' : 'none';
  if (p2) p2.style.display = n === 2 ? '' : 'none';
  const b = document.getElementById('reuPeu');
  if (!b) return;
  b.innerHTML = n === 1
    ? '<button class="btn btn-secondary" onclick="tancaReuNou()">Cancel·lar</button>' +
      '<button class="btn btn-primary" id="reuSeguent" onclick="reuVeurePreview()">Veure les hores →</button>'
    : '<button class="btn btn-secondary" onclick="_reuVesAPas(1)">← Enrere</button>' +
      '<button class="btn btn-primary" id="reuCrearBtn" onclick="creaReuCalendari()">Crear i generar l\'enllaç</button>';
}

/* ---------- PAS 1: quines hores tens cada dia ---------- */
function _reuPintaDies() {
  const c = document.getElementById('reuDiesSetmana');
  if (!c) return;
  c.innerHTML = _REU_DOW.map(d => {
    const trams = _reuPerDia[d.n] || [];
    const actiu = trams.length > 0;
    return `
    <div class="reu-dia${actiu ? ' reu-dia-actiu' : ''}">
      <label class="reu-dia-nom">
        <input type="checkbox" ${actiu ? 'checked' : ''} onchange="_reuToggleDia(${d.n})">
        <span>${d.nom}</span>
      </label>
      <div class="reu-dia-hores">
        ${actiu ? trams.map((t, i) => `
          <span class="reu-tram">
            <input type="time" value="${t.inici}" onchange="_reuTram(${d.n},${i},'inici',this.value)" aria-label="Des de">
            <span>–</span>
            <input type="time" value="${t.fi}" onchange="_reuTram(${d.n},${i},'fi',this.value)" aria-label="Fins a">
            ${trams.length > 1 ? `<button class="reu-tram-x" onclick="_reuTreuTram(${d.n},${i})" title="Treure">×</button>` : ''}
          </span>`).join('') : '<span class="reu-dia-buit">No ofereixo hores</span>'}
        ${actiu ? `<button class="reu-mini" onclick="_reuAfegeixTram(${d.n})">+ una altra estona</button>
                    <button class="reu-mini" onclick="_reuCopiaDia(${d.n})" title="Posar aquestes mateixes hores als altres dies que ofereixis">copiar als altres</button>` : ''}
      </div>
    </div>`;
  }).join('');
}

function _reuToggleDia(n) {
  if (_reuPerDia[n] && _reuPerDia[n].length) delete _reuPerDia[n];
  else {
    // hereta les hores d'un dia que ja tingui posades: sovint es repeteixen
    const ja = _REU_DOW.map(d => _reuPerDia[d.n]).filter(x => x && x.length)[0];
    _reuPerDia[n] = ja ? JSON.parse(JSON.stringify(ja)) : [{ inici: '17:00', fi: '18:00' }];
  }
  _reuPintaDies();
}
function _reuTram(n, i, camp, val) {
  if (!_reuPerDia[n] || !_reuPerDia[n][i]) return;
  _reuPerDia[n][i][camp] = val;
  const t = _reuPerDia[n][i];
  if (t.inici && t.fi && t.fi <= t.inici) showToast('A ' + _REU_DOW[n-1].nom + ', l\'hora de final ha de ser més tard', 'error');
}
function _reuAfegeixTram(n) {
  const l = _reuPerDia[n] || [];
  const ultim = l[l.length - 1];
  // proposa la següent estona a continuació de l'última
  let ini = '17:00', fi = '18:00';
  if (ultim) { ini = ultim.fi; const h = parseInt(ini.split(':')[0], 10) + 1; fi = ('0' + h).slice(-2) + ':' + ini.split(':')[1]; }
  l.push({ inici: ini, fi: fi });
  _reuPerDia[n] = l;
  _reuPintaDies();
}
function _reuTreuTram(n, i) {
  if (!_reuPerDia[n]) return;
  _reuPerDia[n].splice(i, 1);
  if (!_reuPerDia[n].length) delete _reuPerDia[n];
  _reuPintaDies();
}
function _reuCopiaDia(n) {
  const font = _reuPerDia[n];
  if (!font) return;
  let quants = 0;
  Object.keys(_reuPerDia).forEach(k => {
    if (+k === n) return;
    _reuPerDia[k] = JSON.parse(JSON.stringify(font)); quants++;
  });
  _reuPintaDies();
  showToast(quants ? 'Copiades a ' + quants + ' dia' + (quants > 1 ? 's' : '') : 'Marca primer els altres dies', quants ? 'success' : 'error');
}

/* ---------- PAS 2: repassar i treure ---------- */
async function reuVeurePreview() {
  const titol = document.getElementById('reuTitol').value.trim();
  if (!titol) { showToast('Posa-hi un títol', 'error'); document.getElementById('reuTitol').focus(); return; }
  if (!Object.keys(_reuPerDia).length) { showToast('Marca com a mínim un dia i digues a quina hora', 'error'); return; }

  const b = document.getElementById('reuSeguent');
  if (b) { b.disabled = true; b.textContent = 'Calculant…'; }
  try {
    const r = await appsScriptPost({ action: 'reunionsPreview', dades: _reuDades() });
    if (!r || !r.ok) { showToast((r && r.error) || 'No s\'han pogut calcular les hores', 'error'); return; }
    if (!r.franges.length) { showToast('Amb aquestes hores i aquesta durada no surt cap reunió', 'error'); return; }
    _reuPreview = r.franges;
    _reuPintaPreview();
    _reuVesAPas(2);
  } finally {
    if (b) { b.disabled = false; b.textContent = 'Veure les hores →'; }
  }
}

function _reuPintaPreview() {
  const c = document.getElementById('reuPreviewCont');
  if (!c) return;
  const perDia = {}, ordre = [];
  _reuPreview.forEach(f => { if (!perDia[f.data]) { perDia[f.data] = []; ordre.push(f.data); } perDia[f.data].push(f); });

  const fora = Object.keys(_reuExclou).filter(k => _reuExclou[k]).length;
  const xoquen = _reuPreview.filter(f => f.xoc).length;
  const queden = _reuPreview.filter(f => !f.xoc && !_reuExclou[f.data + ' ' + f.inici]).length;

  c.innerHTML =
    `<div class="reu-resum"><strong>${queden} hores</strong> per oferir${fora ? ' · ' + fora + ' tretes per tu' : ''}${xoquen ? ' · ' + xoquen + ' saltades perquè ja les tens ocupades' : ''}</div>` +
    '<p class="modal-hint" style="margin-bottom:10px">Clica una hora per treure-la, si aquell dia no la tens. Les ratllades no s\'oferiran.</p>' +
    ordre.map(d => `
      <div class="reu-prev-dia">
        <div class="reu-prev-data">${escapeHtml(_reuDataText(d))}</div>
        <div class="reu-prev-hores">
          ${perDia[d].map(f => {
            const clau = f.data + ' ' + f.inici;
            const treta = !!_reuExclou[clau];
            const xoc = !!f.xoc;
            const cls = 'reu-prev-h' + (xoc ? ' reu-prev-xoc' : (treta ? ' reu-prev-treta' : ''));
            const tit = xoc ? 'Ja tens: ' + escapeHtml(f.xoc) : (treta ? 'Tornar-la a oferir' : 'Treure aquesta hora');
            return `<button class="${cls}" title="${tit}" ${xoc ? 'disabled' : ''} onclick="_reuToggleExclou('${clau}')">${escapeHtml(f.inici)}</button>`;
          }).join('')}
        </div>
      </div>`).join('');
}

function _reuToggleExclou(clau) {
  if (_reuExclou[clau]) delete _reuExclou[clau]; else _reuExclou[clau] = true;
  _reuPintaPreview();
}

/* ---------- desar ---------- */
function _reuDades() {
  const perDia = {};
  Object.keys(_reuPerDia).forEach(k => {
    const nets = (_reuPerDia[k] || []).filter(t => t.inici && t.fi && t.fi > t.inici);
    if (nets.length) perDia[k] = nets;
  });
  return {
    titol: document.getElementById('reuTitol').value.trim(),
    descripcio: document.getElementById('reuDesc').value.trim(),
    lloc: document.getElementById('reuLloc').value.trim(),
    durada: parseInt(document.getElementById('reuDurada').value, 10),
    buffer: parseInt(document.getElementById('reuBuffer').value, 10),
    desDe: document.getElementById('reuDesDe').value,
    finsA: document.getElementById('reuFinsA').value,
    perDia: perDia,
    exclou: Object.keys(_reuExclou).filter(k => _reuExclou[k]),
    evitarOcupats: document.getElementById('reuEvitar').checked,
    avisar: document.getElementById('reuAvisar').checked,
    maxPersona: document.getElementById('reuMaxPersona').checked ? 1 : 0,
  };
}

async function creaReuCalendari() {
  const btn = document.getElementById('reuCrearBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Creant…'; }
  try {
    const r = await appsScriptPost({ action: 'reunionsCrea', dades: _reuDades() });
    if (r && r.ok) {
      tancaReuNou();
      let msg = r.franges + ' hores creades';
      if (r.saltades) msg += ' (' + r.saltades + ' saltades)';
      showToast(msg + ' ✓', 'success');
      await initReunions();
    } else {
      showToast((r && r.error) || 'No s\'ha pogut crear', 'error');
    }
  } catch (e) {
    showToast('No s\'ha pogut crear: ' + e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Crear i generar l\'enllaç'; }
  }
}

function _reuMuntaModal() {
  const ov = document.createElement('div');
  ov.className = 'modal-overlay';
  ov.id = 'reuNouOverlay';
  ov.addEventListener('mousedown', e => { if (e.target === ov) tancaReuNou(); });
  ov.innerHTML = `
    <div class="modal" style="max-width:600px">
      <div class="modal-header">
        <div>
          <div class="modal-header-title">Nou calendari de reunions</div>
          <div class="modal-header-sub">Digues quan tens lliure i l'app farà l'enllaç</div>
        </div>
        <button class="modal-close" onclick="tancaReuNou()" aria-label="Tancar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="modal-body">

        <div id="reuPas1">
          <div class="modal-field">
            <label class="modal-label" for="reuTitol">Títol</label>
            <input class="modal-input" id="reuTitol" placeholder="Ex: Reunions de tutoria · 1r trimestre">
          </div>

          <div class="modal-field">
            <div class="modal-label">De quin dia a quin dia</div>
            <div class="reu-afegir">
              <input class="modal-input" id="reuDesDe" type="date" aria-label="Des del dia">
              <span class="reu-fins">al</span>
              <input class="modal-input" id="reuFinsA" type="date" aria-label="Fins al dia">
            </div>
          </div>

          <div class="reu-dos">
            <div class="modal-field">
              <label class="modal-label" for="reuDurada">Cada reunió dura</label>
              <select class="modal-input" id="reuDurada">
                <option value="10">10 minuts</option>
                <option value="15">15 minuts</option>
                <option value="20">20 minuts</option>
                <option value="30">30 minuts</option>
                <option value="45">45 minuts</option>
                <option value="60">1 hora</option>
              </select>
            </div>
            <div class="modal-field">
              <label class="modal-label" for="reuBuffer">Descans entremig</label>
              <select class="modal-input" id="reuBuffer">
                <option value="0">Sense descans</option>
                <option value="5">5 minuts</option>
                <option value="10">10 minuts</option>
                <option value="15">15 minuts</option>
              </select>
            </div>
          </div>

          <div class="modal-field">
            <div class="modal-label">Quines hores tens lliures cada dia</div>
            <div id="reuDiesSetmana" class="reu-dies"></div>
            <div class="modal-hint">Marca els dies que t'interessin i posa-hi la teva hora. Cada dia pot ser diferent.</div>
          </div>

          <div class="modal-field">
            <label class="modal-label" for="reuLloc">On <span class="reu-opc">(opcional)</span></label>
            <input class="modal-input" id="reuLloc" placeholder="Ex: Aula de 2n C, o enllaç de videotrucada">
          </div>
          <div class="modal-field">
            <label class="modal-label" for="reuDesc">Descripció <span class="reu-opc">(opcional)</span></label>
            <textarea class="modal-input" id="reuDesc" rows="2" placeholder="Ex: Una estona per parlar de com va el curs."></textarea>
          </div>

          <label class="gwrite-row">
            <input type="checkbox" id="reuEvitar" checked>
            <span>No oferir hores que ja tinc ocupades al Google Calendar</span>
          </label>
          <label class="gwrite-row">
            <input type="checkbox" id="reuAvisar" checked>
            <span>Enviar la invitació per correu a qui reservi</span>
          </label>
          <label class="gwrite-row">
            <input type="checkbox" id="reuMaxPersona" checked>
            <span>Només una reserva per persona</span>
          </label>
        </div>

        <div id="reuPas2" style="display:none">
          <div id="reuPreviewCont"></div>
        </div>

      </div>
      <div class="modal-footer" id="reuPeu"></div>
    </div>`;
  document.body.appendChild(ov);
  return ov;
}
