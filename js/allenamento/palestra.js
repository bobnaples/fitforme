/* MODALITÀ PALESTRA — un esercizio alla volta, a tutto schermo.

   Tre cose la governano:
   1. ogni tocco su «Fatto» scrive la seduta su IndexedDB, quindi se il telefono
      muore a metà serie 3 la ritrovi a metà serie 3;
   2. il recupero è un istante assoluto salvato nel documento, non un contatore
      in memoria: se metti via il telefono e lo riprendi, il conto è giusto;
   3. non serve rete: qui dentro non c'è una sola richiesta. */

import { def, nomeProtocollo, descrizione, regolaTesto, precompila, progressione,
         calcolaDrop, caricoPrincipale, volume, completa, gradino, passi,
         nomePasso, chiaveTenuta } from './protocolli.js';
import { passo } from '../componenti.js';
import { el, $$, svuota, nkg, mmss, oggiISO, quando, dataBreve } from '../ui.js';
import { vociScheda, programmaAttivo, salvaProgramma, salvaSeduta, leggiSeduta,
         sedutaAperta, ultimaVolta, ultimaCompletata, catalogo, prefs,
         salvaPrefs } from '../store.js';

const SCHEDE = ['A', 'B', 'C'];

let radice = null;        // l'elemento a tutto schermo
let seduta = null;        // il documento in corso
let voci = [];            // le voci della scheda, con l'esercizio unito
let cat = null, preferenze = null;
let wakeLock = null, battito = null, audio = null, crono = null;
let alChiudi = null;

/* ====================== ingresso e uscita ====================== */

/* `scheda` salta la schermata di scelta e comincia subito quella seduta:
   la usa il pulsante «In palestra» della schermata Oggi. Una seduta lasciata
   a metà ha comunque la precedenza — non si perde per una scorciatoia. */
export async function apri({ onChiudi = null, scheda = null } = {}) {
  alChiudi = onChiudi;
  cat = await catalogo();
  preferenze = await prefs();

  radice = el('div.palestra', { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Modalità palestra' });
  document.body.append(radice);
  document.body.classList.add('in-palestra');
  document.addEventListener('visibilitychange', alRitorno);

  const aperta = await sedutaAperta();
  if (scheda && !aperta) return inizia(scheda);
  await schermataScelta(aperta);
}

export async function chiudi() {
  fermaBattito();
  fermaCrono();
  await rilasciaWakeLock();
  document.removeEventListener('visibilitychange', alRitorno);
  document.body.classList.remove('in-palestra');
  radice?.remove();
  radice = null; seduta = null; voci = [];
  alChiudi?.();
}

/* Al rientro nell'app il wake lock è stato rilasciato dal sistema: va richiesto
   di nuovo, altrimenti lo schermo si spegne dopo il primo cambio di finestra. */
async function alRitorno() {
  if (document.visibilityState !== 'visible' || !radice) return;
  if (seduta) await chiediWakeLock();
  if (seduta?.posizione?.fase === 'recupero') disegna();
}

/* ====================== schermo acceso, vibrazione, suono ====================== */

async function chiediWakeLock() {
  if (!preferenze.wakeLock || !('wakeLock' in navigator)) return;
  if (wakeLock && !wakeLock.released) return;
  try { wakeLock = await navigator.wakeLock.request('screen'); }
  catch { /* batteria bassa o permesso negato: si continua senza */ }
}
async function rilasciaWakeLock() {
  try { await wakeLock?.release(); } catch {}
  wakeLock = null;
}

/* La vibrazione da sola non basta: su Android parte solo a pagina visibile.
   Per questo c'è anche un suono, sbloccato dal primo tocco su «Fatto». */
function avvisa() {
  if (preferenze.vibrazione) { try { navigator.vibrate?.([400, 150, 400, 150, 600]); } catch {} }
  if (!preferenze.suono) return;
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    audio.resume?.();
    [0, 0.28, 0.56].forEach(ritardo => {
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = 'sine'; o.frequency.value = 880;
      const t = audio.currentTime + ritardo;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      o.connect(g); g.connect(audio.destination); o.start(t); o.stop(t + 0.24);
    });
  } catch {}
}
const sbloccaAudio = () => {
  if (!preferenze.suono || audio) return;
  try { audio = new (window.AudioContext || window.webkitAudioContext)(); audio.resume?.(); } catch {}
};
const tocco = () => { if (preferenze.vibrazione) { try { navigator.vibrate?.(30); } catch {} } };

/* ====================== schermata iniziale ====================== */

async function schermataScelta(aperta) {
  const ultima = await ultimaCompletata();
  const prog = await programmaAttivo();

  svuota(radice);
  radice.append(
    barraAlta('In palestra', chiudi),
    el('div.pal-corpo', {},
      aperta
        ? el('div.ripresa', {},
            el('p.rip-tit', { testo: 'Hai una seduta lasciata a metà' }),
            el('p.rip-det', { testo: `Seduta ${aperta.scheda} del ${dataBreve(aperta.data)} — esercizio ${(aperta.posizione?.esercizio ?? 0) + 1} di ${aperta.esercizi.length}` }),
            el('button.pal-cta', { type: 'button', testo: 'Riprendi da lì',
                                   onclick: () => riprendi(aperta.id) }),
            el('button.pal-ghost', { type: 'button', testo: 'Lasciala stare e comincia una seduta nuova',
                                     onclick: () => { radice.querySelector('.ripresa').remove(); } }))
        : null,
      el('p.pal-domanda', { testo: 'Quale seduta fai oggi?' }),
      el('div.pal-schede', {},
        ...SCHEDE.map(s => {
          const n = prog ? prog.voci.filter(v => v.scheda === s).length : 0;
          return el('button.pal-scheda', { type: 'button', disabled: !n, onclick: () => inizia(s) },
            el('b', { testo: s }),
            el('small', { testo: n ? `${n} esercizi` : 'vuota' }));
        })),
      ultima
        ? el('p.pal-nota', { testo: `L'ultima è stata la ${ultima.scheda}, ${quando(ultima.data)}.` })
        : el('p.pal-nota', { testo: 'Nessuna seduta registrata finora.' })));
}

async function riprendi(id) {
  seduta = await leggiSeduta(id);
  voci = await vociScheda(seduta.scheda);
  await chiediWakeLock();
  sbloccaAudio();
  disegna();
  avviaCrono();
}

async function inizia(scheda) {
  tocco();
  voci = await vociScheda(scheda);
  const prog = await programmaAttivo();
  seduta = {
    id: `sd_${Date.now().toString(36)}`,
    data: oggiISO(), scheda, programmaId: prog?.id || null,
    iniziataAlle: Date.now(), finitaAlle: null,
    stato: 'in_corso',
    posizione: { esercizio: 0, serie: 0, fase: 'lavoro' },
    timerFineAt: null,
    esercizi: [], note: '',
  };
  for (const v of voci) {
    const u = await ultimaVolta(v.esId, v.protocollo);
    const riga = precompila(v, u, v.esercizio, preferenze);
    riga.ultimaVolta = u ? { data: u.data, riassunto: riassuntoBreve(u) } : null;
    seduta.esercizi.push(riga);
  }
  await salvaSeduta(seduta);
  await chiediWakeLock();
  sbloccaAudio();
  disegna();
  avviaCrono();
}

/* ====================== il ciclo principale ====================== */

const vocePos = () => seduta.esercizi[seduta.posizione.esercizio];
const voceScheda = () => voci[seduta.posizione.esercizio] || {};

function disegna() {
  const p = seduta.posizione;
  let esito;
  if (p.fase === 'fine') esito = schermataFine();
  else if (p.fase === 'esito') esito = schermataEsito();
  else if (p.fase === 'recupero') esito = schermataRecupero();
  else esito = schermataLavoro();
  aggiornaCrono();
  return esito;
}

async function salva() {
  await salvaSeduta(seduta);
}

/* ---------- schermata di lavoro ---------- */

function schermataLavoro() {
  fermaBattito();
  const v = vocePos();
  const p = seduta.posizione;
  const es = cat.get(v.esId) || { nome: v.nome, incremento: 2.5 };
  const g = gradino(es);
  const c = def(v);

  svuota(radice);
  const corpo = el('div.pal-corpo.pal-lavoro');

  corpo.append(
    el('h2.pal-nome', { testo: v.nome }),
    el('p.pal-proto', { testo: nomeProtocollo(c) }),
    pallini(v, p),
    v.ultimaVolta
      ? el('p.pal-ultima', { testo: `Ultima volta (${quando(v.ultimaVolta.data)}): ${v.ultimaVolta.riassunto}` })
      : el('p.pal-ultima', { testo: 'Prima volta: imposta il carico di partenza.' }));

  corpo.append(...(c.forma === 'iso' ? lavoroIso(v, p, es, g, c) : lavoroSerie(v, p, es, g, c)));

  radice.append(
    barraAlta(`${seduta.scheda} · esercizio ${p.esercizio + 1} di ${seduta.esercizi.length}`, chiudi),
    corpo,
    piede(etichettaFatto(v, p), () => avanti(), dopoQuesta(v, p)));
}

/* Riga sotto il pulsante: dice cosa succede appena tocchi «Fatto», così
   sai se stai per fermarti o se viene subito il drop. */
function dopoQuesta(v, p) {
  const c = def(v);
  if (c.drop && p.fase === 'lavoro') return 'poi il drop, senza pausa';
  if (p.serie >= passi(v) - 1) {
    const pausa = preferenze.recuperoEsercizi ?? 120;
    return p.esercizio >= seduta.esercizi.length - 1
      ? 'ultimo esercizio della seduta'
      : `poi cambio esercizio · ${mmss(pausa)}`;
  }
  const rec = voceScheda().recupero || c.recupero || 120;
  return `poi recupero ${mmss(rec)}`;
}

function etichettaFatto(v, p) {
  const c = def(v);
  if (c.drop) return p.fase === 'drop' ? 'Drop fatto' : 'Fatto';
  if (c.forma === 'iso') return `Giro ${p.serie + 1} fatto`;
  return 'Fatto';
}

/* Forma «serie»: vale per il 5x5 con drop, per il 3x12 e per qualunque
   N×R configurato dall'editor. Le differenze sono tre parametri. */
function lavoroSerie(v, p, es, g, c) {
  const drop = p.fase === 'drop';
  const serie = v.serie[p.serie];
  const fuori = [];

  fuori.push(el('p.pal-fase', {
    testo: drop ? `DROP · ${nkg(v.drop)} kg` : `SERIE ${p.serie + 1} di ${c.serie}`,
  }));

  if (!drop) {
    // il carico è unico per l'esercizio, oppure si segna serie per serie
    const valore = c.caricoUnico ? v.carico : serie.carico;
    fuori.push(campoGrande('Carico', passo({
      valore, step: g, grande: true, unita: 'kg', etichetta: 'carico',
      onCambio: n => {
        if (c.caricoUnico) {
          v.carico = n;
          if (c.drop) v.drop = calcolaDrop(n, es, preferenze.arrotondaDrop, c.drop);
          salva(); disegna();
        } else { serie.carico = n; salva(); }
      },
    })));
  }

  fuori.push(campoGrande('Ripetizioni', passo({
    valore: drop ? serie.dropRip : serie.rip, step: 1, max: 60, decimali: 0, grande: true,
    etichetta: 'ripetizioni',
    onCambio: n => { drop ? (serie.dropRip = n) : (serie.rip = n); salva(); },
  })));

  if (drop) fuori.push(el('p.pal-nota', { testo: 'Il drop si porta a cedimento: segna quante ne sono uscite.' }));
  return fuori;
}

function lavoroIso(v, p, es, g, c) {
  const giro = v.giri[p.serie];
  const righe = el('div.iso-palestra');

  c.tenute.forEach((sec, k) => {
    const chiave = chiaveTenuta(c, k);
    const alMassimo = chiave === 'max';
    const rip = passo({
      valore: giro[chiave], step: 1, max: 60, decimali: 0, stretto: true,
      etichetta: `${sec}″ ripetizioni`,
      onCambio: n => { giro[chiave] = n; salva(); },
    });
    const tieni = el('button.tieni', { type: 'button', testo: '▶ tieni',
                                       'aria-label': `Avvia la tenuta di ${sec} secondi`,
                                       onclick: e => contaTenuta(e.currentTarget, sec) });
    righe.append(el('div.iso-riga', {},
      el('span.iso-t', { testo: sec + '″' }), tieni, rip,
      alMassimo ? el('span.iso-nota', { testo: 'max' }) : null));
  });

  return [
    el('p.pal-fase', { testo: `GIRO ${p.serie + 1} di ${c.giri}` }),
    campoGrande('Carico', passo({
      valore: giro.carico, step: g, grande: true, unita: 'kg', etichetta: `carico giro ${p.serie + 1}`,
      onCambio: n => { giro.carico = n; salva(); },
    })),
    righe,
  ];
}

/* Conto alla rovescia della tenuta isometrica, dentro al pulsante stesso.
   Dura pochi secondi e non vale la pena salvarlo: se esci, ricominci la tenuta. */
function contaTenuta(bottone, secondi) {
  if (bottone.dataset.attivo) return;
  sbloccaAudio(); tocco();
  bottone.dataset.attivo = '1';
  const fineAt = Date.now() + secondi * 1000;
  const tic = () => {
    const rimane = Math.ceil((fineAt - Date.now()) / 1000);
    if (rimane <= 0) {
      clearInterval(id);
      delete bottone.dataset.attivo;
      bottone.textContent = '▶ tieni';
      bottone.classList.remove('in-corso');
      avvisa();
      return;
    }
    bottone.textContent = `${rimane}″`;
    bottone.classList.add('in-corso');
  };
  tic();
  const id = setInterval(tic, 200);
}

/* ---------- avanzamento ---------- */

async function avanti() {
  sbloccaAudio(); tocco();
  const v = vocePos();
  const p = seduta.posizione;

  // col drop, dopo la serie viene subito lo scarico, senza recupero in mezzo
  if (def(v).drop && p.fase === 'lavoro') {
    p.fase = 'drop';
    await salva();
    return disegna();
  }

  if (p.serie >= passi(v) - 1) {
    p.fase = 'esito';
    await salva();
    return disegna();
  }

  p.serie += 1;
  p.fase = 'lavoro';
  avviaRecupero(voceScheda().recupero || def(v).recupero || 120);
}

/* ---------- recupero ---------- */

function avviaRecupero(secondi, tipo = 'serie') {
  seduta.timerFineAt = Date.now() + secondi * 1000;
  seduta.timerDurata = secondi;
  seduta.posizione.fase = 'recupero';
  seduta.posizione.recuperoDi = tipo;
  salva();
  disegna();
}

/* Testo di «cosa viene dopo»: cambia se stai recuperando fra due serie
   dello stesso esercizio o fra due esercizi diversi. */
function cosaViene() {
  const v = vocePos();
  const p = seduta.posizione;
  const passoTxt = `${nomePasso(v)} ${p.serie + 1} di ${passi(v)}`;
  return p.recuperoDi === 'esercizio' ? `poi: ${v.nome} · ${passoTxt}` : `poi: ${passoTxt}`;
}

function schermataRecupero() {
  const v = vocePos();
  const p = seduta.posizione;
  const traEsercizi = p.recuperoDi === 'esercizio';
  const cifre = el('p.timer-cifre');
  const sotto = el('p.timer-poi', { testo: cosaViene() });

  svuota(radice);
  radice.append(
    barraAlta(`${seduta.scheda} · ${v.nome}`, chiudi),
    el('div.pal-corpo.pal-timer', {},
      el('p.timer-lab', { testo: traEsercizi ? 'CAMBIO ESERCIZIO' : 'RECUPERO' }),
      cifre, sotto,
      el('div.timer-azioni', {},
        el('button.pal-ghost', { type: 'button', testo: '+30″', onclick: () => {
          seduta.timerFineAt += 30000; salva(); tocco();
        } }),
        el('button.pal-ghost', { type: 'button', testo: '−30″', onclick: () => {
          seduta.timerFineAt = Math.max(Date.now(), seduta.timerFineAt - 30000); salva(); tocco();
        } })),
      el('button.pal-ricorda', {
        type: 'button',
        testo: traEsercizi ? 'Usa sempre questo tempo fra gli esercizi' : `Usa sempre questo tempo per ${v.nome}`,
        onclick: e => memorizzaRecupero(e.currentTarget, traEsercizi),
      })),
    // «Sono pronto» chiude il recupero anche prima dello scadere: non serve
    // un secondo pulsante che fa la stessa cosa
    piede('Sono pronto', finisciRecupero));

  const tic = () => {
    const rimane = (seduta.timerFineAt - Date.now()) / 1000;
    cifre.textContent = mmss(rimane);
    cifre.classList.toggle('scaduto', rimane <= 0);
    if (rimane <= 0) {
      fermaBattito();
      avvisa();
      cifre.textContent = 'Vai';
      sotto.textContent = cosaViene().replace('poi: ', '');
    }
  };
  tic();
  fermaBattito();
  // il conto si ricostruisce dall'istante salvato, quindi non perde colpi
  // se l'app va in secondo piano
  battito = setInterval(tic, 250);
}

/* «Usa sempre questo tempo»: prende quanto manca più quanto è già passato,
   cioè la durata che hai davvero scelto con i +30 e i −30, e la salva —
   sull'esercizio se è un recupero fra serie, nelle preferenze se è il
   cambio esercizio. */
async function memorizzaRecupero(bottone, traEsercizi) {
  tocco();
  const durata = Math.max(15, Math.round((seduta.timerFineAt - Date.now()) / 1000 / 15) * 15);
  if (traEsercizi) {
    preferenze = await salvaPrefs({ recuperoEsercizi: durata });
  } else {
    const prog = await programmaAttivo();
    const v = vocePos();
    const voce = prog?.voci.find(x => x.esId === v.esId && x.scheda === seduta.scheda);
    if (voce) { voce.recupero = durata; await salvaProgramma(prog); voceScheda().recupero = durata; }
  }
  bottone.textContent = `Salvato: ${mmss(durata)}`;
  bottone.disabled = true;
}

function finisciRecupero() {
  tocco();
  fermaBattito();
  seduta.timerFineAt = null;
  seduta.posizione.fase = 'lavoro';
  delete seduta.posizione.recuperoDi;
  salva();
  disegna();
}

const fermaBattito = () => { if (battito) { clearInterval(battito); battito = null; } };

/* ---------- esito dell'esercizio ---------- */

async function schermataEsito() {
  fermaBattito();
  const v = vocePos();
  const es = cat.get(v.esId) || { nome: v.nome, incremento: 2.5 };
  const precedente = v.ultimaVolta ? caricoPrincipale(await ultimaVolta(v.esId, v.protocollo)) : null;
  const p = progressione(v, es, precedente);
  v.esito = p;
  await salva();

  const ultimo = seduta.posizione.esercizio >= seduta.esercizi.length - 1;

  svuota(radice);
  radice.append(
    barraAlta(`${seduta.scheda} · esercizio ${seduta.posizione.esercizio + 1} di ${seduta.esercizi.length}`, chiudi),
    el('div.pal-corpo.pal-esito', {},
      el('p.pal-fase', { testo: v.nome.toUpperCase() }),
      el('p.esito-reg', { testo: p ? { aumenta: 'Aumenta', mantieni: 'Resta qui', diminuisci: 'Torna indietro' }[p.regola] : 'Incompleto' }),
      el('p.esito-msg', { testo: p ? p.messaggio : 'Mancano dei numeri: la regola non può decidere. Puoi correggere dopo, dallo storico.' }),
      el('p.pal-nota', { testo: `${regolaTesto(v)}.` }),
      el('div.esito-riep', {},
        el('span', { testo: `Volume ${volume(v).toLocaleString('it-IT')} kg` }),
        el('span', { testo: completa(v) ? 'tutte le caselle compilate' : 'qualche casella vuota' })),
      el('button.pal-ghost', { type: 'button', testo: '← Torna all\'esercizio',
                               onclick: () => { seduta.posizione.fase = 'lavoro'; salva(); disegna(); } })),
    piede(ultimo ? 'Chiudi la seduta' : 'Prossimo esercizio →', prossimo));

  radice.querySelector('.esito-reg').classList.add(p ? p.regola : 'mantieni');
}

async function prossimo() {
  sbloccaAudio(); tocco();
  const p = seduta.posizione;
  if (p.esercizio >= seduta.esercizi.length - 1) {
    p.fase = 'fine';
    seduta.stato = 'completata';
    seduta.finitaAlle = Date.now();
    seduta.timerFineAt = null;
    await salva();
    fermaCrono();
    return disegna();
  }
  p.esercizio += 1;
  p.serie = 0;
  p.fase = 'lavoro';
  await salva();
  // fra un esercizio e l'altro c'è da cambiare macchina e caricarla: il
  // recupero è più breve di quello fra le serie, ma non è zero
  const pausa = preferenze.recuperoEsercizi ?? 120;
  if (pausa > 0) avviaRecupero(pausa, 'esercizio');
  else disegna();
}

/* ---------- fine seduta ---------- */

function schermataFine() {
  fermaBattito();
  rilasciaWakeLock();
  const vol = seduta.esercizi.reduce((t, v) => t + volume(v), 0);
  const durata = seduta.finitaAlle && seduta.iniziataAlle
    ? Math.round((seduta.finitaAlle - seduta.iniziataAlle) / 60000) : null;
  const aumenti = seduta.esercizi.filter(v => v.esito?.regola === 'aumenta');

  svuota(radice);
  radice.append(
    barraAlta('Seduta finita', chiudi),
    el('div.pal-corpo.pal-fine', {},
      el('p.fine-scheda', { testo: 'Seduta ' + seduta.scheda }),
      el('p.fine-num', { testo: vol.toLocaleString('it-IT') + ' kg' }),
      el('p.fine-lab', { testo: 'volume totale' + (durata ? ` · ${durata} minuti` : '') }),
      aumenti.length
        ? el('div.fine-aumenti', {},
            el('p.glab', { testo: 'LA PROSSIMA VOLTA AUMENTI' }),
            ...aumenti.map(v => el('div.voce', {},
              el('span.n', { testo: v.nome }), el('span.leader'),
              el('span.q', { testo: nkg(v.esito.prossimoCarico) + ' kg' }))))
        : el('p.pal-nota', { testo: 'Nessun aumento previsto: i carichi restano quelli.' }),
      el('div.fine-elenco', {},
        ...seduta.esercizi.map(v => el('div.voce', {},
          el('span.n', { testo: v.nome }), el('span.leader'),
          el('span.q', { testo: completa(v) ? nkg(caricoPrincipale(v)) + ' kg' : 'incompleto' }))))),
    piede('Chiudi', chiudi));
}

/* ====================== pezzi di interfaccia ====================== */

function barraAlta(testo, onChiudi) {
  return el('div.pal-barra', {},
    el('span.pal-titolo', { testo }),
    seduta ? el('span.pal-crono', { 'aria-label': 'Durata della seduta' }) : null,
    el('button.pal-x', { type: 'button', testo: '✕', 'aria-label': 'Esci dalla modalità palestra',
                         onclick: onChiudi }));
}

/* Cronometro della seduta: parte all'inizio e resta visibile ovunque.
   Novanta minuti sono il limite oltre il quale la seduta smette di essere
   allenamento e diventa tempo passato in sala — il numero serve a saperlo. */
function aggiornaCrono() {
  const n = radice?.querySelector('.pal-crono');
  if (!n || !seduta?.iniziataAlle) return;
  const minuti = (seduta.finitaAlle || Date.now()) - seduta.iniziataAlle;
  n.textContent = mmss(minuti / 1000);
  n.classList.toggle('lunga', minuti / 60000 >= (preferenze.durataMax || 90));
}
function avviaCrono() {
  fermaCrono();
  aggiornaCrono();
  crono = setInterval(aggiornaCrono, 1000);
}
const fermaCrono = () => { if (crono) { clearInterval(crono); crono = null; } };

function piede(etichetta, onTocco, sottotitolo = null) {
  return el('div.pal-piede', {},
    el('button.pal-cta', { type: 'button', testo: etichetta, onclick: onTocco }),
    sottotitolo ? el('p.pal-dopo', { testo: sottotitolo }) : null);
}

function campoGrande(etichetta, controllo) {
  return el('div.pal-campo', {}, el('span.pal-lab', { testo: etichetta }), controllo);
}

function pallini(v, p) {
  const totale = passi(v);
  const box = el('div.pallini', { 'aria-label': `${nomePasso(v)} ${p.serie + 1} di ${totale}` });
  for (let i = 0; i < totale; i++) {
    box.append(el('span.pallino' + (i < p.serie ? '.fatto' : i === p.serie ? '.ora' : '')));
  }
  return box;
}

function riassuntoBreve(v) {
  const c = def(v);
  if (c.forma === 'iso') {
    const chiavi = c.tenute.map((_, k) => chiaveTenuta(c, k));
    return v.giri.map(x => `${nkg(x.carico)} kg ${chiavi.map(k => x[k] ?? '—').join('/')}`).join(' · ');
  }
  if (c.caricoUnico) return `${nkg(v.carico)} kg · ${v.serie.map(s => s.rip ?? '—').join('/')}`;
  return v.serie.map(s => `${nkg(s.carico)}×${s.rip ?? '—'}`).join(' · ');
}
