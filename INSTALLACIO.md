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

   Sense `--especialista` si és **tutora**. L'eina la munta a partir de
   l'app que li toca (la dels especialistes o la mare), l'apunta a
   `filles.json` i comprova que el rol hagi quedat bé.
   Si fas servir el mateix `APP_TOKEN` per a totes, **no has de tocar
   `js/config.local.js`**.

   Després: **repositori i GitHub Pages propis** per a la seva carpeta.

9. **Obre la seva URL** al seu navegador → **Configuració** → enganxa el `/exec`
   → **Connectar**.

10. **Instal·la-la** com a app (icona d'instal·lar de la barra del navegador) i
    deixa-la-hi a l'escriptori o a la barra de tasques.

---

## C · Amb ella al costat  (2 min)

11. **Perfil:** el nom, i després:
    - **tutora** → de quin grup ho és i quines assignatures hi fa;
    - **especialista** → «A quins grups fas classe?»: hi afegeix cada grup
      (3r A, 3r B…) i hi marca les assignatures.
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
