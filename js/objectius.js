/* ============================================================
   OBJECTIUS D'APRENENTATGE OFICIALS — objectius.js
   ------------------------------------------------------------
   Els objectius que direcció publica per a cada curs, trimestre
   i àrea. Les mestres NO els han d'escriure: surten sols a la
   pantalla d'Assoliments i només han de marcar cada alumne.

   D'ON SURTEN: dels documents «26-27 Objectius d'aprenentatge
   (Nè) - Nr trimestre» de la carpeta del Drive de l'escola.
   Es passen aquí a mà, un per un, i es comproven amb
   `node eines/comprova-objectius.js`.

   ⚠ PER QUÈ NO ELS LLEGEIX L'APP DIRECTAMENT DEL DRIVE
   Perquè sortiria més car que no pas bo:
   · caldria un permís nou de Google (DriveApp) al projecte de
     CADA mestra, i la que no l'enganxés es quedaria amb l'app
     petant;
   · i caldria interpretar el format intern del Word, que es pot
     equivocar EN SILENCI el dia que algú reformati una taula o
     canviï un pic per un guió. Un objectiu mal llegit no es veu:
     es veu malament.
   Portant-los aquí, no hi ha permisos, no hi ha res a enganxar i
   no hi ha res que es pugui trencar a mitja classe. Quan els
   documents canviïn, es torna a generar aquest fitxer i arriba a
   totes les apps amb l'avís de versió nova: la mestra no fa res.

   ⚠ PROVISIONAL O DEFINITIU VA PER ASSIGNATURA, NO PER TRIMESTRE.

   En Pol, 8/11/2026: «estan en vermell perquè els hem de revisar
   […] quan estiguin de color negre vol dir que estan corregits i
   són els oficials». I el 9/11: «si una assignatura els té de color
   vermell, sí que són els provisionals» —o sigui que dins d'un
   mateix document n'hi pot haver de repassats i de no repassats.

   Per això cada trimestre porta `provisional: true` (de sèrie, tot
   és provisional) i una llista `definitius` amb les assignatures
   que direcció JA ha repassat, les que al document són en NEGRE.
   Les que hi són no porten l'avís groc; les que no, sí.

   ⚠ El valor de sèrie és «provisional» a posta. Si algun dia algú
   s'oblida d'afegir una assignatura als `definitius`, la mestra veu
   un avís que sobra —molesta i prou—; a l'inrevés veuria uns
   objectius com a definitius sense ser-ho, i això sí que enganya.
   Quan totes siguin negres, `provisional: false` i fora llista.

   FORMAT
   Clau `'<curs>|<trimestre>'` → { provisional, definitius, assigs }.
   ⚠ I EL COLOR NO ES VEU DES D'AQUÍ. El text que torna el Drive ve
   sense colors: quines assignatures són negres no es pot deduir
   llegint el document, s'ha de mirar el .docx per dins o
   preguntar-ho. Per això `definitius` s'escriu a mà i no se'n
   dedueix res sol.

   `assigs` va pel NOM de l'assignatura tal com el diu el perfil
   de la mestra (`PERFIL_ASSIGS_PER_CURS`, js/perfil.js), no com
   el diu el document: així es troben sols. Dins de cada llista,
   una línia que comença per «# » no és un objectiu, és el nom
   d'un bloc (Plàstica, Robòtica, Teatre…) i val per als de sota.
   ============================================================ */

const OBJECTIUS_CURS_ESCOLAR = '26-27';

const OBJECTIUS_OFICIALS = {

  /* ---------- 1r de Primària ---------- */
  '1r|1': {
    provisional: true,
    /* En negre al document, repassades (llegit amb `eines/objectius-colors.js`
       el 12/11/2026). Hi falten Anglès —títol i objectius encara vermells— i
       l'artística, que va mig i mig. */
    definitius: ['Català', 'Castellà', 'Medi', 'Matemàtiques', 'Cultura Religiosa', 'Educació Física'],
    /* Assignatures que direcció ha canviat de dalt a baix: la pantalla
       ho avisa perquè les marques d'abans ja no volen dir el mateix. */
    canvis: {
      'Medi': {
        data: '12 de novembre',
        que: 'Direcció ha refet la llista sencera: de 7 objectius a 5, i cap no és dels d’abans. El barri, les botigues i les festes de Vic ja no hi són; ara va de l’escola, el calendari i les estacions.',
      },
      'Matemàtiques': {
        data: '12 de novembre',
        que: 'Direcció ha tret l’objectiu «Comptar de 2 en 2», que era el tercer: tots els de sota han pujat una casella.',
      },
      'Català': {
        data: '12 de novembre',
        que: 'Al lloc de «Aprendre a redactar missatges breus i notes» (el desè) ara hi ha «Iniciar-se en l’ús de la lletra lligada»: no és el mateix i val més tornar-lo a mirar.',
      },
      'Música': {
        data: '10 de novembre',
        que: 'Direcció ha refet la llista sencera: de 10 objectius a 8, i tots amb una altra redacció.',
      },
    },
    assigs: {
      'Català': [
        'Expressar i narrar les seves pròpies vivències i sentiments.',
        'Aprendre i respectar les normes que regeixen una conversa.',
        'Participar en les converses.',
        'Recitar un poema.',
        'Millorar l’expressió oral.',
        'Aprendre a identificar sons vocàlics i consonàntics.',
        'Millorar la fluïdesa lectora.',
        'Llegir i comprendre dites i rodolins.',
        'Identificar paraules de les lectures treballades.',
        'Iniciar-se en l’ús de la lletra lligada.',
        'Aprenentatge sistemàtic: auditiu, visual i escrit de les grafies.',
        'Comprendre textos breus.',
        'Fer ús de la majúscula en els noms propis.',
      ],
      'Castellà': [
        'Adquirir vocabulari nou.',
        'Conèixer el nom dels números fins al 10, colors i fruites.',
        'Discriminar i produir el so de la [ñ].',
        'Llegir i comprendre correctament el vocabulari treballat.',
        'Desenvolupar la comprensió auditiva i lectora.',
      ],
      'Anglès': [
        'Comprendre missatges orals relacionats amb els temes treballats (explicacions de la mestra, enunciats, cançons, contes,...)',
        'Saludar i acomiadar-se en llengua anglesa.',
        'Produir missatges orals (preguntes, afirmacions, respostes…) relacionats amb les estructures i el vocabulari treballat (What’s the weather like today? What day is today? Checking the assistance)',
        'Mostra interès per la festa tradicional anglesa de Halloween.',
      ],
      'Medi': [
        'Conèixer els espais i les normes de l’escola.',
        'Saber els dies de la setmana i els mesos de l’any.',
        'Conèixer les característiques de les estacions de l’any.',
        'Fomentar bones habilitats socials necessàries per a la interacció i integració amb els altres.',
        'Conèixer les normes bàsiques de seguretat viària.',
      ],
      'Matemàtiques': [
        'Reconèixer i escriure la grafia i el nom dels nombres del 0 al 20.',
        'Utilitzar la sèrie numèrica de l’1 al 20 de manera creixent i decreixent.',
        'Comparar i ordenar diferents quantitats.',
        'Realitzar sumes i restes senzilles.',
        'Utilitzar la representació de nombres per resoldre operacions.',
        'Utilitzar els símbols matemàtics bàsics.',
        'Resoldre problemes de suma i resta senzills.',
      ],
      'Cultura Religiosa': [
        'Identificar els membres de la nostra família.',
        'Conèixer el valor de la família.',
        'Prendre consciència d’un mateix.',
        'Conèixer com podem resoldre un problema a través de contes.',
      ],
      'Educació Física': [
        'Moure les diverses parts del cos i reconèixer-les pel seu nom.',
        'Utilitzar els recursos plàstics per interioritzar les diferents parts del cos.',
        'Representar el seu propi cos de forma global i segmentària.',
        'Identificar els dos segments corporals dreta i esquerra.',
        'Afirmar els segments dominants dins el procés de lateralització.',
        'Experimentar postures en equilibri i desequilibri.',
        'Realitzar salts i rodaments prenent consciència de la posició del cos.',
        'Començar a buscar estratègies per tal de cooperar amb els companys/es en els jocs d’equip.',
        'Assumir el resultat del joc sense crear conflictes ni enfadar-se.',
        'Escoltar les normes i consignes dels jocs per poder realitzar correctament les activitats proposades.',
        'Mostrar interès i gaudi en la participació dels jocs.',
        'Portar l’equipament adequat per realitzar l’educació física.',
      ],
      'Música': [
        'Escoltar amb respecte, atenció i interès les audicions musicals.',
        'Reconèixer i imitar sons i sorolls de l\'entorn.',
        'Discriminar les qualitats del so (fort-fluix, llarg-curt i agut-greu), utilitzant la terminologia adequada.',
        'Conèixer i reconèixer els instruments de petita percussió treballats a l\'aula.',
        'Seguir i mantenir una pulsació regular a través del cant, el moviment i la percussió.',
        'Conèixer i cantar de memòria les cançons apreses, esforçant-se per cantar amb una bona entonació i expressivitat.',
        'Participar en danses col·lectives, coordinant els moviments amb la música i amb els companys.',
        'Improvisar i crear moviments per acompanyar cançons i audicions musicals.',
      ],
      'Tallers': [
        '# Plàstica',
        'Experimentar amb diversos materials, formes i tècniques plàstiques.',
        'Dominar el gest tot plasmant diferents línies, formes i lletres.',
        'Millorar la motricitat fina.',
        'Observar, analitzar i aplicar les característiques significatives observades, representant-les de forma autònoma, espontània i creativa.',
        'Expressar-se i gaudir a través del llenguatge artístic.',
        '# Robòtica',
        'Aprendre a través de la robòtica.',
        'Aprendre la lògica bàsica de la programació.',
        'Fomentar el pensament creatiu.',
        'Treballar i desenvolupar la motricitat fina.',
        'Adquirir el coneixement de vocabulari específic.',
      ],
    },
  },

  /* ---------- 2n de Primària ---------- */
  '2n|1': {
    provisional: true,
    /* Al document són en NEGRE: direcció les ha repassades i són definitives.
       Llegit amb `eines/objectius-colors.js` el 12/11/2026. Ara ja només hi
       falten els Tallers, que encara hi són en vermell.

       L'Educació física hi entra el 12/11: els objectius ja eren negres des
       del principi, però el TÍTOL era vermell, i mentre els dos colors no es
       posen d'acord compta com a provisional (veure eines/OBJECTIUS.md).
       Avui direcció ha passat el títol a negre i prou: ni una lletra del text
       no ha canviat. */
    definitius: ['Català', 'Castellà', 'Anglès', 'Medi', 'Matemàtiques', 'Cultura Religiosa', 'Educació Física', 'Música'],
    /* Assignatures que direcció ha canviat de dalt a baix: la pantalla
       ho avisa perquè les marques d'abans ja no volen dir el mateix. */
    canvis: {
      'Música': {
        data: '10 de novembre',
        que: 'Direcció ha refet la llista sencera: continuen sent 7 objectius, però tots diuen una altra cosa.',
      },
      'Matemàtiques': {
        data: '9 de novembre',
        que: 'Direcció ha refet la llista: abans hi havia 15 objectius, després 12, i ara n’hi ha un de nou de figures simètriques al mig i un de menys al final.',
      },
      'Tallers': {
        data: '9 de novembre',
        que: 'Direcció ha afegit un objectiu nou a la Plàstica (composicions amb figures geomètriques) al mig de la llista, i ha canviat tres objectius de Robòtica.',
      },
    },
    assigs: {
      'Català': [
        'Llegir amb la fluïdesa i l’entonació adequades segons el text.',
        'Comprendre textos de tipologies diverses (orals i escrits) adequats al nivell.',
        'Reconèixer textos de tipologies diverses.',
        'Separar les paraules per síl·labes.',
        'Començar a identificar la síl·laba tònica en les paraules.',
        'Realitzar dictats preparats per tal d’anar fixant l’escriptura correcta de les paraules treballades.',
        'Respectar les normes bàsiques d’ortografia treballades (noms propis i comuns), reconèixer la e oberta (/ɛ/), la e tancada (/e/), la o oberta (/ɔ/), la o tancada (/o/) i la o neutra tot identificant les diferències de so en paraules freqüents.',
        'Donar importància a l’aprenentatge de la llengua catalana com a eina bàsica de comunicació i aprenentatge.',
        'Prendre consciència de la importància de lliurar les tasques de manera acurada, ordenada i ben elaborada.',
      ],
      'Castellà': [
        'Comprendre el contingut d’un missatge oral.',
        'Adquirir i utilitzar el vocabulari de fets quotidians.',
        'Verbalització de descripcions curtes d’objectes i persones.',
        'Saber els noms dels membres de la família en llengua castellana.',
        'Saber llegir frases amb fluïdesa.',
        'Completar frases escollint la paraula correcta.',
        'Llegir i adquirir vocabulari de paraules escrites amb ch, y, ñ.',
        'Mostrar interès i participació a l’aula.',
        'Donar importància a l’aprenentatge de la llengua castellana com a eina bàsica de comunicació i aprenentatge.',
        'Prendre consciència de la importància de lliurar les tasques de manera acurada, ordenada i ben elaborada.',
      ],
      'Anglès': [
        'Comprendre missatges orals relacionats amb els temes treballats. (explicacions de la mestra, audicions,...)',
        'Usar preguntes amb estructures senzilles (“Do you like…?” / “Can you…?”).',
        'Saber respondre a preguntes senzilles amb l’estructura corresponent (“Yes, I like” / “No I don’t like” / “I can” / “I can’t”).',
        'Conèixer i utilitzar el vocabulari treballat a cada unitat.',
        'Utilitzar oralment les estructures treballades (Can I go to the toilet? / How are you? / Do you like English class?...).',
        'Cantar les cançons treballades.',
        'Conèixer i utilitzar el vocabulari treballat a l’obra de teatre “Wanda the witch” així com també les cançons relacionades amb l’obra.',
        'Aprendre el vocabulari relacionat amb les festivitats de Halloween i Christmas.',
        'Donar importància a l’aprenentatge de la llengua anglesa com a eina de comunicació globalitzada.',
        'Participar de les activitats i jocs proposats.',
        'Prendre consciència de la importància de lliurar les tasques de manera acurada, ordenada i ben elaborada.',
      ],
      'Medi': [
        'Conèixer els 5 sentits, relacionar-los amb els òrgans on es troben i reconèixer algunes parts d’aquests.',
        'Gaudir i participar de les activitats sensorials proposades, i aprendre la funció de cada sentit.',
        'Prendre consciència dels hàbits alimentaris i d\'higiene per una vida saludable.',
        'Prendre consciència de la importància de lliurar les tasques de manera acurada, ordenada i ben elaborada.',
      ],
      'Matemàtiques': [
        /* ⚠ Direcció va canviar aquesta llista SENCERA el 9/11/2026: abans
           n'hi havia quinze i ara n'hi ha dotze, i no són les mateixes. Veure
           `canvis` d'aquest trimestre, al final del bloc. */
        'Comptar, llegir i escriure nombres fins al 100, endavant i endarrere.',
        'Representar nombres fins al 100 de diverses maneres: amb material manipulatiu, amb dibuixos de desenes i unitats i a la recta numèrica.',
        'Compondre i descompondre nombres de dues xifres en desenes i unitats, i també el 100.',
        'Comparar i ordenar nombres fins al 100 i fer servir els signes <, > i =.',
        'Entendre la centena com a 10 desenes i representar-la amb material.',
        'Sumar desenes amb desenes, també a la recta numèrica, i representar-ne el resultat.',
        'Resoldre sumes de dues xifres amb i sense portar-ne i restes sense portar-ne, i fixar-se en el signe per saber quina operació cal fer.',
        'Calcular mentalment en el rang de l’1 al 20: descomposicions del 10, dobles i quasi dobles.',
        'Reconèixer, continuar i crear patrons i seqüències numèriques i de figures.',
        'Reconèixer figures simètriques i saber-les completar.',
        'Representar i descriure figures geomètriques planes.',
        'Resoldre problemes senzills de suma i resta de la vida quotidiana, triant l’operació i escrivint-ne la resposta.',
      ],
      'Cultura Religiosa': [
        'Conèixer i valorar les festes tradicionals del nostre país, les costums i les creences com a patrimoni cultural del país.',
        'Saber que moltes Marededéus són venerades en santuaris.',
        'Adonar-se les canvis que s’han produït a la natura durant la tardor.',
        'Adonar-se del sentit de la festa de Tots Sants per als cristians.',
        'Conèixer el sentit de la celebració de l’Advent, com a temps d’espera.',
        'Saber quines són les principals tradicions del Nadal de diferents països.',
        'Prendre consciència de la importància de lliurar les tasques de manera acurada, ordenada i ben elaborada.',
      ],
      'Educació Física': [
        'Moure les diverses parts del cos i reconèixer-les pel seu nom.',
        'Utilitzar els recursos plàstics per interioritzar les diferents parts del cos.',
        'Representar el seu propi cos de forma global i segmentària.',
        'Identificar els dos segments corporals dreta i esquerra.',
        'Afirmar els segments dominants dins el procés de lateralització.',
        'Experimentar postures en equilibri i desequilibri.',
        'Realitzar salts i rodaments prenent consciència de la posició del cos.',
        'Començar a buscar estratègies per tal de cooperar amb els companys/es en els jocs d’equip.',
        'Assumir el resultat del joc sense crear conflictes ni enfadar-se.',
        'Escoltar les normes i consignes dels jocs per poder realitzar correctament les activitats proposades.',
        'Mostrar interès i gaudi en la participació dels jocs.',
        'Portar l’equipament adequat per realitzar l’educació física.',
      ],
      'Música': [
        'Conèixer i cantar de memòria les cançons apreses, tenint cura de l\'entonació, la dicció i la continuïtat de la línia melòdica.',
        'Reconèixer i mantenir una pulsació regular, diferenciant-la del ritme a través del cant, el moviment i la percussió.',
        'Llegir, interpretar i crear petits patrons rítmics de quatre pulsacions amb les figures treballades (negra, dues corxeres i silenci de negra).',
        'Reconèixer, llegir i entonar, amb ajuda, les notes DO, RE, MI, SOL i LA al pentagrama.',
        'Discriminar auditivament la direccionalitat del so, identificant sons ascendents, descendents i estables.',
        'Escoltar amb atenció, respecte i interès les audicions musicals, reconeixent i expressant alguns elements de la música a través del moviment.',
        'Participar en danses i interpretacions musicals col·lectives, coordinant els moviments amb la música i mostrant una actitud de respecte i col·laboració.',
      ],
      'Tallers': [
        '# Plàstica',
        'Utilitzar diferents materials, instruments i tècniques per a les produccions plàstiques.',
        'Perfeccionar la motricitat fina.',
        'Expressar-se i gaudir a través del llenguatge artístic.',
        'Dominar el gest tot plasmant diferents línies, formes i lletres.',
        'Utilitzar figures geomètriques per a realitzar composicions artístiques.',
        'Observar, analitzar i aplicar les característiques significatives observades, representant-les de forma autònoma, espontània i creativa.',
        'Conèixer trets característics de l’obra d’artistes com: Salvador Dalí i Yayoi Kusama.',
        'Desenvolupar la creativitat en els propis treballs.',
        'Valorar els treballs artístics propis i els de la resta de companys.',
        '# Robòtica',
        'Aprendre a través de la robòtica, l’Mtiny.',
        'Aprendre la lògica bàsica de la programació a través de l’Scratch JR.',
        'Fomentar el pensament creatiu.',
        'Treballar i desenvolupar la motricitat fina amb el Lego Spike.',
        'Adquirir el coneixement de vocabulari específic.',
        '# Teatre',
        'Desenvolupar la capacitat d’expressió corporal i gestual per comunicar idees, accions i emocions sense necessitat de paraules.',
        'Millorar l’expressió oral, modulant la veu, el ritme i l’entonació per transmetre emocions i intencions de manera clara i expressiva.',
        'Fomentar la creativitat i la imaginació a través del joc dramàtic, la improvisació i la creació d’escenes teatrals.',
        'Promoure la cooperació i el treball en equip, valorant les aportacions dels companys i construint conjuntament escenes i situacions teatrals.',
        'Potenciar la confiança i la desinhibició personal, afavorint una actitud positiva davant de l’expressió pública i del grup.',
        'Reconèixer i gestionar les emocions pròpies i alienes, aprenent a expressar-les i a representar-les de manera conscient i respectuosa.',
      ],
    },
  },

  /* ---------- Quan direcció canvia una llista sencera ----------

     ⚠ AIXÒ NO ÉS DECORACIÓ. L'identificador de cada objectiu va per POSICIÓ
     (veure `_objId`), i això és a posta: així, quan direcció corregeix la
     redacció d'un objectiu, el que la mestra hagi marcat no es perd.

     Però el 9/11/2026 va passar l'altra cosa: direcció va REESCRIURE la
     llista de Matemàtiques de 2n sencera —de quinze objectius a dotze, i no
     els mateixos—. Les marques es queden a la seva posició, i per tant ara
     són d'un objectiu que diu una altra cosa. Això no es pot endevinar des de
     l'app i no es pot arreglar sol: només es pot DIR, i que la mestra ho
     repassi. Si no es digués, ella veuria una graella plena de marques que ja
     no volen dir el que volien dir.

     Quan direcció doni els objectius per definitius i no s'hagin de tornar a
     moure, aquests avisos es poden treure. */

  /* ---------- 3r de Primària ---------- */
  '3r|1': {
    provisional: true,
    /* En negre al document, repassades (llegit amb `eines/objectius-colors.js`
       el 9/11/2026 a la tarda). A Anglès els objectius van mig negres i mig
       vermells i el títol encara és vermell: es queda provisional. */
    definitius: ['Medi', 'Matemàtiques', 'Cultura Religiosa'],
    canvis: {
      'Música': {
        data: '10 de novembre',
        que: 'Direcció ha refet la llista sencera: de 11 objectius a 7, i tots amb una altra redacció.',
      },
      'Tallers': {
        data: '9 de novembre',
        que: 'Direcció ha refet el taller de Robòtica de dalt a baix (de 8 objectius a 13) i ha reanomenat el taller de creativitat.',
      },
    },
    assigs: {
      'Català': [
        'Expressar-se oralment amb correcció i coherència.',
        'Representar diàlegs.',
        'Aprendre l’abecedari.',
        'Saber ordenar paraules per ordre alfabètic.',
        'Llegir amb la fluïdesa, la precisió i l’entonació adequades.',
        'Comprendre textos de tipologia diversa adequats a l’edat.',
        'Comprendre el llibre de lectura a casa.',
        'Utilitzar la lectura com a mitjà per ampliar el vocabulari i fixar l’ortografia correcta.',
        'Escriure diàlegs respectant la seva estructura i tenint cura dels aspectes normatius, la cal·ligrafia, l’ordre i la presentació.',
        'Ús del guionet en els diàlegs.',
        'Aprendre a utilitzar el diccionari.',
        'Aplicar les normes ortogràfiques dels sons de la erra i la diferència entre la B/V.',
        'Realitzar correctament dictats preparats.',
      ],
      'Castellà': [
        'Expressar-se oralment amb correcció i coherència.',
        'Comprendre textos orals de diferent tipologia.',
        'Preparar i representar una conversa telefònica.',
        'Llegir amb la fluïdesa, la precisió i l’entonació adequades.',
        'Utilitzar la lectura com a mitjà per ampliar el vocabulari i fixar l’ortografia correcta.',
        'Aprendre vocabulari relacionat amb les fruites i les verdures.',
        'Aplicar les normes ortogràfiques de la CH i la Ñ .',
        'Utilitzar correctament els signes de puntuació: punt, coma, interrogant i exclamació.',
        'Realitzar correctament dictats preparats.',
      ],
      'Anglès': [
        'Comprendre oralment i a través de l’escriptura els elements més significatius de cada unitat, tals com històries, vocabulari i cançons.',
        'Comprendre les explicacions, instruccions i ordres donades per la mestra.',
        'Comprendre les audicions, les històries breus, enunciats i frases.',
        'Expressar oralment i a través de l’escriptura els elements més significatius de cada unitat.',
        'Desenvolupar diàlegs breus, fer preguntes i respostes utilitzant les estructures i el vocabulari treballat.',
        'Comprendre diferents tipus de textos (enunciats, còmics, contes...)',
        'Saber les estructures verbals treballades (Are they (big)? Yes, they are. / No, they aren’t. They’re (black and white)! They play. They don’t walk.',
        'Conèixer el vocabulari de cada unitat (animals in danger,a dolphin, a gorilla, a hippo, a panda, a seal, a tiger, a tortoise, a whale i els verbs drink, eat, fight, play, sleep, walk) i consolidar el vocabulari anterior (colors, números, mesos de l’any, vocabulari anys anteriors...).',
        'Comprendre el vocabulari i les estructures gramaticals de l’obra de teatre en anglès “Magic Mindy”.',
        'Conèixer les tradicions i vocabulari de Halloween.',
        'Saber les estructures verbals treballades (What time is (Maths)? (Maths) is at (nine) o’clock / half past (ten). He / She lives … He / She doesn’t like, What have you got on your pizza? Have you got any (pineapple), I’ve got some (pineapple). I haven’t got any (peppers). Does he / she like (spinach)? …Yes, he / she does. / No, he / she doesn’t.',
        'Conèixer les tradicions de Nadal i el seu vocabulari (broccoli, Christmas pudding, gravy, mince pies, peas, roast potatoes, roast turkey i sprouts).',
      ],
      'Medi': [
        'Conèixer espècies marines presents a les platges de Catalunya i la seva adaptació al medi.',
        'Identificar els diferents tipus de pesca existents.',
        'Comprendre el procés de pesca actual i la comparació amb el passat.',
        'Identificar els diferents grups d’animals vertebrats i les seves característiques.',
        'Comprendre el procés de reproducció, de relació i de nutrició dels animals vertebrats.',
        'Utilitzar el mètode científic per establir conclusions sobre el concepte del so.',
        'Comprendre com viatja el so a través dels diferents medis.',
        'Reflexionar sobre la contaminació acústica a la qual estem exposats.',
        'Utilitzar correctament les tecnologies (TIC) per buscar i seleccionar informació relacionada amb el treball dels animals vertebrats.',
      ],
      'Matemàtiques': [
        'Ús de representacions per a la descomposició de nombres.',
        'Escollir l\'operació adequada per resoldre correctament els problemes matemàtics.',
        'Ús de models i expressions matemàtiques per representar les relacions.',
        'Saber aplicar estratègies de salt de suma i resta i descomposició.',
        'Saber descriure i enumerar les propietats de les figures geomètriques.',
        'Formular preguntes abordables amb dades així com recollir, organitzar i presentar les dades rellevants per respondre-les.',
        'Treure conclusions i fer prediccions.',
        'Comprendre els nombres i el sistema numèric a partir de la línia numèrica.',
        'Estimació del resultat de sumes i restes.',
        'Realitzar sumes i restes de nombres de tres xifres portant-ne.',
        'Propietat commutativa i associativa de la suma.',
        'Relacionar unitats, desenes, centenes i unitats de miler.',
        'Identificar el valor posicional de les xifres d’un nombre.',
        'Llegir i escriure nombres fins a quatre xifres.',
        'Localitzar i descriure relacions espacials.',
        'Comparar i ordenar nombres fins a quatre xifres.',
        'Arrodonir nombres de tres xifres.',
        'Introduir el concepte de la multiplicació.',
      ],
      'Cultura Religiosa': [
        'Distingir entre el llenguatge científic i el llenguatge poètic.',
        'Observar i conèixer el Tapís de la Creació.',
        'Conèixer i adonar-se sobre diferents versions de l’origen del món.',
        'Conscienciar sobre la importància de respectar l’entorn natural.',
        'Conèixer i interpretar el mite bíblic de la Creació.',
        'Entendre que el mite d’Adam i Eva ens vol explicar l’origen del Bé i del Mal, juntament amb el mite de Prometeu.',
        'Prendre consciència del que fem ben fet i el que fem malament.',
        'Reflexionar sobre emocions: l’enveja.',
        'Conèixer el mite bíblic de Caïm i Abel.',
      ],
      'Educació Física': [
        'Conèixer i experimentar els gestos tècnics bàsics dels estils de natació: crol i esquena.',
        'Aconseguir autonomia en el medi aquàtic, desenvolupant activitats com desplaçaments, salts, girs, etc.',
        'Participar en el joc col·lectiu de manera activa mostrant-se respectuós amb les normes i els companys.',
        'Ser conscient de les pròpies limitacions motrius.',
        'Participar en la realització dels jocs.',
        'Acceptar el triomf i la derrota d\'igual manera i gaudir dels jocs.',
        'Complir amb les normes dels jocs.',
        'Rentar-se les mans i beure aigua després de fer activitats físiques.',
        'Portar l’equipament esportiu i calçat adequat per a la pràctica de l’activitat física.',
      ],
      'Música': [
        'Conèixer i cantar de memòria les cançons apreses, tenint cura de l\'entonació, la dicció i l\'expressivitat.',
        'Reconèixer i mantenir una pulsació regular, diferenciant-la del ritme a través del cant, el moviment i la percussió.',
        'Llegir, escriure, interpretar i crear ritmes de quatre pulsacions amb les figures treballades (negra, dues corxeres, blanca i silenci de negra).',
        'Reconèixer, llegir, escriure i entonar les notes DO, RE, MI, FA i SOL al pentagrama, amb el suport de la imitació i la fonomímia.',
        'Discriminar auditivament i reproduir petits fragments melòdics de tres altures.',
        'Escoltar amb atenció, respecte i interès les audicions musicals, reconeixent-ne alguns elements i identificant les característiques i el timbre del clarinet.',
        'Participar en danses i interpretacions musicals col·lectives, coordinant els moviments amb la música i mostrant una actitud de respecte i col·laboració.',
      ],
      'Tallers': [
        '# Taller món de colors',
        'Conèixer els colors primaris.',
        'Descobrir els colors secundaris a partir de la barreja dels primaris.',
        'Experimentar diferents tècniques plàstiques.',
        'Perfeccionar la motricitat fina.',
        'Experimentar amb materials no convencionals (llana, cartró, paper diari, fotografies…)',
        'Crear composicions visuals equilibrades creant sanefes, repeticions i patrons decoratius.',
        'Treballar l’autonomia i la responsabilitat en l’ús de materials i recollint correctament.',
        '# Taller d’aplicació de tècniques plàstiques dins l’escultura',
        'Saber i utilitzar diferents materials, instruments i tècniques de representació plàstica que permetin expressar el coneixement de la realitat i el món interior.',
        'Experimentar i aprendre la utilització de diferents materials.',
        'Conèixer i treballar diferents tècniques plàstiques. El modelatge de fang, pintura, construcció amb material reciclat, escultura de filferro, etc.',
        'Millorar la capacitat de manipulació i el sentit estètic.',
        'Desenvolupar la imaginació, la creativitat i l\'expressió.',
        '# Taller d’estampació',
        'Conèixer diferents tècniques d’estampació.',
        'Mostrar iniciativa personal.',
        'Gaudir creant obres artístiques pròpies.',
        'Crear segells amb goma eva, objectes quotidians, material de rebuig i elements naturals.',
        'Experimentar al màxim les possibilitats de la tècnica d’estampació.',
        'Elaborar diferents composicions amb la tècnica d’estampació.',
        'Expressar llibertat i originalitat en les pròpies manifestacions artístiques.',
        'Apreciar i respectar les obres d’art de l’entorn proper les pròpies i les dels companys.',
        '# Taller de robòtica',
        'Iniciar-se en la creació de petits projectes a partir del llenguatge de programació Scratch.',
        'Entendre la lògica bàsica de programació: la seqüència, l’ordre de les instruccions i la repetició.',
        'Conèixer l’esdeveniment i la condició com a maneres de fer que un programa reaccioni, i iniciar-se en l’ús de les variables.',
        'Entendre i desxifrar un codi de programació ja fet, i saber dir què farà abans d’executar-lo.',
        'Saber dirigir un robot amb codis de color, sense necessitat de cap pantalla.',
        'Relacionar la mesura d’una distància real amb els passos que cal escriure en un programa.',
        'Saber els components bàsics per construir un robot o una màquina, i distingir el sensor de l’actuador.',
        'Conèixer els mecanismes principals per a crear muntatges amb moviment.',
        'Controlar a través de la programació dos motors i sensors bàsics.',
        'Saber trobar l’error d’un programa o d’un muntatge que no funciona i explicar-ne la causa.',
        'Saber explicar a una altra persona com funciona allò que s’ha construït o programat.',
        'Ampliar el coneixement de vocabulari específic de les peces de muntatge i de les eines del taller.',
        'Saber guardar els projectes creats de manera correcta i tenir cura del material del taller.',
      ],
    },
  },

  /* ---------- 4t de Primària ---------- */
  '4t|1': {
    provisional: true,
    /* Assignatures que direcció ha canviat de dalt a baix: la pantalla
       ho avisa perquè les marques d'abans ja no volen dir el mateix. */
    canvis: {
      'Música': {
        data: '10 de novembre',
        que: 'Direcció ha refet la llista sencera: d’11 objectius a 8, i tots amb una altra redacció.',
      },
    },
    assigs: {
      'Català': [
        'Utilitzar adjectius, frases fetes i comparacions per a descriure persones.',
        'Identificar comparacions i metàfores a través de la descripció de persones.',
        'Escriure comparacions i metàfores.',
        'Conèixer les parts d’una oració (subjecte, predicat…).',
        'Conèixer les normes ortogràfiques de la b/v.',
        'Utilitzar un vocabulari precís i adequat al tema del qual es parla.',
        'Llegir amb la fluïdesa i l’entonació adequades.',
        'Comprendre textos de diferents tipologies.',
        'Comprendre el llibre llegit a casa.',
        'Realitzar correctament dictats preparats.',
        'Identificar errors ortogràfics.',
      ],
      'Castellà': [
        'Utilitzar un vocabulari precís i adequat al tema de què es parla.',
        'Llegir amb la fluïdesa i entonació adequades.',
        'Entendre textos orals de la vida quotidiana.',
        'Comprendre textos de diferents tipologies.',
        'Escriure petits textos de tipologia diversa.',
        'Escriure correctament els sons de g i la j.',
        'Escriure correctament paraules amb ñ i ch.',
        'Escriure el menú d’un restaurant.',
        'Identificar els elements de la carta d’un restaurant.',
        'Preparar i representar una conversa imaginària en un restaurant.',
        'Escriure i comprendre endevinalles i jocs de paraules.',
        'Completar frases.',
        'Realitzar correctament dictats preparats.',
      ],
      'Anglès': [
        'Desenvolupar habilitats per la comprensió i producció orals.',
        'Desenvolupar les capacitats i estratègies per l’adquisició de la llengua anglesa.',
        'Utilitzar un codi lingüístic diferent especialment centrat en l’audició i producció de nous sons.',
        'Comprendre les diferents tipologies d’escrits i cançons de les unitats.',
        'Comprendre les instruccions de la mestra.',
        'Repassar el vocabulari treballat als cursos previs, com per exemple l’enumeració, mesos de l’any o l’abecedari.',
        'Introduir nous continguts referents al vocabulari: malalties, adjectius per la descripció de persones, activitats diàries, les hores i les parts del dia.',
        'Treballar el vocabulari i cançons relacionat amb l’obra de teatre Tarzan.',
        'Conèixer les tradicions i vocabulari de Halloween.',
        'Treballar el vocabulari sobre la festivitat del Nadal i el Bonfire Night.',
        'Entendre els enunciats dels exercicis.',
        'Introduir i practicar noves estructures: What’s the matter with you / him / her? I’ve / He’s / She’s got (a cold). What does he / she look like? He’s / She’s got (long, dark) hair. He’s / She’s (tall). What time does he / she (eat dinner)? He / She (eats dinner) at (seven o’clock). He / She doesn’t (eat dinner) at (half past ten). Does he / she (watch TV) at (quarter to eight) / in the (morning)? Yes, he / she does. No, he / she doesn’t',
      ],
      'Medi': [
        'Plantejament de preguntes i observació sobre la boira.',
        'Experimentació del cicle de l’aigua.',
        'Identificar i reconèixer el procés i fases del cicle de l’aigua.',
        'Ús responsable de l’aigua.',
        'Identificar Vic i Osona al mapa.',
        'Conèixer els municipis que envolten Vic.',
        'Conèixer les comarques que envolten Osona.',
        'Conèixer les muntanyes més rellevants d’Osona.',
        'Recordar els diferents paisatges: de costa, d’interior i de muntanya.',
        'Debatre els acords i desacords amb els membres de l’equip de manera respectuosa.',
        'Ampliar el coneixement de vocabulari específic.',
        'Fomentar el pensament creatiu.',
        'Compartir els coneixements propis i mostrar una actitud col·laborativa al llarg del projecte.',
      ],
      'Matemàtiques': [
        'Comparar i ordenar nombres de cinc i sis xifres.',
        'Fer ús de la recta numèrica per situar nombres de cinc i sis xifres.',
        'Realitzar estimacions i aproximacions en contextos de resolució de problemes.',
        'Aplicar estratègies de càlcul per buscar nombres que falten en les sumes.',
        'Identificar i ordenar el valor de posició de les xifres.',
        'Saber identificar les formes geomètriques de dues i tres dimensions en objectes de la vida quotidiana.',
        'Conèixer els elements i característiques dels cossos geomètrics.',
        'Fer ús de la recta del temps: situació de dates.',
        'Representació de dades en taules i gràfics de barres.',
        'Recollida i comptatge de dades: la moda.',
        'Representació geomètrica de la multiplicació.',
        'Aplicar estratègies de càlcul: sumar i restar nombres propers a desenes exactes.',
        'Aplicar el càlcul i estimació de quantitats i canvi (euros i cèntims d’euro) en la vida quotidiana.',
        'Ús de punts de referència per indicar posicions o desplaçaments. Les coordenades.',
        'Interpretació d’itineraris en mapes i plànols.',
        'Capacitat per resoldre i interpretar problemes amb més d’una operació (suma, resta, multiplicació).',
        'Adquirir agilitat i destresa en el càlcul mental (sumes, restes i taules de multiplicar.',
      ],
      'Cultura Religiosa': [
        'Conèixer, identificar i interpretar els símbols dels quatre evangelistes.',
        'Conèixer la vida de Sant Sebastià i Santa Magdalena i algunes de les representacions pictòriques que s’han fet d’aquests dos sants.',
        'Conèixer i interpretar la paràbola del Fill pròdig i la de l’ovella perduda com a clau per entendre la idea del perdó i l’empatia.',
        'Adonar-nos que moltes altres cultures, a través de diferents contes i proverbis, també posen en valor el perdó, l’empatia i el saber estimar sense condicions.',
        'Llegir i comprendre contes i paràboles de diferents cultures tot buscant-ne similituds i reflexions.',
      ],
      'Educació Física': [
        'Situar-se en l’espai.',
        'Apreciar diferents distàncies i localitzacions.',
        'Conèixer quin és el segment dominat i el no dominant.',
        'Emprar de manera bàsica el segment no dominant.',
        'Realitzar equilibris sobre diferents superfícies amb seguretat.',
        'Dominar l’equilibri estàtic i dinàmic manipulant objectes.',
        'Treballar l’autosuperació.',
        'Estimular la capacitat d’esforç.',
        'Aprendre a buscar estratègies per resoldre conflictes.',
        'Mostrar interès i participar a l’aula.',
        'Cooperar amb els companys/es del mateix equip.',
        'Respectar als companys i adversaris.',
        'Respectar les regles i normes del joc.',
        'Assumir el resultat del joc sense crear conflictes i enfadar-se.',
        'Rentar-se les mans i beure aigua després de fer activitats físiques.',
        'Portar l’equipament esportiu i calçat adequat per a la pràctica de l’activitat física.',
      ],
      'Música': [
        'Escoltar amb atenció, respecte i interès les audicions musicals, reconeixent-ne alguns elements com els instruments, les frases musicals i l\'estructura.',
        'Conèixer i cantar de memòria les cançons apreses, tenint cura de l\'entonació, la dicció i l\'expressivitat.',
        'Participar en la interpretació de cànons i obstinats rítmics i melòdics, mantenint la pròpia part i escoltant els companys.',
        'Llegir, interpretar, discriminar auditivament i crear patrons rítmics amb les figures treballades (blanca, negra, corxeres, semicorxeres i silencis).',
        'Reconèixer, llegir i entonar les notes de l\'escala de DO al pentagrama, amb el suport de la imitació i la fonomímia.',
        'Conèixer i reconèixer els instruments de la família de vent fusta (flauta travessera, oboè, clarinet i fagot), identificant-ne les característiques i el timbre.',
        'Interpretar acompanyaments musicals senzills amb instruments com els carrillons, les campanes i els boomwhackers, seguint la pulsació i respectant les entrades.',
        'Participar en danses i activitats d\'expressió corporal, coordinant els moviments amb la música i amb els companys.',
      ],
      'Tallers': [
        '# Taller d’aplicació de tècniques plàstiques dins l’escultura',
        'Saber i utilitzar diferents materials, instruments i tècniques de representació plàstica que permetin expressar el coneixement de la realitat i el món interior.',
        'Experimentar i aprendre la utilització de diferents materials i eines.',
        'Conèixer i treballar diferents tècniques plàstiques. El modelat de fang, obres amb filferro, teixir amb teler, Etc..',
        'Millorar la capacitat de manipulació i el sentit estètic.',
        'Desenvolupar la imaginació, la creativitat i l\'expressió.',
        'Aprendre a valorar el seu treball i el dels altres.',
        '# Taller: Quina Cara!',
        'Explorar i utilitzar diferents materials, instruments i tècniques de representació plàstica.',
        'Ser constant en la feina i superar les dificultats.',
        'Mostrar iniciativa personal.',
        'Millorar el traç i la grafomotricitat.',
        'Gaudir creant obres artístiques pròpies.',
        'Dibuixar el propi rostre de manera realista, expressiva, minimalista i abstracta.',
        'Reproduir el propi rostre amb diferents tècniques i materials.',
        'Editar una fotografia amb finalitat artística amb un senzill programa d’edició.',
        'Desenvolupar la imaginació i la creativitat.',
        '# Taller de dibuix',
        'Fomentar la creativitat i la confiança en les pròpies habilitats artístiques a través de diferents tècniques de dibuix.',
        'Fomentar la imaginació dels alumnes.',
        'Introduir tècniques bàsiques de dibuix.',
        'Desenvolupar la motricitat fina i la coordinació ull-mà.',
        'Aprendre a observar i representar la realitat.',
        'Desenvolupar l’observació i la representació del que ens envolta.',
        'Aprendre a expressar emocions i idees a través del traç i el color.',
        'Gaudir del procés creatiu.',
        'Tenir cura de la presentació de la feina i posar-hi esforç.',
        '# Taller: Robòtica',
        'Conèixer els tipus de forces i la seva utilitat.',
        'Reconèixer i diferenciar les màquines simples de les compostes.',
        'Conèixer els mecanismes principals per a crear muntatges amb moviment.',
        'Controlar a través de la programació uns motors i sensors bàsics.',
        'Crear robots i màquines amb enginy utilitzant més d’un mecanisme.',
        'Aprendre conceptes bàsics sobre circuits elèctrics.',
        'Crear un projecte final unint la programació amb l’Scratch i l’ús de les plaques Makey-Makey.',
        'Entendre la lògica bàsica de programació.',
        'Entendre i desxifrar el codi de programació.',
      ],
    },
  },

  /* ---------- 5è de Primària ---------- */
  '5è|1': {
    provisional: true,
    /* Assignatures que direcció ha canviat de dalt a baix: la pantalla
       ho avisa perquè les marques d'abans ja no volen dir el mateix. */
    canvis: {
      'Música': {
        data: '10 de novembre',
        que: 'Direcció ha refet la llista sencera: de 9 objectius a 7, i tots amb una altra redacció. Ja no hi surt la cantata.',
      },
    },
    assigs: {
      'Català': [
        'Fluïdesa de la comunicació oral a l’aula.',
        'Exposició oral: representació de diàlegs on s’ha de demanar i donar informació, expressar opinions i dubtes, i arribar a un acord per triar entre dues opcions de viatge.',
        'Llegir de forma comprensiva i expressiva diferents tipus de textos.',
        'Comprendre el contingut de textos de tipologia diversa.',
        'Comprendre els llibres de lectura llegits a classe i a casa.',
        'Escriure textos tenint cura de la seva estructura, els aspectes normatius, la cal·ligrafia, l’ordre i la presentació.',
        'Realitzar correctament dictats preparats i sense preparar.',
        'Repassar la separació sil·làbica i la síl·laba tònica.',
        'Diferenciar un hiat d’un diftong i saber-ho separar per síl·labes.',
        'Classificar les paraules segons la síl·laba tònica en agudes, planes o - esdrúixoles.',
        'Conèixer les normes ortogràfiques sobre l’accentuació bàsica.',
        'Conèixer alguns accents diacrítics.',
      ],
      'Castellà': [
        'Llegir de forma expressiva textos de tipologia diversa.',
        'Preparar i fer una exposició oral sobre un ofici i sobre un mateix.',
        'Comprendre textos de tipologia diversa.',
        'Respondre preguntes, tant orals com escrites, sobre diferents tipus de textos.',
        'Produir textos seguint una pauta establerta (descripció i notícia).',
        'Trobar sinònims i antònims de diferents paraules donades.',
        'Utilitzar els adjectius descriptius.',
        'Escriure correctament el singular, plural i els invariables.',
        'Realitzar dictats preparats.',
        'Utilitzar el diccionari bilingüe per buscar la traducció del vocabulari sobre els oficis.',
        'Entendre i escriure correctament les paraules relacionades amb els oficis.',
      ],
      'Anglès': [
        'Entendre enunciats i instruccions del mestre.',
        'Escoltar les audicions i entendre-les.',
        'Entendre i cantar les cançons de les unitats',
        'Comprendre les històries de les unitats, llegir i respondre preguntes.',
        'Posar en pràctica les estructures i el vocabulari treballat en petits textos.',
        'Presentar verbs i adjectius relacionats amb els esports.',
        'Utilitzar el present simple: tercera persona, frases afirmatives i negatives, preguntes i respostes curtes.',
        'Fer servir present continuous: preguntes i respostes curtes.',
        'Fer ús dels possessive’s.',
        'Treballar vocabulari sobre la festivitat de Halloween.',
        'Utilitzar els adverbis de temps i formular preguntes (usually, sometimes, never, every day, always, how often…).',
        'Formular preguntes i respostes amb “Why” i “Because”.',
        'Produir textos fent ús dels superlatius i comparatius (better, best, worse, worst…).',
        'Repassar el vocabulari sobre els animals salvatges (camel, giraffe, bear…).',
        'Treballar el vocabulari sobre com guiar-nos per un espai concret mitjançant l’obra de teatre.',
      ],
      'Medi': [
        'Identificar les funcions vitals dels éssers vius.',
        'Conèixer de què estan fets els éssers vius: la cèl·lula.',
        'Reconèixer i diferenciar la cèl·lula vegetal, la cèl·lula animal i el bacteri.',
        'Entendre i identificar les funcions de diversos aparells meteorològics: termòmetre, higròmetre, baròmetre, pluviòmetre, penell i anemòmetre.',
        'Reconèixer els factors climàtics: temperatura, humitat, pressió atmosfèrica, precipitació i vent. Saber què ens indiquen.',
        'Identificar diferents classes de núvols.',
        'Llegir i interpretar dades del temps atmosfèric.',
        'Distingir els diferents cossos de l’univers.',
        'Localitzar la Terra i els altres planetes.',
        'Promoure el valor democràtic. Emprenedoria.',
      ],
      'Matemàtiques': [
        'Resoldre problemes utilitzant diferents operacions matemàtiques.',
        'Utilitzar les propietats de la suma per desenvolupar estratègies de càlcul mental.',
        'Identificar nombres romans.',
        'Resoldre situacions quotidianes mitjançant càlculs numèrics.',
        'Situar nombres en la recta numèrica.',
        'Resoldre sumes i restes amb unitats de temps.',
        'Diferenciar els tipus de rectes: paral·leles, perpendiculars, secants, segments, rectes i semirectes.',
        'Utilitzar el transportador i el compàs pel dibuix i el càlcul d’angles i bisectrius.',
        'Calcular fraccions emprant les regles de 3.',
        'Aproximar divisions utilitzant els decimals.',
        'Fer servir les fraccions, els percentatges i els decimals per expressar quantitats.',
      ],
      'Cultura Religiosa': [
        'Conèixer l’espai geogràfic d’Israel pel qual es va moure Jesús.',
        'Descobrir els diferents grups socials en temps de Jesús.',
        'Conèixer, a partir d’imatges romàniques, les principals narracions de Nadal.',
        'Identificar alguns dels principals drets de l’infant.',
        'Saber d’organitzacions que treballen pels drets humans',
        'Conèixer situacions d’injustícia en àmbits propers als mateixos alumnes.',
        'Adonar-nos que podem donar resposta a injustícies que hi ha al nostre entorn.',
        'Descobrir les actituds de Jesús davant les injustícies del seu temps.',
        'Compartir diferents formes i tradicions de celebració de Nadal a casa nostra.',
      ],
      'Educació Física': [
        'Conèixer i identificar les regles bàsiques de l’handbol.',
        'Executar passades i recepcions de forma eficaç.',
        'Botar la pilota correctament, de diferents maneres.',
        'Controlar la pilota, tant en desplaçaments com aturats.',
        'Llançar la pilota correctament, de diferents maneres.',
        'Donar importància als hàbits higiènics.',
        'Acceptar la diversitat física, d’opinió i d’acció.',
        'Entendre la necessitat de reforçar i cuidar el cos.',
        'Experimentar el joc com a objecte de plaer i recreació.',
        'Realitzar jocs de diverses tipologies.',
        'Conèixer jocs diversos i complir amb les seves normes.',
        'Gaudir dels jocs duts a terme sense tindre en compte els resultats.',
      ],
      'Música': [
        'Escoltar amb atenció, respecte i interès les audicions musicals, reconeixent-ne alguns elements, les característiques de les obres i els seus compositors o intèrprets.',
        'Conèixer i cantar de memòria les cançons apreses, tenint cura de l\'afinació, la dicció, la postura corporal i l\'expressivitat.',
        'Participar en interpretacions vocals col·lectives, respectant les entrades, les dinàmiques i escoltant les altres veus.',
        'Reconèixer, discriminar auditivament i interpretar patrons rítmics amb les figures treballades, especialment la corxera amb punt i la semicorxera.',
        'Interpretar patrons rítmics i acompanyaments musicals amb percussió corporal i altres recursos sonors, coordinant-se amb la música i amb els companys.',
        'Interpretar petites melodies amb la flauta dolça utilitzant les notes SOL, LA i SI, tenint cura de la digitació, la respiració, l\'articulació i la qualitat del so.',
        'Participar en danses col·lectives, reconeixent-ne l\'estructura musical i coordinant els moviments amb la música i amb els companys.',
      ],
      'Tallers': [
        '# Taller de ball de bastons',
        'Aprendre a coordinar els moviments galop d’entrada i sortida, el nou, el córrer i el gegant del pi.',
        'Reconèixer les músiques dels diferents balls treballats.',
        'Aprendre a coordinar els moviments del cos amb les músiques de les danses.',
        'Dansar amb bona posició corporal i elegància.',
        'Dominar els diferents tocs de bastons i els balls treballats.',
        'Mostrar interès pel treball en grup i sentit de pertinença.',
        'Crear una petita coreografia amb una música coneguda.',
        'Conèixer els balls treballats',
        'Conèixer aspectes i elements de la cultura popular Catalana i de la ciutat de Vic.',
        '# Taller d’aplicació de tècniques plàstiques dins l’escultura',
        'Saber i utilitzar diferents materials, instruments i tècniques de representació plàstica que permetin expressar el coneixement de la realitat i el món interior.',
        'Experimentar i aprendre la utilització de diferents materials.',
        'Conèixer i treballar diferents tècniques plàstiques. El relleu amb guix, el modelat de fang, obres amb filferro, Etc..',
        'Millorar la capacitat de manipulació i el sentit estètic.',
        'Desenvolupar la imaginació, la creativitat i l\'expressió.',
        'Aprendre a valor les obres d’art de l’entorn proper les pròpies i les dels altres.',
        '# Taller de Plàstica',
        'Desenvolupar la creativitat i la imaginació.',
        'Fer servir els elements bàsics del llenguatge plàstic (colors, línies i punts).',
        'Organitzar progressivament el procés d\'elaboració de diferents figures, fent servir la tècnica de la papiroflèxia.',
        'Mostrar seguretat i precisió en el traç.',
        'Elaborar obres pròpies a partir de les tècniques treballades.',
        '# Robòtica',
        'Adquirir coneixements sobre el nom i el funcionament de cada un dels components que formen part del robot.',
        'Entendre les bases de la programació dels robots i els seus moviments principals com per exemple detectar obstacles, moure objectes i seguir recorreguts.',
        'Desenvolupar i entendre el funcionament d’un diagrama de flux.',
        'Conèixer el funcionament de les Micro:Bit i la seva connexió amb Elecfreaks.',
        'Promoure el pensament computacional per ser capaç de resoldre i superar reptes cada vegada més complexos.',
        'Desenvolupar seqüències de blocs i control de variables per arribar a la solució final.',
      ],
    },
  },

  /* ---------- 6è de Primària ---------- */
  '6è|1': {
    provisional: true,
    /* En negre al document, repassades (9/11/2026). La resta hi són en
       vermell; a Cultura religiosa els objectius són negres però el títol
       encara és vermell, i mentre els dos colors no es posin d'acord compta
       com a provisional. */
    definitius: ['Anglès', 'Matemàtiques'],
    /* Assignatures que direcció ha canviat de dalt a baix: la pantalla
       ho avisa perquè les marques d'abans ja no volen dir el mateix. */
    canvis: {
      'Música': {
        data: '10 de novembre',
        que: 'Direcció ha refet la llista sencera: de 9 objectius a 7, i tots amb una altra redacció.',
      },
    },
    assigs: {
      'Català': [
        'Entendre i analitzar el contingut d’una audició.',
        'Respectar els torns de paraula i interactuar amb els companys de manera ordenada i respectuosa.',
        'Llegir i analitzar de forma comprensiva i expressiva diferents tipus de textos.',
        'Comprendre el contingut de textos de tipologia diversa.',
        'Escriure textos tenint cura de la seva estructura, dels aspectes normatius, de la cal·ligrafia, de l’ordre i de la presentació.',
        'Analitzar diferents missatges de correu electrònic.',
        'Planificar, redactar i revisar un missatge de correu electrònic.',
        'Desenvolupar l’aplicació de les normes d’accentuació en paraules agudes, planes i esdrúixoles.',
        'Reconèixer i utilitzar correctament les vocals àtones en les seves produccions escrites.',
        'Analitzar les parts i les característiques d’una notícia i escriure’n una de forma coherent i clara',
        'Comprendre les característiques del còmic i escriure’n de propis utilitzant el llenguatge visual i escrit adequat.',
        'Entendre la funció del text instructiu i escriure instruccions clares per explicar les normes d’un joc o una activitat.',
        'Analitzar poemes identificant-hi la rima, el ritme i els recursos poètics més rellevants',
        'Realitzar correctament dictats preparats i sense preparar.',
        'Revisar i valorar l’ortografia dels textos lliures que escriure.',
        'Comprendre els llibres de lectura llegits a classe i a casa.',
      ],
      'Castellà': [
        'Comprendre textos de tipologia diversa.',
        'Entendre i analitzar el contingut d’una audició.',
        'Respondre preguntes sobre diferents tipus de textos.',
        'Fer dictats preparats i no preparats per posar en pràctica la normativa ortogràfica treballada.',
        'Llegir de forma expressiva textos de tipologia diversa.',
        'Participar a les converses de l’aula tot respectant el torn de paraula i les intervencions dels companys/es.',
        'Utilitzar el vocabulari adequat a la situació comunicativa plantejada.',
        'Utilitzar el diccionari bilingüe per buscar la traducció del vocabulari sobre fruites i verdures.',
        'Entendre i escriure correctament les paraules relacionades amb les fruites i verdures.',
        'Escriure correctament paraules que porten les lletres G i J.',
        'Conèixer l’ús de l’ortografia H i aplicar-la correctament.',
        'Escriure correctament paraules amb les lletres B, V.',
      ],
      'Anglès': [
        'Entendre enunciats i instruccions de la mestra.',
        'Escoltar les audicions i entendre-les.',
        'Entendre i cantar les cançons de les unitats',
        'Practicar oralment petits diàlegs.',
        'Entendre els enunciats dels exercicis.',
        'Llegir i comprendre les històries de les unitats i respondre preguntes.',
        'Posar en pràctica les estructures i el vocabulari treballat en petits textos.',
        'Conèixer el vocabulari relacionat amb la tecnologia i els adjectius.',
        'Utilitzar els pronoms i els adjectius possessius.',
        'Introduir els infinitius de propòsit (--- to infinitive).',
        'Utilitzar els adjectius comparatius i superlatius (positius i negatius).',
        'Redactar unes instruccions per dibuixar un avatar.',
        'Redactar un anunci.',
        'Treballar vocabulari sobre la festivitat de Halloween.',
      ],
      'Medi': [
        'Participar en la cura de l’hort de l’escola.',
        'Descobrir què és l’energia i en quines formes es presenta.',
        'Distingir entre fonts d’energia renovables i no renovables.',
        'Saber quines fonts d’energia són les més utilitzades.',
        'Conèixer com es produeix l’energia elèctrica.',
        'Comprendre i explicar les diferents problemàtiques mediambientals a l’entorn de l’energia: residus radioactius, vessaments, pluja àcida, etc.',
        'Plantejar mesures per reduir i estalviar energia en el dia a dia a l’escola (estalvi energètic).',
        'Utilitzar diferents recursos de representació de la superfície per tal de comprendre l’entorn on vivim: planisferi, plànol…',
        'Conèixer i situar en un mapa les comunitats autònomes i saber-ne la seva capital.',
        'Conèixer i situar en un mapa les comarques de Catalunya.',
        'Saber localitzar en un mapa diferents topònims amb l’ajuda d’un atles.',
        'Conèixer i identificar les diferents unitats territorials (de gran a petit i de petit a gran).',
        'Entendre i diferenciar els trets principals dels moviments migratoris en el món.',
        'Veure i diferenciar els factors que creen la distribució i la densitat de la població (càlculs demogràfics).',
        'Interpretar diferents tipus de gràfics de població.',
        'Analitzar i interpretar dades demogràfiques per crear una piràmide de població.',
        'Dibuixar i representar gràficament la piràmide de població d’un municipi concret.',
        'Recollir i cercar informació rellevant sobre el municipi escollit utilitzant diferents fonts.',
        'Elaborar un treball escrit i visual relacionat amb la població, l’economia i les característiques socials del municipi.',
        'Preparar i exposar oralment la informació recopilada, connectant-la amb la temàtica de la piràmide de població.',
        'Comparar i reflexionar sobre les diferències i similituds amb altres municipis o regions.',
      ],
      'Matemàtiques': [
        'Resoldre problemes utilitzant diferents operacions amb nombres naturals (suma, resta, multiplicació i divisió).',
        'Resoldre situacions problemàtiques utilitzant dues o més operacions.',
        'Multiplicar i dividir per la unitat seguida de zeros.',
        'Donar la solució d’un problema d’acord amb les preguntes plantejades.',
        'Partint d’una situació real de l’escola (celebració de la “Castanyada”), resoldre una situació sobre les mandarines i les castanyades que es van menjar a partir de la recollida de dades i càlcul.',
        'Conèixer les característiques dels quadrilàters.',
        'Calcular l’àrea i el perímetre dels quadrilàters.',
        'Conèixer que és un angle i identificar-ne les seves parts, així com classificar-los correctament.',
        'Utilitzar el transportador d’angles per mesurar-los.',
        'Calcular la mitjana aritmètica i la mediana a partir d’una situació contextualitzada.',
        'Buscar la relació entre fracció, decimal i percentatge.',
        'Calcular diferents percentatges.',
        'Resoldre problemes d’augments i descomptes.',
        'Comparar fraccions i distingir entre pròpies, impròpies i iguals a la unitat.',
        'Calcular el volum d’un cub i un ortoedre.',
        'Utilitzar correctament les diferents unitats de mesura (capacitat).',
        'Identificar les parts d’un triangle (base, altura, vèrtexs i angles).',
        'Classificar els triangles segons els costats i els angles.',
        'Conèixer i saber buscar estratègies per al càlcul mental.',
        'Interpretar diferents tipus de diagrames (barres, sectors i lineal).',
      ],
      'Cultura Religiosa': [
        'Descobrir i identificar la idea de símbol, a partir de l’ús de la contrasenya.',
        'Distingir les dues parts que té un símbol i les característiques de cadascuna.',
        'Adonar-se de la necessitat d’interpretació del símbol.',
        'Observar que les religions fan servir el llenguatge simbòlic per expressar algunes idees clau.',
        'Conèixer alguns símbols de les religions cristiana, jueva i islàmica.',
        'Conèixer i respectar els espais sagrats de les diferents religions.',
        'Conèixer els noms concrets de diferents espais religiosos cristians: ermita, santuari, església, catedral, temple...',
        'Conèixer el nom genèric dels espais religiosos en l’Islam (mesquita), en el Judaisme (sinagoga) i en el Budisme (pagoda).',
      ],
      'Educació en valors': [
        'Pensar de manera crítica i ètica en situacions de debat i de dilema.',
        'Justificar diferents punts de vista a partir d’arguments i exemples concrets.',
        'Reconèixer les diferències individuals entre les persones (diversitat).',
        'Analitzar fets, accions i actituds que poden comportar relacions abusives i de maltractament entre iguals en l’entorn educatiu.',
        'Considerar l’empatia com una habilitat emocional que permet el benestar mutu.',
        'Conèixer i ser conscients d’alguns obstacles/ problemes que es poden trobar les persones amb dificultats visuals en diferents llocs de les ciutats i el seu dia a dia.',
        'Entendre què és la resiliència a partir del curtmetratge de la ballarina i analitzar aquest concepte en altres aspectes de la nostra vida.',
        'Reflexionar sobre el “Plogging” com una actuació col·lectiva per a la sostenibilitat.',
        'Presentar l’experiència del “Plogging” en els alumnes de Primària tot destacant que la protecció del medi natural és un deure ètic i de compromís col·lectiu.',
        'Considerar aspectes com l’amistat, la perseverança, la solidaritat, la superació i la inclusió a través de la pel·lícula “Leo & Lou ” (cinema espiritual).',
      ],
      'Educació Física': [
        'Prendre consciència dels límits i les possibilitats del mateix cos en la realització d’activitats físiques.',
        'Utilitzar les habilitats apreses per adquirir-ne de noves.',
        'Executar passades i recepcions de forma eficaç.',
        'Botar la pilota correctament, de diferents maneres',
        'Ser conscients de les capacitats condicionals.',
        'Dominar diferents habilitats coordinatives.',
        'Realitzar llançaments amb certa precisió.',
        'Mostrar hàbits saludables en la pràctica d’activitats físiques i en la vida quotidiana.',
        'Fer ús de les actituds i postures que són correctes i sanes.',
        'Participar en el joc col·lectiu de manera activa mostrant-se respectuós amb les normes i els companys.',
        'Respectar als companys, adversaris, les regles i les normes del bàsquet.',
        'Conèixer i identificar les regles bàsiques del mini bàsquet.',
        'Respectar les regles i normes del joc.',
        'Assumir el resultat del joc sigui quin sigui aquest.',
      ],
      'Música': [
        'Escoltar amb atenció, respecte i interès les audicions musicals, reconeixent les obres, els compositors, els intèrprets i els instruments treballats.',
        'Identificar i comprendre alguns elements i característiques de les obres escoltades, relacionant-los amb els diferents estils i gèneres musicals.',
        'Conèixer i cantar de memòria les cançons apreses, tenint cura de l\'afinació, la dicció, la postura corporal i l\'expressivitat.',
        'Participar en interpretacions vocals col·lectives, respectant les entrades, els matisos i el fraseig, i escoltant els companys.',
        'Llegir i interpretar melodies amb la flauta dolça, utilitzant les notes treballades i tenint cura de la digitació, l\'articulació i la qualitat del so.',
        'Interpretar peces amb la flauta dolça, individualment i en grup, seguint la pulsació i coordinant-se amb l\'acompanyament musical.',
        'Participar en danses col·lectives, reconeixent-ne l\'estructura i coordinant els moviments amb la música i amb els companys.',
      ],
      'Tallers': [
        '# Stop Motion',
        'Conèixer la tècnica de l\'Stop motion.',
        'Saber què és un guió i un storyboard tot escrivint-ne un.',
        'Saber treballar en grup.',
        'Conèixer les principals eines d’edició de vídeo i d’stop motion.',
        'Plasmar de manera gràfica una història breu.',
        'Dissenyar i crear els escenaris, personatges i elements necessaris pel curtmetratge.',
        'Editar de manera creativa el curtmetratge creat.',
        'Treballar amb pulcritud i rigorositat.',
        '# Dibuix',
        'Conèixer diferents tècniques de dibuix per mostrar el volum, la perspectiva i les ombres.',
        'Elaborar en una làmina de dibuix on es mostri individualment cadascuna de les tècniques treballades.',
        'Crear un dibuix que amalgami totes les tècniques treballades.',
        'Treballar la pulcritud i la precisió.',
        '# Teatre',
        'Adonar-se de la importància que té el llenguatge corporal en la comunicació.',
        'Desenvolupar les possibilitats expressives del cos.',
        'Aprendre a treballar cooperativament amb el grup a través de composicions col·lectives dins de l\'espai.',
        'Conèixer les diferents característiques de la pròpia veu a partir del joc: entonació, ritme, durada, intensitat, dicció.',
        'Exercitar la memòria.',
        'Expressar sensacions i actituds determinades en un espai i lloc concret.',
        'Saber relacionar i caracteritzar els personatges a partir dels seus moviments i gestos.',
        '# Robòtica',
        'Conèixer els aspectes més importants sobre l’electricitat.',
        'Construir sistemes de reg i manteniment d’un hort particular mitjançant el kit Smart Agriculture.',
        'Reconèixer el funcionament dels circuits elèctrics i la seva simbologia bàsica.',
        'Ampliar els coneixements sobre els components del circuit elèctric (motor, resistència, fusible…).',
        'Utilitzar les Micro:Bit per ampliar els coneixements sobre els circuits elèctrics i fer muntatges mitjançant la placa Arduino.',
        'Entendre la transformació d’energia elèctrica amb so, llum o calor mitjançant l’experimentació amb kits de muntatge de circuits MINILAND.',
        'Desenvolupar i entendre el funcionament d’un diagrama de flux.',
        'Promoure el pensament computacional per ser capaç de resoldre i superar reptes cada vegada més complexos.',
      ],
    },
  },

};

/* Normalitza un nom d'assignatura per poder-lo comparar: sense accents,
   en minúscules i sense signes. «Educació Física» i «educacio fisica» han
   de trobar-se, perquè el document i el perfil no sempre l'escriuen igual. */
function _objNorm(s) {
  return (s || '').toString().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/* Un identificador ESTABLE per a cada objectiu oficial.

   ⚠ VA PER POSICIÓ A POSTA, no pel text. Mentre els objectius siguin
   provisionals, direcció n'anirà corregint la redacció; si l'identificador
   sortís del text, cada coma arreglada esborraria tot el que les mestres
   haguessin marcat. Amb la posició, una correcció de redacció no els toca.
   El preu és que si algú n'AFEGEIX un al mig, les marques de sota ballen una
   casella: per això la pantalla avisa que són provisionals. */
function _objId(curs, trim, assig, i) {
  return 'of_' + _objNorm(curs) + '_' + trim + '_' + _objNorm(assig) + '_' + i;
}

/* Els objectius oficials d'un curs, trimestre i assignatura.
   Torna [] si no n'hi ha: és el cas normal (el 2n i el 3r trimestre encara
   no estan publicats) i no ha de petar mai. */
function objectiusOficials(curs, trim, assig) {
  const blocs = (typeof OBJECTIUS_OFICIALS !== 'undefined') ? OBJECTIUS_OFICIALS : {};
  const bloc = blocs[curs + '|' + trim];
  if (!bloc || !bloc.assigs) return [];

  /* El nom que arriba pot venir del perfil («Educació Física»), del menú
     («educaciofisica») o d'una etiqueta amb grup («Música · 3r A»): es
     compara normalitzat i només la primera part. */
  const buscat = _objNorm((assig || '').toString().split('·')[0]);
  let clau = null;
  Object.keys(bloc.assigs).forEach(k => { if (_objNorm(k) === buscat) clau = k; });
  if (!clau) return [];

  /* Provisional? De sèrie sí; no, si aquesta assignatura és a `definitius`
     (al document és en negre, direcció ja l'ha repassada). */
  const definitius = (bloc.definitius || []).map(_objNorm);
  const provisional = !!bloc.provisional && definitius.indexOf(_objNorm(clau)) === -1;

  const sortida = [];
  let blocActual = '';
  let n = 0;
  (bloc.assigs[clau] || []).forEach(linia => {
    const t = (linia || '').toString().trim();
    if (!t) return;
    if (t.indexOf('# ') === 0) { blocActual = t.substring(2).trim(); return; }
    sortida.push({
      id: _objId(curs, trim, clau, n),
      text: t,
      bloc: blocActual,
      oficial: true,
      provisional: provisional,
    });
    n++;
  });
  return sortida;
}

/* Direcció ha canviat de dalt a baix els objectius d'aquesta assignatura?
   Torna { data, que } o null. Veure el comentari de `canvis` aquí sobre. */
function objectiusCanvi(curs, trim, assig) {
  const blocs = (typeof OBJECTIUS_OFICIALS !== 'undefined') ? OBJECTIUS_OFICIALS : {};
  const bloc = blocs[curs + '|' + trim];
  if (!bloc || !bloc.canvis) return null;
  const buscat = _objNorm((assig || '').toString().split('·')[0]);
  let trobat = null;
  Object.keys(bloc.canvis).forEach(k => { if (_objNorm(k) === buscat) trobat = bloc.canvis[k]; });
  return trobat || null;
}

/* Hi ha objectius oficials per a aquest curs i trimestre? (per saber si val
   la pena dir-ho a la pantalla) */
function objectiusOficialsHiHa(curs, trim) {
  const blocs = (typeof OBJECTIUS_OFICIALS !== 'undefined') ? OBJECTIUS_OFICIALS : {};
  const bloc = blocs[curs + '|' + trim];
  return !!(bloc && bloc.assigs && Object.keys(bloc.assigs).length);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    OBJECTIUS_CURS_ESCOLAR, OBJECTIUS_OFICIALS,
    objectiusOficials, objectiusOficialsHiHa, objectiusCanvi, _objNorm, _objId,
  };
}
