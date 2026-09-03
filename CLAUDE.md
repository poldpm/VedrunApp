# Instruccions per a Claude Code — App Gestió de Curs (Vedruna Escorial Vic)

Abans de fer res, llegeix **PROJECTE.md**: conté l'arquitectura completa, les
decisions, el model de dades i el workflow. Aquí només hi ha les regles que
has de tenir SEMPRE presents.

## Regles absolutes
1. Tota la interfície i les converses, en **CATALÀ**.
2. Els mestres que no són tutors d'un grup s'anomenen **"especialistes"**, mai "no-tutors".
3. **Cap credencial al codi.** Van a les Script Properties del Apps Script.
   El token del frontend va a `js/config.local.js` (que NO se substitueix mai).
4. Tot es desa a **Google Sheets**; localStorage només és cache temporal.
5. El logo de l'escola és una marca real: no modificar-lo ni aproximar-lo.
6. **Si el canvi es nota des de l'app, actualitza `manual.html` al mateix canvi.**
   Veure "El manual d'ús" aquí sota.

## El manual d'ús (`manual.html`)

El manual és la primera línia de suport: les mestres hi han de poder resoldre
un dubte **sense haver de trucar en Pol**. Un manual desactualitzat és pitjor
que no tenir-ne, perquè les fa buscar coses que ja no hi són.

**Regla:** cada canvi que una mestra pugui notar fent servir l'app entra al
manual **dins el mateix canvi**, no en un de posterior. No cal preguntar-ho.

Entra al manual:
- Una eina, pàgina o apartat nou.
- Un botó, una casella o una opció noves (o que canvien de lloc o de nom).
- Un canvi en com funciona una cosa que el manual ja explica.
- Una cosa que passa a ser configurable per cada mestra (llavors, també a la
  taula de l'apartat **20. Personalitzar l'app**: "què vull canviar" → "on es fa").
- Una limitació o un parany que valgui més dir que no pas que el descobreixin.

NO entra al manual: refactors, optimitzacions, canvis de backend que no es
noten, ni res que no canviï el que la mestra veu o fa.

En escriure-hi:
- Explica-ho **com a un mestre amb poc temps**, no com a un informàtic: què
  aconsegueix i on ho clica. Res de noms de funcions ni de fitxers.
- Manté l'estructura i el disseny que ja hi ha. Els `callout` són per als
  avisos (`.warn`) i els consells (`.tip`).
- Si afegeixes una secció o un `h3` amb `id`, **afegeix-lo també a l'índex**
  del `<nav class="toc">`, o quedarà orfe.
- Comprova que cap `href="#…"` apunti a un id que no existeix.
- `manual.html` està dins el cache del `sw.js`: si el toques, **puja la versió**
  (veure Workflow tècnic).

**Comprova-ho** amb `node eines/comprova-manual.js`: mira els enllaços interns
trencats, els apartats que no són a l'índex (i que per tant ningú no trobarà),
les etiquetes descompensades i que hagis pujat la versió. Torna codi 1 si hi ha
res malament.

**A les apps filles**: `manual.html` se sincronitza de la mare. Si a una mestra
li fas alguna cosa que el manual no explica, posa `manual.html` als seus
`propis` del `FILLA.json` i actualitza-l'hi allà (veure `FILLES.md`).

## ⚠ ABANS DE TOCAR RES: A QUI HA D'ARRIBAR?

Hi ha **una mare i diverses apps**: la plantilla d'especialistes, la de
direcció, i l'app de cada mestra. Un canvi fet aquí no arriba sol enlloc:
cal sincronitzar-lo. I no tots els canvis són per a tothom.

**REGLA: si en Pol no diu a qui va, PREGUNTA-L'HI abans de tocar cap
fitxer.** No ho suposis. Les opcions són:

| Abast | On es fa | Com hi arriba |
|---|---|---|
| **Tots els rols** | aquí, a la mare | `node eines/sync-totes.js` |
| **Només un rol** (especialistes, direcció) | aquí, darrere `esEspecialista()` / `esDireccio()` | `node eines/sync-totes.js` |
| **Només tutors** | aquí, darrere el rol tutor | `node eines/sync-totes.js` |
| **Una sola mestra** | el seu `js/personal.js`, a la seva carpeta | no se sincronitza |

**Compte:** un canvi «per a especialistes» NO es fa a la carpeta
`VedrunApp-Especialistes`. Es fa **aquí**, darrere `esEspecialista()`. Si es
toca el codi dins d'una filla, aquell fitxer deixa de rebre arranjaments per
sempre (veure `FILLES.md`).

**En Pol té una conversa per rol** (Tutors, Especialistes, Direcció) i una de
canvis generals, i **totes treballen aquí, a la mare**. Que la conversa es
digui «Direcció» no vol dir que s'hagi de treballar dins de
`VedrunApp-Direccio`: vol dir que el canvi va dins d'un `esDireccio()`. El
detall és a `PROJECTE.md`, apartat 3ter.

**Per veure a qui arribarà**, abans i després:

```bash
node eines/estat-apps.js            # totes les apps, el seu rol i la seva versió
node eines/estat-apps.js --rol especialista
node eines/estat-apps.js --endarrerides
```

Un canvi general no està acabat fins que:
1. és a la mare i provat,
2. s'ha passat `node eines/sync-totes.js --prova` i després sense `--prova`,
3. `node eines/estat-apps.js` diu «Tot al dia»,
4. i cada app publicada s'ha pujat al seu GitHub.

## ⚠ AQUESTA CARPETA NO ES PUBLICA MAI

Aquesta carpeta és **només la plantilla mare**: la base per crear i mantenir
les apps de les mestres. **No té remote de git i no n'ha de tenir.**

- **No facis `git push`**, ni afegeixis cap `origin`, ni la publiquis a
  GitHub Pages. El repositori `github.com/poldpm/VedrunApp` es fa servir per
  a **l'app d'en Pol**, que es gestiona en una conversa a part: si des d'aquí
  s'hi pujava res, li trepitjaríem l'app publicada.
- Els commits **locals** sí: són l'historial de la plantilla. Només no surten
  d'aquí.
- Els arranjaments arriben a les apps de les mestres amb
  `node eines/sync-totes.js` (des del disc, no per GitHub). Cada filla ja té
  el seu repositori i el seu Pages.

## Workflow tècnic
- Frontend HTML/CSS/JS pur, sense frameworks. Backend: Google Apps Script (`Code.gs`).
- **A cada canvi de frontend, puja la versió als TRES fitxers alhora**, o
  l'avís de versió nova mentirà: `sw.js` (`const CACHE = 'vedruna-vNN'`),
  `js/versio.js` (`VERSIO_APP`) i `versio.json` (`versio` + la llista de
  `canvis`, escrits en llenguatge de mestre).
- **A cada canvi de `Code.gs`: cal desplegar una NOVA versió** al Apps Script.
  Si el canvi NO toca `Code.gs`, no li diguis que redesplegui: no cal.
- No toquis `js/config.local.js` en actualitzar.

## Validació abans de donar per bo un canvi
- `node --check` de cada fitxer JS modificat.
- **`node eines/comprova-controls.js`** — cap botó ni casella pot no fer res.
  Torna codi 1 si en troba. Veure "Botons que no fan res" aquí sota.
- **`node eines/comprova-rols.js`** — carrega l'app sencera en un navegador de
  mentida i li prem els botons **amb els tres rols** (`tutor`,
  `especialista`, `direccio`). Obligatori si has tocat res que depengui del
  rol o del grup de treball: en Pol només trepitja l'app dels tutors, i els
  camins dels altres dos no els prova ningú fins que ja són a mans d'una
  mestra. Torna codi 1 si en falla cap.
- Comprova que l'HTML queda ben tancat.
- Si toques el backend, valida `Code.gs` amb mocks (SpreadsheetApp, PropertiesService…).
- Prova amb dades buides (cas mestre nou): cap render ha de petar.
- **Pregunta't: això ho ha de saber una mestra?** Si sí, el canvi no està
  acabat fins que és al `manual.html`.
- Si has tocat el manual: enllaços interns sense destí trencat, etiquetes
  equilibrades i les entrades noves a l'índex.

## Botons que no fan res

**Va passar el 2 de setembre de 2026 i en Pol el va trobar a la primera:** el
botó de marcar com a feta una tasca del Google Tasks era
`onclick="event.stopPropagation();"` — buit. Es pintava clicable, el rètol
deia "Marcar com a feta", i no passava res.

**Per què l'auditoria no el va trobar:** comprovava que cada handler cridés
una funció que EXISTÍS. Un handler buit passava la comprovació precisament
perquè no cridava res. El forat era del mètode, no una badada puntual.

**Per tant, a cada canvi que toqui la interfície:**

```bash
node eines/comprova-controls.js
```

Busca handlers sense efecte: atributs `on*` buits o que només fan
`stopPropagation`, i el patró que va causar el bug — una variable que val
`''` i que després s'enganxa dins d'un `onclick`
(`const x = cond ? '' : \`fes()\`` … `onclick="${x}"`).

**No n'hi ha prou amb l'eina.** Si el canvi afegeix o toca controls, també
**clicar-los de debò** al banc de proves i comprovar que passa alguna cosa
(una crida al servidor, un avís, un canvi a la pantalla). Un control que es
pinta com a clicable i no fa res és pitjor que no tenir-lo: la mestra clica,
no passa res, i deixa de fiar-se de l'app.

## Estil de treball preferit
- Canvis incrementals i provats. Explica el que fas i per què.
- Prioritza velocitat i simplicitat d'ús: els mestres tenen poc temps.
