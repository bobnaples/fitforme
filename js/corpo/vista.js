/* PESO E MISURE.

   Il peso del singolo giorno non dice nulla: oscilla di un chilo per l'acqua,
   il sale e cosa hai mangiato ieri. Quello che conta è la media a 7 giorni,
   e infatti è lei ad avere il numero grande e la linea del grafico.
   Le circonferenze si prendono ogni due settimane, a freddo, la mattina. */

import { el, $$, nkg, npiu, oggiISO, dataBreve, dataLunga, quando,
         giorniFra, sommaGiorni } from '../ui.js';
import { passo } from '../componenti.js';
import { grafico } from '../grafico.js';
import { pesate, conMediaMobile, salvaPeso, eliminaPeso,
         misure, salvaMisura, eliminaMisura } from '../store.js';
import { campiBilancia } from './bilancia.js';

const CAMPI_MISURA = [
  ['collo', 'Collo'], ['spalle', 'Spalle'], ['petto', 'Petto'], ['vita', 'Vita'],
  ['fianchi', 'Fianchi'], ['braccio', 'Braccio'], ['coscia', 'Coscia'], ['polpaccio', 'Polpaccio'],
];

let radice = null, sezione = 'peso';

export async function monta(pannello) {
  radice = pannello;
  pannello.replaceChildren(
    el('nav.sottonav', { role: 'tablist', 'aria-label': 'Sezioni del corpo' },
      ...[['peso', 'Peso'], ['misure', 'Circonferenze']].map(([k, t], i) =>
        el('button', { role: 'tab', dataset: { sez: k }, testo: t,
                       'aria-selected': i === 0, tabindex: i === 0 ? 0 : -1,
                       onclick: e => vai(e.currentTarget) }))),
    el('div', { dataset: { pannello: 'corpo' } }));
  await disegna();
}

function vai(b) {
  $$('.sottonav button', radice).forEach(x => {
    const on = x === b;
    x.setAttribute('aria-selected', on);
    x.tabIndex = on ? 0 : -1;
  });
  sezione = b.dataset.sez;
  disegna();
}

const box = () => radice.querySelector('[data-pannello="corpo"]');
const disegna = () => sezione === 'peso' ? disegnaPeso() : disegnaMisure();

/* ====================== PESO ====================== */

async function disegnaPeso() {
  const lista = conMediaMobile(await pesate());
  const ultima = lista[lista.length - 1];
  const oggi = lista.find(r => r.data === oggiISO());
  const b = box();
  b.replaceChildren();

  // --- inserimento ---
  const modello = oggi || ultima || {};
  const campo = passo({ valore: oggi?.kg ?? ultima?.kg ?? 80, step: 0.1, min: 30, max: 250,
                        decimali: 1, grande: true, unita: 'kg', etichetta: 'peso' });
  const data = el('input.campo-data', { type: 'date', value: oggiISO(), max: oggiISO(),
                                        'aria-label': 'Giorno della pesata' });
  // i valori della bilancia partono da quelli dell'ultima volta, che con una
  // bilancia a impedenza cambiano di poco: correggi quello che è cambiato
  const bilancia = campiBilancia({ kg: campo.leggi() ?? modello.kg, ...modello },
                                 { aperto: oggi?.grassoPerc != null });
  campo.campo.addEventListener('change', () => bilancia.aggiorna(campo.leggi()));

  b.append(el('div.scheda', {},
    el('div.scheda-testa', {},
      el('span.scheda-tit', { testo: oggi ? 'Correggi il peso di oggi' : 'Segna il peso' }),
      el('span.scheda-val', { testo: 'appena sveglio, prima di bere' })),
    el('div.campo-hero', {}, campo),
    el('label.campo', {}, el('span', { testo: 'Giorno' }), data),
    bilancia,
    el('button.cta', { type: 'button', testo: oggi ? 'Aggiorna' : 'Segna', onclick: async () => {
      const kg = campo.leggi();
      if (kg == null) return;
      const g = data.value || oggiISO();
      const esistente = lista.find(r => r.data === g);
      await salvaPeso({ data: g, kg, ...bilancia.leggi(), nota: esistente?.nota ?? '' });
      try { navigator.vibrate?.(25); } catch {}
      window.fitforme?.invalida('oggi');
      disegna();
    } })));

  if (!lista.length) {
    b.append(el('p.vuoto', { testo: 'Nessuna pesata. La media a 7 giorni comincia ad avere senso dopo qualche giorno.' }));
    return;
  }

  // --- il numero che conta ---
  b.append(el('div.scheda', {},
    el('div.scheda-testa', {},
      el('span.scheda-tit', { testo: 'Media a 7 giorni' }),
      el('span.scheda-val', { testo: `${lista.length} pesate · ultima ${quando(ultima.data)}` })),
    el('p.hero', {}, el('b', { testo: nkg(ultima.media, 2) }), el('small', { testo: 'kg' })),
    rigaAndamento(ultima, lista),
    el('p.nt', { testo: 'Guarda solo questa. Il peso del singolo giorno oscilla di un chilo ' +
                        'per l\'acqua e per cosa hai mangiato ieri: non è un segnale.' })));

  const comp = bloccoComposizione(lista);
  if (comp) b.append(comp);

  // --- grafico: media contro pesate singole ---
  const puntiMedia = lista.filter(r => r.campioni >= 2)
    .map(r => ({ x: r.data, y: r.media, nota: `${nkg(r.kg)} kg quel giorno` }));
  const tela = el('div.scheda', {},
    grafico({ punti: puntiMedia, titolo: 'Media a 7 giorni', unita: 'kg', decimali: 2, altezza: 160 }),
    grafico({ punti: lista.map(r => ({ x: r.data, y: r.kg })), titolo: 'Pesate giornaliere',
              unita: 'kg', decimali: 1, altezza: 110 }));

  // se la bilancia dà la composizione, i due grafici che contano davvero:
  // in lean bulk la massa magra deve salire e il grasso restare quasi fermo
  const conMagra = lista.filter(r => r.mediaMagraKg !== null);
  if (conMagra.length >= 2) {
    tela.append(
      grafico({ punti: conMagra.map(r => ({ x: r.data, y: r.mediaMagraKg })),
                titolo: 'Massa magra, media a 7 giorni', unita: 'kg', decimali: 1, altezza: 130 }),
      grafico({ punti: conMagra.filter(r => r.mediaGrassoKg !== null)
                               .map(r => ({ x: r.data, y: r.mediaGrassoKg })),
                titolo: 'Massa grassa, media a 7 giorni', unita: 'kg', decimali: 1, altezza: 130 }));
  }
  b.append(tela);

  // --- storico ---
  const storico = el('div.scheda', {},
    el('div.scheda-testa', {}, el('span.scheda-tit', { testo: 'Storico' })));
  lista.slice().reverse().slice(0, 30).forEach(r => {
    storico.append(el('div.voce.riga-peso', {},
      el('span.n', { testo: dataBreve(r.data) }),
      el('span.leader'),
      el('span.q', { testo: `${nkg(r.kg)} kg` }),
      el('span.med', { testo: r.grassoPerc != null
        ? `${nkg(r.grassoPerc)} % grasso`
        : r.campioni >= 2 ? `media ${nkg(r.media, 2)}` : '—' }),
      el('button.ghost.mini.pericolo', { type: 'button', testo: '×',
        'aria-label': `Elimina la pesata del ${dataBreve(r.data)}`,
        onclick: async () => {
          if (!confirm(`Elimino la pesata del ${dataBreve(r.data)}?`)) return;
          await eliminaPeso(r.data);
          window.fitforme?.invalida('oggi');
          disegna();
        } })));
  });
  if (lista.length > 30) storico.append(el('p.nt', { testo: `Mostrate le ultime 30 di ${lista.length}. Le altre sono nell'esportazione CSV.` }));
  b.append(storico);
}

/* La composizione corporea: i chili di grasso e di massa magra, in media a
   7 giorni, e come si sono mossi dall'inizio.
   È qui che si vede se il lean bulk sta funzionando: la massa magra sale e
   il grasso resta quasi fermo. Se salgono insieme, stai mangiando troppo. */
function bloccoComposizione(lista) {
  const conDati = lista.filter(r => r.mediaMagraKg !== null);
  if (!conDati.length) {
    return el('div.scheda.stretta', {},
      el('div.scheda-testa', {}, el('span.scheda-tit', { testo: 'Composizione' })),
      el('p.nt', { testo: 'Se la tua bilancia dà grasso e massa magra, aprili sotto il peso ' +
                          'con «Dati della bilancia»: qui compaiono i chili e il loro andamento.' }));
  }
  const u = conDati[conDati.length - 1];
  const primo = conDati[0];
  const box = el('div.scheda', {},
    el('div.scheda-testa', {},
      el('span.scheda-tit', { testo: 'Composizione' }),
      el('span.scheda-val', { testo: `media a 7 giorni · ${conDati.length} rilevazioni` })),
    el('div.mini-stat', {},
      el('div', {}, el('b', { testo: nkg(u.mediaMagraKg) }), el('span', { testo: 'kg magri' })),
      el('div', {}, el('b', { testo: nkg(u.mediaGrassoKg) }), el('span', { testo: 'kg di grasso' })),
      el('div', {}, el('b', { testo: nkg(u.mediaGrassoPerc) }), el('span', { testo: '% grasso' }))));

  if (conDati.length >= 2 && giorniFra(primo.data, u.data) >= 7) {
    const dMagra = u.mediaMagraKg - primo.mediaMagraKg;
    const dGrasso = u.mediaGrassoKg - primo.mediaGrassoKg;
    box.append(el('div.media-riga', {},
      el('span', {}, 'Da ', dataBreve(primo.data), ': magra ',
        el('b', { testo: npiu(dMagra) + ' kg' }), ', grasso ',
        el('b', { testo: npiu(dGrasso) + ' kg' })),
      el('span.badge' + (dMagra > 0 && dGrasso <= Math.abs(dMagra) ? '.ok' : '.basso'),
         { testo: dMagra > 0 && dGrasso <= Math.abs(dMagra) ? 'sta andando bene' : 'da guardare' })));
  }
  box.append(el('p.nt', { testo: 'Le bilance a impedenza sbagliano di parecchio sul valore assoluto ' +
                                 'ma sono ragionevoli sulla tendenza: guarda la direzione, non il numero.' }));
  return box;
}

/* Variazione settimanale, con il commento che serve a decidere qualcosa.
   In lean bulk il bersaglio è +0,25 / +0,40 kg a settimana: sopra stai
   prendendo grasso, sotto non stai crescendo. */
function rigaAndamento(ultima, lista) {
  const riga = el('div.media-riga');
  if (ultima.variazione === null) {
    riga.append(el('span', { testo: 'Servono due settimane di pesate per la variazione.' }));
    return riga;
  }
  const v = ultima.variazione;
  const dentro = v >= 0.2 && v <= 0.45;
  riga.append(
    el('span', {}, el('b', { testo: npiu(v) + ' kg' }), ' a settimana'),
    el('span.badge' + (dentro ? '.ok' : '.basso'),
       { testo: dentro ? 'nel bersaglio' : v < 0.2 ? 'sotto il bersaglio' : 'sopra il bersaglio' }));
  return riga;
}

/* ====================== CIRCONFERENZE ====================== */

async function disegnaMisure() {
  const lista = await misure();
  const ultima = lista[lista.length - 1];
  const giorni = ultima ? giorniFra(ultima.data, oggiISO()) : null;
  const b = box();
  b.replaceChildren();

  // --- promemoria ---
  b.append(el('div.scheda.stretta', {},
    el('div.scheda-testa', {},
      el('span.scheda-tit', { testo: 'Ogni due settimane' }),
      ultima ? el('span.scheda-val', { testo: `ultima ${quando(ultima.data)}` }) : null),
    el('p.scheda-sott', { testo: giorni === null
      ? 'Non le hai ancora prese. A freddo, la mattina, muscoli rilassati: vita all\'ombelico, fianchi nel punto più largo.'
      : giorni >= 14
        ? `Sono passati ${giorni} giorni: è il momento di rimisurarti.`
        : `Prossima misurazione fra ${14 - giorni} giorni (${dataBreve(sommaGiorni(ultima.data, 14))}).` })));

  // --- inserimento ---
  const campi = {};
  const form = el('div.scheda', {},
    el('div.scheda-testa', {}, el('span.scheda-tit', { testo: 'Nuova misurazione' })));
  const data = el('input.campo-data', { type: 'date', value: oggiISO(), max: oggiISO(),
                                        'aria-label': 'Giorno della misurazione' });
  form.append(el('label.campo', {}, el('span', { testo: 'Giorno' }), data));

  const griglia = el('div.griglia-misure');
  CAMPI_MISURA.forEach(([chiave, etichetta]) => {
    campi[chiave] = passo({ valore: ultima?.[chiave] ?? null, step: 0.5, min: 0, max: 250,
                            decimali: 1, stretto: true, etichetta });
    griglia.append(el('div.cella-misura', {},
      el('span', { testo: etichetta }), campi[chiave]));
  });
  form.append(griglia,
    el('p.nt', { testo: 'Precompilate con i valori dell\'ultima volta: correggi solo quello che è cambiato. Lascia vuoto quello che non misuri.' }),
    el('button.cta', { type: 'button', testo: 'Salva la misurazione', onclick: async () => {
      const m = { data: data.value || oggiISO(), nota: '' };
      CAMPI_MISURA.forEach(([k]) => { m[k] = campi[k].leggi(); });
      if (CAMPI_MISURA.every(([k]) => m[k] == null)) { alert('Non hai inserito nessuna misura.'); return; }
      await salvaMisura(m);
      try { navigator.vibrate?.(25); } catch {}
      window.fitforme?.invalida('oggi');
      disegna();
    } }));
  b.append(form);

  if (!lista.length) return;

  // --- vita / spalle ---
  const conRapporto = lista.filter(m => m.vitaSpalle != null);
  if (conRapporto.length) {
    const u = conRapporto[conRapporto.length - 1];
    const primo = conRapporto[0];
    const delta = conRapporto.length > 1 ? u.vitaSpalle - primo.vitaSpalle : null;
    b.append(el('div.scheda', {},
      el('div.scheda-testa', {},
        el('span.scheda-tit', { testo: 'Rapporto vita / spalle' }),
        el('span.scheda-val', { testo: `${nkg(u.vita)} ÷ ${nkg(u.spalle)} cm` })),
      el('p.hero', {}, el('b', { testo: nkg(u.vitaSpalle, 3) })),
      delta === null
        ? el('p.nt', { testo: 'Serve una seconda misurazione per vedere se si sta muovendo.' })
        : el('div.media-riga', {},
            el('span', {}, 'Da ', el('b', { testo: nkg(primo.vitaSpalle, 3) }), ` (${dataBreve(primo.data)})`),
            el('span.badge' + (delta <= 0 ? '.ok' : '.basso'),
               { testo: (delta > 0 ? '+' : '−') + nkg(Math.abs(delta), 3) })),
      el('p.nt', { testo: 'Scende quando le spalle crescono più della vita: è il numero che distingue ' +
                          'una ricomposizione riuscita da un semplice aumento di peso.' }),
      grafico({ punti: conRapporto.map(m => ({ x: m.data, y: m.vitaSpalle })),
                titolo: 'Vita / spalle', unita: '', decimali: 3, altezza: 130 })));
  }

  // --- andamento delle singole circonferenze ---
  const misurabili = CAMPI_MISURA.filter(([k]) => lista.filter(m => m[k] != null).length >= 2);
  if (misurabili.length) {
    const sel = el('select.selettore', { 'aria-label': 'Circonferenza' },
      ...misurabili.map(([k, t]) => el('option', { value: k, testo: t })));
    const tela = el('div');
    const aggiorna = () => {
      const k = sel.value;
      tela.replaceChildren(grafico({
        punti: lista.filter(m => m[k] != null).map(m => ({ x: m.data, y: m[k] })),
        titolo: CAMPI_MISURA.find(c => c[0] === k)[1], unita: 'cm', decimali: 1, altezza: 140 }));
    };
    sel.addEventListener('change', aggiorna);
    aggiorna();
    b.append(el('div.scheda', {},
      el('div.scheda-testa', {}, el('span.scheda-tit', { testo: 'Andamento' })), sel, tela));
  }

  // --- tabella ---
  const t = el('table');
  t.innerHTML = '<thead><tr><th>Data</th>' +
    CAMPI_MISURA.map(([, n]) => `<th class="num">${n.slice(0, 4)}</th>`).join('') +
    '<th class="num">V/S</th><th></th></tr></thead>';
  const corpo = el('tbody');
  lista.slice().reverse().forEach(m => {
    corpo.append(el('tr', {},
      el('td', { testo: dataBreve(m.data) }),
      ...CAMPI_MISURA.map(([k]) => el('td.num', { testo: nkg(m[k]) })),
      el('td.num', { testo: nkg(m.vitaSpalle, 3) }),
      el('td.num', {}, el('button.ghost.mini.pericolo', { type: 'button', testo: '×',
        'aria-label': `Elimina la misurazione del ${dataBreve(m.data)}`,
        onclick: async () => {
          if (!confirm(`Elimino la misurazione del ${dataBreve(m.data)}?`)) return;
          await eliminaMisura(m.data);
          window.fitforme?.invalida('oggi');
          disegna();
        } }))));
  });
  t.append(corpo);
  b.append(el('div.scheda', {},
    el('div.scheda-testa', {}, el('span.scheda-tit', { testo: 'Tutte le misurazioni' })),
    el('div.tabwrap', {}, t)));
}
