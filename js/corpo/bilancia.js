/* I campi della bilancia a impedenza, condivisi fra la schermata Oggi e il
   modulo Corpo. Stanno chiusi finché non li apri: la strada veloce — sali,
   leggi il peso, un tocco — deve restare di un tocco. */

import { el, nkg } from '../ui.js';
import { passo } from '../componenti.js';
import { composizione } from '../store.js';

export const CAMPI = [
  ['grassoPerc', 'Grasso', '%', 'quello che la bilancia chiama «grasso corporeo»'],
  ['magraPerc', 'Massa magra', '%', 'lasciala vuota se la bilancia non la dà: si calcola'],
  ['acquaPerc', 'Acqua', '%', 'facoltativa'],
];

/* Restituisce un elemento con `leggi()` e `valori()`. `aperto` lo mostra già
   espanso, per esempio quando stai correggendo una pesata che li ha. */
export function campiBilancia(riga = {}, { aperto = false } = {}) {
  const campi = {};
  const griglia = el('div.griglia-bilancia');

  CAMPI.forEach(([chiave, etichetta, unita, aiuto]) => {
    campi[chiave] = passo({
      valore: riga[chiave] ?? null, step: 0.1, min: 0, max: 100, decimali: 1,
      stretto: true, etichetta,
      onCambio: () => aggiornaDerivati(),
    });
    griglia.append(el('div.cella-bilancia', {},
      el('span.cb-lab', {}, etichetta, el('small', { testo: aiuto })),
      el('div.cb-campo', {}, campi[chiave], el('span.cb-unita', { testo: unita }))));
  });

  const derivati = el('p.nt.derivati');
  const leggi = () => Object.fromEntries(
    CAMPI.map(([k]) => [k, campi[k].leggi()]));

  function aggiornaDerivati(kg = riga.kg) {
    const v = leggi();
    if (!kg || (v.grassoPerc == null && v.magraPerc == null)) {
      derivati.textContent = 'Compila almeno il grasso: massa magra e chili si calcolano da soli.';
      return;
    }
    const c = composizione({ kg, ...v });
    derivati.textContent =
      `Con ${nkg(kg)} kg: ${nkg(c.grassoKg)} kg di grasso, ${nkg(c.magraKg)} kg di massa magra` +
      (v.magraPerc == null ? ` (${nkg(c.magraPercCalcolata)} %, calcolata).` : '.');
  }

  const corpo = el('div.corpo-bilancia', {}, griglia, derivati);
  corpo.hidden = !aperto;

  const interruttore = el('button.apri-bilancia', { type: 'button',
    'aria-expanded': aperto, testo: (aperto ? '−' : '+') + ' Dati della bilancia',
    onclick: () => {
      corpo.hidden = !corpo.hidden;
      interruttore.setAttribute('aria-expanded', !corpo.hidden);
      interruttore.textContent = (corpo.hidden ? '+' : '−') + ' Dati della bilancia';
    } });

  const radice = el('div.bilancia', {}, interruttore, corpo);
  radice.leggi = leggi;
  radice.aggiorna = aggiornaDerivati;
  aggiornaDerivati();
  return radice;
}
