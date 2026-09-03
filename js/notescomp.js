/* ============================================================
   NOTES COMPARTIDES AMB EL TUTOR — notescomp.js
   ------------------------------------------------------------
   Un tutor ha de poder veure com va el seu alumne a TOTES les
   assignatures, també a les que li fa una altra mestra. Com que
   cada mestra té el seu full, la que les entra les PUBLICA al
   full "Grups" compartit i el tutor les llegeix d'allà.

   ⚠ NOMÉS SI ELLA HO VOL. La casella de les notes ve
   DESMARCADA. Mentre no la marqui, al full compartit no hi ha
   ni una nota seva: el tutor només veu «notes no compartides».

   Aquest fitxer no decideix res: només ensenya la casella i
   demana al servidor que publiqui. Qui calcula i qui escriu al
   full compartit és el Code.gs.
   ============================================================ */

let _compartirEstat = {};      // { "grup|matKey": true/false }
let _publicaTimer = null;

/* La clau d'aquesta assignatura+grup, tal com la vol el servidor.
   Torna null (i la casella no surt) quan no toca:
   · si no se sap de quin grup són aquestes notes. NO es pot caure al grup
     de tutoria: publicaria les notes de 6è sota el grup propi.
   · si el grup és una assignatura de grup ROTATORI (Tallers): avui són uns
     alumnes i la setmana que ve uns altres, i el resum no voldria dir res.
   · si ELLA és la tutora d'aquell grup: ja les veu, no hi ha res a compartir. */
function _compClau() {
  if (typeof notesContext === 'undefined' || !notesContext) return null;
  if (!notesContext.materia) return null;
  if (notesContext.desdob && notesContext.desdob.rotatori) return null;
  const grup = notesContext.grup;
  if (!grup) return null;
  // El grup del qual ETS tutor/a (a direcció, cap: per això hi surt la casella).
  const meu = (typeof grupTutoria === 'function') ? grupTutoria()
            : ((typeof grupActual === 'function') ? grupActual() : null);
  if (meu && String(meu) === String(grup)) return null;
  return { grup, matKey: notesContext.materia, nom: _compNomAssig() };
}
function _compNomAssig() {
  if (typeof MATERIES !== 'undefined' && notesContext && MATERIES[notesContext.materia]) {
    // L'etiqueta pot portar el grup ("Música · 5è"): al full hi va el nom sol
    return String(MATERIES[notesContext.materia]).split(' · ')[0].trim();
  }
  return (notesContext && notesContext.materia) || '';
}
function _compNomMestra() {
  if (typeof _perfil === 'undefined' || !_perfil) return '';
  return [(_perfil.nom || ''), (_perfil.cognom || '')].join(' ').trim();
}

/* ---------- la casella ---------- */
async function initCompartirNotes() {
  const row = document.getElementById('notesCompartirRow');
  if (!row) return;
  const c = _compClau();
  if (!c || !config.scriptUrl) { row.style.display = 'none'; return; }
  row.style.display = '';

  const clau = c.grup + '|' + c.matKey;
  const cb = document.getElementById('notesCompartir');
  // Pinta de seguida el que ja sabem, i confirma amb el servidor
  if (_compartirEstat[clau] !== undefined) cb.checked = !!_compartirEstat[clau];
  _pintaCompartirInfo();

  try {
    const r = await appsScriptGet({ action: 'loadCompartirNotes', grup: c.grup, matKey: c.matKey });
    if (r && r.ok) {
      _compartirEstat[clau] = !!r.compartir;
      cb.checked = !!r.compartir;
      _pintaCompartirInfo();
    }
  } catch (e) { /* silenciós: es queda el que hi havia */ }
}

function _pintaCompartirInfo() {
  const info = document.getElementById('notesCompartirInfo');
  const cb = document.getElementById('notesCompartir');
  if (!info || !cb) return;
  info.textContent = cb.checked
    ? 'El tutor/a hi veurà la nota de cada trimestre (no els exàmens).'
    : 'Ara mateix el tutor no pot veure les teves notes.';
}

async function toggleCompartirNotes(valor) {
  const c = _compClau();
  if (!c) return;
  const clau = c.grup + '|' + c.matKey;
  _compartirEstat[clau] = !!valor;
  _pintaCompartirInfo();

  const r = await appsScriptPost({
    action: 'saveCompartirNotes', grup: c.grup, matKey: c.matKey,
    nomAssig: c.nom, nomMestra: _compNomMestra(), compartir: !!valor
  });
  if (r && r.ok) {
    if (!valor) {
      showToast('Ja no es comparteixen: les notes s\'han tret del full compartit', 'success');
    } else {
      showToast('Compartides amb el tutor/a ✓' + (r.alumnes ? ' (' + r.alumnes + ' alumnes)' : ''), 'success');
      // Coses que la mestra ha de saber, no amagar-les: si no, arrossegarà
      // alumnes sense nota sense entendre per què.
      if (r.ambigus) {
        setTimeout(() => showToast(r.ambigus + ' alumne' + (r.ambigus > 1 ? 's' : '') +
          ' no s\'ha' + (r.ambigus > 1 ? 'n' : '') + ' pogut compartir: al grup hi ha dos alumnes amb el mateix nom i no es pot saber de qui és la nota. Avisa el tutor/a perquè hi posi el cognom.', 'error'), 4200);
      } else if (r.sensePar) {
        setTimeout(() => showToast(r.sensePar + ' alumne' + (r.sensePar > 1 ? 's' : '') +
          ' de la teva llista no ' + (r.sensePar > 1 ? 'són' : 'és') + ' al full del grup: comprova que el nom estigui escrit igual.', 'error'), 4200);
      }
    }
  } else {
    // No ha anat: es desfà, no la deixem creure que ho ha compartit
    _compartirEstat[clau] = !valor;
    const cb = document.getElementById('notesCompartir');
    if (cb) cb.checked = !valor;
    _pintaCompartirInfo();
    showToast((r && r.error) || 'No s\'ha pogut canviar', 'error');
  }
}

/* Republica quan canvien les notes, si està compartida.
   Amb espera, perquè entrant notes es dispara a cada tecla. */
function publicaNotesSiCal() {
  const c = _compClau();
  if (!c) return;
  if (!_compartirEstat[c.grup + '|' + c.matKey]) return;   // no comparteix: res a fer
  clearTimeout(_publicaTimer);
  _publicaTimer = setTimeout(function () {
    appsScriptPost({
      action: 'publicaNotesResum', grup: c.grup, matKey: c.matKey,
      nomAssig: c.nom, nomMestra: _compNomMestra()
    }).catch(function () {});
  }, 4000);
}

/* ============================================================
   LES NOTES DELS ALTRES, A LA FITXA DE L'ALUMNE
   ============================================================ */
let _notesCompCache = null, _notesCompTs = 0;

async function carregaNotesCompartides(grup, forca) {
  if (!grup || !config.scriptUrl) return [];
  if (!forca && _notesCompCache && Date.now() - _notesCompTs < 120000) return _notesCompCache;
  try {
    const r = await appsScriptGet({ action: 'getNotesCompartides', grup: grup });
    if (r && r.ok) { _notesCompCache = r.assignatures || []; _notesCompTs = Date.now(); }
    return _notesCompCache || [];
  } catch (e) { return _notesCompCache || []; }
}

/* Les assignatures que NO fa el tutor, per posar-les sota les seves.
   `sevesKeys` són les claus que ja surten a la taula d'ell. */
function pintaNotesAltresMestres(assigs, rowId, sevesKeys) {
  if (!assigs || !assigs.length) return '';
  const _k = s => (s || '').toString().normalize('NFD').replace(_RE_ACC_COMP, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const meves = new Set((sevesKeys || []).map(_k));

  const files = assigs.filter(a => !meves.has(_k(a.key)) && !meves.has(_k(a.nom)));
  if (!files.length) return '';

  return `
    <div class="notesalt">
      <div class="notesalt-tit">Altres assignatures</div>
      <table class="notesalt-taula">
        <thead><tr><th>Assignatura</th><th>1r</th><th>2n</th><th>3r</th><th>Qui la fa</th></tr></thead>
        <tbody>
          ${files.map(a => {
            if (!a.compartit) {
              return `<tr class="notesalt-nc">
                <td>${escapeHtml(a.nom)}</td>
                <td colspan="3" class="notesalt-nc-txt">Notes no compartides</td>
                <td>${escapeHtml(a.mestra || '—')}</td>
              </tr>`;
            }
            const n = (a.alumnes && a.alumnes[String(rowId)]) || {};
            const cel = t => {
              const v = n[String(t)];
              if (v === null || v === undefined || v === '') return '<td class="notesalt-buit">—</td>';
              return `<td class="notesalt-nota ${_classeNota(v)}">${escapeHtml(String(v))}</td>`;
            };
            return `<tr>
              <td>${escapeHtml(a.nom)}</td>
              ${cel(1)}${cel(2)}${cel(3)}
              <td>${escapeHtml(a.mestra || '—')}<span class="notesalt-quan">${escapeHtml(_quanText(a.actualitzat))}</span></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
      <p class="notesalt-peu">Les posa cada mestra des de la seva app. Si una assignatura surt buida, potser encara no l'ha actualitzada.</p>
    </div>`;
}

const _RE_ACC_COMP = new RegExp('[' + String.fromCharCode(0x300) + '-' + String.fromCharCode(0x36f) + ']', 'g');

/* El color de la nota, amb els mateixos trams que la resta de l'app */
function _classeNota(v) {
  const n = parseFloat(v);
  if (isNaN(n)) return '';
  if (n >= 9) return 'nota-ae';
  if (n >= 7) return 'nota-an';
  if (n >= 5) return 'nota-as';
  return 'nota-na';
}

function _quanText(s) {
  if (!s) return '';
  const d = String(s).split(' ')[0].split('-');
  if (d.length !== 3) return '';
  return ' · ' + (+d[2]) + '/' + (+d[1]);
}
