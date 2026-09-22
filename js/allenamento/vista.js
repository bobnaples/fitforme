/* Modulo ALLENAMENTO: lo storico delle sedute, l'inserimento precompilato
   con i carichi dell'ultima volta, i grafici per esercizio e l'editor delle
   schede — quello che permette di passare alla scheda nuova senza perdere
   lo storico di quella vecchia. */

import { INCORPORATI, def, nomeProtocollo, descrizione, regolaTesto, precompila,
         progressione, calcolaDrop, caricoPrincipale, ripTotali, volume, completa,
         gradino, passi, chiaveTenuta } from './protocolli.js';
import { grafico } from '../grafico.js';
import * as palestra from './palestra.js';
import { passo, rigaVoce } from '../componenti.js';
import { el, $$, svuota, nkg, oggiISO, dataBreve, dataLunga, quando } from '../ui.js';
import { catalogo, programmaAttivo, programmi, salvaProgramma, vociScheda,
         sedute, salvaSeduta, eliminaSeduta, storico, ultimaVolta,
         ultimaCompletata, sedutaAperta, prefs, salvaPrefs, salvaEsercizio } from '../store.js';

let radice = null, cat = null, prog = null, preferenze = null;

const SCHEDE = ['A', 'B', 'C'];
const dentro = s => radice.querySelector(s);

/* ====================== impianto ====================== */

export async function monta(pannello) {
  radice = pannello;
  cat = await catalogo();
  prog = await programmaAttivo();
  preferenze = await prefs();

  pannello.replaceChildren(
    el('nav.sottonav', { role: 'tablist', 'aria-label': 'Sezioni dell\'allenamento' },
      ...[['sedute', 'Sedute'], ['grafici', 'Grafici'], ['schede', 'Schede']].map(([k, t], i) =>
        el('button', { role: 'tab', dataset: { sez: k }, testo: t,
                       'aria-selected': i === 0, tabindex: i === 0 ? 0 : -1 }))),
    el('div', { dataset: { pannello: 'sedute' } }),
    el('div', { dataset: { pannello: 'grafici' }, hidden: true }),
    el('div', { dataset: { pannello: 'schede' }, hidden: true }));

  collegaSottonav();
  await disegnaSedute();
}

function collegaSottonav() {
  const bs = $$('.sottonav button', radice);
  const vai = async b => {
    bs.forEach(x => {
      const on = x === b;
      x.setAttribute('aria-selected', on);
      x.tabIndex = on ? 0 : -1;
      dentro(`[data-pannello="${x.dataset.sez}"]`).hidden = !on;
    });
    if (b.dataset.sez === 'grafici') await disegnaGrafici();
    if (b.dataset.sez === 'schede') await disegnaSchede();
  };
  bs.forEach((b, i) => {
    b.addEventListener('click', () => vai(b));
    b.addEventListener('keydown', e => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const n = bs[(i + (e.key === 'ArrowRight' ? 1 : bs.length - 1)) % bs.length];
      vai(n); n.focus();
    });
  });
}

/* Rilettura completa dopo la modalità palestra: la seduta appena chiusa
   deve comparire nello storico e nei grafici. */
async function ricarica() {
  cat = await catalogo();
  prog = await programmaAttivo();
  preferenze = await prefs();
  await disegnaSedute();
}

/* ====================== SEDUTE: elenco ====================== */

async function disegnaSedute() {
  const box = dentro('[data-pannello="sedute"]');
  const lista = (await sedute()).reverse();
  const ultima = await ultimaCompletata();

  const aperta = await sedutaAperta();

  svuota(box);
  box.append(
    el('button.avvia-palestra', {
      type: 'button',
      onclick: () => palestra.apri({ onChiudi: ricarica }),
    },
      el('span', { testo: aperta ? 'Riprendi la seduta' : 'In palestra' }),
      el('small', { testo: aperta ? `${aperta.scheda}, esercizio ${(aperta.posizione?.esercizio ?? 0) + 1}` : 'una serie alla volta' })),

    el('div.scheda', {},
      el('h2.stit', {}, el('span', { testo: 'Registra una seduta' }),
        el('small', { testo: ultima ? `ultima: ${ultima.scheda}, ${quando(ultima.data)}` : 'nessuna ancora' })),
      el('div.scelta-scheda', {},
        ...SCHEDE.map(s => el('button.scheda-btn', {
          type: 'button', onclick: () => apriForm({ scheda: s }),
        },
          el('b', { testo: s }),
          el('small', { testo: riassuntoScheda(s) })))),
      el('p.nota', { testo: 'I carichi arrivano già compilati con quelli dell\'ultima volta: se non cambia nulla, salvi e basta.' })),

    el('div.scheda', {},
      el('h2.stit', {}, el('span', { testo: 'Storico' }),
        el('small', { testo: `${lista.length} sedute` })),
      lista.length ? el('div', {}, ...lista.map(rigaSeduta))
                   : el('p.vuoto', { testo: 'Nessuna seduta registrata.' })));
}

function riassuntoScheda(s) {
  const voci = prog ? prog.voci.filter(v => v.scheda === s) : [];
  if (!voci.length) return 'vuota';
  const nomi = [...new Set(voci.map(v => nomeProtocollo(def(v))))];
  return `${voci.length} esercizi · ${nomi.slice(0, 3).join(', ')}`;
}

function rigaSeduta(s) {
  const vol = s.esercizi.reduce((t, v) => t + volume(v), 0);
  const riga = el('button.riga-seduta', {
    type: 'button', onclick: () => apriForm({ seduta: s }),
  },
    el('span.rs-data', { testo: dataBreve(s.data) }),
    el('span.rs-scheda', { testo: s.scheda }),
    el('span.rs-info', { testo: `${s.esercizi.length} esercizi · ${vol.toLocaleString('it-IT')} kg di volume` }),
    s.stato === 'in_corso' ? el('span.badge.basso', { testo: 'da finire' }) : null);
  return riga;
}

/* ====================== SEDUTE: inserimento ====================== */

/* Apre la scheda del giorno, precompilata. Se `seduta` è passata, riapre
   quella già registrata per correggerla. */
async function apriForm({ scheda = null, seduta = null }) {
  const box = dentro('[data-pannello="sedute"]');
  scheda = seduta ? seduta.scheda : scheda;
  const voci = await vociScheda(scheda, prog);

  const bozza = seduta
    ? structuredClone(seduta)
    : {
        id: `sd_${Date.now().toString(36)}`,
        data: oggiISO(), scheda, programmaId: prog?.id || null,
        iniziataAlle: Date.now(), finitaAlle: null, stato: 'completata',
        esercizi: [], note: '',
      };

  if (!seduta) {
    for (const v of voci) {
      const u = await ultimaVolta(v.esId, v.protocollo);
      bozza.esercizi.push(precompila(v, u, v.esercizio, preferenze));
    }
  }

  const campoData = el('input.campo-data', {
    type: 'date', value: bozza.data, 'aria-label': 'Data della seduta',
    onchange: e => { bozza.data = e.target.value || oggiISO(); },
  });

  const corpo = el('div.esercizi');
  svuota(box);
  box.append(
    el('div.scheda', {},
      el('h2.stit', {}, el('span', { testo: 'Seduta ' + scheda }),
        el('small', { testo: seduta ? 'correzione' : dataLunga(bozza.data) })),
      el('div.riga-form', {}, campoData,
        el('button.ghost', { type: 'button', testo: 'Annulla', onclick: disegnaSedute })),
      corpo,
      el('div.azioni', {},
        el('button.cta', { type: 'button', testo: seduta ? 'Salva le correzioni' : 'Salva la seduta',
                           onclick: () => salva(bozza) }),
        seduta ? el('button.ghost', { type: 'button', testo: 'Elimina',
                    onclick: async () => {
                      if (!confirm(`Elimino la seduta ${scheda} del ${dataBreve(seduta.data)}?`)) return;
                      await eliminaSeduta(seduta.id);
                      await disegnaSedute();
                    } }) : null)));

  for (let i = 0; i < bozza.esercizi.length; i++) {
    corpo.append(await cardEsercizio(bozza, i));
  }
  scrollTo({ top: 0, behavior: 'instant' });
}

async function cardEsercizio(bozza, indice) {
  const v = bozza.esercizi[indice];
  const es = cat.get(v.esId) || { nome: v.nome, incremento: 2.5 };
  const g = gradino(es);
  const c = def(v);
  const ultima = await ultimaVolta(v.esId, v.protocollo);

  const esito = el('p.esito');
  const aggiornaEsito = () => {
    const p = progressione(v, es, ultima ? caricoPrincipale(ultima) : null);
    esito.textContent = p ? p.messaggio : 'Compila tutte le caselle per sapere cosa fare la prossima volta.';
    esito.className = 'esito' + (p ? ' ' + p.regola : '');
    v.esito = p;
  };

  const card = el('div.es-card', {},
    el('div.es-testa', {},
      el('h3', { testo: es.nome }),
      el('span.es-proto', { testo: nomeProtocollo(c) })),
    ultima
      ? el('p.es-ultima', { testo: `Ultima volta (${quando(ultima.data)}): ${riassunto(ultima)}` })
      : el('p.es-ultima', { testo: 'Prima volta con questo protocollo: inserisci il carico di partenza.' }));

  card.append(...(c.forma === 'iso' ? campiIso(v, es, g, c, aggiornaEsito)
                                    : campiSerie(v, es, g, c, aggiornaEsito)));
  card.append(esito);
  aggiornaEsito();
  return card;
}

/* Forma «serie»: 5x5 con drop, 3x12, o qualunque N×R configurato. */
function campiSerie(v, es, g, c, aggiorna) {
  const fuori = [el('p.es-schema', { testo: descrizione(c) })];

  if (c.caricoUnico) {
    const etichettaDrop = el('span.drop-lab');
    const mostraDrop = () => { etichettaDrop.textContent = v.drop == null ? '' : `drop ${nkg(v.drop)} kg`; };
    const carico = passo({
      valore: v.carico, step: g, etichetta: 'carico', unita: 'kg', decimali: 1,
      onCambio: n => {
        v.carico = n;
        if (c.drop) v.drop = calcolaDrop(n, es, preferenze.arrotondaDrop, c.drop);
        mostraDrop(); aggiorna();
      },
    });
    mostraDrop();
    fuori.push(el('div.riga-carico', {}, el('span.lab', { testo: 'Carico' }), carico, etichettaDrop));
  }

  const serie = el('div.serie');
  v.serie.forEach((s, i) => {
    const riga = el('div.serie-riga', {}, el('span.serie-num', { testo: 'S' + (i + 1) }));
    if (!c.caricoUnico) {
      riga.append(
        passo({ valore: s.carico, step: g, etichetta: `carico serie ${i + 1}`, unita: 'kg',
                onCambio: n => { s.carico = n; aggiorna(); } }),
        el('span.serie-sep', { testo: '×' }));
    }
    riga.append(passo({ valore: s.rip, step: 1, max: 60, decimali: 0, stretto: true,
                        etichetta: `ripetizioni serie ${i + 1}`,
                        onCambio: n => { s.rip = n; aggiorna(); } }));
    if (c.drop) {
      riga.append(
        el('span.serie-sep', { testo: 'drop' }),
        passo({ valore: s.dropRip, step: 1, max: 60, decimali: 0, stretto: true,
                etichetta: `ripetizioni drop ${i + 1}`,
                onCambio: n => { s.dropRip = n; aggiorna(); } }));
    }
    serie.append(riga);
  });
  fuori.push(serie);
  return fuori;
}

function campiIso(v, es, g, c, aggiorna) {
  const fuori = [el('p.es-schema', { testo: descrizione(c) })];
  v.giri.forEach((x, i) => {
    const griglia = el('div.iso-griglia');
    c.tenute.forEach((sec, k) => {
      const chiave = chiaveTenuta(c, k);
      griglia.append(el('div.iso-cella', {},
        el('span.iso-lab', { testo: chiave === 'max' ? sec + '″ max' : sec + '″' }),
        passo({ valore: x[chiave], step: 1, max: 60, decimali: 0, stretto: true,
                etichetta: `${sec}″ giro ${i + 1}`,
                onCambio: n => { x[chiave] = n; aggiorna(); } })));
    });
    fuori.push(el('div.giro', {},
      el('div.riga-carico', {},
        el('span.lab', { testo: `Giro ${i + 1}` }),
        passo({ valore: x.carico, step: g, etichetta: `carico giro ${i + 1}`, unita: 'kg',
                onCambio: n => { x.carico = n; aggiorna(); } })),
      griglia));
  });
  return fuori;
}

function riassunto(v) {
  const c = def(v);
  if (c.forma === 'iso') {
    const chiavi = c.tenute.map((_, k) => chiaveTenuta(c, k));
    return v.giri.map((x, i) => `giro ${i + 1} ${nkg(x.carico)} kg ${chiavi.map(k => x[k] ?? '—').join('/')}`).join(' · ');
  }
  if (c.caricoUnico) {
    return `${nkg(v.carico)} kg · ${v.serie.map(s => s.rip ?? '—').join('/')}` +
           (v.drop ? ` · drop ${nkg(v.drop)} kg ${v.serie.map(s => s.dropRip ?? '—').join('/')}` : '');
  }
  return v.serie.map(s => `${nkg(s.carico)}×${s.rip ?? '—'}`).join(' · ');
}

async function salva(bozza) {
  const incompleti = bozza.esercizi.filter(v => !completa(v));
  if (incompleti.length) {
    const nomi = incompleti.map(v => v.nome).join(', ');
    if (!confirm(`Questi esercizi non sono completi: ${nomi}.\nSalvo lo stesso?`)) return;
  }
  bozza.finitaAlle = Date.now();
  bozza.stato = 'completata';
  await salvaSeduta(bozza);
  await disegnaSedute();
}

/* ====================== GRAFICI ====================== */

let esScelto = null;

async function disegnaGrafici() {
  const box = dentro('[data-pannello="grafici"]');
  const voci = prog ? prog.voci : [];
  if (!voci.length) { box.replaceChildren(el('p.vuoto', { testo: 'Nessuna scheda attiva.' })); return; }

  const opzioni = voci
    .slice()
    .sort((a, b) => a.scheda.localeCompare(b.scheda) || a.ordine - b.ordine)
    .map(v => ({ chiave: v.esId + '|' + v.protocollo, v }));
  if (!esScelto || !opzioni.some(o => o.chiave === esScelto)) esScelto = opzioni[0].chiave;

  const select = el('select.selettore', {
    'aria-label': 'Esercizio',
    onchange: e => { esScelto = e.target.value; disegnaGrafici(); },
  }, ...SCHEDE.map(s => {
    const gruppo = el('optgroup', { label: 'Seduta ' + s });
    opzioni.filter(o => o.v.scheda === s).forEach(o =>
      gruppo.append(el('option', {
        value: o.chiave, selected: o.chiave === esScelto,
        testo: `${cat.get(o.v.esId)?.nome || o.v.esId} — ${nomeProtocollo(def(o.v))}`,
      })));
    return gruppo.children.length ? gruppo : null;
  }).filter(Boolean));

  const [esId, protocollo] = esScelto.split('|');
  const h = await storico(esId, protocollo);
  const es = cat.get(esId);

  const puntiCarico = h.map(v => ({ x: v.data, y: caricoPrincipale(v) })).filter(p => p.y != null);
  const puntiRip = h.map(v => ({ x: v.data, y: ripTotali(v) })).filter(p => p.y > 0);

  // righe verticali dove è cambiato il programma: il grafico resta continuo
  const tutti = await programmi();
  const segni = tutti.filter(p => p.id !== h[0]?.programmaId).map(p => ({ x: p.dal }));

  const delta = puntiCarico.length > 1
    ? puntiCarico.at(-1).y - puntiCarico[0].y : null;

  box.replaceChildren(
    el('div.scheda', {},
      el('h2.stit', {}, el('span', { testo: 'Andamento' }),
        el('small', { testo: `${h.length} volte` })),
      select,
      delta !== null
        ? el('p.delta', { testo: `Da ${nkg(puntiCarico[0].y)} a ${nkg(puntiCarico.at(-1).y)} kg: ${delta >= 0 ? '+' : '−'}${nkg(Math.abs(delta))} kg (${delta >= 0 ? '+' : '−'}${Math.abs(Math.round(delta / puntiCarico[0].y * 100))} %) in ${h.length} sedute.` })
        : null,
      grafico({ punti: puntiCarico, titolo: 'Carico di lavoro', unita: 'kg', segni }),
      grafico({ punti: puntiRip, titolo: 'Ripetizioni totali', unita: '', decimali: 0, altezza: 110 }),
      el('p.nt', { testo: 'Due grafici e non uno: carico e ripetizioni hanno scale diverse, e sovrapporle farebbe vedere un andamento che nei dati non c\'è.' })),

    el('div.scheda', {},
      el('h2.stit', { testo: 'Tabella' }),
      el('div.tabwrap', {}, tabellaStorico(h, es))));
}

function tabellaStorico(h, es) {
  const t = el('table');
  t.innerHTML = '<thead><tr><th>Data</th><th>Dettaglio</th><th class="num">Carico</th><th class="num">Rip tot</th><th class="num">Volume</th></tr></thead>';
  const corpo = el('tbody');
  h.slice().reverse().forEach(v => {
    const tr = el('tr', {},
      el('td', { testo: dataBreve(v.data) }),
      el('td', { testo: riassunto(v) }),
      el('td.num', { testo: nkg(caricoPrincipale(v)) + ' kg' }),
      el('td.num', { testo: String(ripTotali(v)) }),
      el('td.num', { testo: volume(v).toLocaleString('it-IT') + ' kg' }));
    corpo.append(tr);
  });
  t.append(corpo);
  return h.length ? t : el('p.vuoto', { testo: 'Nessun dato.' });
}

/* ====================== SCHEDE ====================== */

async function disegnaSchede() {
  const box = dentro('[data-pannello="schede"]');
  svuota(box);

  const editore = el('div');
  box.append(editore);
  const editor = await import('./editor.js');
  await editor.monta(editore, { onSalva: ricarica });

  box.append(el('div.scheda', {},
    el('h2.stit', {}, el('span', { testo: 'Recuperi' }),
      el('small', { testo: 'quanto aspetti' })),
    el('label.campo', {},
      el('span', { testo: 'Fra un esercizio e l\'altro' }),
      passo({ valore: preferenze.recuperoEsercizi, step: 15, min: 0, max: 600, decimali: 0,
              unita: 'sec', etichetta: 'recupero fra esercizi',
              onCambio: async n => { preferenze = await salvaPrefs({ recuperoEsercizi: n ?? 0 }); } })),
    el('p.nt', { testo: 'Zero significa nessuna pausa: si passa dritti all\'esercizio dopo. ' +
                        'Il recupero fra le serie è quello di ogni voce, qui sopra.' })));
}


