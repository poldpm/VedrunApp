/* ============================================================
   VEDRUNU — Assistent IA de l'aula
   Xatbot integrat que respon dubtes sobre l'app i la gestió
   d'aula, consulta dades d'alumnes i pot proposar accions
   (crear tasques, events) que l'usuari confirma.
   ============================================================ */

let _vedrunuHistory = [];   // historial de la conversa (per context)
let _vedrunuBusy    = false;
let _vedrunuPendingAction = null; // acció pendent de confirmació

function toggleVedrunu() {
  const panel = document.getElementById('vedrunuPanel');
  const open = panel.classList.toggle('open');
  if (open) {
    if (!_vedrunuHistory.length) _vedrunuWelcome();
    setTimeout(() => document.getElementById('vedrunuInput').focus(), 100);
  }
}

function _vedrunuAutosize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

function _vedrunuWelcome() {
  const cont = document.getElementById('vedrunuMessages');
  cont.innerHTML = `
    <div class="vedrunu-msg vedrunu-msg-bot">
      <p>Hola! Sóc en <strong>Vedrunu</strong>, el teu assistent d'aula. 👋</p>
      <p>Puc ajudar-te amb dubtes sobre l'app, donar-te informació dels alumnes, resumir notes, revisar tasques pendents o afegir coses noves. Prova de preguntar-me:</p>
      <div class="vedrunu-suggestions">
        <button class="vedrunu-sugg" onclick="_vedrunuQuick('Quantes tasques pendents tinc?')">Quantes tasques tinc?</button>
        <button class="vedrunu-sugg" onclick="_vedrunuQuick('Com funciona el generador de comentaris?')">Com va el generador?</button>
        <button class="vedrunu-sugg" onclick="_vedrunuQuick('Quants alumnes tinc a classe?')">Quants alumnes tinc?</button>
      </div>
    </div>`;
}

function _vedrunuQuick(text) {
  document.getElementById('vedrunuInput').value = text;
  vedrunuSend();
}

function _vedrunuAddMsg(role, html) {
  const cont = document.getElementById('vedrunuMessages');
  const div = document.createElement('div');
  div.className = 'vedrunu-msg ' + (role === 'user' ? 'vedrunu-msg-user' : 'vedrunu-msg-bot');
  div.innerHTML = html;
  cont.appendChild(div);
  cont.scrollTop = cont.scrollHeight;
  return div;
}

function _vedrunuTyping(show) {
  const cont = document.getElementById('vedrunuMessages');
  let t = document.getElementById('vedrunuTyping');
  if (show && !t) {
    t = document.createElement('div');
    t.id = 'vedrunuTyping';
    t.className = 'vedrunu-typing';
    t.innerHTML = '<span></span><span></span><span></span>';
    cont.appendChild(t);
    cont.scrollTop = cont.scrollHeight;
  } else if (!show && t) {
    t.remove();
  }
}

// Converteix markdown lleuger a HTML (negretes, llistes, salts)
function _vedrunuFormat(text) {
  let html = escapeHtml(text);
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Llistes amb - o •
  const lines = html.split('\n');
  let out = '', inList = false;
  lines.forEach(line => {
    const t = line.trim();
    if (/^[-•]\s/.test(t)) {
      if (!inList) { out += '<ul>'; inList = true; }
      out += '<li>' + t.replace(/^[-•]\s/, '') + '</li>';
    } else {
      if (inList) { out += '</ul>'; inList = false; }
      if (t) out += '<p>' + line + '</p>';
    }
  });
  if (inList) out += '</ul>';
  return out || '<p>' + html + '</p>';
}

async function vedrunuSend() {
  if (_vedrunuBusy) return;
  const input = document.getElementById('vedrunuInput');
  const text = input.value.trim();
  if (!text) return;

  if (!config.geminiKey) {
    _vedrunuAddMsg('bot', '<p>Per parlar amb mi necessites configurar la clau de Gemini a <strong>Configuració</strong>. És gratuïta!</p>');
    return;
  }

  _vedrunuAddMsg('user', escapeHtml(text));
  input.value = ''; _vedrunuAutosize(input);
  _vedrunuBusy = true;
  document.getElementById('vedrunuSend').disabled = true;
  _vedrunuTyping(true);

  try {
    await _vedrunuProcess(text);
  } catch (e) {
    _vedrunuTyping(false);
    _vedrunuAddMsg('bot', '<p>Ui, alguna cosa ha fallat: ' + escapeHtml(e.message) + '</p>');
  }
  _vedrunuTyping(false);
  _vedrunuBusy = false;
  document.getElementById('vedrunuSend').disabled = false;
}

// Construeix el context de dades actual per donar-lo a Gemini
function _vedrunuBuildContext() {
  const ctx = {};

  // Alumnes amb dades resumides
  ctx.alumnes = students.map(s => {
    const pd = personal[s.id] || {};
    return {
      nom: s.nom,
      genere: s.genere,
      mare: pd.mare || null, pare: pd.pare || null,
      emailMare: pd.emailMare || null, emailPare: pd.emailPare || null,
      medic: pd.obs || null,
      pi: pd.pi ? pd.pi.replace(/\|/g, ', ') : null,
      am: pd.am ? pd.am.replace(/\|/g, ', ') : null,
      especific: pd.especific || null,
    };
  });

  // Resum de notes (si el tenim cachejat)
  if (typeof _notesResumCache !== 'undefined' && _notesResumCache) {
    ctx.notes = {};
    const MATS = { matematiques:'Matemàtiques', catala:'Català', medi:'Medi', musica:'Música', angles:'Anglès' };
    Object.entries(MATS).forEach(([key, nom]) => {
      const perTrim = _notesResumCache[key];
      if (!perTrim) return;
      ctx.notes[nom] = {};
      [1,2,3].forEach(t => {
        if (perTrim[t] && perTrim[t].notes) {
          ctx.notes[nom]['T'+t] = {};
          students.forEach(s => {
            const n = perTrim[t].notes[s.id];
            if (n !== null && n !== undefined) ctx.notes[nom]['T'+t][s.nom] = n;
          });
        }
      });
    });
  }

  // Tasques pendents (pròpies + Google Tasks)
  const propies = tqLoad().filter(t => !t.feta);
  const gtasks  = (typeof _gtaskVirtuals !== 'undefined' ? _gtaskVirtuals : []).filter(t => !t.feta);
  ctx.tasquesPendents = [
    ...propies.map(t => ({ titol: t.titol, data: t.data || null, origen: 'app' })),
    ...gtasks.map(t => ({ titol: t.titol, data: t.data || null, origen: 'Google Tasks' })),
  ];

  // Events propers (7 dies)
  const avui = new Date();
  const avuiStr = avui.toISOString().split('T')[0];
  const prox7 = new Date(avui); prox7.setDate(avui.getDate() + 7);
  const prox7Str = prox7.toISOString().split('T')[0];
  let allEv = (typeof cal2LoadEvents === 'function' ? cal2LoadEvents(avui.getFullYear()) : []).slice();
  if (typeof _cal2GCalCache !== 'undefined') Object.values(_cal2GCalCache).forEach(a => allEv = allEv.concat(a || []));
  ctx.eventsPropers = allEv.filter(e => e.data >= avuiStr && e.data <= prox7Str)
    .map(e => ({ titol: e.titol, data: e.data, hora: e.hora || null }));

  return ctx;
}

// El manual/coneixement de l'app perquè Vedrunu sàpiga com funciona
const _VEDRUNU_MANUAL = `
FUNCIONAMENT DE L'APP (per respondre dubtes):
- Inici: tauler amb accés ràpid, tasques i events d'avui, vista de la setmana, enllaços a Gmail/Drive/ClickEdu/Coordinació/ClassDojo.
- Planning setmanal: graella de 5 dies x 8 franges. Clica una cel·la per posar assignatura, alerta, o marcar festa/activitat especial/sortida (amb durada: només aquesta franja, tot el dia o personalitzat). Els events del calendari surten sols a la franja de la seva hora.
- Calendari mensual: events propis + Google Calendar. Crear amb "Nou event" (títol, data, hora, categoria). Els events amb hora surten al planning.
- Tasques: tasques pròpies + Google Tasks integrades. Bombolla vermella a l'inici amb les pendents.
- Alumnes: targetes. Dades de família, observacions mèdiques (creu +), PI i AM (amb assignatures), i aspectes conductuals/necessitats. Badges PI (blau) i AM (taronja) a la targeta.
- Fitxa alumne: avisos, dades, observacions per trimestre, notes finals i assoliments.
- Observacions: graella per apuntar observacions per assignatura i trimestre.
- Notes d'assignatures: graella per trimestre. Afegir ítems (nom, punts, pes). Calcula nota sobre 10, mitjana i nota final. NE = No Entregat (compta 0). Actitud: 5 aspectes 1-10. Carpeta Viatgera.
- Assoliments: objectius amb valors ✓/~/✗/—. Percentatge per alumne. Es sincronitza sol al full de càlcul.
- Registres d'aula: graella flexible (checkbox o text) per registrar coses del dia a dia.
- Generador de grups: forma grups automàtics amb condicions d'incompatibilitat.
- Generador de comentaris: marca nivells de rúbrica i genera el comentari d'informe (amb Gemini o esborrany).
- Notificacions: avís diari a les 7:00 amb tasques, alertes i events del dia (Chrome).
- Sincronització: cache-first, tot es guarda al Google Sheets, funciona offline, s'actualitza sol en segon pla.
`;

async function _vedrunuProcess(userText) {
  const context = _vedrunuBuildContext();

  const systemPrompt = `Ets en "Vedrunu", l'assistent d'aula integrat en una app de gestió escolar d'un mestre de 2n de Primària a Catalunya. Ets amable, proper i eficient, com un bon secretari. Respons SEMPRE en català.

Tens accés a les dades actuals de l'aula (alumnes, notes, tasques, events) i al coneixement del funcionament de l'app. Usa aquestes dades per respondre amb precisió.

${_VEDRUNU_MANUAL}

DADES ACTUALS DE L'AULA (en JSON):
${JSON.stringify(context, null, 1)}

REGLES:
- Si et pregunten per un alumne, dades, notes o anàlisi, respon a partir de les DADES ACTUALS. Si no hi ha la dada, digues que no la tens registrada.
- Pots fer anàlisis de notes (mitjanes, comparatives, evolució per trimestres, qui necessita reforç, etc.).
- Si et demanen CREAR una tasca o un event, NO diguis que ho has fet. En lloc d'això, respon NOMÉS amb un bloc JSON amb aquest format exacte (sense text abans ni després):
{"accio":"crear_tasca","titol":"...","data":"YYYY-MM-DD o null"}
o
{"accio":"crear_event","titol":"...","data":"YYYY-MM-DD","hora":"HH:MM o null"}
- Per a qualsevol altra cosa (dubtes, consultes, anàlisis), respon amb text normal en català, clar i breu. Pots usar **negretes** i llistes amb -.
- Data d'avui: ${new Date().toISOString().split('T')[0]}.`;

  // Afegeix el missatge a l'historial
  _vedrunuHistory.push({ role: 'user', parts: [{ text: userText }] });

  // Munta els continguts amb el system prompt com a primer torn
  const contents = [
    { role: 'user', parts: [{ text: systemPrompt }] },
    { role: 'model', parts: [{ text: "Entesos. Sóc en Vedrunu i tinc les dades de l'aula. En què t'ajudo?" }] },
    ..._vedrunuHistory.slice(-10), // últimes 10 interaccions
  ];

  const responseText = await _vedrunuCallGemini(contents);
  _vedrunuTyping(false);

  // Comprova si la resposta és una acció (JSON)
  const action = _vedrunuParseAction(responseText);
  if (action) {
    _vedrunuHistory.push({ role: 'model', parts: [{ text: responseText }] });
    _vedrunuShowActionCard(action);
  } else {
    _vedrunuHistory.push({ role: 'model', parts: [{ text: responseText }] });
    _vedrunuAddMsg('bot', _vedrunuFormat(responseText));
  }
}

function _vedrunuParseAction(text) {
  // Busca un bloc JSON amb "accio"
  const m = text.match(/\{[\s\S]*"accio"[\s\S]*\}/);
  if (!m) return null;
  try {
    const obj = JSON.parse(m[0]);
    if (obj.accio === 'crear_tasca' || obj.accio === 'crear_event') return obj;
  } catch(e) {}
  return null;
}

function _vedrunuShowActionCard(action) {
  const cont = document.getElementById('vedrunuMessages');
  const div = document.createElement('div');
  div.className = 'vedrunu-action-card';

  if (action.accio === 'crear_tasca') {
    div.innerHTML = `
      <div class="vedrunu-action-title">📋 Nova tasca</div>
      <div class="vedrunu-action-detail"><strong>${escapeHtml(action.titol)}</strong></div>
      ${action.data && action.data !== 'null' ? `<div class="vedrunu-action-detail">Data: ${escapeHtml(action.data)}</div>` : ''}
      <div class="vedrunu-action-btns">
        <button class="vedrunu-btn-cancel" onclick="_vedrunuCancelAction(this)">Cancel·lar</button>
        <button class="vedrunu-btn-confirm" onclick="_vedrunuConfirmAction(this)">Crear tasca</button>
      </div>`;
  } else {
    div.innerHTML = `
      <div class="vedrunu-action-title">🗓 Nou event</div>
      <div class="vedrunu-action-detail"><strong>${escapeHtml(action.titol)}</strong></div>
      <div class="vedrunu-action-detail">Data: ${escapeHtml(action.data)}${action.hora && action.hora !== 'null' ? ' · ' + escapeHtml(action.hora) : ''}</div>
      <div class="vedrunu-action-btns">
        <button class="vedrunu-btn-cancel" onclick="_vedrunuCancelAction(this)">Cancel·lar</button>
        <button class="vedrunu-btn-confirm" onclick="_vedrunuConfirmAction(this)">Crear event</button>
      </div>`;
  }
  div._action = action;
  cont.appendChild(div);
  cont.scrollTop = cont.scrollHeight;
}

function _vedrunuConfirmAction(btn) {
  const card = btn.closest('.vedrunu-action-card');
  const action = card._action;
  try {
    if (action.accio === 'crear_tasca') {
      const items = tqLoad();
      items.unshift({
        id: Date.now().toString(),
        titol: action.titol,
        desc: '',
        cat: 'general',
        data: (action.data && action.data !== 'null') ? action.data : '',
        feta: false,
        ts: Date.now(),
      });
      tqSave(items);
      if (typeof _renderTqList === 'function' && !document.getElementById('page-tasques').classList.contains('page-hidden')) _renderTqList();
      if (typeof updateTasquesBadge === 'function') updateTasquesBadge();
      card.innerHTML = '<div class="vedrunu-action-title">✅ Tasca creada</div><div class="vedrunu-action-detail">' + escapeHtml(action.titol) + '</div>';
    } else if (action.accio === 'crear_event') {
      const year = parseInt(action.data.split('-')[0]);
      const evs = cal2LoadEvents(year);
      evs.push({
        id: Date.now().toString(),
        titol: action.titol,
        data: action.data,
        hora: (action.hora && action.hora !== 'null') ? action.hora : '',
        catId: '', desc: '', link: '',
      });
      cal2SaveEvents(year, evs);
      if (typeof renderCalendari === 'function') renderCalendari();
      if (typeof renderPlanning === 'function') renderPlanning();
      card.innerHTML = '<div class="vedrunu-action-title">✅ Event creat</div><div class="vedrunu-action-detail">' + escapeHtml(action.titol) + ' · ' + escapeHtml(action.data) + '</div>';
    }
    if (typeof showToast === 'function') showToast('Fet per Vedrunu ✓', 'success');
  } catch(e) {
    card.innerHTML = '<div class="vedrunu-action-title">⚠ Error</div><div class="vedrunu-action-detail">No s\'ha pogut completar: ' + escapeHtml(e.message) + '</div>';
  }
}

function _vedrunuCancelAction(btn) {
  const card = btn.closest('.vedrunu-action-card');
  card.innerHTML = '<div class="vedrunu-action-detail">D\'acord, no ho he fet.</div>';
}

async function _vedrunuCallGemini(contents) {
  const call = async () => {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${config.geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents }),
      }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data?.error?.message || ('HTTP ' + res.status));
      err.is429 = res.status === 429;
      throw err;
    }
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) throw new Error('Resposta buida');
    return text;
  };
  try {
    return await call();
  } catch(e) {
    if (e.is429) {
      await new Promise(r => setTimeout(r, 3000));
      return await call();
    }
    throw e;
  }
}
