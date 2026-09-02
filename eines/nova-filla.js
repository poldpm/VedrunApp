#!/usr/bin/env node
/* ============================================================
   CREAR L'APP D'UNA MESTRA
   ------------------------------------------------------------
   Munta la carpeta d'una mestra nova a partir de l'app que li
   toca, i la deixa a punt per personalitzar-la:

     · si és TUTORA        → surt de l'app mare (aquesta carpeta)
     · si és ESPECIALISTA  → surt de l'app dels especialistes

   Això últim és el que importa: l'app dels especialistes NO és
   una còpia amb el codi tocat, és la mateixa amb el rol canviat.
   Per això la filla d'una especialista només s'ha de quedar
   `js/rol.js` i tota la resta li continua arribant de la mare.

   ÚS:
     node eines/nova-filla.js "Marta" --especialista
     node eines/nova-filla.js "Anna"
     node eines/nova-filla.js "Marta" --especialista --prova

   Després: obrir la seva carpeta, provar-la, crear-li el
   repositori i el GitHub Pages, i personalitzar-la des del seu
   `js/personal.js` (veure FILLES.md).
   ============================================================ */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const MARE = path.resolve(__dirname, '..');
const REGISTRE = path.join(MARE, 'filles.json');

const args = process.argv.slice(2);
const nomesProva = args.includes('--prova');
const esEspecialista = args.includes('--especialista');
const mestra = (args.find(a => !a.startsWith('--')) || '').trim();

if (!mestra) {
  console.error('Falta el nom de la mestra.\n' +
    '  node eines/nova-filla.js "Marta" --especialista\n' +
    '  node eines/nova-filla.js "Anna"');
  process.exit(1);
}

/* --- D'on surt --- */
let base = MARE;
if (esEspecialista) {
  let reg = { filles: [] };
  try { reg = JSON.parse(fs.readFileSync(REGISTRE, 'utf8')); } catch (e) {}
  const arrel = (reg.filles || []).find(f => (f.mestra || '').toLowerCase() === 'especialistes');
  if (!arrel || !arrel.carpeta || !fs.existsSync(arrel.carpeta)) {
    console.error('No trobo l\'app dels especialistes.\n' +
      'Ha d\'estar registrada a filles.json com a "Especialistes" i existir al disc.\n' +
      'Sense ella no puc fer l\'app d\'una especialista: para i mira-ho.');
    process.exit(1);
  }
  base = arrel.carpeta;
}

/* --- On va --- */
function nomCarpeta(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
const desti = path.join(path.dirname(MARE), 'VedrunApp-' + nomCarpeta(mestra));

console.log('MESTRA:  ' + mestra + (esEspecialista ? '   (especialista)' : '   (tutora)'));
console.log('SURT DE: ' + base);
console.log('VA A:    ' + desti);
console.log(nomesProva ? '\n*** PROVA: no es crearà res ***\n' : '');

if (fs.existsSync(desti)) {
  console.error('\nJa existeix aquesta carpeta. Si vols refer-la, canvia-li el nom primer.');
  process.exit(1);
}

/* --- El que és seu i no ve de la mare --- */
const PROPIS_DEL_BASE = ['js/rol.js', 'js/config.local.js', 'manifest.webmanifest', 'manifest.json'];

if (nomesProva) {
  console.log('Es copiaria del base (i no se sincronitzarien mai):');
  PROPIS_DEL_BASE.forEach(f => console.log('  ' + f + (fs.existsSync(path.join(base, f)) ? '' : '   (no hi és al base)')));
  console.log('\nI després es portaria tota la resta de la mare amb sync-filla.js.');
  process.exit(0);
}

fs.mkdirSync(desti, { recursive: true });
for (const rel of PROPIS_DEL_BASE) {
  const origen = path.join(base, rel);
  if (!fs.existsSync(origen)) continue;
  const f = path.join(desti, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.copyFileSync(origen, f);
}

/* Les seves personalitzacions: un fitxer seu, amb el seu nom a dalt, que
   se li carrega l'últim i que la sincronització no tocarà mai. */
const stub = fs.readFileSync(path.join(MARE, 'js', 'personal.js'), 'utf8')
  .replace("PERSONALITZACIONS D'AQUESTA MESTRA — personal.js",
           'PERSONALITZACIONS DE ' + mestra.toUpperCase() + ' — personal.js');
fs.mkdirSync(path.join(desti, 'js'), { recursive: true });
fs.writeFileSync(path.join(desti, 'js', 'personal.js'), stub);

/* Els manifests són propis (perquè la mestra pugui distingir la seva app
   quan se la instal·li), però el rol ja el porta el fitxer copiat del base. */
fs.writeFileSync(path.join(desti, 'FILLA.json'), JSON.stringify({
  mestra: mestra,
  rol: esEspecialista ? 'especialista' : 'tutor',
  mareVersio: '?',
  propis: ['manifest.webmanifest', 'manifest.json'],
}, null, 2) + '\n');

/* --- Tota la resta, de la mare --- */
console.log('\nPortant el codi de la mare…\n');
execFileSync('node', [path.join(__dirname, 'sync-filla.js'), desti], { stdio: 'inherit' });

/* --- Al registre --- */
let reg = { _comentari: 'Registre de les apps de cada mestra.', filles: [] };
try { reg = JSON.parse(fs.readFileSync(REGISTRE, 'utf8')); } catch (e) {}
if (!Array.isArray(reg.filles)) reg.filles = [];
if (!reg.filles.some(f => (f.mestra || '').toLowerCase() === mestra.toLowerCase())) {
  reg.filles.push({
    mestra: mestra,
    carpeta: desti.replace(/\\/g, '/'),
    rol: esEspecialista ? 'especialista' : 'tutor',
  });
  fs.writeFileSync(REGISTRE, JSON.stringify(reg, null, 2) + '\n');
  console.log('\nApuntada a filles.json.');
}

/* --- Comprovació: el rol ha de ser el que toca --- */
const rol = fs.readFileSync(path.join(desti, 'js', 'rol.js'), 'utf8');
const rolOk = new RegExp("window\\.APP_ROL = '" + (esEspecialista ? 'especialista' : 'tutor') + "';").test(rol);
console.log(rolOk
  ? '\nEl rol de la seva app és correcte (' + (esEspecialista ? 'especialista' : 'tutor') + ').'
  : '\n⚠ ATENCIÓ: el js/rol.js no ha quedat bé. Mira-l\'ho abans de donar-li res.');

console.log('\nSegüent pas:');
console.log('  1. Prova-la i personalitza-la des del seu js/personal.js (veure FILLES.md).');
console.log('  2. Crea-li el repositori i el GitHub Pages.');
console.log('  3. Amb ella al costat: Configuració → Connectar, i el seu perfil.');
