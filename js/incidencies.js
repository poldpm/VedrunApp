/* ============================================================
   AVISAR LA FAMÍLIA D'UNA INCIDÈNCIA — incidencies.js
   ------------------------------------------------------------
   Escrius en dues línies què ha passat i el correu per a la
   família surt redactat, a punt de revisar i enviar.

   ⚠ EINA OPCIONAL, I NEIX APAGADA. Només la té qui tingui

       window.EINES_INCIDENCIES = true;

   al seu `js/personal.js`. El codi arriba a totes les apps amb
   el `sync-totes.js`; s'encén només a qui la demani. És el
   mateix patró que les rúbriques d'avaluació, i el motiu és que
   un botó vermell nou a cada targeta d'alumne no se li ha
   d'aparèixer a ningú sense haver-lo demanat.

   L'entrada del catàleg (`js/millores.js`) porta
   `interruptor: 'EINES_INCIDENCIES'`: és el que fa que, a qui ja
   la tingui encesa, «Possibles actualitzacions» li digui «Ja la
   tens ✓» en lloc de tornar-li a oferir.

   A ESPECIALISTES NO. No tenen tutoria ni són qui escriu a les
   famílies. Encara que algú els encengués l'interruptor, aquí es
   torna a comprovar: val més comprovar-ho dues vegades que
   trobar-se escrivint a una família que no és la seva.

   ------------------------------------------------------------
   PER QUÈ NO S'ENVIA SOL

   L'app NO envia res. Obre el redactor del Gmail amb el correu
   ja escrit i l'envia ella. Un correu a una família sobre un
   conflicte no és una cosa que hagi de sortir d'un sol clic:
   l'ha de poder llegir, retocar i decidir.

   Per això el compte de la fitxa diu «comunicades», no
   «enviades»: se suma quan s'obre el Gmail, i si després ho
   cancel·la, el registre es pot esborrar.
   ============================================================ */
(function () {
  'use strict';

  /* ---- L'interruptor. Es llegeix EN DIRECTE, no en carregar ----
     `js/personal.js` es carrega l'ÚLTIM de tots: en el moment en què
     aquest fitxer s'executa, `window.EINES_INCIDENCIES` encara no hi és.
     Per això no es pot guardar en una variable aquí dalt. */
  function _hiEs() {
    if (window.EINES_INCIDENCIES !== true) return false;
    try { if (typeof esEspecialista === 'function' && esEspecialista()) return false; } catch (e) {}
    return true;
  }

  /* ---- La plantilla de sèrie ----
     La part fixa la pot canviar cada mestra des de la mateixa finestra;
     això és el punt de partida i el que torna amb «Tornar a la de sèrie».

     Els comodins van en català i amb noms que s'entenguin sense cap
     explicació: qui l'editi no és informàtica. */
  var PLANTILLA_SERIE = {
    assumpte: '{nom} — comunicació de l\'escola',
    cos:
      'Benvolguda família,\n\n' +
      'Us escrivim per posar-vos al corrent d\'una incidència que hi ha hagut avui a l\'escola i en què hi ha participat {fill}.\n\n' +
      '{incidencia}\n\n' +
      'Ja n\'hem parlat amb {elnom} i ho hem treballat aquí. Us ho fem saber perquè ens sembla important que a casa també n\'estigueu al corrent i, si ho creieu oportú, en pugueu parlar.\n\n' +
      'Si voleu comentar-ho amb més calma, responeu aquest correu i buscarem un moment per trobar-nos.\n\n' +
      'Ben cordialment,\n' +
      '{mestra}\n' +
      '{grup} · Vedruna Escorial Vic',
  };

  var COMODINS = [
    ['{nom}',        'el nom de l\'alumne (Marc)'],
    ['{elnom}',      'amb article (en Marc, la Maria, l\'Anna)'],
    ['{fill}',       'el vostre fill / la vostra filla'],
    ['{incidencia}', 'el que has escrit tu'],
    ['{mestra}',     'el teu nom'],
    ['{grup}',       'el grup (3r B)'],
  ];

  /* ---- El calaix del perfil ----
     ⚠ `_perfil` ES REEMPLAÇA SENCER quan arriba del full i també a
     l'arrencada. Per això aquí no es guarda MAI cap referència a
     `_perfil.incidencies`: es torna a buscar a cada crida. Si es
     guardés, el compte de la fitxa es quedaria amb el d'abans de
     carregar i la plantilla editada semblaria perduda. */
  function _calaix() {
    if (typeof _perfil === 'undefined' || !_perfil) return null;
    if (!_perfil.incidencies || typeof _perfil.incidencies !== 'object') _perfil.incidencies = {};
    return _perfil.incidencies;
  }

  function plantilla() {
    var c = _calaix();
    var p = (c && c.plantilla) || {};
    return {
      assumpte: p.assumpte || PLANTILLA_SERIE.assumpte,
      cos:      p.cos      || PLANTILLA_SERIE.cos,
    };
  }

  function _registre() {
    var c = _calaix();
    if (!c) return {};
    if (!c.registre || typeof c.registre !== 'object') c.registre = {};
    return c.registre;
  }

  /* Desar al perfil. Igual que fa `js/millores.js`: al navegador de
     seguida (perquè es vegi encara que no hi hagi connexió) i al full en
     segon pla, sense fer esperar ningú. */
  function _desa() {
    if (typeof _perfil === 'undefined' || !_perfil) return;
    try { localStorage.setItem('vedruna_perfil', JSON.stringify(_perfil)); } catch (e) {}
    try {
      if (typeof config !== 'undefined' && config && config.scriptUrl &&
          typeof appsScriptPost === 'function') {
        appsScriptPost({ action: 'saveProfile', profile: JSON.stringify(_perfil) }).catch(function () {});
      }
    } catch (e) {}
  }

  /* ---- Qui és qui ----
     ⚠ La clau de cada alumne és `grup + '#' + rowId`, la fila del full
     compartit, igual que les entrevistes. NO el `students[].id`: aquest
     últim és la posició dins la llista i canvia si els alumnes es
     reordenen, i llavors el compte d'un nen passaria a ser d'un altre. */
  function _grup() {
    try { return (typeof grupActual === 'function') ? grupActual() : null; } catch (e) { return null; }
  }

  function _clau(studentId) {
    var g = _grup();
    if (!g) return null;
    var rid = null;
    try { rid = (personal[studentId] || {}).rowId; } catch (e) {}
    if (rid === undefined || rid === null) return null;
    return g + '#' + String(rid);
  }

  function _alumne(studentId) {
    try {
      return (typeof students !== 'undefined' && students)
        ? students.find(function (x) { return String(x.id) === String(studentId); }) : null;
    } catch (e) { return null; }
  }

  function _de(studentId) {
    var k = _clau(studentId);
    if (!k) return [];
    var l = _registre()[k];
    return Array.isArray(l) ? l : [];
  }

  /* ---- Les adreces de la família ----
     Un sol camp del full de la secretaria en pot portar més d'una,
     separades com els hagi vingut de gust. Es parteixen per comes, punts
     i comes, barres i espais, i es treuen les repetides. */
  function correus(studentId) {
    var pd = {};
    try { pd = personal[studentId] || {}; } catch (e) {}
    var cru = [pd.correu1, pd.correu2].filter(function (c) { return c; }).join(' ');
    var vist = {}, fora = [];
    String(cru).split(/[,;/\s]+/).forEach(function (c) {
      var t = String(c || '').trim().replace(/[<>()]/g, '');
      if (!t || t.indexOf('@') === -1) return;
      var k = t.toLowerCase();
      if (vist[k]) return;
      vist[k] = 1; fora.push(t);
    });
    return fora;
  }

  /* ---- Encaixar el text dins la plantilla ---- */
  function _mestraNom() {
    try {
      if (typeof _perfil === 'undefined' || !_perfil) return '';
      return [(_perfil.nom || ''), (_perfil.cognom || '')].join(' ').trim();
    } catch (e) { return ''; }
  }

  function _omplePla(txt, studentId, incidencia) {
    var s = _alumne(studentId);
    var nom = s ? String(s.nom || '').split(' ')[0] : '';
    var fem = !!(s && s.genere === 'f');
    var article = '';
    try { article = (typeof _articleNom === 'function') ? _articleNom(nom, fem ? 'f' : 'm') : (fem ? 'la ' : 'en '); }
    catch (e) { article = fem ? 'la ' : 'en '; }

    return String(txt || '')
      .replace(/\{nomsencer\}/g, s ? String(s.nom || '') : '')
      .replace(/\{elnom\}/g, article + nom)
      .replace(/\{nom\}/g, nom)
      .replace(/\{fill\}/g, fem ? 'la vostra filla' : 'el vostre fill')
      .replace(/\{incidencia\}/g, String(incidencia || '').trim())
      .replace(/\{mestra\}/g, _mestraNom())
      .replace(/\{grup\}/g, _grup() || '');
  }

  /* ⚠ LA LÍNIA EN BLANC PENJADA AL FINAL DEL CORREU.

     El missatge s'acaba amb `{mestra}` i `{grup}`, cada un a la seva línia.
     Una mestra que encara no s'hagi posat el nom al perfil enviava un correu
     que s'acabava amb una línia buida on hi havia d'anar la seva signatura
     —i ella no ho sabria fins que algú li ho digués.

     Aquí, una línia que era NOMÉS comodins i que queda buida desapareix.
     Les línies que ella hagi deixat en blanc a posta no es toquen: només
     cauen les que el comodí havia d'omplir i no ha pogut. */
  function omple(txt, studentId, incidencia) {
    var linies = String(txt || '').split('\n');
    var fora = [];
    for (var i = 0; i < linies.length; i++) {
      var l = linies[i];
      var nomesComodins = /\{[a-z]+\}/.test(l) && !l.replace(/\{[a-z]+\}/g, '').trim();
      var plena = _omplePla(l, studentId, incidencia);
      if (nomesComodins && !plena.trim()) continue;
      fora.push(plena);
    }
    return fora.join('\n');
  }

  /* ============================================================
     EL BOTÓ DE LA TARGETA
     ------------------------------------------------------------
     El tercer botó, amb el mateix marc i la mateixa mida que els
     seus dos veïns. A dins, un cercle vermell ple amb l'exclamació
     blanca: blanc sobre #C0392B són 5,44:1 de contrast, o sigui que
     passa l'AA.

     ⚠ A la targeta NO hi va cap número ni cap marca, encara que
     aquell alumne en tingui deu. El compte va només a la fitxa. És a
     posta: la llista de la classe no ha d'ensenyar a qui s'ha hagut
     d'escriure a casa, i menys amb algú altre mirant la pantalla.
     ============================================================ */
  var SVG_BOTO =
    '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
      '<circle cx="12" cy="12" r="9" fill="#C0392B"/>' +
      '<path d="M12 7.5v5.5" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>' +
      '<circle cx="12" cy="16.6" r="1.25" fill="#fff"/>' +
    '</svg>';

  function afegeixBotoTargeta(card, s) {
    if (!_hiEs() || !card || !s) return;
    var zona = card.querySelector('.alumne-card-actions');
    if (!zona || zona.querySelector('.inc-card-btn')) return;

    var nom = '';
    try { nom = (typeof nomAlumne === 'function') ? nomAlumne(s) : String(s.nom || ''); } catch (e) {}

    var b = document.createElement('button');
    b.className = 'alumne-card-btn inc-card-btn';
    b.type = 'button';
    b.setAttribute('aria-label', 'Avisar la família de ' + nom + ' d\'una incidència');
    b.title = 'Avisar la família d\'una incidència';
    b.innerHTML = SVG_BOTO;
    b.addEventListener('click', function (e) { e.stopPropagation(); obre(s.id); });
    zona.appendChild(b);
  }

  /* ============================================================
     L'APARTAT DE LA FITXA
     ============================================================ */
  function pintaFitxa(studentId) {
    var card = document.getElementById('fitxaIncidenciesCard');
    var cont = document.getElementById('fitxaIncidencies');
    if (!card || !cont) return;

    if (!_hiEs()) { card.style.display = 'none'; return; }
    card.style.display = '';
    cont.setAttribute('data-alumne', String(studentId));

    if (!_grup()) {
      cont.innerHTML = '<p class="fitxa-empty-field">Les incidències són del grup que tutoritzes.</p>';
      return;
    }
    if (!_clau(studentId)) {
      cont.innerHTML = '<p class="fitxa-empty-field">Aquest alumne encara no és al full del grup.</p>';
      return;
    }

    var l = _de(studentId).slice().sort(function (a, b) {
      return String(b.data || '').localeCompare(String(a.data || ''));
    });

    var html = '';
    if (l.length) {
      html += '<p class="inc-compte">' +
              '<strong>' + l.length + '</strong> ' +
              (l.length === 1 ? 'incidència comunicada' : 'incidències comunicades') +
              ' a la família</p>';
      html += '<ul class="inc-llista">' + l.map(function (it) {
        return '<li class="inc-item">' +
                 '<div class="inc-item-cap">' +
                   '<span class="inc-data">' + escapeHtml(_dataText(it.data)) + '</span>' +
                   '<button class="inc-mini inc-mini-x" type="button" title="Esborrar del registre"' +
                     ' onclick="incEsborra(' + Number(studentId) + ',\'' + _idJs(it.id) + '\')">×</button>' +
                 '</div>' +
                 (it.text ? '<div class="inc-text">' + escapeHtml(it.text) + '</div>' : '') +
               '</li>';
      }).join('') + '</ul>';
    } else {
      html += '<p class="fitxa-empty-field">No s\'ha comunicat cap incidència a aquesta família.</p>';
    }

    html += '<button class="btn btn-secondary btn-sm inc-afegir" type="button"' +
            ' onclick="incObre(' + Number(studentId) + ')">+ Avisar la família</button>';
    cont.innerHTML = html;
  }

  function _dataText(d) {
    if (!d) return '';
    var p = String(d).split('-');
    if (p.length !== 3) return String(d);
    var MESOS = ['gener','febrer','març','abril','maig','juny','juliol','agost','setembre','octubre','novembre','desembre'];
    var mes = MESOS[+p[1] - 1] || '';
    var de = (typeof dePreposicio === 'function') ? dePreposicio(mes) : 'de ' + mes;
    return (+p[2]) + ' ' + de + ' de ' + p[0];
  }

  /* Repintar quan arriba el perfil del full.
     ⚠ Aquest és el bug que t'espera si no es fa: s'obre la fitxa, es
     pinta amb el perfil que hi havia al navegador, i un segon després
     arriba el del full amb una incidència més. Sense això, el compte es
     queda amb el d'abans fins que surt i torna a entrar. */
  function refresca() {
    try {
      var cont = document.getElementById('fitxaIncidencies');
      if (!cont) return;
      var id = cont.getAttribute('data-alumne');
      if (id === null || id === '') return;
      var pag = document.getElementById('page-fitxa');
      if (pag && pag.classList.contains('page-hidden')) return;
      pintaFitxa(Number(id));
    } catch (e) {}
  }

  /* ============================================================
     LA FINESTRA
     ============================================================ */
  var _alumneObert = null;

  function obre(studentId) {
    if (!_hiEs()) return;
    _alumneObert = studentId;

    var ov = document.getElementById('incOverlay') || _muntaModal();
    var s = _alumne(studentId);
    var nom = '';
    try { nom = (typeof nomAlumne === 'function' && s) ? nomAlumne(s) : (s ? String(s.nom || '') : ''); } catch (e) {}
    document.getElementById('incSub').textContent = nom + (_grup() ? ' · ' + _grup() : '');

    document.getElementById('incText').value = '';
    _mostraPlantilla(false);

    /* ⚠ Si la fitxa no té cap correu, es diu EN OBRIR i on s'arregla, i
       el botó d'enviar neix blocat. Deixar-la escriure-ho tot i fallar al
       final és pitjor que no deixar-la començar. */
    var adr = correus(studentId);
    var zona = document.getElementById('incDesti');
    var btn = document.getElementById('incEnvia');
    if (adr.length) {
      zona.className = 'inc-desti';
      zona.innerHTML = adr.map(function (c) {
        return '<span class="inc-chip">' + escapeHtml(c) + '</span>';
      }).join('');
      btn.disabled = false;
    } else {
      zona.className = 'inc-desti inc-desti-buit';
      zona.innerHTML = 'A la fitxa d\'aquest alumne no hi ha cap correu de la família, ' +
                       'o sigui que no es pot enviar res. Els correus surten del full de ' +
                       'la secretaria: si hi han de ser i no hi són, digues-ho a secretaria.';
      btn.disabled = true;
    }

    _pintaPrevia();
    ov.classList.add('open');
    setTimeout(function () { try { document.getElementById('incText').focus(); } catch (e) {} }, 80);
  }

  function tanca() {
    var ov = document.getElementById('incOverlay');
    if (ov) ov.classList.remove('open');
  }

  /* La previsualització: el correu sencer, tal com el rebrà la família,
     amb el que ella va escrivint ja encaixat a dins. Es repinta a cada
     tecla. El motiu de tenir-la: sense veure-ho, el primer cop que algú
     obre el Gmail es troba un text que no s'esperava. */
  function _pintaPrevia() {
    var pr = document.getElementById('incPrevia');
    if (!pr || _alumneObert === null) return;
    var p = plantilla();
    var txt = document.getElementById('incText');
    var escrit = txt ? txt.value : '';
    var cos = omple(p.cos, _alumneObert, escrit || '…');
    pr.innerHTML =
      '<div class="inc-previa-assumpte"><span>Assumpte</span> ' +
        escapeHtml(omple(p.assumpte, _alumneObert, escrit)) + '</div>' +
      '<div class="inc-previa-cos">' + escapeHtml(cos) + '</div>';
  }

  /* ---- L'editor de la part fixa ---- */
  function _mostraPlantilla(si) {
    var zona = document.getElementById('incPlantilla');
    var bot = document.getElementById('incPlantillaBoto');
    if (!zona || !bot) return;
    zona.style.display = si ? '' : 'none';
    bot.textContent = si ? 'Deixar-ho estar' : 'Canviar el missatge de sèrie';
    if (si) {
      var p = plantilla();
      document.getElementById('incPlAssumpte').value = p.assumpte;
      document.getElementById('incPlCos').value = p.cos;
    }
  }

  function plantillaAlterna() {
    var zona = document.getElementById('incPlantilla');
    if (!zona) return;
    _mostraPlantilla(zona.style.display === 'none');
  }

  function plantillaDesa() {
    var c = _calaix();
    if (!c) { showToast('Encara no s\'ha carregat el teu perfil. Prova-ho d\'aquí a un moment.', 'error'); return; }
    var a = document.getElementById('incPlAssumpte').value;
    var b = document.getElementById('incPlCos').value;
    if (!String(b || '').trim()) { showToast('El missatge no pot quedar buit', 'error'); return; }
    if (String(b).indexOf('{incidencia}') === -1) {
      showToast('Hi ha de ser {incidencia}: és on s\'encaixa el que escrius de cada cas.', 'error');
      return;
    }
    c.plantilla = { assumpte: String(a || '').trim() || PLANTILLA_SERIE.assumpte, cos: b };
    _desa();
    _mostraPlantilla(false);
    _pintaPrevia();
    showToast('Missatge desat ✓', 'success');
  }

  function plantillaSerie() {
    if (!confirm('Vols tornar al missatge de sèrie? El que hi has escrit tu es perdrà.')) return;
    var c = _calaix();
    if (c) { delete c.plantilla; _desa(); }
    _mostraPlantilla(true);
    _pintaPrevia();
    showToast('Tornat al de sèrie', 'success');
  }

  /* ============================================================
     OBRIR EL GMAIL
     ------------------------------------------------------------
     L'app no envia res: prepara el redactor i ella l'envia. El
     `window.open` cap al Gmail el pot barrar el navegador (bloqueig
     de finestres), i per això hi ha el `mailto:` com a reserva: amb
     ell s'obre el programa de correu que tingui posat.
     ============================================================ */
  function envia() {
    if (_alumneObert === null) return;
    var studentId = _alumneObert;

    var adr = correus(studentId);
    if (!adr.length) { showToast('No hi ha cap correu de la família', 'error'); return; }

    var txt = document.getElementById('incText');
    var escrit = String(txt ? txt.value : '').trim();
    if (!escrit) {
      showToast('Escriu què ha passat', 'error');
      if (txt) txt.focus();
      return;
    }

    var p = plantilla();
    var assumpte = omple(p.assumpte, studentId, escrit);
    var cos = omple(p.cos, studentId, escrit);

    var to = adr.join(',');
    var url = 'https://mail.google.com/mail/?view=cm&fs=1' +
              '&to=' + encodeURIComponent(to) +
              '&su=' + encodeURIComponent(assumpte) +
              '&body=' + encodeURIComponent(cos);

    var f = null;
    try { f = window.open(url, '_blank'); } catch (e) {}
    if (!f) {
      try {
        window.location.href = 'mailto:' + encodeURIComponent(to) +
          '?subject=' + encodeURIComponent(assumpte) +
          '&body=' + encodeURIComponent(cos);
      } catch (e) {
        showToast('El navegador no ha deixat obrir el correu. Mira si té les finestres blocades.', 'error');
        return;
      }
    }

    /* El registre se suma ARA, en obrir el Gmail: si la família el rep o
       no, això no hi ha manera de saber-ho des d'aquí. Per això cada
       incidència es pot esborrar de la fitxa i el rètol ho diu. */
    apunta(studentId, escrit);
    tanca();
    showToast('El Gmail s\'ha obert amb el correu escrit. Revisa\'l i envia\'l tu.', 'info');
  }

  function apunta(studentId, text) {
    var k = _clau(studentId);
    if (!k) return;
    var reg = _registre();
    if (!Array.isArray(reg[k])) reg[k] = [];
    var avui = new Date();
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    reg[k].push({
      id: 'i' + Date.now() + Math.random().toString(36).slice(2, 6),
      data: avui.getFullYear() + '-' + p(avui.getMonth() + 1) + '-' + p(avui.getDate()),
      text: String(text || ''),
    });
    _desa();
    pintaFitxa(studentId);
  }

  function esborra(studentId, id) {
    var k = _clau(studentId);
    if (!k) return;
    var reg = _registre();
    var l = Array.isArray(reg[k]) ? reg[k] : [];
    var it = l.find(function (x) { return String(x.id) === String(id); });
    if (!it) return;
    if (!confirm('Vols esborrar del registre la incidència del ' + _dataText(it.data) + '?\n\n' +
                 'Això només treu l\'apunt d\'aquí: el correu que vas enviar a la família no es desfà.')) return;
    reg[k] = l.filter(function (x) { return String(x.id) !== String(id); });
    if (!reg[k].length) delete reg[k];
    _desa();
    pintaFitxa(studentId);
    showToast('Esborrada del registre', 'success');
  }

  function _muntaModal() {
    var ov = document.createElement('div');
    ov.className = 'modal-overlay';
    ov.id = 'incOverlay';
    ov.addEventListener('mousedown', function (e) { if (e.target === ov) tanca(); });
    ov.innerHTML =
      '<div class="modal" style="max-width:620px">' +
        '<div class="modal-header">' +
          '<div>' +
            '<div class="modal-header-title">Avisar la família d\'una incidència</div>' +
            '<div class="modal-header-sub" id="incSub"></div>' +
          '</div>' +
          '<button class="modal-close" type="button" onclick="incTanca()" aria-label="Tancar">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>' +
          '</button>' +
        '</div>' +
        '<div class="modal-body">' +
          '<div class="modal-field">' +
            '<label class="modal-label">A qui anirà</label>' +
            '<div id="incDesti" class="inc-desti"></div>' +
          '</div>' +
          '<div class="modal-field">' +
            '<label class="modal-label" for="incText">Què ha passat</label>' +
            '<textarea class="modal-input" id="incText" rows="4" ' +
              'placeholder="Ex: Aquest migdia, al pati, hi ha hagut una discussió amb un company que ha acabat amb empentes."></textarea>' +
            '<div class="modal-hint">Dues línies n\'hi ha prou. Això és l\'únic que canvia de cada cas: la resta del correu ja està escrita.</div>' +
          '</div>' +
          '<div class="modal-field">' +
            '<label class="modal-label">Com quedarà el correu</label>' +
            '<div id="incPrevia" class="inc-previa"></div>' +
            '<button class="inc-mini" type="button" id="incPlantillaBoto" onclick="incPlantillaAlterna()">Canviar el missatge de sèrie</button>' +
          '</div>' +
          '<div id="incPlantilla" class="inc-plantilla" style="display:none">' +
            '<div class="modal-field">' +
              '<label class="modal-label" for="incPlAssumpte">Assumpte</label>' +
              '<input class="modal-input" id="incPlAssumpte" type="text">' +
            '</div>' +
            '<div class="modal-field">' +
              '<label class="modal-label" for="incPlCos">El missatge</label>' +
              '<textarea class="modal-input" id="incPlCos" rows="12"></textarea>' +
              '<div class="modal-hint">El que escriguis aquí es queda desat i serveix per a totes les famílies. ' +
                'El que va entre claus l\'omple l\'app sola:</div>' +
              '<ul class="inc-comodins">' +
                COMODINS.map(function (c) {
                  return '<li><code>' + escapeHtml(c[0]) + '</code> ' + escapeHtml(c[1]) + '</li>';
                }).join('') +
              '</ul>' +
            '</div>' +
            '<div class="inc-plantilla-accions">' +
              '<button class="btn btn-secondary btn-sm" type="button" onclick="incPlantillaSerie()">Tornar a la de sèrie</button>' +
              '<button class="btn btn-primary btn-sm" type="button" onclick="incPlantillaDesa()">Desar el missatge</button>' +
            '</div>' +
          '</div>' +
          '<div class="callout-mini inc-avis">' +
            'L\'app <strong>no envia res</strong>: obre el Gmail amb el correu escrit i l\'envies tu. ' +
            'A la fitxa de l\'alumne hi quedarà l\'apunt, amb la data i el que hi has escrit.' +
          '</div>' +
        '</div>' +
        '<div class="modal-footer">' +
          '<button class="btn btn-secondary" type="button" onclick="incTanca()">Cancel·lar</button>' +
          '<button class="btn btn-primary" type="button" id="incEnvia" onclick="incEnvia()">Obrir el Gmail</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(ov);
    /* El repintat de la previsualització va per oient i no per atribut:
       així no hi ha cap `oninput` escrit a dins d'una cadena que un dia
       es pugui quedar buit sense que ningú ho vegi. */
    ov.querySelector('#incText').addEventListener('input', _pintaPrevia);
    return ov;
  }

  /* ---- Les funcions que criden els botons ----
     Van a `window` a posta: els `onclick` de les plantilles de dalt les
     han de poder trobar, i així `eines/comprova-controls.js` pot
     comprovar que existeixen de debò. */
  window.incObre = obre;
  window.incTanca = tanca;
  window.incEnvia = envia;
  window.incEsborra = esborra;
  window.incPlantillaAlterna = plantillaAlterna;
  window.incPlantillaDesa = plantillaDesa;
  window.incPlantillaSerie = plantillaSerie;

  /* ---- El que crida l'app ---- */
  window.Incidencies = {
    hiEs: _hiEs,
    afegeixBotoTargeta: afegeixBotoTargeta,
    pintaFitxa: pintaFitxa,
    refresca: refresca,
    correus: correus,
    omple: omple,
    plantilla: plantilla,
    plantillaSerie: PLANTILLA_SERIE,
    de: _de,
    clau: _clau,
    apunta: apunta,
  };
})();
