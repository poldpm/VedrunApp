#!/usr/bin/env node
/* ============================================================
   COMPROVA QUE CAP CONTROL DE L'APP NO FACI RES
   ------------------------------------------------------------
   Ús:  node eines/comprova-controls.js
   Torna codi 1 si troba cap control mort.
   ------------------------------------------------------------
   El forat que va deixar passar el bug del Google Tasks: jo
   comprovava que cada handler cridés una funció EXISTENT. Un
   handler buit, o que només fa stopPropagation, passava la
   comprovació precisament perquè no cridava res.

   Això busca handlers SENSE EFECTE, a l'HTML i també als que
   es generen dins de plantilles de JS (que és on era el bug). */
const fs = require('fs');
const path = require('path');
const D = path.resolve(__dirname, '..');

/* Un cos de handler que no fa res útil */
function senseEfecte(codi) {
  let c = String(codi || '')
    .replace(/event\.stopPropagation\(\s*\)/g, '')
    .replace(/event\.preventDefault\(\s*\)/g, '')
    .replace(/\bthis\.select\(\s*\)/g, 'X')   // això sí que fa una cosa
    .replace(/return\s+false/g, '')
    .replace(/[\s;]/g, '');
  return c === '';
}

const trobats = [];

/* --- 1. atributs on* de l'HTML --- */
const html = fs.readFileSync(path.join(D, 'index.html'), 'utf8');
const linies = html.split('\n');
linies.forEach((l, i) => {
  for (const m of l.matchAll(/\son(click|change|input|submit|keydown|mousedown)\s*=\s*"([^"]*)"/gi)) {
    if (senseEfecte(m[2])) {
      trobats.push({ f: 'index.html', n: i + 1, tipus: 'atribut buit', codi: m[2], ctx: l.trim().slice(0, 90) });
    }
  }
});

/* --- 2. handlers dins de plantilles de JS (`...${...}...`) --- */
const jsFitxers = fs.readdirSync(path.join(D, 'js')).filter(f => f.endsWith('.js') && f !== 'config.local.js');
jsFitxers.forEach(f => {
  const src = fs.readFileSync(path.join(D, 'js', f), 'utf8');
  const ls = src.split('\n');

  ls.forEach((l, i) => {
    /* 2a. onclick="..." dins d'una cadena, amb el cos buit o només stopPropagation.
           Als enllaços (<a href="...">) el stopPropagation SÍ que hi fa
           falta: la feina la fa l'href, i només s'evita que el clic
           arribi al contenidor. Això no és un control mort. */
    for (const m of l.matchAll(/onclick=\\?["']([^"'`]*)\\?["']/g)) {
      if (!senseEfecte(m[1])) continue;
      const abans = l.slice(0, m.index);
      const esEnllac = /<a[^>]*$/i.test(abans) && /href=/i.test(abans);
      if (esEnllac) continue;
      trobats.push({ f: 'js/' + f, n: i + 1, tipus: 'onclick buit dins JS', codi: m[1], ctx: l.trim().slice(0, 90) });
    }

    /* 2b. El patró EXACTE del bug: una variable que val '' i que després
           s'enganxa dins d'un onclick. Ex:
             const checkClick = isGoogle ? '' : `toggleTasca(...)`;
             ... onclick="...;${checkClick}" */
    const v = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*[^;]*\?\s*''\s*:/.exec(l);
    if (v) {
      const nom = v[1];
      // s'utilitza dins d'un onclick en aquest fitxer?
      if (new RegExp('onclick=[^\\n]*\\$\\{' + nom + '\\}').test(src)) {
        trobats.push({ f: 'js/' + f, n: i + 1, tipus: 'VARIABLE BUIDA dins un onclick', codi: nom, ctx: l.trim().slice(0, 100) });
      }
    }
    /* 2c. el mateix, però amb la buida a l'altra banda del ternari */
    const v2 = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*[^;]*\?\s*[`'"][^`'"]+[`'"]\s*:\s*''\s*;/.exec(l);
    if (v2) {
      const nom = v2[1];
      if (new RegExp('onclick=[^\\n]*\\$\\{' + nom + '\\}').test(src)) {
        trobats.push({ f: 'js/' + f, n: i + 1, tipus: 'VARIABLE BUIDA dins un onclick', codi: nom, ctx: l.trim().slice(0, 100) });
      }
    }
  });

  /* --- 3. botons amb title/aria-label que prometen una acció i cap handler --- */
  for (const m of src.matchAll(/<button([^>]{0,300}?)>/g)) {
    const at = m[1];
    if (/onclick|addEventListener/.test(at)) continue;
    const t = /(?:title|aria-label)=\\?["']([^"'`]{3,60})\\?["']/.exec(at);
    if (t && /marcar|esborr|elimin|desa|afeg|obrir|copiar|generar|reserv|tanca/i.test(t[1])) {
      // pot ser que li posin el handler després amb addEventListener: només ho apuntem
      trobats.push({ f: 'js/' + f, n: 0, tipus: 'botó sense onclick (revisar)', codi: t[1], ctx: m[0].slice(0, 90) });
    }
  }
});

console.log('AUDITORIA 5 — CONTROLS QUE NO FAN RES');
console.log('=====================================\n');

const greus = trobats.filter(t => /VARIABLE BUIDA|atribut buit|onclick buit/.test(t.tipus));
const revisar = trobats.filter(t => !greus.includes(t));

if (greus.length) {
  console.log('❌ ' + greus.length + ' CONTROL(S) QUE NO FAN RES:\n');
  greus.forEach(t => {
    console.log('   ' + t.f + (t.n ? ':' + t.n : '') + '  [' + t.tipus + ']');
    console.log('      ' + t.ctx);
    console.log('');
  });
} else {
  console.log('✅ cap handler buit ni cap variable buida enganxada a un onclick');
}

if (revisar.length) {
  console.log('\n⚠ ' + revisar.length + ' botó/ns sense onclick al mateix lloc (poden tenir addEventListener):');
  revisar.slice(0, 12).forEach(t => console.log('   ' + t.f + ' · "' + t.codi + '" · ' + t.ctx));
}

process.exit(greus.length ? 1 : 0);
