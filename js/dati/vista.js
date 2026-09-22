/* DATI — esportazione, importazione, preferenze.

   L'esportazione produce sei CSV che Excel italiano apre con due clic.
   L'importazione li rilegge: riconosce il file dall'intestazione, mostra
   un'anteprima di cosa entrerebbe e chiede conferma prima di scrivere. */

import { el, $$, nkg, oggiISO, dataBreve, dataLunga } from '../ui.js';
import { icona } from '../icone.js';
import { passo } from '../componenti.js';
import * as csv from '../csv.js';
import { db, STORE, sedute, salvaSeduta, pesate, conMediaMobile, salvaPeso,
         misure, salvaMisura, catalogo, prefs, salvaPrefs } from '../store.js';

let radice = null;

/* Chrome manda questo evento quando l'app è installabile: lo teniamo da parte
   per poter offrire il pulsante «Installa adesso». */
let differita = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); differita = e; });

export async function monta(pannello) {
  radice = pannello;
  await disegna();
}

async function disegna() {
  const p = await prefs();
  radice.replaceChildren(
    await cardEsporta(),
    cardImporta(),
    cardPreferenze(p),
    cardInstalla(),
    await cardDatabase());
}

/* ====================== esportazione ====================== */

async function raccogli() {
  const cat = await catalogo();
  const tutte = (await sedute()).filter(s => s.stato === 'completata');
  const pes = conMediaMobile(await pesate());
  const mis = await misure();

  // la settimana salvata, calcolata riga per riga
  let settimana = null;
  const salvata = await db.meta('pasti_settimana');
  if (salvata?.piano?.length) {
    const { combo, completa, testo } = await import('../pasti/motore.js');
    const { GIORNI } = await import('../pasti/dati.js');
    const righe = [];
    salvata.piano.forEach((giorno, g) => {
      giorno.forEach((x, k) => {
        const r = completa(combo(x.ids, x.tipo, true), x.carbId, x.fatId, x.tipo);
        righe.push([
          GIORNI[g], k ? 'Cena' : 'Pranzo',
          r.items.map(([id, gr]) => testo(id, gr)).join(' + '),
          r.carb ? testo(...r.carb) : '', r.fat ? testo(...r.fat) : '',
          Math.round(r.P), Math.round(r.C), Math.round(r.F), Math.round(r.kcal / 10) * 10,
        ]);
      });
    });
    settimana = { righe };
  }

  return csv.esporta({ sedute: tutte, peso: pes, misure: mis, settimana, catalogo: cat });
}

async function cardEsporta() {
  const card = el('div.scheda', {},
    el('div.scheda-testa', {},
      el('span.scheda-tit', { testo: 'Esporta tutto' }),
      el('span.scheda-val', { testo: 'CSV per Excel italiano' })));

  const elenco = el('div.elenco-file');
  const file = await raccogli();
  const nomi = Object.keys(file);

  nomi.forEach(nome => {
    const righe = file[nome].split('\r\n').filter(Boolean).length - 1;
    elenco.append(el('button.riga-file', { type: 'button', onclick: () => csv.scarica(nome, file[nome]) },
      el('span.f-nome', { testo: nome.replace('fitforme_', '').replace('.csv', '') }),
      el('span.f-righe', { testo: `${righe} righe` }),
      icona('dati', { dimensione: 18 })));
  });

  card.append(
    el('p.scheda-sott', { testo: 'Separatore punto e virgola, virgola decimale, con il segno di codifica in testa: ' +
                                 'Excel italiano li apre senza chiedere niente e senza mangiarsi gli accenti.' }),
    nomi.length ? elenco : el('p.vuoto', { testo: 'Non c\'è ancora niente da esportare.' }));

  if (nomi.length) {
    const btn = el('button.cta', { type: 'button', onclick: async () => {
      const esito = await csv.condividi(file);
      if (esito === true || esito === 'annullato') return;
      nomi.forEach((nome, i) => setTimeout(() => csv.scarica(nome, file[nome]), i * 350));
    } }, icona('dati', { dimensione: 22 }), `Esporta tutti e ${nomi.length}`);
    card.append(btn,
      el('p.nt', { testo: 'Dal telefono si apre la condivisione di sistema: puoi mandarli su Drive ' +
                          'o a te stesso per email in una volta sola.' }));
  }
  return card;
}

/* ====================== importazione ====================== */

function cardImporta() {
  const input = el('input', { type: 'file', accept: '.csv,text/csv', multiple: true,
                              class: 'file-nascosto', 'aria-label': 'Scegli i file CSV',
                              onchange: e => leggiFile([...e.target.files]) });
  const esito = el('div.esito-import');

  const card = el('div.scheda', {},
    el('div.scheda-testa', {},
      el('span.scheda-tit', { testo: 'Importa da CSV' }),
      el('span.scheda-val', { testo: 'per il ripristino' })),
    el('p.scheda-sott', { testo: 'Riconosco il file dall\'intestazione, non dal nome: puoi rinominarli ' +
                                 'o riesportarli da Excel. Prima ti mostro cosa entrerebbe, poi decidi tu.' }),
    input,
    el('button.cta', { type: 'button', testo: 'Scegli i file', onclick: () => input.click() }),
    esito);

  async function leggiFile(file) {
    esito.replaceChildren(el('p.nt', { testo: 'Leggo…' }));
    const piani = [];
    for (const f of file) {
      const righe = csv.leggiCSV(await f.text());
      const tipo = csv.riconosci(righe);
      if (!tipo) { piani.push({ nome: f.name, errore: 'intestazione non riconosciuta' }); continue; }
      piani.push({ nome: f.name, tipo, righe });
    }
    await anteprima(piani, esito);
  }
  return card;
}

async function anteprima(piani, dove) {
  dove.replaceChildren();

  const pesoAttuale = new Map((await pesate()).map(r => [r.data, r]));
  const misureAttuali = new Map((await misure()).map(m => [m.data, m]));
  const seduteAttuali = new Map((await sedute()).map(s => [s.id, s]));
  const cat = await catalogo();
  const perNome = new Map([...cat.values()].map(e => [e.nome.toLowerCase(), e.id]));

  const daScrivere = [];
  // I tre file dell'allenamento descrivono la STESSA seduta da tre angoli
  // diversi: forza, isometrie e volume di un dato giorno stanno tutti nella
  // seduta di quel giorno. Vanno quindi raccolti tutti insieme e raggruppati
  // una volta sola — scriverli file per file significherebbe sovrascrivere
  // tre volte lo stesso identificativo e tenere solo l'ultimo.
  let vociAllenamento = [];
  let fileAllenamento = 0, scartateAllenamento = 0;

  for (const p of piani) {
    if (p.errore) {
      dove.append(el('div.riga-import.ko', {},
        el('span.f-nome', { testo: p.nome }), el('span.f-righe', { testo: p.errore })));
      continue;
    }
    if (p.tipo === 'settimana') {
      dove.append(el('div.riga-import.ko', {},
        el('span.f-nome', { testo: p.nome }),
        el('span.f-righe', { testo: 'la settimana si rigenera dai pasti, non si importa' })));
      continue;
    }

    if (p.tipo === 'peso' || p.tipo === 'misure') {
      const r = p.tipo === 'peso' ? csv.importaPeso(p.righe) : csv.importaMisure(p.righe);
      const attuali = p.tipo === 'peso' ? pesoAttuale : misureAttuali;
      let nuovi = 0, esistenti = 0;
      r.righe.forEach(x => attuali.has(x.data) ? esistenti++ : nuovi++);
      daScrivere.push({ tipo: p.tipo, righe: r.righe });
      dove.append(riga(p.nome, nuovi, esistenti, r.scartate.length,
                       p.tipo === 'peso' ? 'pesate' : 'misurazioni'));
      continue;
    }

    const r = csv.importaAllenamento(p.righe, p.tipo, perNome);
    vociAllenamento = vociAllenamento.concat(r.voci);
    scartateAllenamento += r.scartate.length;
    fileAllenamento++;
    dove.append(riga(p.nome, r.voci.length, 0, r.scartate.length, 'esercizi'));
  }

  if (vociAllenamento.length) {
    const sed = csv.raggruppaSedute(vociAllenamento).map(s => unisci(s, seduteAttuali.get(s.id)));
    const nuovi = sed.filter(s => !seduteAttuali.has(s.id)).length;
    daScrivere.push({ tipo: 'sedute', righe: sed });
    dove.append(el('div.riga-import.somma', {},
      el('span.f-nome', { testo: `${fileAllenamento} file di allenamento` }),
      el('span.f-righe', { testo: `${sed.length} sedute in tutto · ${nuovi} nuove, ${sed.length - nuovi} da aggiornare` }),
      el('span.f-tipo', { testo: 'unite per giorno' })));
  }

  if (!daScrivere.length) return;

  dove.append(
    el('p.nt', { testo: 'Stessa data, stesso record: quello che c\'è già viene aggiornato, ' +
                        'non duplicato. Gli esercizi di una seduta si sommano invece di sostituirsi.' }),
    el('div.azioni', {},
      el('button.cta', { type: 'button', testo: 'Importa', onclick: async () => {
        let scritte = 0;
        for (const blocco of daScrivere) {
          for (const r of blocco.righe) {
            if (blocco.tipo === 'peso') await salvaPeso(r);
            else if (blocco.tipo === 'misure') await salvaMisura(r);
            else await salvaSeduta(r);
            scritte++;
          }
        }
        dove.replaceChildren(el('div.riga-import.ok', {},
          el('span.f-nome', { testo: 'Fatto' }),
          el('span.f-righe', { testo: `${scritte} record importati` })));
        window.fitforme?.invalida('oggi', 'corpo', 'allenamento');
        try { navigator.vibrate?.(25); } catch {}
      } }),
      el('button.ghost', { type: 'button', testo: 'Annulla', onclick: () => dove.replaceChildren() })));
}

const riga = (nome, nuovi, esistenti, scartate, cosa) => el('div.riga-import', {},
  el('span.f-nome', { testo: nome }),
  el('span.f-righe', { testo: `${nuovi} nuove` + (esistenti ? `, ${esistenti} già presenti` : '') +
                              (scartate ? ` · ${scartate} righe saltate` : '') }),
  el('span.f-tipo', { testo: cosa }));

/* Fonde la seduta importata con quella già nel database: gli esercizi si
   sommano, e quelli con lo stesso esercizio e protocollo vengono sostituiti
   dalla versione importata. Reimportare un backup non deve mai far sparire
   quello che nel frattempo hai registrato dall'app. */
function unisci(importata, esistente) {
  if (!esistente) return importata;
  const chiave = v => `${v.esId}|${v.protocollo}`;
  const nuovi = new Map(importata.esercizi.map(v => [chiave(v), v]));
  const uniti = esistente.esercizi.map(v => nuovi.get(chiave(v)) || v);
  const gia = new Set(esistente.esercizi.map(chiave));
  importata.esercizi.forEach(v => { if (!gia.has(chiave(v))) uniti.push(v); });
  return { ...esistente, esercizi: uniti };
}

/* ====================== preferenze ====================== */

function cardPreferenze(p) {
  const interruttore = (chiave, etichetta, spiegazione) => {
    const inp = el('input', { type: 'checkbox', checked: p[chiave], 'aria-label': etichetta,
      onchange: async e => { await salvaPrefs({ [chiave]: e.target.checked }); } });
    return el('label.riga-pref', {},
      el('span.pref-testo', {},
        el('b', { testo: etichetta }),
        el('small', { testo: spiegazione })),
      inp);
  };

  return el('div.scheda', {},
    el('div.scheda-testa', {}, el('span.scheda-tit', { testo: 'Preferenze' })),
    el('label.campo', {},
      el('span', { testo: 'Tema' }),
      el('select.selettore', { 'aria-label': 'Tema',
        onchange: async e => { await salvaPrefs({ tema: e.target.value });
                               dispatchEvent(new Event('fitforme:tema')); } },
        ...[['scuro', 'Scuro'], ['chiaro', 'Chiaro'], ['auto', 'Come il telefono']].map(([v, t]) =>
          el('option', { value: v, selected: p.tema === v, testo: t })))),
    interruttore('vibrazione', 'Vibrazione', 'a fine recupero e a ogni tocco su «Fatto»'),
    interruttore('suono', 'Suono', 'tre bip quando finisce il recupero'),
    interruttore('wakeLock', 'Schermo sempre acceso', 'durante la seduta in palestra'),
    interruttore('arrotondaDrop', 'Arrotonda il drop', 'al gradino dell\'attrezzo invece che al decimo di chilo'),
    el('label.campo', {},
      el('span', { testo: 'Seduta lunga oltre' }),
      passo({ valore: p.durataMax, step: 5, min: 30, max: 180, decimali: 0, unita: 'min',
              etichetta: 'durata massima della seduta',
              onCambio: async n => { await salvaPrefs({ durataMax: n ?? 90 }); } })),
    el('p.nt', { testo: 'Oltre questa durata il cronometro in palestra diventa ocra.' }));
}

/* ====================== installazione ====================== */

/* Su Android l'installazione vera si fa dal menu di Chrome. Il prompt
   automatico si può intercettare, ma arriva quando vuole lui: le istruzioni
   scritte funzionano sempre, il prompt è un di più. */
function cardInstalla() {
  const installata = matchMedia('(display-mode: standalone)').matches ||
                     navigator.standalone === true;

  const card = el('div.scheda', {},
    el('div.scheda-testa', {},
      el('span.scheda-tit', { testo: 'Installazione' }),
      el('span.scheda-val', { testo: installata ? 'già installata' : 'dal browser' })));

  if (installata) {
    card.append(el('p.scheda-sott', {
      testo: 'Stai usando l\'app installata: parte a tutto schermo e funziona senza rete.' }));
    return card;
  }

  const passi = [
    ['Apri il menu di Chrome', 'i tre puntini in alto a destra'],
    ['Tocca «Installa app»', 'oppure «Aggiungi a schermata Home»'],
    ['Conferma', 'l\'icona compare fra le altre app'],
  ];
  card.append(
    el('p.scheda-sott', { testo: 'Installandola sparisce la barra del browser, parte a tutto schermo ' +
                                 'e resta disponibile anche senza rete.' }),
    el('ol.passi-installa', {}, ...passi.map(([t, d]) =>
      el('li', {}, el('b', { testo: t }), el('small', { testo: d })))));

  if (differita) {
    card.append(el('button.cta', { type: 'button', testo: 'Installa adesso', onclick: async () => {
      differita.prompt();
      await differita.userChoice;
      differita = null;
      disegna();
    } }));
  }
  card.append(el('p.nt', { testo: 'Tieni premuta l\'icona per le scorciatoie: «In palestra» e «Peso di oggi».' }));
  return card;
}

/* ====================== stato del database ====================== */

async function cardDatabase() {
  const conteggi = {};
  for (const [nome, store] of Object.entries(STORE)) {
    conteggi[nome] = (await db.elenca(store)).length;
  }
  const seed = await db.meta('seed_iniziale');

  return el('div.scheda', {},
    el('div.scheda-testa', {},
      el('span.scheda-tit', { testo: 'Database' }),
      el('span.scheda-val', { testo: 'IndexedDB · fitforme' })),
    ...Object.entries(conteggi).map(([nome, n]) => el('div.voce', {},
      el('span.n', { testo: nome }), el('span.leader'), el('span.q', { testo: String(n) }))),
    seed ? el('p.nt', { testo: `Storico importato da ${seed.da} il ${dataBreve(seed.il)}.` }) : null,
    el('p.nt', { testo: 'Tutto vive solo su questo telefono: nessun server, nessun account. ' +
                        'Se cambi telefono, il ponte è l\'esportazione CSV qui sopra.' }));
}
