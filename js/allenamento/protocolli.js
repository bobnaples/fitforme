/* I protocolli e le regole di progressione.

   Un protocollo ha due parti:
   · la FORMA dei dati — 'serie' (N serie di ripetizioni, con o senza drop)
     oppure 'iso' (tenute isometriche a giri). Le forme sono due e stanno qui,
     nel codice, perché cambiano la struttura di quello che salvi.
   · i PARAMETRI — quante serie, quante ripetizioni, quanto drop, quando
     aumentare. Questi sono dati: si configurano dall'editor delle schede,
     e un 4x8 o un 5x3 non richiedono una riga di codice.

   Tutto qui dentro è funzione pura: nessun DOM, nessun database. La schermata
   di inserimento e la modalità palestra chiamano queste, così il calcolo del
   drop e la decisione «aumento o no» sono per forza gli stessi. */

/* ============ i tre protocolli di partenza ============ */

export const INCORPORATI = {
  '5x5': {
    id: '5x5', nome: '5x5 + drop', forma: 'serie',
    serie: 5, ripObiettivo: 5,
    caricoUnico: true,          // un solo carico per tutto l'esercizio
    drop: 20,                   // percentuale di scarico, a cedimento dopo ogni serie
    ripDopoAumento: null,       // dopo l'aumento si riparte dallo stesso obiettivo
    seriePerScendere: 2,        // quante serie sotto obiettivo fanno tornare indietro
    recupero: 180,
  },
  iso: {
    id: 'iso', nome: 'Isometrie', forma: 'iso',
    giri: 2,
    tenute: [20, 15, 10, 5],    // secondi di tenuta, in ordine
    ripPerTenuta: 8,            // ripetizioni dopo ogni tenuta
    ultimaAlMassimo: true,      // l'ultima non ha un obiettivo: si va al massimo
    massimoFinale: 10,          // soglia del massimo finale per aumentare
    recupero: 120,
  },
  '3x12': {
    id: '3x12', nome: '3x12', forma: 'serie',
    serie: 3, ripObiettivo: 12,
    caricoUnico: false,         // il carico si segna serie per serie
    drop: null,
    ripDopoAumento: 10,         // dopo l'aumento si riparte da 10
    seriePerScendere: 0,        // niente regola di rientro
    recupero: 90,
  },
};

/* La definizione effettiva di una voce o di una riga di seduta.
   L'ordine conta: se la riga porta con sé la sua configurazione si usa quella,
   così una seduta di sei mesi fa resta leggibile anche se nel frattempo hai
   cambiato i parametri del protocollo. */
export function def(x) {
  if (!x) return INCORPORATI['3x12'];
  if (x.forma) return x;                       // è già una definizione
  return x.conf || INCORPORATI[x.protocollo] || INCORPORATI['3x12'];
}

/* Compatibilità con il codice che indicizzava per nome. */
export const PROTOCOLLI = new Proxy(INCORPORATI, {
  get: (t, k) => (typeof k === 'string' && t[k])
    ? { ...t[k], sommario: descrizione(t[k]), regola: regolaTesto(t[k]) }
    : t[k],
});

export function descrizione(c) {
  c = def(c);
  if (c.forma === 'iso') {
    const t = c.tenute.map((s, i) => `${s}″+${i === c.tenute.length - 1 && c.ultimaAlMassimo ? 'max' : c.ripPerTenuta}`);
    return `${t.join(' · ')}, per ${c.giri} giri`;
  }
  const base = `${c.serie} serie da ${c.ripObiettivo}`;
  return c.drop ? `${base}, dopo ogni serie un drop al −${c.drop} % a cedimento` : base;
}

export function regolaTesto(c) {
  c = def(c);
  if (c.forma === 'iso') {
    const r = c.ripPerTenuta;
    const quante = c.tenute.length - (c.ultimaAlMassimo ? 1 : 0);
    return `${Array(quante).fill(r).join('/')} in tutti e ${c.giri} i giri e massimo finale ≥ ${c.massimoFinale} → aumenti`;
  }
  return `${c.ripObiettivo} ripetizioni su tutte e ${c.serie} le serie → aumenti` +
         (c.ripDopoAumento ? ` e riparti da ${c.ripDopoAumento}` : '');
}

/* Nome da mostrare: quello scritto se c'è, altrimenti costruito dai numeri. */
export function nomeProtocollo(c) {
  c = def(c);
  if (c.nome) return c.nome;
  if (c.forma === 'iso') return `Isometrie ${c.giri} giri`;
  return `${c.serie}x${c.ripObiettivo}` + (c.drop ? ' + drop' : '');
}

/* ============ carichi e gradini ============ */

export const GRADINO = { macchina: 5, cavi: 2.5, manubri: 2.5, bilanciere: 2.5 };
export const gradino = es => es?.incremento || GRADINO[es?.attrezzo] || 2.5;

export const arrotonda = (kg, passo) => Math.round(kg / passo) * passo;

/* Il drop è lo scarico percentuale del protocollo. Nel tracker era arrotondato
   a mano e in modo incoerente (45 → 36 su un esercizio, 45 → 40 su un altro):
   qui lo porto al gradino dell'attrezzo, che è l'unico valore che puoi davvero
   mettere sulla macchina, restando sempre correggibile. */
export function calcolaDrop(carico, esercizio, arrotondaAttivo = true, perc = 20) {
  if (!carico || !perc) return null;
  const grezzo = carico * (1 - perc / 100);
  if (!arrotondaAttivo) return Math.round(grezzo * 10) / 10;
  const g = gradino(esercizio);
  return Math.max(g, arrotonda(grezzo, g));
}

/* ============ la riga di un esercizio, precompilata ============ */

/* Il verdetto si ricalcola sempre dai numeri invece di leggere quello salvato:
   le sedute importate dal tracker non ne hanno uno, e dopo aver cambiato
   l'incremento di un esercizio quello vecchio sarebbe comunque sbagliato. */
export function precompila(voce, ultima, esercizio, prefs = {}) {
  const c = def(voce);
  const base = { esId: voce.esId, nome: esercizio?.nome || voce.esId,
                 protocollo: voce.protocollo, conf: voce.conf || null };
  const esitoPrec = ultima ? progressione(ultima, esercizio) : null;

  if (c.forma === 'iso') {
    return {
      ...base,
      giri: Array.from({ length: c.giri }, (_, i) => {
        const g = { carico: esitoPrec?.prossimoCarico ?? ultima?.giri?.[i]?.carico ?? null };
        c.tenute.forEach((sec, k) => {
          const ultimaTenuta = k === c.tenute.length - 1 && c.ultimaAlMassimo;
          g[chiaveTenuta(c, k)] = ultimaTenuta
            ? (ultima?.giri?.[i]?.[chiaveTenuta(c, k)] ?? c.ripPerTenuta)
            : c.ripPerTenuta;
        });
        return g;
      }),
    };
  }

  const primo = ultima?.carico ?? ultima?.serie?.[0]?.carico ?? null;
  const carico = esitoPrec?.prossimoCarico ?? primo;
  const rip = esitoPrec?.prossimeRip ?? c.ripObiettivo;
  const riga = {
    ...base,
    serie: Array.from({ length: c.serie }, (_, i) => {
      const s = { rip };
      if (!c.caricoUnico) s.carico = carico;
      if (c.drop) s.dropRip = ultima?.serie?.[i]?.dropRip ?? null;
      return s;
    }),
  };
  if (c.caricoUnico) {
    riga.carico = carico;
    if (c.drop) riga.drop = calcolaDrop(carico, esercizio, prefs.arrotondaDrop !== false, c.drop);
  }
  return riga;
}

/* Le chiavi delle tenute restano quelle storiche (r20, r15, r10, max) per il
   formato 20/15/10/5, così lo storico importato continua a leggersi. */
export function chiaveTenuta(c, k) {
  c = def(c);
  const ultima = k === c.tenute.length - 1 && c.ultimaAlMassimo;
  if (ultima) return 'max';
  return 'r' + c.tenute[k];
}

/* ============ regole di progressione ============ */

/* `precedente` è il carico della volta prima ancora: serve solo alla regola
   «se scendi sotto l'obiettivo su due serie, torni al carico precedente». */
export function progressione(v, esercizio, precedente = null) {
  const c = def(v);
  const g = gradino(esercizio);
  const su = kg => Math.round((kg + g) * 10) / 10;

  if (c.forma === 'iso') {
    const giri = v.giri || [];
    if (giri.length < c.giri) return null;
    const chiavi = c.tenute.map((_, k) => chiaveTenuta(c, k));
    if (giri.some(x => x.carico == null || chiavi.some(k => x[k] == null))) return null;

    const obbligatorie = chiavi.filter(k => k !== 'max');
    const pieni = giri.every(x => obbligatorie.every(k => x[k] >= c.ripPerTenuta));
    const massimoFinale = giri.at(-1).max ?? giri.at(-1)[chiavi.at(-1)];
    const carico = giri[0].carico;

    if (pieni && massimoFinale >= c.massimoFinale) {
      return { regola: 'aumenta', prossimoCarico: su(carico),
               messaggio: `${obbligatorie.map(() => c.ripPerTenuta).join('/')} in tutti e ${c.giri} i giri e massimo finale ${massimoFinale}: la prossima volta ${fmt(su(carico))} kg.` };
    }
    const perché = !pieni
      ? `non hai chiuso ${obbligatorie.map(() => c.ripPerTenuta).join('/')} in tutti i giri`
      : `il massimo finale è ${massimoFinale}, ne servono ${c.massimoFinale}`;
    return { regola: 'mantieni', prossimoCarico: carico,
             messaggio: `Resta a ${fmt(carico)} kg: ${perché}.` };
  }

  const serie = v.serie || [];
  if (serie.length < c.serie) return null;
  const carico = c.caricoUnico ? v.carico : serie[0]?.carico;
  if (carico == null) return null;
  if (!c.caricoUnico && serie.some(s => s.carico == null)) return null;
  const rip = serie.map(s => s.rip);
  if (rip.some(r => r == null)) return null;

  const pulite = rip.filter(r => r >= c.ripObiettivo).length;
  if (pulite === c.serie) {
    const out = { regola: 'aumenta', prossimoCarico: su(carico),
      messaggio: `${c.ripObiettivo} su tutte e ${c.serie} le serie: la prossima volta ${fmt(su(carico))} kg (+${fmt(g)})` +
                 (c.ripDopoAumento ? `, ripartendo da ${c.ripDopoAumento} ripetizioni.` : '.') };
    if (c.ripDopoAumento) out.prossimeRip = c.ripDopoAumento;
    return out;
  }

  const sotto = c.serie - pulite;
  if (c.seriePerScendere && sotto >= c.seriePerScendere) {
    const giu = precedente ?? Math.max(g, Math.round((carico - g) * 10) / 10);
    return { regola: 'diminuisci', prossimoCarico: giu,
             messaggio: `Sotto le ${c.ripObiettivo} ripetizioni su ${sotto} serie: torna a ${fmt(giu)} kg.` };
  }
  return { regola: 'mantieni', prossimoCarico: carico,
           messaggio: `${pulite} serie su ${c.serie} complete: resta a ${fmt(carico)} kg e riprovaci.` };
}

const fmt = n => String(Math.round(n * 10) / 10).replace('.', ',');

/* ============ numeri riassuntivi ============ */

/* Il carico che rappresenta l'esercizio nel grafico: quello di lavoro,
   non quello del drop. */
export function caricoPrincipale(v) {
  if (!v) return null;
  const c = def(v);
  if (c.forma === 'iso') return v.giri?.[0]?.carico ?? null;
  return (c.caricoUnico ? v.carico : v.serie?.[0]?.carico) ?? null;
}

export function ripTotali(v) {
  const c = def(v);
  if (c.forma === 'iso') {
    const chiavi = c.tenute.map((_, k) => chiaveTenuta(c, k));
    return somma((v.giri || []).flatMap(x => chiavi.map(k => x[k])));
  }
  return somma((v.serie || []).flatMap(s => c.drop ? [s.rip, s.dropRip] : [s.rip]));
}

/* Volume = carico × ripetizioni, sommato. Per le isometrie le ripetizioni
   contano, i secondi di tenuta no: non sono confrontabili con una ripetizione. */
export function volume(v) {
  const c = def(v);
  if (c.forma === 'iso') {
    const chiavi = c.tenute.map((_, k) => chiaveTenuta(c, k));
    return Math.round((v.giri || []).reduce((t, x) =>
      t + (x.carico ?? 0) * somma(chiavi.map(k => x[k])), 0));
  }
  const serie = v.serie || [];
  if (c.caricoUnico) {
    if (v.carico == null) return 0;
    const principali = somma(serie.map(s => s.rip)) * v.carico;
    const drop = c.drop ? somma(serie.map(s => s.dropRip)) * (v.drop ?? 0) : 0;
    return Math.round(principali + drop);
  }
  return Math.round(serie.reduce((t, s) => t + (s.carico ?? 0) * (s.rip ?? 0), 0));
}

const somma = a => a.reduce((t, x) => t + (Number(x) || 0), 0);

/* Una voce è «finita» quando tutte le caselle che servono sono piene:
   è il criterio con cui la modalità palestra decide se può passare oltre. */
export function completa(v) {
  const c = def(v);
  if (c.forma === 'iso') {
    const chiavi = c.tenute.map((_, k) => chiaveTenuta(c, k));
    return v.giri?.length === c.giri &&
           v.giri.every(x => x.carico != null && chiavi.every(k => x[k] != null));
  }
  if (v.serie?.length !== c.serie) return false;
  if (c.caricoUnico && v.carico == null) return false;
  return v.serie.every(s =>
    s.rip != null &&
    (c.caricoUnico || s.carico != null) &&
    (!c.drop || s.dropRip != null));
}

/* Quanti «passi» ha un esercizio: le serie, o i giri per le isometrie.
   È il conteggio dei pallini e del «serie 3 di 5». */
export function passi(v) {
  const c = def(v);
  return c.forma === 'iso' ? c.giri : c.serie;
}

/* Come si chiama un passo, al singolare: «serie» o «giro». */
export const nomePasso = v => def(v).forma === 'iso' ? 'giro' : 'serie';
