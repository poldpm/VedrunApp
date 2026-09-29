/* ============================================================
   RÚBRIQUES D'AVALUACIÓ D'ACTIVITATS
   js/rubaval.js  ·  el model, els càlculs i el magatzem
   ------------------------------------------------------------
   En Pol, 29/9/2026: «els mestres fem rúbriques per avaluar
   activitats. Vull una eina que em serveixi per generar aquestes
   rúbriques d'avaluació. On hi he de posar els objectius que jo
   vulgui amb els seus criteris d'avaluació que jo vulgui, i tot
   ha d'anar guardat en el registre de notes corresponent.»

   ⚠ NO S'HA DE CONFONDRE AMB `js/rubriques.js`. Aquell fitxer són
   els objectius del generador de COMENTARIS (quatre frases per
   objectiu, que van a l'informe de la família). Això d'aquí és una
   altra cosa: una rúbrica per posar NOTA a una activitat.

   COM ESTÀ PENSAT
   ---------------
   · Els criteris els escriu la mestra, amb el pes que vulgui.
   · Els nivells són els que ella digui —quatre si no diu res— i
     valen per a tota la rúbrica: és una columna de botons a la
     graella, i n'hi ha d'haver els mateixos a cada criteri perquè
     avaluar sigui un clic i no una tria dins d'una tria.
   · Del que es desa a cada alumne NO en són els punts, sinó QUIN
     NIVELL té a cada criteri. Així, si després canvia els punts
     d'un nivell o el pes d'un criteri, les notes es refan soles i
     no queda ningú amb una nota calculada amb les regles velles.
   · La nota va SEMPRE sobre 10 (decisió d'en Pol, 29/9/2026): és
     el que fa la resta de l'app i el que entén el registre.

   QUI NO TÉ CAP NIVELL POSAT, NO TÉ NOTA
   --------------------------------------
   Un alumne sense avaluar val `null`, no zero. Un zero és una
   nota que algú ha decidit; un buit és que encara no s'ha mirat.
   Barrejar-ho seria posar un zero a qui no hi era el dia de
   l'activitat sense que ningú ho hagi dit mai.

   I QUI EN TÉ A MITGES, TÉ NOTA DEL QUE S'HA AVALUAT
   --------------------------------------------------
   Si a un alumne li falta un criteri, la nota es calcula amb els
   que té (proporcionalment), i queda marcat com a incomplet. És
   el que necessita qui avalua a estones; l'eina ho dirà abans de
   passar les notes al registre, que és quan ja no és un esborrany.
   ============================================================ */
(function () {
  'use strict';

  /* ================= NIVELLS ================= */

  /* Els quatre de sempre. Es poden reanomenar, repuntuar i se'n poden
     tenir més o menys: el nombre és lliure (en Pol, 29/9/2026). */
  var NIVELLS_DEFECTE = [
    { nom: 'Excel·lent',   punts: 4 },
    { nom: 'Notable',      punts: 3 },
    { nom: 'Suficient',    punts: 2 },
    { nom: 'Insuficient',  punts: 1 },
  ];

  /* Noms de sortida per a les mides que es fan servir de debò a
     primària. Per a la resta, «Nivell 1, 2, 3…», que ja els canviarà
     ella: val més un nom clarament provisional que un d'inventat que
     sembli pensat. Els punts sempre van de més a menys. */
  var NOMS_PER_MIDA = {
    2: ['Assolit', 'No assolit'],
    3: ['Assolit', 'En procés', 'No assolit'],
    4: ['Excel·lent', 'Notable', 'Suficient', 'Insuficient'],
    5: ['Excel·lent', 'Notable', 'Bé', 'Suficient', 'Insuficient'],
  };

  function nivellsPerDefecte(quants) {
    var n = parseInt(quants, 10);
    if (!n || n < 2) n = 4;
    if (n > 10) n = 10;
    var noms = NOMS_PER_MIDA[n];
    var out = [];
    for (var i = 0; i < n; i++) {
      out.push({ nom: noms ? noms[i] : ('Nivell ' + (i + 1)), punts: n - i });
    }
    return out;
  }

  /* ================= FER-NE UNA ================= */

  function _id(p) {
    return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function criteriNou(nom, pes) {
    return {
      id: _id('c'),
      nom: (nom || '').trim(),
      pes: (pes === undefined || pes === null || pes === '') ? 1 : Number(pes),
      /* Un text per nivell. És OPCIONAL (en Pol, 29/9/2026): serveix per
         ensenyar la rúbrica als alumnes, però avaluar no el necessita. */
      textos: [],
    };
  }

  function nova(nom, opcions) {
    opcions = opcions || {};
    return {
      v: 1,
      id: _id('ra'),
      nom: (nom || '').trim(),
      sobre: 10,                                   // la nota sempre va sobre 10
      pes: opcions.pes === undefined ? 1 : Number(opcions.pes),   // pes de la columna al trimestre
      nivells: opcions.nivells || nivellsPerDefecte(opcions.quantsNivells),
      criteris: opcions.criteris || [],
      valors: {},        // { alumneId: { criteriId: índex del nivell } }
      enviades: {},      // { alumneId: nota que va anar al registre }
      itemId: null,      // la columna del registre, quan ja s'hi ha passat
      /* De quin grup són els alumnes («3r A»). La clau del magatzem ja porta
         l'assignatura i el grup, però la rúbrica se'l guarda igualment: és el
         que necessita el registre de notes per saber a quina llista va, i
         quan una rúbrica es copia a un altre grup s'ha de poder buidar. */
      grup: opcions.grup || null,
      creada: new Date().toISOString().slice(0, 10),
    };
  }

  /* ================= ELS CÀLCULS ================= */

  function _num(x, sinoval) {
    var n = Number(x);
    return isNaN(n) ? sinoval : n;
  }

  // Els punts del nivell que val més (normalment el primer, però no
  // s'hi confia: la mestra els pot haver reordenat o repuntuat).
  function puntsMaxNivell(rubrica) {
    var max = 0;
    (rubrica.nivells || []).forEach(function (n) {
      var p = _num(n && n.punts, 0);
      if (p > max) max = p;
    });
    return max;
  }

  // El màxim que es pot treure a la rúbrica sencera (amb tots els criteris).
  function maxim(rubrica) {
    var pm = puntsMaxNivell(rubrica);
    var tot = 0;
    (rubrica.criteris || []).forEach(function (c) {
      tot += pm * Math.max(0, _num(c.pes, 1));
    });
    return tot;
  }

  function arrodoneix(n) { return Math.round(n * 100) / 100; }

  /* La nota d'un alumne.
       nota      → sobre 10, o null si no té cap criteri avaluat
       punts     → punts obtinguts (ponderats)
       maxim     → punts possibles DELS CRITERIS QUE TÉ AVALUATS
       fets      → quants criteris té avaluats
       total     → quants criteris té la rúbrica
       complet   → si els té tots
     La nota d'un alumne a mitges es calcula amb el que té, no amb el
     que li falta: així el número que veu mentre avalua vol dir alguna
     cosa. Que li'n faltin, ho diu `complet`. */
  function nota(rubrica, alumneId) {
    var vals = (rubrica.valors || {})[String(alumneId)] || {};
    var criteris = rubrica.criteris || [];
    var pm = puntsMaxNivell(rubrica);
    var punts = 0, max = 0, fets = 0;
    criteris.forEach(function (c) {
      var idx = vals[c.id];
      if (idx === undefined || idx === null || idx === '') return;
      var niv = (rubrica.nivells || [])[idx];
      if (!niv) return;                       // nivell esborrat: com si no hi fos
      var pes = Math.max(0, _num(c.pes, 1));
      punts += _num(niv.punts, 0) * pes;
      max   += pm * pes;
      fets++;
    });
    var sobre = _num(rubrica.sobre, 10) || 10;
    return {
      nota: (fets === 0 || max <= 0) ? null : arrodoneix(punts / max * sobre),
      punts: arrodoneix(punts),
      maxim: arrodoneix(max),
      fets: fets,
      total: criteris.length,
      complet: criteris.length > 0 && fets === criteris.length,
    };
  }

  // Les notes de tota la llista d'alumnes, d'un cop.
  function notesDe(rubrica, alumnes) {
    var out = {};
    (alumnes || []).forEach(function (a) {
      var k = clauAlumne(a);
      out[k] = nota(rubrica, k);
    });
    return out;
  }

  /* ================= AVALUAR ================= */

  function posaNivell(rubrica, alumneId, criteriId, idx) {
    if (!rubrica.valors) rubrica.valors = {};
    var k = String(alumneId);
    if (!rubrica.valors[k]) rubrica.valors[k] = {};
    if (idx === null || idx === undefined || idx === '') delete rubrica.valors[k][criteriId];
    else rubrica.valors[k][criteriId] = Number(idx);
    if (!Object.keys(rubrica.valors[k]).length) delete rubrica.valors[k];
    return rubrica;
  }

  // Posa el mateix nivell a tots els alumnes d'un criteri (la columna
  // sencera). És el que fa que avaluar 25 alumnes no siguin 125 clics:
  // es posa el nivell de la majoria i es corregeixen les excepcions.
  function posaColumna(rubrica, alumnes, criteriId, idx) {
    (alumnes || []).forEach(function (a) {
      posaNivell(rubrica, clauAlumne(a), criteriId, idx);
    });
    return rubrica;
  }

  /* Treure un criteri se'n porta les seves avaluacions: si es quedaven,
     tornarien a sortir el dia que algú fes un criteri amb el mateix id
     (no passa) i, sobretot, farien que `fets` no quadrés mai. */
  function treuCriteri(rubrica, criteriId) {
    rubrica.criteris = (rubrica.criteris || []).filter(function (c) { return c.id !== criteriId; });
    Object.keys(rubrica.valors || {}).forEach(function (k) {
      delete rubrica.valors[k][criteriId];
      if (!Object.keys(rubrica.valors[k]).length) delete rubrica.valors[k];
    });
    return rubrica;
  }

  /* Quantes avaluacions tenen un nivell concret. Es demana ABANS de
     treure'l: si n'hi ha, la mestra ha de saber què s'emporta. */
  function ambNivell(rubrica, i) {
    var n = 0;
    Object.keys(rubrica.valors || {}).forEach(function (a) {
      Object.keys(rubrica.valors[a]).forEach(function (c) {
        if (rubrica.valors[a][c] === i) n++;
      });
    });
    return n;
  }

  /* ⚠ TREURE UN NIVELL MOU ELS ÍNDEXS DE TOTHOM.

     De cada alumne s'hi desa l'índex del nivell, no els punts. Si es treu
     el segon nivell i no es toca res més, tots els que tenien el tercer
     passen a tenir el segon: la nota els canvia sola i no ho diu ningú.
     Per això això viu aquí i no a la pantalla —aquí hi ha proves— i fa
     les dues coses alhora: els que tenien AQUELL nivell es queden sense
     avaluar, i els de sota pugen una posició. */
  function treuNivell(rubrica, i) {
    if (!rubrica || !Array.isArray(rubrica.nivells)) return rubrica;
    if (rubrica.nivells.length <= 2) return rubrica;   // en calen dos, com a mínim
    rubrica.nivells.splice(i, 1);
    Object.keys(rubrica.valors || {}).forEach(function (a) {
      Object.keys(rubrica.valors[a]).forEach(function (c) {
        var v = rubrica.valors[a][c];
        if (v === i) delete rubrica.valors[a][c];
        else if (v > i) rubrica.valors[a][c] = v - 1;
      });
      if (!Object.keys(rubrica.valors[a]).length) delete rubrica.valors[a];
    });
    return rubrica;
  }

  /* ================= QUÈ CANVIARÀ AL REGISTRE ================= */

  /* Compara les notes d'ara amb les que van anar al registre l'últim cop.
     Serveix per dir-li, ABANS de tocar res: «això canviarà la nota a 4
     alumnes». Tocar un pes o un nivell quan ja s'han passat les notes és
     precisament el moment en què algú es pensa que no passa res. */
  function canvis(rubrica, alumnes) {
    var ara = notesDe(rubrica, alumnes);
    var abans = rubrica.enviades || {};
    var nous = [], canviats = [], buits = [], incomplets = [];
    (alumnes || []).forEach(function (a) {
      var id = clauAlumne(a);
      var n = ara[id];
      var fila = { id: id, nom: (a && a.nom) || '', abans: (abans[id] === undefined ? null : abans[id]), ara: n.nota };
      if (n.nota === null) { buits.push(fila); return; }
      if (!n.complet) incomplets.push(fila);
      if (abans[id] === undefined || abans[id] === null) nous.push(fila);
      else if (Number(abans[id]) !== Number(n.nota)) canviats.push(fila);
    });
    return { nous: nous, canviats: canviats, buits: buits, incomplets: incomplets, notes: ara };
  }

  /* Deixa constància del que ha arribat al registre. Només s'hi apunta
     el que s'ha pogut enviar: si una nota es queda a la cua, ja es tornarà
     a comparar el proper cop. */
  function marcaEnviades(rubrica, notes) {
    if (!rubrica.enviades) rubrica.enviades = {};
    Object.keys(notes || {}).forEach(function (id) {
      if (notes[id] !== null && notes[id] !== undefined) rubrica.enviades[id] = notes[id];
    });
    return rubrica;
  }

  /* ================= QUE NO ES PUGUI DESAR UNA RÚBRICA IMPOSSIBLE ================= */

  /* Torna una llista de problemes en català. Buida vol dir que es pot
     fer servir. Es mira ABANS de desar i abans de passar-la al registre:
     una rúbrica amb tots els pesos a zero no dona error enlloc, però no
     pot donar cap nota, i això s'ha de dir quan encara s'hi és a temps. */
  function problemes(rubrica) {
    var p = [];
    if (!rubrica || !(rubrica.nom || '').trim()) p.push('L\'activitat no té nom.');
    var criteris = (rubrica && rubrica.criteris) || [];
    if (!criteris.length) p.push('La rúbrica no té cap criteri.');
    var senseNom = criteris.filter(function (c) { return !(c.nom || '').trim(); }).length;
    if (senseNom) {
      p.push(senseNom === 1 ? 'Hi ha 1 criteri sense nom.' : 'Hi ha ' + senseNom + ' criteris sense nom.');
    }
    criteris.forEach(function (c) {
      if (_num(c.pes, 1) < 0) p.push('El criteri «' + (c.nom || 'sense nom') + '» té un pes negatiu.');
    });
    var nivells = (rubrica && rubrica.nivells) || [];
    if (nivells.length < 2) p.push('Una rúbrica necessita almenys dos nivells.');
    if (nivells.some(function (n) { return _num(n.punts, null) === null; })) {
      p.push('Hi ha nivells sense punts.');
    }
    if (nivells.some(function (n) { return _num(n.punts, 0) < 0; })) {
      p.push('Hi ha nivells amb punts negatius.');
    }
    if (criteris.length && nivells.length >= 2 && maxim(rubrica) <= 0) {
      p.push('Amb aquests pesos i aquests punts, la nota màxima seria zero: ningú no podria aprovar. ' +
             'Revisa els pesos dels criteris i els punts dels nivells.');
    }
    return p;
  }

  /* ================= EL MAGATZEM ================= */

  /* Una clau per assignatura+grup i trimestre. `materia` ja porta el grup
     a dins («musica__3ra»), o sigui que les rúbriques de 3r A no es
     barregen amb les de 3r B encara que l'activitat es digui igual.

     Van al mateix calaix del full que les rúbriques d'objectius
     (`saveRubrica`/`loadRubrica`), que no és més que una clau i un JSON.
     Per això aquesta eina NO necessita tocar el Code.gs ni que ningú
     enganxi res a l'Apps Script. */
  function clau(materia, trimestre) {
    return 'aval_' + materia + '_' + String(trimestre);
  }
  function clauLocal(materia, trimestre) {
    return 'rubaval_' + materia + '_' + String(trimestre);
  }

  function llegeix(materia, trimestre) {
    try {
      var d = JSON.parse(localStorage.getItem(clauLocal(materia, trimestre)) || 'null');
      return (d && Array.isArray(d.rubriques)) ? d.rubriques : [];
    } catch (e) { return []; }
  }

  function desaLocal(materia, trimestre, llista) {
    try {
      localStorage.setItem(clauLocal(materia, trimestre),
                           JSON.stringify({ v: 1, rubriques: llista || [] }));
    } catch (e) {}
  }

  /* Desa al navegador i al full. Al full hi va per la cua de `_desaAlFull`:
     si el servidor no hi és, es reintenta sol i no es perd (que és el que
     ha de passar amb una avaluació feta i no desada). */
  /* Tot el que hi ha d'una assignatura i un trimestre va a UNA cel·la del
     full, i una cel·la de Google no passa de 50.000 lletres (el servidor
     s'atura a 45.000). Una rúbrica de sis criteris amb 25 alumnes n'ocupa
     unes 4.200: a la desena, el full deixaria d'acceptar-les i, a partir
     d'aquell moment, no se'n desaria cap més. Val més dir-ho abans que
     arribi (auditoria del 29/9/2026). */
  var MIDA_AVIS = 38000;

  function midaDe(llista) {
    try { return JSON.stringify({ v: 1, rubriques: llista || [] }).length; }
    catch (e) { return 0; }
  }

  function desa(materia, trimestre, llista) {
    desaLocal(materia, trimestre, llista);
    if (typeof config === 'undefined' || !config.scriptUrl) return;
    if (midaDe(llista) > MIDA_AVIS && typeof showToast === 'function') {
      showToast('Aquesta assignatura ja té moltes rúbriques desades en aquest trimestre i el full ' +
                'està a punt de quedar-se sense lloc. Esborra les activitats que ja no facis servir ' +
                '(la columna de notes no es perd) o digues-ho en Pol.', 'error');
    }
    var cos = { action: 'saveRubrica', materia: clau(materia, trimestre),
                data: { v: 1, rubriques: llista || [] } };
    if (typeof _desaAlFull === 'function') _desaAlFull(cos, { callat: true });
    else if (typeof appsScriptPost === 'function') appsScriptPost(cos).catch(function () {});
  }

  /* Del full al navegador, un sol cop per assignatura+trimestre i sessió.
     Si el que hi ha al full és més vell que el que hi ha aquí (perquè
     encara hi ha coses a la cua), mana el d'aquí: el que s'ha escrit i
     encara no ha viatjat no es pot perdre per una lectura. */
  var carregades = {};
  async function carrega(materia, trimestre) {
    if (!materia) return llegeix(materia, trimestre);
    var k = clau(materia, trimestre);
    if (carregades[k]) return llegeix(materia, trimestre);
    if (typeof config === 'undefined' || !config.scriptUrl) return llegeix(materia, trimestre);
    carregades[k] = true;
    try {
      var r = await appsScriptGet({ action: 'loadRubrica', materia: k, _fons: true });
      if (r && r.ok && r.data && Array.isArray(r.data.rubriques)) {
        var pendent = (typeof _pendents !== 'undefined') && _pendents.some(function (p) {
          return p.body && p.body.action === 'saveRubrica' && p.body.materia === k;
        });
        if (!pendent) desaLocal(materia, trimestre, r.data.rubriques);
      }
    } catch (e) { /* silenciós: ja tenim el que hi ha al navegador */ }
    return llegeix(materia, trimestre);
  }

  /* ⚠ DE QUIN NEN ÉS CADA AVALUACIÓ.

     Al principi s'hi desava `alumne.id`, que NO és seu: és la posició que
     ocupa a la llista d'aquell moment. N'hi ha prou que la secretaria
     afegeixi un nen al mig del full perquè totes les avaluacions baixin una
     fila i acabin al nen del costat. I amb els grups rotatoris passava
     sense que ningú toqués res: les tres rotacions comparteixen la llista
     de rúbriques, i la posició 3 és un nen diferent a cada una.

     Per això la clau és el `rowId` (la seva fila al full, que no es mou) i,
     si no en té, el nom normalitzat. Amb prefix, perquè es pugui saber si
     una rúbrica antiga encara va per posicions.

     Trobat a l'auditoria del 29/9/2026, abans que cap mestra hi tingués res
     avaluat de debò. Al projecte ja hi havia el mateix criteri als
     Assoliments (`_assimSid`). */
  function clauAlumne(a) {
    if (a === null || a === undefined) return '';
    if (typeof a !== 'object') return String(a);
    if (a.rowId !== undefined && a.rowId !== null && a.rowId !== '') return 'r' + a.rowId;
    var nom = String(a.nom || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
                .toLowerCase().replace(/\s+/g, ' ').trim();
    if (nom) return 'n' + nom;
    return String(a.id);
  }

  // Una rúbrica que encara va per posicions (claus que són només números).
  function vaPerPosicions(rubrica) {
    return Object.keys((rubrica && rubrica.valors) || {}).some(function (k) { return /^\d+$/.test(k); });
  }

  /* Passa les avaluacions d'una rúbrica antiga (per posició) a la clau bona,
     amb la llista d'alumnes d'ara. El que no es pugui casar es queda com
     estava: val més una avaluació orfe que una de posada al nen que no és. */
  function migraClaus(rubrica, alumnes) {
    if (!rubrica || !rubrica.valors || !vaPerPosicions(rubrica)) return false;
    var mapa = {};
    (alumnes || []).forEach(function (a) { if (a && a.id !== undefined) mapa[String(a.id)] = clauAlumne(a); });
    var nous = {}, tocat = false;
    Object.keys(rubrica.valors).forEach(function (k) {
      var nova = (/^\d+$/.test(k) && mapa[k]) ? mapa[k] : k;
      if (nova !== k) tocat = true;
      nous[nova] = rubrica.valors[k];
    });
    if (tocat) rubrica.valors = nous;
    var env = rubrica.enviades || {};
    var nousEnv = {}, tocatEnv = false;
    Object.keys(env).forEach(function (k) {
      var nova = (/^\d+$/.test(k) && mapa[k]) ? mapa[k] : k;
      if (nova !== k) tocatEnv = true;
      nousEnv[nova] = env[k];
    });
    if (tocatEnv) rubrica.enviades = nousEnv;
    return tocat || tocatEnv;
  }

  /* El que hi ha AL FULL ara mateix, o `null` si no s'hi ha pogut arribar.

     ⚠ `carrega()` no serveix per a això: quan falla torna el que hi ha al
     navegador, que per a llegir és el que toca —però per a ESCRIURE a sobre
     és perillós. Copiar una rúbrica a un altre grup llegia la seva llista i
     la tornava a desar sencera: si el navegador no en tenia cap (perquè
     aquell grup no s'havia obert mai en aquell ordinador), li esborrava del
     full totes les que tenia. Amb això, qui escriu pot distingir «no en té
     cap» de «no ho sé». */
  async function carregaDelFull(materia, trimestre) {
    if (!materia) return null;
    if (typeof config === 'undefined' || !config.scriptUrl) return null;
    try {
      var r = await appsScriptGet({ action: 'loadRubrica', materia: clau(materia, trimestre), _fons: true });
      if (!r || r.ok === false) return null;
      var llista = (r.data && Array.isArray(r.data.rubriques)) ? r.data.rubriques : [];
      desaLocal(materia, trimestre, llista);
      carregades[clau(materia, trimestre)] = true;
      return llista;
    } catch (e) { return null; }
  }

  /* ================= COPIAR-NE UNA ================= */

  /* La mateixa activitat a 3r B i a 3r C. Es copia la rúbrica i NO les
     avaluacions: són d'uns altres nens. També es deixa anar la columna
     del registre, que és d'un altre grup. */
  function copia(rubrica, nouNom, nouGrup) {
    var c = JSON.parse(JSON.stringify(rubrica));
    c.id = _id('ra');
    c.nom = (nouNom || c.nom || '').trim();
    c.valors = {};
    c.enviades = {};
    c.itemId = null;
    c.grup = nouGrup || null;
    c.creada = new Date().toISOString().slice(0, 10);
    c.criteris = (c.criteris || []).map(function (x) {
      return { id: _id('c'), nom: x.nom, pes: x.pes, textos: (x.textos || []).slice() };
    });
    return c;
  }

  /* ================= EL QUE VEU LA RESTA DE L'APP ================= */

  window.RubAval = {
    NIVELLS_DEFECTE: NIVELLS_DEFECTE,
    nivellsPerDefecte: nivellsPerDefecte,
    nova: nova,
    criteriNou: criteriNou,
    nota: nota,
    notesDe: notesDe,
    maxim: maxim,
    puntsMaxNivell: puntsMaxNivell,
    posaNivell: posaNivell,
    posaColumna: posaColumna,
    treuCriteri: treuCriteri,
    treuNivell: treuNivell,
    ambNivell: ambNivell,
    canvis: canvis,
    marcaEnviades: marcaEnviades,
    problemes: problemes,
    copia: copia,
    clau: clau,
    llegeix: llegeix,
    desaLocal: desaLocal,
    midaDe: midaDe,
    desa: desa,
    carrega: carrega,
    carregaDelFull: carregaDelFull,
    clauAlumne: clauAlumne,
    vaPerPosicions: vaPerPosicions,
    migraClaus: migraClaus,
  };
})();
