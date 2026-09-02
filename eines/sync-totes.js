#!/usr/bin/env node
/* ============================================================
   ACTUALITZAR TOTES LES APPS DE COP
   ------------------------------------------------------------
   Llegeix `filles.json` (el registre de totes les mestres) i porta
   l'arranjament o l'eina nova a totes les seves apps amb UNA ordre.

   ÚS:
     node eines/sync-totes.js --prova      (ensenya què faria, sense tocar res)
     node eines/sync-totes.js              (ho fa)
     node eines/sync-totes.js --mestra Anna   (només una)

   Cada app conserva el que és seu (el seu personal.js, el seu rol i el seu token).
   ============================================================ */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const MARE = path.resolve(__dirname, '..');
const REGISTRE = path.join(MARE, 'filles.json');
const nomesProva = process.argv.includes('--prova');
const iMestra = process.argv.indexOf('--mestra');
const nomesUna = iMestra !== -1 ? (process.argv[iMestra + 1] || '').toLowerCase() : null;

if (!fs.existsSync(REGISTRE)) {
  console.error('No hi ha filles.json. Crea el registre de mestres primer.');
  process.exit(1);
}

let filles;
try { filles = JSON.parse(fs.readFileSync(REGISTRE, 'utf8')).filles || []; }
catch (e) { console.error('filles.json no es pot llegir: ' + e.message); process.exit(1); }

if (nomesUna) filles = filles.filter(f => (f.mestra || '').toLowerCase() === nomesUna);
if (!filles.length) { console.error('Cap app per actualitzar.'); process.exit(1); }

let versioMare = '?';
try {
  const m = fs.readFileSync(path.join(MARE, 'sw.js'), 'utf8').match(/vedruna-v\d+/);
  if (m) versioMare = m[0].replace('vedruna-', '');
} catch (e) {}

console.log('APP MARE: ' + versioMare + '\n');
console.log(nomesProva ? '*** PROVA: no es tocarà res ***\n' : '');

const be = [], malament = [], saltades = [];

for (const f of filles) {
  const carpeta = f.carpeta;
  console.log('──────────────────────────────────────────');
  console.log(f.mestra + '  →  ' + carpeta);
  if (!carpeta || !fs.existsSync(carpeta)) {
    console.log('  NO TROBADA. Es salta.');
    saltades.push(f.mestra);
    continue;
  }
  try {
    const args = [path.join(__dirname, 'sync-filla.js'), carpeta];
    if (nomesProva) args.push('--prova');
    const sortida = execFileSync(process.execPath, args, { encoding: 'utf8' });
    // Resum curt: només les línies que importen
    sortida.split('\n').forEach(l => {
      if (/^(AFEGITS|ACTUALITZATS|RESPECTATS|Ja eren iguals|Fet\.)/.test(l.trim())) {
        console.log('  ' + l.trim());
      }
    });
    be.push(f.mestra);
  } catch (e) {
    console.log('  HA FALLAT: ' + (e.message || e));
    malament.push(f.mestra);
  }
}

console.log('\n══════════════════════════════════════════');
console.log('Actualitzades: ' + (be.length ? be.join(', ') : 'cap'));
if (saltades.length)  console.log('No trobades:   ' + saltades.join(', '));
if (malament.length)  console.log('Han fallat:    ' + malament.join(', '));

if (!nomesProva && be.length) {
  console.log('\nSegüent pas: provar cada app i pujar-la al seu GitHub.');
  console.log('Les mestres veuran l\'avís de versió nova i s\'actualitzaran soles.');
}
