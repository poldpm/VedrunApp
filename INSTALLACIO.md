# Donar d'alta una mestra

Guió per fer-ho al seu ordinador amb la mínima feina possible.
**Temps: uns 10 minuts.** La major part és esperar pantalles de Google.

Abans de començar, tingues a mà (són **els mateixos per a totes**, copia'ls un cop):

```
GRUPS_ID   = ...
DESDOB_ID  = ...
GEMINI_KEY = ...
APP_TOKEN  = ...
```

> Guarda aquest bloc en un lloc teu (no al repositori: és públic).
> **El token pot ser el mateix per a totes** — així no l'has de canviar mai
> a `js/config.local.js`.

---

## El full de plantilla

Tingues UN full net del qual cada mestra en faci una còpia. Perquè quedi
net, obre-hi l'Apps Script i executa **`buidaLesDades()`**: treu les dades
de proves i deixa l'estructura a punt.

Diu al registre exactament què ha buidat, i **no toca**: el full **Grups**
ni el de **Desdoblaments** (són documents a part), ni les credencials, ni
el Google Calendar, ni el Google Tasks.

> ⚠ No es pot desfer. Fes-ho només al full que vols de plantilla; si has de
> conservar-hi res, **Fitxer → Fes-ne una còpia** abans.

---

## El full ha de ser SEU, i ha de desplegar ella

**No preparis el seu backend al teu Drive per estalviar-te temps.** És
temptador (el pots fer a casa amb calma), però el web app es desplega amb
`executeAs: USER_DEPLOYING`: **s'executa sempre com qui el desplega**.

Si el desplegues tu:

- Els events i les tasques que ella creï anirien **al TEU Google Calendar
  i al TEU Google Tasks** (el codi escriu a `'primary'` i `'@default'`,
  que són els de qui executa).
- Pitjor encara: la seva app li ensenyaria **el teu calendari i les teves
  tasques**, perquè els llegeix amb `CalendarApp.getAllCalendars()` i
  `Tasks.Tasklists.list()`.
- I les dades dels seus alumnes viurien al teu Drive: el dia que plegues o
  et tanquen el compte, ella es queda sense res.

**El que sí que pots fer a casa** (i és gairebé tota la feina):

1. Compartir-li el full **Grups** i el de **Desdoblaments** amb el seu
   compte. Això s'ha de fer sí o sí: el seu script hi entrarà com ella.
2. Tenir a punt un **full de plantilla** al teu Drive amb el `Code.gs` i
   l'`appsscript.json` ja enganxats i els 4 valors de `configuraTot()`
   omplerts.
3. Crear-li la carpeta de l'app, el repositori i el GitHub Pages
   (`node eines/nova-filla.js "Anna"`).

**El que ha de fer ella, amb tu al costat** (uns 3 minuts):

1. Des del SEU compte: obrir la teva plantilla i **Fitxer → Fes-ne una
   còpia**, al seu Drive. La còpia s'endú l'Apps Script.
   > Les *Script Properties* NO es copien, i és bo: per això l'ha
   > d'executar ella.
2. **Executar `configuraTot`** i **acceptar l'autorització** (surt amb el
   seu compte: és el que fa que el Calendar i el Tasks siguin els seus).
3. **Implementa → Nova implementació → Aplicació web** i copiar el `/exec`.

A partir d'aquí ja pots continuar tu: enganxar-li el `/exec` a l'app,
posar-li la clau de Gemini i omplir el perfil i l'horari.

> Comprova el primer cop que copiar el full s'endú l'Apps Script. Si en
> alguna còpia no hi fos, és enganxar-hi el `Code.gs` i
> l'`appsscript.json` a mà: 30 segons.

---

## A · El full de càlcul i el backend  (5 min)

1. **Crea un full de càlcul** nou al seu Drive. Anomena'l `Registres — <Mestra>`.

2. **Extensions → Apps Script.**

3. **Enganxa el `Code.gs`** (substitueix tot el que hi hagi).

4. **Enganxa l'`appsscript.json`:**
   - Roda dentada (**Configuració del projecte**) → marca
     *"Mostra el fitxer de manifest appsscript.json a l'editor"*
   - Obre `appsscript.json` i enganxa-hi el d'aquest repositori

   > Això ja hi posa **els serveis avançats (Calendar i Tasks) i tots els
   > permisos**. No cal afegir serveis a mà ni tocar res més.

5. **Omple els 4 valors** a dalt de `configuraTot()` (dins del `Code.gs`).

6. **Executa `configuraTot`** (tria-la al desplegable de dalt → Executar).
   - Et demanarà **autorització**: accepta-la.
   - Al registre veuràs què ha fet i què falta.

   Deixa fetes, soles: credencials, pestanyes (`Alumnes`,
   `Registres d'aula`, `_AppData`…), protecció dels fulls, amplada de
   columnes, i **comprova que pot escriure al Calendar i a Tasks**.

7. **Implementa → Nova implementació → Aplicació web**
   - Executar com: **Jo**
   - Qui hi té accés: **Qualsevol**
   - **Copia la URL** que acaba en `/exec`

---

## B · L'app  (3 min)

8. **Crea la seva app** amb una ordre, des de la carpeta de la mare:

   ```bash
   node eines/nova-filla.js "<Mestra>" --especialista --prova
   node eines/nova-filla.js "<Mestra>" --especialista
   ```

   Amb `--direccio` si és de l'**equip directiu**, i sense res si és
   **tutora**. L'eina la munta a partir de l'app que li toca (la dels
   especialistes, la de direcció o la mare), l'apunta a `filles.json` i
   comprova que el rol hagi quedat bé.

   **Només si és de direcció:** a més, executa un cop
   `configuraRecordatoriEsmorzars()` des de l'editor de l'Apps Script. És el
   que fa que el recordatori de l'esmorzar surti sol cada dilluns. Sense
   això, tota la resta de Coordinació funciona igual, però l'avís s'ha
   d'enviar a mà. `configuraTot()` t'ho recorda si falta.

   **I, també només a direcció:** `configuraSincronitzacioLlistes()`, que és
   el que porta les llistes d'alumnes de l'escola al full «Grups» cada quart
   d'hora. ⚠ **Només en UNA app de tota l'escola.** «Grups» és un sol full
   compartit i el `LockService` és per script: si dues instal·lacions el
   sincronitzessin, s'hi escriurien a sobre sense adonar-se'n. El codi es
   reparteix a totes, però només treballa on hi ha la propietat
   `SYNC_LLISTES = si`, que és la que hi posa aquesta funció. Per apagar-la,
   `treuSincronitzacioLlistes()`; per mirar com va sense esperar,
   `provaSincronitzacio()`. `configuraTot()` també ho comprova.

   Si fas servir el mateix `APP_TOKEN` per a totes, **no has de tocar
   `js/config.local.js`**.

   Després: **repositori i GitHub Pages propis** per a la seva carpeta.

9. **Obre la seva URL** al seu navegador → **Configuració** → enganxa el `/exec`
   → **Connectar**.

10. **Instal·la-la** com a app (icona d'instal·lar de la barra del navegador) i
    deixa-la-hi a l'escriptori o a la barra de tasques.


## ⚠ El clasp no serveix: l API està tancada

L'administrador de l'escola no obre l'**API d'Apps Script**, i és una política
del domini: val per a totes les mestres, no només per a en Pol. `clasp` queda
descartat. El que hi ha és la **biblioteca**, aquí sota.

---

## La biblioteca: enganxar el codi una vegada a la vida

L'API d'Apps Script està **tancada per l'administrador de l'escola**, o sigui
que el codi no es pot pujar sol. La sortida és una **biblioteca compartida**:
el projecte de cada mestra passa a ser un **pont de 4 KB** que s'enganxa
**una vegada** i no es torna a tocar mai.

Comprovat en una còpia de proves el 4/9/2026: **un canvi a la biblioteca
arriba a l'app de la mestra sense enganxar res i sense desplegar res.**

### Un cop per a tota l'escola: la biblioteca

1. Un full de càlcul nou («Vedruna — Biblioteca») → **Extensions → Apps Script**.
2. Enganxa-hi `biblioteca/Codi.gs` i l'`appsscript.json`. Desa.
3. **Configuració del projecte** → copia **l'ID de l'script**.
4. Comparteix el projecte amb **permís d'edició** per a totes les mestres.
   Cal per a la referència en mode HEAD; sense edició, cada mestra hauria de
   canviar el número de versió a mà a cada arranjament.

### Un cop per mestra: el pont

1. Al seu Apps Script: esborra-ho tot i enganxa-hi `pont/Code.gs` i
   l'`appsscript.json`.
2. **Omple les quatre credencials** de dalt del pont (`GRUPS_ID`,
   `DESDOB_ID`, `GEMINI_KEY`, `APP_TOKEN`).
3. **Biblioteques → +** → l'ID de la biblioteca → versió **HEAD
   (desenvolupament)** → identificador **`Vedruna`**.
4. `configuraTot()` i acceptar l'autorització.
5. **Implementa → Nova implementació → Aplicació web** (executar com: jo ·
   qualsevol) i copiar la `/exec`.

I ja està per sempre.

### Passar a la biblioteca una app que JA funciona

No cal tornar a instal·lar res: es canvia el codi de dins del **mateix**
projecte de sempre. Les credencials, els disparadors i el full no es toquen.

1. **Guarda't el `Code.gs` que hi ha ara** en un fitxer a part. És la marxa
   enrere: si res no va, l'enganxes i tornes on eres.
2. Al seu Apps Script: **esborra-ho tot** i enganxa-hi `pont/Code.gs`. Les
   quatre credencials, **deixa-les buides**: ja són a les Script Properties
   i `configuraTot()` no les toca (diu «ja hi eren»).
3. **Biblioteques → +** → l'ID → **HEAD (desenvolupament)** → `Vedruna`. Desa.
4. **Implementa → Gestiona implementacions → el llapis → Nova versió.**
   ⚠ **Actualitza la que ja hi ha, no en facis una de nova**, o la `/exec`
   canviaria i li hauries de tornar a enganxar a l'app.

⚠ **L'ordre importa: la biblioteca ABANS de desplegar.** La implementació es
queda una foto del projecte, i la referència a la biblioteca hi va a dins. Si
desplegues primer, l'editor t'anirà bé (hi treballa amb el codi d'ara) però
**l'app del navegador dirà que no es connecta**. Si t'ha passat, només és
tornar a fer el pas 4.

**Comprovació** — l'editor i el navegador són dos camins diferents, mira'ls tots dos:

| On | Què | Ha de dir |
|---|---|---|
| Editor | `provaSincronitzacio()` | `Permis: si` i `Disparadors posats: 1` **només a l'app de direcció**; a la resta, `(no posat)` i `0` |
| Editor | `veureAlies()` | la versió del codi |
| Navegador | la `/exec` amb `?v=1` | `VedrunApp — codi vNNN` |
| Navegador | l'app → **Alumnes** | els alumnes, amb les dades |

Fet a l'app d'en Pol el 5/9/2026.

### A partir d'aquí

Un canvi al `Code.gs` de la mare:

```bash
node eines/fes-biblioteca.js
```

i enganxar `biblioteca/Codi.gs` a la biblioteca. **A totes les mestres els
arriba sol.**

### Tres coses que s'han de tenir presents

- **Si la biblioteca es trenca, es trenquen totes les apps alhora.** Abans,
  una enganxada dolenta en trencava una. Per això `node eines/prova-tot.js`
  abans de tocar la biblioteca no és opcional.
- **Una funció NOVA d'editor** (les que s'executen des de l'Apps Script) sí
  que demana refer el pont i tornar-lo a enganxar. Les **accions noves del
  navegador**, no: aquelles arriben soles.
- **Per saber quin codi té una mestra a sobre**, obre la seva `/exec` amb
  `?v=1`, o executa-hi `veureAlies()`. El seu projecte no canvia mai i no hi
  ha cap altra manera de saber-ho.

---

## C · Amb ella al costat  (2 min)

11. **Perfil:** el nom, i després:
    - **tutora** → de quin grup ho és i quines assignatures hi fa;
    - **especialista** → «A quins grups fas classe?»: hi afegeix cada grup
      (3r A, 3r B…) i hi marca les assignatures.
    - **direcció** → igual que una especialista (tampoc no tria tutoria).
      Ensenya-li que el grup de treball el tria a **Alumnes**, amb el curs i
      la línia, i que d'allà surten també les observacions, els registres i
      la distribució de l'aula.
12. **Horari:** l'editor visual, o "Importar ràpid" enganxant-lo d'un full.

La resta (objectius d'avaluació, la seva manera d'escriure comentaris,
aspectes d'actitud, enllaços) **ja s'ho pot fer ella** quan vulgui, des de
l'app. No cal deixar-ho llest ara.

Si més endavant demana alguna cosa que només és per a ella, va al
`js/personal.js` de la seva carpeta (veure `FILLES.md`).

---

## Si alguna cosa falla

Torna a executar **`configuraTot`**: es pot executar tantes vegades com
calgui, no esborra res i et torna a dir què falta.

| Símptoma | Què passa |
|---|---|
| "You do not have permission to call tasks…" | Els permisos han quedat encallats. Treu-li l'accés a [myaccount.google.com/permissions](https://myaccount.google.com/permissions), executa `configuraTot` un altre cop i torna a desplegar |
| No es connecta | La URL ha d'acabar en `/exec` i cal haver desplegat una versió |
| No hi ha alumnes | Comprova el `GRUPS_ID` i que aquest compte tingui accés al full Grups |
| Canvis que no es veuen | `Ctrl+Shift+R`, o l'avís de versió nova → "Actualitzar ara" |
