# PROJECTE — App "Gestió de Curs" · Vedruna Escorial Vic

> Document de traspàs i referència del projecte. Recull l'arquitectura, les
> decisions clau, les regles absolutes i l'estat actual. Pensat perquè
> qualsevol persona (o Claude Code) pugui continuar el desenvolupament sense
> perdre context.

**Versió actual:** v95 (cache `vedruna-v95` al `sw.js`)
**Idioma de tota la interfície i la documentació:** Català
**Autor/mantenidor:** Pol (tutor de 2n de Primària)

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
├── manual.html             # Manual d'usuari (18 seccions)
├── README.md               # Instruccions bàsiques de desplegament
├── PROJECTE.md             # AQUEST document
├── css/
│   └── main.css            # TOTS els estils
├── js/
│   ├── config.local.js     # NOMÉS el token. NO SE SUBSTITUEIX en actualitzar!
│   ├── app.js              # Nucli: navegació, home, alumnes, notes, planning,
│   │                       #   calendari, tasques, config, bootstrap, sync
│   ├── perfil.js           # Perfil del mestre (nom, tutoria, assignatures)
│   ├── notes.js            # Notes d'assignatures i actitud
│   ├── seients.js          # Distribució de l'aula (plànol + auto-assignació)
│   ├── grupview.js         # Vista de grup / desdoblaments
│   ├── postits.js          # Notes i post-its
│   ├── horari.js           # Horari (plantilla setmanal → omple planning)
│   └── vedrunu.js          # Xatbot "Vedrunu" (IA)
└── img/                    # Icones, logo, favicons
```

---

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

### Desplegament de l'Apps Script
- **Executar com: JO (el propietari) + Accés: qualsevol.**
- Això vol dir que l'app funciona amb el compte del propietari
  independentment del correu actiu al dispositiu del mestre. Única fricció:
  obrir els fulls directament amb un correu sense permís.

---

## 7. FLUX PER DONAR D'ALTA UN MESTRE NOU

1. Afegir el seu **/exec** (URL del seu Apps Script) a la configuració.
2. **Connectar** (l'app fa sola: crear pestanyes, protegir fulls, ajustar columnes).
3. Configurar el seu **perfil** (nom, grup que tutoritza, assignatures).
4. Introduir el seu **horari** (editor visual o importació ràpida).

Els IDs dels fulls compartits, la clau Gemini i el token ja van a les Script
Properties del seu Apps Script, així que no s'han d'entrar a la interfície.

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
