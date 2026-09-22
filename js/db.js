/* Accesso a IndexedDB. Nient'altro nell'app parla direttamente col database:
   qui ci sono l'apertura, le migrazioni e i quattro verbi (leggi, scrivi,
   elenca, elimina) su cui è costruito store.js. */

const NOME = 'fitforme';
const VERSIONE = 1;

export const STORE = {
  meta: 'meta',            // chiave/valore: preferenze e stato dell'app
  esercizi: 'esercizi',    // catalogo stabile, sopravvive al cambio scheda
  programmi: 'programmi',  // le schede, versionate e datate
  sedute: 'sedute',        // cosa hai fatto davvero
  peso: 'peso',
  misure: 'misure',
};

let connessione = null;

function migra(db, daVersione) {
  if (daVersione < 1) {
    db.createObjectStore(STORE.meta, { keyPath: 'k' });
    db.createObjectStore(STORE.esercizi, { keyPath: 'id' });
    db.createObjectStore(STORE.programmi, { keyPath: 'id' });

    const sedute = db.createObjectStore(STORE.sedute, { keyPath: 'id' });
    sedute.createIndex('data', 'data');
    sedute.createIndex('scheda', 'scheda');
    sedute.createIndex('stato', 'stato');

    db.createObjectStore(STORE.peso, { keyPath: 'data' });
    db.createObjectStore(STORE.misure, { keyPath: 'data' });
  }
  // Le versioni successive si aggiungono qui, senza toccare quelle sopra:
  // if (daVersione < 2) { ... }
}

export function apri() {
  if (connessione) return connessione;
  connessione = new Promise((risolvi, rifiuta) => {
    const req = indexedDB.open(NOME, VERSIONE);
    req.onupgradeneeded = e => migra(req.result, e.oldVersion);
    req.onsuccess = () => {
      req.result.onversionchange = () => req.result.close();
      risolvi(req.result);
    };
    req.onerror = () => rifiuta(req.error);
    req.onblocked = () => rifiuta(new Error(
      'Il database è aperto in un\'altra scheda: chiudila e ricarica.'));
  });
  return connessione;
}

/* Esegue un blocco dentro una transazione e risolve quando è committata.
   `azione` riceve l'object store (o l'array di store, se ne chiedi più d'uno). */
export async function tx(nomi, modo, azione) {
  const db = await apri();
  const lista = Array.isArray(nomi) ? nomi : [nomi];
  return new Promise((risolvi, rifiuta) => {
    const t = db.transaction(lista, modo);
    let esito;
    t.oncomplete = () => risolvi(esito);
    t.onerror = () => rifiuta(t.error);
    t.onabort = () => rifiuta(t.error || new Error('Transazione annullata'));
    const store = Array.isArray(nomi) ? lista.map(n => t.objectStore(n)) : t.objectStore(lista[0]);
    Promise.resolve(azione(store, t)).then(v => { esito = v; }, e => { rifiuta(e); t.abort(); });
  });
}

const attendi = req => new Promise((risolvi, rifiuta) => {
  req.onsuccess = () => risolvi(req.result);
  req.onerror = () => rifiuta(req.error);
});

export const leggi = (store, chiave) =>
  tx(store, 'readonly', s => attendi(s.get(chiave)));

export const elenca = (store, intervallo) =>
  tx(store, 'readonly', s => attendi(s.getAll(intervallo)));

export const elencaPerIndice = (store, indice, intervallo) =>
  tx(store, 'readonly', s => attendi(s.index(indice).getAll(intervallo)));

export const scrivi = (store, valore) =>
  tx(store, 'readwrite', s => attendi(s.put(valore)));

export const scriviTutti = (store, valori) =>
  tx(store, 'readwrite', s => Promise.all(valori.map(v => attendi(s.put(v)))));

export const elimina = (store, chiave) =>
  tx(store, 'readwrite', s => attendi(s.delete(chiave)));

export const svuota = (store) =>
  tx(store, 'readwrite', s => attendi(s.clear()));

/* --- meta: coppie chiave/valore, con valore di ripiego --- */
export async function meta(chiave, ripiego = null) {
  const riga = await leggi(STORE.meta, chiave);
  return riga === undefined ? ripiego : riga.v;
}
export const salvaMeta = (chiave, v) => scrivi(STORE.meta, { k: chiave, v });

/* Cancella tutto e riporta il database allo stato di primo avvio.
   Usato dall'importazione «sostituisci» e dal ripristino manuale. */
export async function azzera() {
  await Promise.all(Object.values(STORE).map(svuota));
}
