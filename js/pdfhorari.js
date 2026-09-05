/* ============================================================
   EL PDF DE L'HORARI DE L'ESCOLA → LA GRAELLA DE L'APP
   ------------------------------------------------------------
   En Pol, 5/9/2026: «els horaris ens els han passat amb aquest PDF. Ara
   et fa escriure un per un els dies i assignatures… serà molt més fàcil
   adjuntar el PDF i que l'horari s'ompli sol».

   Es llegeix AQUÍ, al navegador. No puja enlloc: són horaris de mestres i
   no hi ha cap motiu perquè viatgin, i a més així va instantani i funciona
   sense connexió.

   Com està fet el PDF de l'escola (mirat als 36 horaris del curs 26-27):
   · Una pàgina per mestra, amb el seu nom i, si en té, «Tutoria 2n C».
   · Columnes Dilluns…Divendres i, a l'esquerra, l'hora de cada fila:
     8:50, 9:45, 10:40, 11:10, 12:00, 12:50, 14:50, 15:50 — exactament les
     vuit franges de l'app.
   · El text va en fonts Type0: cada lletra són DOS bytes que no volen dir
     res fins que es passen pel mapa «ToUnicode» de la font. Sense això surt
     un garbuix, i és la meitat de la feina d'aquest fitxer.

   ⚠ Les ratlles de la graella també hi són, però van en un sistema de
   coordenades diferent del text (el PDF hi aplica una transformació pel
   mig). Barrejar-les donava columnes mogudes, o sigui que aquí les files i
   les columnes surten NOMÉS de la posició del text: les hores de
   l'esquerra manen les files, i els noms dels dies, les columnes.
   ============================================================ */

const PDFH_DIES = ['Dilluns', 'Dimarts', 'Dimecres', 'Dijous', 'Divendres'];
const PDFH_IDS  = ['dl', 'dm', 'dc', 'dj', 'dv'];

/* Les hores tal com surten al PDF, i la franja de l'app que els toca. */
const PDFH_HORES = [
  ['8:50', 'f1'], ['9:45', 'f2'], ['10:40', 'f3'], ['11:10', 'f4'],
  ['12:00', 'f5'], ['12:50', 'f6'], ['14:50', 'f7'], ['15:50', 'f8'],
];

/* Caselles que no són cap assignatura: no s'importen. */
const PDFH_FORA = /^(ESBARJO|DINAR|PATI)$/i;

/* El PACBAL és una banda pròpia del PDF, entre les 8:50 i les 9:45, que
   l'app no té. En Pol (5/9/2026) va triar que ocupi la franja de les 9:45
   i que hi mani: si a la casella hi cau el PACBAL i una assignatura, hi
   queda el PACBAL sol. */
const PDFH_MANA = /PACBAL/i;

/* ---------- 1) Descomprimir ---------- */

/* Els fluxos del PDF van comprimits. Al navegador ho fa
   DecompressionStream, que ja hi és a tots els navegadors moderns i no
   demana cap llibreria. */
async function _pdfhInfla(bytes) {
  for (const format of ['deflate', 'deflate-raw']) {
    try {
      const ds = new DecompressionStream(format);
      const flux = new Blob([bytes]).stream().pipeThrough(ds);
      const buf = await new Response(flux).arrayBuffer();
      return new Uint8Array(buf);
    } catch (e) { /* prova l'altre */ }
  }
  return null;
}

function _pdfhLatin1(u8) {
  let s = '';
  for (let i = 0; i < u8.length; i += 8192) {
    s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192));
  }
  return s;
}

/* ---------- 2) Els objectes del PDF ---------- */

async function _pdfhObjectes(u8) {
  const lat = _pdfhLatin1(u8);
  const objs = {};
  const re = /(\d+)\s+(\d+)\s+obj\b/g;
  let m;
  while ((m = re.exec(lat)) !== null) {
    const ini = m.index + m[0].length;
    const fi = lat.indexOf('endobj', ini);
    objs[m[1]] = { cap: lat.slice(ini, Math.min(fi < 0 ? lat.length : fi, ini + 900)),
                   ini: ini, fi: fi < 0 ? lat.length : fi };
  }
  const cau = {};
  async function flux(num) {
    if (cau[num] !== undefined) return cau[num];
    const o = objs[num];
    if (!o) return (cau[num] = null);
    const s = lat.indexOf('stream', o.ini);
    if (s < 0 || s > o.fi) return (cau[num] = null);
    let p = s + 6;
    if (u8[p] === 13) p++;
    if (u8[p] === 10) p++;
    let e = lat.indexOf('endstream', p);
    /* ⚠ Entre les dades i "endstream" hi sol haver un salt de línia. El zlib
       de tota la vida se'l menja; el DecompressionStream del navegador NO:
       peta amb «junk after compressed data» i el PDF sembla il·legible.
       Costa de trobar perquè l'error no diu res d'això. */
    while (e > p && (u8[e - 1] === 10 || u8[e - 1] === 13)) e--;
    const cru = u8.subarray(p, e);
    const dins = /FlateDecode/.test(o.cap) ? await _pdfhInfla(cru) : cru;
    return (cau[num] = dins ? _pdfhLatin1(dins) : null);
  }
  return { lat: lat, objs: objs, flux: flux };
}

/* ---------- 3) El mapa de lletres de cada font ---------- */

function _pdfhCmap(txt, dins) {
  let r;
  const reChar = /beginbfchar([\s\S]*?)endbfchar/g;
  while ((r = reChar.exec(txt)) !== null) {
    (r[1].match(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g) || []).forEach(function (p) {
      const q = p.match(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/);
      const k = parseInt(q[1], 16);
      if (dins[k] === undefined) dins[k] = String.fromCharCode(parseInt(q[2].slice(0, 4), 16));
    });
  }
  const reRange = /beginbfrange([\s\S]*?)endbfrange/g;
  while ((r = reRange.exec(txt)) !== null) {
    r[1].split('\n').forEach(function (l) {
      const q = l.match(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/);
      if (!q) return;
      const a = parseInt(q[1], 16), b = parseInt(q[2], 16), c = parseInt(q[3].slice(0, 4), 16);
      for (let i = a; i <= b && i - a < 5000; i++) {
        if (dins[i] === undefined) dins[i] = String.fromCharCode(c + (i - a));
      }
    });
  }
  return dins;
}

/* ---------- 4) El text d'una pàgina, amb la seva posició ---------- */

function _pdfhTrossos(contingut, mapa) {
  const net = contingut.replace(/\n/g, ' ');
  const desEsc = function (s) {
    return s.replace(/\\([0-7]{1,3})/g, function (_, o) { return String.fromCharCode(parseInt(o, 8)); })
            .replace(/\\([()\\])/g, '$1');
  };
  const descodifica = function (s) {
    let o = '';
    for (let i = 0; i + 1 < s.length; i += 2) {
      const c = (s.charCodeAt(i) << 8) | s.charCodeAt(i + 1);
      if (mapa[c] !== undefined) o += mapa[c];
    }
    return o;
  };
  const trossos = [];
  let x = 0, y = 0;
  const re = /(?:([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+Tm)|(?:\(((?:\\.|[^\\()])*)\)\s*Tj)|(?:\[([\s\S]*?)\]\s*TJ)/g;
  let t;
  while ((t = re.exec(net)) !== null) {
    if (t[1] !== undefined) { x = parseFloat(t[5]); y = parseFloat(t[6]); continue; }
    let brut = '';
    if (t[7] !== undefined) brut = desEsc(t[7]);
    else if (t[8] !== undefined) {
      (t[8].match(/\((?:\\.|[^\\()])*\)/g) || []).forEach(function (p) { brut += desEsc(p.slice(1, -1)); });
    }
    const s = descodifica(brut);
    if (s.trim()) trossos.push({ x: x, y: y, txt: s });
  }
  return trossos;
}

/* ---------- 5) De trossos a graella ---------- */

/* Aquesta part no toca cap PDF: rep una llista de {x, y, text} i en treu
   l'horari. Es pot provar sola, i és el que fa el banc de proves. */
function pdfHorariGraella(trossos) {
  /* Columnes: on comença el nom de cada dia. */
  const colX = {};
  PDFH_DIES.forEach(function (d, i) {
    const q = trossos.filter(function (t) { return t.txt.trim() === d; })[0];
    if (q) colX[PDFH_IDS[i]] = q.x;
  });
  const ids = PDFH_IDS.filter(function (id) { return colX[id] !== undefined; });
  if (ids.length < 2) return null;
  /* Amplada d'una columna: la distància entre dos dies seguits. */
  const xs = ids.map(function (id) { return colX[id]; }).sort(function (a, b) { return a - b; });
  const ample = xs.length > 1 ? (xs[xs.length - 1] - xs[0]) / (xs.length - 1) : 140;

  /* Files: la y de cada hora de l'esquerra. */
  const files = [];
  PDFH_HORES.forEach(function (par) {
    const q = trossos.filter(function (t) {
      return t.txt.replace(/\s/g, '') === par[0] && t.x < xs[0] - 10;
    })[0];
    if (q) files.push({ y: q.y, fid: par[1] });
  });
  if (files.length < 4) return null;
  files.sort(function (a, b) { return a.y - b.y; });

  /* La banda de cada franja. Comença una mica per sobre de l'etiqueta
     —el text de la fila i la seva hora van pràcticament a la mateixa
     alçada— i acaba on comença la següent. */
  const MARGE = 20;
  files.forEach(function (f, i) {
    f.dalt = f.y - MARGE;
    f.baix = (i + 1 < files.length) ? files[i + 1].y - MARGE : f.y + 60;
  });

  const cel = {};
  trossos.forEach(function (t) {
    const s = t.txt.trim();
    if (!s) return;
    if (PDFH_DIES.indexOf(s) !== -1) return;
    if (/^\d{1,2}:\d{2}$/.test(s.replace(/\s/g, ''))) return;
    if (PDFH_FORA.test(s)) return;

    /* ⚠ El dia és el títol MÉS PROPER, no pas «el títol que queda a
       l'esquerra». El text de les caselles va centrat i el dels títols
       també, o sigui que on comença cadascun depèn de com de llarg és:
       «P» comença 21 punts més a la dreta que «Dilluns» i «Llengua
       castellana» 38 més a l'esquerra que «Dijous». Mesurant per l'esquerra
       les caselles queien un dia més enllà. */
    let dia = null, millor = 1e9;
    ids.forEach(function (id) {
      const d = Math.abs(t.x - colX[id]);
      if (d < millor && d < ample * 0.62) { millor = d; dia = id; }
    });
    if (!dia) return;

    const f = files.filter(function (f) { return t.y >= f.dalt && t.y < f.baix; })[0];
    if (!f) return;

    const k = dia + '_' + f.fid;
    /* Una casella pot portar dues línies ("Coneixement del" + "medi", o
       "Ed. Artística" + "Tallers 3r"): s'ajunten. */
    cel[k] = cel[k] ? cel[k] + ' ' + s : s;
  });

  Object.keys(cel).forEach(function (k) {
    let v = cel[k].replace(/\s+/g, ' ').trim();
    /* El PACBAL mana a la seva casella (ho va decidir en Pol): si hi cau
       amb una assignatura, hi queda ell sol. */
    if (PDFH_MANA.test(v)) v = 'PACBAL';
    cel[k] = v;
  });

  /* Qui és: el nom va en majúscules, i la tutoria comença per "Tutoria". */
  const nom = (trossos.filter(function (t) {
    const s = t.txt.trim();
    return /^[A-ZÀ-ÖØ-Þ'· -]{8,}$/.test(s) && s.split(/\s+/).length >= 2 && !/^(DILLUNS|ESBARJO|DINAR)/.test(s);
  })[0] || {}).txt || '';
  const tut = (trossos.filter(function (t) { return /^Tutoria\b/.test(t.txt.trim()); })[0] || {}).txt || '';

  return { nom: nom.trim(), tutoria: tut.trim(), cel: cel };
}

/* ---------- 6) La porta d'entrada ---------- */

/* Rep el PDF (ArrayBuffer) i torna una pàgina per mestra. El fitxer que
   passa l'escola les porta totes; si algú n'adjunta un de retallat, en
   tindrà una i prou. */
async function pdfHorariLlegeix(arrayBuffer) {
  const u8 = new Uint8Array(arrayBuffer);
  if (_pdfhLatin1(u8.subarray(0, 5)) !== '%PDF-') {
    throw new Error('Això no sembla un PDF.');
  }
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('Aquest navegador no pot obrir el PDF. Prova amb el Chrome o l\'Edge.');
  }
  const doc = await _pdfhObjectes(u8);

  /* Un mapa de lletres per a tot el document: aquests PDFs fan servir les
     mateixes fonts a totes les pàgines i els codis no es trepitgen. */
  const mapa = {};
  const reTU = /\/ToUnicode\s+(\d+)\s+\d+\s+R/g;
  let m;
  const vistos = {};
  while ((m = reTU.exec(doc.lat)) !== null) {
    if (vistos[m[1]]) continue;
    vistos[m[1]] = 1;
    const f = await doc.flux(m[1]);
    if (f) _pdfhCmap(f, mapa);
  }

  /* Les pàgines, en ordre. */
  const pagines = [];
  const nums = Object.keys(doc.objs);
  for (const n of nums) {
    const cap = doc.objs[n].cap;
    if (!/\/Type\s*\/Page[^s]/.test(cap)) continue;
    const c = cap.match(/\/Contents\s+(\d+)\s+\d+\s+R/);
    if (!c) continue;
    const cont = await doc.flux(c[1]);
    if (!cont || !/T[jJ]/.test(cont)) continue;
    const g = pdfHorariGraella(_pdfhTrossos(cont, mapa));
    if (g && Object.keys(g.cel).length) pagines.push(g);
  }

  /* Si el PDF no declara les pàgines com esperem, es prova amb tots els
     fluxos que portin text: val més ensenyar-ne una que rendir-se. */
  if (!pagines.length) {
    for (const n of nums) {
      const cont = await doc.flux(n);
      if (!cont || !/T[jJ]/.test(cont) || cont.length > 400000) continue;
      const g = pdfHorariGraella(_pdfhTrossos(cont, mapa));
      if (g && Object.keys(g.cel).length) { pagines.push(g); break; }
    }
  }
  if (!pagines.length) throw new Error('No he trobat cap horari dins d\'aquest PDF.');
  return { pagines: pagines };
}
