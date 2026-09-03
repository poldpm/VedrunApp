/* ============================================================
   SEGUIMENT D'ENTREVISTES — segentrevistes.js
   ------------------------------------------------------------
   Per a direcció: de cada tutor, quantes entrevistes ha fet amb
   les famílies i quan, i quants alumnes encara no en tenen cap.
   D'aquí surten les dades quan els en demanen.

   NOMÉS a l'app de DIRECCIÓ, dins de l'apartat Docents.

   ⚠ QUÈ HI ARRIBA I QUÈ NO. Cada tutor desa al SEU full el que
   ha apuntat de com ha anat cada entrevista, i això no surt mai
   d'allà. Al full compartit hi va NOMÉS quantes n'ha fet i quan.
   Aquesta pantalla, doncs, diu qui en fa i qui no, però no deixa
   llegir res del que un tutor hagi escrit d'una família.

   Tot ve d'UNA sola crida (`resumEntrevistes`), que ho munta al
   servidor: fer-ho aquí serien 36 crides i una eternitat.
   ============================================================ */

let _segEntrGrups = [];        // [{ grup, actualitzat, alumnes:[{nom,quantes,ultima,dates}] }]
let _segEntrCarregat = false;
let _segEntrObert = null;      // quin grup té la llista d'alumnes desplegada
let _segEntrFiltre = 'tots';   // tots | pendents

/* ============================================================
   CÀRREGA
   ============================================================ */
async function initSeguimentEntrevistes() {
  if (typeof _rolDireccio === 'function' && !_rolDireccio()) return;
  renderSeguimentEntrevistes();
  if (_segEntrCarregat || !config.scriptUrl) return;
  await segEntrCarrega();
}

async function segEntrCarrega() {
  if (!config.scriptUrl) { _segEntrEstat('Encara no estàs connectat: ves a Configuració i enganxa la URL.', 'error'); return; }
  _segEntrEstat('Llegint els 18 grups… pot trigar uns segons.');
  try {
    const r = await appsScriptGet({ action: 'resumEntrevistes' });
    if (!r || !r.ok) throw new Error((r && r.error) || 'resposta buida');
    _segEntrGrups = r.grups || [];
    _segEntrCarregat = true;
    _segEntrEstat('');
  } catch (e) {
    _segEntrEstat('No s\'ha pogut llegir: ' + e.message + '. Clica Actualitzar per tornar-ho a provar.', 'error');
  }
  renderSeguimentEntrevistes();
}

async function segEntrActualitza() {
  _segEntrCarregat = false;
  await segEntrCarrega();
}

function _segEntrEstat(text, tipus) {
  const el = document.getElementById('segEntrEstat');
  if (!el) return;
  el.textContent = text || '';
  el.className = 'esm-estat' + (tipus ? ' is-' + tipus : '');
}

/* ============================================================
   ELS NÚMEROS
   ============================================================ */

// El resum d'un grup: alumnes, quants en tenen, quantes entrevistes…
function segEntrResumGrup(g) {
  const alumnes = g.alumnes || [];
  const amb = alumnes.filter(a => a.quantes > 0);
  let total = 0, ultima = '';
  alumnes.forEach(a => {
    total += a.quantes || 0;
    if (a.ultima && a.ultima > ultima) ultima = a.ultima;
  });
  const tutor = (typeof docentDelGrup === 'function') ? docentDelGrup(g.grup) : null;
  return {
    grup: g.grup,
    tutor: tutor ? tutor.nom : '',
    alumnes: alumnes.length,
    amb: amb.length,
    sense: alumnes.length - amb.length,
    total,
    ultima,
    // Quin tant per cent de la classe té almenys una entrevista
    pct: alumnes.length ? Math.round((amb.length / alumnes.length) * 100) : null,
  };
}

function segEntrTotals() {
  const rs = _segEntrGrups.map(segEntrResumGrup);
  const t = { alumnes: 0, amb: 0, sense: 0, entrevistes: 0, grupsSenseCap: 0, grupsBuits: 0 };
  rs.forEach(r => {
    if (!r.alumnes) { t.grupsBuits++; return; }
    t.alumnes += r.alumnes; t.amb += r.amb; t.sense += r.sense; t.entrevistes += r.total;
    if (r.total === 0) t.grupsSenseCap++;
  });
  t.pct = t.alumnes ? Math.round((t.amb / t.alumnes) * 100) : null;
  return t;
}

// "2026-10-14 17:30" → "14 oct."
const _SEGENTR_MESOS = ['gen.','febr.','març','abr.','maig','juny','jul.','ag.','set.','oct.','nov.','des.'];
function _segEntrData(iso) {
  const p = String(iso || '').split(' ')[0].split('-');
  if (p.length < 3) return '';
  return parseInt(p[2], 10) + ' ' + (_SEGENTR_MESOS[parseInt(p[1], 10) - 1] || '');
}

/* ============================================================
   LA PANTALLA
   ============================================================ */
function renderSeguimentEntrevistes() {
  _segEntrPintaPanell();
  _segEntrPintaTaula();
}

function _segEntrPintaPanell() {
  const cont = document.getElementById('segEntrPanell');
  if (!cont) return;
  if (!_segEntrGrups.length) { cont.innerHTML = ''; return; }
  const t = segEntrTotals();
  cont.innerHTML = `
    <div class="esm-xifres">
      <div class="esm-xifra"><span class="esm-xifra-num">${t.entrevistes}</span><span class="esm-xifra-txt">entrevistes fetes a tota la primària</span></div>
      <div class="esm-xifra"><span class="esm-xifra-num">${t.amb}</span><span class="esm-xifra-txt">alumnes amb entrevista, de ${t.alumnes}</span></div>
      <div class="esm-xifra esm-xifra-avis"><span class="esm-xifra-num">${t.sense}</span><span class="esm-xifra-txt">${t.sense === 1 ? 'alumne sense cap entrevista' : 'alumnes sense cap entrevista'}</span></div>
      <div class="esm-xifra"><span class="esm-xifra-num">${t.pct === null ? '—' : t.pct + '%'}</span><span class="esm-xifra-txt">de la primària amb entrevista</span></div>
      <div class="esm-xifra${t.grupsSenseCap ? ' esm-xifra-avis' : ''}"><span class="esm-xifra-num">${t.grupsSenseCap}</span><span class="esm-xifra-txt">${t.grupsSenseCap === 1 ? 'grup sense cap entrevista' : 'grups sense cap entrevista'}</span></div>
    </div>
    ${t.grupsBuits ? `<p class="modal-hint">${t.grupsBuits} ${t.grupsBuits === 1 ? 'grup no té' : 'grups no tenen'} cap alumne al full compartit: no compten enlloc.</p>` : ''}`;
}

function _segEntrPintaTaula() {
  const cont = document.getElementById('segEntrTaula');
  if (!cont) return;

  if (!_segEntrGrups.length) {
    cont.innerHTML = `<div class="esm-buit"><p><strong>Encara no hi ha res per ensenyar.</strong><br>Clica <strong>Actualitzar</strong> per llegir els 18 grups.</p></div>`;
    return;
  }

  let rs = _segEntrGrups.map(segEntrResumGrup);
  if (_segEntrFiltre === 'pendents') rs = rs.filter(r => r.sense > 0 || !r.alumnes);
  // Els que van més endarrerits, primer: és el que es ve a mirar.
  rs.sort((a, b) => {
    if (a.pct === null && b.pct === null) return a.grup.localeCompare(b.grup);
    if (a.pct === null) return 1;
    if (b.pct === null) return -1;
    if (a.pct !== b.pct) return a.pct - b.pct;
    return a.grup.localeCompare(b.grup);
  });

  if (!rs.length) {
    cont.innerHTML = `<div class="esm-buit"><p><strong>No hi ha cap grup pendent.</strong><br>Tots els alumnes de primària tenen com a mínim una entrevista.</p></div>`;
    return;
  }

  const files = rs.map(r => {
    const obert = _segEntrObert === r.grup;
    const pct = r.pct === null ? 0 : r.pct;
    const detall = obert ? _segEntrFilaDetall(r.grup) : '';
    return `<tr class="segentr-fila${obert ? ' es-obert' : ''}">
        <th scope="row" class="esm-t-nom">
          <button type="button" class="segentr-obre" aria-expanded="${obert}" onclick="segEntrObre('${r.grup}')">
            <span class="segentr-grup">${escapeHtml(r.grup)}</span>
            <span class="segentr-tutor">${escapeHtml(r.tutor || 'sense tutor al llistat')}</span>
          </button>
        </th>
        <td class="esm-t-mitjana">
          <span class="esm-barra"><span class="esm-barra-fill" style="width:${pct}%"></span></span>
          <span class="esm-barra-val">${r.pct === null ? '—' : r.pct + '%'}</span>
        </td>
        <td class="esm-t-num">${r.total}</td>
        <td class="esm-t-num">${r.alumnes ? (r.amb + ' de ' + r.alumnes) : '—'}</td>
        <td class="esm-t-gomets">${r.sense ? `<span class="segentr-pendents">${r.sense}</span>` : '<span class="esm-cap">cap</span>'}</td>
        <td class="esm-t-num">${r.ultima ? escapeHtml(_segEntrData(r.ultima)) : '—'}</td>
      </tr>${detall}`;
  }).join('');

  cont.innerHTML = `<div class="esm-taula-caixa"><table class="esm-taula segentr-taula">
    <caption class="esm-taula-cap">Els grups que van més endarrerits, primer. Clica un grup per veure alumne per alumne.</caption>
    <thead><tr>
      <th scope="col">Grup i tutor</th>
      <th scope="col">Alumnes amb entrevista</th>
      <th scope="col">Entrevistes</th>
      <th scope="col">Coberts</th>
      <th scope="col">Sense cap</th>
      <th scope="col">Última</th>
    </tr></thead>
    <tbody>${files}</tbody>
  </table></div>`;
}

// La fila desplegada: alumne per alumne.
function _segEntrFilaDetall(grup) {
  const g = _segEntrGrups.find(x => x.grup === grup);
  if (!g) return '';
  if (!g.alumnes.length) {
    return `<tr class="segentr-detall"><td colspan="6"><p class="modal-hint">Aquest grup no té cap alumne al full compartit de l'escola.</p></td></tr>`;
  }
  // Primer els que no en tenen cap: són els que es venen a buscar.
  const ordenats = g.alumnes.slice().sort((a, b) => (a.quantes - b.quantes) || a.nom.localeCompare(b.nom, 'ca'));
  const items = ordenats.map(a => {
    let quan;
    if (!a.quantes) quan = '<span class="segentr-cap">cap entrevista</span>';
    else if (a.dates && a.dates.length) quan = a.dates.map(d => `<span class="segentr-data">${escapeHtml(_segEntrData(d))}</span>`).join('');
    /* Els resums publicats abans de la v135 no porten totes les dates. Es
       diu clarament en comptes d'ensenyar un buit que semblaria un error:
       en tornaran a sortir quan el tutor desi qualsevol entrevista. */
    else quan = `<span class="segentr-data">${escapeHtml(_segEntrData(a.ultima))}</span><span class="segentr-nodates">(només se\'n sap l\'última)</span>`;
    return `<li class="segentr-alumne${a.quantes ? '' : ' es-sense'}">
      <span class="segentr-alumne-nom">${escapeHtml(a.nom)}</span>
      <span class="segentr-alumne-num">${a.quantes || 0}</span>
      <span class="segentr-alumne-dates">${quan}</span>
    </li>`;
  }).join('');
  return `<tr class="segentr-detall"><td colspan="6">
    <p class="segentr-detall-cap">${escapeHtml(grup)} · ${g.alumnes.length} alumnes${g.actualitzat ? ' · al dia del ' + escapeHtml(_segEntrData(g.actualitzat)) : ''}</p>
    <ul class="segentr-alumnes">${items}</ul>
  </td></tr>`;
}

function segEntrObre(grup) {
  _segEntrObert = (_segEntrObert === grup) ? null : grup;
  _segEntrPintaTaula();
}

function segEntrFiltra(clau) {
  _segEntrFiltre = clau;
  const cont = document.getElementById('segEntrFiltres');
  if (cont) {
    [...cont.querySelectorAll('.doc-filtre')].forEach(b => {
      const seu = b.dataset.filtre === clau;
      b.classList.toggle('active', seu);
      b.setAttribute('aria-pressed', seu);
    });
  }
  _segEntrPintaTaula();
}

/* El resum sencer en text, per enganxar-lo on calgui.
   Es copia al porta-retalls: no es descarrega res, que al mòbil és un embolic. */
function segEntrCopia() {
  if (!_segEntrGrups.length) return;
  const t = segEntrTotals();
  const linies = [
    'ENTREVISTES AMB LES FAMÍLIES — primària',
    'Entrevistes fetes: ' + t.entrevistes,
    'Alumnes amb entrevista: ' + t.amb + ' de ' + t.alumnes + (t.pct === null ? '' : ' (' + t.pct + '%)'),
    'Alumnes sense cap entrevista: ' + t.sense,
    '',
    'Grup\tTutor\tAlumnes\tAmb entrevista\tSense cap\tEntrevistes',
  ];
  _segEntrGrups.map(segEntrResumGrup)
    .sort((a, b) => a.grup.localeCompare(b.grup))
    .forEach(r => {
      linies.push([r.grup, r.tutor, r.alumnes, r.amb, r.sense, r.total].join('\t'));
    });
  const text = linies.join('\n');
  const fet = () => _segEntrEstat('Copiat. Ja el pots enganxar on el necessitis.', 'ok');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(fet, () => _segEntrEstat('No s\'ha pogut copiar.', 'error'));
  } else {
    _segEntrEstat('Aquest navegador no deixa copiar sol.', 'error');
  }
}
