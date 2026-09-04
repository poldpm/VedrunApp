/* ============================================================
   QUAN L'APP ESTÀ TREBALLANT, QUE ES VEGI — espera.js
   ------------------------------------------------------------
   El problema d'en Pol, 5/9/2026: cliques una cosa, l'app se'n va a
   demanar-la al servidor de Google —que triga el que triga— i mentrestant
   la pantalla no es mou gens. La mestra no pensa «està carregant»: pensa
   «aquest botó no funciona», i el clica cinc vegades més. Cada clic és una
   altra crida, i llavors sí que va lenta de debò.

   Aquí hi ha les dues respostes, i són DIFERENTS a posta:

   1. LA BARRA DE DALT (`_ocupat`) — per a tot el que passa sol: la
      sincronització de l'arrencada, el calendari que arriba després, un
      desat. Una ratlla prima que es mou a dalt de tot. NO bloqueja res:
      mentre carrega en segon pla, l'app s'ha de poder fer servir.

   2. EL VEL (`esperaVisual`) — només per a les esperes que la mestra ESTÀ
      MIRANT: canviar de grup, obrir una llista. Enfosqueix el contingut,
      hi posa la rodona que gira i **no deixa clicar**. Això últim és el
      que en Pol demanava: que no es pugui estressar l'app a clics.

   Per què no es posa el vel a tot: si es fes, l'app es bloquejaria sola
   cada cop que refresca en segon pla i semblaria MÉS lenta, no menys. El
   vel només val quan no hi ha res a fer més que esperar.

   Les dues coses esperen 180 ms abans de sortir. Si la resposta arriba
   abans (sovint passa, i amb el cache de `appsScriptGet` encara més), la
   mestra no veu res: un llampec de vel per a una espera de 60 ms fa més
   nosa que servei.
   ============================================================ */

(function () {
  'use strict';

  var RETARD = 180;          // ms abans d'ensenyar res
  var MAXIM  = 50000;        // xarxa penjada: al cap d'això, es treu igualment

  /* ---------- 1) La barra de dalt ---------- */

  var feines = 0;            // crides al servidor ara mateix
  var tempsBarra = null;

  function barra() {
    var b = document.getElementById('carregaBarra');
    if (b) return b;
    b = document.createElement('div');
    b.id = 'carregaBarra';
    b.className = 'carrega-barra';
    /* Per als lectors de pantalla: que anunciïn que s'està carregant, però
       sense robar el focus del que la mestra estigués fent. */
    b.setAttribute('role', 'status');
    b.setAttribute('aria-live', 'polite');
    b.innerHTML = '<span class="carrega-barra-fil"></span>' +
                  '<span class="visually-hidden">Carregant…</span>';
    document.body.appendChild(b);
    return b;
  }

  function pintaBarra() {
    var b = barra();
    if (feines > 0) b.classList.add('activa');
    else { b.classList.remove('activa'); }
  }

  window._ocupatEntra = function () {
    feines++;
    if (feines === 1 && !tempsBarra) {
      tempsBarra = setTimeout(function () { tempsBarra = null; pintaBarra(); }, RETARD);
    }
  };

  window._ocupatSurt = function () {
    feines = Math.max(0, feines - 1);
    if (feines === 0) {
      if (tempsBarra) { clearTimeout(tempsBarra); tempsBarra = null; }
      pintaBarra();
    }
  };

  /* ---------- 2) El vel ---------- */

  var velObert = 0;

  function vel() {
    var v = document.getElementById('carregaVel');
    if (v) return v;
    v = document.createElement('div');
    v.id = 'carregaVel';
    v.className = 'carrega-vel';
    v.setAttribute('role', 'status');
    v.setAttribute('aria-live', 'polite');
    v.innerHTML =
      '<div class="carrega-vel-caixa">' +
        '<span class="carrega-rodona" aria-hidden="true"></span>' +
        '<span class="carrega-vel-text" id="carregaVelText">Carregant…</span>' +
      '</div>';
    /* Es menja els clics mentre hi és: és tota la gràcia. */
    v.addEventListener('click', function (e) { e.stopPropagation(); e.preventDefault(); });
    document.body.appendChild(v);
    return v;
  }

  /* Envolta una promesa amb el vel. Torna la MATEIXA promesa (amb el mateix
     valor i el mateix error), o sigui que es pot posar al mig de qualsevol
     codi que ja hi hagi sense canviar-ne el funcionament.

       await esperaVisual(carregaElGrup(), 'Carregant 3r B…')            */
  window.esperaVisual = function (promesa, text) {
    var mostrat = false, acabat = false;

    var t = setTimeout(function () {
      if (acabat) return;
      mostrat = true;
      var v = vel();
      /* El text només el posa el PRIMER: si en van dos alhora (canviar de
         grup en dispara uns quants), el de fora és el que sap què s'està
         fent de debò. El de dins diria «Carregant…» i seria un pas enrere. */
      if (velObert === 0) {
        var e = document.getElementById('carregaVelText');
        if (e) e.textContent = text || 'Carregant…';
      }
      velObert++;
      v.classList.add('activa');
      document.body.classList.add('app-ocupada');
    }, RETARD);

    /* Xarxa penjada: el vel no pot quedar-se per sempre o l'app seria
       inservible i s'hauria de tancar. `appsScriptGet` talla als 45 s. */
    var mort = setTimeout(function () { treu(); }, MAXIM);

    function treu() {
      if (acabat) return;
      acabat = true;
      clearTimeout(t); clearTimeout(mort);
      if (!mostrat) return;
      velObert = Math.max(0, velObert - 1);
      if (velObert === 0) {
        var v = document.getElementById('carregaVel');
        if (v) v.classList.remove('activa');
        document.body.classList.remove('app-ocupada');
      }
    }

    return Promise.resolve(promesa).then(
      function (r) { treu(); return r; },
      function (e) { treu(); throw e; }
    );
  };

  /* Comoditat: `await ambEspera('Carregant 3r B…', function(){ ... })`,
     per no haver de girar el codi del revés per posar-hi el vel. */
  window.ambEspera = function (text, feina) {
    var p;
    try { p = feina(); } catch (e) { return Promise.reject(e); }
    return window.esperaVisual(p, text);
  };

  /* ---------- 3) Com sabem si algú està esperant ----------

     La diferència entre «l'app treballa» i «la mestra espera» és si acaba
     de clicar. Si ha clicat fa un moment i el que ve tot seguit és una
     crida al servidor, és que està mirant la pantalla esperant que passi
     alguna cosa: vel. Si ningú no ha tocat res —la sincronització de
     l'arrencada, el calendari que arriba sol, un desat automàtic—, només
     la ratlla de dalt.

     Es mira així, i no botó per botó, perquè l'app té centenars de botons
     i n'hi hauria hagut d'anar posant un a un: els que s'oblidessin serien
     precisament els que semblen espatllats. Passant per aquí hi entren
     tots de cop, també els que es facin demà.                            */

  var ultimClic = 0;
  ['pointerdown', 'keydown'].forEach(function (ev) {
    document.addEventListener(ev, function (e) {
      /* Escriure en un camp no és esperar res: si comptés, desar mentre
         s'escriu taparia la pantalla amb el vel a mitja frase. */
      if (ev === 'keydown' && !(e.key === 'Enter' || e.key === ' ')) return;
      ultimClic = Date.now();
    }, true);
  });

  /* Marge: el temps que va del clic a la crida (pintar, llegir el perfil,
     mirar el cache…). Curt a posta —mig segon més i qualsevol refresc de
     fons que caigués just després d'un clic sortiria bloquejant. */
  window._veniaDUnClic = function (ms) {
    return Date.now() - ultimClic < (ms === undefined ? 400 : ms);
  };
})();
