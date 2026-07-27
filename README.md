# App "Gestió de Curs" — Vedruna Escorial Vic

Aplicació web (PWA) per a la gestió del dia a dia d'un mestre de Primària,
connectada amb Google Sheets via Google Apps Script. HTML/CSS/JS purs, sense
frameworks. Interfície en català.

> **Per a la documentació completa** (arquitectura, decisions, regles,
> credencials, workflow i model de dades), vegeu **[PROJECTE.md](PROJECTE.md)**.

## Tecnologies

- HTML / CSS / JavaScript vanilla (sense frameworks)
- Google Sheets com a base de dades
- Google Apps Script com a backend/API (`Code.gs`)
- PWA instal·lable (manifest + service worker)
- Allotjament: GitHub Pages (estàtic, HTTPS)

## Estructura (resum)

```
vedruna-app/
├── index.html              # Totes les pàgines i modals
├── Code.gs                 # Backend (Apps Script)
├── sw.js                   # Service worker (PWA). Bump de versió a cada canvi de frontend!
├── manifest.webmanifest    # Manifest PWA
├── manual.html             # Manual d'usuari
├── PROJECTE.md             # Documentació completa del projecte
├── css/main.css            # Tots els estils
├── js/
│   ├── config.local.js     # Token del dispositiu (NO se substitueix en actualitzar)
│   ├── app.js              # Nucli de l'app
│   ├── perfil.js, notes.js, seients.js, grupview.js,
│   ├── postits.js, horari.js, vedrunu.js
└── img/                    # Icones, logo, favicons
```

## Configuració inicial (backend)

1. Obre el Google Sheets personal del mestre.
2. **Extensions → Apps Script** → enganxa `Code.gs`.
3. Posa les credencials a les **Script Properties** (executa `configuraCredencials()`
   un cop, o afegeix-les manualment): `GRUPS_ID`, `DESDOB_ID`, `GEMINI_KEY`, `APP_TOKEN`.
4. **Implementa → Nova implementació** → App web → Executar com: JO, Accés: qualsevol.
5. Copia la URL `/exec`.

## Configuració (frontend)

1. Posa el mateix `APP_TOKEN` a `js/config.local.js` (`window.APP_TOKEN`).
2. Puja el projecte a GitHub Pages.
3. A l'app, enganxa la URL `/exec` a Configuració i connecta.

## Aplicar canvis

- **Frontend:** puja a GitHub + `Ctrl+Shift+R`. **Recorda pujar la versió del
  cache a `sw.js`** (`const CACHE = 'vedruna-vNN'`).
- **Backend:** enganxa `Code.gs` i desplega una **Nova versió** (mantenint la URL).
- **`js/config.local.js`:** no el substitueixis mai (manté el token).
