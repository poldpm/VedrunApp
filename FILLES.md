# Apps filles — una app per mestra

Aquest repositori és l'**app mare**. Cada mestra té la **seva pròpia app**
(codi separat, URL separada), perquè la manera d'avaluar canvia molt d'una a
l'altra: n'hi ha que entren punts pregunta per pregunta i en generen la nota
de l'activitat, d'altres avaluen per criteris, d'altres no ponderen…

Aquestes diferències no es poden resoldre amb una opció: són models de dades
diferents. Per això es fan apps filles.

---

## On viuen les carpetes

Totes les apps viuen **dins d'una sola carpeta**, `C:\Escorial\VedrunApp`, per
no barrejar-se amb la resta de coses del dia a dia:

```
C:\Escorial\VedrunApp\
├── VedrunApp-Tutors\          ← l'APP MARE (la plantilla, aquesta carpeta)
├── VedrunApp-Especialistes\   ← plantilla del rol especialista
├── VedrunApp-Direccio\        ← plantilla del rol direcció
└── VedrunApp-<Mestra>\        ← l'app de cada mestra
```

`nova-filla.js` crea cada app nova **al costat de la mare**, o sigui que les
mestres noves cauen aquí dins soles: no s'ha de dir on van.

Els camins només són escrits a mà a `filles.json`. Les eines es localitzen
soles, així que si un dia es torna a moure tot, només s'ha de tocar aquell
fitxer (i els exemples de la documentació).

---

## Què divergeix i què no

La divergència real està concentrada a **les notes**. La resta és idèntic:

| Comú a totes (ve de la mare) | Propi de cada filla |
|---|---|
| Calendari, planning, horari | `js/personal.js` (el que és seu i només seu) |
| Alumnes, fitxes, observacions | `js/config.local.js` (el seu token) |
| Seients, grups, post-its, tasques | `js/rol.js` (tutora, especialista o direcció) |
| Comentaris, assoliments | `js/notes.js` (només si avalua molt diferent) |
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
`js/personal.js`. Hi va tot el que és seu, sense tocar res del base. Es
carrega **l'últim de tots** (quan la resta de l'app ja hi és) i la
sincronització no el toca mai: a la mare és buit, i a cada filla hi ha el seu.

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
    { "mestra": "Anna",  "carpeta": "C:/Escorial/VedrunApp/VedrunApp-Anna" },
    { "mestra": "Marta", "carpeta": "C:/Escorial/VedrunApp/VedrunApp-Marta" }
  ]
}
```

Quan s'arregla una cosa de base o s'afegeix una eina nova:

```bash
node eines/sync-totes.js --prova    # ensenya què faria, sense tocar res
node eines/sync-totes.js            # ho fa a TOTES
```

Cada app conserva el seu `personal.js`, el seu rol i el seu token. Després: provar-les i
pujar-les al seu GitHub; les mestres veuran l'avís de versió nova i
s'actualitzaran soles.

Per a una de sola: `node eines/sync-totes.js --mestra Anna`

## Crear l'app d'una mestra

```bash
node eines/nova-filla.js "Marta" --especialista    # especialista
node eines/nova-filla.js "Nuria" --direccio        # equip directiu
node eines/nova-filla.js "Anna"                    # tutora
node eines/nova-filla.js "Marta" --especialista --prova
```

L'eina munta `C:\Escorial\VedrunApp\VedrunApp-<Mestra>` **a partir de l'app que li
toca**: la mare si és tutora, **l'app dels especialistes** si és
especialista i **la de direcció** si és de l'equip directiu. D'allà se'n
queda només el que no ha de canviar mai (`js/rol.js`, el token i els
manifests); tota la resta del codi la porta de la mare amb `sync-filla.js`.
Després l'apunta a `filles.json` i comprova que el rol hagi quedat bé.

**Per això no s'ha de copiar mai una carpeta a mà:** si una especialista
naixés de la mare, tindria `APP_ROL = 'tutor'` i li demanaria de quin grup
és tutora.

Un cop creada: provar-la, personalitzar-la des del seu `js/personal.js`
(l'eina l'hi deixa fet, amb el seu nom a dalt), crear-li el repositori i el
GitHub Pages, i connectar-la amb ella al costat.

## L'app dels especialistes (no és d'una mestra)

`C:\Escorial\VedrunApp\VedrunApp-Especialistes` no és l'app d'una mestra concreta: és
**la versió per a totes les especialistes**, amb el mateix codi que la mare.
L'únic propi és `js/rol.js` (`window.APP_ROL = 'especialista'`) i el nom que
surt als manifests en instal·lar-la. Com que `js/rol.js` és a `SEMPRE_PROPI`,
el `sync` no l'hi toca mai.

Es manté com qualsevol altra filla:

```bash
node eines/sync-filla.js "C:/Escorial/VedrunApp/VedrunApp-Especialistes" --prova
node eines/sync-filla.js "C:/Escorial/VedrunApp/VedrunApp-Especialistes"
```

Tot el que canvia entre els rols viu a la mare, darrere `esEspecialista()`.
**No s'hi ha de tocar codi mai**: si s'hi toca, deixa de rebre arranjaments.

**És l'arrel de les apps de les especialistes.** Quan una especialista
necessiti la seva app, surt d'aquí amb `nova-filla.js` (veure aquí sobre), i
tot el que es millori per a les especialistes es fa **a la mare** darrere
`esEspecialista()`, no en aquesta carpeta.

**NO es publica enlloc, i és a posta.** Aquesta carpeta és una plantilla que
viu només a l'ordinador d'en Pol: no té repositori ni GitHub Pages, i no cal
que en tingui. `nova-filla.js` en copia fitxers, no clona cap repositori.
Qui té una adreça a Internet és **l'app de cada mestra**, no aquesta.

## L'app de direcció (tampoc no és d'una persona)

`C:\Escorial\VedrunApp\VedrunApp-Direccio` funciona exactament igual: és **la versió
per a l'equip directiu**, amb el mateix codi que la mare. L'únic propi és
`js/rol.js` (`window.APP_ROL = 'direccio'`) i el nom als manifests.

```bash
node eines/sync-filla.js "C:/Escorial/VedrunApp/VedrunApp-Direccio" --prova
node eines/sync-filla.js "C:/Escorial/VedrunApp/VedrunApp-Direccio"
```

Direcció ho fa tot com un tutor, però **no en tutoritzen cap grup**: a
Alumnes trien de quin dels 18 grups de primària volen veure (i modificar) les
fitxes, i el grup triat els segueix per Observacions, Registres d'aula i
Distribució de l'aula. Ho fan servir per omplir les dades dels grups on el
tutor no fa servir l'app i per veure què hi escriu la resta. El detall tècnic
és a `PROJECTE.md` (secció 3bis).

Com l'altra: **no es publica** i **no s'hi toca codi mai**. Les apps de cada
director en surten amb `node eines/nova-filla.js "<Nom>" --direccio`.

## Comprovar que cada rol fa el que ha de fer

```bash
node eines/comprova-rols.js                                             # els tres rols
node eines/comprova-rols.js --carpeta "C:/Escorial/VedrunApp/VedrunApp-Direccio"  # una carpeta tal com està
```

Carrega l'app dins d'un navegador de mentida i li prem els botons. La segona
manera és la bona per a una app ja feta: fa servir el **seu** `js/rol.js`, o
sigui que et diu si el rol d'aquella carpeta és el que toca de debò i no
només el que diu el `FILLA.json`.

## Un cop creada: què queda per fer

`nova-filla.js` ja li ha deixat la carpeta, el `FILLA.json`, el rol i el
seu `js/personal.js`. Queda:

1. **Posar-hi el seu token** a `js/config.local.js` (ha de coincidir amb
   l'`APP_TOKEN` de les propietats del SEU Apps Script). Amb apps separades,
   cada mestra pot tenir el seu token propi: és més segur que compartir-ne un.
2. **Repositori i GitHub Pages propis** per tenir la seva URL.
3. Al seu navegador, **Configuració → la URL del seu `/exec`**
   (el guió complet del backend és a `INSTALLACIO.md`).
4. Amb ella al costat: **perfil** i **horari**.

A `propis` del `FILLA.json` només hi van els fitxers que aquella mestra
tingui **diferents**. `js/config.local.js` i `js/rol.js` ja es respecten
sempre, i `js/personal.js` només es copia si encara no hi és: no cal
posar-los-hi.

> **El manual d'ús viatja de la mare a les filles.** Mentre una filla
> només tingui la manera d'avaluar canviada, li va bé el manual de la
> mare. Però el dia que li facis alguna cosa **que el manual no explica
> o que a ella funciona diferent**, afegeix `manual.html` als seus
> `propis` i actualitza-l'hi allà: si no, la propera sincronització li
> tornarà el manual de la mare i li explicarà una app que no és la seva.

---

## Portar un arranjament general a una filla

Quan s'arregla una cosa a la mare que afecta tothom:

```bash
node eines/sync-filla.js "C:/Escorial/VedrunApp/VedrunApp-Anna" --prova
node eines/sync-filla.js "C:/Escorial/VedrunApp/VedrunApp-Anna"
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
