/* ============================================================
   POSSIBLES ACTUALITZACIONS — el catàleg de millores
   ------------------------------------------------------------
   En Pol, 5/9/2026: «hi ha gent que no té masses idees; així també obrim
   un ventall d'idees i possibilitats de l'app».

   Com funciona el circuit:
     1. Una mestra demana una cosa a la seva conversa i se li fa.
     2. Si en Pol creu que pot servir a més gent, en demana l'explicació.
     3. Aquella explicació entra AQUÍ, i llavors la veu tothom.
     4. Qui la vulgui clica «Jo la vull!» i li arriba un correu a en Pol
        amb el nom de la mestra i quina demana.
     5. En Pol va a la conversa d'aquella mestra i la hi fa.

   ⚠ MANA EN POL: aquí no hi entra res que ell no hagi aprovat. Que una
   millora existeixi no vol dir que hagi de sortir en aquesta llista.

   ------------------------------------------------------------
   COM S'HI AFEGEIX UNA (això és per a qui toqui el codi):

     {
       id: 'app-verda',              // ⚠ NO es canvia MAI: és el que
                                     //    identifica la petició al correu,
                                     //    i el que recorda si ja s'ha
                                     //    demanat. Canviar-lo faria que
                                     //    semblés una millora nova.
       titol: 'L\'app en verd',      // curt, com un titular
       ras: 'Canvia el granat…',     // ⚠ UNA frase, ben ras i curt: és
                                     //    l'única cosa que llegirà molta
                                     //    gent. Res de noms de fitxers.
       mes: [                        // el que surt a «Vull saber-ne més»
         'Què fa…',
         'Com es fa servir…',
       ],
       data: '2026-09-05',           // quan va entrar a la llista
       rols: ['tutor', 'direccio'],  // opcional: a qui s'ofereix.
                                     //   Si no hi és, la veu tothom.
     }

   Escriu `ras` i `mes` com a un mestre amb poc temps: què aconsegueix i on
   ho clica. Res de noms de fitxers ni de funcions.

   ⚠ NO s'hi posa MAI qui la va demanar. En Pol, 5/9/2026: «a l'explicació
   surt el nom del mestre que ha demanat primer aquella actualització. No ho
   vull. Només l'actualització». Una llista d'idees no ha de ser una llista
   de qui demana coses.

   ⚠ COM ESTÀ FETA cada millora NO va aquí: va a `MILLORES.md`. Aquest
   fitxer se'l baixa el navegador de cada mestra i no hi ha de portar coses
   que ella no veurà mai. La recepta tècnica és per a qui l'hagi de fer:
   quan algú digui «fes-me la del color verd», qui ho faci obre el
   `MILLORES.md`, hi troba com estava feta i no se l'ha d'inventar una altra
   vegada —que és com dues mestres acaben amb la mateixa cosa feta diferent.
   ============================================================ */

const MILLORES = [
  {
    id: 'incidencies-familia',
    titol: 'Avisar la família d\'una incidència',
    ras: 'Escrius en dues línies què ha passat i el correu per a la família surt redactat, a punt de revisar i enviar.',
    mes: [
      'A cada targeta d\'alumne hi ha un botó nou, un cercle vermell amb una exclamació. El cliques i s\'obre una finestra per escriure què ha passat.',
      'Abans d\'obrir res veus com quedarà el correu sencer i a qui s\'enviarà: hi posa totes les adreces que hi hagi a la fitxa de l\'alumne.',
      'El text diu «el vostre fill» o «la vostra filla» segons el gènere de la fitxa. Si el missatge de sèrie no t\'agrada, el pots canviar des de la mateixa finestra i es queda canviat.',
      'No s\'envia sol: s\'obre el Gmail amb el correu escrit i l\'envies tu. A la fitxa de l\'alumne hi queda el compte de les que li has comunicat, amb la data i el que hi vas escriure.',
    ],
    data: '2026-09-05',
    rols: ['tutor', 'direccio'],
  },
];

/* A qui s'ofereix cada millora. Sense `rols`, a tothom.
   ⚠ Això no és cap secret ni cap permís: és per no ensenyar a una mestra
   una cosa que a la seva app no tindria sentit. Una especialista no té
   tutoria ni és qui escriu a les famílies, i oferir-li «avisar la família»
   només seria fer-li demanar una cosa que després no li serviria. */
function _milloraEsMeva(m) {
  if (!m.rols || !m.rols.length) return true;
  const meu = (typeof APP_ROL !== 'undefined' && APP_ROL) ? APP_ROL : 'tutor';
  return m.rols.indexOf(meu) !== -1;
}
function _milloresMeves() { return MILLORES.filter(_milloraEsMeva); }

/* Les que ja s'han demanat des d'aquest ordinador. Només serveix per no
   demanar dues vegades el mateix sense adonar-se'n; qui mana és el correu
   que li arriba a en Pol. */
const MILLORES_CLAU = 'millores_demanades';

/* I les que ja ha vist. En Pol, 5/9/2026: «si les actualitzacions que hi ha
   dins ja les ha demanades o llegides, no ha de sortir cap número d'alerta
   de nova actualització». O sigui que el número és de les que són NOVES per
   a ella, no de les que hi ha. Un avís que no marxa mai deixa de ser un
   avís i la gent deixa de mirar-lo. */
const MILLORES_VISTES = 'millores_vistes';

function _milloresLlegeix(clau) {
  try { return JSON.parse(localStorage.getItem(clau) || '{}') || {}; }
  catch (e) { return {}; }
}
function _milloresDesa(clau, d) {
  try { localStorage.setItem(clau, JSON.stringify(d)); } catch (e) {}
}
function _milloresDemanades() { return _milloresLlegeix(MILLORES_CLAU); }
function _milloresVistes()    { return _milloresLlegeix(MILLORES_VISTES); }

function _milloresMarca(id) {
  const d = _milloresDemanades();
  d[id] = new Date().toISOString().slice(0, 10);
  _milloresDesa(MILLORES_CLAU, d);
}

/* Obrir la llista ja és haver-les llegides: a partir d'aquí deixen de ser
   noves. Es marquen les que hi ha ARA, no totes per sempre, perquè la que
   s'hi afegeixi demà torni a avisar. */
function _milloresMarcaVistes() {
  const v = _milloresVistes();
  const avui = new Date().toISOString().slice(0, 10);
  _milloresMeves().forEach(m => { if (!v[m.id]) v[m.id] = avui; });
  _milloresDesa(MILLORES_VISTES, v);
}

/* Quantes són NOVES per a ella: ni vistes ni demanades. */
function milloresNoves() {
  const d = _milloresDemanades(), v = _milloresVistes();
  return _milloresMeves().filter(m => !d[m.id] && !v[m.id]).length;
}

/* Al botó de l'inici, l'estrella es converteix en el número quan n'hi ha de
   noves, i torna a ser estrella quan ja no en queda cap. */
function _milloresPintaBotoInici() {
  const n = milloresNoves();
  const estrella = document.getElementById('homeMilloresEstrella');
  const compte = document.getElementById('homeMilloresCompte');
  if (estrella) estrella.style.display = n ? 'none' : '';
  if (compte) {
    compte.style.display = n ? 'flex' : 'none';
    compte.textContent = String(n);
    compte.setAttribute('aria-label', n === 1 ? '1 actualització nova' : n + ' actualitzacions noves');
  }
}

/* ---------- La finestra ---------- */

function obreMillores() {
  _milloresRender();
  document.getElementById('milloresOverlay').classList.add('open');
  /* Marcar-les DESPRÉS de pintar-les: així encara es poden ensenyar com a
     noves aquesta vegada, i la propera ja no ho seran. */
  _milloresMarcaVistes();
}
function tancaMillores() {
  document.getElementById('milloresOverlay').classList.remove('open');
  _milloresPintaBotoInici();
}

function _milloresRender() {
  const cont = document.getElementById('milloresLlista');
  if (!cont) return;
  const meves = _milloresMeves();
  if (!meves.length) {
    /* L'estat buit ha de dir què hi haurà i com hi arriba, no un «no hi ha
       res»: si no, sembla una pantalla espatllada. */
    cont.innerHTML =
      '<div class="millores-buit">' +
        '<p><strong>Encara no n\'hi ha cap.</strong></p>' +
        '<p>Aquí hi aniran sortint coses que altres mestres ja fan servir. ' +
        'Quan algú demana una millora que pot servir a més gent, s\'explica ' +
        'aquí i llavors la pot demanar qui vulgui.</p>' +
        '<p class="modal-hint">Si tens una idea, digues-la-hi a en Pol directament: ' +
        'd\'aquí surten les que després veurà tothom.</p>' +
      '</div>';
    return;
  }
  const demanades = _milloresDemanades();
  const vistes = _milloresVistes();
  cont.innerHTML = meves.map(m => {
    const ja = demanades[m.id];
    const nova = !ja && !vistes[m.id];
    return '' +
      '<article class="millora' + (ja ? ' demanada' : '') + (nova ? ' nova' : '') + '">' +
        '<h3 class="millora-titol">' + escapeHtml(m.titol) +
          (nova ? '<span class="millora-nova">Nova</span>' : '') + '</h3>' +
        '<p class="millora-ras">' + escapeHtml(m.ras) + '</p>' +
        '<div class="millora-mes" id="milloraMes_' + m.id + '" hidden>' +
          (m.mes || []).map(p => '<p>' + escapeHtml(p) + '</p>').join('') +
        '</div>' +
        '<div class="millora-botons">' +
          ((m.mes && m.mes.length) ?
            '<button type="button" class="btn btn-secondary btn-sm" ' +
              'id="milloraMesBtn_' + m.id + '" aria-expanded="false" ' +
              'aria-controls="milloraMes_' + m.id + '" ' +
              'onclick="milloraMes(\'' + m.id + '\')">Vull saber-ne més</button>' : '') +
          (ja
            ? '<span class="millora-feta">Demanada el ' + escapeHtml(_milloresData(ja)) + ' ✓</span>'
            : '<button type="button" class="btn btn-primary btn-sm" ' +
              'onclick="milloraVull(\'' + m.id + '\')">Jo la vull!</button>') +
        '</div>' +
      '</article>';
  }).join('');
}

function _milloresData(iso) {
  const p = String(iso || '').split('-');
  if (p.length !== 3) return String(iso || '');
  return p[2] + '/' + p[1] + '/' + p[0];
}

function milloraMes(id) {
  const cos = document.getElementById('milloraMes_' + id);
  const btn = document.getElementById('milloraMesBtn_' + id);
  if (!cos) return;
  const obert = !cos.hidden;
  cos.hidden = obert;
  if (btn) {
    btn.setAttribute('aria-expanded', String(!obert));
    btn.textContent = obert ? 'Vull saber-ne més' : 'Amagar-ho';
  }
}

/* ---------- Demanar-la ---------- */

let _milloraDemanant = null;

function milloraVull(id) {
  const m = _milloresMeves().filter(x => x.id === id)[0];
  if (!m) return;
  _milloraDemanant = m;
  document.getElementById('milloraConfirmaQue').textContent = m.titol;
  document.getElementById('milloraNota').value = '';
  document.getElementById('milloraConfirmaOverlay').classList.add('open');
  setTimeout(() => { const n = document.getElementById('milloraNota'); if (n) n.focus(); }, 60);
}
function tancaMilloraConfirma() {
  document.getElementById('milloraConfirmaOverlay').classList.remove('open');
}

async function milloraEnvia() {
  const m = _milloraDemanant;
  if (!m) return;
  if (!config.scriptUrl) {
    showToast('Cal estar connectat per demanar-la', 'error');
    return;
  }
  const nota = (document.getElementById('milloraNota').value || '').trim();
  const qui = (typeof _perfil !== 'undefined' && _perfil && _perfil.nom) ? _perfil.nom : '';
  try {
    const r = await appsScriptPost({
      action: 'demanaMillora',
      millora: m.id, titol: m.titol, qui: qui, nota: nota,
    });
    if (!r || !r.ok) throw new Error((r && r.error) || 'no s\'ha pogut enviar');
    _milloresMarca(m.id);
    tancaMilloraConfirma();
    _milloresRender();
    _milloresPintaBotoInici();
    showToast('Demanada ✓ En Pol ja ho sap', 'success');
  } catch (e) {
    /* Si no ha sortit, NO es marca com a demanada: si no, es pensaria que
       en Pol ho sap i no ho sabria ningú. */
    showToast('No s\'ha pogut enviar: ' + (e.message || 'prova-ho més tard'), 'error');
  }
}
