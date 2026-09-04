/* ============================================================
   ESCRIURE AL GOOGLE CALENDAR I AL GOOGLE TASKS
   ------------------------------------------------------------
   Els events i les tasques que crees a l'app poden aparèixer al teu
   Google. Es controla amb un interruptor a Configuració i per defecte
   està APAGAT (ningú vol que li escriguin al calendari sense saber-ho).

   Com funciona, i per què així:

   · Es desa l'id de Google al costat de cada element (a "l'ombra"), amb
     el calendari o la llista d'on és. Sense això no es pot editar ni
     esborrar: només tornar a crear, i llavors surten duplicats.

   · L'id el genera l'app i es desa ABANS d'enviar-lo. Si es talla la
     connexió i es reintenta, Google respon "ja existeix" i això vol dir
     que la primera vegada va funcionar: no se'n crea un altre.

   · No es puja tot: els festius del calendari escolar (ids "esc_") es
     queden a l'app. Al Google Calendar només hi va el que has escrit tu.

   · Si esborres una cosa des de Google, guanya Google: l'app no la
     ressuscita.
   ============================================================ */
(function () {
  'use strict';

  var K_OMBRA = 'gwrite_ombra';   // { events:{ idLocal:{gId,gCal,hash,...} }, tasks:{...} }
  var K_ACTIU = 'gwrite_actiu';   // '1' | '0'

  /* ---- Interruptor ---- */
  function actiu() { try { return localStorage.getItem(K_ACTIU) === '1'; } catch (e) { return false; } }
  function setActiu(v) {
    try { localStorage.setItem(K_ACTIU, v ? '1' : '0'); } catch (e) {}
    if (v) programaPush(300);
    _pintaEstat();
  }

  /* ---- L'ombra: què hem escrit a Google i amb quin id ---- */
  function ombra() {
    try {
      var o = JSON.parse(localStorage.getItem(K_OMBRA) || '{}');
      o.events = o.events || {}; o.tasks = o.tasks || {};
      return o;
    } catch (e) { return { events: {}, tasks: {} }; }
  }
  function desaOmbra(o) { try { localStorage.setItem(K_OMBRA, JSON.stringify(o)); } catch (e) {} }

  /* ---- Id per a Google: només a–v i 0–9, mínim 5 caràcters.
         Un UUID sense guions ja compleix (només porta 0–9 i a–f). ---- */
  function nouGId() {
    try {
      if (window.crypto && crypto.randomUUID) return crypto.randomUUID().replace(/-/g, '');
    } catch (e) {}
    var c = '0123456789abcdefghijklmnopqrstuv', s = '';
    for (var i = 0; i < 26; i++) s += c.charAt(Math.floor(Math.random() * 32));
    return s;
  }

  function hashEv(e) { return [e.titol, e.data, e.hora, e.horaFi, e.desc, e.link].join('|'); }
  function hashTk(t) { return [t.titol, t.desc, t.data, t.feta ? 1 : 0].join('|'); }

  // Els festius sembrats del calendari escolar no van a Google
  function esDeLEscola(id) { return String(id || '').indexOf('esc_') === 0; }

  /* ---- Compara el que hi ha a l'app amb el que ja hem escrit a Google ---- */
  function reconcilia() {
    var o = ombra();
    var canvis = { events: [], tasks: [], esborrarEvents: [], esborrarTasks: [] };

    // EVENTS (de tots els anys que hi hagi desats)
    var vistosEv = {};
    try {
      Object.keys(localStorage).filter(function (k) { return k.indexOf('cal2_events_') === 0; })
        .forEach(function (k) {
          var evs = [];
          try { evs = JSON.parse(localStorage.getItem(k) || '[]'); } catch (e) {}
          (evs || []).forEach(function (e) {
            if (!e || !e.id || !e.data || esDeLEscola(e.id)) return;
            vistosEv[e.id] = 1;
            var prev = o.events[e.id], hash = hashEv(e);
            // Nomes es dona per fet si Google ho va confirmar (sense pend ni err):
            // si no, un tall de connexio deixaria l element sense enviar per sempre.
            if (prev && prev.gId && prev.hash === hash && !prev.err && !prev.pend) return;
            var gId  = (prev && prev.gId) || nouGId();
            var gCal = (prev && prev.gCal) || 'primary';
            o.events[e.id] = { gId: gId, gCal: gCal, hash: hash, pend: true };  // desar ABANS d'enviar
            canvis.events.push({
              id: e.id, gId: gId, gCal: gCal, titol: e.titol, data: e.data,
              hora: e.hora, horaFi: e.horaFi, desc: e.desc, link: e.link
            });
          });
        });
    } catch (e) {}
    Object.keys(o.events).forEach(function (idLocal) {
      if (!vistosEv[idLocal] && o.events[idLocal] && o.events[idLocal].gId) {
        canvis.esborrarEvents.push({ gId: o.events[idLocal].gId, gCal: o.events[idLocal].gCal });
      }
    });

    // TASQUES
    var vistosTk = {};
    var items = [];
    try { if (typeof tqLoad === 'function') items = tqLoad() || []; } catch (e) {}
    items.forEach(function (t) {
      if (!t || !t.id) return;
      vistosTk[t.id] = 1;
      var prev = o.tasks[t.id], hash = hashTk(t);
      if (prev && prev.gId && prev.hash === hash && !prev.err && !prev.pend) return;
      var gList = (prev && prev.gList) || '@default';
      o.tasks[t.id] = { gId: (prev && prev.gId) || '', gList: gList, hash: hash, pend: true };
      canvis.tasks.push({
        id: t.id, gId: o.tasks[t.id].gId, gList: gList,
        titol: t.titol, desc: t.desc, data: t.data, feta: !!t.feta
      });
    });
    Object.keys(o.tasks).forEach(function (idLocal) {
      if (!vistosTk[idLocal] && o.tasks[idLocal] && o.tasks[idLocal].gId) {
        canvis.esborrarTasks.push({ gId: o.tasks[idLocal].gId, gList: o.tasks[idLocal].gList });
      }
    });

    return { canvis: canvis, ombra: o };
  }

  function buit(c) {
    return !c.events.length && !c.tasks.length && !c.esborrarEvents.length && !c.esborrarTasks.length;
  }

  /* ---- Enviar ---- */
  var _enviant = false, _timer = null;

  function programaPush(ms) {
    if (_timer) clearTimeout(_timer);
    _timer = setTimeout(push, ms == null ? 1500 : ms);
  }

  async function push() {
    if (_enviant || !actiu()) return;
    if (typeof config === 'undefined' || !config.scriptUrl) return;
    var r0 = reconcilia();
    if (buit(r0.canvis)) { _pintaEstat(); return; }

    desaOmbra(r0.ombra);          // l'id es desa ABANS d'enviar la petició
    _enviant = true; _pintaEstat();
    try {
      var r = await appsScriptPost({ action: 'gwriteSync', canvis: r0.canvis });
      if (!r || r.ok === false) throw new Error((r && r.error) || 'Error desconegut');

      var o = ombra();
      Object.keys(r.events || {}).forEach(function (idLocal) {
        var res = r.events[idLocal]; if (!o.events[idLocal]) return;
        if (res.ok) { o.events[idLocal].gId = res.gId; o.events[idLocal].gCal = res.gCal; delete o.events[idLocal].pend; delete o.events[idLocal].err; }
        else if (res.gone) { delete o.events[idLocal]; }        // esborrat a Google: guanya Google
        else { o.events[idLocal].err = res.error; }
      });
      Object.keys(r.tasks || {}).forEach(function (idLocal) {
        var res = r.tasks[idLocal]; if (!o.tasks[idLocal]) return;
        if (res.ok) { o.tasks[idLocal].gId = res.gId; o.tasks[idLocal].gList = res.gList; delete o.tasks[idLocal].pend; delete o.tasks[idLocal].err; }
        else if (res.gone) { delete o.tasks[idLocal]; }
        else { o.tasks[idLocal].err = res.error; }
      });
      var esb = r.esborrats || {};
      Object.keys(esb.events || {}).forEach(function (gId) {
        if (!esb.events[gId].ok) return;
        Object.keys(o.events).forEach(function (k) { if (o.events[k].gId === gId) delete o.events[k]; });
      });
      Object.keys(esb.tasks || {}).forEach(function (gId) {
        if (!esb.tasks[gId].ok) return;
        Object.keys(o.tasks).forEach(function (k) { if (o.tasks[k].gId === gId) delete o.tasks[k]; });
      });
      desaOmbra(o);
    } catch (e) {
      // Sense connexió o error: queda pendent i es reintentarà. L'usuari ho veu.
      if (typeof showToast === 'function') showToast("No s'ha pogut escriure al Google: " + e.message, 'error');
    } finally {
      _enviant = false; _pintaEstat();
    }
  }

  /* ---- Quantes coses queden per enviar ---- */
  function pendents() {
    var o = ombra(), n = 0;
    Object.keys(o.events).forEach(function (k) { if (o.events[k].pend || o.events[k].err) n++; });
    Object.keys(o.tasks).forEach(function (k) { if (o.tasks[k].pend || o.tasks[k].err) n++; });
    return n;
  }

  function _pintaEstat() {
    var el = document.getElementById('gwriteEstat');
    if (!el) return;
    if (!actiu()) { el.textContent = 'Desactivat'; el.className = 'gwrite-estat'; return; }
    if (_enviant) { el.textContent = 'Enviant…'; el.className = 'gwrite-estat gwrite-enviant'; return; }
    var n = pendents();
    el.textContent = n ? (n + ' pendent' + (n > 1 ? 's' : '') + " d'enviar") : 'Al dia ✓';
    el.className = 'gwrite-estat' + (n ? ' gwrite-pendent' : ' gwrite-ok');
  }

  /* ---- Amaga del calendari els events que hi hem escrit nosaltres
         (si no, es veurien dos cops: el de l'app i el que torna de Google) ---- */
  function filtraPropis(events) {
    if (!events || !events.length) return events || [];
    var o = ombra(), ids = [];
    Object.keys(o.events).forEach(function (k) { if (o.events[k].gId) ids.push(o.events[k].gId); });
    if (!ids.length) return events;
    return events.filter(function (ev) {
      var s = String(ev && ev.id || '');
      for (var i = 0; i < ids.length; i++) if (s.indexOf(ids[i]) !== -1) return false;
      return true;
    });
  }

  /* ---- S'enganxa als punts on l'app desa ---- */
  function embolcalla(nom) {
    var orig = window[nom];
    if (typeof orig !== 'function' || orig.__gwrite) return;
    var nou = function () { var r = orig.apply(this, arguments); try { programaPush(); } catch (e) {} return r; };
    nou.__gwrite = true;
    window[nom] = nou;
  }

  function init() {
    // En obrir la Configuracio, la casella ha de reflectir l'estat real
    var oc = window.openConfig;
    if (typeof oc === 'function' && !oc.__gwrite) {
      var nouOc = function () {
        var r = oc.apply(this, arguments);
        try { var c = document.getElementById('cfgGwrite'); if (c) c.checked = actiu(); _pintaEstat(); } catch (e) {}
        return r;
      };
      nouOc.__gwrite = true; window.openConfig = nouOc;
    }
    embolcalla('cal2SaveEvents');   // crear / editar / esborrar un event
    embolcalla('tqSave');           // crear / editar / completar / esborrar una tasca
    _pintaEstat();
    if (actiu()) programaPush(4000);   // posa'l al dia en arrencar
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  /* ---- API pública ---- */
  window.gwrite = {
    actiu: actiu,
    setActiu: setActiu,
    push: push,
    pendents: pendents,
    filtraPropis: filtraPropis,
    pintaEstat: _pintaEstat
  };
})();

/* ============================================================
   L'ESTAT, A LA PÀGINA DEL CALENDARI
   ------------------------------------------------------------
   L'interruptor de "enviar-ho al Google" viu a Configuració, i
   quan està apagat `push()` no fa res i no diu res. En Pol va
   crear un event al calendari de l'app, no li va arribar al
   Google Calendar, i no hi havia manera de saber per què.

   Això ho posa on es mira: sota la capçalera del calendari.
   ============================================================ */
(function () {
  function pinta() {
    var el = document.getElementById('cal2Gwrite');
    if (!el || !window.gwrite) return;

    if (!gwrite.actiu()) {
      el.className = 'cal2-gwrite cal2-gwrite-off';
      el.innerHTML = 'Els events que facis aquí <strong>no s\'envien al Google Calendar</strong>. ' +
        '<button type="button" class="cal2-gwrite-btn" onclick="cal2ActivaGoogle()">Activar-ho</button>';
      return;
    }
    var n = gwrite.pendents();
    if (n) {
      el.className = 'cal2-gwrite cal2-gwrite-pend';
      el.innerHTML = n + ' event' + (n > 1 ? 's' : '') + ' encara no ' + (n > 1 ? 'han' : 'ha') +
        ' arribat al Google Calendar. ' +
        '<button type="button" class="cal2-gwrite-btn" onclick="gwrite.push()">Provar ara</button>';
      return;
    }
    el.className = 'cal2-gwrite cal2-gwrite-ok';
    el.textContent = 'El que facis aquí va al teu Google Calendar ✓';
  }

  /* Activar-ho des d'aquí mateix: qui és al calendari no ha d'anar a
     buscar un interruptor a una altra pàgina. */
  window.cal2ActivaGoogle = function () {
    gwrite.setActiu(true);
    var c = document.getElementById('cfgGwrite');
    if (c) c.checked = true;
    if (typeof showToast === 'function') {
      showToast('Activat. El que ja tinguis apuntat s\'anirà enviant.', 'success');
    }
    gwrite.push();
    pinta();
  };

  window.gwrite.pintaCalendari = pinta;

  // Es repinta en obrir el calendari i quan canvia l'estat de l'enviament
  var origEstat = window.gwrite.pintaEstat;
  window.gwrite.pintaEstat = function () { origEstat(); pinta(); };
  document.addEventListener('DOMContentLoaded', pinta);
})();
