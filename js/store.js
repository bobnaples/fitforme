/* Il livello di dominio: qui stanno le domande che l'app fa ai dati
   («qual è la scheda attiva?», «quanto avevo caricato l'ultima volta?»),
   scritte una volta sola e riusate dai moduli. */

import * as db from './db.js';
import { STORE } from './db.js';
import { oggiISO, sommaGiorni, giorniFra } from './ui.js';

/* ============ primo avvio ============ */

const CHIAVE_SEED = 'seed_iniziale';

export async function primoAvvio() {
  if (await db.meta(CHIAVE_SEED)) return false;
  const { ESERCIZI, PROGRAMMA, SEDUTE, PESO, MISURE } = await import('./seed.js');
  await db.scriviTutti(STORE.esercizi, ESERCIZI);
  await db.scrivi(STORE.programmi, PROGRAMMA);
  await db.scriviTutti(STORE.sedute, SEDUTE);
  await db.scriviTutti(STORE.peso, PESO);
  await db.scriviTutti(STORE.misure, MISURE);
  await db.salvaMeta(CHIAVE_SEED, { il: oggiISO(), da: 'Tracker_Scheda_PT_scheda_9.xlsx' });
  return true;
}

/* ============ catalogo e schede ============ */

export async function catalogo() {
  const lista = await db.elenca(STORE.esercizi);
  return new Map(lista.map(e => [e.id, e]));
}

export const esercizio = id => db.leggi(STORE.esercizi, id);
export const salvaEsercizio = e => db.scrivi(STORE.esercizi, e);

export async function programmi() {
  const lista = await db.elenca(STORE.programmi);
  return lista.sort((a, b) => b.dal.localeCompare(a.dal));
}

export async function programmaAttivo() {
  const lista = await programmi();
  return lista.find(p => p.attivo) || lista[0] || null;
}

export const salvaProgramma = p => db.scrivi(STORE.programmi, p);

/* Le voci di una seduta (A, B o C) della scheda attiva, già ordinate e
   unite ai dati di catalogo. È la lista che vedi in palestra. */
export async function vociScheda(scheda, programma = null) {
  const p = programma || await programmaAttivo();
  if (!p) return [];
  const cat = await catalogo();
  return p.voci
    .filter(v => v.scheda === scheda)
    .sort((a, b) => a.ordine - b.ordine)
    .map(v => ({ ...v, esercizio: cat.get(v.esId) || { id: v.esId, nome: v.esId, incremento: 2.5 } }));
}

export async function schedeDelProgramma(programma = null) {
  const p = programma || await programmaAttivo();
  return p ? [...new Set(p.voci.map(v => v.scheda))].sort() : [];
}

/* ============ sedute ============ */

export async function sedute({ scheda = null, dal = null, al = null } = {}) {
  const lista = dal || al
    ? await db.elencaPerIndice(STORE.sedute, 'data',
        IDBKeyRange.bound(dal || '0000-00-00', al || '9999-99-99'))
    : await db.elenca(STORE.sedute);
  return lista
    .filter(s => !scheda || s.scheda === scheda)
    .sort((a, b) => a.data.localeCompare(b.data) || a.id.localeCompare(b.id));
}

export const salvaSeduta = s => db.scrivi(STORE.sedute, s);
export const leggiSeduta = id => db.leggi(STORE.sedute, id);
export const eliminaSeduta = id => db.elimina(STORE.sedute, id);

/* La seduta lasciata a metà, se c'è. Ha la precedenza su tutto all'avvio. */
export async function sedutaAperta() {
  const aperte = await db.elencaPerIndice(STORE.sedute, 'stato', IDBKeyRange.only('in_corso'));
  return aperte.sort((a, b) => (b.iniziataAlle || 0) - (a.iniziataAlle || 0))[0] || null;
}

export async function ultimaCompletata() {
  const lista = await sedute();
  return lista.filter(s => s.stato === 'completata').pop() || null;
}

/* ============ storico per esercizio ============ */

/* Tutte le volte che hai fatto questo esercizio con questo protocollo,
   in ordine di data, attraverso TUTTI i programmi: è quello che rende
   continuo il grafico quando cambia la scheda. */
export async function storico(esId, protocollo = null) {
  const lista = await sedute();
  const out = [];
  for (const s of lista) {
    if (s.stato !== 'completata') continue;
    for (const v of s.esercizi || []) {
      if (v.esId !== esId) continue;
      if (protocollo && v.protocollo !== protocollo) continue;
      out.push({ data: s.data, sedutaId: s.id, scheda: s.scheda, ...v });
    }
  }
  return out;
}

/* L'ultima volta con lo stesso protocollo: è la riga con cui la modalità
   palestra precompila carichi e ripetizioni. Cercare anche il protocollo,
   e non solo l'esercizio, evita di proporre 80 kg di 5x5 dentro un 3x12. */
export async function ultimaVolta(esId, protocollo) {
  const h = await storico(esId, protocollo);
  return h.length ? h[h.length - 1] : null;
}

/* ============ peso ============ */

export const salvaPeso = r => db.scrivi(STORE.peso, r);
export const eliminaPeso = data => db.elimina(STORE.peso, data);

export async function pesate() {
  const lista = await db.elenca(STORE.peso);
  return lista.sort((a, b) => a.data.localeCompare(b.data));
}

/* Composizione corporea a partire da quello che dice la bilancia.
   Le percentuali si salvano come numeri percentuali (16,5 = 16,5 %).
   La massa magra: se la bilancia la dà, si usa quella; se dà solo il grasso,
   è quello che resta. Sono due cose diverse e vale la pena distinguerle. */
export function composizione(r) {
  const grassoKg = r.grassoPerc != null ? r.kg * r.grassoPerc / 100 : null;
  const magraKg = r.magraPerc != null ? r.kg * r.magraPerc / 100
                : grassoKg !== null ? r.kg - grassoKg : null;
  const arr = v => v === null ? null : Math.round(v * 10) / 10;
  return {
    grassoKg: arr(grassoKg),
    magraKg: arr(magraKg),
    magraPercCalcolata: r.magraPerc != null ? r.magraPerc
                      : r.grassoPerc != null ? Math.round((100 - r.grassoPerc) * 10) / 10 : null,
  };
}

/* Media mobile su una qualunque grandezza della pesata, sui 7 giorni di
   calendario che finiscono in quel giorno. Le bilance a impedenza sono
   rumorose quanto e più della bilancia normale: sul grasso e sulla massa
   magra la media conta anche di più che sul peso. */
function mediaSu(lista, r, valore) {
  const finestra = lista.filter(x => x.data <= r.data && giorniFra(x.data, r.data) < 7)
                        .map(valore).filter(v => v !== null && v !== undefined);
  if (!finestra.length) return null;
  return finestra.reduce((s, v) => s + v, 0) / finestra.length;
}

/* Aggiunge a ogni pesata la media dei 7 giorni di calendario che finiscono
   quel giorno, e la variazione rispetto alla media di 7 giorni prima.
   La media è l'unico numero che vale la pena guardare: il peso del singolo
   giorno oscilla di un chilo per l'acqua e per cosa hai mangiato ieri. */
export function conMediaMobile(lista) {
  const conComp = lista.map(r => ({ ...r, ...composizione(r) }));
  return conComp.map(r => {
    const finestra = conComp.filter(x => x.data <= r.data && giorniFra(x.data, r.data) < 7);
    const media = finestra.reduce((s, x) => s + x.kg, 0) / finestra.length;
    const primaISO = sommaGiorni(r.data, -7);
    const prima = conComp.filter(x => x.data <= primaISO && giorniFra(x.data, primaISO) < 7);
    const mediaPrima = prima.length ? prima.reduce((s, x) => s + x.kg, 0) / prima.length : null;
    const arr2 = v => v === null ? null : Math.round(v * 100) / 100;
    return {
      ...r,
      media: Math.round(media * 100) / 100,
      campioni: finestra.length,
      variazione: mediaPrima === null ? null : Math.round((media - mediaPrima) * 100) / 100,
      mediaGrassoKg: arr2(mediaSu(conComp, r, x => x.grassoKg)),
      mediaMagraKg: arr2(mediaSu(conComp, r, x => x.magraKg)),
      mediaGrassoPerc: arr2(mediaSu(conComp, r, x => x.grassoPerc ?? null)),
    };
  });
}

/* ============ misure ============ */

export const salvaMisura = m => db.scrivi(STORE.misure, m);
export const eliminaMisura = data => db.elimina(STORE.misure, data);

export async function misure() {
  const lista = await db.elenca(STORE.misure);
  return lista
    .sort((a, b) => a.data.localeCompare(b.data))
    .map(m => ({ ...m, vitaSpalle: m.vita && m.spalle ? Math.round(m.vita / m.spalle * 1000) / 1000 : null }));
}

/* ============ protocolli ============ */

/* I tre di partenza stanno nel codice; quelli che crei dall'editor vivono
   qui, e i due insiemi si vedono insieme. */
export async function protocolli() {
  const { INCORPORATI } = await import('./allenamento/protocolli.js');
  const miei = await db.meta('protocolli', {});
  return { ...INCORPORATI, ...miei };
}
export async function salvaProtocollo(pr) {
  const miei = await db.meta('protocolli', {});
  miei[pr.id] = pr;
  await db.salvaMeta('protocolli', miei);
  return pr;
}
export async function eliminaProtocollo(id) {
  const miei = await db.meta('protocolli', {});
  delete miei[id];
  await db.salvaMeta('protocolli', miei);
}

/* ============ preferenze ============ */

const PREFS_DEFAULT = {
  tema: 'scuro',           // 'scuro' (predefinito) | 'chiaro' | 'auto'
  vibrazione: true,
  suono: true,
  wakeLock: true,
  arrotondaDrop: true,     // drop -20% arrotondato al gradino dell'attrezzo
  recuperoEsercizi: 120,   // secondi fra un esercizio e il successivo (0 = nessuno)
  durataMax: 90,           // minuti oltre i quali la seduta si sta allungando
};

export async function prefs() {
  return { ...PREFS_DEFAULT, ...(await db.meta('prefs', {})) };
}
export async function salvaPrefs(parziale) {
  const p = { ...(await prefs()), ...parziale };
  await db.salvaMeta('prefs', p);
  return p;
}

export { db, STORE };
