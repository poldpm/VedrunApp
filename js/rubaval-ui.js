/* ============================================================
   RÚBRIQUES D'AVALUACIÓ — LA PANTALLA
   js/rubaval-ui.js
   ------------------------------------------------------------
   Els números són a `js/rubaval.js` (i es proven amb
   `node eines/comprova-rubaval.js`, sense navegador). Aquí hi ha
   només el que es veu: la llista de rúbriques d'una assignatura i
   l'editor.

   ⚠ AQUESTA EINA NEIX APAGADA. No la veu ningú fins que al seu
   `js/personal.js` hi digui:

       window.EINES_RUBAVAL = true;

   És una «possible actualització»: la té qui la demani. El fitxer
   `personal.js` no el trepitja mai la sincronització, o sigui que
   encendre-la a una mestra no la deixa fora dels arranjaments.

   COM S'ESCRIU UNA RÚBRICA (decisions d'en Pol, 29/9/2026)
   -------------------------------------------------------
   · Una FILA PER CRITERI amb el pes al costat des del primer
     moment: «una fila amb el pes al costat des del primer moment».
     Amb l'Enter des del nom es fa la següent fila i el cursor hi va:
     escriure sis criteris és escriure sis línies.
   · Els nivells són lliures (quatre si no diu res) i valen per a
     tota la rúbrica.
   · El text de cada nivell és OPCIONAL i es desplega amb el botó de
     cada criteri: qui el vol, el té; qui va de pressa, no el veu.
   ============================================================ */
(function () {
  'use strict';

  var ui = {};                  // el que surt al final a window
  var _entrada = null;          // { key, nom, grup, label } de l'assignatura triada
  var _trim = null;             // 1, 2 o 3
  var _llista = [];             // les rúbriques d'aquesta assignatura i trimestre
  var _esborrany = null;        // la rúbrica que s'està editant (còpia)
  var _esNova = false;

  function _hiEs() { return window.EINES_RUBAVAL === true; }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m];
    });
  }
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }
  function byId(id) { return document.getElementById(id); }

  /* «de Música», però «d'Anglès». Ho llegirà una mestra de llengua: val més
     escriure-ho bé que no pas deixar-hi un «de Anglès» a la pantalla. */
  function _de(nom) {
    var p = String(nom || '').trim().charAt(0).toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '');
    return 'aeiouh'.indexOf(p) !== -1 ? 'd\'' : 'de ';
  }

  /* ================= QUINA ASSIGNATURA I QUIN TRIMESTRE ================= */

  function _entrades() {
    return (typeof _perfilEntradesAmbGrup === 'function') ? _perfilEntradesAmbGrup() : [];
  }

  function _trimestreInicial() {
    if (_trim) return _trim;
    if (typeof getTrimestreProposat === 'function') return getTrimestreProposat() || 1;
    if (typeof getTrimestreActual === 'function' && getTrimestreActual() !== null) return getTrimestreActual();
    return 1;
  }

  /* ================= LA PÀGINA ================= */

  ui.obrePagina = function () {
    if (!_hiEs()) return;
    _trim = _trimestreInicial();
    var entr = _entrades();
    if (entr.length) {
      var encara = _entrada && entr.some(function (e) { return e.key === _entrada.key; });
      if (!encara) _entrada = entr[0];
      else _entrada = entr.filter(function (e) { return e.key === _entrada.key; })[0];
    } else {
      _entrada = null;
    }
    pintaCapcalera();
    carregaIPinta();
  };

  function pintaCapcalera() {
    var cont = byId('rubavalPicker');
    if (!cont) return;
    var entr = _entrades();
    if (!entr.length) {
      cont.innerHTML = '<p class="modal-hint">Encara no has dit quines assignatures fas. ' +
        'Ves a <strong>El meu perfil</strong> i marca-les: les rúbriques van per assignatura i grup.</p>';
      return;
    }
    cont.innerHTML =
      '<label class="rubaval-camp"><span class="rubaval-camp-nom">Assignatura i grup</span>' +
        '<select class="modal-input" id="rubavalAssig" aria-label="Assignatura i grup">' +
          entr.map(function (e) {
            return '<option value="' + esc(e.key) + '"' +
                   (_entrada && e.key === _entrada.key ? ' selected' : '') + '>' + esc(e.label) + '</option>';
          }).join('') +
        '</select></label>' +
      '<div class="rubaval-camp"><span class="rubaval-camp-nom">Trimestre</span>' +
        '<div class="rubaval-trims" role="group" aria-label="Trimestre">' +
          [['1r', 1], ['2n', 2], ['3r', 3]].map(function (t) {
            return '<button type="button" class="trim-sel-btn' + (t[1] === _trim ? ' active' : '') +
                   '" aria-pressed="' + (t[1] === _trim) + '" data-trim="' + t[1] + '">' + t[0] + '</button>';
          }).join('') +
        '</div></div>';

    byId('rubavalAssig').addEventListener('change', function (ev) {
      var val = ev.target.value;
      var e = _entrades().filter(function (x) { return x.key === val; })[0];
      if (e) { _entrada = e; carregaIPinta(); }
    });
    cont.querySelectorAll('.rubaval-trims button').forEach(function (b) {
      b.addEventListener('click', function () {
        _trim = parseInt(b.getAttribute('data-trim'), 10);
        pintaCapcalera();
        carregaIPinta();
      });
    });
  }

  function carregaIPinta() {
    if (!_entrada) { _llista = []; pintaLlista(); return; }
    _llista = RubAval.llegeix(_entrada.key, _trim);
    pintaLlista();
    // I, en segon pla, el que en digui el full (per si ve d'un altre aparell)
    RubAval.carrega(_entrada.key, _trim).then(function (l) {
      if (!_entrada) return;
      _llista = l || [];
      pintaLlista();
    }).catch(function () {});
  }

  function _alumnes() {
    return (typeof students !== 'undefined' && Array.isArray(students)) ? students : [];
  }

  function pintaLlista() {
    var cont = byId('rubavalLlista');
    if (!cont) return;
    if (!_entrada) { cont.innerHTML = ''; return; }
    if (!_llista.length) {
      cont.innerHTML =
        '<div class="rubaval-buit">' +
          '<p><strong>Encara no tens cap rúbrica ' + _de(_entrada.label) + esc(_entrada.label) +
          ' per a aquest trimestre.</strong></p>' +
          '<p>Una rúbrica és una activitat amb els seus criteris: hi poses els criteris que vulguis, ' +
          'amb el pes que vulguis, i quan avaluïs la nota anirà al registre de notes d\'aquesta assignatura.</p>' +
        '</div>';
      return;
    }
    var alumnes = _alumnes();
    cont.innerHTML = '';
    _llista.forEach(function (r) {
      var notes = RubAval.notesDe(r, alumnes);
      var ambNota = Object.keys(notes).filter(function (k) { return notes[k].nota !== null; });
      var mitjana = ambNota.length
        ? Math.round(ambNota.reduce(function (s, k) { return s + notes[k].nota; }, 0) / ambNota.length * 10) / 10
        : null;
      var fila = el('div', 'rubaval-fila');
      fila.innerHTML =
        '<div class="rubaval-fila-dades">' +
          '<div class="rubaval-fila-nom">' + esc(r.nom || 'Sense nom') + '</div>' +
          '<div class="rubaval-fila-sub">' +
            (r.criteris || []).length + ' criteri' + ((r.criteris || []).length === 1 ? '' : 's') +
            ' · ' + (r.nivells || []).length + ' nivells' +
            (alumnes.length ? ' · ' + ambNota.length + ' de ' + alumnes.length + ' avaluats' : '') +
            (mitjana !== null ? ' · mitjana ' + String(mitjana).replace('.', ',') : '') +
            (r.itemId ? ' · al registre' : '') +
          '</div>' +
        '</div>' +
        '<div class="rubaval-fila-botons">' +
          '<button class="btn btn-ghost" data-fes="editar">Editar</button>' +
          '<button class="btn btn-ghost" data-fes="copiar" title="Fer-ne una còpia per a un altre grup">Copiar</button>' +
          '<button class="btn btn-ghost rubaval-esborrar" data-fes="esborrar" aria-label="Esborrar la rúbrica ' +
            esc(r.nom) + '">Esborrar</button>' +
        '</div>';
      fila.querySelector('[data-fes="editar"]').addEventListener('click', function () { obreEditor(r.id); });
      fila.querySelector('[data-fes="copiar"]').addEventListener('click', function () { copiaRubrica(r.id); });
      fila.querySelector('[data-fes="esborrar"]').addEventListener('click', function () { esborraRubrica(r.id); });
      cont.appendChild(fila);
    });
  }

  /* ================= L'EDITOR ================= */

  function construeix() {
    if (byId('ravOverlay')) return;
    var ov = el('div', 'modal-overlay');
    ov.id = 'ravOverlay';
    ov.addEventListener('mousedown', function (e) { if (e.target === ov) tancaEditor(); });
    var modal = el('div', 'modal rav-modal');
    modal.innerHTML =
      '<div class="modal-header">' +
        '<div><div class="modal-header-title" id="ravTitol">Nova rúbrica</div>' +
        '<div class="modal-header-sub" id="ravSub"></div></div>' +
        '<button class="modal-close" id="ravTancar" aria-label="Tancar">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button>' +
      '</div>' +
      '<div class="modal-body" id="ravBody"></div>' +
      '<div class="modal-footer">' +
        '<span class="rav-peu" id="ravPeu"></span>' +
        '<button class="btn btn-ghost" id="ravCancela">Cancel·lar</button>' +
        '<button class="btn btn-primary" id="ravDesar">Desar la rúbrica</button>' +
      '</div>';
    ov.appendChild(modal);
    document.body.appendChild(ov);
    byId('ravTancar').addEventListener('click', tancaEditor);
    byId('ravCancela').addEventListener('click', tancaEditor);
    byId('ravDesar').addEventListener('click', desaEditor);
  }

  function obreEditor(id) {
    if (!_entrada) return;
    construeix();
    var orig = _llista.filter(function (r) { return r.id === id; })[0];
    _esNova = !orig;
    _haProvatDesar = false;
    _esborrany = orig
      ? JSON.parse(JSON.stringify(orig))
      : RubAval.nova('', { grup: _entrada.grup || null });
    if (_esNova && !_esborrany.criteris.length) {
      _esborrany.criteris = [RubAval.criteriNou('', 1), RubAval.criteriNou('', 1)];
    }
    byId('ravTitol').textContent = _esNova ? 'Nova rúbrica' : 'Rúbrica';
    byId('ravSub').textContent = _entrada.label + ' · ' + _trimLabel();
    pintaEditor();
    byId('ravOverlay').classList.add('open');
    setTimeout(function () { var n = byId('ravNom'); if (n) n.focus(); }, 60);
  }

  function _trimLabel() {
    return (typeof getTrimLabel === 'function') ? getTrimLabel(_trim) : (_trim + 'r trimestre');
  }

  function tancaEditor() {
    var o = byId('ravOverlay');
    if (o) o.classList.remove('open');
    _esborrany = null;
  }

  function pintaEditor() {
    var body = byId('ravBody');
    if (!body || !_esborrany) return;
    var r = _esborrany;

    body.innerHTML =
      '<label class="rav-camp"><span class="rav-camp-nom">Activitat</span>' +
        '<input class="modal-input" id="ravNom" maxlength="60" placeholder="Per exemple: Exposició oral del projecte" ' +
               'value="' + esc(r.nom) + '"></label>' +
      '<p class="modal-hint" style="margin:-4px 0 14px">Aquest serà el nom de la columna al registre de notes, i la nota anirà sobre 10.</p>' +

      '<div class="rav-secc-titol">Nivells <span class="rav-secc-ajuda">el mateix per a tots els criteris</span></div>' +
      '<div class="rav-nivells" id="ravNivells"></div>' +
      '<button type="button" class="btn btn-ghost rav-afegir" id="ravAfegirNivell">+ Afegir nivell</button>' +

      '<div class="rav-secc-titol" style="margin-top:18px">Criteris <span class="rav-secc-ajuda">el pes diu quant compta cada un</span></div>' +
      '<div class="rav-criteris" id="ravCriteris"></div>' +
      '<button type="button" class="btn btn-ghost rav-afegir" id="ravAfegirCriteri">+ Afegir criteri</button>' +

      '<div class="grups-avis grups-avis-warn" id="ravProblemes" style="display:none" role="alert"></div>';

    byId('ravNom').addEventListener('input', function () { r.nom = this.value; potserProblemes(); });
    byId('ravAfegirNivell').addEventListener('click', afegeixNivell);
    byId('ravAfegirCriteri').addEventListener('click', function () { afegeixCriteri(true); });
    pintaNivells();
    pintaCriteris();
    potserProblemes();
  }

  function pintaNivells() {
    var cont = byId('ravNivells');
    if (!cont) return;
    var r = _esborrany;
    cont.innerHTML = '';
    r.nivells.forEach(function (n, i) {
      var caixa = el('div', 'rav-nivell');
      caixa.innerHTML =
        '<input class="modal-input rav-nivell-nom" value="' + esc(n.nom) + '" maxlength="24" ' +
               'aria-label="Nom del nivell ' + (i + 1) + '">' +
        '<input class="modal-input rav-nivell-punts" type="number" inputmode="decimal" min="0" step="0.5" ' +
               'value="' + esc(n.punts) + '" aria-label="Punts del nivell ' + esc(n.nom || (i + 1)) + '">' +
        '<button type="button" class="rav-treu" aria-label="Treure el nivell ' + esc(n.nom || (i + 1)) + '" title="Treure">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button>';
      caixa.querySelector('.rav-nivell-nom').addEventListener('input', function () { n.nom = this.value; });
      caixa.querySelector('.rav-nivell-punts').addEventListener('input', function () {
        n.punts = this.value === '' ? '' : Number(this.value);
        potserProblemes(); pintaPeu();
      });
      caixa.querySelector('.rav-treu').addEventListener('click', function () { treuNivell(i); });
      cont.appendChild(caixa);
    });
    pintaPeu();
  }

  function afegeixNivell() {
    var r = _esborrany;
    var minim = r.nivells.reduce(function (m, n) { return Math.min(m, Number(n.punts) || 0); }, Infinity);
    r.nivells.push({ nom: 'Nivell ' + (r.nivells.length + 1), punts: Math.max(0, (minim === Infinity ? 1 : minim) - 1) });
    pintaNivells();
    potserProblemes();
  }

  /* Treure un nivell mou els índexs de tothom, i això és un càlcul que pot
     canviar notes: el fa `RubAval.treuNivell`, que té proves. Aquí només
     es pregunta i es repinta. */
  function treuNivell(i) {
    var r = _esborrany;
    if (r.nivells.length <= 2) {
      avisa('Una rúbrica necessita almenys dos nivells.');
      return;
    }
    var afectats = RubAval.ambNivell(r, i);
    var nom = r.nivells[i].nom || ('nivell ' + (i + 1));
    if (afectats && !confirm('Hi ha ' + afectats + ' avaluació' + (afectats === 1 ? '' : 'ns') +
        ' amb «' + nom + '». Si el treus, aquells criteris es quedaran sense avaluar. Continuo?')) return;
    RubAval.treuNivell(r, i);
    pintaNivells();
    potserProblemes();
  }

  function pintaCriteris() {
    var cont = byId('ravCriteris');
    if (!cont) return;
    var r = _esborrany;
    cont.innerHTML = '';
    r.criteris.forEach(function (c, i) {
      var fila = el('div', 'rav-criteri');
      fila.innerHTML =
        '<span class="rav-criteri-num">' + (i + 1) + '</span>' +
        '<input class="modal-input rav-criteri-nom" value="' + esc(c.nom) + '" maxlength="90" ' +
               'placeholder="Què avalues" aria-label="Nom del criteri ' + (i + 1) + '">' +
        '<label class="rav-criteri-pes"><span>pes</span>' +
          '<input class="modal-input" type="number" inputmode="decimal" min="0" step="0.5" value="' + esc(c.pes) + '" ' +
                 'aria-label="Pes del criteri ' + (i + 1) + '"></label>' +
        '<button type="button" class="rav-criteri-mes" aria-expanded="false" title="Escriure què vol dir cada nivell" ' +
                'aria-label="Textos dels nivells del criteri ' + (i + 1) + '">⋯</button>' +
        '<button type="button" class="rav-treu" title="Treure aquest criteri" ' +
                'aria-label="Treure el criteri ' + (i + 1) + '">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button>' +
        '<div class="rav-criteri-textos" hidden></div>';

      var nom = fila.querySelector('.rav-criteri-nom');
      nom.addEventListener('input', function () { c.nom = this.value; potserProblemes(); });
      /* L'Enter des del nom fa la fila següent i hi porta el cursor: és com
         s'escriu una llista de criteris de pressa. Amb Maj+Enter, no: així qui
         ho fa sense voler no es troba files buides. */
      nom.addEventListener('keydown', function (ev) {
        if (ev.key !== 'Enter' || ev.shiftKey) return;
        ev.preventDefault();
        if (i === r.criteris.length - 1) afegeixCriteri(true);
        else {
          var seg = cont.querySelectorAll('.rav-criteri-nom')[i + 1];
          if (seg) seg.focus();
        }
      });
      fila.querySelector('.rav-criteri-pes input').addEventListener('input', function () {
        c.pes = this.value === '' ? '' : Number(this.value);
        potserProblemes(); pintaPeu();
      });
      fila.querySelector('.rav-treu').addEventListener('click', function () { treuCriteri(i); });
      var mes = fila.querySelector('.rav-criteri-mes');
      var caixa = fila.querySelector('.rav-criteri-textos');
      mes.addEventListener('click', function () {
        var obert = !caixa.hidden;
        if (obert) { caixa.hidden = true; mes.setAttribute('aria-expanded', 'false'); return; }
        pintaTextos(caixa, c);
        caixa.hidden = false;
        mes.setAttribute('aria-expanded', 'true');
        var p = caixa.querySelector('textarea');
        if (p) p.focus();
      });
      cont.appendChild(fila);
    });
  }

  /* Els textos de cada nivell: opcionals (en Pol, 29/9/2026). Només es
     pinten quan algú els obre, que és quan realment els vol. */
  function pintaTextos(caixa, c) {
    var r = _esborrany;
    if (!Array.isArray(c.textos)) c.textos = [];
    caixa.innerHTML =
      '<p class="modal-hint" style="margin:0 0 6px">Opcional: què vol dir cada nivell en aquest criteri. ' +
      'Serveix per ensenyar la rúbrica als alumnes; per avaluar no cal.</p>' +
      r.nivells.map(function (n, j) {
        return '<label class="rav-text-fila"><span>' + esc(n.nom || ('Nivell ' + (j + 1))) + '</span>' +
               '<textarea class="modal-input" rows="2" data-j="' + j + '">' + esc(c.textos[j] || '') + '</textarea></label>';
      }).join('');
    caixa.querySelectorAll('textarea').forEach(function (t) {
      t.addEventListener('input', function () { c.textos[parseInt(t.getAttribute('data-j'), 10)] = this.value; });
    });
  }

  function afegeixCriteri(enfoca) {
    _esborrany.criteris.push(RubAval.criteriNou('', 1));
    pintaCriteris();
    potserProblemes();
    if (enfoca) {
      var caixes = document.querySelectorAll('#ravCriteris .rav-criteri-nom');
      if (caixes.length) {
        caixes[caixes.length - 1].focus();
        caixes[caixes.length - 1].scrollIntoView({ block: 'nearest' });
      }
    }
  }

  function treuCriteri(i) {
    var r = _esborrany;
    var c = r.criteris[i];
    var avaluats = Object.keys(r.valors || {}).filter(function (a) { return r.valors[a][c.id] !== undefined; }).length;
    if (avaluats && !confirm('El criteri «' + (c.nom || 'sense nom') + '» ja està avaluat a ' + avaluats +
        ' alumne' + (avaluats === 1 ? '' : 's') + '. Si el treus, aquelles avaluacions es perdran. Continuo?')) return;
    RubAval.treuCriteri(r, c.id);
    pintaCriteris();
    potserProblemes();
    pintaPeu();
  }

  /* El peu diu quant val la rúbrica sencera. És la manera ràpida de veure
     si els pesos diuen el que ella vol: «12 punts en total, i la Claredat
     n'és 8». */
  function pintaPeu() {
    var peu = byId('ravPeu');
    if (!peu || !_esborrany) return;
    var max = RubAval.maxim(_esborrany);
    var pm = RubAval.puntsMaxNivell(_esborrany);
    if (!max) { peu.textContent = ''; return; }
    var parts = _esborrany.criteris
      .filter(function (c) { return (c.nom || '').trim() && Number(c.pes) > 0; })
      .map(function (c) { return (c.nom.length > 18 ? c.nom.slice(0, 17) + '…' : c.nom) + ' ' +
                                 Math.round(pm * Number(c.pes) / max * 100) + '%'; });
    peu.textContent = parts.length ? parts.join(' · ') : '';
  }

  /* ⚠ Els avisos NO surten mentre encara s'està escrivint la rúbrica.
     Una rúbrica acabada de començar sempre està malament —no té nom i no té
     cap criteri escrit—, i dir-ho abans que hi hagi res fa que l'avís sigui
     paisatge: quan després en surti un de bo, ja no el mirarà ningú. Surten
     al primer intent de desar, i a partir d'aquí es van actualitzant sols. */
  var _haProvatDesar = false;

  function potserProblemes() {
    var caixa = byId('ravProblemes');
    if (!caixa || !_esborrany) return;
    if (!_haProvatDesar) { caixa.style.display = 'none'; caixa.innerHTML = ''; pintaPeu(); return; }
    var p = RubAval.problemes(_esborrany);
    if (!p.length) { caixa.style.display = 'none'; caixa.innerHTML = ''; return; }
    caixa.style.display = '';
    caixa.innerHTML = p.map(esc).join('<br>');
    pintaPeu();
  }

  function avisa(txt) {
    if (typeof showToast === 'function') showToast(txt, 'error');
    else alert(txt);
  }

  function desaEditor() {
    if (!_esborrany || !_entrada) return;
    _haProvatDesar = true;
    var r = _esborrany;
    r.nom = (r.nom || '').trim();
    r.criteris = r.criteris.filter(function (c) { return (c.nom || '').trim(); })
                           .map(function (c) { c.nom = c.nom.trim(); c.pes = Number(c.pes) || 0; return c; });
    r.nivells = r.nivells.map(function (n) {
      return { nom: (n.nom || '').trim(), punts: Number(n.punts) || 0 };
    });
    r.grup = _entrada.grup || null;

    var problemes = RubAval.problemes(r);
    if (problemes.length) {
      var caixa = byId('ravProblemes');
      if (caixa) { caixa.style.display = ''; caixa.innerHTML = problemes.map(esc).join('<br>'); }
      avisa(problemes[0]);
      return;
    }
    /* Dues activitats amb el mateix nom acaben sent dues columnes iguals al
       registre i ningú no sap quina és quina. Al registre de notes ja es
       bloqueja; aquí també, i abans de crear-la. */
    var repe = _llista.some(function (x) {
      return x.id !== r.id && (x.nom || '').trim().toLowerCase() === r.nom.toLowerCase();
    });
    if (repe) { avisa('Ja tens una rúbrica que es diu «' + r.nom + '» en aquest trimestre. Posa-li un altre nom.'); return; }

    if (_esNova) _llista.push(r);
    else _llista = _llista.map(function (x) { return x.id === r.id ? r : x; });
    RubAval.desa(_entrada.key, _trim, _llista);
    tancaEditor();
    pintaLlista();
    if (typeof showToast === 'function') {
      showToast('Rúbrica «' + r.nom + '» desada (' + r.criteris.length + ' criteris) ✓', 'success');
    }
  }

  /* ================= COPIAR I ESBORRAR ================= */

  /* La mateixa activitat a un altre grup: el cas de cada dia d'una
     especialista. Es copien els criteris i els nivells; les avaluacions,
     no (són d'uns altres nens). */
  /* «La mateixa rúbrica a 3r B i a 3r C» és el pa de cada dia d'una
     especialista, i per això no pot ser una pregunta escrita: és una
     llista dels seus grups on es clica el que toca. Es poden marcar
     diversos grups alhora. */
  function copiaRubrica(id) {
    var r = _llista.filter(function (x) { return x.id === id; })[0];
    if (!r) return;
    var entr = _entrades().filter(function (e) { return e.key !== _entrada.key; });
    if (!entr.length) {
      avisa('Només tens una assignatura al perfil: no hi ha on copiar-la.');
      return;
    }
    construeixCopia();
    var body = byId('ravCopiaBody');
    body.innerHTML =
      '<p class="modal-hint" style="margin:0 0 10px">Es copien els criteris, els pesos i els nivells ' +
      '<strong>de «' + esc(r.nom) + '»</strong>. Les avaluacions no: són d\'uns altres alumnes.</p>' +
      entr.map(function (e, i) {
        var te = RubAval.llegeix(e.key, _trim).some(function (x) {
          return (x.nom || '').toLowerCase() === (r.nom || '').toLowerCase();
        });
        return '<label class="rav-copia-fila"><input type="checkbox" data-i="' + i + '">' +
               '<span>' + esc(e.label) + '</span>' +
               (te ? '<span class="rav-copia-ja">ja en té una amb aquest nom</span>' : '') + '</label>';
      }).join('');
    /* ⚠ La casella la commuta AQUEST codi, no el reenviament de l'etiqueta.
       Tota la fila ha de ser clicable (és un objectiu de dit de 44 px), i
       deixar-ho al comportament del navegador vol dir que, segons on es
       clica, unes vegades es commuta i altres es commuta dues i es queda
       igual. Una casella que no fa cas quan la cliques és de les coses que
       fan deixar de fiar-se de l'app. */
    body.querySelectorAll('.rav-copia-fila').forEach(function (fila) {
      fila.addEventListener('click', function (ev) {
        if (ev.target && ev.target.tagName === 'INPUT') return;   // ja ho fa ell
        ev.preventDefault();
        var c = fila.querySelector('input');
        c.checked = !c.checked;
      });
    });
    byId('ravCopiaFes').onclick = function () {
      var quins = [...body.querySelectorAll('input:checked')].map(function (c) {
        return entr[parseInt(c.getAttribute('data-i'), 10)];
      });
      if (!quins.length) { avisa('Marca on la vols copiar.'); return; }
      quins.forEach(function (e) { copiaA(r, e); });
      byId('ravCopiaOverlay').classList.remove('open');
      if (typeof showToast === 'function') {
        showToast(quins.length === 1 ? ('Copiada a ' + quins[0].label + ' ✓')
                                     : ('Copiada a ' + quins.length + ' grups ✓'), 'success');
      }
    };
    byId('ravCopiaOverlay').classList.add('open');
  }

  function construeixCopia() {
    if (byId('ravCopiaOverlay')) return;
    var ov = el('div', 'modal-overlay');
    ov.id = 'ravCopiaOverlay';
    ov.addEventListener('mousedown', function (e) { if (e.target === ov) ov.classList.remove('open'); });
    var modal = el('div', 'modal');
    modal.innerHTML =
      '<div class="modal-header">' +
        '<div class="modal-header-title">Copiar la rúbrica</div>' +
        '<button class="modal-close" id="ravCopiaX" aria-label="Tancar">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button>' +
      '</div>' +
      '<div class="modal-body" id="ravCopiaBody"></div>' +
      '<div class="modal-footer">' +
        '<button class="btn btn-ghost" id="ravCopiaTanca">Cancel·lar</button>' +
        '<button class="btn btn-primary" id="ravCopiaFes">Copiar-la</button>' +
      '</div>';
    ov.appendChild(modal);
    document.body.appendChild(ov);
    byId('ravCopiaX').addEventListener('click', function () { ov.classList.remove('open'); });
    byId('ravCopiaTanca').addEventListener('click', function () { ov.classList.remove('open'); });
  }

  function copiaA(r, e) {
    var copia = RubAval.copia(r, r.nom, e.grup || null);
    var destins = RubAval.llegeix(e.key, _trim);
    if (destins.some(function (x) { return (x.nom || '').toLowerCase() === (copia.nom || '').toLowerCase(); })) {
      copia.nom = copia.nom + ' (còpia)';
    }
    destins.push(copia);
    RubAval.desa(e.key, _trim, destins);
  }

  function esborraRubrica(id) {
    var r = _llista.filter(function (x) { return x.id === id; })[0];
    if (!r) return;
    var avaluats = Object.keys(r.valors || {}).length;
    var avis = 'Esborrar la rúbrica «' + (r.nom || 'sense nom') + '»?';
    if (avaluats) avis += '\n\nTé ' + avaluats + ' alumne' + (avaluats === 1 ? '' : 's') + ' avaluats.';
    if (r.itemId) avis += '\n\nLa columna del registre de notes NO s\'esborra: si també la vols treure, fes-ho des del registre.';
    if (!confirm(avis)) return;
    _llista = _llista.filter(function (x) { return x.id !== id; });
    RubAval.desa(_entrada.key, _trim, _llista);
    pintaLlista();
    if (typeof showToast === 'function') showToast('Rúbrica esborrada', 'success');
  }

  /* ================= EL QUE VEU LA RESTA DE L'APP ================= */

  ui.nova = function () { if (_entrada) obreEditor(null); };
  ui.hiEs = _hiEs;

  /* El botó del menú neix amagat a l'index.html i només l'ensenya això,
     que es crida en arrencar (després de `js/personal.js`, que és l'últim
     fitxer que carrega el navegador). */
  ui.aplicaInterficie = function () {
    var b = byId('navRubaval');
    if (b) b.style.display = _hiEs() ? '' : 'none';
  };

  window.RubAvalUI = ui;
  window.rubavalObrePagina = ui.obrePagina;
  window.rubavalNova = ui.nova;
})();
