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

**Fitxers:** només `js/personal.js` de la seva app. Res més. El CSS, el botó,
el formulari i l'apartat de la fitxa s'injecten tots des d'allà, o sigui que
no hi ha cap fitxer base tocat i l'app segueix rebent tots els arranjaments.

**Com funciona:**

- S'embolcallen tres funcions que ja hi són: `renderAlumnesList` (per afegir
  el botó a `.alumne-card-actions` de cada targeta), `renderFitxa` (per
  encaixar una `.fitxa-card` just després de la que conté `#fitxaEntrevistes`)
  i `perfilRenderAllSelectors` (per repintar quan arriba el perfil del full).
- El CSS es posa amb un `<style>` creat des del JS. Els noms de classe van
  amb prefix propi per no xocar amb res del base.
- El botó és una `<button>` de 30×30 amb el mateix marc que els seus dos
  veïns; a dins, un SVG amb el cercle ple i l'exclamació blanca. Blanc sobre
  `#C0392B` són 5,44:1 de contrast, o sigui que passa l'AA.
- El correu s'obre amb `window.open` cap a
  `https://mail.google.com/mail/?view=cm&fs=1&to=…&su=…&body=…`. No s'envia
  res des de l'app: només es prepara el redactor.
- Les adreces surten de `personal[id].correu1` i `.correu2`, partides per
  comes, punts i comes o espais (un camp en pot portar més d'una) i sense
  repetits. El gènere surt de `students[i].genere`.
- **Es desa dins del perfil**, a `_perfil.incidencies = { plantilla, registre }`,
  i es puja amb l'acció `saveProfile` que ja existeix. El perfil es desa com
  a JSON lliure, o sigui que hi cap qualsevol cosa: per això aquesta millora
  NO necessita cap acció nova al `Code.gs`. El mateix truc serveix per a
  qualsevol dada personal futura.
- La clau de cada alumne és `grup + '#' + rowId` (la fila del full compartit),
  igual que les entrevistes.
- El compte va **només a la fitxa**. A la targeta no hi ha ni número ni cap
  marca: tots els botons són idèntics. És a posta —la llista de la classe no
  ha d'ensenyar a qui s'ha hagut d'escriure a casa.

**Paranys:**

- `_perfil`, `students`, `personal` i `config` estan declarats amb `let` i
  **NO són a `window`**: `window._perfil` és `undefined`. Igualment s'hi
  arriba pel nom pelat des de `personal.js`, perquè tots els `js/*.js` són
  scripts clàssics i comparteixen el mateix àmbit global. En canvi, les
  funcions que s'embolcallen (`renderFitxa`, `renderAlumnesList`,
  `perfilRenderAllSelectors`) sí que són a `window`, perquè són declaracions
  de funció. Aquesta diferència és la que fa que el patró funcioni.
- **`_perfil` es reemplaça SENCER** quan el perfil arriba del full i també al
  bootstrap. No et guardis mai una referència a `_perfil.incidencies`:
  llegeix-la en directe cada vegada, i repinta després de
  `perfilRenderAllSelectors` o ensenyaràs el compte d'abans de carregar.
  Aquest és el bug que t'espera si no ho fas.
- La clau ha de ser el `rowId`, **no** el `students[].id`: aquest últim és la
  posició dins la llista i canvia si els alumnes es reordenen.
- El compte se suma quan **s'obre** el Gmail, no quan la família el rep: no hi
  ha manera de saber-ho. Per això cada incidència s'ha de poder esborrar de
  la fitxa, i el text ho ha de dir.
- Si la fitxa no té cap correu, digues-ho **en obrir** el formulari (i on
  s'arregla) i deixa el botó d'enviar blocat. Deixar-la escriure-ho tot i
  fallar al final és pitjor.
- `window.open` el pot barrar el navegador: cal caure cap a `mailto:`.
- Tot l'enganxall va dins d'un `try`: si un dia la plantilla canvia el nom
  d'una d'aquestes funcions, es perd el botó però no l'app.
- Si es fa a `js/personal.js`, **NO pugis la versió** (`sw.js`, `js/versio.js`,
  `versio.json`): són fitxers base i el pròxim `sync-totes.js` ho revertiria.
  Per veure-ho, `Ctrl+Shift+R`.

**Depèn de:** només pantalla. La mestra no ha de fer res —li arriba i ja està.
No cal tocar el `Code.gs` ni redesplegar res, perquè `saveProfile` ja hi és.


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
