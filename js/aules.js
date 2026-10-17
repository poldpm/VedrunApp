/* ============================================================
   AULES LLIURES — aules.js
   ------------------------------------------------------------
   «Em cal una aula ara mateix per treure tres nens a llegir. Quina
   tinc buida, i fins a quina hora?»

   L'eina llegeix l'horari de les aules auxiliars de l'escola (el
   full «Horari aules auxiliars», que manté direcció) i diu quines
   són lliures ARA, o al dia i l'hora que la mestra triï.

   ⚠ EINA OPCIONAL, I NEIX APAGADA. Només la té qui tingui

       window.EINES_AULES = true;

   al seu `js/personal.js`. El codi arriba a totes les apps amb el
   `sync-totes.js`; s'encén només a qui la demani. L'entrada del
   catàleg (`js/millores.js`) porta `interruptor: 'EINES_AULES'`.

   ------------------------------------------------------------
   PER QUÈ EL CÀLCUL ES FA AQUÍ I NO AL SERVIDOR

   El servidor torna l'horari SENCER un sol cop (`getAulesLliures`)
   i aquí es decideix què és lliure i què no. Així, canviar l'hora
   a la pantalla és instantani i no fa cap altra volta al servidor:
   l'eina es fa servir de peu al passadís, amb el mòbil i amb la
   connexió que hi hagi.

   L'horari es guarda al navegador. Si l'app s'obre sense connexió,
   l'eina segueix responent amb l'últim que va llegir, dient-ho.

   ------------------------------------------------------------
   L'ESBARJO

   Al full, la fila del pati diu «ESBARJO» als cinc dies. Això NO
   vol dir que l'aula estigui ocupada: al pati l'aula és buida. El
   servidor marca la franja com a pati i en buida les caselles, i
   aquí es diu, perquè una aula «lliure» a les 10:50 no enganyi
   ningú: és que és l'hora del pati.
   ============================================================ */
(function () {
  'use strict';

  var CLAU_CACHE = 'aules_horari';
  var DIES = ['Dilluns', 'Dimarts', 'Dimecres', 'Dijous', 'Divendres'];

  var _dades = null;        // el que ha tornat el servidor
  var _mode = 'ara';        // 'ara' o 'tria'
  var _carregant = null;     // la lectura que hi ha en marxa, si n'hi ha

  /* ---- L'interruptor. Es llegeix EN DIRECTE, no en carregar ----
     `js/personal.js` es carrega l'ÚLTIM de tots: en el moment en què
     aquest fitxer s'executa, `window.EINES_AULES` encara no hi és. */
  function _hiEs() {
    try { return window.EINES_AULES === true; } catch (e) { return false; }
  }

  function byId(id) { return document.getElementById(id); }
  function _esc(s) {
    return (typeof escapeHtml === 'function') ? escapeHtml(s) : String(s == null ? '' : s);
  }
  function _hora(min) {
    var h = Math.floor(min / 60) % 24, m = min % 60;
    return h + ':' + (m < 10 ? '0' + m : m);
  }
  /* El camp d'hora del navegador vol sempre dos dígits: «08:50», no «8:50». */
  function _hhmm(min) {
    var h = Math.floor(min / 60) % 24, m = min % 60;
    return (h < 10 ? '0' + h : h) + ':' + (m < 10 ? '0' + m : m);
  }

  /* ---- L'horari: del navegador primer, del servidor després ---- */
  function _cacheLlegeix() {
    try {
      var x = JSON.parse(localStorage.getItem(CLAU_CACHE) || 'null');
      return (x && x.aules && x.aules.length) ? x : null;
    } catch (e) { return null; }
  }
  function _cacheDesa(d) {
    try { localStorage.setItem(CLAU_CACHE, JSON.stringify(d)); } catch (e) {}
  }

  /* Què dir-li quan el servidor diu que no.

     ⚠ EL CAS QUE CAL TRADUIR: aquesta eina demana al servidor una acció
     que les biblioteques velles no tenen, i llavors el servidor contesta
     «Accio desconeguda: getAulesLliures». Ensenyar-li això a una mestra
     és ensenyar-li una cosa que no vol dir res i que no pot arreglar.
     (No es puja el `BACKEND_MINIM` per això: a qui no tingui aquesta
     eina encesa, el servidor d'abans li va perfectament, i la franja
     groga seria una alarma falsa.) */
  function _queDiu(r) {
    var e = (r && r.error) ? String(r.error) : '';
    if (/desconeguda/i.test(e)) return 'aquesta eina encara no és al servidor: digues-ho a en Pol';
    return e || 'ara mateix no s\'ha pogut llegir';
  }

  /* ⚠ «TORNAR-LO A LLEGIR» NO PODIA QUEDAR-SE EN RES.

     Abans, si ja s'estava llegint l'horari, aquesta funció sortia de
     seguida sense demanar res. El botó quedava dient «Tornant a llegir
     l'horari…» per sempre: es pintava clicable i no feia res, que és
     justament el que no pot passar. Ara, si n'hi ha una en marxa,
     s'espera que acabi i LLAVORS torna a demanar-lo. */
  function carrega(refresca) {
    if (_carregant) {
      return _carregant.then(function () {
        return refresca ? carrega(true) : _dades;
      });
    }
    _carregant = Promise.resolve()
      .then(function () {
        if (typeof appsScriptGet !== 'function') return null;
        var q = { action: 'getAulesLliures' };
        if (refresca) q.refresca = 1;
        return appsScriptGet(q);
      })
      .then(function (r) {
        _carregant = null;
        if (r && r.ok && r.aules && r.aules.length) {
          _dades = r;
          _cacheDesa(r);
          return r;
        }
        /* El servidor diu que no. Si tenim l'últim que va llegir, s'hi
           treballa igualment: val més un horari d'ahir que una pantalla
           morta, sempre que es digui. */
        _dades = _dades || _cacheLlegeix();
        if (_dades) _dades.avis = _queDiu(r);
        else _dades = { ok: false, error: _queDiu(r) };
        return _dades;
      })
      .catch(function (e) {
        _carregant = null;
        _dades = _dades || _cacheLlegeix();
        if (_dades) _dades.avis = 'ara mateix no hi ha connexió';
        else _dades = { ok: false, error: 'No s\'ha pogut llegir l\'horari de les aules.' };
        return _dades;
      });
    return _carregant;
  }

  /* ---- Les hores que hi ha al full, de totes les aules ----
     Cada pestanya pot tenir les seves (el gimnàs en té de diferents): el
     desplegable les porta totes, ordenades. */
  function _hores() {
    var vistes = {}, fora = [];
    ((_dades && _dades.aules) || []).forEach(function (a) {
      (a.franges || []).forEach(function (f) {
        if (!vistes[f.m]) { vistes[f.m] = true; fora.push({ m: f.m, h: f.h }); }
      });
    });
    fora.sort(function (x, y) { return x.m - y.m; });
    return fora;
  }

  /* «11:10» → 670. Res que no sigui una hora torna null. */
  function _minuts(txt) {
    var m = /^\s*(\d{1,2})\s*[:.]\s*(\d{2})\s*$/.exec(String(txt == null ? '' : txt));
    if (!m) return null;
    var h = parseInt(m[1], 10), mi = parseInt(m[2], 10);
    if (h > 23 || mi > 59) return null;
    return h * 60 + mi;
  }

  /* ---- El cor de l'eina ----
     Per a un dia i un minut, quines aules són lliures i fins quan.
     Torna { dins:bool, pati:bool, lliures:[{nom,finsM,fins}], ocupades:n,
             propera:{nom,m,h} }  */
  function mira(dia, minut) {
    var out = { dins: false, pati: false, lliures: [], ocupades: 0, propera: null };
    ((_dades && _dades.aules) || []).forEach(function (a) {
      var fr = a.franges || [], i = -1;
      for (var k = 0; k < fr.length; k++) {
        if (minut >= fr[k].m && minut < fr[k].fiM) { i = k; break; }
      }
      if (i === -1) return;                       // aquesta aula no té classe a aquella hora
      out.dins = true;
      if (fr[i].pati) out.pati = true;
      if (fr[i].ocup[dia]) {
        out.ocupades++;
        /* Quan no en quedi cap de lliure, poder dir quina s'allibera
           abans és l'única cosa que li serveix d'alguna cosa. */
        for (var j = i + 1; j < fr.length; j++) {
          if (!fr[j].ocup[dia]) {
            if (!out.propera || fr[j].m < out.propera.m) {
              out.propera = { nom: a.nom, m: fr[j].m, h: fr[j].h };
            }
            break;
          }
        }
        return;
      }
      // Lliure: fins on? Mentre les franges següents també ho siguin.
      var fi = fr[i];
      for (var n = i + 1; n < fr.length && !fr[n].ocup[dia]; n++) fi = fr[n];
      out.lliures.push({ nom: a.nom, fins: fi.fi, finsM: fi.fiM });
    });
    out.lliures.sort(function (x, y) { return y.finsM - x.finsM || x.nom.localeCompare(y.nom); });
    return out;
  }

  /* ---- La pantalla ---- */
  function _pintaControls() {
    var selDia = byId('aulesDia'), camp = byId('aulesHora'), rapides = byId('aulesRapides');
    if (!selDia || !camp) return;
    selDia.innerHTML = DIES.map(function (d, i) {
      return '<option value="' + i + '">' + d + '</option>';
    }).join('');

    /* Les hores de classe, per no haver-les d'escriure. No són l'única
       manera de triar-ne una: al camp s'hi pot posar qualsevol hora, que
       és justament per a les que no comencen cap classe (un buit a les
       12:30, l'estona d'abans de sortir...). */
    var hores = _hores();
    if (rapides) {
      /* ⚠ Sense horari, aquí no hi havia res i sembla espatllat: val més
         dir-ho. El per què surt al resultat. */
      rapides.innerHTML = hores.length
        ? '<span class="aules-rapides-txt">Hores de classe:</span> ' + hores.map(function (h) {
            return '<button type="button" class="aules-rapida" onclick="aulesHoraRapida(\'' +
                   _hhmm(h.m) + '\')">' + _esc(h.h) + '</button>';
          }).join('')
        : '<span class="aules-rapides-txt">(encara no hi ha horari)</span>';
    }

    // De sèrie, el dia d'avui (o dilluns en cap de setmana) i l'hora d'ara.
    var ara = new Date(), d = ara.getDay();
    selDia.value = String(d >= 1 && d <= 5 ? d - 1 : 0);
    if (!camp.value) camp.value = _hhmm(ara.getHours() * 60 + ara.getMinutes());
  }

  /* Un botonet de les hores de classe: omple el camp i busca. */
  function horaRapida(hhmm) {
    var camp = byId('aulesHora');
    if (camp) camp.value = hhmm;
    cerca();
  }

  function quan(mode) {
    _mode = (mode === 'tria') ? 'tria' : 'ara';
    var tria = byId('aulesTria');
    if (tria) tria.style.display = (_mode === 'tria') ? '' : 'none';
    var rapides = byId('aulesRapides');
    if (rapides) rapides.style.display = (_mode === 'tria') ? '' : 'none';
    [['aulesTabAra', 'ara'], ['aulesTabTria', 'tria']].forEach(function (p) {
      var b = byId(p[0]);
      if (b) {
        b.classList.toggle('actiu', _mode === p[1]);
        b.setAttribute('aria-pressed', String(_mode === p[1]));
      }
    });
    var r = byId('aulesResultat');
    if (r) r.innerHTML = '';
  }

  function _capcalera(dia, minut, araMateix) {
    return (araMateix ? 'Ara mateix' : DIES[dia]) +
           ', a les ' + _hora(minut);
  }

  function cerca() {
    var cont = byId('aulesResultat');
    if (!cont) return;
    if (!_dades || !_dades.aules) {
      cont.innerHTML = '<div class="aules-avis">' +
        _esc((_dades && _dades.error) || 'Encara s\'està llegint l\'horari.') + '</div>';
      return;
    }

    var dia, minut, araMateix = (_mode === 'ara');
    if (araMateix) {
      var ara = new Date(), d = ara.getDay();
      if (d < 1 || d > 5) {
        cont.innerHTML = '<div class="aules-avis">Avui no hi ha classe. ' +
          'Tria <strong>un altre dia i hora</strong> per veure com estarà.</div>';
        return;
      }
      dia = d - 1;
      minut = ara.getHours() * 60 + ara.getMinutes();
    } else {
      dia = parseInt((byId('aulesDia') || {}).value, 10);
      minut = _minuts((byId('aulesHora') || {}).value);
      if (isNaN(dia)) return;
      /* L'hora l'escriu ella: pot quedar buida o a mitges. Dir-ho val més
         que fer veure que s'ha buscat i no ensenyar res. */
      if (minut === null) {
        cont.innerHTML = '<div class="aules-avis">Posa-hi una hora (per exemple, <strong>11:10</strong>) ' +
          'o clica una de les hores de classe.</div>';
        return;
      }
    }

    var r = mira(dia, minut);

    /* Fora d'hores: dir-ho i, si el dia encara no ha començat, ensenyar
       com estarà a la primera hora. Deixar-ho en un «no hi ha res» seria
       fer-li pensar que l'eina no va. */
    if (!r.dins) {
      var hores = _hores();
      var primera = hores.length ? hores[0].m : null;
      if (araMateix && primera !== null && minut < primera) {
        cont.innerHTML = '<div class="aules-avis">Encara no han començat les classes. ' +
          'Això és com estarà a les <strong>' + _esc(_hora(primera)) + '</strong>.</div>' +
          _llista(mira(dia, primera), dia, primera, false);
        return;
      }
      cont.innerHTML = '<div class="aules-avis">' +
        (araMateix ? 'A aquesta hora ja no hi ha classe.' : 'A aquella hora no hi ha classe.') +
        '</div>';
      return;
    }

    cont.innerHTML = _llista(r, dia, minut, araMateix);
  }

  function _llista(r, dia, minut, araMateix) {
    var cap = '<p class="aules-capcalera">' + _esc(_capcalera(dia, minut, araMateix)) +
      ' · <strong>' + r.lliures.length +
      (r.lliures.length === 1 ? ' aula lliure' : ' aules lliures') + '</strong></p>';

    var avis = '';
    if (r.pati) {
      avis += '<div class="aules-avis">És l\'hora del pati: les aules són buides, ' +
        'però mira fins a quina hora ho estaran.</div>';
    }
    if (_dades && _dades.avis) {
      avis += '<div class="aules-avis">Aquest horari és l\'últim que es va poder llegir (' +
        _esc(_dades.avis) + ').</div>';
    }

    if (!r.lliures.length) {
      var dies = '';
      if (r.propera) {
        dies = '<p class="aules-propera">La primera que s\'allibera és <strong>' +
          _esc(r.propera.nom) + '</strong>, a les <strong>' + _esc(r.propera.h) + '</strong>.</p>';
      }
      return cap + avis +
        '<div class="aules-buit"><p><strong>Totes ocupades.</strong></p>' + dies + '</div>' + _peu();
    }

    return cap + avis + '<div class="aules-llista">' + r.lliures.map(function (a) {
      return '<div class="aula-lliure">' +
        '<div class="aula-nom">' + _esc(a.nom) + '</div>' +
        '<div class="aula-fins">Lliure fins a les <strong>' + _esc(a.fins) + '</strong></div>' +
        '</div>';
    }).join('') + '</div>' + _peu();
  }

  /* Quan es va llegir l'horari, i com tornar-lo a llegir.

     Serveix per a una cosa concreta: direcció canvia el full a mig matí i
     la mestra no ho veu, perquè el servidor se'l guarda mitja hora. Amb
     això no s'ha d'esperar ni tancar l'app. */
  function _peu() {
    var quan = (_dades && _dades.quan) ? String(_dades.quan).slice(-5) : '';
    return '<p class="aules-peu">' +
      (quan ? 'Horari llegit a les ' + _esc(quan) + ' · ' : '') +
      '<button type="button" class="aules-rellegir" onclick="aulesRellegeix()">Tornar-lo a llegir</button>' +
      '</p>';
  }

  function rellegeix() {
    var cont = byId('aulesResultat');
    if (cont) cont.innerHTML = '<div class="aules-avis">Tornant a llegir l\'horari…</div>';
    if (_dades) delete _dades.avis;
    carrega(true).then(function () { _pintaControls(); cerca(); });
  }

  /* ---- Entrar a l'apartat ---- */
  function obrePagina() {
    var cont = byId('aulesResultat');
    quan('ara');
    if (!(_dades && _dades.aules)) {
      var cau = _cacheLlegeix();
      if (cau) _dades = cau;
    }
    /* Els desplegables es pinten SEMPRE, encara que no hi hagi horari: si
       no, el de les hores quedava buit i semblava espatllat. */
    _pintaControls();
    if (_dades && _dades.aules) cerca();
    else if (cont) cont.innerHTML = '<div class="aules-avis">Llegint l\'horari de les aules…</div>';
    // I, hi hagi o no hi hagi cache, es torna a llegir del servidor.
    carrega().then(function () {
      if (!byId('aulesResultat')) return;
      var pag = byId('page-aules');
      if (!pag || pag.classList.contains('page-hidden')) return;
      _pintaControls();
      cerca();
    });
  }

  function aplicaInterficie() {
    var b = byId('navAules');
    if (b) b.style.display = _hiEs() ? '' : 'none';
  }

  /* Les funcions que criden els botons van a `window` a posta: els
     `onclick` de l'index.html les han de poder trobar, i així
     `eines/comprova-controls.js` pot comprovar que existeixen. */
  window.aulesQuan = quan;
  window.aulesCerca = cerca;
  window.aulesRellegeix = rellegeix;
  window.aulesHoraRapida = horaRapida;

  window.Aules = {
    hiEs: _hiEs,
    aplicaInterficie: aplicaInterficie,
    obrePagina: obrePagina,
    mira: mira,
    hores: _hores,
    posa: function (d) { _dades = d; },   // per al banc de proves
  };
})();
