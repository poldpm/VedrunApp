# PROJECTE — App "Gestió de Curs" · Vedruna Escorial Vic

> Document de traspàs i referència del projecte. Recull l'arquitectura, les
> decisions clau, les regles absolutes i l'estat actual. Pensat perquè
> qualsevol persona (o Claude Code) pugui continuar el desenvolupament sense
> perdre context.

**Versió actual:** la que digui `versio.json`. Aquí no s'escriu el número —
quedava vell a la primera pujada.
**Idioma de tota la interfície i la documentació:** Català
**Aquesta carpeta és la PLANTILLA MARE:** no és l'app de cap mestre.
No hi ha d'haver mai dades, objectius ni configuració de ningú. Les apps de
cada mestre surten d'aquí amb `eines/nova-filla.js`.

---

## 1. QUÈ ÉS

Aplicació web (PWA) per a la gestió del dia a dia d'un mestre de Primària:
alumnes, notes, observacions, assoliments, planning setmanal, calendari,
tasques, generador de grups, distribució de l'aula, post-its, horari i
generador de comentaris amb IA.

Està pensada perquè **cada mestre la faci servir pel seu compte**, amb el seu
propi full de càlcul, i es reparteixi a diversos mestres de l'escola.

---

## 2. ARQUITECTURA

### Frontend (aquest repositori)
- **HTML / CSS / JavaScript purs, SENSE frameworks.**
- Allotjat a **GitHub Pages** (estàtic, HTTPS).
- És una **PWA instal·lable** (manifest + service worker).

### Backend
- **Google Apps Script** (`Code.gs`) desplegat com a Web App (`/exec`).
- **Google Sheets** com a base de dades.
- Cada mestre té el SEU propi Apps Script i el SEU full personal.

### Els tres fulls de càlcul
1. **Full personal** de cada mestre (l'Apps Script hi va associat = `ss`,
   via `getActiveSpreadsheet`). Hi viuen: registres, planning, notes, tasques,
   calendari, assoliments, seients, post-its, horari, i el full ocult
   `_AppData` (magatzem clau-valor) i `_AppData_Planning`, `_AppData_Assim`,
   `_AppData_Actitud`.
2. **Full "Grups" compartit** (font única d'alumnes i observacions). S'obre
   amb `openById`. 18 pestanyes (1r A … 6è C).
3. **Full "Desdoblaments" compartit** (només consulta).

---

## 3. ESTRUCTURA DE FITXERS

```
vedruna-app/
├── index.html              # Estructura de totes les pàgines i modals
├── Code.gs                 # TOT el backend (Apps Script)
├── sw.js                   # Service worker (PWA, cache). Bump de versió a cada canvi!
├── manifest.webmanifest    # Manifest PWA (el que es fa servir)
├── manifest.json           # Manifest antic (es manté per compatibilitat)
├── manual.html             # Manual d'usuari (24 apartats)
├── README.md               # Instruccions bàsiques de desplegament
├── PROJECTE.md             # AQUEST document
├── css/
│   └── main.css            # TOTS els estils
├── js/
│   ├── rol.js              # 'tutor', 'especialista' o 'direccio'. NO SE SINCRONITZA mai!
│   ├── config.local.js     # NOMÉS el token. NO SE SUBSTITUEIX en actualitzar!
│   ├── personal.js         # El que és propi d'una mestra. Buit a la mare.
│   ├── app.js              # Nucli: navegació, home, alumnes, notes, planning,
│   │                       #   calendari, tasques, config, bootstrap, sync
│   ├── perfil.js           # Perfil del mestre (nom, tutoria, assignatures)
│   ├── notes.js            # Notes d'assignatures i actitud
│   ├── seients.js          # Distribució de l'aula (plànol + auto-assignació)
│   ├── grupview.js         # Vista de grup / desdoblaments
│   ├── docents.js          # Apartat Docents: portada + llistat del claustre (direcció)
│   ├── coordinacio.js      # Els esmorzars de la reunió de coordinació (direcció)
│   ├── regdocents.js       # Registres amb el claustre a les files (direcció)
│   ├── segentrevistes.js   # Seguiment de les entrevistes dels tutors (direcció)
│   ├── postits.js          # Notes i post-its
│   ├── horari.js           # Horari (plantilla setmanal → omple planning)
│   └── vedrunu.js          # Xatbot "Vedrunu" (IA)
└── img/                    # Icones, logo, favicons
```

---

## 3bis. LES TRES APPS: TUTORS, ESPECIALISTES I DIRECCIÓ

Hi ha **tres versions** amb **exactament el mateix codi**. L'única diferència és
`js/rol.js`:

```javascript
window.APP_ROL = 'tutor';        // app dels tutors (aquest repositori)
window.APP_ROL = 'especialista'; // app dels especialistes
window.APP_ROL = 'direccio';     // app de l'equip directiu
```

`sync-filla.js` té `js/rol.js` a `SEMPRE_PROPI`: mai no se sincronitza, o
l'app dels especialistes tornaria a ser la dels tutors a la primera
actualització. Les carpetes són `C:\Escorial\VedrunApp\VedrunApp-Especialistes` i
`C:\Escorial\VedrunApp\VedrunApp-Direccio`, i s'hi propaga tot amb
`node eines/sync-totes.js` (o `sync-filla.js` per a una de sola).

Totes les apps viuen dins de `C:\Escorial\VedrunApp\`, cadascuna a la seva
carpeta (`VedrunApp-Tutors` és la mare). L'esquema sencer és a `FILLES.md`,
apartat "On viuen les carpetes".

Totes dues són **plantilles locals**: no tenen repositori ni GitHub Pages
(decidit el 3 de setembre de 2026) i no cal que en tinguin, perquè
`nova-filla.js` en copia fitxers, no clona res. Qui es publica a Internet és
l'app de cada mestra, no aquestes.

**Com es comprova que cada rol fa el que ha de fer:**

```bash
node eines/comprova-rols.js                                       # els tres rols
node eines/comprova-rols.js --carpeta "C:/Escorial/VedrunApp/VedrunApp-Direccio"   # una carpeta tal com està
```

Carrega l'app sencera dins d'un navegador de mentida i li prem els botons.
Cal perquè en Pol només trepitja l'app dels tutors: els camins dels altres
dos rols no els prova ningú fins que ja són a mans d'una mestra.

**Què canvia quan `APP_ROL === 'especialista'`:**

| On | Què |
|---|---|
| Sota el logo | «Gestió de curs · Especialistes» (l'altra diu «· Tutors») |
| Perfil | No es tria tutoria. Es trien **grups** (`classes` queda `{"3r A":[…], "3r B":[…]}`) |
| Perfil | `_perfilMigrar` NO mou `classes` cap a `altres` si no hi ha tutoria |
| Menú | No hi ha «Alumnes» ni «Distribució de l'aula» (`PAGINES_NOMES_TUTOR`) |
| Observacions | Selector d'assignatura+grup a dalt; no hi ha l'opció «General» |
| Registres d'aula | Selector d'assignatura+grup; **una pestanya per assignatura i grup** |
| Fitxa | Només la de consulta (`grupview.js`), amb «Afegir observació» |

**Registres d'aula per assignatura+grup:** `_nomFullRegistre(clau)` al
`Code.gs`. Sense clau → `"Registres d'aula"` (els tutors, com sempre, cap
migració de dades); amb clau → `"Registres 3r A · Anglès"`. Les files es
desen per número, per això `getOrCreateRegistreSheet` reescriu la columna A
amb els alumnes que toquen. **Va per assignatura i no només per grup perquè
la llista d'alumnes depèn del desdoblament:** l'Anglès de 3r A pot ser mig
grup i la Música la classe sencera.

**Què canvia quan `APP_ROL === 'direccio'`:**

Direcció fa classe però **no tutoritza cap grup**, i ha de poder entrar a
qualsevol grup de primària per posar-hi les dades que el seu tutor no hi posa
(correus, PI, AM, observacions) i per veure què hi va escrivint la resta.

| On | Què |
|---|---|
| Sota el logo | «Gestió de curs · Direcció» |
| Perfil | Igual que una especialista: es trien **grups**, no tutoria (`_perfilSenseTutoria()`) |
| Menú | **No s'amaga res.** Hi ha Alumnes i Distribució de l'aula, com un tutor |
| Alumnes | Selector curs+línia amb els 18 grups (`_dirCarregaGrup`), i la fitxa és la **completa**, editable |
| Observacions | Les del grup triat, amb l'opció «General» (és el que fa el tutor) |
| Registres d'aula | Una pestanya per grup: `"Registres 4t B"` |
| Distribució de l'aula | **Un plànol per grup** (`seients_layout__4t B`) |
| Compartir notes | Hi surt sempre la casella: no són tutors de res (`grupTutoria()` → `null`) |
| **Docents** | Apartat de més al menú (`PAGINES_NOMES_DIRECCIO`), amb el claustre de primària |

**L'apartat «Docents»** (`js/docents.js`) és una **portada amb eines**
(`DOCENTS_EINES`), no una llista. Cada eina és un contenidor dins de
`page-docents` i `docentsVista(clau)` les intercanvia; la vista va a l'estat
de l'historial, o sigui que el gest d'enrere del mòbil torna a la portada i no
fa fora de l'apartat. Per afegir-ne una de nova: una entrada a `DOCENTS_EINES`
i el seu `<div>` a l'`index.html`.

Eines que hi ha:

- **Llistat de docents** — el claustre: qui tutoritza cada
grup, les especialistes de cada cicle, qui coordina cada cicle, l'equip
directiu i l'equip SIEI. La llista (`DOCENTS`) **viu al codi a posta**: és la
mateixa per a tota l'escola i canvia un cop l'any, com el calendari escolar.
Així no cal ni backend ni redesplegar el `Code.gs`; s'actualitza aquí i arriba
amb `sync-totes.js`. Les consultes (`docentDelGrup`, `cicleDelGrup`,
`coordinadorDelCicle`…) són públiques a posta, perquè les eines que vinguin no
hagin de tornar a escriure la llista.

- **Coordinació** (`js/coordinacio.js`) — els esmorzars de la reunió setmanal
de l'equip de coordinació: qui li tocava, si l'ha portat, quina nota mereix i
què va portar. Al costat, les mitjanes, el comptador i els **gomets vermells**
de qui se n'oblida; als 3, un popup de **penyora**. És una broma de l'equip,
però **les dades van al full "Grups" COMPARTIT** (`loadEsmorzars` /
`saveEsmorzars` al `Code.gs`, clau `coord_esmorzars`), no al full personal: si
anessin al personal, els dos directors tindrien cada un la seva llista i no
coincidirien mai. L'equip (`coordEquip()`) surt sol de `DOCENTS`: qui coordina
un cicle i qui és de l'equip directiu. **El gràfic ÉS la taula** — la barra viu
dins de la cel·la de la mitjana, així qui la mira de lluny veu qui guanya i qui
la llegeix amb un lector de pantalla té els números igual.

  **El torn i el correu del dilluns.** `esmProperTorn()` diu a qui li toca: al
  que n'ha fet menys, i si empaten, al que fa més que no li toca; alfabètic
  per desempatar. **És determinista a posta**: amb les mateixes dades sempre
  diu el mateix, que és el que evita la discussió. En apuntar el torn s'hi
  desa el dia de la reunió, i el **dilluns d'aquella setmana** un **disparador
  diari** de l'Apps Script (`recordatoriEsmorzars`, instal·lat un cop amb
  `configuraRecordatoriEsmorzars()`) li envia el correu i marca `avisat`
  perquè no n'hi arribin dos. Si el dilluns falla, hi torna cada dia fins al
  dia de la reunió.

  ⚠ El disparador s'executa **sense navegador**: no pot llegir `js/docents.js`.
  Per això l'app, cada cop que desa, hi deixa també l'**equip amb els correus**
  dins de la mateixa clau del full compartit.

  ⚠ Això demana **dos permisos nous** a l'`appsscript.json`
  (`script.send_mail` i `script.scriptapp`) i, per tant, **tornar a autoritzar
  i desplegar una versió nova**. Els correus són a `DOCENTS` (camp `email`),
  només per a qui és de coordinació o de direcció; sense correu, l'eina ho diu
  i no envia res.

- **Registres** (`js/regdocents.js`) — el registre d'aula amb el claustre a
les files: ítems de casella o de text, per portar el que calgui per mestre.
Reaprofita el **mateix modal** d'ítem nou (`openNewItemModal('docents')` +
`newItemCrear()`), i les dades van al full compartit (`loadRegistreDocents` /
`saveRegistreDocents`, clau `coord_registre_docents`). **Les cel·les es desen
pel NOM del docent, no pel número de fila**, al contrari del registre d'aula:
així, el dia que la llista del claustre canviï, el que hi ha apuntat no es
desplaça a la persona equivocada.

- **Seguiment d'entrevistes** (`js/segentrevistes.js`) — de cada tutor,
quantes entrevistes ha fet amb les famílies i quan, i quins alumnes no en
tenen cap. Tot ve d'**una sola crida**
(`resumEntrevistes` al `Code.gs`): els 18 resums publicats es llegeixen d'una
sola lectura de `_AppData`, i només les llistes d'alumnes van pestanya a
pestanya. Fer-ho des del navegador serien 36 crides.

  ⚠ **Què hi arriba i què no.** Cada tutor desa el detall de les entrevistes
  (inclòs el que ha escrit de com va anar) al SEU full, i això no surt mai
  d'allà. `_entrPublica_` publica al compartit **només** `quantes`, `ultima`
  i `dates`. **Les dates s'hi van afegir a la v135**: els resums publicats
  abans només tenen el compte i l'última, i la pantalla ho diu en comptes
  d'ensenyar un buit. Es posa al dia sol, perquè `_entrPublica_` recalcula
  el grup sencer cada cop que el tutor desa qualsevol entrevista.

⚠ **EL QUE VA AL FULL "GRUPS" COMPARTIT EL POT LLEGIR QUALSEVOL MESTRE** que
obri aquell full de càlcul (és al full ocult `_AppData`, però no és cap
secret). Hi és perquè cada director té la seva app i el seu full personal, i
és l'única manera que tots dos hi vegin el mateix (decidit el 3 de setembre
de 2026). Afecta els esmorzars i el registre de docents. Si algun dia hi ha
d'anar res delicat, cal un **full de direcció a part**: un `DIREC_ID` nou a
les Script Properties, compartit només amb ells dos, i canviar
`getGrupsSpreadsheet` per aquell a les accions de coordinació.

L'apartat es tanca per **dues bandes**: el botó del menú neix amagat a
l'`index.html` i només `_rolAplicaInterficie()` l'ensenya a direcció, i
`showPage()` torna a Inici si algú hi arriba per l'adreça (`#docents`) amb un
altre rol.

**El grup de treball** és `_grupDeTreball()` (a `js/perfil.js`): la tutoria per
a un tutor, i `_direccioGrup` per a direcció. Tot el que penja del grup hi
passa —`_loadTutoriaGrup`, `_restoreTutoriaStudents`, `_registreGrup()`,
`_seientsLS()`— així no hi pot haver mitja pantalla parlant d'un grup i mitja
d'un altre. **`grupActual()` i `grupTutoria()` no són el mateix:** el primer
és el grup que es veu, el segon el grup del qual ets tutor (a direcció, cap).

⚠ `js/rol.js` no se sincronitza mai, o sigui que a les apps ja repartides
aquell fitxer és el vell i `esDireccio()` **no hi existeix**. Per això
sempre es pregunta amb `typeof esDireccio === 'function' && esDireccio()`
(embolicat a `_rolDireccio()` i `_perfilSenseTutoria()`).

**El nom de l'assignatura i els desdoblaments:** el full de desdoblaments
busca `"Anglès"`, no `"angles"` (clau del menú) ni `"Anglès · 3r A"`
(etiqueta dels selectors). Cada pantalla hi arribava amb una clau diferent i
el desdoblament no s'aplicava. Ara hi ha `_assigNomNet(clau)` a
`js/perfil.js` i **tothom hi passa**: `_refreshGrupStudents`,
`_carregaAlumnesGrupNet` i el «Veure alumnes» de `grupview.js`.

---

## 3ter. LES CONVERSES DE TREBALL (on es fa cada canvi)

En Pol té **quatre converses obertes de Claude Code**, i **totes quatre
treballen dins la carpeta mare** (`VedrunApp-Tutors`). No n'hi ha cap dins de
`VedrunApp-Especialistes` ni de `VedrunApp-Direccio`, i no n'hi ha d'haver.

| Conversa | Què hi demana | Com s'escriu el canvi |
|---|---|---|
| **VedrunApp · Tutors** | canvis que només veuen els tutors | fora dels interruptors de rol |
| **VedrunApp · Especialistes** | canvis que només veuen les especialistes | dins d'`esEspecialista()` |
| **VedrunApp · Direcció** | canvis que només veu l'equip directiu | dins d'`esDireccio()` |
| **Canvis generals** | el que ha d'arribar a tothom | sense cap interruptor |

**El que decideix a quina app arriba un canvi NO és la carpeta on es treballa:
és l'interruptor de rol.** Totes les apps porten exactament el mateix codi;
cadascuna ensenya només la part que li toca segons el seu `js/rol.js`.
`esEspecialista()` i `esDireccio()` són a `js/rol.js`.

**Però el fitxer viatja sempre a totes.** Les tres apps porten el mateix
`js/app.js`: l'interruptor decideix **qui ho veu**, no on va el fitxer. Per
tant **qualsevol canvi a la mare s'ha de sincronitzar**, encara que només el
vegin els tutors; si no, les altres dues es queden amb codi vell.

`estat-apps.js` **compara els fitxers un per un**, no només el número de
versió. Per això detecta també els canvis que no la pugen (documentació,
`Code.gs`): diu «LI FALTEN FITXERS» i quins són. Quan diu «Tot al dia», el
sync no té res a copiar. Fins al setembre del 2026 només mirava la versió i
deia «Tot al dia» amb les filles endarrerides.

Per això les converses comparteixen carpeta: la mare és **l'únic lloc des d'on
un canvi arriba a l'app d'aquell rol**. Un canvi fet dins de
`VedrunApp-Direccio` el **esborra la següent sincronització**, sense avisar i
sense deixar rastre (`sync-totes.js` hi reescriu tot el que no és `propi`).

Les dues carpetes de plantilla són **el resultat, no el taller**: es refan
soles i només serveixen perquè `nova-filla.js` en tregui l'app d'una
especialista o d'un director concrets.

**L'excepció són les mestres.** El dia que existeixi `VedrunApp-Anna`, aquella
app sí que té carpeta pròpia i conversa pròpia, perquè hi ha coses que són
seves i només seves (`js/personal.js`). Ho explica `FILLES.md`, apartat
"Regla per a les converses per mestra". Però fins i tot allà, **un bug general
es continua arreglant a la mare** i s'hi propaga amb el sync.

**Compte amb dues converses obertes alhora.** Com que totes treballen a la
mateixa carpeta, dues que editin a la vegada es poden trepitjar els fitxers i
barrejar-se els commits. Val més fer-les anar d'una en una, i mirar
`git status` en començar per veure si algú altre ha deixat res a mig fer.


## 4. REGLES ABSOLUTES (no s'han de trencar mai)

1. **Tot es guarda SEMPRE al Google Sheets** i es carrega des d'allà. Res es
   guarda només en localStorage (només s'usa com a cache temporal per anar
   ràpid). Les dades han de ser visibles des de qualsevol dispositiu.

2. **Els mestres que fan classe en un grup del qual NO són tutors s'anomenen
   sempre "especialistes"**, MAI "no-tutors".

3. **Tota la interfície i les converses són en CATALÀ.**

4. **CAP credencial al codi.** Ni al frontend (públic a GitHub) ni escrita al
   `Code.gs` que circula. Les credencials viuen a les **Script Properties**
   del Apps Script (veure secció 6).

5. **`js/config.local.js` NO se substitueix mai** en actualitzar. Conté el
   token del dispositiu.

6. **El logo de l'escola és una marca real:** no es pot modificar, redibuixar
   ni aproximar. S'ha d'usar el fitxer exacte.

---

## 5. IDENTITAT VISUAL

- Color principal granat: `--garnet-deep:#4A1520`, `--crimson:#C01E4B`,
  `--garnet-text:#7A1E2E`, `--garnet-mid:#A63050`.
- Capçaleres: `#FBEAED`, `#F5D0D6`. Font: Inter (Google Fonts).
- **Icona de l'app:** graella d'aula 3×3 amb el logo real de l'escola a la
  casella central (fons rosa clar), sobre fons granat. Fitxers a `img/`.

---

## 6. CREDENCIALS I SEGURETAT

### Script Properties (al Apps Script, privat)
El `Code.gs` llegeix les credencials de `PropertiesService.getScriptProperties()`.
Es posen UN COP i es mantenen entre actualitzacions del codi. Claus:
- `GRUPS_ID` — ID del full de grups compartit
- `DESDOB_ID` — ID del full de desdoblaments compartit
- `GEMINI_KEY` — clau de l'API de Gemini (compartida)
- `APP_TOKEN` — token de seguretat

Per posar-les: executar la funció `configuraCredencials()` un cop des de
l'editor d'Apps Script, o afegir-les manualment a Configuració del projecte →
Propietats del script.

### Token de seguretat
- Al backend: `_appToken()` llegeix `APP_TOKEN` de les propietats. `handleRequest`
  rebutja qualsevol crida sense el token correcte ("No autoritzat").
- Al frontend: `window.APP_TOKEN` a `js/config.local.js`. S'envia a cada crida.
- Els dos han de coincidir. El token NO és una credencial de Google (és una
  cadena inventada), per això és acceptable tenir-lo al frontend; GitHub no el
  bloqueja.

### Gemini
- La clau viu al backend. Les crides passen pel backend (acció `gemini`), així
  la clau no arriba mai al navegador ni al codi públic.
- Fallback de models: `gemini-flash-latest` → `gemini-2.5-flash` → `gemini-2.5-flash-lite`.
- IMPORTANT: la clau de Gemini s'ha de crear amb un compte **Gmail personal**;
  el free tier no funciona amb comptes de Google Workspace de l'escola.

### Permisos (oauthScopes) i escriptura al Calendar/Tasks

Llegir tasques només concedeix `tasks.readonly`. Per **escriure-hi** cal el
permís sencer, i Apps Script no el demana sol: falla amb *"You do not have
permission to call tasks.tasks.insert"*.

Solució: declarar els permisos explícitament al manifest. A l'editor →
**Configuració del projecte** → marcar *"Mostra el fitxer appsscript.json"*, i
afegir-hi (SENSE esborrar la resta del fitxer):

```json
"oauthScopes": [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/script.external_request",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/tasks",
  "https://www.googleapis.com/auth/script.send_mail",
  "https://www.googleapis.com/auth/script.scriptapp"
]
```

Aquests 6 són tots els que fa servir el `Code.gs`:
`SpreadsheetApp` → spreadsheets · `UrlFetchApp` (Gemini) → script.external_request ·
`CalendarApp` + servei avançat `Calendar` → calendar · servei avançat `Tasks` → tasks ·
`MailApp` (el recordatori dels esmorzars) → script.send_mail ·
`ScriptApp` (el disparador diari d aquell recordatori) → script.scriptapp.

Els **dos últims només els fa servir l app de direcció**, però hi han de ser a
tothom: el manifest és el mateix per a totes, i si en falta cap l app peta.
Mentre ningú no executi `configuraRecordatoriEsmorzars()`, no fan res.

⚠️ Declarar-los a mà **substitueix** la llista que Apps Script dedueix sol: si
se'n falta cap, l'app peta. Després cal tornar a autoritzar (executant
`provaEscripturaGoogle` des de l'editor) i **desplegar una versió nova**.

### Desplegament de l'Apps Script
- **Executar com: JO (el propietari) + Accés: qualsevol.**
- Això vol dir que l'app funciona amb el compte del propietari
  independentment del correu actiu al dispositiu del mestre. Única fricció:
  obrir els fulls directament amb un correu sense permís.

---

## 7. FLUX PER DONAR D'ALTA UN MESTRE NOU

Guió complet pas a pas: **`INSTALLACIO.md`** (uns 10 minuts per mestra).

**Primer de tot, la seva app** (una ordre; veure `FILLES.md`):

```bash
node eines/nova-filla.js "<Mestra>" --especialista   # si és especialista
node eines/nova-filla.js "<Mestra>" --direccio       # si és de l equip directiu
node eines/nova-filla.js "<Mestra>"                  # si és tutora
```

Una **especialista** surt SEMPRE de `VedrunApp-Especialistes`, i una de
**direcció** de `VedrunApp-Direccio`, no de la mare (veure secció 3bis).
Mai copiar una carpeta a mà: tindria el rol equivocat.

En resum, la resta:

0. (un cop) Deixar un full de PLANTILLA net amb **`buidaLesDades()`**, per
   copiar-lo a cada mestra.
1. Full de càlcul nou al seu Drive → **Extensions → Apps Script**.
2. Enganxar-hi **`Code.gs`** i també **`appsscript.json`**
   (roda dentada → "Mostra el fitxer de manifest"). El manifest ja porta els
   serveis avançats Calendar/Tasks i els 4 permisos: **no cal afegir serveis
   ni editar scopes a mà** (era la font del problema dels permisos de Tasks).
3. Omplir els 4 valors de dalt de **`configuraTot()`** i executar-la. Ho fa
   tot sol: credencials a les Script Properties, pestanyes (`Alumnes`,
   `Registres d'aula`, `_AppData*`), protecció dels fulls, amplada de
   columnes, comprovació de l'accés al full Grups compartit i **prova real
   d'escriptura al Calendar i a Tasks**. Al final diu què queda per fer.
   Es pot re-executar sense por: un valor deixat en blanc no esborra el que
   ja hi hagi.
4. **Implementa → Nova implementació → Aplicació web**
   (Executar com: **Jo** · Accés: **Qualsevol**) i copiar la URL `/exec`.
5. A la seva app: **Configuració → Connectar** amb aquell `/exec`.
6. Amb ella al costat: **perfil** i **horari**. Al perfil, una tutora hi
   posa el grup que tutoritza i les assignatures; una **especialista**, els
   grups on fa classe i què hi fa a cada un.
7. El que sigui **només seu** va a `js/personal.js` de la seva carpeta (es
   carrega l'últim i la sincronització no el toca mai). Mai tocar `app.js`,
   `perfil.js` ni `notes.js` dins de la seva app.

Els IDs dels fulls compartits, la clau Gemini i el token van a les Script
Properties, no a la interfície. Els 3 primers són **els mateixos per a totes**;
si el token també ho és, no cal tocar `js/config.local.js` de cap filla.

La resta (objectius d'avaluació, aspectes d'actitud, estil de comentaris,
enllaços personals) ja s'ho configura cada mestra des de l'app quan vulgui.

---

## 8. WORKFLOW DE DESENVOLUPAMENT

### Aplicar canvis
- **Frontend (HTML/CSS/JS):** pujar a GitHub + `Ctrl+Shift+R` al navegador.
  Recordar **bump de la versió del cache** a `sw.js` (`const CACHE = 'vedruna-vNN'`)
  a cada canvi de frontend, o el service worker servirà la versió antiga.
- **Backend (`Code.gs`):** enganxar al Apps Script i **desplegar una NOVA
  versió** (Implementa → Gestiona implementacions → editar → Versió: Nova
  versió, mantenint la mateixa URL `/exec`).
- **`js/config.local.js`:** NO substituir mai (manté el token).

### Pujar una versió nova (IMPORTANT)

Tres fitxers han d'anar **sempre junts**, o l'avís de versió nova mentirà:

| Fitxer | Què s'hi canvia |
|---|---|
| `sw.js` | `const CACHE = 'vedruna-vNN'` |
| `js/versio.js` | `var VERSIO_APP = 'vNN'` |
| `versio.json` | `"versio": "vNN"` + la llista de `canvis` en llenguatge de mestre |

Com funciona: `versio.js` porta a dins la versió amb què s'ha servit i demana
`versio.json` a la xarxa (el `sw.js` el deixa passar SENSE guardar-lo). Si no
coincideixen, el navegador serveix codi antic i surt l'avís amb els canvis i un
botó que esborra la còpia guardada i recarrega. **Les dades del mestre no es
toquen**: només s'esborra la còpia del codi.

Els `canvis` els llegeixen mestres: escriu què noten ells, no què s'ha tocat.

### Validació abans de donar per bo un canvi
- `node --check` de cada fitxer JS.
- Validar `Code.gs` amb `new Function(mock + codi)` (mocks de SpreadsheetApp,
  PropertiesService, etc.).
- Simulació amb mock-browser en Node (localStorage, document, window, fetch…),
  carregant `config.local.js` primer.
- Validar l'HTML (parser que comprova tags ben tancats; VOID inclou `image`,
  `stop` per SVG).

---

## 9. MODEL DE DADES (resum)

### `_AppData` (full ocult, clau-valor)
Claus: `profile`, `postits`, `horari`, `horari_assigs`, `tasques`, `cal_cats`,
`cal_events_YYYY`, `grups_sheet_id`, `desdob_sheet_id`, observacions de grup
(`obs_<grup>`), etc.

### Full "Grups" — capçaleres (14 columnes A-N)
`Nom, Cognom, Data naixement, Nom mare, Nom pare, Email mare, Email pare,
Observació important, Gènere (F/M), PI, AM, Aspectes específics, Informe EAP
(JSON), Condicions seient (JSON)`.

### Perfil (`_perfil`)
`{ nom, cognom, tutorCurs, tutorLinia, classes: { "2n C": [assignatures...] } }`.
- Clau del grup de tutoria: `_perfilTutorGrupKey()`.
- Al selector d'assignatures, l'etiqueta del grup NOMÉS es mostra per als
  grups on el mestre és especialista (no per al seu grup de tutoria).

### Planning
- Cel·la: clau `plan_{YYYY}_{S##}_{dia}_{franja}`.
- Franges: `PLAN_FRANGES` (f1–f8; f3 i f6 són patis). Dies: `PLAN_DIES` (dl–dv).
- Curs: 8 set 2026 → 18 juny 2027.

### Horari (plantilla)
- `_horari = { "dia_franja": "Matèria" }`. El pati (f3) pot ser un objecte
  `{ zona, rols:[] }` per a la zona de vigilància i els encàrrecs.
- En aplicar-lo, omple el planning de totes les setmanes SENSE trepitjar el
  que ja s'hagi escrit (només posa la matèria on la cel·la és normal i buida).

---

## 10. RENDIMENT (decisions preses)

- El `bootstrap` llegeix `_AppData` UNA sola vegada i busca les claus en
  memòria (no rellegeix el full a cada `sheetGetJSON`).
- El service worker serveix els assets des del cache directament (sense fetch
  de fons per asset); es refresquen en pujar versió del cache.
- `preconnect` als dominis de Google Fonts i Apps Script.
- Les mutacions es fan amb `debounce` i s'agrupen; mai crides de xarxa dins de
  bucles.
- Tot l'output d'usuari passa per `escapeHtml` (evita trencaments i XSS).

---

## 11. ESTAT ACTUAL I IDEES OBERTES

- **Fet i estable:** tot el nucli (alumnes, notes, observacions, assoliments,
  planning, calendari, tasques), generador de grups (hetero/homo per
  assignatura), distribució de l'aula amb condicions i incompatibilitats,
  post-its, horari (editor + importació + aplicar al planning, amb zones i
  encàrrecs de pati), PWA instal·lable, navegació enrere al mòbil, seguretat
  amb token i Script Properties, missatges d'error clars, auditoria de
  rendiment feta.
- **Pendent de decidir:** la designació de les línies de classe (A/B/C) es
  confirmarà i s'actualitzarà a la configuració quan se sàpiga.
- **Nota:** existeix una app germana SEPARADA, "Coordinació 2n", a
  `https://poldpm.github.io/coordinaci-_2nPrim/` (tres tutors, tricolor). NO
  és aquest projecte.

---

## 12. CONSELLS TÈCNICS APRESOS

- Gmail amb accents no és fiable a les cerces: usar cadenes truncades
  (`direcci`, `prim`).
- Els adjunts de nòmines de Clickedu arriben com `application/octet-stream`:
  filtrar per extensió `.pdf`, no per MIME type.
- L'entorn de Google Workspace de l'escola bloqueja webhooks externs (ntfy.sh)
  però permet crides a l'API de Telegram.
- Els noms de label de Gmail amb espais usen guions a les cerces.

---

## 13. MESURAR EL BACKEND

`Code.gs` no es pot provar sense un full de càlcul… o sí:

```bash
node eines/banc-backend.js
```

El carrega dins d'un `SpreadsheetApp` de mentida i **compta cada crida que de
debò viatjaria a Google**. Cada una són desenes de mil·lisegons reals: si un
canvi puja el total, l'app anirà més lenta per a la mestra.

Per comparar abans i després d'un canvi:

```bash
git show HEAD:Code.gs > /tmp/abans.gs
node eines/banc-backend.js /tmp/abans.gs    # com estava
node eines/banc-backend.js                  # com ha quedat
```

**Setembre del 2026**, l'arrencada d'un tutor va passar de **151 crides a 38**:

| Què passava | Arranjament |
|---|---|
| Es calculaven les observacions de les 21 pestanyes i el navegador **les llençava** si el tutor tenia les compartides del full "Grups" | només es calculen si de debò calen |
| El full `_AppData_Planning` es llegia **sencer 3 vegades**, una per setmana | es llegeix un cop i les setmanes es busquen en memòria |
| `getGrupsSpreadsheet()` **rellegia tot el `_AppData`** que el bootstrap acabava de llegir | s'obre amb l'ID que ja teníem |
| `getObservacions()` demanava les 21 pestanyes d'una en una | un sol `getSheets()` i la resta en memòria |

**Segona tanda**, les accions on la mestra s'espera mirant la pantalla:

| Què passava | Abans | Ara |
|---|---|---|
| `syncAssoliments()` pintava la graella casella per casella | 7.250 escriptures | **105** |
| `updateActitudBatch()` rellegia la capçalera sencera a cada alumne | 128 lectures | **56** |

Comprovat amb un full de mentida que registra cada cel·la: als assoliments,
1.100 de 1.350 cel·les idèntiques i 250 que només passen de «no s'hi deia
res» a dir-hi `normal` (que ja era el valor per defecte, i el full es refà de
zero a cada sincronització). A l'actitud, **les 181 cel·les idèntiques**,
mitjanes i notes incloses.

`recalcMitjana()` accepta ara un tercer paràmetre opcional amb la capçalera
ja llegida, per a qui en recalcula molts seguits del mateix full. Sense
passar-l'hi, es comporta exactament com abans.

Queda per mirar: les 750 escriptures de `updateActitudBatch()`. Es podrien
agrupar, però obliga a reescriure `recalcMitjana()`, que és el càlcul de les
notes i el criden de tres llocs: val més fer-ho a part i amb calma.

**No toquis els `flush()` de les reunions**: hi són a posta, per
l'anti-solapament. I `propagaCarpeta()` sembla cara però el seu bucle només
fa 3 voltes (les assignatures amb carpeta): no val la pena.
