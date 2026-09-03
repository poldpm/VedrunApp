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
  const s = _reuNormData(d);
  if (!s) return String(d || '');    // no s'entén: es diu tal qual, no "Undefined NaN"
  const p = s.split('-');
  const dt = new Date(+p[0], +p[1] - 1, +p[2]);
  return _REU_DIES[dt.getDay()] + ', ' + (+p[2]) + ' de ' + _REU_MESOS[+p[1] - 1];
}
function _reuDataCurta(d) {
  const s = _reuNormData(d);
  if (!s) return '';                 // millor no dir res que dir "NaN/NaN"
  const p = s.split('-');
  return (+p[2]) + '/' + (+p[1]);
}
/* «del 8/9 al 7/10», o res si les dates no s'entenen. Abans sortia
   «del NaN/NaN al NaN/NaN», que no diu res a ningú. */
function _reuTramDates(c) {
  const a = _reuDataCurta(c.desDe), b = _reuDataCurta(c.finsA);
  return (a && b) ? ' · del ' + a + ' al ' + b : '';
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
          ${_reuTramDates(c)}
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

      ${((c.horesLliures || []).length || reserves.length) ? `
      <div class="reu-reserves">
        <div class="reu-reserves-tit">Les hores d'aquest calendari</div>
        ${_reuCalendari(c)}
      </div>` : ''}

      ${reserves.length ? `
      <div class="reu-reserves">
        <div class="reu-reserves-tit">Qui ha reservat</div>
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
        ${c.acabat ? '' : `<button class="btn btn-secondary btn-sm" onclick="obreReuAfegir('${c.id}')">+ Afegir hores</button>`}
        ${c.acabat ? '' : `<button class="btn btn-ghost btn-sm" onclick="obreReuMissatge('${c.id}')">Missatge de confirmació${c.missatge ? ' ✓' : ''}</button>`}
        ${c.acabat ? '' : `<button class="btn btn-ghost btn-sm" onclick="reuActiva('${c.id}', ${tancat ? 'true' : 'false'})">${tancat ? 'Tornar a obrir' : 'Tancar reserves'}</button>`}
        <button class="btn btn-ghost btn-sm reu-del" onclick="reuEsborra('${c.id}')">Esborrar</button>
      </div>
    </div>`;
  }).join('');
}

/* ── LES HORES, EN CALENDARI ──────────────────────────────────────────────
   Abans era una llista plana: amb tres setmanes d'hores sortien centenars
   de botons un darrere l'altre i no s'hi entenia res. Ara es veu el mes
   com al calendari de l'app —mateixa graella i mateixos colors— amb el
   compte de cada dia, i les hores concretes surten només en clicar el dia.
   Així la pantalla diu d'un cop d'ull "quins dies tinc gent" en lloc de
   fer-te llegir dues-centes hores seguides.                              */

let _reuDiaObert = {};   // { calId: 'YYYY-MM-DD' }

const _REU_COLS = ['DL', 'DM', 'DC', 'DJ', 'DV', 'DS', 'DG'];

/* ── ENTENDRE LES DATES VINGUIN COM VINGUIN ──────────────────────────────
   El servidor hauria de donar sempre "2026-09-10" i "17:00", però si el
   Apps Script encara no s'ha redesplegat dona el que el full li torna:
   "Wed Sep 10 2026 00:00:00 GMT+0200 (…)" i "Sat Dec 30 1899 17:20:00 …".
   Aquí es recupera el que es pugui, en comptes de pintar "Undefined NaN"
   i una graella buida com passava el 4 de setembre del 2026.            */
function _reuNormData(v) {
  const s = String(v == null ? '' : v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (!isNaN(d.getTime()) && d.getFullYear() > 2000) {
    const p = n => (n < 10 ? '0' : '') + n;
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  return null;                       // no s'entén: NO es llença, es mostra a part
}
/* L'hora es LLEGEIX del text, no s'interpreta. Si es fa
   `new Date("Sat Dec 30 1899 15:00:00 GMT+0014")` i se'n treu l'hora, el
   desfasament horari de 1899 la mou mitja hora: les 15:00 sortien com a
   14:31. Buscant els dígits no hi ha cap càlcul que pugui fallar. */
function _reuNormHora(v) {
  const s = String(v == null ? '' : v).trim();
  const m = s.match(/(\d{1,2}):(\d{2})/);          // en qualsevol lloc del text
  if (m) {
    const h = Math.min(23, parseInt(m[1], 10));
    return ('0' + h).slice(-2) + ':' + m[2];
  }
  return s;
}

/* Totes les hores del calendari (lliures i reservades) indexades per dia.
   Les que no tenen data entenedora van a `soltes`: mai es perden de vista. */
function _reuHoresPerDia(c) {
  const perDia = {}, soltes = [];
  const posa = (h, estat) => {
    if (!h) return;
    const d = _reuNormData(h.data);
    const n = Object.assign({}, h, { estat, inici: _reuNormHora(h.inici), fi: _reuNormHora(h.fi) });
    if (!d) { soltes.push(n); return; }
    n.data = d;
    (perDia[d] = perDia[d] || []).push(n);
  };
  (c.horesLliures || []).forEach(h => posa(h, 'lliure'));
  (c.reserves || []).forEach(h => posa(h, 'ocupat'));
  Object.keys(perDia).forEach(d => perDia[d].sort((a, b) => String(a.inici).localeCompare(String(b.inici))));
  perDia._soltes = soltes;
  return perDia;
}

function _reuCalendari(c) {
  const perDia = _reuHoresPerDia(c);
  const soltes = perDia._soltes || [];
  const dies = Object.keys(perDia).filter(k => k !== '_soltes').sort();

  // Les que no s'han pogut situar en cap dia es mostren igualment. Abans
  // desapareixien i quedava un calendari buit amb "16 lliures" a dalt.
  const blocSoltes = soltes.length ? `
    <div class="reucal-soltes">
      <strong>${soltes.length} ${soltes.length === 1 ? 'hora' : 'hores'} que l'app no sap a quin dia van.</strong>
      Segurament el servidor (Apps Script) encara no s'ha tornat a desplegar.
      <div class="reucal-hores">
        ${soltes.map(h => `<span class="reucal-h reucal-h-ple">${escapeHtml(h.inici || '?')}</span>`).join('')}
      </div>
    </div>` : '';

  if (!dies.length) return blocSoltes;

  // Només els mesos que tenen hores: així no cal navegar enlloc.
  const mesos = [];
  dies.forEach(d => { const m = d.slice(0, 7); if (mesos.indexOf(m) === -1) mesos.push(m); });

  const obert = _reuDiaObert[c.id];
  const avui = new Date(); avui.setHours(0, 0, 0, 0);

  const graelles = mesos.map(m => {
    const any = +m.slice(0, 4), mes = +m.slice(5, 7) - 1;
    const primer = new Date(any, mes, 1);
    const buits = (primer.getDay() + 6) % 7;               // dilluns primer
    const nDies = new Date(any, mes + 1, 0).getDate();

    // Es munten totes les caselles i després es llencen les SETMANES
    // senceres que no tenen cap hora: si no, un calendari de dues setmanes
    // arrossegava mig mes de caselles buides per res.
    const caselles = [];
    for (let i = 0; i < buits; i++) caselles.push({ te: false, html: '<div class="reucal-cel reucal-buit" aria-hidden="true"></div>' });
    for (let d = 1; d <= nDies; d++) {
      const clau = any + '-' + ('0' + (mes + 1)).slice(-2) + '-' + ('0' + d).slice(-2);
      const hs = perDia[clau] || [];
      const lliures = hs.filter(h => h.estat === 'lliure').length;
      const plenes  = hs.length - lliures;
      const esAvui  = new Date(any, mes, d).getTime() === avui.getTime();

      if (!hs.length) {
        caselles.push({ te: false, html:
          `<div class="reucal-cel reucal-sense${esAvui ? ' reucal-avui' : ''}">
             <span class="reucal-dia">${d}</span></div>` });
        continue;
      }
      const etiqueta = _reuDataText(clau) + ': ' +
        (lliures ? lliures + ' ' + (lliures === 1 ? 'hora lliure' : 'hores lliures') : 'cap hora lliure') +
        (plenes ? ', ' + plenes + ' ' + (plenes === 1 ? 'reservada' : 'reservades') : '');
      caselles.push({ te: true, html:
        `<button type="button"
           class="reucal-cel reucal-te${esAvui ? ' reucal-avui' : ''}${obert === clau ? ' reucal-obert' : ''}"
           aria-pressed="${obert === clau ? 'true' : 'false'}"
           aria-label="${escapeHtml(etiqueta)}"
           onclick="reuObreDia('${c.id}','${clau}')">
           <span class="reucal-dia">${d}</span>
           <span class="reucal-comptes">
             ${lliures ? `<span class="reucal-n reucal-n-lliure">${lliures}</span>` : ''}
             ${plenes ? `<span class="reucal-n reucal-n-ple">${plenes}</span>` : ''}
           </span>
         </button>` });
    }
    while (caselles.length % 7) caselles.push({ te: false, html: '<div class="reucal-cel reucal-buit" aria-hidden="true"></div>' });

    let cel = '';
    for (let i = 0; i < caselles.length; i += 7) {
      const setmana = caselles.slice(i, i + 7);
      if (setmana.some(x => x.te)) cel += setmana.map(x => x.html).join('');
    }

    return `<div class="reucal-mes">
      <div class="reucal-mes-nom">${_REU_MESOS[mes]} ${any}</div>
      <div class="reucal-caps">${_REU_COLS.map(x => `<span>${x}</span>`).join('')}</div>
      <div class="reucal-graella">${cel}</div>
    </div>`;
  }).join('');

  return `<div class="reucal">
    ${blocSoltes}
    ${graelles}
    <p class="reucal-llegenda">
      <span class="reucal-mostra reucal-n-lliure"></span> hores lliures
      <span class="reucal-mostra reucal-n-ple"></span> ja reservades
      <span class="reucal-ajuda">Clica un dia per veure'n les hores.</span>
    </p>
    ${_reuDetallDia(c, perDia)}
  </div>`;
}

/* Les hores del dia triat. Fins que no en tries cap, no ocupa pantalla. */
function _reuDetallDia(c, perDia) {
  const d = _reuDiaObert[c.id];
  if (!d || !perDia[d]) return '';
  return `<div class="reucal-detall" role="group" aria-label="Hores del ${escapeHtml(_reuDataText(d))}">
    <div class="reucal-detall-cap">
      <strong>${escapeHtml(_reuDataText(d))}</strong>
      <button type="button" class="reucal-tanca" aria-label="Tancar el dia"
              onclick="reuObreDia('${c.id}','${d}')">×</button>
    </div>
    <div class="reucal-hores">
      ${perDia[d].map(h => h.estat === 'ocupat'
        ? `<span class="reucal-h reucal-h-ple" title="Reservada per ${escapeHtml(h.nom || '')}">
             ${escapeHtml(h.inici)}<em>${escapeHtml(h.nom || 'reservada')}</em></span>`
        : `<button type="button" class="reucal-h reucal-h-lliure"
             title="Treure les ${escapeHtml(h.inici)}"
             onclick="reuTreuHora('${c.id}','${h.slotId}','${escapeHtml(_reuDataText(d))}','${escapeHtml(h.inici)}')">
             ${escapeHtml(h.inici)}<span class="reucal-x" aria-hidden="true">×</span></button>`).join('')}
    </div>
    <p class="modal-hint">Clica una hora lliure per treure-la: deixarà de sortir a les famílies a l'instant.</p>
  </div>`;
}

function reuObreDia(calId, dia) {
  _reuDiaObert[calId] = (_reuDiaObert[calId] === dia) ? null : dia;
  _renderReunions();
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
   AFEGIR HORES A UN CALENDARI JA ENVIAT
   ------------------------------------------------------------
   Cas de sempre: ja has enviat l'enllaç i et queda lliure una
   estona que no havies ofert. S'afegeixen estones (un dia i de
   quina hora a quina hora) i el servidor les parteix amb la
   durada i el descans que ja té aquell calendari.
   ============================================================ */
let _reuAfegirCal = null;
let _reuAfegirEstones = [];

function obreReuAfegir(calId) {
  const c = _reuCals.find(x => x.id === calId);
  if (!c) return;
  _reuAfegirCal = c;
  _reuAfegirEstones = [];
  let ov = document.getElementById('reuAfegirOverlay');
  if (!ov) ov = _reuMuntaAfegir();
  document.getElementById('reuAfSub').textContent = c.titol + ' · reunions de ' + c.durada + ' min';
  const p = n => (n < 10 ? '0' : '') + n;
  const d = new Date(); d.setDate(d.getDate() + 1);
  document.getElementById('reuAfData').value = d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  document.getElementById('reuAfIni').value = '17:00';
  document.getElementById('reuAfFi').value = '18:00';
  _reuPintaAfegir();
  ov.classList.add('open');
  setTimeout(() => document.getElementById('reuAfData').focus(), 80);
}
function tancaReuAfegir() {
  const ov = document.getElementById('reuAfegirOverlay');
  if (ov) ov.classList.remove('open');
}

function _reuAfegeixEstona() {
  const data = document.getElementById('reuAfData').value;
  const ini = document.getElementById('reuAfIni').value;
  const fi = document.getElementById('reuAfFi').value;
  if (!data || !ini || !fi) { showToast('Omple el dia i les hores', 'error'); return; }
  if (data < _reuAvui()) { showToast('Aquest dia ja ha passat', 'error'); return; }
  if (fi <= ini) { showToast('L\'hora de final ha de ser més tard', 'error'); return; }
  // no repetim la mateixa estona ni deixem que es trepitgin entre elles
  for (const e of _reuAfegirEstones) {
    if (e.data === data && ini < e.fi && e.inici < fi) {
      showToast('Aquesta estona es trepitja amb la de ' + e.inici + '–' + e.fi, 'error'); return;
    }
  }
  _reuAfegirEstones.push({ data, inici: ini, fi });
  _reuAfegirEstones.sort((a, b) => (a.data + a.inici).localeCompare(b.data + b.inici));
  _reuPintaAfegir();
}
function _reuTreuEstona(i) { _reuAfegirEstones.splice(i, 1); _reuPintaAfegir(); }

function _reuPintaAfegir() {
  const c = document.getElementById('reuAfLlista');
  if (!c) return;
  if (!_reuAfegirEstones.length) {
    c.innerHTML = '<span class="modal-hint">Encara no has afegit cap estona.</span>';
  } else {
    const dur = _reuAfegirCal ? _reuAfegirCal.durada : 15;
    const buf = 0;
    c.innerHTML = _reuAfegirEstones.map((e, i) => {
      const m = h => (+h.split(':')[0]) * 60 + (+h.split(':')[1]);
      let n = 0;
      for (let x = m(e.inici); x + dur <= m(e.fi); x += dur + buf) n++;
      return `<span class="reu-chip">${_reuDataText(e.data)} · ${e.inici}–${e.fi}
        <em class="reu-chip-n">${n} hore${n === 1 ? '' : 's'}</em>
        <button onclick="_reuTreuEstona(${i})" aria-label="Treure">×</button></span>`;
    }).join('');
  }
  const b = document.getElementById('reuAfDesa');
  if (b) b.disabled = !_reuAfegirEstones.length;
}

async function desaReuAfegir() {
  if (!_reuAfegirCal || !_reuAfegirEstones.length) return;
  const b = document.getElementById('reuAfDesa');
  if (b) { b.disabled = true; b.textContent = 'Afegint…'; }
  try {
    const r = await appsScriptPost({ action: 'reunionsAfegeixHores', calId: _reuAfegirCal.id, hores: _reuAfegirEstones });
    if (r && r.ok) {
      tancaReuAfegir();
      let msg = r.afegides + ' hore' + (r.afegides === 1 ? '' : 's') + ' afegide' + (r.afegides === 1 ? 's' : 's');
      if (r.jaHiEren) msg += ' · ' + r.jaHiEren + ' ja hi eren';
      if (r.xoquen) msg += ' · ' + r.xoquen + ' xoquen amb el teu calendari';
      showToast(msg + ' ✓', 'success');
      await initReunions();
    } else {
      showToast((r && r.error) || 'No s\'ha pogut afegir', 'error');
    }
  } finally {
    if (b) { b.disabled = false; b.textContent = 'Afegir-les'; }
  }
}

function _reuMuntaAfegir() {
  const ov = document.createElement('div');
  ov.className = 'modal-overlay';
  ov.id = 'reuAfegirOverlay';
  ov.addEventListener('mousedown', e => { if (e.target === ov) tancaReuAfegir(); });
  ov.innerHTML = `
    <div class="modal" style="max-width:520px">
      <div class="modal-header">
        <div>
          <div class="modal-header-title">Afegir hores</div>
          <div class="modal-header-sub" id="reuAfSub"></div>
        </div>
        <button class="modal-close" onclick="tancaReuAfegir()" aria-label="Tancar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="modal-body">
        <div class="modal-field">
          <div class="modal-label">Quin dia i de quina hora a quina hora</div>
          <div class="reu-afegir">
            <input class="modal-input" id="reuAfData" type="date" aria-label="Dia">
            <input class="modal-input" id="reuAfIni" type="time" aria-label="Des de">
            <span class="reu-fins">a</span>
            <input class="modal-input" id="reuAfFi" type="time" aria-label="Fins a">
            <button class="btn btn-secondary btn-sm" onclick="_reuAfegeixEstona()">Afegir</button>
          </div>
          <div class="reu-chips" id="reuAfLlista"></div>
          <div class="modal-hint">Pots afegir-hi diverses estones de dies diferents abans de desar.</div>
        </div>
        <div class="callout-mini">
          Es partiran amb la durada i el descans que ja té aquest calendari.
          Les que xoquin amb el teu Google Calendar o amb hores que ja hi ha, no s'afegiran.
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="tancaReuAfegir()">Cancel·lar</button>
        <button class="btn btn-primary" id="reuAfDesa" onclick="desaReuAfegir()" disabled>Afegir-les</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  return ov;
}

/* ============================================================
   EL MISSATGE QUE VEU QUI RESERVA
   ------------------------------------------------------------
   Si es deixa buit, la pàgina pública hi posa el de sempre.
   Serveix per donar indicacions: on entrar, què portar…
   ============================================================ */
const REU_MSG_DEFECTE = 'Ho hem apuntat. Si no hi pots venir, respon el correu amb què t\'han enviat l\'enllaç.';
let _reuMsgCal = null;

function obreReuMissatge(calId) {
  const c = _reuCals.find(x => x.id === calId);
  if (!c) return;
  _reuMsgCal = c;
  let ov = document.getElementById('reuMsgOverlay');
  if (!ov) ov = _reuMuntaMissatge();
  document.getElementById('reuMsgSub').textContent = c.titol;
  document.getElementById('reuMsgText').value = c.missatge || '';
  _reuMsgCompta();
  ov.classList.add('open');
  setTimeout(() => document.getElementById('reuMsgText').focus(), 80);
}
function tancaReuMissatge() {
  const ov = document.getElementById('reuMsgOverlay');
  if (ov) ov.classList.remove('open');
}
function _reuMsgCompta() {
  const t = document.getElementById('reuMsgText'), c = document.getElementById('reuMsgCompta');
  if (!t || !c) return;
  const n = t.value.length;
  c.textContent = n ? n + ' de 600 caràcters' : 'Buit: sortirà el missatge de sempre.';
}
async function desaReuMissatge() {
  if (!_reuMsgCal) return;
  const txt = document.getElementById('reuMsgText').value.trim();
  const b = document.getElementById('reuMsgDesa');
  if (b) { b.disabled = true; b.textContent = 'Desant…'; }
  try {
    const r = await appsScriptPost({ action: 'reunionsMissatge', calId: _reuMsgCal.id, missatge: txt });
    if (r && r.ok) {
      tancaReuMissatge();
      showToast(txt ? 'Missatge desat ✓' : 'Tornarà a sortir el missatge de sempre', 'success');
      await initReunions();
    } else showToast((r && r.error) || 'No s\'ha pogut desar', 'error');
  } finally {
    if (b) { b.disabled = false; b.textContent = 'Desar'; }
  }
}

function _reuMuntaMissatge() {
  const ov = document.createElement('div');
  ov.className = 'modal-overlay';
  ov.id = 'reuMsgOverlay';
  ov.addEventListener('mousedown', e => { if (e.target === ov) tancaReuMissatge(); });
  ov.innerHTML = `
    <div class="modal" style="max-width:520px">
      <div class="modal-header">
        <div>
          <div class="modal-header-title">Missatge de confirmació</div>
          <div class="modal-header-sub" id="reuMsgSub"></div>
        </div>
        <button class="modal-close" onclick="tancaReuMissatge()" aria-label="Tancar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="modal-body">
        <p class="modal-hint" style="margin-bottom:10px">És el que llegeix la persona just després de triar la seva hora. Aprofita-ho per donar indicacions.</p>
        <div class="modal-field">
          <label class="modal-label" for="reuMsgText">El teu missatge <span class="reu-opc">(opcional)</span></label>
          <textarea class="modal-input" id="reuMsgText" rows="4" maxlength="600" oninput="_reuMsgCompta()"
            placeholder="Ex: Entra per la porta del carrer Nou i espera a recepció. Si no hi pots venir, escriu-me."></textarea>
          <div class="modal-hint" id="reuMsgCompta"></div>
        </div>
        <div class="callout-mini">
          <strong>Si el deixes buit</strong> sortirà el de sempre:<br>
          <em>«${REU_MSG_DEFECTE}»</em>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="tancaReuMissatge()">Cancel·lar</button>
        <button class="btn btn-primary" id="reuMsgDesa" onclick="desaReuMissatge()">Desar</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  return ov;
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
  const _m = document.getElementById('reuMissatgeNou'); if (_m) _m.value = '';
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
    missatge: (document.getElementById('reuMissatgeNou') || { value: '' }).value.trim(),
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
    // Clau d'aquest intent. Si la crida triga massa i el navegador la torna
    // a enviar, hi va la MATEIXA clau i el servidor sap que ja ho ha fet:
    // sense això sortien dos calendaris iguals.
    const dades = _reuDades();
    dades.opId = 'c' + Date.now() + Math.random().toString(36).slice(2, 8);
    const r = await appsScriptPost({ action: 'reunionsCrea', dades });
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
            <input class="modal-input" id="reuLloc" placeholder="Ex: la meva aula, o un enllaç de videotrucada">
          </div>
          <div class="modal-field">
            <label class="modal-label" for="reuMissatgeNou">Missatge en confirmar l'hora <span class="reu-opc">(opcional)</span></label>
            <textarea class="modal-input" id="reuMissatgeNou" rows="2" maxlength="600"
              placeholder="Ex: Entra per la porta del carrer Nou i espera a recepció."></textarea>
            <div class="modal-hint">És el que llegirà la persona just després de triar l'hora. Si ho deixes buit, hi surt el missatge de sempre. Ho pots canviar més endavant.</div>
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
