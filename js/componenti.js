/* Componenti di interfaccia condivisi fra la schermata di inserimento e la
   modalità palestra. Se un pezzo lo tocchi con una mano sola, sta qui. */

import { el, nkg } from './ui.js';

/* Campo numerico con −/+ ai lati. `grande` lo porta alla misura da palestra.
   Il valore null significa «non ancora inserito» e si legge come «—». */
export function passo({ valore = null, min = 0, max = 999, step = 1, decimali = 1,
                        etichetta = '', unita = '', grande = false, stretto = false, onCambio }) {
  const campo = el('input', {
    type: 'text', inputmode: 'decimal', class: 'valore',
    'aria-label': etichetta || 'valore',
    value: valore === null ? '' : nkg(valore, decimali),
  });

  const leggi = () => {
    const t = campo.value.trim().replace(',', '.');
    if (t === '') return null;
    const n = Number(t);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : null;
  };
  const scrivi = (v, avvisa = true) => {
    valore = v;
    campo.value = v === null ? '' : nkg(v, decimali);
    if (avvisa) onCambio?.(v);
  };

  campo.addEventListener('change', () => scrivi(leggi()));
  campo.addEventListener('focus', () => campo.select());

  const bottone = (segno, simbolo) => el('button', {
    type: 'button', class: 'passo-btn', testo: simbolo,
    'aria-label': `${segno > 0 ? 'Aumenta' : 'Riduci'} ${etichetta || 'valore'}`,
    onclick: () => {
      const base = leggi();
      scrivi(Math.min(max, Math.max(min, (base === null ? (segno > 0 ? min : max) : base) + segno * step)));
    },
  });

  const radice = el('div.passo' + (grande ? '.grande' : stretto ? '.stretto' : ''), {},
    bottone(-1, '−'), campo, bottone(1, '+'),
    unita ? el('span.unita', { testo: unita }) : null);

  radice.leggi = leggi;
  radice.scrivi = scrivi;
  radice.campo = campo;
  return radice;
}

/* Riga «etichetta ...... valore» con i puntini di guida, come nelle ricette. */
export const rigaVoce = (nome, valore, classe = '') =>
  el('div.voce' + (classe ? '.' + classe : ''), {},
    el('span.n', { testo: nome }), el('span.leader'), el('span.q', { testo: valore }));

/* Gruppo di pulsanti mutuamente esclusivi (A / B / C, pranzo / cena…). */
export function scelta(opzioni, attiva, onScelta, classe = 'seg') {
  const box = el('div.' + classe, { role: 'group' });
  const bottoni = opzioni.map(o => {
    const b = el('button', {
      type: 'button', testo: o.etichetta, 'aria-pressed': o.valore === attiva,
      onclick: () => {
        bottoni.forEach(x => x.setAttribute('aria-pressed', x === b));
        onScelta(o.valore);
      },
    });
    return b;
  });
  box.append(...bottoni);
  return box;
}
