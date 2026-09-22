/* Esportazione e importazione CSV.

   Il formato è quello che Excel italiano apre con due clic: separatore punto
   e virgola, virgola decimale, fine riga CRLF e BOM in testa — senza il BOM
   Excel mangia gli accenti e «Lunedì» diventa «LunedÃ¬».

   I file ricalcano i fogli del tracker da cui viene lo storico, così sono
   leggibili da chiunque e l'importazione non perde niente. */

import { def, chiaveTenuta, caricoPrincipale, ripTotali, volume, nomeProtocollo,
         INCORPORATI } from './allenamento/protocolli.js';
import { oggiISO } from './ui.js';

const SEP = ';';
const FINE = '\r\n';
const BOM = '﻿';

/* ====================== scrittura ====================== */

const num = v => (v === null || v === undefined || v === '' || Number.isNaN(v))
  ? '' : String(v).replace('.', ',');

function cella(v) {
  if (v === null || v === undefined) return '';
  const t = typeof v === 'number' ? num(v) : String(v);
  return /[;"\r\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
}

export const scriviCSV = (intestazione, righe) =>
  BOM + [intestazione, ...righe].map(r => r.map(cella).join(SEP)).join(FINE) + FINE;

/* ====================== lettura ====================== */

/* Un parser vero, non uno split: i campi fra virgolette possono contenere il
   separatore e persino un a capo (le note). */
export function leggiCSV(testo) {
  const t = testo.replace(/^﻿/, '');
  const righe = [];
  let riga = [], campo = '', virgolette = false;

  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (virgolette) {
      if (c === '"') {
        if (t[i + 1] === '"') { campo += '"'; i++; } else virgolette = false;
      } else campo += c;
      continue;
    }
    if (c === '"') { virgolette = true; continue; }
    if (c === SEP) { riga.push(campo); campo = ''; continue; }
    if (c === '\r') continue;
    if (c === '\n') { riga.push(campo); righe.push(riga); riga = []; campo = ''; continue; }
    campo += c;
  }
  if (campo !== '' || riga.length) { riga.push(campo); righe.push(riga); }
  return righe.filter(r => r.some(x => x.trim() !== ''));
}

const n = v => {
  const t = String(v ?? '').trim().replace(',', '.');
  if (t === '') return null;
  const x = Number(t);
  return Number.isFinite(x) ? x : null;
};
const testoOf = v => String(v ?? '').trim();

/* Date: accetta 2026-09-22, 22/09/2026 e 22-09-2026. */
export function dataDaCSV(v) {
  const t = testoOf(v);
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = t.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}

/* ====================== i sei file ====================== */

export const FILE = {
  forza: 'fitforme_forza.csv',
  isometrie: 'fitforme_isometrie.csv',
  volume: 'fitforme_volume.csv',
  peso: 'fitforme_peso.csv',
  misure: 'fitforme_misure.csv',
  settimana: 'fitforme_settimana.csv',
};

const MAX_SERIE = 6;   // colonne fisse: copre 5x5, 4x8, 6x… senza cambiare formato

/* --- allenamento, forma «serie» con carico unico e drop --- */
function intestazioneForza() {
  const h = ['Data', 'Scheda', 'Esercizio', 'Protocollo', 'Carico kg', 'Drop kg'];
  for (let i = 1; i <= MAX_SERIE; i++) h.push(`S${i} rip`, `S${i} drop`);
  return h.concat(['Rip tot', 'Volume kg', 'Note']);
}
function intestazioneVolume() {
  const h = ['Data', 'Scheda', 'Esercizio', 'Protocollo'];
  for (let i = 1; i <= MAX_SERIE; i++) h.push(`S${i} kg`, `S${i} rip`);
  return h.concat(['Rip tot', 'Volume kg', 'Note']);
}
const MAX_GIRI = 3, MAX_TENUTE = 5;
function intestazioneIso() {
  const h = ['Data', 'Scheda', 'Esercizio', 'Protocollo'];
  for (let g = 1; g <= MAX_GIRI; g++) {
    h.push(`G${g} carico kg`);
    for (let t = 1; t <= MAX_TENUTE; t++) h.push(`G${g} T${t}`);
  }
  return h.concat(['Tenute sec', 'Rip tot', 'Volume kg', 'Note']);
}

export function esporta(dati) {
  const { sedute = [], peso = [], misure = [], settimana = null, catalogo = new Map() } = dati;
  const forza = [], iso = [], vol = [];

  for (const s of sedute) {
    for (const v of s.esercizi || []) {
      const c = def(v);
      const nome = v.nome || catalogo.get(v.esId)?.nome || v.esId;
      const base = [s.data, s.scheda, nome, nomeProtocollo(c)];

      if (c.forma === 'iso') {
        const r = base.slice();
        const chiavi = c.tenute.map((_, k) => chiaveTenuta(c, k));
        for (let g = 0; g < MAX_GIRI; g++) {
          const giro = v.giri?.[g];
          r.push(giro ? giro.carico : '');
          for (let t = 0; t < MAX_TENUTE; t++) r.push(giro ? (giro[chiavi[t]] ?? '') : '');
        }
        r.push(c.tenute.join(' '), ripTotali(v), volume(v), s.note || '');
        iso.push(r);
      } else if (c.caricoUnico) {
        const r = base.concat([v.carico ?? '', v.drop ?? '']);
        for (let i = 0; i < MAX_SERIE; i++) {
          r.push(v.serie?.[i]?.rip ?? '', v.serie?.[i]?.dropRip ?? '');
        }
        r.push(ripTotali(v), volume(v), s.note || '');
        forza.push(r);
      } else {
        const r = base.slice();
        for (let i = 0; i < MAX_SERIE; i++) {
          r.push(v.serie?.[i]?.carico ?? '', v.serie?.[i]?.rip ?? '');
        }
        r.push(ripTotali(v), volume(v), s.note || '');
        vol.push(r);
      }
    }
  }

  const out = {};
  if (forza.length) out[FILE.forza] = scriviCSV(intestazioneForza(), forza);
  if (iso.length) out[FILE.isometrie] = scriviCSV(intestazioneIso(), iso);
  if (vol.length) out[FILE.volume] = scriviCSV(intestazioneVolume(), vol);

  if (peso.length) {
    // le colonne calcolate (media, chili di grasso e di magra) ci sono per
    // comodità di lettura in Excel: all'importazione si ricalcolano e basta
    out[FILE.peso] = scriviCSV(
      ['Data', 'Peso kg', 'Media 7gg', 'Var. sett. kg',
       'Grasso %', 'Massa magra %', 'Acqua %', 'Grasso kg', 'Massa magra kg', 'Note'],
      peso.map(r => [r.data, r.kg, r.media ?? '', r.variazione ?? '',
                     r.grassoPerc ?? '', r.magraPerc ?? '', r.acquaPerc ?? '',
                     r.grassoKg ?? '', r.magraKg ?? '', r.nota || '']));
  }
  if (misure.length) {
    out[FILE.misure] = scriviCSV(
      ['Data', 'Collo', 'Spalle', 'Petto', 'Vita', 'Fianchi', 'Braccio', 'Coscia', 'Polpaccio', 'Vita/Spalle', 'Note'],
      misure.map(m => [m.data, m.collo, m.spalle, m.petto, m.vita, m.fianchi,
                       m.braccio, m.coscia, m.polpaccio, m.vitaSpalle ?? '', m.nota || '']));
  }
  if (settimana?.righe?.length) {
    out[FILE.settimana] = scriviCSV(
      ['Giorno', 'Pasto', 'Alimenti', 'Carboidrato', 'Grasso', 'Proteine g', 'Carboidrati g', 'Grassi g', 'kcal'],
      settimana.righe);
  }
  return out;
}

/* ====================== importazione ====================== */

/* Riconosce il file dall'intestazione, senza fidarsi del nome: i file
   rinominati o riesportati da Excel devono funzionare lo stesso. */
export function riconosci(righe) {
  const h = (righe[0] || []).map(x => testoOf(x).toLowerCase());
  const ha = t => h.some(x => x.includes(t));
  if (ha('peso kg')) return 'peso';
  if (ha('vita/spalle') || (ha('polpaccio') && ha('vita'))) return 'misure';
  if (ha('drop kg')) return 'forza';
  if (ha('g1 carico') || ha('tenute sec')) return 'isometrie';
  if (ha('s1 kg') && ha('esercizio')) return 'volume';
  if (ha('giorno') && ha('pasto')) return 'settimana';
  return null;
}

const indice = (h, nome) => h.findIndex(x => testoOf(x).toLowerCase() === nome.toLowerCase());

export function importaPeso(righe) {
  const h = righe[0];
  const iD = indice(h, 'Data'), iK = indice(h, 'Peso kg'), iN = indice(h, 'Note');
  const iG = indice(h, 'Grasso %'), iM = indice(h, 'Massa magra %'), iA = indice(h, 'Acqua %');
  const out = [], scartate = [];
  righe.slice(1).forEach((r, k) => {
    const data = dataDaCSV(r[iD]), kg = n(r[iK]);
    if (!data || kg === null) { scartate.push(k + 2); return; }
    out.push({
      data, kg,
      grassoPerc: iG >= 0 ? n(r[iG]) : null,
      magraPerc: iM >= 0 ? n(r[iM]) : null,
      acquaPerc: iA >= 0 ? n(r[iA]) : null,
      nota: iN >= 0 ? testoOf(r[iN]) : '',
    });
  });
  return { righe: out, scartate };
}

const COL_MISURE = ['collo', 'spalle', 'petto', 'vita', 'fianchi', 'braccio', 'coscia', 'polpaccio'];

export function importaMisure(righe) {
  const h = righe[0];
  const iD = indice(h, 'Data'), iN = indice(h, 'Note');
  const idx = Object.fromEntries(COL_MISURE.map(c => [c, indice(h, c[0].toUpperCase() + c.slice(1))]));
  const out = [], scartate = [];
  righe.slice(1).forEach((r, k) => {
    const data = dataDaCSV(r[iD]);
    if (!data) { scartate.push(k + 2); return; }
    const m = { data, nota: iN >= 0 ? testoOf(r[iN]) : '' };
    COL_MISURE.forEach(c => { m[c] = idx[c] >= 0 ? n(r[idx[c]]) : null; });
    if (COL_MISURE.every(c => m[c] === null)) { scartate.push(k + 2); return; }
    out.push(m);
  });
  return { righe: out, scartate };
}

/* Le tre tabelle dell'allenamento tornano a essere sedute: una per data e
   scheda, con gli esercizi dentro nell'ordine in cui compaiono. */
export function importaAllenamento(righe, tipo, catalogoPerNome = new Map()) {
  const h = righe[0];
  const iD = indice(h, 'Data'), iS = indice(h, 'Scheda'),
        iE = indice(h, 'Esercizio'), iP = indice(h, 'Protocollo'), iN = indice(h, 'Note');
  const voci = [], scartate = [];

  righe.slice(1).forEach((r, k) => {
    const data = dataDaCSV(r[iD]), nome = testoOf(r[iE]);
    if (!data || !nome) { scartate.push(k + 2); return; }
    const scheda = testoOf(r[iS]) || 'A';
    const nomeProt = testoOf(r[iP]);
    const esId = catalogoPerNome.get(nome.toLowerCase())
      || nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
             .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

    const v = { esId, nome, protocollo: protocolloDaNome(nomeProt, tipo) };
    if (tipo === 'isometrie') {
      const iT = indice(h, 'Tenute sec');
      const tenute = (testoOf(r[iT]) || '20 15 10 5').split(/\s+/).map(Number).filter(Boolean);
      const c = { ...INCORPORATI.iso, tenute, giri: 0 };
      const chiavi = tenute.map((_, j) => chiaveTenuta({ ...c, giri: 1 }, j));
      v.giri = [];
      for (let g = 1; g <= MAX_GIRI; g++) {
        const iC = indice(h, `G${g} carico kg`);
        if (iC < 0) continue;
        const carico = n(r[iC]);
        const vals = tenute.map((_, t) => n(r[indice(h, `G${g} T${t + 1}`)]));
        if (carico === null && vals.every(x => x === null)) continue;
        const giro = { carico };
        chiavi.forEach((ch, t) => { giro[ch] = vals[t]; });
        v.giri.push(giro);
      }
      v.conf = { ...INCORPORATI.iso, tenute, giri: Math.max(1, v.giri.length) };
    } else if (tipo === 'forza') {
      v.carico = n(r[indice(h, 'Carico kg')]);
      v.drop = n(r[indice(h, 'Drop kg')]);
      v.serie = [];
      for (let i = 1; i <= MAX_SERIE; i++) {
        const rip = n(r[indice(h, `S${i} rip`)]);
        const dr = n(r[indice(h, `S${i} drop`)]);
        if (rip === null && dr === null) continue;
        v.serie.push({ rip, dropRip: dr });
      }
      v.conf = { ...INCORPORATI['5x5'], serie: Math.max(1, v.serie.length) };
    } else {
      v.serie = [];
      for (let i = 1; i <= MAX_SERIE; i++) {
        const car = n(r[indice(h, `S${i} kg`)]);
        const rip = n(r[indice(h, `S${i} rip`)]);
        if (car === null && rip === null) continue;
        v.serie.push({ carico: car, rip });
      }
      v.conf = { ...INCORPORATI['3x12'], serie: Math.max(1, v.serie.length) };
    }
    voci.push({ data, scheda, voce: v, nota: iN >= 0 ? testoOf(r[iN]) : '' });
  });

  return { voci, scartate };
}

function protocolloDaNome(nome, tipo) {
  const t = nome.toLowerCase();
  for (const [id, pr] of Object.entries(INCORPORATI)) {
    if (nomeProtocollo(pr).toLowerCase() === t) return id;
  }
  if (t) return 'imp_' + t.replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  return tipo === 'forza' ? '5x5' : tipo === 'isometrie' ? 'iso' : '3x12';
}

/* Raggruppa le voci importate in sedute, una per (data, scheda). */
export function raggruppaSedute(voci) {
  const mappa = new Map();
  for (const { data, scheda, voce, nota } of voci) {
    const chiave = `${data}|${scheda}`;
    if (!mappa.has(chiave)) {
      mappa.set(chiave, {
        id: `sd_${data}_${scheda}`, data, scheda, programmaId: null,
        stato: 'completata', iniziataAlle: null, finitaAlle: null,
        esercizi: [], note: nota || 'Importata da CSV',
      });
    }
    mappa.get(chiave).esercizi.push(voce);
  }
  return [...mappa.values()].sort((a, b) => a.data.localeCompare(b.data));
}

/* ====================== salvataggio del file ====================== */

export function scarica(nome, contenuto) {
  const blob = new Blob([contenuto], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nome;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/* Su Android la condivisione di sistema è più comoda di sei scaricamenti:
   mandi tutto in una volta a Drive, a te stesso per email, dove vuoi. */
export async function condividi(file) {
  if (!navigator.canShare) return false;
  const elenco = Object.entries(file).map(([nome, testo]) =>
    new File([testo], nome, { type: 'text/csv' }));
  if (!navigator.canShare({ files: elenco })) return false;
  try {
    await navigator.share({ files: elenco, title: 'FitForMe — dati del ' + oggiISO() });
    return true;
  } catch (e) {
    return e.name === 'AbortError' ? 'annullato' : false;
  }
}
