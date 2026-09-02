/* ============================================================
   COMPROVA EL MANUAL D'ÚS
   ------------------------------------------------------------
   El manual és la primera línia de suport: si està trencat o
   desactualitzat, les mestres acaben trucant en Pol igualment.

   Aquesta eina mira les coses que es trenquen sense adonar-se'n:
     · enllaços interns que apunten a un apartat que no existeix
     · apartats de l'índex sense destí
     · apartats del manual que NO són a l'índex (queden orfes)
     · etiquetes HTML descompensades
     · que el JS del cercador compili
     · si has tocat el manual, que hagis pujat la versió

   Ús:   node eines/comprova-manual.js
   Torna codi 1 si hi ha res malament (serveix per a un hook).
   ============================================================ */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execSync } = require('child_process');

const ARREL = path.resolve(__dirname, '..');
const MANUAL = path.join(ARREL, 'manual.html');

let problemes = 0;
const ok = t => console.log('  OK    ' + t);
const mal = t => { console.log('  MAL   ' + t); problemes++; };

if (!fs.existsSync(MANUAL)) {
  console.log('No hi ha manual.html a ' + ARREL);
  process.exit(1);
}
const s = fs.readFileSync(MANUAL, 'utf8');

console.log('\nCOMPROVANT EL MANUAL D\'ÚS');
console.log('=========================\n');

/* ---- 1. El JS del cercador ha de compilar ---- */
const js = /<script>([\s\S]*?)<\/script>/.exec(s);
if (!js) mal('no hi ha el script del cercador');
else {
  try { new vm.Script(js[1]); ok('el JS del cercador compila'); }
  catch (e) { mal('el JS del cercador no compila: ' + e.message); }
}

/* ---- 2. Enllaços interns ---- */
const ids = new Set([...s.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));
const nav = /<nav class="toc">([\s\S]*?)<\/nav>/.exec(s);
if (!nav) mal('no hi ha l\'índex (<nav class="toc">)');

const enllacosNav = nav ? [...nav[1].matchAll(/href="#([^"]+)"/g)].map(m => m[1]) : [];
const mortsNav = enllacosNav.filter(h => !ids.has(h));
mortsNav.length
  ? mal('l\'índex apunta a apartats que no existeixen: ' + mortsNav.join(', '))
  : ok('tots els apartats de l\'índex tenen destí (' + enllacosNav.length + ')');

const cos = s.slice(s.indexOf('<main'));
const mortsCos = [...new Set([...cos.matchAll(/href="#([^"]+)"/g)].map(m => m[1]))]
  .filter(h => !ids.has(h));
mortsCos.length
  ? mal('el text enllaça a apartats que no existeixen: ' + mortsCos.join(', '))
  : ok('tots els enllaços del text tenen destí');

/* ---- 3. Apartats orfes: hi són però no a l'índex ---- */
const alNav = new Set(enllacosNav);
const seccions = [...s.matchAll(/<section id="([^"]+)"/g)].map(m => m[1]);
const subapartats = [...s.matchAll(/<h3 id="([^"]+)"/g)].map(m => m[1]);
const orfes = [...seccions, ...subapartats].filter(id => !alNav.has(id));
orfes.length
  ? mal('apartats que NO surten a l\'índex (ningú no els trobarà): ' + orfes.join(', '))
  : ok('cap apartat orfe (' + seccions.length + ' seccions, ' + subapartats.length + ' subapartats)');

/* ---- 4. Etiquetes equilibrades ---- */
const ETIQ = ['section', 'main', 'nav', 'div', 'table', 'ul', 'ol', 'p', 'style', 'script', 'body', 'html'];
const desquadrades = [];
ETIQ.forEach(t => {
  const o = (s.match(new RegExp('<' + t + '(?=[ >\\n])', 'g')) || []).length;
  const c = (s.match(new RegExp('</' + t + '>', 'g')) || []).length;
  if (o !== c) desquadrades.push('<' + t + '> (' + o + ' oberts / ' + c + ' tancats)');
});
desquadrades.length
  ? mal('etiquetes descompensades: ' + desquadrades.join(', '))
  : ok('etiquetes HTML equilibrades');

/* ---- 5. Si el manual ha canviat, la versió ha d'haver pujat ---- */
function tocat(fitxer) {
  try {
    return execSync('git diff --name-only HEAD -- ' + fitxer, { cwd: ARREL })
      .toString().trim() !== '';
  } catch (e) { return null; }   // sense git: no ho podem saber
}

const manualTocat = tocat('manual.html');
if (manualTocat === null) {
  console.log('  ...   sense git: no comprovo la versió');
} else if (!manualTocat) {
  ok('el manual no ha canviat en aquest canvi');
} else {
  const swPujat = tocat('sw.js');
  const vjsPujat = tocat('js/versio.js');
  const vjsonPujat = tocat('versio.json');
  if (swPujat && vjsPujat && vjsonPujat) ok('has tocat el manual i has pujat la versió als tres fitxers');
  else {
    const falten = [];
    if (!swPujat) falten.push('sw.js');
    if (!vjsPujat) falten.push('js/versio.js');
    if (!vjsonPujat) falten.push('versio.json');
    mal('has tocat el manual (que és al cache) però NO has pujat: ' + falten.join(', '));
  }
}

/* ---- 6. Que les tres versions coincideixin ---- */
try {
  const sw = /vedruna-(v\d+)/.exec(fs.readFileSync(path.join(ARREL, 'sw.js'), 'utf8'))[1];
  const vjs = /VERSIO_APP = '(v\d+)'/.exec(fs.readFileSync(path.join(ARREL, 'js/versio.js'), 'utf8'))[1];
  const vjson = JSON.parse(fs.readFileSync(path.join(ARREL, 'versio.json'), 'utf8')).versio;
  (sw === vjs && vjs === vjson)
    ? ok('les tres versions coincideixen (' + sw + ')')
    : mal('les versions no coincideixen: sw.js=' + sw + ' versio.js=' + vjs + ' versio.json=' + vjson);
} catch (e) {
  mal('no he pogut llegir les versions: ' + e.message);
}

console.log('\n' + (problemes
  ? '❌ ' + problemes + ' cosa/es per arreglar'
  : '✅ el manual està bé'));
process.exit(problemes ? 1 : 0);
