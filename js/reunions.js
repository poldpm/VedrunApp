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
   ============================================================ */
let _reuDies = [];    // ['2026-09-15', ...]
let _reuTrams = [];   // [{inici:'17:00', fi:'19:00'}]

function obreReuNou() {
  _reuDies = []; _reuTrams = [];
  let ov = document.getElementById('reuNouOverlay');
  if (!ov) { ov = _reuMuntaModal(); }
  document.getElementById('reuTitol').value = '';
  document.getElementById('reuDesc').value = '';
  document.getElementById('reuLloc').value = '';
  document.getElementById('reuDurada').value = '15';
  document.getElementById('reuBuffer').value = '0';
  document.getElementById('reuMaxPersona').checked = true;
  document.getElementById('reuEvitar').checked = true;
  document.getElementById('reuAvisar').checked = true;
  const d = new Date(); d.setDate(d.getDate() + 7);
  const p = n => (n < 10 ? '0' : '') + n;
  document.getElementById('reuNovaData').value = d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  document.getElementById('reuTramIni').value = '17:00';
  document.getElementById('reuTramFi').value = '19:00';
  _reuPintaDies(); _reuPintaTrams(); _reuPintaResum();
  ov.classList.add('open');
  setTimeout(() => document.getElementById('reuTitol').focus(), 80);
}
function tancaReuNou() {
  const ov = document.getElementById('reuNouOverlay');
  if (ov) ov.classList.remove('open');
}

function _reuMuntaModal() {
  const ov = document.createElement('div');
  ov.className = 'modal-overlay';
  ov.id = 'reuNouOverlay';
  ov.addEventListener('mousedown', e => { if (e.target === ov) tancaReuNou(); });
  ov.innerHTML = `
    <div class="modal" style="max-width:560px">
      <div class="modal-header">
        <div>
          <div class="modal-header-title">Nou calendari de reunions</div>
          <div class="modal-header-sub">Marca quan tens lliure i l'app farà l'enllaç</div>
        </div>
        <button class="modal-close" onclick="tancaReuNou()" aria-label="Tancar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="modal-body">
        <div class="modal-field">
          <label class="modal-label" for="reuTitol">Títol</label>
          <input class="modal-input" id="reuTitol" placeholder="Ex: Reunions de tutoria · 1r trimestre">
          <div class="modal-hint">És el que veuran les famílies, i el que sortirà al teu calendari.</div>
        </div>
        <div class="modal-field">
          <label class="modal-label" for="reuDesc">Descripció <span class="reu-opc">(opcional)</span></label>
          <textarea class="modal-input" id="reuDesc" rows="2" placeholder="Ex: Una estona per parlar de com va el curs."></textarea>
        </div>
        <div class="modal-field">
          <label class="modal-label" for="reuLloc">On <span class="reu-opc">(opcional)</span></label>
          <input class="modal-input" id="reuLloc" placeholder="Ex: Aula de 2n C, o enllaç de videotrucada">
        </div>

        <div class="reu-dos">
          <div class="modal-field">
            <label class="modal-label" for="reuDurada">Quant dura cada reunió</label>
            <select class="modal-input" id="reuDurada" onchange="_reuPintaResum()">
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
            <select class="modal-input" id="reuBuffer" onchange="_reuPintaResum()">
              <option value="0">Sense descans</option>
              <option value="5">5 minuts</option>
              <option value="10">10 minuts</option>
              <option value="15">15 minuts</option>
            </select>
          </div>
        </div>

        <div class="modal-field">
          <div class="modal-label">Quins dies</div>
          <div class="reu-afegir">
            <input class="modal-input" id="reuNovaData" type="date">
            <button class="btn btn-secondary btn-sm" onclick="_reuAfegeixDia()">Afegir dia</button>
          </div>
          <div class="reu-chips" id="reuDiesChips"></div>
        </div>

        <div class="modal-field">
          <div class="modal-label">A quines hores (cada dia)</div>
          <div class="reu-afegir">
            <input class="modal-input" id="reuTramIni" type="time">
            <span class="reu-fins">a</span>
            <input class="modal-input" id="reuTramFi" type="time">
            <button class="btn btn-secondary btn-sm" onclick="_reuAfegeixTram()">Afegir</button>
          </div>
          <div class="reu-chips" id="reuTramsChips"></div>
          <div class="modal-hint">Pots posar-hi més d'una franja (per exemple, matí i tarda).</div>
        </div>

        <div class="reu-resum" id="reuResum"></div>

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
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="tancaReuNou()">Cancel·lar</button>
        <button class="btn btn-primary" id="reuCrearBtn" onclick="creaReuCalendari()">Crear i generar l'enllaç</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  return ov;
}

function _reuAfegeixDia() {
  const el = document.getElementById('reuNovaData');
  const d = el.value;
  if (!d) return;
  if (d < _reuAvui()) { showToast('Aquest dia ja ha passat', 'error'); return; }
  if (_reuDies.includes(d)) { showToast('Aquest dia ja hi és', 'error'); return; }
  _reuDies.push(d); _reuDies.sort();
  // Proposa el mateix dia de la setmana següent, que és el més habitual
  const p = String(d).split('-');
  const seg = new Date(+p[0], +p[1] - 1, +p[2] + 7);
  const q = n => (n < 10 ? '0' : '') + n;
  el.value = seg.getFullYear() + '-' + q(seg.getMonth() + 1) + '-' + q(seg.getDate());
  _reuPintaDies(); _reuPintaResum();
}
function _reuTreuDia(d) { _reuDies = _reuDies.filter(x => x !== d); _reuPintaDies(); _reuPintaResum(); }
function _reuPintaDies() {
  const c = document.getElementById('reuDiesChips');
  if (!c) return;
  c.innerHTML = _reuDies.length
    ? _reuDies.map(d => `<span class="reu-chip">${_reuDataText(d)}<button onclick="_reuTreuDia('${d}')" aria-label="Treure">×</button></span>`).join('')
    : '<span class="modal-hint">Encara no has triat cap dia.</span>';
}

function _reuAfegeixTram() {
  const i = document.getElementById('reuTramIni').value;
  const f = document.getElementById('reuTramFi').value;
  if (!i || !f) return;
  if (f <= i) { showToast('L\'hora de final ha de ser més tard que la d\'inici', 'error'); return; }
  // No deixem posar franges que es trepitgin: confondria la mestra
  for (const t of _reuTrams) if (i < t.fi && t.inici < f) {
    showToast('Aquesta franja es trepitja amb la de ' + t.inici + '–' + t.fi, 'error'); return;
  }
  _reuTrams.push({ inici: i, fi: f });
  _reuTrams.sort((a, b) => a.inici.localeCompare(b.inici));
  _reuPintaTrams(); _reuPintaResum();
}
function _reuTreuTram(i) { _reuTrams.splice(i, 1); _reuPintaTrams(); _reuPintaResum(); }
function _reuPintaTrams() {
  const c = document.getElementById('reuTramsChips');
  if (!c) return;
  c.innerHTML = _reuTrams.length
    ? _reuTrams.map((t, i) => `<span class="reu-chip">${t.inici}–${t.fi}<button onclick="_reuTreuTram(${i})" aria-label="Treure">×</button></span>`).join('')
    : '<span class="modal-hint">Encara no has posat cap franja horària.</span>';
}

/* Quantes hores sortiran. És una estimació: el servidor pot saltar-ne
   si xoquen amb coses que ja tens al calendari. */
function _reuPintaResum() {
  const el = document.getElementById('reuResum');
  if (!el) return;
  const dur = parseInt((document.getElementById('reuDurada') || {}).value, 10) || 15;
  const buf = parseInt((document.getElementById('reuBuffer') || {}).value, 10) || 0;
  if (!_reuDies.length || !_reuTrams.length) {
    el.innerHTML = '<span class="modal-hint">Tria com a mínim un dia i una franja horària.</span>';
    return;
  }
  let perDia = 0;
  _reuTrams.forEach(t => {
    const m0 = (+t.inici.split(':')[0]) * 60 + (+t.inici.split(':')[1]);
    const m1 = (+t.fi.split(':')[0]) * 60 + (+t.fi.split(':')[1]);
    for (let m = m0; m + dur <= m1; m += dur + buf) perDia++;
  });
  const total = perDia * _reuDies.length;
  el.innerHTML = total
    ? `<strong>${total} hores</strong> per repartir: ${perDia} cada dia × ${_reuDies.length} dies.`
    : '<span class="modal-hint">Amb aquesta durada no hi cap cap reunió a la franja que has posat.</span>';
}

async function creaReuCalendari() {
  const titol = document.getElementById('reuTitol').value.trim();
  if (!titol) { showToast('Posa-hi un títol', 'error'); document.getElementById('reuTitol').focus(); return; }
  if (!_reuDies.length) { showToast('Tria com a mínim un dia', 'error'); return; }
  if (!_reuTrams.length) { showToast('Posa com a mínim una franja horària', 'error'); return; }

  const btn = document.getElementById('reuCrearBtn');
  btn.disabled = true; btn.textContent = 'Creant…';
  try {
    const r = await appsScriptPost({
      action: 'reunionsCrea',
      dades: {
        titol,
        descripcio: document.getElementById('reuDesc').value.trim(),
        lloc: document.getElementById('reuLloc').value.trim(),
        durada: parseInt(document.getElementById('reuDurada').value, 10),
        buffer: parseInt(document.getElementById('reuBuffer').value, 10),
        dies: _reuDies, trams: _reuTrams,
        evitarOcupats: document.getElementById('reuEvitar').checked,
        avisar: document.getElementById('reuAvisar').checked,
        maxPersona: document.getElementById('reuMaxPersona').checked ? 1 : 0,
      }
    });
    if (r && r.ok) {
      tancaReuNou();
      let msg = r.franges + ' hores creades';
      if (r.saltades) msg += ' (' + r.saltades + ' saltades perquè ja les tenies ocupades)';
      showToast(msg + ' ✓', 'success');
      await initReunions();
    } else {
      showToast((r && r.error) || 'No s\'ha pogut crear', 'error');
    }
  } catch (e) {
    showToast('No s\'ha pogut crear: ' + e.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Crear i generar l\'enllaç';
  }
}
