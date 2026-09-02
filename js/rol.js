/* ============================================================
   ROL D'AQUESTA CÒPIA DE L'APP — rol.js
   ------------------------------------------------------------
   Hi ha dues còpies de l'app amb EL MATEIX codi, penjades a dues
   adreces diferents:

     · la dels TUTORS         → APP_ROL = 'tutor'
     · la dels ESPECIALISTES  → APP_ROL = 'especialista'

   Aquest fitxer és l'ÚNIC que canvia entre les dues. Per això
   `sync-filla.js` no el toca mai: quan s'arregla una cosa a la
   mare, arriba a totes dues sense que ningú s'hagi de recordar
   de res.

   Què canvia quan el rol és 'especialista':
     · Al perfil no es tria tutoria, es trien els GRUPS on fa classe.
     · Sota el logo hi diu «Especialistes».
     · No hi surten Alumnes ni Distribució de l'aula (són del tutor).
     · Observacions i Registres d'aula demanen de quin grup parlem.
     · Les fitxes dels alumnes són de només lectura (s'hi poden
       afegir observacions, però no canviar les dades de la família).

   ⚠ NO canviïs aquest valor a l'app dels tutors.
   ============================================================ */

window.APP_ROL = 'tutor';

// True si aquesta còpia és la dels especialistes.
function esEspecialista() {
  return (window.APP_ROL || 'tutor') === 'especialista';
}

// Text que va sota el logo, a la barra de l'esquerra.
function rolSubtitol() {
  return esEspecialista() ? 'Gestió de curs · Especialistes' : 'Gestió de curs · Tutors';
}
