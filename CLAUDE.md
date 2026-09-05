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

⚠ **Sincronitzar NO és publicar.** El `sync-totes.js` copia els fitxers al
disc; l'app que la mestra obre viu al seu GitHub Pages i no canvia fins que
s'hi fa `git push`. Ara `estat-apps.js` ho comprova i avisa amb **«NO
PUBLICADA»**, però abans deia «Tot al dia» amb l'app d'en Pol servint una
versió vella, i se'n va adonar ell.

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
- **`BACKEND_MINIM` (a `js/versio.js`) NO es puja a cada versió.** És la versió
  més vella del `Code.gs` amb què l'app encara funciona, i és el que decideix
  si surt la franja groga de «servidor endarrerit». Puja-la **només** quan
  l'app deixi de funcionar amb el servidor d'abans (una acció nova al
  `Code.gs`, un camp nou que el navegador espera). Si el canvi és de pantalla,
  no la toquis: si no, l'avís sortirà quan no toca i deixarà de servir de res.
- ⚠ **El `appsscript.json` NO viatja amb el `Code.gs`.** Són dos fitxers que
  s'enganxen a mà per separat, i el segon no se li demana gairebé mai: per
  això es queda enrere. Si el teu canvi fa servir una API que demana un
  permís nou (`ScriptApp`, `DriveApp`, `Tasks`…), **passa-li també el
  `appsscript.json` i digues-li com s'enganxa** (Configuració del projecte →
  «Mostra el fitxer de manifest»). Si no, li petarà amb un error en anglès
  que no diu què s'ha de fer. Va passar el 4/9/2026 amb els disparadors.
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

## Passar una millora a «Possibles actualitzacions»

Quan en Pol digui, **a la conversa d'una mestra**, alguna cosa com:

> «fes-me tot el que necessito per a poder passar-ho a possibles
> actualitzacions», «prepara-m'ho per compartir-ho», «passa-ho al catàleg»

vol dir: **la cosa que acabem de fer en aquesta app pot servir a més gent.**
Prepara-l'hi **un sol bloc per copiar i enganxar**, i res més. Ell el porta a
la conversa de la mare i des d'allà arriba a totes les mestres.

No preguntis de quina millora es tracta si només n'hi ha una de candidata:
és el que s'acaba de fer en aquesta conversa. Si n'hi ha diverses, pregunta
quina.

**Escriu EXACTAMENT això, en un sol bloc de codi, sense res abans ni
després** (ell copia i enganxa; qualsevol cosa de més li fa feina):

    === PER A LA LLISTA (js/millores.js) ===
    {
      id: 'color-verd',
      titol: 'L\'app en verd',
      ras: 'Canvia el granat de tota l\'app per un verd.',
      mes: [
        'Es tria des de Configuració i es pot tornar enrere quan vulguis.',
        'No toca res del que hi ha escrit: només els colors.',
      ],
      data: '2026-09-05',
      rols: ['tutor', 'direccio'],   // OPCIONAL. Si no hi és, la veu tothom.
    },

    === COM ESTÀ FETA (MILLORES.md) ===
    ## `color-verd` — L'app en verd

    **Què fa:** una frase.

    **Fitxers:** quins es toquen i què s'hi fa a cadascun.

    **Com funciona:** l'explicació de debò.

    **Paranys:** el que va costar de trobar.

    **Depèn de:** només pantalla / també `Code.gs` / toca el projecte de la
    mestra (i per què).

**Les regles del text de dalt** (la meitat de la llista la llegirà una
mestra amb poc temps):

- `id`: en minúscules i amb guions, i **que no canviï mai**. És el que
  identifica la petició al correu i el que recorda si algú ja l'ha demanada.
- `ras`: **UNA frase**, ras i curt, del que aconsegueix. És l'única cosa que
  llegirà molta gent. Res de noms de fitxers ni de funcions.
- `mes`: tres o quatre línies com a molt: què fa i on es clica.
- ⚠ **NO hi posis MAI el nom de la mestra** que ho va demanar, ni a la
  llista ni enlloc. Ho va dir en Pol el 5/9/2026: «no ho vull. Només
  l'actualització».
- `data`: la d'avui.
- `rols`: **només si la millora no té sentit per a tothom.** Els valors són
  `tutor`, `especialista` i `direccio`. Una especialista no té tutoria ni és
  qui escriu a les famílies: oferir-li segons què només seria fer-li demanar
  una cosa que després no li serviria. Si serveix a tots, no hi posis res.
- La part de **com està feta** és per a qui l'hagi de fer, no per a la
  mestra: allà sí que hi van els fitxers, el perquè i els paranys. Escriu-la
  pensant que qui la llegirà no ha vist mai aquesta conversa.

**El «Depèn de» vol dir això, i no altra cosa** (en Pol, 5/9/2026: «si tenim
la biblioteca general i la resta són ponts cap a aquesta, qui la demani no
haurà d'enganxar res»; té raó):

- **Només pantalla** — la mestra no fa res: li arriba amb l'avís de versió
  nova de l'app.
- **També `Code.gs`** — la mestra TAMPOC no fa res. En Pol enganxa la
  biblioteca **un sol cop** i arriba a totes alhora. Les accions noves que
  demana el navegador hi passen soles: el pont té `doGet` i `doPost` i ho
  delega tot.
- **Toca el projecte de la mestra** — l'únic cas en què ella (o en Pol al
  seu ordinador) ha d'enganxar alguna cosa. Passa NOMÉS per tres motius, i
  s'ha de dir quin:
  1. una **funció nova d'editor**, de les que s'executen des de l'Apps
     Script: el pont no la té i li cal una línia nova;
  2. un **disparador nou**: Google crida una funció DEL SEU projecte, o
     sigui que ha de ser al pont;
  3. un **permís nou** al `appsscript.json`.

Si no és cap d'aquests tres, no diguis que ha d'enganxar res: la faries anar
a l'Apps Script per no res.

## Estil de treball preferit
- Canvis incrementals i provats. Explica el que fas i per què.
- Prioritza velocitat i simplicitat d'ús: els mestres tenen poc temps.
