/* ============================================================
   ENTRAR AMB GOOGLE — login.js
   ------------------------------------------------------------
   Serveix per a dues coses alhora, i les dues són el mateix problema:

   1. Que només hi pugui entrar gent de l'escola. Fins ara l'única cosa
      que hi havia al davant era un token que viatja al navegador de
      cada mestra: qui el tingui, hi entra. Això no es pot arreglar
      amagant-lo millor —va al navegador igualment—; s'arregla fent que
      el servidor comprovi QUI és qui truca.

   2. Que la mestra no hagi d'enganxar res mai més. S'entra un sol cop
      per aparell, amb el botó de Google, i a partir d'aquí es renova
      sol mentre ella segueixi amb el seu compte obert al navegador.

   ⚠ NEIX APAGAT. Aquest fitxer no fa absolutament res si la seva app no
   té `window.LOGIN_GOOGLE` al `js/config.local.js`. Les que no el
   tinguin ni tan sols es baixen el codi de Google: segueixen exactament
   com abans. És a posta —s'encén d'una en una— perquè el dia que falli
   alguna cosa no es quedin fora totes les mestres alhora.

   ⚠ AIXÒ NO ÉS LA PANY: ÉS LA CLAU. El que decideix de debò és el
   servidor, que comprova la credencial amb Google i mira que el correu
   sigui del domini de l'escola. Tot el que hi ha en aquest fitxer passa
   dins del navegador de la mestra i, per tant, qualsevol s'ho podria
   saltar. Aquí només hi ha la comoditat; la seguretat és al `Code.gs`.
   ============================================================ */

/* El client de Google d'aquesta app. Si no hi és, tot això plega. */
function loginClientId() {
  try { return (typeof window.LOGIN_GOOGLE === 'string' && window.LOGIN_GOOGLE.trim()) || ''; }
  catch (e) { return ''; }
}
/* El domini que es deixa entrar. És un SUGGERIMENT per a la pantalla de
   Google (que així ja li proposa el compte de l'escola); qui mana de debò
   és el servidor. */
function loginDomini() {
  try { return (typeof window.LOGIN_DOMINI === 'string' && window.LOGIN_DOMINI.trim()) || ''; }
  catch (e) { return ''; }
}
function loginCal() { return !!loginClientId(); }

const _LOGIN_CLAU = 'vedruna_login';
const _LOGIN_GIS  = 'https://accounts.google.com/gsi/client';
let _loginDades = null;      // { token, exp, email, nom }
let _loginCarregant = null;  // promesa de la càrrega del codi de Google
let _loginDemanant = false;

/* ---------- el que tenim desat ---------- */
/* Es desa al navegador perquè no s'hagi de tornar a demanar a cada recàrrega.
   Si s'esborra, es torna a demanar en silenci i la mestra no veu res. */
function _loginLlegeix() {
  if (_loginDades) return _loginDades;
  try {
    const d = JSON.parse(localStorage.getItem(_LOGIN_CLAU) || 'null');
    if (d && d.token && d.exp) _loginDades = d;
  } catch (e) { _loginDades = null; }
  return _loginDades;
}
function _loginDesa(d) {
  _loginDades = d;
  try {
    if (d) localStorage.setItem(_LOGIN_CLAU, JSON.stringify(d));
    else localStorage.removeItem(_LOGIN_CLAU);
  } catch (e) {}
}

/* Llegeix el contingut de la credencial NOMÉS per saber quan caduca i quin
   correu és, per ensenyar-ho. ⚠ No serveix per decidir res: qualsevol pot
   escriure'n una. Qui la comprova de debò és Google, i ho fa el servidor. */
function _loginObre(jwt) {
  try {
    const t = String(jwt).split('.');
    if (t.length < 2) return null;
    const b = t[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(atob(b + '==='.slice((b.length + 3) % 4))
      .split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
    return JSON.parse(json);
  } catch (e) { return null; }
}

/* La credencial que s'envia al servidor, o '' si no en tenim cap de bona.
   Es dona per caducada un minut abans d'hora: així no se n'envia mai una que
   caduqui pel camí. */
function loginToken() {
  const d = _loginLlegeix();
  if (!d || !d.token) return '';
  if (Date.now() > (d.exp - 60) * 1000) return '';
  return d.token;
}
function loginQui() { const d = _loginLlegeix(); return (d && d.email) || ''; }

/* ---------- el codi de Google ---------- */
function _loginCarregaGIS() {
  if (_loginCarregant) return _loginCarregant;
  _loginCarregant = new Promise((resolta, falla) => {
    try {
      if (window.google && window.google.accounts && window.google.accounts.id) return resolta();
      const s = document.createElement('script');
      s.src = _LOGIN_GIS;
      s.async = true; s.defer = true;
      s.onload = () => resolta();
      s.onerror = () => falla(new Error('no s\'ha pogut carregar el codi de Google'));
      document.head.appendChild(s);
    } catch (e) { falla(e); }
  });
  return _loginCarregant;
}

/* Què es fa quan Google ens dona la credencial. */
function _loginRebuda(resposta) {
  const jwt = resposta && resposta.credential;
  if (!jwt) return;
  const cos = _loginObre(jwt) || {};
  const dom = loginDomini();
  /* Avís amable i immediat si ha triat un compte que no és de l'escola. El
     servidor el rebutjaria igualment, però val més dir-l'hi aquí: si no,
     veuria «No autoritzat» i es pensaria que l'app està espatllada. */
  if (dom && cos.hd && cos.hd !== dom) {
    _loginPintaError('Aquest compte és de «' + cos.hd + '», i a l\'app només hi pot entrar ' +
                     'el compte de l\'escola (@' + dom + '). Torna-ho a provar amb l\'altre.');
    return;
  }
  _loginDesa({ token: jwt, exp: cos.exp || Math.floor(Date.now() / 1000) + 3000,
               email: cos.email || '', nom: cos.name || '' });
  _loginTancaPorta();
  /* Ja se sap qui és: el que esperava a `loginEspera()` pot sortir. */
  _loginLlest = Promise.resolve(true);
  /* Ara ja es pot parlar amb el servidor: es torna a demanar tot. */
  try { if (typeof loadAll === 'function') loadAll(); } catch (e) {}
}

/* ---------- la porta ---------- */
function _loginPorta() {
  let el = document.getElementById('loginPorta');
  if (el) return el;
  el = document.createElement('div');
  el.id = 'loginPorta';
  el.className = 'login-porta';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.innerHTML =
    '<div class="login-caixa">' +
      '<img class="login-logo" src="img/logo-horitzontal.png" alt="Vedruna Escorial Vic">' +
      '<h1 class="login-titol">App de gestió de curs</h1>' +
      '<p class="login-text">Entra amb el teu compte de l\'escola' +
        (loginDomini() ? ' <strong>@' + loginDomini() + '</strong>' : '') + '.</p>' +
      '<div class="login-boto" id="loginBoto"></div>' +
      '<p class="login-peu">Només t\'ho demana <strong>un cop en aquest aparell</strong>. ' +
        'A partir d\'aquí entra sola.</p>' +
      '<p class="login-error" id="loginError" style="display:none" role="alert"></p>' +
    '</div>';
  document.body.appendChild(el);
  return el;
}
function _loginObrePorta() {
  const el = _loginPorta();
  el.classList.add('open');
  _loginCarregaGIS().then(() => {
    try {
      google.accounts.id.renderButton(document.getElementById('loginBoto'),
        { theme: 'filled_blue', size: 'large', shape: 'pill', text: 'signin_with', locale: 'ca', width: 260 });
    } catch (e) {}
  }).catch(() => {
    _loginPintaError('No s\'ha pogut connectar amb Google. Mira que tinguis internet i torna-ho a provar.');
  });
}
function _loginTancaPorta() {
  const el = document.getElementById('loginPorta');
  if (el) el.classList.remove('open');
}
function _loginPintaError(t) {
  const el = document.getElementById('loginError');
  if (!el) return;
  el.textContent = t;
  el.style.display = '';
}

/* ⚠ NO TOTES LES CRIDES AL SERVIDOR SURTEN DE L'ARRENCADA.

   Es va veure provant-ho de debò amb els interruptors posats (15/10/2026):
   amb la porta d'entrada oberta i sense haver entrat ningú, l'app ja havia
   demanat `loadActitudAspectes` i `loadComentEstil` al servidor. Són mòduls
   que es posen en marxa sols en carregar-se, i la comprovació que havia
   posat a l'arrencada no els tocava.

   Perseguir-los un per un seria perdre: demà n'hi hauria un altre. Per això
   qui espera és la CAPA DE PETICIONS, que és per on passa tothom. Mentre no
   se sap qui és la mestra, les peticions esperen aquí; quan entra, surten
   totes soles. Si no es pot entrar, es deixen passar igualment i el servidor
   ja dirà que no: val més això que una app aturada per sempre.

   No es pot encallar: entrar amb Google no fa cap crida al servidor, o sigui
   que això no s'espera mai a si mateix. */
let _loginLlest = null;
function loginEspera() {
  if (!loginCal() || loginToken()) return Promise.resolve(true);
  return _loginLlest || Promise.resolve(false);
}

/* ---------- l'arrencada ---------- */
/* Torna una promesa que es resol quan ja es pot parlar amb el servidor.
   Mai no llança: si no es pot entrar, es resol igualment i l'app s'obre tal
   com es pugui (sense connexió, per exemple, el que ja hi ha al navegador
   s'ha de poder llegir). */
function loginArrenca() {
  if (!loginCal()) return Promise.resolve(true);
  if (_loginLlest) return _loginLlest;      // ja s'hi està, no se'n fan dues

  /* Ja en tenim una de bona: endavant, i es renovarà quan toqui. */
  if (loginToken()) { _loginRenovaQuanCalgui(); return Promise.resolve(true); }

  /* ⚠ SENSE INTERNET NO S'HA DE TANCAR LA PORTA.

     L'app es pot obrir sense cobertura i ensenyar el que ja té guardat. Si
     aquí es plantés una pantalla d'entrada que no es pot passar (perquè per
     entrar cal parlar amb Google), la mestra es quedaria mirant un botó que
     no fa res al mig d'una excursió. Si no hi ha xarxa, es deixa passar: les
     crides al servidor ja fallen soles i l'app ja sap dir-ho. */
  let _online = true;
  try { _online = navigator.onLine !== false; } catch (e) {}
  if (!_online) return Promise.resolve(false);

  _loginLlest = _loginCarregaGIS().then(() => new Promise(resolta => {
    let _fet = false;
    const _acaba = ok => { if (!_fet) { _fet = true; resolta(ok); } };
    try {
      google.accounts.id.initialize({
        client_id: loginClientId(),
        callback: r => { _loginRebuda(r); _acaba(!!loginToken()); },
        auto_select: true,              // si ja hi va entrar, no li torna a preguntar
        cancel_on_tap_outside: false,
        hd: loginDomini() || undefined, // suggeriment: li proposa el compte de l'escola
        itp_support: true,
      });
      /* Primer, en silenci. Si Google el reconeix, la mestra no veu res de
         res i l'app s'obre com sempre. Només si no pot, se li ensenya el
         botó. Això és el «un sol cop per aparell». */
      google.accounts.id.prompt(notif => {
        try {
          const vaBe = notif && typeof notif.isDismissedMoment === 'function' &&
                       notif.isDismissedMoment() && notif.getDismissedReason &&
                       notif.getDismissedReason() === 'credential_returned';
          if (vaBe || loginToken()) { _acaba(true); return; }
        } catch (e) {}
        _loginObrePorta();
        _acaba(false);
      });
      /* Xarxa de seguretat: si al cap de quatre segons Google no ha dit ni
         piu (passa amb segons quins bloquejadors), s'ensenya el botó i
         s'acaba. Val més un botó que una pantalla encallada. */
      setTimeout(() => { if (!_fet && !loginToken()) { _loginObrePorta(); _acaba(false); } }, 4000);
    } catch (e) {
      _loginObrePorta();
      _acaba(false);
    }
  })).catch(() => { _loginObrePorta(); return false; });
  return _loginLlest;
}

/* Es renova sola abans que caduqui, sense ensenyar res. Si no es pot, no
   s'interromp res: la propera crida al servidor dirà que cal tornar a entrar
   i llavors sí que s'ensenyarà el botó. */
function _loginRenovaQuanCalgui() {
  const d = _loginLlegeix();
  if (!d) return;
  const falta = (d.exp - 300) * 1000 - Date.now();   // cinc minuts abans
  setTimeout(() => loginRenova(), Math.max(10000, Math.min(falta, 30 * 60 * 1000)));
}
function loginRenova() {
  if (!loginCal() || _loginDemanant) return Promise.resolve(false);
  _loginDemanant = true;
  return _loginCarregaGIS().then(() => new Promise(resolta => {
    try {
      google.accounts.id.initialize({
        client_id: loginClientId(),
        callback: r => { _loginRebuda(r); resolta(!!loginToken()); },
        auto_select: true, cancel_on_tap_outside: false,
        hd: loginDomini() || undefined, itp_support: true,
      });
      google.accounts.id.prompt(() => resolta(!!loginToken()));
      setTimeout(() => resolta(!!loginToken()), 6000);
    } catch (e) { resolta(false); }
  })).catch(() => false).finally(() => {
    _loginDemanant = false;
    if (loginToken()) _loginRenovaQuanCalgui();
  });
}

/* El servidor ens ha dit que la credencial no val (ha caducat mentre l'app
   era oberta, o la mestra ha sortit del seu compte). Es prova de renovar en
   silenci i, si no pot, s'ensenya el botó. */
function loginCaducat() {
  if (!loginCal()) return;
  _loginDesa(null);
  loginRenova().then(ok => { if (!ok) _loginObrePorta(); });
}

/* Aquesta app és d'una altra mestra.

   No es torna a demanar la credencial sola: seria la mateixa i el
   servidor tornaria a dir que no, i la pantalla es quedaria donant voltes.
   S'obre la porta amb el missatge i es desactiva l'entrada automàtica,
   perquè pugui triar un altre compte si s'ha equivocat d'adreça. */
function loginNoEsTeva(missatge) {
  if (!loginCal()) return;
  _loginDesa(null);
  try { if (window.google && google.accounts && google.accounts.id) google.accounts.id.disableAutoSelect(); } catch (e) {}
  _loginObrePorta();
  _loginPintaError(missatge || 'Aquesta app no és teva. Obre la teva.');
}

/* Sortir. No hi ha cap botó a l'app que ho faci —ningú no ho ha demanat—,
   però existeix per si un dia dues mestres comparteixen un ordinador. */
function loginSurt() {
  _loginDesa(null);
  try { if (window.google && google.accounts && google.accounts.id) google.accounts.id.disableAutoSelect(); } catch (e) {}
  _loginObrePorta();
}
