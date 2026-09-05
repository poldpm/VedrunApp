/* ============================================================
   PERSONALITZACIONS DE POL — personal.js
   ------------------------------------------------------------
   A l'app MARE aquest fitxer és BUIT a posta. A l'app de cada
   mestra hi va tot el que és seu i només seu.

   Es carrega l'ÚLTIM de tots, quan la resta de l'app ja hi és,
   i `sync-filla.js` no el trepitja mai: així una mestra es pot
   personalitzar tant com calgui sense que cap fitxer del base
   divergeixi, i continua rebent tots els arranjaments.

   ⚠ La regla que ho fa sostenible: **el que sigui per a ella, aquí.**
   Si es toca `app.js`, `perfil.js` o `notes.js` dins de la seva
   carpeta, aquell fitxer deixa de rebre arranjaments per sempre.

   ------------------------------------------------------------
   COM S'HI FAN LES COSES

   Embolcallar una funció que ja existeix, sense modificar-la:

     var orig = window.perfilSave;
     window.perfilSave = function () {
       var r = orig.apply(this, arguments);
       ferLaMevaCosa();
       return r;
     };

   Canviar una pantalla sencera: redefinir la funció que la pinta.
   Afegir una eina nova: escriure-la aquí i penjar-la del menú.

   Si el que necessita una mestra el necessitaran també les altres,
   val més fer-ho **opció al base per a tothom** que repetir-ho a
   cada app (com ja es va fer amb els objectius, l'estil dels
   comentaris, els aspectes d'actitud i els enllaços).

   Veure FILLES.md.
   ============================================================ */


/* ============================================================
   INCIDÈNCIES A LA FAMÍLIA — només a l'app d'en Pol
   ------------------------------------------------------------
   A cada targeta d'alumne hi ha un tercer botó: un cercle vermell
   amb una exclamació blanca. El prems, escrius què ha passat, i
   s'obre el Gmail amb el correu ja escrit i les adreces de la
   família posades. NO s'envia sol: el revises i l'envies tu.

   A la fitxa de l'alumne hi ha el compte de les que li has
   comunicat, amb la data i el que hi vas escriure.

   ON ES DESA: dins del perfil (`_perfil.incidencies`), que ja
   viatja sencer al full de càlcul. Per això NO cal tocar el
   `Code.gs` ni redesplegar res.

   ⚠ Tot això s'enganxa per sobre del codi base: no hi ha ni una
   línia d'`app.js` tocada, o sigui que aquesta app continua
   rebent tots els arranjaments de la plantilla.
   ============================================================ */
(function () {
  'use strict';

  var PLANTILLA_ASSUMPTE = 'Incidència a l’escola · {nom}';
  var PLANTILLA_COS = [
    'Benvolguda família,',
    '',
    'Us escric aquest correu per informar-vos que avui {fill} {incidencia}',
    '',
    'Esperem que en parleu a casa i vetlleu per tal que aquest fet no es torni a repetir. Des de l’escola hem gestionat el conflicte i dut a terme totes les dinàmiques i protocols necessaris per tal que aquest fet no es repeteixi i, sobretot, se n’obtingui un aprenentatge. Tot i això, és necessari que a casa també se’n faci pedagogia i es posi solució a aquesta situació.',
    '',
    'Resto a la vostra disposició per parlar-ne personalment a la sortida de l’escola o en una entrevista, si és el que preferiu.',
    '',
    'Moltes gràcies per avançat.'
  ].join('\n');

  var _alumneObert = null;   // a qui estem escrivint ara mateix

  /* ---------- utilitats ---------- */

  function esc(s) {
    if (typeof escapeHtml === 'function') return escapeHtml(s == null ? '' : s);
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function avis(text, tipus) {
    if (typeof showToast === 'function') showToast(text, tipus || 'info');
  }

  function alumneDe(id) {
    if (typeof students === 'undefined' || !Array.isArray(students)) return null;
    for (var i = 0; i < students.length; i++) {
      if (String(students[i].id) === String(id)) return students[i];
    }
    return null;
  }

  /* La clau amb què desem les seves incidències. Fem servir la fila del full
     compartit (com les entrevistes): així sobreviu que es reordenin els
     alumnes. Si encara no en té, ens agafem al nom. */
  function clau(studentId) {
    var pd = (typeof personal !== 'undefined' && personal[studentId]) || {};
    var grup = (typeof grupActual === 'function' && grupActual()) || '';
    if (pd.rowId !== undefined && pd.rowId !== null && pd.rowId !== '') {
      return grup + '#' + pd.rowId;
    }
    var a = alumneDe(studentId);
    return grup + '#nom:' + ((a && a.nom) || studentId);
  }

  /* El magatzem viu dins del perfil. El llegim SEMPRE en directe: el perfil
     es reemplaça sencer quan arriba del full, i guardar-nos-en una còpia ens
     deixaria ensenyant les dades d'abans de carregar. */
  function magatzem() {
    if (typeof _perfil === 'undefined' || !_perfil || typeof _perfil !== 'object') return null;
    if (!_perfil.incidencies || typeof _perfil.incidencies !== 'object') {
      _perfil.incidencies = { plantilla: null, registre: {} };
    }
    if (!_perfil.incidencies.registre || typeof _perfil.incidencies.registre !== 'object') {
      _perfil.incidencies.registre = {};
    }
    return _perfil.incidencies;
  }

  function llistaDe(studentId) {
    var m = magatzem();
    if (!m) return [];
    var l = m.registre[clau(studentId)];
    return Array.isArray(l) ? l : [];
  }

  function plantilla() {
    var m = magatzem();
    var p = (m && m.plantilla) || null;
    return {
      assumpte: (p && typeof p.assumpte === 'string' && p.assumpte.trim()) ? p.assumpte : PLANTILLA_ASSUMPTE,
      cos:      (p && typeof p.cos === 'string' && p.cos.trim())           ? p.cos      : PLANTILLA_COS
    };
  }

  function desa() {
    if (typeof _perfil === 'undefined' || !_perfil) return Promise.resolve(false);
    try { localStorage.setItem('vedruna_perfil', JSON.stringify(_perfil)); } catch (e) {}
    if (typeof config === 'undefined' || !config || !config.scriptUrl) return Promise.resolve(true);
    return appsScriptPost({ action: 'saveProfile', profile: JSON.stringify(_perfil) })
      .then(function (r) { return !!(r && r.ok); })
      .catch(function () { return false; });
  }

  /* Els correus de la família. Els camps poden portar-ne més d'un separats per
     comes, punts i comes o espais: els partim tots i traiem els repetits. */
  function correusDe(studentId) {
    var pd = (typeof personal !== 'undefined' && personal[studentId]) || {};
    var brut = [pd.emailMare || '', pd.emailPare || ''].join(' ');
    var vistos = {}, sortida = [];
    brut.split(/[\s,;]+/).forEach(function (t) {
      var e = t.trim();
      if (!e) return;
      var arrova = e.indexOf('@');
      if (arrova < 1 || e.indexOf('.', arrova) < 0) return;
      var k = e.toLowerCase();
      if (vistos[k]) return;
      vistos[k] = 1;
      sortida.push(e);
    });
    return sortida;
  }

  function fillOFilla(alumne) {
    return (alumne && alumne.genere === 'f') ? 'la vostra filla' : 'el vostre fill';
  }

  function dataAvui() {
    var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  var MESOS = ['gener', 'febrer', 'març', 'abril', 'maig', 'juny',
               'juliol', 'agost', 'setembre', 'octubre', 'novembre', 'desembre'];
  function dataText(iso) {
    var p = String(iso || '').split('-');
    if (p.length !== 3) return iso || '';
    return (+p[2]) + ' de ' + (MESOS[+p[1] - 1] || '');
  }

  /* Munta el correu final a partir de la plantilla. */
  function redacta(studentId, textIncidencia) {
    var a = alumneDe(studentId), pl = plantilla();
    var nom = (a && a.nom) || '';
    var subs = function (s) {
      return String(s)
        .replace(/\{fill\}/g, fillOFilla(a))
        .replace(/\{nom\}/g, nom)
        .replace(/\{incidencia\}/g, textIncidencia || '');
    };
    return { assumpte: subs(pl.assumpte), cos: subs(pl.cos) };
  }

  /* ---------- l'aspecte ---------- */

  function posaCss() {
    if (document.getElementById('polIncCss')) return;
    var st = document.createElement('style');
    st.id = 'polIncCss';
    st.textContent = [
      /* El botó de la targeta: la mateixa mida i el mateix marc que els seus
         dos veïns, perquè la fila segueixi sent una fila. El que crida
         l'atenció és el cercle de dins, no el botó. */
      '.pol-inc-btn{width:30px;height:30px;border:1px solid var(--border);background:var(--surface);',
      ' border-radius:7px;display:flex;align-items:center;justify-content:center;cursor:pointer;',
      ' position:relative;padding:0;',
      ' transition:border-color .2s cubic-bezier(.4,0,.2,1),background-color .2s cubic-bezier(.4,0,.2,1),transform .12s cubic-bezier(.23,1,.32,1)}',
      '.pol-inc-btn svg{width:16px;height:16px;display:block}',
      '.pol-inc-btn:hover{border-color:#C0392B;background:#FDF3F2}',
      '.pol-inc-btn:active{transform:scale(.94)}',
      '.pol-inc-btn:focus-visible{outline:2px solid #C0392B;outline-offset:2px}',
      '.pol-inc-btn.te-cap{border-color:#E8BDB7;background:#FDF3F2}',
      '.pol-inc-comptador{position:absolute;top:-4px;right:-4px;min-width:15px;height:15px;padding:0 3px;',
      ' border-radius:8px;background:#C0392B;color:#fff;font-size:9px;font-weight:800;line-height:15px;',
      ' text-align:center;box-shadow:0 0 0 2px var(--surface-tint)}',

      /* L'apartat de la fitxa */
      '.pol-inc-llista{list-style:none;margin:0 0 12px;padding:0}',
      '.pol-inc-item{padding:9px 0;border-bottom:1px solid var(--border)}',
      '.pol-inc-item:last-child{border-bottom:none}',
      '.pol-inc-cap{display:flex;align-items:center;gap:10px;justify-content:space-between}',
      '.pol-inc-data{font-size:12px;font-weight:700;color:var(--text-sub)}',
      '.pol-inc-text{font-size:13px;color:var(--text-main);line-height:1.55;margin-top:3px;white-space:pre-wrap}',
      '.pol-inc-total{font-size:13px;color:var(--text-sub);margin:0 0 10px}',
      '.pol-inc-total b{color:#C0392B;font-size:15px}',

      /* El formulari */
      '.pol-inc-plega{display:none}',
      '.pol-inc-plega.obert{display:block}',
      '.pol-inc-enllac{background:none;border:none;padding:0;font:inherit;font-size:12px;font-weight:600;',
      ' color:var(--crimson);cursor:pointer;text-decoration:underline;text-underline-offset:2px}',
      '.pol-inc-enllac:focus-visible{outline:2px solid var(--crimson);outline-offset:2px;border-radius:3px}',
      '.pol-inc-previ{background:var(--surface-alt);border:1px solid var(--border);border-radius:var(--r-sm);',
      ' padding:11px 13px;font-size:12.5px;line-height:1.6;color:var(--text-main);white-space:pre-wrap;',
      ' max-height:190px;overflow:auto}',
      '.pol-inc-previ:focus-visible{outline:2px solid var(--crimson);outline-offset:2px}',
      '.pol-inc-per-a{font-size:12px;color:var(--text-sub);margin-top:6px;word-break:break-word}',
      '.pol-inc-sensecorreu{font-size:12.5px;line-height:1.55;color:#8A3A2F;background:#FDF3F2;',
      ' border:1px solid #E8BDB7;border-radius:var(--r-sm);padding:10px 12px}',
      '@media (prefers-reduced-motion: reduce){.pol-inc-btn{transition:none}.pol-inc-btn:active{transform:none}}'
    ].join('');
    (document.head || document.documentElement || document.body).appendChild(st);
  }

  /* El cercle vermell amb l'exclamació blanca a dins. */
  function icona() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
             '<circle cx="12" cy="12" r="10" fill="#C0392B"/>' +
             '<path d="M12 6.6v7.1" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>' +
             '<circle cx="12" cy="17.5" r="1.45" fill="#fff"/>' +
           '</svg>';
  }

  /* ---------- el botó a cada targeta ---------- */

  function posaBotons() {
    var cont = document.getElementById('alumnesList');
    if (!cont || typeof students === 'undefined' || !Array.isArray(students)) return;
    var targetes = cont.querySelectorAll('.alumne-card');
    for (var i = 0; i < targetes.length; i++) {
      var s = students[i];
      if (!s) continue;
      var accions = targetes[i].querySelector('.alumne-card-actions');
      if (!accions) continue;

      var n = llistaDe(s.id).length;
      var b = accions.querySelector('.pol-inc-btn');
      if (!b) {
        b = document.createElement('button');
        b.type = 'button';
        b.className = 'pol-inc-btn';
        accions.appendChild(b);
        b.addEventListener('click', function (e) {
          e.stopPropagation();
          obre(this.getAttribute('data-alumne'));
        });
      }
      b.setAttribute('data-alumne', String(s.id));
      b.className = 'pol-inc-btn' + (n ? ' te-cap' : '');
      b.title = n
        ? (n === 1 ? '1 incidència comunicada · comunicar-ne una altra'
                   : n + ' incidències comunicades · comunicar-ne una altra')
        : 'Comunicar una incidència a la família';
      b.setAttribute('aria-label', 'Comunicar una incidència a la família de ' + s.nom +
                                   (n ? ' (ja se n’han comunicat ' + n + ')' : ''));
      b.innerHTML = icona() + (n ? '<span class="pol-inc-comptador">' + (n > 9 ? '9+' : n) + '</span>' : '');
    }
  }

  /* ---------- l'apartat de la fitxa ---------- */

  function posaSeccioFitxa(studentId) {
    var ancora = document.getElementById('fitxaEntrevistes');
    if (!ancora || !ancora.closest) return;
    var germana = ancora.closest('.fitxa-card');
    if (!germana || !germana.parentNode) return;

    var card = document.getElementById('polIncCard');
    if (!card) {
      card = document.createElement('div');
      card.className = 'fitxa-card';
      card.id = 'polIncCard';
      card.style.marginTop = '12px';
      card.innerHTML =
        '<div class="fitxa-card-header">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">' +
            '<circle cx="12" cy="12" r="10"/><path d="M12 7.5v5.5"/><path d="M12 16.4v.6"/>' +
          '</svg>' +
          'Incidències comunicades a la família' +
        '</div>' +
        '<div class="fitxa-card-body" id="polIncBody"></div>';
      germana.parentNode.insertBefore(card, germana.nextSibling);
      /* Un sol vigilant per a tot l'apartat: així els botons segueixen
         funcionant encara que el tornem a pintar sencer. */
      card.addEventListener('click', function (e) {
        var b = e.target && e.target.closest ? e.target.closest('[data-inc-accio]') : null;
        if (!b) return;
        var accio = b.getAttribute('data-inc-accio');
        if (accio === 'nova') obre(b.getAttribute('data-alumne'));
        else if (accio === 'esborra') esborra(b.getAttribute('data-alumne'), b.getAttribute('data-id'));
      });
    }
    pintaSeccioFitxa(studentId);
  }

  function pintaSeccioFitxa(studentId) {
    var body = document.getElementById('polIncBody');
    if (!body || studentId === null || studentId === undefined || studentId === '') return;
    body.setAttribute('data-alumne', String(studentId));

    var l = llistaDe(studentId).slice().sort(function (a, b) {
      return String(b.data || '').localeCompare(String(a.data || ''));
    });

    var cap = l.length
      ? '<p class="pol-inc-total"><b>' + l.length + '</b> ' +
        (l.length === 1 ? 'incidència comunicada a aquesta família'
                        : 'incidències comunicades a aquesta família') + '</p>'
      : '';

    var llista = l.length
      ? '<ul class="pol-inc-llista">' + l.map(function (x) {
          return '<li class="pol-inc-item">' +
                   '<div class="pol-inc-cap">' +
                     '<span class="pol-inc-data">' + esc(dataText(x.data)) + '</span>' +
                     '<button type="button" class="entr-mini entr-mini-x" data-inc-accio="esborra" ' +
                       'data-alumne="' + esc(studentId) + '" data-id="' + esc(x.id) + '" ' +
                       'title="Esborrar aquesta incidència" ' +
                       'aria-label="Esborrar la incidència del ' + esc(dataText(x.data)) + '">×</button>' +
                   '</div>' +
                   (x.text ? '<div class="pol-inc-text">' + esc(x.text) + '</div>' : '') +
                 '</li>';
        }).join('') + '</ul>'
      : '<p class="fitxa-empty-field">Encara no se n’ha comunicat cap a aquesta família.</p>';

    body.innerHTML = cap + llista +
      '<button type="button" class="btn btn-secondary btn-sm" data-inc-accio="nova" ' +
        'data-alumne="' + esc(studentId) + '">+ Comunicar una incidència</button>';
  }

  /* ---------- el formulari ---------- */

  function muntaModal() {
    var ov = document.createElement('div');
    ov.className = 'modal-overlay';
    ov.id = 'polIncOverlay';
    ov.innerHTML =
      '<div class="modal" style="max-width:560px" role="dialog" aria-modal="true" aria-labelledby="polIncTitol">' +
        '<div class="modal-header">' +
          '<div>' +
            '<div class="modal-header-title" id="polIncTitol">Comunicar una incidència</div>' +
            '<div class="modal-header-sub" id="polIncSub"></div>' +
          '</div>' +
          '<button class="modal-close" id="polIncX" type="button" aria-label="Tancar">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
              '<path d="M18 6L6 18M6 6l12 12"/>' +
            '</svg>' +
          '</button>' +
        '</div>' +
        '<div class="modal-body">' +
          '<div id="polIncCapCorreus"></div>' +
          '<div class="modal-field">' +
            '<label class="modal-label" for="polIncText">Què ha passat</label>' +
            '<textarea class="modal-input" id="polIncText" rows="3" ' +
              'placeholder="Ex: ha faltat al respecte a una companya i s’ha negat a demanar-li disculpes."></textarea>' +
            '<div class="modal-hint">Continua la frase «avui el vostre fill…»: comença en minúscula i acaba amb un punt.</div>' +
          '</div>' +
          '<div class="modal-field">' +
            '<label class="modal-label" for="polIncPrevi">Com quedarà el correu</label>' +
            '<div class="pol-inc-previ" id="polIncPrevi" tabindex="0" role="region" aria-live="polite"></div>' +
            '<div class="pol-inc-per-a" id="polIncPerA"></div>' +
          '</div>' +
          '<div class="modal-field">' +
            '<button type="button" class="pol-inc-enllac" id="polIncObreEditor" aria-expanded="false" ' +
              'aria-controls="polIncEditor">Canviar el missatge que s’envia</button>' +
            '<div class="pol-inc-plega" id="polIncEditor" style="margin-top:10px">' +
              '<label class="modal-label" for="polIncAssumpte">Assumpte</label>' +
              '<input class="modal-input" id="polIncAssumpte" type="text">' +
              '<label class="modal-label" for="polIncCos" style="margin-top:10px">Text del correu</label>' +
              '<textarea class="modal-input" id="polIncCos" rows="10"></textarea>' +
              '<div class="modal-hint">Hi pots fer servir <code>{fill}</code> (hi surt «el vostre fill» o ' +
                '«la vostra filla» segons el gènere de la fitxa), <code>{incidencia}</code> (el que has ' +
                'escrit a dalt) i <code>{nom}</code> (el nom de l’alumne). El canvi es desa sol i val ' +
                'per a tots els correus següents.</div>' +
              '<button type="button" class="pol-inc-enllac" id="polIncRestaura" style="margin-top:9px">' +
                'Tornar al missatge de sempre</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="modal-footer">' +
          '<button class="btn btn-secondary" type="button" id="polIncCancela">Cancel·lar</button>' +
          '<button class="btn btn-primary" type="button" id="polIncEnvia">Obrir el Gmail</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(ov);

    ov.addEventListener('mousedown', function (e) { if (e.target === ov) tanca(); });
    ov.querySelector('#polIncX').addEventListener('click', tanca);
    ov.querySelector('#polIncCancela').addEventListener('click', tanca);
    ov.querySelector('#polIncEnvia').addEventListener('click', obreGmail);
    ov.querySelector('#polIncText').addEventListener('input', pintaPrevi);
    ov.querySelector('#polIncAssumpte').addEventListener('input', guardaPlantillaViva);
    ov.querySelector('#polIncCos').addEventListener('input', guardaPlantillaViva);
    ov.querySelector('#polIncRestaura').addEventListener('click', restauraPlantilla);
    ov.querySelector('#polIncObreEditor').addEventListener('click', function () {
      var ed = document.getElementById('polIncEditor');
      var obert = ed.classList.toggle('obert');
      this.setAttribute('aria-expanded', obert ? 'true' : 'false');
      this.textContent = obert ? 'Amagar el missatge' : 'Canviar el missatge que s’envia';
      if (obert) document.getElementById('polIncAssumpte').focus();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      var o = document.getElementById('polIncOverlay');
      if (o && o.classList.contains('open')) tanca();
    });
    return ov;
  }

  function obre(studentId) {
    if (studentId === null || studentId === undefined || studentId === '') return;
    var a = alumneDe(studentId);
    if (!a) { avis('No trobo aquest alumne', 'error'); return; }
    if (!magatzem()) {
      avis('Encara s’està carregant el teu perfil. Prova-ho d’aquí a un moment.', 'error');
      return;
    }
    _alumneObert = a.id;

    var ov = document.getElementById('polIncOverlay') || muntaModal();
    document.getElementById('polIncSub').textContent = a.nom;
    document.getElementById('polIncText').value = '';

    var pl = plantilla();
    document.getElementById('polIncAssumpte').value = pl.assumpte;
    document.getElementById('polIncCos').value = pl.cos;
    document.getElementById('polIncEditor').classList.remove('obert');
    var bo = document.getElementById('polIncObreEditor');
    bo.setAttribute('aria-expanded', 'false');
    bo.textContent = 'Canviar el missatge que s’envia';

    /* Sense correus a la fitxa no hi ha res a fer: val més dir-l'hi d'entrada,
       i on s'arregla, que deixar-lo escriure i fallar-li al final. */
    var correus = correusDe(a.id);
    var cap = document.getElementById('polIncCapCorreus');
    var enviar = document.getElementById('polIncEnvia');
    if (!correus.length) {
      cap.innerHTML = '<div class="pol-inc-sensecorreu" role="status">' +
        '<strong>Aquesta fitxa no té cap correu de la família.</strong><br>' +
        'Posa’l a <strong>Dades personals</strong> (el botó de la personeta, a la targeta de ' +
        'l’alumne) i torna aquí.</div>';
      cap.style.marginBottom = '14px';
      enviar.disabled = true;
      enviar.title = 'No hi ha cap adreça a qui enviar-lo';
    } else {
      cap.innerHTML = '';
      cap.style.marginBottom = '0';
      enviar.disabled = false;
      enviar.title = '';
    }

    pintaPrevi();
    ov.classList.add('open');
    setTimeout(function () {
      var t = document.getElementById('polIncText');
      if (t) t.focus();
    }, 80);
  }

  function tanca() {
    var ov = document.getElementById('polIncOverlay');
    if (ov) ov.classList.remove('open');
    _alumneObert = null;
  }

  function pintaPrevi() {
    if (_alumneObert === null) return;
    var txt = (document.getElementById('polIncText').value || '').trim();
    var m = redacta(_alumneObert, txt || '…');
    document.getElementById('polIncPrevi').textContent = m.assumpte + '\n\n' + m.cos;
    var correus = correusDe(_alumneObert);
    document.getElementById('polIncPerA').textContent = correus.length
      ? 'S’enviarà a: ' + correus.join(', ')
      : '';
  }

  /* El canvi de plantilla es desa sol, com la resta de preferències de l'app:
     no hi ha cap botó de «desar» amagat que es pugui oblidar de prémer. */
  var _tempsPlantilla = null;
  function guardaPlantillaViva() {
    var m = magatzem();
    if (!m) return;
    m.plantilla = {
      assumpte: document.getElementById('polIncAssumpte').value || '',
      cos:      document.getElementById('polIncCos').value || ''
    };
    pintaPrevi();
    if (_tempsPlantilla) clearTimeout(_tempsPlantilla);
    _tempsPlantilla = setTimeout(function () { desa(); }, 900);
  }

  function restauraPlantilla() {
    var m = magatzem();
    if (!m) return;
    m.plantilla = null;
    var pl = plantilla();
    document.getElementById('polIncAssumpte').value = pl.assumpte;
    document.getElementById('polIncCos').value = pl.cos;
    pintaPrevi();
    desa();
    avis('Tornat al missatge de sempre', 'success');
  }

  function obreGmail() {
    if (_alumneObert === null) return;
    var studentId = _alumneObert;
    var txt = (document.getElementById('polIncText').value || '').trim();
    if (!txt) {
      avis('Escriu què ha passat', 'error');
      document.getElementById('polIncText').focus();
      return;
    }
    var correus = correusDe(studentId);
    if (!correus.length) { avis('Aquesta fitxa no té cap correu de la família', 'error'); return; }

    var m = redacta(studentId, txt);
    var url = 'https://mail.google.com/mail/?view=cm&fs=1' +
              '&to=' + encodeURIComponent(correus.join(',')) +
              '&su=' + encodeURIComponent(m.assumpte) +
              '&body=' + encodeURIComponent(m.cos);

    var finestra = null;
    try { finestra = window.open(url, '_blank', 'noopener'); } catch (e) {}
    if (!finestra) {
      /* El navegador ha barrat la finestra. Provem amb el programa de correu
         del sistema abans de donar-ho per perdut. */
      try {
        window.location.href = 'mailto:' + encodeURIComponent(correus.join(',')) +
          '?subject=' + encodeURIComponent(m.assumpte) + '&body=' + encodeURIComponent(m.cos);
      } catch (e) {}
    }

    /* Apuntada. La comptem quan obrim el correu, no quan la família el rep:
       si al final no l'envies, esborra-la de la fitxa. */
    var mag = magatzem();
    if (mag) {
      var k = clau(studentId);
      if (!Array.isArray(mag.registre[k])) mag.registre[k] = [];
      mag.registre[k].push({
        id: 'i' + Date.now() + Math.random().toString(36).slice(2, 6),
        data: dataAvui(),
        text: txt
      });
    }

    tanca();
    posaBotons();
    var body = document.getElementById('polIncBody');
    if (body && String(body.getAttribute('data-alumne')) === String(studentId)) {
      pintaSeccioFitxa(studentId);
    }

    desa().then(function (ok) {
      avis(ok ? 'Correu preparat al Gmail. Revisa’l i envia’l tu.'
              : 'Correu preparat, però no s’ha pogut desar al comptador',
           ok ? 'success' : 'error');
    });
  }

  function esborra(studentId, id) {
    var mag = magatzem();
    if (!mag) return;
    var k = clau(studentId), l = mag.registre[k];
    if (!Array.isArray(l)) return;
    var x = null;
    for (var i = 0; i < l.length; i++) {
      if (String(l[i].id) === String(id)) { x = l[i]; break; }
    }
    if (!x) return;
    if (!confirm('Vols esborrar la incidència del ' + dataText(x.data) + '?\n\n' +
                 'Només se’n va del comptador: el correu que hagis enviat no es toca.')) return;

    mag.registre[k] = l.filter(function (y) { return String(y.id) !== String(id); });
    pintaSeccioFitxa(studentId);
    posaBotons();
    desa().then(function (ok) {
      avis(ok ? 'Esborrada' : 'Esborrada, però no s’ha pogut desar al full', ok ? 'success' : 'error');
    });
  }

  /* ---------- enganxar-ho a l'app sense tocar-la ----------
     Tot dins d'un try: si un dia una d'aquestes funcions canvia de nom a la
     plantilla, això deixarà de funcionar, però l'app seguirà sencera. Val
     més perdre el botó de les incidències que perdre l'app. */
  try {

  posaCss();

  if (typeof window.renderAlumnesList === 'function') {
    var _origLlista = window.renderAlumnesList;
    window.renderAlumnesList = function () {
      var r = _origLlista.apply(this, arguments);
      try { posaBotons(); } catch (e) {}
      return r;
    };
  }

  if (typeof window.renderFitxa === 'function') {
    var _origFitxa = window.renderFitxa;
    window.renderFitxa = function (studentId) {
      var r = _origFitxa.apply(this, arguments);
      try { posaSeccioFitxa(studentId); } catch (e) {}
      return r;
    };
  }

  /* El perfil es reemplaça SENCER quan arriba del full (i al bootstrap). Quan
     això passa, les incidències bones són les que acaben d'arribar: cal
     repintar-les o ensenyaríem els números d'abans de carregar. */
  if (typeof window.perfilRenderAllSelectors === 'function') {
    var _origSel = window.perfilRenderAllSelectors;
    window.perfilRenderAllSelectors = function () {
      var r = _origSel.apply(this, arguments);
      try {
        posaBotons();
        var body = document.getElementById('polIncBody');
        if (body) pintaSeccioFitxa(body.getAttribute('data-alumne'));
      } catch (e) {}
      return r;
    };
  }

  } catch (e) {
    if (window.console && console.error) {
      console.error('Les incidències a la família no s’han pogut activar:', e);
    }
  }
})();
