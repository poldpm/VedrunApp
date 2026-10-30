# Com està feta cada millora

Aquí hi ha la **recepta tècnica** de cada cosa que s'ofereix a «Possibles
actualitzacions». La llista que veu la mestra és a `js/millores.js`; això és
per a **qui l'hagi de fer**.

**Per què existeix:** una mestra veu una millora a la llista, la demana, i en
Pol va a la conversa d'aquella mestra i diu «fes-li la del color verd». Si
aquí no hi ha la recepta, aquella conversa se l'ha d'inventar de nou i acabes
amb la mateixa cosa feta de dues maneres diferents a dues apps. Amb la
recepta, surt igual.

**Aquest fitxer se sincronitza a totes les apps**, o sigui que qualsevol
conversa el pot obrir. No se'l baixa cap navegador: no fa l'app més pesada.

---

## Com s'hi afegeix una

Quan en Pol enganxi el bloc que li ha preparat la conversa de la mestra
(veure `CLAUDE.md`, apartat «Passar una millora a Possibles actualitzacions»):

1. La part **PER A LA LLISTA** va a `MILLORES` de `js/millores.js`.
2. La part **COM ESTÀ FETA** va aquí sota, amb el mateix `id`.
3. Puja la versió i sincronitza.

El `id` ha de ser **el mateix als dos llocs**, i no es canvia mai: és el que
identifica la petició al correu i el que recorda si una mestra ja l'ha
demanada.

---

<!-- Les receptes, una per millora, amb aquesta forma:

## `id-de-la-millora` — Títol

**Què fa:** una frase.

**Fitxers:** quins es toquen i què s'hi fa a cadascun.

**Com funciona:** l'explicació de debò, la que estalvia haver-hi de pensar
una altra vegada.

**Paranys:** el que va costar de trobar. Aquesta part és la que més val.

**Depèn de:** `només pantalla`, `també Code.gs` o `toca el projecte de la
mestra`. Compte amb l'últim: amb la biblioteca, un canvi de `Code.gs` NO
obliga la mestra a fer res —en Pol enganxa la biblioteca un cop i arriba a
totes. Només cal tocar el seu projecte si hi ha una funció nova d'editor, un
disparador nou o un permís nou al `appsscript.json`.

-->

## `incidencies-familia` — Avisar la família d'una incidència

**A qui s'ofereix:** tutors i direcció. A especialistes **no**: no tenen
tutoria ni són qui escriu a les famílies.

**Què fa:** posa un tercer botó a cada targeta d'alumne que obre un formulari
per explicar una incidència, i d'allà surt el Gmail amb el correu a la família
ja escrit; a la fitxa de l'alumne hi queda el compte de les comunicades.

**Com s'encén:** a `js/personal.js` de la seva app,

```js
window.EINES_INCIDENCIES = true;
```

Sense això no hi ha ni botó a les targetes ni apartat a la fitxa. ⚠ Al
`personal.js` **no s'hi puja la versió**: el proper sync la revertiria.

**Fitxers:** ⚠ **des de la v274 això és al BASE**, no al `personal.js` de
cada mestra. Abans s'enganxava sencer a `js/personal.js`; es va passar al
base perquè així totes tenen la mateixa versió i reben els arranjaments, en
comptes de tenir-ne cadascuna una còpia que divergeix. Si trobes una app amb
l'enganxall vell al `personal.js`, **treu-l'hi i deixa-hi només
l'interruptor**: si no, tindrà el botó dues vegades.

- `js/incidencies.js` — tot: l'interruptor, la plantilla, el botó, la
  finestra, el registre i l'apartat de la fitxa.
- `css/main.css` — bloc `.inc-*`.
- `index.html` — el `<script>` i la `.fitxa-card` `#fitxaIncidenciesCard`
  (neix amb `display:none`), just després de la d'`#fitxaEntrevistes`.
- `js/app.js` — tres línies: el botó dins `renderAlumnesList`, `pintaFitxa`
  dins `renderFitxa` i `refresca()` quan el bootstrap reemplaça `_perfil`.
- `js/perfil.js` — una línia: `refresca()` quan arriba el perfil del full.
- `js/millores.js` — `interruptor: 'EINES_INCIDENCIES'` a l'entrada.
- `sw.js` — `./js/incidencies.js` a l'`ASSETS`, o desconnectada no hi seria.

**Com funciona:**

- `_hiEs()` és `window.EINES_INCIDENCIES === true && !esEspecialista()`. Es
  llegeix **en directe a cada crida**, no en carregar el fitxer: `personal.js`
  es carrega l'ÚLTIM i en aquell moment l'interruptor encara no hi és. La
  segona meitat és a posta: una especialista no té tutoria ni és qui escriu a
  les famílies, i val més comprovar-ho dues vegades que trobar-se escrivint a
  una família que no és la seva.
- El botó és una `<button>` que reaprofita `.alumne-card-btn` sencer (marc,
  mida i els 44×44 del dit al mòbil); a dins, un SVG amb el cercle ple i
  l'exclamació blanca. Blanc sobre `#C0392B` són 5,44:1 de contrast, o sigui
  que passa l'AA.
- El correu s'obre amb `window.open` cap a
  `https://mail.google.com/mail/?view=cm&fs=1&to=…&su=…&body=…`. No s'envia
  res des de l'app: només es prepara el redactor.
- Les adreces surten de `personal[id].correu1` i `.correu2`, partides per
  comes, punts i comes, barres o espais (un camp en pot portar més d'una) i
  sense repetides. El gènere surt de `students[i].genere`.
- La plantilla té comodins en català (`{nom}`, `{elnom}`, `{fill}`,
  `{incidencia}`, `{mestra}`, `{grup}`) i es pot editar des de la mateixa
  finestra. `{elnom}` passa per `_articleNom()`, que ja resol «en Marc / la
  Maria / l'Anna». En desar-la es comprova que hi quedi `{incidencia}`: sense
  ell, el que escrigui de cada cas no sortiria al correu.
- La previsualització ensenya el correu sencer i es repinta a cada tecla, per
  oient (`addEventListener('input')`) i no amb un `oninput` escrit dins d'una
  cadena.
- **Es desa dins del perfil**, a `_perfil.incidencies = { plantilla, registre }`,
  i es puja amb l'acció `saveProfile` que ja existeix. El perfil es desa com
  a JSON lliure, o sigui que hi cap qualsevol cosa: per això aquesta millora
  NO necessita cap acció nova al `Code.gs`. El mateix truc serveix per a
  qualsevol dada personal futura.
- La clau de cada alumne és `grup + '#' + rowId` (la fila del full compartit),
  igual que les entrevistes.
- El compte va **només a la fitxa**. A la targeta no hi ha ni número ni cap
  marca: tots els botons són idèntics. És a posta —la llista de la classe no
  ha d'ensenyar a qui s'ha hagut d'escriure a casa, i menys amb algú altre
  mirant la pantalla.

**Paranys:**

- **`_perfil` es reemplaça SENCER** quan el perfil arriba del full
  (`js/perfil.js`) i també al bootstrap (`js/app.js`). No et guardis mai una
  referència a `_perfil.incidencies`: llegeix-la en directe cada vegada
  (`_calaix()`), i repinta als dos llocs amb `Incidencies.refresca()` o
  ensenyaràs el compte d'abans de carregar. Aquest és el bug que t'espera si
  no ho fas, i per això `refresca()` existeix.
- La clau ha de ser el `rowId`, **no** el `students[].id`: aquest últim és la
  posició dins la llista i canvia si els alumnes es reordenen —i llavors el
  compte d'un nen passaria a ser d'un altre.
- El compte se suma quan **s'obre** el Gmail, no quan la família el rep: no hi
  ha manera de saber-ho. Per això cada incidència s'ha de poder esborrar de
  la fitxa, i el text ho ha de dir («això només treu l'apunt d'aquí: el correu
  que vas enviar no es desfà»).
- Si la fitxa no té cap correu, es diu **en obrir** el formulari (i on
  s'arregla: el full de la secretaria) i el botó d'enviar neix blocat.
  Deixar-la escriure-ho tot i fallar al final és pitjor.
- `window.open` el pot barrar el navegador: cal caure cap a `mailto:`.
- Els tres ganxos de `js/app.js` i `js/perfil.js` van dins d'un `try`: un
  error pintant un botó no pot deixar la llista d'alumnes a mitges.
- El botó no es pot afegir dues vegades a la mateixa targeta: `afegeixBotoTargeta`
  surt si ja hi troba un `.inc-card-btn`.
- El missatge s'acaba amb `{mestra}` i `{grup}`, cada un a la seva línia. Una
  mestra **sense el nom al perfil** enviava un correu que s'acabava amb una
  línia buida on hi havia d'anar la signatura, i no ho sabria mai. Per això
  `omple()` va línia per línia: una línia que era **només comodins** i que
  queda buida desapareix. Les que ella deixi en blanc a posta no es toquen.
- Al banc de proves del navegador de mentida, `querySelector` torna sempre un
  element (no `null`), o sigui que **el botó de la targeta no es pot provar
  per DOM** allà: el guard de «ja hi és» salta sempre. Es prova la lògica
  (`hiEs`, `correus`, `omple`, `clau`) i l'apartat de la fitxa, que sí que va
  per `getElementById`. Veure `eines/comprova-incidencies.js`.

**Depèn de:** només pantalla. La mestra no ha de fer res —li arriba amb l'avís
de versió nova i en Pol li encén l'interruptor. No cal tocar el `Code.gs` ni
redesplegar res, perquè `saveProfile` ja hi és.


---

## `rubriques-avaluacio` — Rúbriques d'avaluació d'activitats

**Què fa:** avaluar una activitat amb una rúbrica pròpia (criteris amb pes i
nivells) i passar la nota resultant al registre de notes d'aquella
assignatura i trimestre.

**Fitxers:**
- `js/rubaval.js` — el model i els càlculs. No toca cap pantalla: es prova
  amb `node eines/comprova-rubaval.js` (21 proves).
- `js/rubaval-ui.js` — la llista, l'editor, la graella d'avaluació i el pas
  al registre.
- `index.html` — el botó del menú (`navRubaval`, neix amagat), la pàgina
  `page-rubaval` i els dos `<script>`.
- `css/main.css` — blocs `.rubaval-*`, `.rav-*`.
- `js/app.js` — dues línies: el ganxo de `showPage('rubaval')` (que torna a
  l'Inici si l'eina no hi és) i `RubAvalUI.aplicaInterficie()` a l'arrencada.
- `js/notes.js` — `notesCreaItem(nom, max, pes)`, separat d'`addNotaItem()`, i el botó
  «rúbrica» a la capçalera de la columna que en ve (només si l'eina està encesa).
- `js/personal.js` de la mestra — l'interruptor.

**Com s'encén:** a `js/personal.js` de la seva app,

```js
window.EINES_RUBAVAL = true;
```

Sense això no hi ha ni botó al menú ni pàgina (ni entrant-hi per `#rubaval`).
L entrada del catàleg (`js/millores.js`) porta `interruptor: 'EINES_RUBAVAL'`:
és el que fa que, a qui ja la tingui encesa, «Possibles actualitzacions» li
digui **«Ja la tens ✓»** en lloc d oferir-li-la. Tota millora que s encengui
amb un interruptor l ha de declarar allà.
El codi arriba a totes les apps amb el `sync-totes.js`; només s'encén a qui la
demani. ⚠ Al `personal.js` **no s'hi puja la versió**: el proper sync la
revertiria.

**Com funciona:**
- Una rúbrica és `{ nom, sobre:10, pes, nivells:[{nom,punts}], criteris:[{id,nom,pes,textos}],
  valors:{alumneId:{criteriId: índexDelNivell}}, enviades:{alumneId:nota}, itemId, grup }`.
- Es desa per assignatura+grup+trimestre amb el calaix genèric del full
  (`saveRubrica`/`loadRubrica`, clau `aval_<materia>_<trim>`). **No cal tocar
  el `Code.gs`.**
- La nota: suma de `punts(nivell) × pes(criteri)` dividida pel màxim dels
  criteris **avaluats**, portada a 10.
- Passar-ho al registre fa el que faria la mestra a mà: `notesCreaItem` +
  `updateNota` per alumne, o sigui la cua de caselles de sempre.

**Paranys:**
- **De cada alumne s'hi desa l'ÍNDEX del nivell, no els punts.** És el que fa
  que canviar un pes o els punts d'un nivell refaci les notes en comptes de
  deixar mig grup calculat amb les regles velles. Per això treure un nivell
  ha de desplaçar els índexs de tothom (`RubAval.treuNivell`, amb proves).
- **Un alumne sense cap criteri avaluat no té nota (`null`), i no se li passa
  res al registre.** Un zero és una nota que algú decideix.
- El refresc de fons del registre **reemplaça** `notesItems`: abans de crear
  la columna s'espera que hagi carregat (`esperaRegistre`).
- Les notes es casen amb l'alumne **pel nom**; el codi, només com a última
  opció.
- Avaluar no pot fer una crida per casella: local a cada clic i al full un
  segon i mig després de l'últim canvi (i de cop en sortir o tancar).
- Els oients de `window` van amb `typeof window.addEventListener === 'function'`
  al davant, o els bancs de proves no poden ni carregar l'app.

**Depèn de:** només pantalla. La mestra no ha de fer res: li arriba amb l'avís
de versió nova. No cal tocar el `Code.gs` ni redesplegar res.

## `carpeta-viatgera` — La Carpeta Viatgera com a columna de la nota

**Què fa:** la nota de la Carpeta Viatgera es posa un sol cop i surt sola, amb
el seu pes, a les graelles de Matemàtiques i Català.

**Fitxers:**
- `js/app.js` — `carpetaEncesa()` i `esClauCarpeta()` (l'interruptor i les dues
  claus amb què arriba), i el filtre de la llista d'assignatures de la fitxa.
- `js/notes.js` — `carpetaFora()`, cridada des de `sortCarpetaLast()` i des del
  refresc de fons.
- `Code.gs` — `CARPETA_NOTE`, `MATERIES_AMB_CARPETA`, `propagaCarpeta()` i
  `moveCarpetaBeforeMitjana()`. Ja hi era des de la v268; no s'hi ha tocat res.
- El `js/personal.js` de qui la tingui: `window.EINES_CARPETA = true`.

**Com funciona:** la mestra té una pestanya de notes «Carpeta Viatgera» al seu
full (o l'assignatura al perfil). Quan hi desa una nota, `propagaCarpeta()`
escriu la mitjana d'aquella pestanya a una columna de Mates i Català, marcada
amb la nota de cel·la `CARPETA_NOTE` (`10|2|carpeta_ref`), de només lectura i
amb pes 2. La columna es manté sempre just abans de «Mitjana».

**Paranys:**
- **L'interruptor no filtra només la pantalla: treu l'ítem de `notesItems`.**
  `calcMitjana()` recorre la llista, o sigui que una columna amagada però
  present seguiria comptant per a la nota final sense que es veiés enlloc. Això
  és pitjor que ensenyar-la.
- Arriba amb **dues claus**: `carpeta` (la pestanya del full) i
  `carpetaviatgera` (l'assignatura del perfil, normalitzada). Les dues s'han
  de filtrar.
- El refresc de fons **reemplaça** `notesItems` sense passar per
  `sortCarpetaLast()`: per això el filtre també hi és a sobre.
- `MATERIES.carpeta` hi ha de seguir sent encara que estigui apagada, perquè
  qui la té vegi el rètol bo i no la clau.
- **No és al `manual.html`.** És una eina
  d'una sola mestra: un manual que explica una cosa que no tens et fa buscar-la
  i no trobar-la. Si algun dia es generalitza, llavors sí.

**A qui s'ofereix:** de moment, **només a la Mireia Duran**, i l'entrada del
catàleg és al seu `js/personal.js`, no a `js/millores.js` de la mare. El
catàleg només sap filtrar per ROL (`tutor`, `especialista`, `direccio`) i ella
és tutora com tres més, o sigui que posar-la a la mare l'oferiria a tothom.
Quan s'hagi d'oferir a més gent, es mou l'entrada a `js/millores.js` amb
`interruptor: 'EINES_CARPETA'` i el `rols` que toqui.

**Depèn de:** només pantalla. La mestra no ha de fer res: s'encén posant-li
l'interruptor al seu `js/personal.js`. El `Code.gs` ja ho porta des de la v268,
o sigui que no cal redesplegar res.

## `eines-targetes` — Les eines, en targetes

**Què fa:** el menú «Eines» deixa de desplegar-se i passa a obrir una pàgina
amb una targeta per eina.

**Fitxers:**
- `index.html` — un `<a id="navEinesPagina">` que neix amagat (el botó del
  menú) i la pàgina `#page-eines` amb la graella buida `#einesGraella`.
- `js/app.js` — `einesPaginaHiEs()`, `einesAplicaInterficie()` (que es crida
  a l'arrencada, després de les eines que s'encenen una a una),
  `renderEines()`, la taula `EINES_DESC` i dues línies a `showPage()`: la
  redirecció de `#eines` a l'inici quan l'interruptor és apagat, i la pintada.
- `css/main.css` — `.eines-graella`, `.eina-card…`, `.eines-buit`.
- `eines/comprova-eines.js` — el banc, dins de `prova-tot.js`.
- `manual.html` — apartat «Les eines, en targetes (opcional)» i una fila a la
  taula de «Personalitzar l'app».

**⚠ AIXÒ JA NO ÉS UNA MILLORA DEL CATÀLEG.** Va néixer amb interruptor
(`EINES_PAGINA`) i es va provar així; des de la **v296** és l'única manera de
veure les eines i la tenen totes les mestres. En Pol, 17/10/2026: «no vull que
sigui una possible actualització, posa-ho a tothom directament». L'entrada del
`js/millores.js` i l'interruptor ja no hi són: això queda com a recepta de com
està fet.

**Com funciona:** `renderEines()` **no té la llista d'eines escrita**: la
llegeix dels `<a>` de `#einesItems`, una llista **amagada** de l'index.html que
és on viu de debò quines eines hi ha, i en treu la icona, el rètol i la pàgina
que obren. De `EINES_DESC` només en surt la línia del que fa cada eina. Per
afegir una eina, doncs, s'hi afegeix un `<a>` i la targeta hi surt sola.

**Paranys:**
- La llista no es podia escriure a mà: el dia que s'afegís una eina, la
  pàgina s'hauria quedat sense la seva targeta i no ho hauria dit ningú. Com
  que surt dels `<a>` de `#einesItems`, **les eines que la mestra no té no hi
  surten soles**: el seu botó ja està amagat (la distribució de l'aula a una
  especialista, les rúbriques o les aules lliures a qui no les ha demanades).
- ⚠ **`#einesItems` s'amaga amb `display:none` al CONTENIDOR, mai botó per
  botó.** El `style.display` de cada `<a>` és justament el que `renderEines()`
  llegeix per saber què té aquesta mestra: si algun dia s'amaguessin d'un en
  un, la pàgina es quedaria buida.
- Al mòbil les targetes van de dues en dues i s'hi amaga el text: amb una sola
  columna, arribar a l'última eina era mitja pantalla de baixar.

**Depèn de:** només pantalla. La mestra no ha de fer res: s'encén posant-li
l'interruptor al seu `js/personal.js`. No toca el `Code.gs`.

### `eines-targetes` · l'afegit del 17/10/2026 — «Tinc una idea!»

**Què fa:** l'última targeta de la pàgina d'Eines no obre cap eina: obre una
finestra on la mestra explica el que li faria servei, i li arriba un correu a
en Pol (com el «Jo la vull!» de les possibles actualitzacions).

**Fitxers:**
- `index.html` — la finestra `#ideaOverlay` amb el camp `#ideaText`.
- `js/app.js` — la targeta al final de `renderEines()` (sempre, encara que no
  hi hagi cap eina) i `obreIdea()` / `tancaIdea()` / `ideaEnvia()`.
- `css/main.css` — `.eina-card-idea`: sense fons i amb la vora de ratlletes.
- `Code.gs` — l'acció `enviaIdea` i la funció del mateix nom, al costat del
  `demanaMillora` i amb el mateix `_milloraCorreu_()`.
- `js/versio.js` — `BACKEND_MINIM` puja a v290 (veure Paranys).

**Com funciona:** el navegador envia `{action:'enviaIdea', qui, idea}` i el
servidor li engega un correu a en Pol amb l'assumpte «Tinc una idea! (Nom
Cognom)», el text sencer i el compte de Google de debò de qui l'envia (el del
perfil pot estar mal escrit; el de `Session.getActiveUser()` no menteix).

**Paranys:**
- **No es marca enlloc com a «demanada».** No surt de cap llista: se'n poden
  enviar tantes com vulgui, i una idea que no es pogués repetir seria una
  trampa.
- Si el correu **no** surt, la finestra **no es tanca** i el que ha escrit s'hi
  queda. Tancar-la diria que en Pol ho sap quan no ho sabria ningú, i a sobre
  li hauria fet perdre el text.
- És una **acció nova al `Code.gs`**: amb el servidor d'abans, el botó no pot
  funcionar. Per això `BACKEND_MINIM` puja a v290 i surt la franja groga fins
  que la biblioteca està al dia. S'enganxa **un sol cop** i val per a totes.
- El correu es **talla als 4.000 caràcters**: un correu no és on abocar-hi un
  document sencer.

**Depèn de:** també `Code.gs`. La mestra no ha de fer res; en Pol enganxa la
biblioteca un sol cop i arriba a totes alhora.

## `aules-lliures` — Aules lliures

**Què fa:** diu quines aules auxiliars de l'escola estan buides ara (o al dia
i l'hora que es triï) i fins a quina hora ho estaran.

**Fitxers:**
- `Code.gs` — l'acció `getAulesLliures` i, amb ella, `_aulesFullId()`,
  `_aulesDelFull()` i les ajudes d'hores. Llegeix el full i prou.
- `js/aules.js` — tot el que es veu: la pantalla, el càlcul de qui és lliure
  i el cache al navegador. Neix apagat (`window.EINES_AULES`).
- `index.html` — el botó del menú (`#navAules`, amagat de naixement) i la
  pàgina `#page-aules`.
- `css/main.css` — `.aules-*` i `.aula-lliure`.
- `sw.js` — `js/aules.js` al cache de fora de línia.
- `js/app.js` — la descripció de la targeta d'Eines, la redirecció de
  `#aules` i la pintada en entrar-hi.
- `eines/comprova-aules.js` — el banc (28 proves), dins de `prova-tot.js`.

**On és el full:** a la propietat **`AULES_FULL` de la BIBLIOTECA**, amb
l'identificador del full «Horari aules auxiliars» de l'escola. Es posa un sol
cop i val per a totes les apps alhora, com el `LOGIN_DOMINI`. Una mestra en pot
tenir un altre amb la mateixa propietat al seu projecte.

⚠ **No va escrit al codi a posta.** Els repositoris de les apps són PÚBLICS i
aquell full està obert a qui en tingui l'enllaç: escriure-hi l'identificador
seria repartir-l'hi a tothom.

**Com funciona:** el servidor llegeix el full sencer i el torna tal com està;
qui decideix què és lliure és el navegador. Així, canviar l'hora a la pantalla
és instantani i no fa cap altra volta al servidor —l'eina es fa servir de peu
al passadís—, i l'horari queda guardat al navegador per si s'obre sense
connexió.

**L'hora (v297):** s'escriu en un `input type="time"`, no es tria d'una
llista. En Pol, 17/10/2026: «potser interessen altres hores que no estan dins
del llistat» —una estona d'entremig a les 12:30, per exemple—. Les hores de
classe queden com a botonets de drecera sota el camp. El camp pot venir buit o
a mitges: llavors es diu, en comptes de fer veure que s'ha buscat.

**Paranys:**
- **Els blocs ajuntats.** Al full n'hi ha per tot arreu (una activitat de dues
  hores seguides, l'ESBARJO que travessa la setmana). D'un bloc ajuntat, el
  text només hi és a la casella de dalt a l'esquerra: la resta tornen BUIDES.
  Sense escampar-lo amb `getMergedRanges()`, **una aula ocupada d'11:10 a
  12:50 sortiria lliure a les 12:00** i la mestra hi aniria amb els nens. És el
  parany més gros de tots, i el banc el prova.
- **L'última fila és l'hora de tancar**, no una franja: és la que diu fins quan
  dura l'última classe. Al full sempre hi és i sempre és buida.
- **L'ESBARJO no és ningú dins de l'aula.** Al pati l'aula és buida: es marca
  la franja com a pati, se'n buiden les caselles i a la pantalla es diu, perquè
  «lliure a les 10:50» no enganyi.
- **El «lliure fins»** ha d'arribar al final del tros lliure sencer, no al final
  de la franja on s'ha buscat.
- **No es puja el `BACKEND_MINIM`.** És una acció nova al `Code.gs`, però a qui
  no tingui l'eina encesa el servidor d'abans li va perfectament: la franja
  groga seria una alarma falsa. En comptes d'això, si el servidor contesta
  «Accio desconeguda», l'eina ho tradueix a una frase que la mestra entengui.
- Cada pestanya porta **les seves hores** (el gimnàs en té de diferents de les
  aules): no hi ha cap llista d'hores escrita al codi, surten del full.

**Depèn de:** també `Code.gs` **i una propietat nova**. En Pol enganxa la
biblioteca un sol cop i hi posa `AULES_FULL`; la mestra no ha de fer res.

---

## `temporitzador` — Temporitzador

**Què fa:** comptes enrere grans, pensats per projectar a la pissarra digital,
amb un rellotge de broques al costat. Demanat per una mestra que no vol haver
d'obrir el ClassroomScreen quan ja té aquesta app oberta tot el dia. El
30/10/2026 s'hi va afegir el rellotge i poder-ne tenir uns quants alhora, amb
nom (fins a sis: projectats a la paret, més no es llegeixen).

**Fitxers:**
- `js/temporitzador.js` — tot: el compte, la pantalla i els botons. Neix
  apagat (`window.EINES_TEMPORITZADOR`).
- `index.html` — el botó de la llista d'eines (`#navTemporitzador`, amagat de
  naixement) i la pàgina `#page-temporitzador`.
- `css/main.css` — `.temp-*`, amb el número en `clamp(…, vw, …)` perquè creixi
  amb la pantalla, i el bloc `:fullscreen`.
- `sw.js` — `js/temporitzador.js` al cache de fora de línia.
- `js/app.js` — la descripció de la targeta d'Eines (`EINES_DESC`), la
  redirecció de `#temporitzador` a qui no el tingui, la pintada en entrar-hi i
  l'`aplicaInterficie()`.
- `js/millores.js` — l'entrada del catàleg, amb `interruptor`.
- `eines/comprova-temporitzador.js` — el banc, dins de `prova-tot.js`.

**Com funciona:** l'estat és o «compta» (hi ha una hora d'acabar) o «aturat»
(queden N mil·lisegons). Es desa a `localStorage` perquè sobrevisqui a canviar
d'apartat i a tancar l'app.

**Paranys:**

1. **El compte no es va restant: es calcula de l'hora d'acabar.** Anar fent
   `queden--` cada segon sembla que funcioni i no funciona: quan la pestanya
   passa a segon pla, el navegador frena o atura aquell rellotge i en tornar
   falten minuts. Es desa l'hora d'acabar i el que es pinta surt sempre de
   restar-li l'hora d'ara.
2. **Un `fi` vell no s'arrossega.** Si el deixa comptant i tanca l'app, en
   obrir-la l'endemà no li ha de sonar: en recuperar l'estat, una hora
   d'acabar que ja ha passat es llença.
3. **La pantalla desperta es perd sola** quan la pestanya passa al darrere (el
   navegador retira el `wakeLock`). S'ha de tornar a demanar al
   `visibilitychange`, o el portàtil del projector s'adorm a mitja activitat.
4. **El so necessita un clic abans.** Els navegadors no deixen sonar res fins
   que algú ha interaccionat; aquí sempre ve del botó «Comença», o sigui que
   es pot. Es fa amb l'`AudioContext`, sense cap fitxer de so.
5. **El tic no pot repintar la llista sencera.** Cada compte té un nom que la
   mestra escriu. Si la pintada de cada quart de segon refés la llista, li
   esborraria el que està escrivint i li trauria el cursor. Per això hi ha
   `_pintaLlista()` (quan canvia què hi ha) i `_pintaNumeros()` (a cada tic,
   que només toca els números).
6. **El que es desava abans era UN temporitzador, com a objecte.** Des que
   n'hi pot haver diversos es desa una llista. En recuperar es mira si el que
   hi ha és l'objecte vell i es converteix: si no, una mestra que el tingués
   comptant el perdria en actualitzar.
7. **Si n'acaben dos alhora, un sol so.** Dos xiulets encavalcats no es
   distingeixen i només fan soroll.
8. **El tic només corre si cal.** Amb tot aturat i el rellotge amagat no es
   desperta el navegador cada quart de segon per no res.

**Depèn de:** **només pantalla.** No parla mai amb el servidor ni desa res al
full de càlcul, i això és a posta: es fa servir amb el projector engegat i la
connexió que hi hagi. La mestra no ha d'enganxar res.
