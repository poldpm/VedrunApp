# Apps filles — una app per mestra

Aquest repositori és l'**app mare**. Cada mestra té la **seva pròpia app**
(codi separat, URL separada), perquè la manera d'avaluar canvia molt d'una a
l'altra: n'hi ha que entren punts pregunta per pregunta i en generen la nota
de l'activitat, d'altres avaluen per criteris, d'altres no ponderen…

Aquestes diferències no es poden resoldre amb una opció: són models de dades
diferents. Per això es fan apps filles.

---

## Què divergeix i què no

La divergència real està concentrada a **les notes**. La resta és idèntic:

| Comú a totes (ve de la mare) | Propi de cada filla |
|---|---|
| Calendari, planning, horari | `js/notes.js` (si avalua diferent) |
| Alumnes, fitxes, observacions | `js/config.local.js` (el seu token) |
| Seients, grups, post-its, tasques | El que ella hagi personalitzat |
| Comentaris, assoliments | |
| Sincronització amb Google | |
| Avís de versió nova | |

**Com menys fitxers propis tingui una filla, més barat serà mantenir-la.**
Abans de fer propi un fitxer, val la pena mirar si la diferència es pot
resoldre amb una opció que es desi al seu full (com ja passa amb els
objectius, l'estil dels comentaris, els aspectes d'actitud i els enllaços).

---

## La regla que ho fa sostenible

**El codi base no ha de divergir MAI.** Si es toca el codi de la mare dins d'una
filla, aquell fitxer deixa de rebre arranjaments per sempre. I com que
`js/app.js` són 5.000 línies (inici, calendari, planning, tasques, alumnes,
comentaris, grups), amb dos canvis una filla queda congelada.

Per això cada mestra té **un fitxer propi que s'enganxa per sobre**:
`js/personal-<mestra>.js`. Hi va tot el que és seu, sense tocar res del base.

Aquest patró ja és el que fa servir l'app: `gwrite.js`, `rubriques.js` i
`versio.js` no toquen ni una línia d'`app.js`, s'hi enganxen així:

```javascript
// Embolcalla una funció que ja existeix, sense modificar-la
var orig = window.cal2SaveEvents;
window.cal2SaveEvents = function () {
  var r = orig.apply(this, arguments);
  ferLaMevaCosa();          // el que necessita aquesta mestra
  return r;
};
```

També es pot canviar una pantalla sencera redefinint la funció que la pinta,
o afegir-hi eines noves. Tot des del seu fitxer.

**Només es forka un fitxer del base quan no hi ha manera** (típicament
`js/notes.js`, si el model d'avaluació és radicalment diferent). Cada fitxer
forkat és un que aquella mestra deixarà de rebre: com menys, millor.

## Actualitzar-les TOTES de cop

`filles.json` és el registre de totes les mestres:

```json
{
  "filles": [
    { "mestra": "Anna",  "carpeta": "C:/Escorial/VedrunApp-Anna" },
    { "mestra": "Marta", "carpeta": "C:/Escorial/VedrunApp-Marta" }
  ]
}
```

Quan s'arregla una cosa de base o s'afegeix una eina nova:

```bash
node eines/sync-totes.js --prova    # ensenya què faria, sense tocar res
node eines/sync-totes.js            # ho fa a TOTES
```

Cada app conserva el seu `personal-*.js` i el seu token. Després: provar-les i
pujar-les al seu GitHub; les mestres veuran l'avís de versió nova i
s'actualitzaran soles.

Per a una de sola: `node eines/sync-totes.js --mestra Anna`

## Crear una filla

1. **Copiar** aquesta carpeta a `C:\Escorial\VedrunApp-<Mestra>`.
2. **Esborrar-hi** la carpeta `.git` (perquè no apunti al repositori de la mare).
3. **Crear-hi `FILLA.json`**:

   ```json
   {
     "mestra": "Anna",
     "mareVersio": "v111",
     "propis": ["js/notes.js"]
   }
   ```
   A `propis` només hi van els fitxers que aquella mestra tingui diferents.
   `js/config.local.js` ja es respecta sempre, no cal posar-l'hi.

   > **El manual d'ús viatja de la mare a les filles.** Mentre una filla
   > només tingui la manera d'avaluar canviada, li va bé el manual de la
   > mare. Però el dia que li facis alguna cosa **que el manual no explica
   > o que a ella funciona diferent**, afegeix `manual.html` als seus
   > `propis` i actualitza-l'hi allà: si no, la propera sincronització li
   > tornarà el manual de la mare i li explicarà una app que no és la seva.

4. **Posar-hi el seu token** a `js/config.local.js` (ha de coincidir amb
   l'`APP_TOKEN` de les propietats del SEU Apps Script). Amb apps separades,
   cada mestra pot tenir el seu token propi: és més segur que compartir-ne un.
5. **Repositori i GitHub Pages propis** per tenir la seva URL.
6. Al seu navegador, **Configuració → la URL del seu `/exec`**.

---

## Portar un arranjament general a una filla

Quan s'arregla una cosa a la mare que afecta tothom:

```bash
node eines/sync-filla.js "C:/Escorial/VedrunApp-Anna" --prova
node eines/sync-filla.js "C:/Escorial/VedrunApp-Anna"
```

- `--prova` ensenya què faria **sense tocar res**. Val la pena mirar-ho sempre.
- Copia tot el que no és propi d'ella i **deixa intactes** els seus fitxers.
- Actualitza `FILLA.json` amb la versió de la mare que li ha quedat.

Després: provar l'app i pujar-la al seu GitHub. Amb l'avís de versió nova, la
mestra veurà sola que hi ha una actualització.

⚠️ Si l'arranjament tocava un fitxer **propi** d'ella (típicament `js/notes.js`),
l'eina no l'hi aplica: s'hi ha de posar a mà. L'eina avisa quan passa.

---

## Regla per a les converses per mestra

Hi ha **una conversa per mestra**. Dins d'aquella conversa:

- Un canvi que **només afecta ella** → es fa a la seva carpeta.
- Un canvi **general** (un bug, una millora per a tothom) → **es fa a la mare**
  i després es propaga amb `sync-filla.js` a totes.

Mai s'ha d'arreglar un bug general només a la filla: quedaria arreglat en una
app i trencat a les altres, i la propera sincronització podria desfer-ho.
