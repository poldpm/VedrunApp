/* ============================================================
   ENTREVISTES AMB LES FAMÍLIES — entrevistes.js
   ------------------------------------------------------------
   Marcar si s'ha quedat amb la família, quin dia i a quina hora,
   i apuntar com ha anat. Amb alguns alumnes se'n van fent de
   seguiment, per això cada alumne en pot tenir moltes.

   Això NO és el registre oficial (que va en una altra app): és
   per tenir-ho a mà i, sobretot, per veure d'un cop d'ull a
   quin alumne encara no se n'ha fet cap.

   ⚠ El que escrius de com ha anat es queda al TEU full. Al full
   compartit hi va només si se n'ha fet i quan, perquè direcció
   pugui portar el control sense llegir el que has apuntat d'una
   família. Això es decideix al Code.gs, no aquí.
   ============================================================ */

let _entrevistes = {};        // { rowId: [ {id,data,hora,nota}, … ] }
let _entrCarregades = null;   // de quin grup són les que tenim
let _entrAlumne = null;       // a qui estem editant
let _entrEditant = null;      // quina entrevista (null = de nova)

/* El grup del qual som tutor/a. Sense tutoria no hi ha entrevistes:
   les fa qui tutoritza la família. */
function _entrGrup() {
  return (typeof grupActual === 'function') ? grupActual() : null;
}

async function carregaEntrevistes(forca) {
  const grup = _entrGrup();
  if (!grup || !config.scriptUrl) { _entrevistes = {}; return {}; }
  if (!forca && _entrCarregades === grup) return _entrevistes;
  try {
    const r = await appsScriptGet({ action: 'loadEntrevistes', grup });
    if (r && r.ok) { _entrevistes = r.entrevistes || {}; _entrCarregades = grup; }
  } catch (e) { /* silenciós: es queda el que hi hagi */ }
  return _entrevistes;
}

/* Les d'un alumne, pel seu rowId del full compartit */
function _entrDe(studentId) {
  const rid = (personal[studentId] || {}).rowId;
  if (rid === undefined || rid === null) return [];
  return _entrevistes[String(rid)] || [];
}

function _entrDataText(d, h) {
  if (!d) return '';
  const p = String(d).split('-');
  if (p.length !== 3) return d;
  const MESOS = ['gener','febrer','març','abril','maig','juny','juliol','agost','setembre','octubre','novembre','desembre'];
  return (+p[2]) + ' de ' + (MESOS[+p[1] - 1] || '') + (h ? ' a les ' + h : '');
}

/* ---------- la secció de la fitxa ---------- */
function pintaEntrevistes(studentId) {
  const cont = document.getElementById('fitxaEntrevistes');
  if (!cont) return;
  if (!_entrGrup()) {
    cont.innerHTML = '<p class="fitxa-empty-field">Les entrevistes són del grup que tutoritzes.</p>';
    return;
  }
  const rid = (personal[studentId] || {}).rowId;
  if (rid === undefined || rid === null) {
    cont.innerHTML = '<p class="fitxa-empty-field">Aquest alumne encara no és al full del grup.</p>';
    return;
  }
  const l = _entrDe(studentId);
  cont.innerHTML =
    (l.length
      ? '<ul class="entr-llista">' + l.map(e => `
          <li class="entr-item">
            <div class="entr-item-cap">
              <span class="entr-data">${escapeHtml(_entrDataText(e.data, e.hora))}</span>
              <span class="entr-accions">
                <button class="entr-mini" onclick="obreEntrevista(${studentId},'${e.id}')" title="Editar">Editar</button>
                <button class="entr-mini entr-mini-x" onclick="esborraEntrevista(${studentId},'${e.id}')" title="Esborrar">×</button>
              </span>
            </div>
            ${e.nota ? `<div class="entr-nota">${escapeHtml(e.nota)}</div>` : ''}
          </li>`).join('') + '</ul>'
      : '<p class="fitxa-empty-field">Encara no hi ha cap entrevista amb aquesta família.</p>') +
    `<button class="btn btn-secondary btn-sm entr-afegir" onclick="obreEntrevista(${studentId})">
       + Apuntar una entrevista
     </button>`;
}

/* ---------- el formulari ---------- */
function obreEntrevista(studentId, id) {
  _entrAlumne = studentId;
  _entrEditant = id || null;
  const l = _entrDe(studentId);
  const e = id ? l.find(x => String(x.id) === String(id)) : null;

  let ov = document.getElementById('entrOverlay');
  if (!ov) ov = _entrMuntaModal();

  const s = (typeof students !== 'undefined') ? students.find(x => String(x.id) === String(studentId)) : null;
  document.getElementById('entrSub').textContent = s ? s.nom : '';
  document.getElementById('entrTitol').textContent = e ? 'Editar l\'entrevista' : 'Apuntar una entrevista';

  const avui = new Date();
  const p = n => (n < 10 ? '0' : '') + n;
  document.getElementById('entrData').value = e ? (e.data || '')
    : avui.getFullYear() + '-' + p(avui.getMonth() + 1) + '-' + p(avui.getDate());
  document.getElementById('entrHora').value = e ? (e.hora || '') : '';
  document.getElementById('entrNota').value = e ? (e.nota || '') : '';

  ov.classList.add('open');
  setTimeout(() => document.getElementById('entrData').focus(), 80);
}
function tancaEntrevista() {
  const ov = document.getElementById('entrOverlay');
  if (ov) ov.classList.remove('open');
}

async function desaEntrevista() {
  const grup = _entrGrup();
  const rid = (personal[_entrAlumne] || {}).rowId;
  if (!grup || rid === undefined) { showToast('No s\'ha pogut desar', 'error'); return; }

  const data = document.getElementById('entrData').value;
  if (!data) { showToast('Posa-hi el dia', 'error'); document.getElementById('entrData').focus(); return; }

  const btn = document.getElementById('entrDesa');
  if (btn) { btn.disabled = true; btn.textContent = 'Desant…'; }
  try {
    // L'id d'una entrevista nova el fa el NAVEGADOR, no el servidor. Si la
    // desada triga massa i el navegador la torna a enviar, hi va el mateix
    // id i el servidor la reemplaça en comptes d'afegir-ne una segona.
    // Sense això sortien entrevistes duplicades, com va passar amb els
    // calendaris de reunions.
    const idEntrevista = _entrEditant || ('e' + Date.now() + Math.random().toString(36).slice(2, 6));
    const r = await appsScriptPost({
      action: 'saveEntrevista', grup, rowId: rid,
      entrevista: {
        id: idEntrevista,
        data,
        hora: document.getElementById('entrHora').value || '',
        nota: document.getElementById('entrNota').value || '',
      }
    });
    if (r && r.ok) {
      await carregaEntrevistes(true);
      pintaEntrevistes(_entrAlumne);
      if (typeof renderAlumnesList === 'function' &&
          !document.getElementById('page-alumnes').classList.contains('page-hidden')) renderAlumnesList();
      _entrPintaComptador();
      tancaEntrevista();
      showToast(r.compartit === false
        ? 'Apuntada ✓ (encara no s\'ha pogut compartir amb direcció)'
        : 'Entrevista apuntada ✓', r.compartit === false ? 'info' : 'success');
    } else {
      showToast((r && r.error) || 'No s\'ha pogut desar', 'error');
    }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Desar'; }
  }
}

async function esborraEntrevista(studentId, id) {
  const l = _entrDe(studentId);
  const e = l.find(x => String(x.id) === String(id));
  if (!e) return;
  if (!confirm('Vols esborrar l\'entrevista del ' + _entrDataText(e.data, e.hora) + '?' +
               (e.nota ? ' També se n\'anirà el que hi has apuntat.' : ''))) return;
  const grup = _entrGrup();
  const rid = (personal[studentId] || {}).rowId;
  const r = await appsScriptPost({ action: 'deleteEntrevista', grup, rowId: rid, id });
  if (r && r.ok) {
    await carregaEntrevistes(true);
    pintaEntrevistes(studentId);
    if (typeof renderAlumnesList === 'function' &&
        !document.getElementById('page-alumnes').classList.contains('page-hidden')) renderAlumnesList();
    _entrPintaComptador();
    showToast('Esborrada', 'success');
  } else {
    showToast((r && r.error) || 'No s\'ha pogut esborrar', 'error');
  }
}

/* ---------- el cop d'ull: a qui li'n falta ---------- */
function entrevistesFetes(studentId) { return _entrDe(studentId).length; }

function _entrPintaComptador() {
  const el = document.getElementById('entrResum');
  if (!el) return;
  if (!_entrGrup() || !students.length) { el.style.display = 'none'; return; }
  const sense = students.filter(s => !entrevistesFetes(s.id));
  el.style.display = '';
  el.innerHTML = sense.length
    ? `<span class="entr-resum-falten">Falten ${sense.length} entrevistes</span>
       <span class="entr-resum-qui">${escapeHtml(sense.slice(0, 6).map(s => s.nom.split(' ')[0]).join(', '))}${sense.length > 6 ? ' i ' + (sense.length - 6) + ' més' : ''}</span>`
    : `<span class="entr-resum-ok">Ja has fet entrevista amb totes les famílies ✓</span>`;
}

function _entrMuntaModal() {
  const ov = document.createElement('div');
  ov.className = 'modal-overlay';
  ov.id = 'entrOverlay';
  ov.addEventListener('mousedown', e => { if (e.target === ov) tancaEntrevista(); });
  ov.innerHTML = `
    <div class="modal" style="max-width:460px">
      <div class="modal-header">
        <div>
          <div class="modal-header-title" id="entrTitol">Apuntar una entrevista</div>
          <div class="modal-header-sub" id="entrSub"></div>
        </div>
        <button class="modal-close" onclick="tancaEntrevista()" aria-label="Tancar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="modal-body">
        <div class="entr-dos">
          <div class="modal-field">
            <label class="modal-label" for="entrData">Quin dia</label>
            <input class="modal-input" id="entrData" type="date">
          </div>
          <div class="modal-field">
            <label class="modal-label" for="entrHora">A quina hora <span class="reu-opc">(opcional)</span></label>
            <input class="modal-input" id="entrHora" type="time">
          </div>
        </div>
        <div class="modal-field">
          <label class="modal-label" for="entrNota">Com ha anat <span class="reu-opc">(opcional)</span></label>
          <textarea class="modal-input" id="entrNota" rows="4"
            placeholder="Ex: Els preocupa que li costi seguir el ritme a Matemàtiques. Quedem de tornar-nos a veure al febrer."></textarea>
          <div class="modal-hint">Això <strong>només ho veus tu</strong>. A direcció només li arriba que has fet l'entrevista i quan.</div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="tancaEntrevista()">Cancel·lar</button>
        <button class="btn btn-primary" id="entrDesa" onclick="desaEntrevista()">Desar</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  return ov;
}
