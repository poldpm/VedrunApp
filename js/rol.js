/* ============================================================
   ROL D'AQUESTA CÒPIA DE L'APP — rol.js
   ------------------------------------------------------------
   Hi ha tres còpies de l'app amb EL MATEIX codi, penjades a
   adreces diferents:

     · la dels TUTORS         → APP_ROL = 'tutor'
     · la dels ESPECIALISTES  → APP_ROL = 'especialista'
     · la de DIRECCIÓ         → APP_ROL = 'direccio'

   Aquest fitxer és l'ÚNIC que canvia entre les tres. Per això
   `sync-filla.js` no el toca mai: quan s'arregla una cosa a la
   mare, arriba a totes sense que ningú s'hagi de recordar de res.

   Què canvia quan el rol és 'especialista':
     · Al perfil no es tria tutoria, es trien els GRUPS on fa classe.
     · Sota el logo hi diu «Especialistes».
     · No hi surten Alumnes ni Distribució de l'aula (són del tutor).
     · Observacions i Registres d'aula demanen de quin grup parlem.
     · Les fitxes dels alumnes són de només lectura (s'hi poden
       afegir observacions, però no canviar les dades de la família).

   Què canvia quan el rol és 'direccio':
     · Al perfil tampoc no es tria tutoria (fan classe, però no en
       tutoritzen cap): es trien els grups on fan classe, igual que
       les especialistes.
     · Sota el logo hi diu «Direcció».
     · Hi surt TOT el que veu un tutor, amb els mateixos permisos.
     · A Alumnes hi ha un selector amb els 18 grups de primària:
       el grup que triïn és el seu grup de treball a tot arreu
       (fitxes, observacions, registres i distribució de l'aula),
       i les fitxes s'hi poden modificar com les faria el tutor.

   ⚠ NO canviïs aquest valor a l'app dels tutors.
   ============================================================ */

window.APP_ROL = 'tutor';

// True si aquesta còpia és la dels especialistes.
function esEspecialista() {
  return (window.APP_ROL || 'tutor') === 'especialista';
}

// True si aquesta còpia és la de direcció.
function esDireccio() {
  return (window.APP_ROL || 'tutor') === 'direccio';
}

// True si en aquesta còpia el mestre NO tutoritza cap grup (especialistes i
// direcció). És el que decideix com és el perfil: grups on fas classe en
// comptes de "de quin grup ets tutor/a".
function senseTutoria() {
  return esEspecialista() || esDireccio();
}

// Text que va sota el logo, a la barra de l'esquerra.
function rolSubtitol() {
  if (esDireccio()) return 'Gestió de curs · Direcció';
  return esEspecialista() ? 'Gestió de curs · Especialistes' : 'Gestió de curs · Tutors';
}

/* ⚠ TEXTOS DE TUTOR A L'APP DE QUI NO EN TÉ.

   Segona auditoria (8/9/2026): el filtre de Tasques es diu «Tutoria» i el
   quadre de la tasca nova també, a totes tres apps. Una especialista i la
   direcció no tenen tutoria: aquella categoria no vol dir res per a elles, i
   el que hi posin després no el sabran tornar a trobar.

   La categoria per dins es diu igual («tutoria»): el que canvia és NOMÉS el
   rètol, o sigui que el que ja hi hagi apuntat no es mou de lloc. */
function rolEtiquetaTutoria() {
  return senseTutoria() ? 'Els meus grups' : 'Tutoria';
}

/* Deixa la pantalla amb els rètols que toquen a aquest rol. Es crida un sol
   cop, en arrencar. Si un dia n'hi ha més d'un, van tots aquí: així es veuen
   d'una llambregada i no queden escampats per l'HTML. */
function rolPosaEtiquetes() {
  const txt = rolEtiquetaTutoria();
  document.querySelectorAll('[data-rol-tutoria]').forEach(el => {
    // El botó del filtre és tot text; al quadre de la tasca el text va
    // darrere d'un <input>, i per això s'hi escriu al node de text i prou.
    if (el.children.length) {
      const t = [...el.childNodes].find(n => n.nodeType === 3 && n.textContent.trim());
      if (t) t.textContent = ' ' + txt;
    } else {
      el.textContent = txt;
    }
  });
}
