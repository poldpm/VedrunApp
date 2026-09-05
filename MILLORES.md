# Com està feta cada millora

Aquí hi ha la **recepta tècnica** de cada cosa que s'ofereix a «Possibles
actualitzacions». La llista que veu la mestra és a `js/millores.js`; això és
per a **qui l'hagi de fer**.

**Per què existeix:** una mestra veu una millora a la llista, la demana, i en
Pol va a la conversa d'aquella mestra i diu «fes-li la del color verd». Si
aquí no hi ha la recepta, aquella conversa se l'ha d'inventar de nou i acabes
amb la mateixa cosa feta de dues maneres diferents a dues apps. Amb la
recepta, surt igual.

**Aquest fitxer se sincronitza a totes les apps**, o sigui que qualsevol
conversa el pot obrir. No se'l baixa cap navegador: no fa l'app més pesada.

---

## Com s'hi afegeix una

Quan en Pol enganxi el bloc que li ha preparat la conversa de la mestra
(veure `CLAUDE.md`, apartat «Passar una millora a Possibles actualitzacions»):

1. La part **PER A LA LLISTA** va a `MILLORES` de `js/millores.js`.
2. La part **COM ESTÀ FETA** va aquí sota, amb el mateix `id`.
3. Puja la versió i sincronitza.

El `id` ha de ser **el mateix als dos llocs**, i no es canvia mai: és el que
identifica la petició al correu i el que recorda si una mestra ja l'ha
demanada.

---

<!-- Les receptes, una per millora, amb aquesta forma:

## `id-de-la-millora` — Títol

**Què fa:** una frase.

**Fitxers:** quins es toquen i què s'hi fa a cadascun.

**Com funciona:** l'explicació de debò, la que estalvia haver-hi de pensar
una altra vegada.

**Paranys:** el que va costar de trobar. Aquesta part és la que més val.

**Depèn de:** si cal el `Code.gs` (i per tant enganxar la biblioteca), si
demana cap permís nou al `appsscript.json`, o si és només de pantalla.

-->

*(Encara no n'hi ha cap. La primera que entri a la llista, aquí sota.)*
