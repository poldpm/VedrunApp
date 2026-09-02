#!/usr/bin/env node
/* ============================================================
   SINCRONITZAR UNA APP FILLA AMB L'APP MARE
   ------------------------------------------------------------
   Cada mestra té la seva app (codi separat) perquè avalua diferent.
   Però la major part del codi és idèntica: calendari, planning,
   seients, tasques, comentaris, sincronització amb Google…

   Aquesta eina copia de la MARE a la FILLA tot allò que NO ha
   divergit, i deixa intactes els fitxers que la filla té propis.
   Així un arranjament general s'aplica amb una ordre en comptes de
   repetir-lo a mà a cada app.

   ÚS:
     node eines/sync-filla.js "C:/Escorial/VedrunApp-Anna"
     node eines/sync-filla.js "C:/Escorial/VedrunApp-Anna" --prova

   La filla ha de tenir un fitxer FILLA.json que digui què és seu:
     {
       "mestra": "Anna",
       "mareVersio": "v111",
       "propis": ["js/config.local.js", "js/notes.js"]
     }
   ============================================================ */

const fs = require('fs');
const path = require('path');

const MARE = path.resolve(__dirname, '..');
const filla = process.argv[2];
const nomesProva = process.argv.includes('--prova');

if (!filla) {
  console.error('Falta la carpeta de la filla.\n  node eines/sync-filla.js "C:/Escorial/VedrunApp-Anna"');
  process.exit(1);
}
if (!fs.existsSync(filla)) {
  console.error('No existeix la carpeta: ' + filla);
  process.exit(1);
}

// Mai es toquen (ni a la mare ni a la filla)
const MAI = [
  '.git', 'node_modules', '.claude',   // coses de l entorn, no de l app
  'eines', 'FILLA.json',                  // aquesta eina i la fitxa de la filla
  'enquesta',                            // projecte a part den Pol
];

// Sempre és propi de cada app, encara que no ho digui el FILLA.json:
// el token de la mestra i la seva connexió, i el rol de l'app (tutors o
// especialistes). Si el rol se sincronitzés, l'app dels especialistes
// tornaria a ser la dels tutors a la primera actualització.
const SEMPRE_PROPI = ['js/config.local.js', 'js/rol.js'];

const fitxaPath = path.join(filla, 'FILLA.json');
let fitxa = { mestra: path.basename(filla), mareVersio: '?', propis: [] };
if (fs.existsSync(fitxaPath)) {
  try { fitxa = Object.assign(fitxa, JSON.parse(fs.readFileSync(fitxaPath, 'utf8'))); }
  catch (e) { console.error('FILLA.json no es pot llegir: ' + e.message); process.exit(1); }
} else {
  console.log('AVÍS: la filla no té FILLA.json. Se n\'hi crearà un.\n');
}

const propis = new Set(SEMPRE_PROPI.concat(fitxa.propis || []).map(p => p.replace(/\\/g, '/')));

// Versió actual de la mare (del sw.js)
let versioMare = '?';
try {
  const sw = fs.readFileSync(path.join(MARE, 'sw.js'), 'utf8');
  const m = sw.match(/vedruna-v\d+/);
  if (m) versioMare = m[0].replace('vedruna-', '');
} catch (e) {}

function llistaFitxers(arrel, base) {
  base = base || '';
  let out = [];
  for (const nom of fs.readdirSync(path.join(arrel, base))) {
    const rel = base ? base + '/' + nom : nom;
    if (MAI.includes(nom) || MAI.includes(rel)) continue;
    const complet = path.join(arrel, rel);
    if (fs.statSync(complet).isDirectory()) out = out.concat(llistaFitxers(arrel, rel));
    else out.push(rel);
  }
  return out;
}

const fitxers = llistaFitxers(MARE);
const copiats = [], respectats = [], nous = [], iguals = [];

for (const rel of fitxers) {
  if (propis.has(rel)) { respectats.push(rel); continue; }
  const origen = path.join(MARE, rel);
  const desti  = path.join(filla, rel);
  const existeix = fs.existsSync(desti);
  if (existeix && fs.readFileSync(origen).equals(fs.readFileSync(desti))) { iguals.push(rel); continue; }
  if (!nomesProva) {
    fs.mkdirSync(path.dirname(desti), { recursive: true });
    fs.copyFileSync(origen, desti);
  }
  (existeix ? copiats : nous).push(rel);
}

console.log('MARE:  ' + MARE + '   (' + versioMare + ')');
console.log('FILLA: ' + filla + '   (mestra: ' + fitxa.mestra + ', venia de ' + fitxa.mareVersio + ')');
console.log(nomesProva ? '\n*** PROVA: no s\'ha copiat res ***\n' : '');

if (nous.length)       console.log('AFEGITS (' + nous.length + '):\n  ' + nous.join('\n  '));
if (copiats.length)    console.log('\nACTUALITZATS (' + copiats.length + '):\n  ' + copiats.join('\n  '));
if (respectats.length) console.log('\nRESPECTATS, són propis de la ' + fitxa.mestra + ' (' + respectats.length + '):\n  ' + respectats.join('\n  '));
console.log('\nJa eren iguals: ' + iguals.length + ' fitxers.');

if (!nomesProva) {
  fitxa.mareVersio = versioMare;
  fitxa.sincronitzat = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(fitxaPath, JSON.stringify(fitxa, null, 2) + '\n');
  console.log('\nFet. La filla queda a la versió ' + versioMare + ' de la mare.');
  if (respectats.length > 1) {
    console.log('\nRECORDA: els fitxers propis NO s\'han tocat. Si l\'arranjament');
    console.log('general n\'afectava algun, s\'hi ha d\'aplicar a mà.');
  }
  console.log('\nSegüent pas: revisa-ho, prova l\'app i puja-la al seu GitHub.');
}
