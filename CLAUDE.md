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

## Workflow tècnic
- Frontend HTML/CSS/JS pur, sense frameworks. Backend: Google Apps Script (`Code.gs`).
- **A cada canvi de frontend: puja la versió del cache a `sw.js`** (`const CACHE = 'vedruna-vNN'`).
- **A cada canvi de `Code.gs`: cal desplegar una NOVA versió** al Apps Script.
- No toquis `js/config.local.js` en actualitzar.

## Validació abans de donar per bo un canvi
- `node --check` de cada fitxer JS modificat.
- Comprova que l'HTML queda ben tancat.
- Si toques el backend, valida `Code.gs` amb mocks (SpreadsheetApp, PropertiesService…).
- Prova amb dades buides (cas mestre nou): cap render ha de petar.

## Estil de treball preferit
- Canvis incrementals i provats. Explica el que fas i per què.
- Prioritza velocitat i simplicitat d'ús: els mestres tenen poc temps.
