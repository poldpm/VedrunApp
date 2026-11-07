/* ============================================================
   NOTES COMPARTIDES AMB EL TUTOR — notescomp.js
   ------------------------------------------------------------
   Un tutor ha de poder veure com va el seu alumne a TOTES les
   assignatures, també a les que li fa una altra mestra. Com que
   cada mestra té el seu full, la que les entra les PUBLICA al
   full "Grups" compartit i el tutor les llegeix d'allà.

   ⚠ FINS AL 7/11/2026 CALIA PERMÍS, I JA NO. Hi havia una casella
   per assignatura, desmarcada de sèrie, i mentre no es marqués el
   tutor veia «Notes no compartides». La direcció ho ha decidit al
   revés: el tutor i la direcció han de poder veure la nota final
   de cada trimestre de totes les assignatures d'un alumne.

   ⚠ EL QUE NO HA CANVIAT: es publica NOMÉS LA NOTA FINAL de cada
   trimestre, mai el detall dels exàmens ni els comentaris.

   On hi havia la casella ara hi ha una frase que ho diu: una
   casella que no mana res seria enganyar la mestra sobre qui veu
   la seva feina.

   Aquest fitxer no decideix res: qui calcula i qui escriu al full
   compartit és el Code.gs.
   ============================================================ */

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

/* ---------- la frase que ho diu ---------- */
/* Assignatures d'aquesta estona que ja s'han publicat un cop: així obrir-les
   i tancar-les no demana el mateix una vegada i una altra. */
const _publicatAquestaEstona = {};

function initCompartirNotes() {
  const row = document.getElementById('notesCompartirRow');
  if (!row) return;
  const c = _compClau();
  if (!c || !config.scriptUrl) { row.style.display = 'none'; return; }
  row.style.display = '';

  /* ⚠ PUBLICAR EN OBRIR, I NO NOMÉS EN ENTRAR NOTES.

     El resum viu al full compartit i només s'hi escriu quan l'app d'aquesta
     mestra el publica. Si no es fes aquí, les assignatures de qui no tingui
     la casella marcada d'abans es quedarien sense notes al full fins que
     tornés a tocar una nota: el tutor seguiria veient-ho buit sense saber
     per què. Obrir l'assignatura ja és senyal que hi és. */
  const clau = c.grup + '|' + c.matKey;
  if (!_publicatAquestaEstona[clau]) {
    _publicatAquestaEstona[clau] = true;
    appsScriptPost({
      action: 'publicaNotesResum', grup: c.grup, matKey: c.matKey,
      nomAssig: c.nom, nomMestra: _compNomMestra()
    }).catch(function () { _publicatAquestaEstona[clau] = false; });
  }
}

/* ⚠ La casella ja no hi és (veure la capçalera). Aquesta funció es queda,
   buida de feina, perquè `comprova-controls.js` comprova que tot el que es
   crida des de l'HTML existeixi, i perquè un navegador amb la pàgina vella
   oberta —el service worker pot servir-la una estona— no peti en clicar-la.
   Publicar ja es fa sol. */
function toggleCompartirNotes() { /* res a fer: les notes es publiquen sempre */ }

/* Republica quan canvien les notes, si està compartida.
   Amb espera, perquè entrant notes es dispara a cada tecla. */
function publicaNotesSiCal() {
  const c = _compClau();
  if (!c) return;
  /* Abans aquí hi havia `if (!_compartirEstat[...]) return;`. Ja no hi ha
     permís que mirar: es publica sempre (veure la capçalera del fitxer). */
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
/* ⚠ UNA CÒPIA PER GRUP, NO UNA DE SOLA.

   Hi havia un sol calaix per a tot (`_notesCompCache`) i la clau del grup no
   hi comptava. A un tutor això no es notava mai —sempre demana el seu grup—,
   però des que la direcció també ho veu, canviant de grup a Alumnes dins dels
   dos minuts hauria vist a la fitxa d'un nen de 5è A les assignatures del
   grup d'abans. Notes d'un grup a la fitxa d'un nen d'un altre. */
const _notesCompCache = {};   // { grup: { assigs, ts } }

async function carregaNotesCompartides(grup, forca) {
  if (!grup || !config.scriptUrl) return [];
  const g = String(grup);
  const tenim = _notesCompCache[g];
  if (!forca && tenim && Date.now() - tenim.ts < 120000) return tenim.assigs;
  try {
    const r = await appsScriptGet({ action: 'getNotesCompartides', grup: g, _fons: true });
    /* ⚠ Una resposta BUIDA no es guarda. Guardar-la volia dir que, si es
       demanava el grup abans que l'altra mestra hagués publicat res (o en un
       mal moment del servidor), durant dos minuts la fitxa seguia dient que
       no hi ha res sense tornar-ho a preguntar. Tornar-ho a demanar és barat;
       ensenyar un buit que no és veritat, no. */
    const rebut = (r && r.ok && r.assignatures) ? r.assignatures : null;
    if (rebut && rebut.length) _notesCompCache[g] = { assigs: rebut, ts: Date.now() };
    else if (r && r.ok) return rebut || [];
  } catch (e) { /* es queda el que hi havia */ }
  return (_notesCompCache[g] && _notesCompCache[g].assigs) || [];
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
            /* ⚠ Des del 7/11/2026 les notes es publiquen sempre, o sigui
               que `compartit:false` ja no vol dir «no ho vol compartir»:
               vol dir que aquella mestra encara no ha tornat a obrir
               l'assignatura des del canvi i el seu resum és el vell. El
               rètol ho ha de dir així, que és el que passa de debò. */
            if (!a.compartit) {
              return `<tr class="notesalt-nc">
                <td>${escapeHtml(a.nom)}</td>
                <td colspan="3" class="notesalt-nc-txt">Encara no hi ha notes publicades</td>
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
