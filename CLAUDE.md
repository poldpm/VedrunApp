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
