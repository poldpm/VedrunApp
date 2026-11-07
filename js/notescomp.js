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
    /* ⚠ «NO N'HI HA CAP» I «NO ET TOCA VEURE-HO» NO ÉS EL MATEIX.

       El servidor contesta `noEsTutor` a qui no ha de veure res (una
       especialista, o direcció sense la propietat de la biblioteca). Si això
       es tornés com una llista buida, la pantalla ho ensenyaria com un
       «encara no n'hi ha cap de publicada»: un rètol que no li pertoca i que
       li diu que la cosa existeix. Es torna `null` i la pantalla no pinta
       res. */
    if (r && r.noEsTutor) return null;
    const rebut = (r && r.ok && r.assignatures) ? r.assignatures : null;
    if (rebut && rebut.length) _notesCompCache[g] = { assigs: rebut, ts: Date.now() };
    else if (r && r.ok) return rebut || [];
  } catch (e) { /* es queda el que hi havia */ }
  return (_notesCompCache[g] && _notesCompCache[g].assigs) || [];
}

/* Les assignatures que NO fa el tutor, per posar-les sota les seves.
   `sevesKeys` són les claus que ja surten a la taula d'ell. */
function pintaNotesAltresMestres(assigs, rowId, sevesKeys) {
  /* ⚠ ABANS, AMB RES PUBLICAT, AQUÍ NO SORTIA RES DE RES.

     En Pol, 7/11/2026: «sóc tutor, entro a la fitxa d'un alumne i només veig
     les meves assignatures». El bloc no hi era, i per tant no hi havia
     manera de saber si és que no n'hi ha cap o és que alguna cosa falla.

     El resum de cada assignatura el publica l'app de la mestra que la fa
     (cada una té el seu full i ningú no pot llegir el d'una altra). Mentre
     ella no obri la seva app, aquí no hi ha res. Ara es diu. */
  const _k = s => (s || '').toString().normalize('NFD').replace(_RE_ACC_COMP, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const meves = new Set((sevesKeys || []).map(_k));

  /* `null` vol dir «no et toca»: res de res, ni el bloc (veure
     `carregaNotesCompartides`). La llista buida sí que és «encara no n'hi ha
     cap», i això s'explica. */
  if (assigs === null || assigs === undefined) return '';
  if (!assigs.length) {
    return `
      <div class="notesalt">
        <div class="notesalt-tit">Altres assignatures</div>
        <p class="notesalt-peu">Encara no n'hi ha cap de publicada per a aquest grup. Les publica l'app de cada mestra quan l'obre; si en falta alguna, demana-li que obri la seva app un moment.</p>
      </div>`;
  }

  const files = assigs.filter(a => !meves.has(_k(a.key)) && !meves.has(_k(a.nom)));
  /* Totes les que hi ha publicades són seves: no hi ha res a afegir i el
     bloc no surt (és el cas de qui fa totes les assignatures del seu grup). */
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

/* ============================================================
   PUBLICAR-HO TOT, UN COP AL DIA
   ------------------------------------------------------------
   ⚠ EL FORAT QUE VA TROBAR EN POL (7/11/2026): «sóc tutor, entro
   a la fitxa d'un alumne i només veig les meves assignatures».

   Tenia raó, i no era cap error de la pantalla. El resum de cada
   assignatura viu al full compartit i només s'hi escriu quan
   l'app D'AQUELLA MESTRA el publica: cada una té el seu full de
   càlcul i ningú no pot llegir el d'una altra. Fent que es
   publiqui «en obrir l'assignatura», les notes d'una companya no
   hi són fins que ella obre aquella assignatura, que pot trigar
   dies.

   Per això, poc després d'arrencar, l'app publica el resum de
   TOTES les assignatures que fa a grups que no són el seu. Un cop
   al dia per assignatura: així, amb que cada mestra obri l'app un
   cop, el tutor ho té tot.

   · Només les d'un grup del qual NO és tutora: les del seu grup
     ja les veu ella, i no hi ha res a compartir.
   · Les de grup rotatori (Tallers), no: avui són uns alumnes i la
     setmana que ve uns altres, i el resum no voldria dir res.
   · D'una en una i amb una pausa, i en segon pla: això no ha de
     fer esperar mai la mestra que acaba d'obrir l'app.
   ============================================================ */
const _K_PUBLICAT_DIA = 'notescomp_publicat_dia';

function _avuiText() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}
function _jaPublicatAvui(clau) {
  try {
    const m = JSON.parse(localStorage.getItem(_K_PUBLICAT_DIA) || '{}');
    return m[clau] === _avuiText();
  } catch (e) { return false; }
}
function _apuntaPublicat(clau) {
  try {
    const m = JSON.parse(localStorage.getItem(_K_PUBLICAT_DIA) || '{}');
    m[clau] = _avuiText();
    /* Que no creixi per sempre: les d'altres dies ja no serveixen. */
    Object.keys(m).forEach(k => { if (m[k] !== _avuiText()) delete m[k]; });
    localStorage.setItem(_K_PUBLICAT_DIA, JSON.stringify(m));
  } catch (e) {}
}

async function publicaTotesLesMevesNotes() {
  if (!config.scriptUrl) return;
  if (typeof _perfilEntradesAmbGrup !== 'function') return;
  const meu = (typeof grupTutoria === 'function') ? grupTutoria() : null;
  const entrades = _perfilEntradesAmbGrup() || [];
  for (const e of entrades) {
    if (!e || !e.grup || !e.key) continue;
    if (meu && String(e.grup) === String(meu)) continue;        // el seu grup: res a publicar
    if (e.rotatori) continue;                                    // Tallers: no vol dir res
    const clau = e.grup + '|' + e.key;
    if (_jaPublicatAvui(clau)) continue;
    try {
      const r = await appsScriptPost({
        action: 'publicaNotesResum', grup: e.grup, matKey: e.key,
        nomAssig: String(e.nom || '').split(' · ')[0].trim(), nomMestra: _compNomMestra()
      });
      if (r && r.ok) _apuntaPublicat(clau);
    } catch (err) { /* ja es tornarà a provar demà, o en obrir l'assignatura */ }
    await new Promise(r => setTimeout(r, 1200));                 // sense atabalar el servidor
  }
}
