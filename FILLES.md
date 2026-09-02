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
