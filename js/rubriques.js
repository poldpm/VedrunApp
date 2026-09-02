/* ============================================================
   OBJECTIUS DEL GENERADOR DE COMENTARIS  +  ASPECTES D'ACTITUD
   ------------------------------------------------------------
   Abans estaven escrits dins del codi, o sigui que eren els d'un sol
   mestre. Ara cada mestre es defineix els seus des de l'app i es desen
   al SEU full de càlcul.

   Els objectius es poden escriure un a un, però sobretot es poden
   IMPORTAR d'un document (enganxant una taula del Word o del full de
   càlcul, o pujant un fitxer): un mestre ja els té escrits i tornar-los
   a picar a mà seria inviable.

   Format d'importació: una fila per objectiu, amb 5 columnes
     Objectiu · Molt ben assolit · Assolit · Assolit amb ajuda · No assolit
   ============================================================ */
(function () {
  'use strict';

  var NIVELLS_NOM = ['Molt ben assolit', 'Assolit', 'Assolit amb ajuda', 'No assolit'];

  /* ================= MAGATZEM ================= */

  function clauLocal(mat) { return 'rubrica_' + mat; }

  function llegeixLocal(mat) {
    try { return JSON.parse(localStorage.getItem(clauLocal(mat)) || 'null'); }
    catch (e) { return null; }
  }
  function desaLocal(mat, dades) {
    try { localStorage.setItem(clauLocal(mat), JSON.stringify(dades)); } catch (e) {}
  }

  // Posa els objectius del mestre dins de RUBRIQUES perquè la resta de
  // l'app (que ja el feia servir) funcioni sense canviar res.
  function aplica(mat, dades) {
    if (typeof RUBRIQUES === 'undefined') return;
    var nom = (typeof MATERIES !== 'undefined' && MATERIES[mat]) ||
              (RUBRIQUES[mat] && RUBRIQUES[mat].nom) || mat;
    RUBRIQUES[mat] = { nom: nom, objectius: (dades && dades.objectius) || [] };
  }

  function objectius(mat) {
    var d = llegeixLocal(mat);
    return (d && d.objectius) || [];
  }

  function desa(mat, llista) {
    var dades = { objectius: llista || [] };
    desaLocal(mat, dades);
    aplica(mat, dades);
    if (typeof config !== 'undefined' && config.scriptUrl && typeof appsScriptPost === 'function') {
      appsScriptPost({ action: 'saveRubrica', materia: mat, data: dades })
        .catch(function () {
          if (typeof showToast === 'function') showToast('Els objectius es desaran quan tornis a tenir connexió', 'info');
        });
    }
  }

  // Carrega del full (una sola vegada per assignatura i sessió)
  var carregades = {};
  async function carrega(mat) {
    if (!mat) return;
    var local = llegeixLocal(mat);
    if (local) aplica(mat, local); else aplica(mat, { objectius: [] });
    if (carregades[mat]) return;
    if (typeof config === 'undefined' || !config.scriptUrl) return;
    carregades[mat] = true;
    try {
      var r = await appsScriptGet({ action: 'loadRubrica', materia: mat });
      if (r && r.ok && r.data) {
        desaLocal(mat, r.data);
        aplica(mat, r.data);
        if (typeof renderComentRubrica === 'function') { try { renderComentRubrica(); } catch (e) {} }
      }
    } catch (e) { /* silenciós: ja tenim el que hi ha en local */ }
  }

  /* ================= IMPORTAR D'UN DOCUMENT ================= */

  // Parteix una línia respectant les cometes ("text; amb separador dins")
  function parteix(linia, sep) {
    var out = [], actual = '', dinsCometes = false;
    for (var i = 0; i < linia.length; i++) {
      var c = linia.charAt(i);
      if (c === '"') {
        if (dinsCometes && linia.charAt(i + 1) === '"') { actual += '"'; i++; }
        else dinsCometes = !dinsCometes;
      } else if (c === sep && !dinsCometes) { out.push(actual); actual = ''; }
      else actual += c;
    }
    out.push(actual);
    return out;
  }

  function detectaSeparador(linia) {
    if (linia.indexOf('\t') !== -1) return '\t';
    var pc = (linia.match(/;/g) || []).length;
    var co = (linia.match(/,/g) || []).length;
    if (pc >= 3 && pc >= co) return ';';
    if (co >= 3) return ',';
    return '\t';
  }

  function semblaCapcalera(cols) {
    var t = cols.join(' ').toLowerCase();
    return /objectiu|criteri|molt ben assolit|no assolit|assolit amb ajuda/.test(t) &&
           !/\.\s*$/.test(cols[0] || '');
  }

  // Text -> [{nom, nivells:[4]}]. Torna també els avisos per ensenyar-los.
  function interpreta(text) {
    var linies = String(text || '').split(/\r?\n/).filter(function (l) { return l.trim() !== ''; });
    if (!linies.length) return { objectius: [], avisos: ['El document és buit.'] };

    var sep = detectaSeparador(linies[0]);
    var files = linies.map(function (l) { return parteix(l, sep); });
    if (files.length && semblaCapcalera(files[0])) files.shift();

    var res = [], avisos = [], senseCriteris = 0;
    files.forEach(function (f, i) {
      var nom = (f[0] || '').trim();
      if (!nom) return;
      var nivells = [1, 2, 3, 4].map(function (k) { return (f[k] || '').trim(); });
      if (!nivells.some(function (x) { return x; })) senseCriteris++;
      res.push({ id: 'o' + Date.now() + '_' + i, nom: nom, nivells: nivells });
    });

    if (!res.length) {
      avisos.push('No s\'ha trobat cap objectiu. Comprova que hi hagi una fila per objectiu.');
    } else {
      if (sep === '\t') avisos.push('Detectades columnes separades per tabulador (taula del Word o full de càlcul).');
      else avisos.push('Detectades columnes separades per "' + sep + '".');
      if (senseCriteris) {
        avisos.push(senseCriteris + ' objectiu' + (senseCriteris > 1 ? 's' : '') +
          ' sense cap criteri. Els podràs escriure després, però el comentari els necessita.');
      }
    }
    return { objectius: res, avisos: avisos };
  }

  /* ================= INTERFÍCIE ================= */

  var matActual = null, esborrany = [];

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (m) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[m];
    });
  }

  function obreEditor(mat) {
    matActual = mat || (typeof _comentAssig !== 'undefined' ? _comentAssig : null);
    if (!matActual) return;
    esborrany = JSON.parse(JSON.stringify(objectius(matActual)));
    construeix();
    pintaLlista();
    document.getElementById('rubOverlay').classList.add('open');
  }
  function tanca() {
    var o = document.getElementById('rubOverlay');
    if (o) o.classList.remove('open');
  }

  function nomMateria(mat) {
    return (typeof MATERIES !== 'undefined' && MATERIES[mat]) || mat;
  }

  function construeix() {
    if (document.getElementById('rubOverlay')) {
      document.getElementById('rubTitolMat').textContent = nomMateria(matActual);
      return;
    }
    var ov = el('div', 'modal-overlay');
    ov.id = 'rubOverlay';
    ov.addEventListener('mousedown', function (e) { if (e.target === ov) tanca(); });

    var modal = el('div', 'modal rub-modal');
    modal.innerHTML =
      '<div class="modal-header">' +
        '<div><div class="modal-header-title">Objectius d\'avaluació</div>' +
        '<div class="modal-header-sub" id="rubTitolMat"></div></div>' +
        '<button class="modal-close" id="rubTancar" aria-label="Tancar">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button>' +
      '</div>' +
      '<div class="modal-body" id="rubBody"></div>' +
      '<div class="modal-footer">' +
        '<button class="btn btn-ghost" id="rubImportar">Importar d\'un document</button>' +
        '<button class="btn btn-secondary" id="rubAfegir">+ Afegir objectiu</button>' +
        '<button class="btn btn-primary" id="rubDesar">Desar</button>' +
      '</div>';
    ov.appendChild(modal);
    document.body.appendChild(ov);

    document.getElementById('rubTancar').addEventListener('click', tanca);
    document.getElementById('rubAfegir').addEventListener('click', function () {
      esborrany.push({ id: 'o' + Date.now(), nom: '', nivells: ['', '', '', ''] });
      pintaLlista();
      var caixes = document.querySelectorAll('#rubBody .rub-obj');
      if (caixes.length) caixes[caixes.length - 1].scrollIntoView({ block: 'nearest' });
    });
    document.getElementById('rubDesar').addEventListener('click', desarEditor);
    document.getElementById('rubImportar').addEventListener('click', obreImport);
    document.getElementById('rubTitolMat').textContent = nomMateria(matActual);
  }

  function pintaLlista() {
    var body = document.getElementById('rubBody');
    if (!body) return;
    if (!esborrany.length) {
      body.innerHTML =
        '<div class="rub-buit">' +
          '<p><strong>Encara no has definit cap objectiu per a ' + esc(nomMateria(matActual)) + '.</strong></p>' +
          '<p>Si ja els tens escrits en un document, la manera ràpida és ' +
          '<strong>Importar d\'un document</strong>. Si no, afegeix-los un a un.</p>' +
        '</div>';
      return;
    }
    body.innerHTML = '';
    esborrany.forEach(function (o, idx) {
      var caixa = el('div', 'rub-obj');
      caixa.innerHTML =
        '<div class="rub-obj-cap">' +
          '<span class="rub-obj-num">' + (idx + 1) + '</span>' +
          '<input class="modal-input rub-obj-nom" placeholder="Nom de l\'objectiu" value="' + esc(o.nom) + '">' +
          '<button class="rub-obj-del" title="Eliminar aquest objectiu">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>' +
          '</button>' +
        '</div>' +
        NIVELLS_NOM.map(function (n, j) {
          return '<div class="rub-niv">' +
            '<div class="rub-niv-nom">' + n + '</div>' +
            '<textarea class="modal-input rub-niv-txt" rows="2" placeholder="Què escriu el comentari quan aquest objectiu està ' +
              n.toLowerCase() + '">' + esc(o.nivells[j] || '') + '</textarea>' +
          '</div>';
        }).join('');
      caixa.querySelector('.rub-obj-nom').addEventListener('input', function () { o.nom = this.value; });
      caixa.querySelectorAll('.rub-niv-txt').forEach(function (t, j) {
        t.addEventListener('input', function () { o.nivells[j] = this.value; });
      });
      caixa.querySelector('.rub-obj-del').addEventListener('click', function () {
        if (!confirm('Eliminar l\'objectiu "' + (o.nom || 'sense nom') + '"?')) return;
        esborrany.splice(idx, 1); pintaLlista();
      });
      body.appendChild(caixa);
    });
  }

  function desarEditor() {
    var nets = esborrany.filter(function (o) { return (o.nom || '').trim(); })
      .map(function (o) {
        return { id: o.id, nom: o.nom.trim(), nivells: (o.nivells || []).map(function (x) { return (x || '').trim(); }) };
      });
    desa(matActual, nets);
    tanca();
    if (typeof renderComentRubrica === 'function') { try { renderComentRubrica(); } catch (e) {} }
    if (typeof showToast === 'function') {
      showToast(nets.length ? ('Objectius desats (' + nets.length + ') ✓') : 'Objectius buidats', 'success');
    }
  }

  /* ---- Finestra d'importació ---- */
  function obreImport() {
    var ov = document.getElementById('rubImpOverlay');
    if (!ov) {
      ov = el('div', 'modal-overlay');
      ov.id = 'rubImpOverlay';
      ov.addEventListener('mousedown', function (e) { if (e.target === ov) ov.classList.remove('open'); });
      var m = el('div', 'modal rub-modal');
      m.innerHTML =
        '<div class="modal-header">' +
          '<div><div class="modal-header-title">Importar objectius</div>' +
          '<div class="modal-header-sub">D\'un full de càlcul, d\'una taula del Word o d\'un fitxer</div></div>' +
          '<button class="modal-close" id="rubImpTancar" aria-label="Tancar">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button>' +
        '</div>' +
        '<div class="modal-body">' +
          '<div class="modal-hint rub-imp-ajuda">' +
            'Necessita <strong>una fila per objectiu</strong> i <strong>5 columnes</strong> en aquest ordre:' +
            '<div class="rub-imp-cols"><span>Objectiu</span><span>Molt ben assolit</span><span>Assolit</span>' +
            '<span>Assolit amb ajuda</span><span>No assolit</span></div>' +
            'Copia la taula del Word o del full de càlcul i enganxa-la aquí sota. ' +
            'També pots pujar un fitxer <code>.csv</code>, <code>.tsv</code> o <code>.txt</code>.' +
          '</div>' +
          '<div class="modal-field">' +
            '<input type="file" id="rubImpFitxer" accept=".csv,.tsv,.txt,text/plain,text/csv">' +
          '</div>' +
          '<div class="modal-field">' +
            '<div class="modal-label">O enganxa-ho aquí</div>' +
            '<textarea class="modal-input" id="rubImpText" rows="9" placeholder="Enganxa aquí la taula amb els objectius i els seus criteris…"></textarea>' +
          '</div>' +
          '<div id="rubImpPrevi"></div>' +
        '</div>' +
        '<div class="modal-footer">' +
          '<button class="btn btn-secondary" id="rubImpCancel">Cancel·lar</button>' +
          '<button class="btn btn-primary" id="rubImpOk">Importar</button>' +
        '</div>';
      ov.appendChild(m);
      document.body.appendChild(ov);

      document.getElementById('rubImpTancar').addEventListener('click', function () { ov.classList.remove('open'); });
      document.getElementById('rubImpCancel').addEventListener('click', function () { ov.classList.remove('open'); });
      document.getElementById('rubImpText').addEventListener('input', previsualitza);
      document.getElementById('rubImpFitxer').addEventListener('change', function () {
        var f = this.files && this.files[0];
        if (!f) return;
        var lector = new FileReader();
        lector.onload = function () {
          document.getElementById('rubImpText').value = String(lector.result || '');
          previsualitza();
        };
        lector.readAsText(f);
      });
      document.getElementById('rubImpOk').addEventListener('click', function () {
        var res = interpreta(document.getElementById('rubImpText').value);
        if (!res.objectius.length) {
          if (typeof showToast === 'function') showToast('No s\'ha trobat cap objectiu al document', 'error');
          return;
        }
        var subst = esborrany.length
          ? confirm('Ja hi ha ' + esborrany.length + ' objectiu(s).\n\nD\'acord = SUBSTITUIR-los pels ' +
                    res.objectius.length + ' importats.\nCancel·lar = AFEGIR-los als que ja hi ha.')
          : true;
        esborrany = subst ? res.objectius : esborrany.concat(res.objectius);
        ov.classList.remove('open');
        pintaLlista();
        if (typeof showToast === 'function') showToast(res.objectius.length + ' objectius importats ✓', 'success');
      });
    }
    document.getElementById('rubImpText').value = '';
    document.getElementById('rubImpPrevi').innerHTML = '';
    var fitxer = document.getElementById('rubImpFitxer'); if (fitxer) fitxer.value = '';
    ov.classList.add('open');
  }

  function previsualitza() {
    var cont = document.getElementById('rubImpPrevi');
    var txt = document.getElementById('rubImpText').value;
    if (!txt.trim()) { cont.innerHTML = ''; return; }
    var res = interpreta(txt);
    var html = '<div class="rub-imp-previ">';
    html += '<div class="rub-imp-previ-cap">' +
            (res.objectius.length ? ('S\'importaran <strong>' + res.objectius.length + ' objectius</strong>') : 'Cap objectiu detectat') +
            '</div>';
    res.avisos.forEach(function (a) { html += '<div class="rub-imp-avis">' + esc(a) + '</div>'; });
    res.objectius.slice(0, 3).forEach(function (o) {
      var quants = o.nivells.filter(function (x) { return x; }).length;
      html += '<div class="rub-imp-item"><strong>' + esc(o.nom) + '</strong>' +
              '<span class="rub-imp-crit">' + quants + '/4 criteris</span></div>';
    });
    if (res.objectius.length > 3) html += '<div class="rub-imp-mes">… i ' + (res.objectius.length - 3) + ' més</div>';
    html += '</div>';
    cont.innerHTML = html;
  }

  /* ================= ASPECTES D'ACTITUD ================= */

  function aspectesLocals() {
    try {
      var v = JSON.parse(localStorage.getItem('actitud_aspectes') || 'null');
      return (v && v.length) ? v : null;
    } catch (e) { return null; }
  }

  function aplicaAspectes(llista) {
    if (typeof ACTITUD_ASPECTES === 'undefined' || !llista || !llista.length) return;
    ACTITUD_ASPECTES.length = 0;
    llista.forEach(function (a) { ACTITUD_ASPECTES.push(a); });
  }

  async function carregaAspectes() {
    var local = aspectesLocals();
    if (local) aplicaAspectes(local);
    if (typeof config === 'undefined' || !config.scriptUrl) return;
    try {
      var r = await appsScriptGet({ action: 'loadActitudAspectes' });
      if (r && r.ok && r.data && r.data.length) {
        try { localStorage.setItem('actitud_aspectes', JSON.stringify(r.data)); } catch (e) {}
        aplicaAspectes(r.data);
      }
    } catch (e) {}
  }

  function desaAspectes(llista) {
    try { localStorage.setItem('actitud_aspectes', JSON.stringify(llista)); } catch (e) {}
    aplicaAspectes(llista);
    if (typeof config !== 'undefined' && config.scriptUrl) {
      appsScriptPost({ action: 'saveActitudAspectes', data: llista }).catch(function () {});
    }
  }

  function obreAspectes() {
    var actuals = (typeof ACTITUD_ASPECTES !== 'undefined')
      ? JSON.parse(JSON.stringify(ACTITUD_ASPECTES)) : [];
    var ov = document.getElementById('aspOverlay');
    if (!ov) {
      ov = el('div', 'modal-overlay');
      ov.id = 'aspOverlay';
      ov.addEventListener('mousedown', function (e) { if (e.target === ov) ov.classList.remove('open'); });
      var m = el('div', 'modal');
      m.innerHTML =
        '<div class="modal-header">' +
          '<div><div class="modal-header-title">Aspectes d\'actitud</div>' +
          '<div class="modal-header-sub">Els que avalues a cada alumne</div></div>' +
          '<button class="modal-close" id="aspTancar" aria-label="Tancar">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button>' +
        '</div>' +
        '<div class="modal-body"><div id="aspLlista"></div>' +
          '<div class="modal-hint">La nota d\'actitud és la mitjana de tots aquests aspectes.</div></div>' +
        '<div class="modal-footer">' +
          '<button class="btn btn-secondary" id="aspAfegir">+ Afegir aspecte</button>' +
          '<button class="btn btn-primary" id="aspDesar">Desar</button>' +
        '</div>';
      ov.appendChild(m);
      document.body.appendChild(ov);
      document.getElementById('aspTancar').addEventListener('click', function () { ov.classList.remove('open'); });
      document.getElementById('aspAfegir').addEventListener('click', function () {
        ov._llista.push({ id: 'a' + Date.now(), nom: '' }); pintaAspectes(ov);
      });
      document.getElementById('aspDesar').addEventListener('click', function () {
        var nets = ov._llista.filter(function (a) { return (a.nom || '').trim(); })
          .map(function (a) { return { id: a.id, nom: a.nom.trim() }; });
        if (!nets.length) { if (typeof showToast === 'function') showToast('Cal deixar-ne almenys un', 'error'); return; }
        desaAspectes(nets);
        ov.classList.remove('open');
        if (typeof showToast === 'function') showToast('Aspectes desats ✓', 'success');
      });
    }
    ov._llista = actuals;
    pintaAspectes(ov);
    ov.classList.add('open');
  }

  function pintaAspectes(ov) {
    var cont = document.getElementById('aspLlista');
    cont.innerHTML = '';
    ov._llista.forEach(function (a, i) {
      var fila = el('div', 'asp-fila');
      fila.innerHTML = '<input class="modal-input" value="' + esc(a.nom) + '" placeholder="Ex: Participació">' +
        '<button class="rub-obj-del" title="Eliminar">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button>';
      fila.querySelector('input').addEventListener('input', function () { a.nom = this.value; });
      fila.querySelector('button').addEventListener('click', function () { ov._llista.splice(i, 1); pintaAspectes(ov); });
      cont.appendChild(fila);
    });
  }

  /* ================= ENGANXAR-HO A L'APP ================= */

  function embolcalla(nom, despres) {
    var orig = window[nom];
    if (typeof orig !== 'function' || orig.__rub) return;
    var nou = function () {
      var r = orig.apply(this, arguments);
      try { despres.apply(this, arguments); } catch (e) {}
      return r;
    };
    nou.__rub = true;
    window[nom] = nou;
  }

  function botoEditar() {
    var barra = document.getElementById('comentAssigSelector');
    if (!barra || document.getElementById('rubBtnEditar')) return;
    var b = el('button', 'btn btn-ghost btn-sm');
    b.id = 'rubBtnEditar';
    b.type = 'button';
    b.textContent = 'Editar objectius';
    b.addEventListener('click', function () { obreEditor(); });
    if (barra.parentNode) barra.parentNode.appendChild(b);

    var b2 = el('button', 'btn btn-ghost btn-sm');
    b2.id = 'rubBtnEstil';
    b2.type = 'button';
    b2.textContent = 'La meva manera d\'escriure';
    b2.addEventListener('click', function () { obreEstil(); });
    if (barra.parentNode) barra.parentNode.appendChild(b2);
  }

  /* ========== ENLLAÇOS PERSONALS DE LA PORTADA ==========
     El de ClassDojo apuntava a la classe CONCRETA d'un mestre: un altre
     hi entrava i veia la classe que no era. Ara cada mestre hi posa el seu
     i, si no en posa cap, l'enllaç no es mostra. */

  function enllacos() {
    try { return JSON.parse(localStorage.getItem('enllacos_propis') || '{}'); }
    catch (e) { return {}; }
  }
  function desaEnllacos(obj) {
    try { localStorage.setItem('enllacos_propis', JSON.stringify(obj)); } catch (e) {}
    pintaEnllacos();
  }
  function pintaEnllacos() {
    var e = enllacos();
    document.querySelectorAll('[data-cfg]').forEach(function (a) {
      var url = (e[a.getAttribute('data-cfg')] || '').trim();
      if (url) { a.href = url; a.style.display = ''; a.removeAttribute('aria-hidden'); }
      else { a.href = '#'; a.style.display = 'none'; a.setAttribute('aria-hidden', 'true'); }
    });
  }
  function obreEnllacos() {
    var e = enllacos();
    var url1 = prompt("Enllac del teu ClassDojo (obre ClassDojo a la teva classe i copia l adreca). Deixa-ho buit per amagar la icona.", e.classdojo || "");
    if (url1 === null) return;
    var url2 = prompt("Enllac de Coordinacio (una app o document propi). Deixa-ho buit per amagar la icona.", e.coordinacio || "");
    if (url2 === null) return;
    desaEnllacos({ classdojo: url1.trim(), coordinacio: url2.trim() });
    if (typeof showToast === 'function') showToast('Enllaços desats ✓', 'success');
  }

  /* ========== EL MEU ESTIL DE REDACCIO (comentaris) ==========
     Aixo es el que fa que els comentaris sonin al mestre i no a una IA:
     ell hi enganxa comentaris seus i la IA n imita la manera d escriure. */

  function estilLlegeix() {
    try { return JSON.parse(localStorage.getItem('coment_estil') || '{}') || {}; }
    catch (e) { return {}; }
  }
  function estilDesa(o) {
    try { localStorage.setItem('coment_estil', JSON.stringify(o)); } catch (e) {}
    if (typeof config !== 'undefined' && config.scriptUrl) {
      appsScriptPost({ action: 'saveComentEstil', data: o }).catch(function () {});
    }
  }
  async function estilCarrega() {
    if (typeof config === 'undefined' || !config.scriptUrl) return;
    try {
      var r = await appsScriptGet({ action: 'loadComentEstil' });
      if (r && r.ok && r.data) {
        try { localStorage.setItem('coment_estil', JSON.stringify(r.data)); } catch (e) {}
      }
    } catch (e) {}
  }

  function obreEstil() {
    var e = estilLlegeix();
    var ov = document.getElementById('estilOverlay');
    if (!ov) {
      ov = el('div', 'modal-overlay');
      ov.id = 'estilOverlay';
      ov.addEventListener('mousedown', function (ev) { if (ev.target === ov) ov.classList.remove('open'); });
      var m = el('div', 'modal rub-modal');
      m.innerHTML =
        '<div class="modal-header">' +
          '<div><div class="modal-header-title">La meva manera d\'escriure</div>' +
          '<div class="modal-header-sub">Perque els comentaris sonin a tu i no a una IA</div></div>' +
          '<button class="modal-close" id="estTancar" aria-label="Tancar">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button>' +
        '</div>' +
        '<div class="modal-body">' +
          '<div class="modal-field">' +
            '<div class="modal-label">Comentaris teus d\'exemple</div>' +
            '<textarea class="modal-input" id="estExemples" rows="8" placeholder="Enganxa aqui 2 o 3 comentaris que hagis escrit tu altres anys. No es copiaran: nomes serveixen perque la IA vegi com escrius (quines paraules fas servir, com comences, com dius les coses delicades)."></textarea>' +
            '<div class="modal-hint"><strong>Aixo es el que mes canvia el resultat.</strong> Amb dos o tres exemples ' +
            'teus, els comentaris deixen de sonar a manual i comencen a sonar a tu.</div>' +
          '</div>' +
          '<div class="modal-row">' +
            '<div class="modal-field">' +
              '<div class="modal-label">Llargada</div>' +
              '<select class="modal-input" id="estLlarg">' +
                '<option value="curt">Curt (3-4 linies)</option>' +
                '<option value="mitja">Mitja (5-7 linies)</option>' +
                '<option value="llarg">Llarg (8-10 linies)</option>' +
              '</select>' +
            '</div>' +
            '<div class="modal-field">' +
              '<div class="modal-label">To</div>' +
              '<select class="modal-input" id="estTo">' +
                '<option value="mixt">Professional pero proper</option>' +
                '<option value="proper">Proper i calid</option>' +
                '<option value="formal">Formal</option>' +
              '</select>' +
            '</div>' +
          '</div>' +
          '<div class="modal-field">' +
            '<div class="modal-label">Alguna cosa mes a tenir en compte (opcional)</div>' +
            '<input class="modal-input" id="estExtra" placeholder="Ex: no facis servir mai la paraula &quot;alumne&quot;, digues sempre el nom">' +
          '</div>' +
        '</div>' +
        '<div class="modal-footer">' +
          '<button class="btn btn-secondary" id="estCancel">Cancel·lar</button>' +
          '<button class="btn btn-primary" id="estDesar">Desar</button>' +
        '</div>';
      ov.appendChild(m);
      document.body.appendChild(ov);
      document.getElementById('estTancar').addEventListener('click', function () { ov.classList.remove('open'); });
      document.getElementById('estCancel').addEventListener('click', function () { ov.classList.remove('open'); });
      document.getElementById('estDesar').addEventListener('click', function () {
        estilDesa({
          exemples: document.getElementById('estExemples').value,
          llargada: document.getElementById('estLlarg').value,
          to: document.getElementById('estTo').value,
          extra: document.getElementById('estExtra').value
        });
        ov.classList.remove('open');
        if (typeof showToast === 'function') showToast('Estil desat ✓', 'success');
      });
    }
    document.getElementById('estExemples').value = e.exemples || '';
    document.getElementById('estLlarg').value = e.llargada || 'mitja';
    document.getElementById('estTo').value = e.to || 'mixt';
    document.getElementById('estExtra').value = e.extra || '';
    ov.classList.add('open');
  }

  function init() {
    pintaEnllacos();
    // En triar assignatura al generador, carrega els SEUS objectius
    embolcalla('selectComentAssig', function (assig) { carrega(assig); });
    embolcalla('initComentaris', function () {
      botoEditar();
      if (typeof _comentAssig !== 'undefined') carrega(_comentAssig);
    });
    carregaAspectes();
    estilCarrega();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.rubriques = {
    obreEstil: obreEstil,
    obreEnllacos: obreEnllacos,
    pintaEnllacos: pintaEnllacos,
    obreEditor: obreEditor,
    obreAspectes: obreAspectes,
    interpreta: interpreta,
    objectius: objectius,
    desa: desa,
    carrega: carrega
  };
})();
