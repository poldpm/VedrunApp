# Vedruna Escorial Vic — Gestió de Notes

App web per a la gestió de notes de 2n de Primària, connectada amb Google Sheets via Apps Script.

## Estructura del projecte

```
vedruna-app/
├── index.html          # Pàgina principal
├── css/
│   └── main.css        # Tots els estils
├── js/
│   └── app.js          # Tota la lògica
├── img/
│   ├── logo-horitzontal.png
│   └── logo-vertical.png
└── README.md
```

## Configuració inicial

1. Obre el teu Google Sheets
2. **Extensions → Apps Script** → Enganxa el codi del backend
3. **Implementa → Nova implementació** → App web → Accés: Tothom
4. Copia la URL `/exec` i enganxa-la a la configuració de l'app

## Tecnologies

- HTML / CSS / JavaScript vanilla (sense frameworks)
- Google Sheets com a base de dades
- Google Apps Script com a backend/API
- Allotjament: GitHub Pages (estàtic)

## Desplegament a GitHub Pages

1. Puja el projecte a un repositori GitHub
2. Settings → Pages → Branch: main → Folder: / (root)
3. L'app estarà disponible a `https://[usuari].github.io/[repo]/`
