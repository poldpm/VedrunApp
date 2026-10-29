#!/bin/bash
# ============================================================
#  EN COMENÇAR UNA CONVERSA: ¿AQUESTA CÒPIA ÉS AL DIA?
#  ------------------------------------------------------------
#  Aquesta carpeta és L'APP PUBLICADA d'una mestra. Cada conversa
#  en té la seva còpia, i si no es posa al dia veu el que es va
#  baixar el dia que es va obrir, encara que a GitHub hi hagi la
#  versió nova.
#
#  Va passar dues vegades: l'app d'un mestre nou creada des d'una
#  còpia del 7 d'octubre (sense l'entrada amb Google, que el
#  servidor ja exigia), i converses que deien «estaves en una
#  versió anterior» quan el que estava enrere era la seva còpia.
#
#  Això NO toca res i no fusiona res: només ho diu, abans que la
#  conversa comenci a treballar. Només crida si la VERSIÓ de
#  l'app és més vella: estar darrere uns quants commits passa
#  cada dia i no fa cap mal (el perquè, a eines/_aldia.js de la
#  mare).
#
#  Mai no ha de fer fallar l'arrencada: passi el que passi, surt bé.
# ============================================================
set -uo pipefail

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}" 2>/dev/null || exit 0
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0
[ -f sw.js ] || exit 0

timeout 25 git fetch origin main --quiet >/dev/null 2>&1

darrere=$(git rev-list --count HEAD..origin/main 2>/dev/null) || exit 0
[ -z "$darrere" ] && exit 0
[ "$darrere" -eq 0 ] 2>/dev/null && exit 0

aqui=$(grep -o 'vedruna-v[0-9]*' sw.js 2>/dev/null | head -1 | sed 's/vedruna-//')
alla=$(git show origin/main:sw.js 2>/dev/null | grep -o 'vedruna-v[0-9]*' | head -1 | sed 's/vedruna-//')

na=${aqui#v}; nb=${alla#v}
case "$na$nb" in *[!0-9]*|'') exit 0;; esac
[ "$na" -ge "$nb" ] 2>/dev/null && exit 0

cat <<FI

⚠️  AQUESTA CÒPIA DE L'APP ESTÀ ENDARRERIDA — NO TOQUIS RES ENCARA

    aquí:        ${aqui:-?}
    publicada:   ${alla:-?}   — $darrere commits que aquí no hi són

    El que hi ha a GitHub és el que la mestra té obert. Treballant des
    d'aquí desfaries, sense voler, el que ja li ha arribat.

    FES AIXÒ PRIMER, sense preguntar-ho (el git no el fa mai en Pol):

        git pull origin main

    ⚠ I recorda que el codi d'aquesta app surt de la MARE: un arranjament
    general es fa allà i arriba aquí amb \`node eines/sync-totes.js\`. Aquí
    només hi van les coses d'aquesta mestra (js/personal.js i els seus
    \`propis\` del FILLA.json). Veure CLAUDE.md i FILLES.md.

FI
exit 0
