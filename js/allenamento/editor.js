/* Editor delle schede: aggiungi, togli e riordina gli esercizi dentro A, B e C,
   scegli il protocollo di ogni voce e creane di nuovi.

   Un protocollo nuovo è solo configurazione — quante serie, quante ripetizioni,
   carico unico o per serie, drop sì o no, quando aumentare — quindi un 4x8 o un
   5x3 si fanno da qui, senza toccare il codice. Le forme dei dati restano due
   (serie e isometrie) perché cambiano la struttura di quello che salvi. */

import { def, nomeProtocollo, descrizione, regolaTesto, gradino, INCORPORATI } from './protocolli.js';
import { passo, rigaVoce } from '../componenti.js';
import { el, $$, svuota, nkg, oggiISO, dataBreve } from '../ui.js';
import { catalogo, salvaEsercizio, programmi, programmaAttivo, salvaProgramma,
         protocolli, salvaProtocollo, sedute } from '../store.js';

const SCHEDE = ['A', 'B', 'C'];
const ATTREZZI = ['macchina', 'cavi', 'manubri', 'bilanciere'];

let radice, prog, cat, protos, alSalva;

export async function monta(contenitore, { onSalva } = {}) {
  radice = contenitore;
  alSalva = onSalva;
  cat = await catalogo();
  prog = await programmaAttivo();
  protos = await protocolli();
  disegna();
}

/* ====================== schermata principale ====================== */

function disegna() {
  svuota(radice);
  if (!prog) {
    radice.append(el('p.vuoto', { testo: 'Nessuna scheda. Creane una.' }),
                  el('button.cta', { type: 'button', testo: 'Crea la prima scheda', onclick: nuovaScheda }));
    return;
  }

  radice.append(
    el('div.scheda', {},
      el('h2.stit', {}, el('span', { testo: prog.nome }),
        el('small', { testo: `dal ${dataBreve(prog.dal)} · ${prog.voci.length} voci` })),
      el('div.riga-form', {},
        el('button.ghost', { type: 'button', testo: 'Rinomina', onclick: rinomina }),
        el('button.ghost', { type: 'button', testo: 'Scheda nuova', onclick: nuovaScheda })),
      ...SCHEDE.map(bloccoScheda)),
    sezioneProtocolli(),
    sezioneArchivio());
}

/* ---------- una seduta (A, B o C) ---------- */

function bloccoScheda(scheda) {
  const voci = prog.voci.filter(v => v.scheda === scheda).sort((a, b) => a.ordine - b.ordine);
  const box = el('div.blocco-scheda', {},
    el('p.glab', { testo: `SEDUTA ${scheda} — ${voci.length} esercizi` }));

  voci.forEach((v, i) => {
    const es = cat.get(v.esId);
    box.append(el('div.voce-riga', {},
      el('div.voce-frecce', {},
        el('button.frec', { type: 'button', testo: '↑', disabled: i === 0,
                            'aria-label': 'Sposta su', onclick: () => sposta(v, scheda, -1) }),
        el('button.frec', { type: 'button', testo: '↓', disabled: i === voci.length - 1,
                            'aria-label': 'Sposta giù', onclick: () => sposta(v, scheda, +1) })),
      el('button.voce-corpo', { type: 'button', onclick: e => apriVoce(v, e.currentTarget) },
        el('span.voce-nome', { testo: es?.nome || v.esId }),
        el('span.voce-det', { testo: `${nomeProtocollo(def(v))} · +${nkg(gradino(es))} kg · rec. ${v.recupero}″` }))));
  });

  box.append(el('button.aggiungi', { type: 'button', dataset: { scheda },
                                     testo: '+ Aggiungi un esercizio alla ' + scheda,
                                     onclick: () => aggiungiVoce(scheda) }));
  return box;
}

/* Sposta una voce su o giù rinumerando tutta la seduta. */
async function sposta(voce, scheda, delta) {
  const voci = prog.voci.filter(v => v.scheda === scheda).sort((a, b) => a.ordine - b.ordine);
  const i = voci.indexOf(voce);
  const j = i + delta;
  if (j < 0 || j >= voci.length) return;
  [voci[i], voci[j]] = [voci[j], voci[i]];
  voci.forEach((v, k) => { v.ordine = k + 1; });
  await salva();
}

/* ---------- editor di una voce ---------- */

function apriVoce(voce, bottone) {
  const gia = bottone.parentElement.nextElementSibling;
  if (gia?.classList.contains('editor-voce')) { gia.remove(); return; }
  $$('.editor-voce', radice).forEach(n => n.remove());

  const es = cat.get(voce.esId) || { id: voce.esId, nome: voce.esId, attrezzo: 'macchina' };

  const nome = el('input.campo-testo', { type: 'text', value: es.nome, 'aria-label': 'Nome dell\'esercizio' });
  const attrezzo = el('select.selettore', { 'aria-label': 'Attrezzo' },
    ...ATTREZZI.map(a => el('option', { value: a, selected: a === es.attrezzo, testo: a })));
  const incremento = passo({ valore: gradino(es), step: 0.5, min: 0.5, max: 25, decimali: 1,
                             unita: 'kg', etichetta: 'aumento di carico' });
  const recupero = passo({ valore: voce.recupero, step: 15, min: 0, max: 600, decimali: 0,
                           unita: 'sec', etichetta: 'recupero' });
  const scheda = el('select.selettore', { 'aria-label': 'Seduta' },
    ...SCHEDE.map(x => el('option', { value: x, selected: x === voce.scheda, testo: 'Seduta ' + x })));
  const protocollo = el('select.selettore', { 'aria-label': 'Protocollo' },
    ...Object.values(protos).map(pr => el('option', {
      value: pr.id, selected: pr.id === voce.protocollo, testo: nomeProtocollo(pr) })));

  const spiega = el('p.nt');
  const aggiornaSpiega = () => {
    const pr = protos[protocollo.value];
    spiega.textContent = `${descrizione(pr)}. ${regolaTesto(pr)}.`;
  };
  protocollo.addEventListener('change', aggiornaSpiega);
  aggiornaSpiega();

  bottone.parentElement.after(el('div.editor-voce', {},
    el('label.campo', {}, el('span', { testo: 'Nome' }), nome),
    el('label.campo', {}, el('span', { testo: 'Attrezzo' }), attrezzo),
    el('label.campo', {}, el('span', { testo: 'Aumento di carico' }), incremento),
    el('label.campo', {}, el('span', { testo: 'Seduta' }), scheda),
    el('label.campo', {}, el('span', { testo: 'Protocollo' }), protocollo),
    el('label.campo', {}, el('span', { testo: 'Recupero' }), recupero),
    spiega,
    el('div.azioni', {},
      el('button.ghost', { type: 'button', testo: 'Salva', onclick: async () => {
        const nuovoEs = { ...es, nome: nome.value.trim() || es.nome,
                          attrezzo: attrezzo.value, incremento: incremento.leggi() ?? gradino(es) };
        await salvaEsercizio(nuovoEs);
        cat.set(nuovoEs.id, nuovoEs);
        voce.recupero = recupero.leggi() ?? voce.recupero;
        if (protocollo.value !== voce.protocollo) {
          // i carichi si cercano per esercizio E protocollo: cambiandolo,
          // la precompilazione riparte da zero. Meglio dirlo prima.
          const vecchio = nomeProtocollo(def(voce));
          const nuovoNome = nomeProtocollo(protos[protocollo.value]);
          if (!confirm(`Passo «${nuovoEs.nome}» da ${vecchio} a ${nuovoNome}?\n\n` +
                       `Lo storico del ${vecchio} resta nei grafici, ma la prima volta ` +
                       `col ${nuovoNome} il carico te lo chiede: 80 kg di ${vecchio} non ` +
                       `sono 80 kg di ${nuovoNome}.`)) return;
          voce.protocollo = protocollo.value;
          voce.conf = INCORPORATI[protocollo.value] ? null : protos[protocollo.value];
          voce.recupero = protos[protocollo.value].recupero ?? voce.recupero;
        }
        if (scheda.value !== voce.scheda) {
          voce.scheda = scheda.value;
          voce.ordine = prog.voci.filter(v => v.scheda === scheda.value).length;
        }
        rinumera();
        await salva();
      } }),
      el('button.ghost.pericolo', { type: 'button', testo: 'Togli dalla scheda', onclick: async () => {
        if (!confirm(`Tolgo «${es.nome}» dalla seduta ${voce.scheda}?\n\nLo storico resta: sparisce solo dalla scheda.`)) return;
        prog.voci = prog.voci.filter(v => v !== voce);
        rinumera();
        await salva();
      } }))));
}

const rinumera = () => SCHEDE.forEach(sc =>
  prog.voci.filter(v => v.scheda === sc).sort((a, b) => a.ordine - b.ordine)
    .forEach((v, k) => { v.ordine = k + 1; }));

/* ---------- aggiungere una voce ---------- */

function aggiungiVoce(scheda) {
  $$('.editor-voce', radice).forEach(n => n.remove());
  const usati = new Set(prog.voci.map(v => v.esId));
  const liberi = [...cat.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'it'));

  const scelta = el('select.selettore', { 'aria-label': 'Esercizio' },
    el('option', { value: '', testo: '— esercizio nuovo —' }),
    ...liberi.map(e => el('option', { value: e.id,
      testo: e.nome + (usati.has(e.id) ? ' (già nella scheda)' : '') })));
  const nomeNuovo = el('input.campo-testo', { type: 'text', placeholder: 'Nome dell\'esercizio nuovo',
                                              'aria-label': 'Nome dell\'esercizio nuovo' });
  const attrezzo = el('select.selettore', { 'aria-label': 'Attrezzo' },
    ...ATTREZZI.map(a => el('option', { value: a, testo: a })));
  const protocollo = el('select.selettore', { 'aria-label': 'Protocollo' },
    ...Object.values(protos).map(pr => el('option', { value: pr.id, testo: nomeProtocollo(pr) })));

  const box = el('div.editor-voce', {},
    el('p.glab', { testo: 'NUOVO ESERCIZIO NELLA SEDUTA ' + scheda }),
    el('label.campo', {}, el('span', { testo: 'Esercizio' }), scelta),
    el('label.campo', {}, el('span', { testo: 'Nome, se nuovo' }), nomeNuovo),
    el('label.campo', {}, el('span', { testo: 'Attrezzo' }), attrezzo),
    el('label.campo', {}, el('span', { testo: 'Protocollo' }), protocollo),
    el('div.azioni', {},
      el('button.ghost', { type: 'button', testo: 'Aggiungi', onclick: async () => {
        let esId = scelta.value;
        if (!esId) {
          const n = nomeNuovo.value.trim();
          if (!n) { alert('Scegli un esercizio dall\'elenco oppure scrivi il nome di uno nuovo.'); return; }
          esId = idDaNome(n, cat);
          const nuovo = { id: esId, nome: n, attrezzo: attrezzo.value,
                          incremento: attrezzo.value === 'macchina' ? 5 : 2.5, gruppo: '' };
          await salvaEsercizio(nuovo);
          cat.set(esId, nuovo);
        }
        const pr = protos[protocollo.value];
        prog.voci.push({
          esId, scheda, protocollo: pr.id, conf: INCORPORATI[pr.id] ? null : pr,
          recupero: pr.recupero ?? 120,
          ordine: prog.voci.filter(v => v.scheda === scheda).length + 1,
        });
        rinumera();
        await salva();
      } }),
      el('button.ghost', { type: 'button', testo: 'Annulla', onclick: () => box.remove() })));

  radice.querySelector(`.aggiungi[data-scheda="${scheda}"]`).after(box);
}

function idDaNome(nome, cat) {
  const base = nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'esercizio';
  let id = base, n = 2;
  while (cat.has(id)) id = `${base}_${n++}`;
  return id;
}

/* ====================== protocolli ====================== */

function sezioneProtocolli() {
  const sez = el('div.scheda', {},
    el('h2.stit', {}, el('span', { testo: 'Protocolli' }),
      el('small', { testo: `${Object.keys(protos).length} disponibili` })));

  Object.values(protos).forEach(pr => {
    const suo = !INCORPORATI[pr.id];
    sez.append(el('div.proto-riga', {},
      el('div.proto-testo', {},
        el('span.proto-nome', { testo: nomeProtocollo(pr) }),
        el('span.proto-desc', { testo: descrizione(pr) })),
      suo ? el('button.frec', { type: 'button', testo: '✎', 'aria-label': 'Modifica',
                                onclick: () => formaProtocollo(sez, pr) })
          : el('span.proto-fisso', { testo: 'di serie' })));
  });

  sez.append(
    el('div.azioni', {},
      el('button.ghost', { type: 'button', testo: '+ Protocollo nuovo',
                           onclick: () => formaProtocollo(sez, null) })),
    el('p.nt', { testo: 'Un protocollo nuovo è solo una configurazione: serie, ripetizioni, ' +
                        'drop e regola di aumento. Le isometrie hanno una forma diversa e ' +
                        'si configurano con le tenute.' }));
  return sez;
}

function formaProtocollo(dove, esistente) {
  $$('.forma-proto', radice).forEach(n => n.remove());
  const p = esistente || { forma: 'serie', serie: 4, ripObiettivo: 8, caricoUnico: false,
                           drop: null, ripDopoAumento: null, seriePerScendere: 0, recupero: 120,
                           giri: 2, tenute: [20, 15, 10, 5], ripPerTenuta: 8,
                           ultimaAlMassimo: true, massimoFinale: 10 };

  const nome = el('input.campo-testo', { type: 'text', value: esistente?.nome || '',
                                         placeholder: 'lasciando vuoto: 4x8',
                                         'aria-label': 'Nome del protocollo' });
  const forma = el('select.selettore', { 'aria-label': 'Forma' },
    el('option', { value: 'serie', selected: p.forma === 'serie', testo: 'Serie di ripetizioni' }),
    el('option', { value: 'iso', selected: p.forma === 'iso', testo: 'Isometrie a giri' }));

  const serie = passo({ valore: p.serie, step: 1, min: 1, max: 12, decimali: 0, etichetta: 'serie' });
  const rip = passo({ valore: p.ripObiettivo, step: 1, min: 1, max: 40, decimali: 0, etichetta: 'ripetizioni obiettivo' });
  const caricoUnico = el('input', { type: 'checkbox', checked: p.caricoUnico, 'aria-label': 'Carico unico' });
  const conDrop = el('input', { type: 'checkbox', checked: !!p.drop, 'aria-label': 'Con drop' });
  const dropPerc = passo({ valore: p.drop || 20, step: 5, min: 5, max: 50, decimali: 0, unita: '%', etichetta: 'percentuale del drop' });
  const ripDopo = passo({ valore: p.ripDopoAumento ?? 0, step: 1, min: 0, max: 40, decimali: 0, etichetta: 'ripetizioni dopo l\'aumento' });
  const giuDopo = passo({ valore: p.seriePerScendere ?? 0, step: 1, min: 0, max: 12, decimali: 0, etichetta: 'serie per tornare indietro' });
  const recupero = passo({ valore: p.recupero, step: 15, min: 0, max: 600, decimali: 0, unita: 'sec', etichetta: 'recupero' });

  const giri = passo({ valore: p.giri, step: 1, min: 1, max: 6, decimali: 0, etichetta: 'giri' });
  const tenute = el('input.campo-testo', { type: 'text', value: (p.tenute || []).join(' '),
                                           placeholder: '20 15 10 5', 'aria-label': 'Secondi delle tenute' });
  const ripTenuta = passo({ valore: p.ripPerTenuta, step: 1, min: 1, max: 30, decimali: 0, etichetta: 'ripetizioni per tenuta' });
  const maxFinale = passo({ valore: p.massimoFinale, step: 1, min: 1, max: 40, decimali: 0, etichetta: 'massimo finale per aumentare' });

  const bloccoSerie = el('div', {},
    el('label.campo', {}, el('span', { testo: 'Quante serie' }), serie),
    el('label.campo', {}, el('span', { testo: 'Ripetizioni obiettivo' }), rip),
    el('label.campo.sw', {}, el('span', { testo: 'Carico unico per l\'esercizio' }), caricoUnico),
    el('label.campo.sw', {}, el('span', { testo: 'Drop dopo ogni serie' }), conDrop),
    el('label.campo', {}, el('span', { testo: 'Scarico del drop' }), dropPerc),
    el('label.campo', {}, el('span', { testo: 'Rip. dopo l\'aumento (0 = uguali)' }), ripDopo),
    el('label.campo', {}, el('span', { testo: 'Serie sotto obiettivo per scendere (0 = mai)' }), giuDopo));

  const bloccoIso = el('div', {},
    el('label.campo', {}, el('span', { testo: 'Quanti giri' }), giri),
    el('label.campo', {}, el('span', { testo: 'Secondi delle tenute' }), tenute),
    el('label.campo', {}, el('span', { testo: 'Ripetizioni per tenuta' }), ripTenuta),
    el('label.campo', {}, el('span', { testo: 'Massimo finale per aumentare' }), maxFinale));

  const anteprima = el('p.nt.anteprima');

  const componi = () => {
    const base = { id: esistente?.id || 'pr_' + Date.now().toString(36),
                   nome: nome.value.trim() || null, recupero: recupero.leggi() ?? 120 };
    if (forma.value === 'iso') {
      const t = tenute.value.split(/[^0-9]+/).map(Number).filter(n => n > 0);
      return { ...base, forma: 'iso', giri: giri.leggi() ?? 2,
               tenute: t.length ? t : [20, 15, 10, 5],
               ripPerTenuta: ripTenuta.leggi() ?? 8, ultimaAlMassimo: true,
               massimoFinale: maxFinale.leggi() ?? 10 };
    }
    const rd = ripDopo.leggi() ?? 0;
    return { ...base, forma: 'serie',
             serie: serie.leggi() ?? 3, ripObiettivo: rip.leggi() ?? 10,
             caricoUnico: caricoUnico.checked,
             drop: conDrop.checked ? (dropPerc.leggi() ?? 20) : null,
             ripDopoAumento: rd > 0 ? rd : null,
             seriePerScendere: giuDopo.leggi() ?? 0 };
  };

  const aggiorna = () => {
    const iso = forma.value === 'iso';
    bloccoSerie.hidden = iso;
    bloccoIso.hidden = !iso;
    const c = componi();
    anteprima.textContent = `${nomeProtocollo(c)} — ${descrizione(c)}. ${regolaTesto(c)}.`;
  };
  [forma, nome, caricoUnico, conDrop, tenute].forEach(n => n.addEventListener('change', aggiorna));
  $$('input', bloccoSerie).concat($$('input', bloccoIso))
    .forEach(n => n.addEventListener('change', aggiorna));
  aggiorna();

  dove.append(el('div.forma-proto', {},
    el('p.glab', { testo: esistente ? 'MODIFICA PROTOCOLLO' : 'PROTOCOLLO NUOVO' }),
    el('label.campo', {}, el('span', { testo: 'Nome' }), nome),
    el('label.campo', {}, el('span', { testo: 'Forma' }), forma),
    bloccoSerie, bloccoIso,
    el('label.campo', {}, el('span', { testo: 'Recupero suggerito' }), recupero),
    anteprima,
    el('div.azioni', {},
      el('button.ghost', { type: 'button', testo: 'Salva il protocollo', onclick: async () => {
        const pr = componi();
        await salvaProtocollo(pr);
        protos = await protocolli();
        disegna();
      } }),
      el('button.ghost', { type: 'button', testo: 'Annulla',
                           onclick: e => e.currentTarget.closest('.forma-proto').remove() }))));
}

/* ====================== schede e archivio ====================== */

async function rinomina() {
  const n = prompt('Nome della scheda:', prog.nome);
  if (!n) return;
  prog.nome = n.trim();
  await salva();
}

/* Una scheda nuova parte da una copia di quella attiva: nella pratica la
   trainer cambia qualche esercizio, non li riscrive tutti. */
async function nuovaScheda() {
  const nome = prompt('Nome della scheda nuova:', prossimoNome());
  if (!nome) return;
  const dal = prompt('Attiva a partire dal (AAAA-MM-GG):', oggiISO());
  if (!dal || !/^\d{4}-\d{2}-\d{2}$/.test(dal)) { if (dal) alert('Data non valida.'); return; }
  const copia = confirm('Parto da una copia di questa scheda?\n\nOK = copia gli esercizi di adesso.\nAnnulla = comincia da una scheda vuota.');

  const nuovo = { id: 'pr_' + Date.now().toString(36), nome: nome.trim(), dal, al: null,
                  attivo: true, voci: copia && prog ? structuredClone(prog.voci) : [] };
  if (prog) await salvaProgramma({ ...prog, attivo: false, al: dal });
  await salvaProgramma(nuovo);
  prog = nuovo;
  disegna();
  alSalva?.();
}

function prossimoNome() {
  const n = (prog?.nome || '').match(/(\d+)\s*$/);
  return n ? (prog.nome.slice(0, n.index) + (Number(n[1]) + 1)).trim() : 'Scheda nuova';
}

function sezioneArchivio() {
  const sez = el('div.scheda', {}, el('h2.stit', { testo: 'Archivio' }));
  sez.append(el('div.archivio-lista'));
  caricaArchivio(sez.querySelector('.archivio-lista'));
  sez.append(el('p.nt', { testo: 'Le schede vecchie restano. Storico e grafici le attraversano: ' +
                                 'gli esercizi rimasti uguali tengono la loro linea di carico.' }));
  return sez;
}

async function caricaArchivio(box) {
  const tutti = await programmi();
  const fatte = await sedute();
  const vecchi = tutti.filter(p => p.id !== prog?.id);
  if (!vecchi.length) { box.append(el('p.nt', { testo: 'Nessuna scheda archiviata: questa è la prima.' })); return; }

  vecchi.forEach(p => {
    const n = fatte.filter(s => s.programmaId === p.id).length;
    const riga = el('button.riga-voce', { type: 'button', onclick: () => mostraArchiviata(riga, p, n) },
      el('span.n', { testo: p.nome }), el('span.leader'),
      el('span.q', { testo: `${dataBreve(p.dal)} → ${p.al ? dataBreve(p.al) : 'oggi'} · ${n} sedute` }));
    box.append(riga);
  });
}

function mostraArchiviata(riga, p, nSedute) {
  const gia = riga.nextElementSibling;
  if (gia?.classList.contains('editor-voce')) { gia.remove(); return; }
  $$('.editor-voce', radice).forEach(n => n.remove());

  const box = el('div.editor-voce', {},
    el('p.glab', { testo: `${p.nome.toUpperCase()} · ${nSedute} sedute registrate` }));
  SCHEDE.forEach(sc => {
    const voci = p.voci.filter(v => v.scheda === sc).sort((a, b) => a.ordine - b.ordine);
    if (!voci.length) return;
    box.append(el('p.glab', { testo: 'SEDUTA ' + sc }));
    voci.forEach(v => box.append(rigaVoce(cat.get(v.esId)?.nome || v.esId, nomeProtocollo(def(v)))));
  });
  box.append(el('div.azioni', {},
    el('button.ghost', { type: 'button', testo: 'Riattiva questa scheda', onclick: async () => {
      if (!confirm(`Torno a «${p.nome}»?\n\nQuella di adesso viene archiviata.`)) return;
      await salvaProgramma({ ...prog, attivo: false, al: oggiISO() });
      await salvaProgramma({ ...p, attivo: true, al: null, dal: oggiISO() });
      prog = await programmaAttivo();
      disegna();
      alSalva?.();
    } })));
  riga.after(box);
}

/* ====================== salvataggio ====================== */

async function salva() {
  await salvaProgramma(prog);
  disegna();
  alSalva?.();
}
