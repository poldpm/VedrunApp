/* ============================================================
   CONFIGURACIÓ LOCAL — NO SE SUBSTITUEIX MAI
   ------------------------------------------------------------
   Aquest fitxer conté el token de seguretat de l'app.
   El poses UN COP i no l'has de tornar a tocar mai més:
   quan actualitzis la resta del codi, aquest fitxer es queda igual.

   · APP_TOKEN ha de coincidir amb el token de les propietats del
     Code.gs (clau APP_TOKEN). És una cadena que TU inventes, no és
     cap credencial de Google.

   IMPORTANT: quan et passin una versió nova de l'app, substitueix
   tots els fitxers MENYS aquest. Així el token es manté.
   ============================================================ */

window.APP_TOKEN = 'vedruna-escorial-vic-35d1e8e1bd7c0faafa4e59b5522084c7';

/* ============================================================
   LA CONNEXIÓ D'AQUESTA APP
   ------------------------------------------------------------
   L'adreça del servidor d'aquesta mestra. Abans només vivia dins
   del navegador de cada aparell, i per això s'havia d'enganxar a
   cada mòbil i a cada ordinador, i es perdia en esborrar les
   dades del navegador. Aquí hi és per sempre i li arriba a tots
   els aparells alhora.

   Si algun dia se li n'ha de posar una altra, es canvia aquí i
   es torna a publicar: no s'ha d'anar a tocar cap aparell.
   ============================================================ */
window.APP_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx4LX9BgGotoGbHBb-wWMDOdWv3GCzK6auqhVv-HpFtpjWv6Pyy2nPhiFU8V4w-rFA_/exec';

/* ============================================================
   ENTRAR AMB GOOGLE
   ------------------------------------------------------------
   Amb això posat, l'app demana entrar amb el compte de Google
   abans de parlar amb el servidor. Un sol cop per aparell: a
   partir d'aquí entra sola.

   ⚠ Qui mana de debò és el servidor. Perquè això serveixi de
   res, el projecte d'Apps Script d'aquesta mestra ha de tenir
   les propietats LOGIN_DOMINI i LOGIN_CLIENT_ID posades. Sense
   elles, aquí només hi hauria una pantalla d'entrada que
   qualsevol es podria saltar.

   Per APAGAR-HO: esborra aquestes dues línies (l'app) i la
   propietat LOGIN_DOMINI (el servidor).
   ============================================================ */
window.LOGIN_GOOGLE = '290684261462-o07ktlf7ikrvmvv0pmbli28560dqqmj1.apps.googleusercontent.com';
window.LOGIN_DOMINI = 'escorialvic.cat';
