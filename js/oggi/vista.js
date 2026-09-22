/* OGGI — la schermata che apre l'app.

   Risponde a tre domande, nell'ordine in cui te le fai davvero:
   che allenamento tocca, quanto peso stamattina, cosa mangio.
   Tutto quello che si può fare con un tocco si fa da qui. */

import { el, nkg, npiu, mmss, oggiISO, dataLunga, dataBreve, quando, giorniFra } from '../ui.js';
import { icona } from '../icone.js';
import { passo } from '../componenti.js';
import { campiBilancia } from '../corpo/bilancia.js';
import { sedutaAperta, ultimaCompletata, programmaAttivo, vociScheda, sedute,
         pesate, conMediaMobile, salvaPeso, misure, db } from '../store.js';
import { volume } from '../allenamento/protocolli.js';

const SCHEDE = ['A', 'B', 'C'];
const GIORNI = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];

let radice = null;

export async function monta(pannello) {
  radice = pannello;
  await disegna();
}

async function disegna() {
  radice.replaceChildren(
    await cardSeduta(),
    await cardPeso(),
    await cardPasti(),
    await cardMisure());
}

/* ====================== la seduta ====================== */

async function cardSeduta() {
  const aperta = await sedutaAperta();
  const ultima = await ultimaCompletata();
  const prog = await programmaAttivo();

  const card = el('div.scheda.card-seduta');

  if (aperta) {
    const voci = aperta.esercizi || [];
    const fatti = aperta.posizione?.esercizio ?? 0;
    card.append(
      el('div.scheda-testa', {},
        el('span.scheda-tit', { testo: 'Seduta lasciata a metà' }),
        el('span.badge.basso', { testo: dataBreve(aperta.data) })),
      el('p.hero', {}, el('b', { testo: aperta.scheda }),
        el('small', { testo: `esercizio ${fatti + 1} di ${voci.length}` })),
      barra(fatti / Math.max(1, voci.length)),
      el('button.cta', { type: 'button', onclick: vaiInPalestra },
        'Riprendi da dove eri'));
    return card;
  }

  const proposta = prossima(ultima, prog);
  const voci = prog ? await vociScheda(proposta, prog) : [];

  card.append(
    el('div.scheda-testa', {},
      el('span.scheda-tit', { testo: 'Allenamento di oggi' }),
      el('span.scheda-val', { testo: ultima ? `ultima: ${ultima.scheda}, ${quando(ultima.data)}` : 'la prima' })),
    el('p.hero', {}, el('b', { testo: proposta }),
      el('small', { testo: voci.length ? `${voci.length} esercizi` : 'scheda vuota' })),
    el('div.anteprima-es', {},
      ...voci.slice(0, 4).map(v => el('span', { testo: v.esercizio.nome })),
      voci.length > 4 ? el('span.piu', { testo: `+${voci.length - 4}` }) : null),
    el('button.cta', { type: 'button', onclick: () => vaiInPalestra(proposta) },
      icona('allenamento', { dimensione: 22 }), 'In palestra'),
    el('div.scelta-rapida', {},
      el('span', { testo: 'oppure' }),
      ...SCHEDE.filter(s => s !== proposta).map(s =>
        el('button.ghost.mini', { type: 'button', testo: 'Seduta ' + s,
                                  onclick: () => vaiInPalestra(s) }))));
  return card;
}

/* Proposta della seduta: la successiva a quella fatta l'ultima volta.
   Resta una proposta — i tre pulsanti sotto la scavalcano con un tocco. */
function prossima(ultima, prog) {
  const disponibili = prog ? [...new Set(prog.voci.map(v => v.scheda))].sort() : SCHEDE;
  if (!ultima) return disponibili[0] || 'A';
  const i = disponibili.indexOf(ultima.scheda);
  return disponibili[(i + 1) % disponibili.length];
}

async function vaiInPalestra(scheda = null) {
  const palestra = await import('../allenamento/palestra.js');
  await palestra.apri({
    scheda: typeof scheda === 'string' ? scheda : null,
    onChiudi: () => { window.fitforme?.invalida('allenamento'); disegna(); },
  });
}

const barra = frazione => el('div.progresso', {},
  el('span', { style: `width:${Math.round(Math.min(1, Math.max(0, frazione)) * 100)}%` }));

/* ====================== il peso ====================== */

async function cardPeso() {
  const lista = conMediaMobile(await pesate());
  const oggi = lista.find(r => r.data === oggiISO());
  const ultima = lista[lista.length - 1];

  const card = el('div.scheda.card-peso', {},
    el('div.scheda-testa', {},
      el('span.scheda-tit', { testo: 'Peso di stamattina' }),
      ultima ? el('span.scheda-val', { testo: `${lista.length} pesate` }) : null));

  if (oggi) {
    card.append(
      el('p.hero', {}, el('b', { testo: nkg(oggi.kg) }), el('small', { testo: 'kg' })),
      oggi.grassoKg !== null
        ? el('p.scheda-sott', { testo: `${nkg(oggi.grassoPerc)} % di grasso · ${nkg(oggi.magraKg)} kg di massa magra` })
        : null,
      rigaMedia(oggi),
      el('button.ghost.largo', { type: 'button', testo: 'Correggi', onclick: () => apriPeso(card, oggi) }));
  } else {
    const suggerito = ultima ? ultima.kg : 80;
    const campo = passo({ valore: suggerito, step: 0.1, min: 30, max: 250, decimali: 1,
                          grande: true, unita: 'kg', etichetta: 'peso di oggi' });
    // i dati della bilancia stanno chiusi: la strada veloce resta di un tocco
    const bilancia = campiBilancia({ kg: suggerito, ...(ultima || {}) });
    campo.campo.addEventListener('change', () => bilancia.aggiorna(campo.leggi()));
    card.append(
      el('p.scheda-sott', { testo: ultima
        ? `Non l'hai ancora segnato. L'ultima volta ${nkg(ultima.kg)} kg, ${quando(ultima.data)}.`
        : 'Segnalo appena sveglio, dopo il bagno, prima di bere.' }),
      el('div.campo-hero', {}, campo),
      bilancia,
      el('button.cta', { type: 'button', testo: 'Segna il peso', onclick: async () => {
        const kg = campo.leggi();
        if (kg == null) return;
        await salvaPeso({ data: oggiISO(), kg, ...bilancia.leggi(), nota: '' });
        try { navigator.vibrate?.(25); } catch {}
        window.fitforme?.invalida('corpo');
        disegna();
      } }),
      ultima ? rigaMedia(ultima) : null);
  }
  return card;
}

function rigaMedia(r) {
  const box = el('div.media-riga');
  box.append(el('span', {}, el('b', { testo: nkg(r.media, 2) }), ' kg di media a 7 giorni'));
  if (r.variazione !== null) {
    const su = r.variazione >= 0;
    box.append(el('span.badge' + (su ? '.ok' : '.basso'),
      { testo: `${npiu(r.variazione)} kg/sett` }));
  }
  return box;
}

async function apriPeso(card, riga) {
  const campo = passo({ valore: riga.kg, step: 0.1, min: 30, max: 250, decimali: 1,
                        grande: true, unita: 'kg', etichetta: 'peso di oggi' });
  const bilancia = campiBilancia(riga, { aperto: riga.grassoPerc != null });
  campo.campo.addEventListener('change', () => bilancia.aggiorna(campo.leggi()));
  card.append(el('div.campo-hero', {}, campo), bilancia,
    el('button.cta', { type: 'button', testo: 'Salva', onclick: async () => {
      const kg = campo.leggi();
      if (kg != null) await salvaPeso({ ...riga, kg, ...bilancia.leggi() });
      window.fitforme?.invalida('corpo');
      disegna();
    } }));
}

/* ====================== i pasti ====================== */

async function cardPasti() {
  const settimana = await db.meta('pasti_settimana');
  const card = el('div.scheda.card-pasti', {},
    el('div.scheda-testa', {},
      el('span.scheda-tit', { testo: 'I pasti di oggi' }),
      settimana ? el('span.scheda-val', { testo: 'dalla settimana generata' }) : null));

  if (!settimana?.piano?.length) {
    card.append(
      el('p.scheda-sott', { testo: 'Non hai ancora generato la settimana.' }),
      el('button.ghost.largo', { type: 'button', testo: 'Vai ai pasti',
                                 onclick: () => { location.hash = 'pasti'; } }));
    return card;
  }

  // lunedì = indice 0 nel piano, domenica = 6
  const g = (new Date().getDay() + 6) % 7;
  const { combo, completa } = await import('../pasti/motore.js');
  const { testo } = await import('../pasti/motore.js');
  const oggiPasti = settimana.piano[g] || [];

  oggiPasti.forEach((x, k) => {
    const r = completa(combo(x.ids, x.tipo, true), x.carbId, x.fatId, x.tipo);
    const lato = [];
    if (r.carb) lato.push(testo(...r.carb));
    lato.push(r.fat ? testo(...r.fat) : 'niente olio');
    lato.push('verdura 200 g+');
    card.append(el('div.pasto', {},
      el('div.plab', { testo: k ? 'CENA' : 'PRANZO' }),
      el('div.pbody', {},
        el('div.pmain', { testo: r.items.map(([id, gr]) => testo(id, gr)).join(' + ') }),
        el('div.pside', { testo: lato.join(' · ') }))));
  });

  card.append(el('p.nt', { testo: `${GIORNI[new Date().getDay()]} della settimana generata il ${dataBreve(settimana.generatoIl)}.` }));
  return card;
}

/* ====================== le misure ====================== */

async function cardMisure() {
  const m = await misure();
  const ultima = m[m.length - 1];
  const giorni = ultima ? giorniFra(ultima.data, oggiISO()) : null;
  const scaduta = giorni === null || giorni >= 14;

  const card = el('div.scheda.stretta.card-misure', {},
    el('div.scheda-testa', {},
      el('span.scheda-tit', { testo: 'Circonferenze' }),
      el('span.scheda-val', { testo: ultima ? quando(ultima.data) : 'mai prese' })));

  if (ultima) {
    card.append(el('div.mini-stat', {},
      el('div', {}, el('b', { testo: nkg(ultima.vita) }), el('span', { testo: 'vita' })),
      el('div', {}, el('b', { testo: nkg(ultima.spalle) }), el('span', { testo: 'spalle' })),
      el('div', {}, el('b', { testo: nkg(ultima.vitaSpalle, 3) }), el('span', { testo: 'rapporto' }))));
  }
  card.append(scaduta
    ? el('button.ghost.largo', { type: 'button',
        testo: giorni === null ? 'Prendi le misure' : `Sono passati ${giorni} giorni: rimisurati`,
        onclick: () => { location.hash = 'corpo'; } })
    : el('p.nt', { testo: `Prossima misurazione fra ${14 - giorni} giorni.` }));
  return card;
}
