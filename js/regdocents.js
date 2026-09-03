/* ============================================================
   REGISTRE DE DOCENTS — regdocents.js
   ------------------------------------------------------------
   Exactament el registre d'aula, però les files són els mestres
   en comptes dels alumnes. Cada ítem és una columna, de casella
   o de text lliure: qui ha entregat una cosa, qui ha fet una
   formació, el que calgui.

   NOMÉS a l'app de DIRECCIÓ, dins de l'apartat Docents.

   ON ES DESA: al full "Grups" COMPARTIT, perquè els dos directors
   hi vegin el mateix (cada un té la seva app i el seu full).
   ⚠ Qualsevol mestre que obri aquell full també ho pot llegir:
   és al full ocult `_AppData`, però no és cap secret.

   PER NOM, NO PER FILA: les cel·les es desen amb el nom del
   docent. Si un any la llista canvia, el que hi ha apuntat no es
   desplaça a la persona equivocada (que és el que passaria si es
   desés pel número de fila, com al registre d'aula).
   ============================================================ */

let _regdocItems = [];      // [{ id, nom, tipus:'checkbox'|'text' }]
let _regdocData  = {};      // { itemId: { 'Laura Vila': true|'text' } }
let _regdocCarregat = false;
let _regdocTimer = null;

/* ============================================================
   CÀRREGA I DESAT
   ============================================================ */
async function initRegistreDocents() {
  if (typeof _rolDireccio === 'function' && !_rolDireccio()) return;
  renderRegistreDocents();
  if (_regdocCarregat || !config.scriptUrl) return;
  await regdocCarrega();
}

async function regdocCarrega() {
  if (!config.scriptUrl) { _regdocEstat('Encara no estàs connectat: ves a Configuració i enganxa la URL.', 'error'); return; }
  _regdocEstat('Carregant…');
  try {
    const r = await appsScriptGet({ action: 'loadRegistreDocents' });
    if (!r || !r.ok) throw new Error((r && r.error) || 'resposta buida');
    _regdocItems = r.items || [];
    _regdocData  = r.data  || {};
    _regdocCarregat = true;
    _regdocEstat('');
  } catch (e) {
    _regdocEstat('No s\'ha pogut carregar: ' + e.message + '. Clica Sincronitzar per tornar-ho a provar.', 'error');
  }
  renderRegistreDocents();
}

async function regdocSincronitza() {
  _regdocCarregat = false;
  await regdocCarrega();
}

/* Desa TOT el registre. És petit (uns quants ítems per 40 mestres) i així
   una desada que falli no deixa el full a mitges. Com que sempre s'hi envia
   tot, si un desat falla, el següent ja hi torna a portar el que faltava. */
async function _regdocDesa() {
  if (!config.scriptUrl) { _regdocEstat('Encara no estàs connectat.', 'error'); return false; }
  try {
    const r = await appsScriptPost({ action: 'saveRegistreDocents', items: _regdocItems, data: _regdocData });
    if (!r || !r.ok) throw new Error((r && r.error) || 'resposta buida');
    _regdocEstat('Desat ✓', 'ok');
    return true;
  } catch (e) {
    _regdocEstat('No s\'ha pogut desar: ' + e.message + '. El proper canvi ho tornarà a intentar.', 'error');
    return false;
  }
}

/* Les caselles i el text es desen sols, però no a cada tecla: s'espera un
   moment i s'envia un sol cop, com fa el registre d'aula. */
function _regdocDesaAviat() {
  _regdocEstat('Desant…');
  clearTimeout(_regdocTimer);
  _regdocTimer = setTimeout(_regdocDesa, 700);
}

function _regdocEstat(text, tipus) {
  const el = document.getElementById('regdocEstat');
  if (!el) return;
  el.textContent = text || '';
  el.className = 'esm-estat' + (tipus ? ' is-' + tipus : '');
}

/* ============================================================
   ELS ÍTEMS
   ============================================================ */

// Ve del modal "Nou ítem de seguiment", el mateix que el registre d'aula.
async function regdocAfegeixItem() {
  const camp = document.getElementById('newItemName');
  const nom = (camp ? camp.value : '').trim();
  if (!nom) { if (camp) camp.focus(); return; }
  // El mateix que fa el registre d'aula, i amb el mateix parany cobert: si
  // el selector no troba res, casella. Sense el `|| 'checkbox'` l'ítem
  // naixia sense tipus i es pintava com a text encara que fos una casella.
  const tipus = (typeof getSelectedType === 'function')
    ? getSelectedType()
    : ((document.querySelector('.type-option.selected') || {}).dataset?.type || 'checkbox');

  _regdocItems.push({ id: _regdocId(), nom: nom.slice(0, 60), tipus });
  if (typeof closeNewItemModal === 'function') closeNewItemModal();
  renderRegistreDocents();
  await _regdocDesa();
}

// Un identificador que no es pot repetir (ni fent-ne dos de seguits).
let _regdocComptador = 0;
function _regdocId() {
  _regdocComptador++;
  return 'i' + Date.now().toString(36) + '-' + _regdocComptador;
}

async function regdocEsborraItem(id) {
  const item = _regdocItems.find(i => i.id === id);
  if (!item) return;
  if (!confirm('Eliminar «' + item.nom + '»? S\'esborrarà tot el que hi tinguis apuntat.')) return;
  _regdocItems = _regdocItems.filter(i => i.id !== id);
  delete _regdocData[id];
  renderRegistreDocents();
  await _regdocDesa();
}

function regdocCanviaCella(itemId, nom, valor) {
  if (!_regdocData[itemId]) _regdocData[itemId] = {};
  _regdocData[itemId][nom] = valor;
  _regdocDesaAviat();
}

// El valor d'una cel·la (o el buit que toqui segons el tipus).
function regdocValor(itemId, nom) {
  const fila = _regdocData[itemId];
  const v = fila ? fila[nom] : undefined;
  return v === undefined ? null : v;
}

/* ============================================================
   LA PANTALLA
   ============================================================ */

// Les files: tot el claustre, en el mateix ordre que el llistat.
function regdocDocents() {
  return (typeof DOCENTS !== 'undefined') ? DOCENTS : [];
}

function renderRegistreDocents() {
  const buit  = document.getElementById('regdocEmpty');
  const taula = document.getElementById('regdocTaula');
  if (!buit || !taula) return;

  if (!_regdocItems.length) {
    buit.style.display = '';
    taula.style.display = 'none';
    return;
  }
  buit.style.display = 'none';
  taula.style.display = '';

  const caps = _regdocItems.map(i =>
    `<th class="reg-th-item">
       <div class="reg-th-inner">
         <span>${escapeHtml(i.nom)}</span>
         <button class="reg-th-delete" type="button" title="Eliminar «${escapeHtml(i.nom)}»"
                 aria-label="Eliminar ${escapeHtml(i.nom)}" onclick="regdocEsborraItem('${i.id}')">
           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
         </button>
       </div>
     </th>`).join('');

  const files = regdocDocents().map(d => {
    const cels = _regdocItems.map(i => {
      const v = regdocValor(i.id, d.nom);
      if (i.tipus === 'checkbox') {
        const marcat = (v === true) ? ' checked' : '';
        return `<td class="reg-td-cell">
          <input type="checkbox" class="reg-checkbox"${marcat}
                 aria-label="${escapeHtml(i.nom)} · ${escapeHtml(d.nom)}"
                 onchange="regdocCanviaCella('${i.id}', ${_regdocNomJS(d.nom)}, this.checked)">
        </td>`;
      }
      return `<td class="reg-td-cell">
        <input type="text" class="reg-text-input" value="${escapeHtml(v == null ? '' : String(v))}" placeholder="—"
               aria-label="${escapeHtml(i.nom)} · ${escapeHtml(d.nom)}"
               oninput="regdocCanviaCella('${i.id}', ${_regdocNomJS(d.nom)}, this.value)">
      </td>`;
    }).join('');
    const què = (typeof docentTipus === 'function') ? docentTipus(d) : '';
    const sub = d.grup ? d.grup : (què === 'siei' ? 'SIEI' : 'Especialista');
    return `<tr>
      <td class="reg-td-name">
        <span class="regdoc-nom">${escapeHtml(d.nom)}</span>
        <span class="regdoc-sub">${escapeHtml(sub)}</span>
      </td>${cels}
    </tr>`;
  }).join('');

  taula.innerHTML = `<table class="reg-table">
    <thead><tr><th class="reg-th-name">Docent</th>${caps}</tr></thead>
    <tbody>${files}</tbody>
  </table>`;
}

/* El nom del docent, com a text JS per posar dins d'un onclick. Hi ha
   cognoms amb apòstrof (l'Solà no, però n'hi podria haver): sense escapar-lo
   trencaria l'atribut i el botó deixaria de fer res. */
function _regdocNomJS(nom) {
  return "'" + String(nom).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;') + "'";
}
