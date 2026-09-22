/* Grafico a linea in SVG, scritto a mano: niente librerie da scaricare,
   quindi funziona offline come tutto il resto.
   Una sola misura per grafico — carico e ripetizioni stanno su due grafici
   impilati, mai su due assi nello stesso riquadro: due scale sovrapposte
   fanno vedere correlazioni che nei dati non ci sono. */

import { el, nkg, dataBreve, daISO } from './ui.js';

const NS = 'http://www.w3.org/2000/svg';
const s = (tag, attributi = {}) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attributi)) {
    if (v === null || v === undefined) continue;
    if (k === 'textContent') n.textContent = v; else n.setAttribute(k, v);
  }
  return n;
};

/* Passo "gradevole" dell'asse: 1, 2, 5 o 10 per ordine di grandezza, scelto
   per avere quattro o cinque linee di griglia. Senza questo, una serie che va
   da 43 a 50 ripetizioni finisce con venti linee una sull'altra. */
function passoGradevole(ampiezza, linee = 4) {
  const grezzo = ampiezza / linee;
  const ordine = Math.pow(10, Math.floor(Math.log10(grezzo)));
  const n = grezzo / ordine;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * ordine;
}

/* Estremi dell'asse: la scala non parte mai da zero se i dati stanno in alto —
   su un carico che va da 60 a 85 kg, lo zero schiaccia tutto. */
function scala(valori) {
  let min = Math.min(...valori), max = Math.max(...valori);
  if (min === max) { min -= 1; max += 1; }         // serie piatta: linea a metà
  const margine = (max - min) * 0.15;
  const passo = passoGradevole(max - min + 2 * margine);
  const arr = v => Math.round(v * 1e6) / 1e6;          // toglie il rumore dei float
  let basso = arr(Math.floor((min - margine) / passo) * passo);
  // un asse dei carichi non scende sotto zero: non esistono −20 kg
  if (min >= 0 && basso < 0) basso = 0;
  return { min: basso, max: arr(Math.ceil((max + margine) / passo) * passo), passo };
}

/* punti: [{ x: 'AAAA-MM-GG', y: numero, nota?: testo }]
   segni:  [{ x: 'AAAA-MM-GG', etichetta }]  — righe verticali, es. cambio scheda */
export function grafico({ punti, titolo, unita = 'kg', segni = [], altezza = 150, decimali = 1 }) {
  const figura = el('figure.grafico');

  if (!punti || punti.length < 2) {
    figura.append(
      el('figcaption', { testo: titolo }),
      el('p.vuoto', { testo: punti?.length === 1 ? 'Una sola misurazione: serve una seconda volta per vedere l\'andamento.' : 'Nessun dato ancora.' }));
    return figura;
  }

  const L = 38, R = 14, T = 12, B = 22;          // margini interni
  const W = 320, H = altezza;
  const pw = W - L - R, ph = H - T - B;

  const t = punti.map(p => daISO(p.x).getTime());
  const t0 = Math.min(...t), t1 = Math.max(...t);
  const sy = scala(punti.map(p => p.y));
  const X = ms => L + (t1 === t0 ? pw / 2 : (ms - t0) / (t1 - t0) * pw);
  const Y = v => T + ph - (v - sy.min) / (sy.max - sy.min) * ph;

  const svg = s('svg', {
    viewBox: `0 0 ${W} ${H}`, class: 'tela', role: 'img',
    'aria-label': `${titolo}: da ${nkg(punti[0].y, decimali)} ${unita} il ${dataBreve(punti[0].x)} a ${nkg(punti.at(-1).y, decimali)} ${unita} il ${dataBreve(punti.at(-1).x)}`,
  });

  // griglia: linee piene sottilissime, un tono sopra lo sfondo
  const linee = Math.round((sy.max - sy.min) / sy.passo);
  for (let i = 0; i <= linee; i++) {           // contatore intero: sommare il
    const v = sy.min + i * sy.passo;           // passo accumula errore e salta
    svg.append(s('line', { x1: L, x2: W - R, y1: Y(v), y2: Y(v), class: 'griglia' }));
    svg.append(s('text', { x: L - 6, y: Y(v) + 3.5, class: 'tacca', 'text-anchor': 'end',
                           textContent: nkg(v, sy.passo < 1 ? (sy.passo < 0.1 ? 2 : 1) : 0) }));
  }
  // i marcatori verticali (cambio scheda) stanno sotto la linea dei dati
  segni.filter(g => daISO(g.x).getTime() >= t0 && daISO(g.x).getTime() <= t1).forEach(g => {
    svg.append(s('line', { x1: X(daISO(g.x).getTime()), x2: X(daISO(g.x).getTime()), y1: T, y2: T + ph, class: 'segno' }));
  });

  const d = punti.map((p, i) => `${i ? 'L' : 'M'}${X(t[i]).toFixed(1)} ${Y(p.y).toFixed(1)}`).join(' ');
  svg.append(s('path', { d, class: 'linea' }));

  punti.forEach((p, i) => {
    svg.append(s('circle', { cx: X(t[i]), cy: Y(p.y), r: 4, class: 'punto', 'data-i': i }));
  });

  // etichette dirette solo agli estremi: un numero su ogni punto è illeggibile
  const etichetta = (i, ancora) => s('text', {
    x: X(t[i]) + (ancora === 'end' ? 6 : -6), y: Y(punti[i].y) - 8,
    class: 'valore', 'text-anchor': ancora === 'end' ? 'end' : 'start',
    textContent: nkg(punti[i].y, decimali) + ' ' + unita,
  });
  svg.append(etichetta(0, 'start'), etichetta(punti.length - 1, 'end'));

  svg.append(s('text', { x: L, y: H - 6, class: 'tacca', textContent: dataBreve(punti[0].x) }));
  svg.append(s('text', { x: W - R, y: H - 6, class: 'tacca', 'text-anchor': 'end', textContent: dataBreve(punti.at(-1).x) }));

  // lettura al tocco: una riga di testo sotto il titolo, non un fumetto che
  // sparisce appena stacchi il dito
  const lettura = el('figcaption.lettura', { 'aria-live': 'polite' },
    el('span.eti', { testo: titolo }),
    el('span.val', { testo: `${nkg(punti.at(-1).y, decimali)} ${unita} · ${dataBreve(punti.at(-1).x)}` }));

  const mirino = s('line', { class: 'mirino', y1: T, y2: T + ph, x1: 0, x2: 0, visibility: 'hidden' });
  svg.append(mirino);

  const vicino = e => {
    const r = svg.getBoundingClientRect();
    const xv = (e.clientX - r.left) / r.width * W;
    let best = 0;
    punti.forEach((p, i) => { if (Math.abs(X(t[i]) - xv) < Math.abs(X(t[best]) - xv)) best = i; });
    const p = punti[best];
    mirino.setAttribute('visibility', 'visible');
    mirino.setAttribute('x1', X(t[best])); mirino.setAttribute('x2', X(t[best]));
    lettura.querySelector('.val').textContent =
      `${nkg(p.y, decimali)} ${unita} · ${dataBreve(p.x)}${p.nota ? ' · ' + p.nota : ''}`;
  };
  svg.addEventListener('pointermove', vicino);
  svg.addEventListener('pointerdown', vicino);
  svg.addEventListener('pointerleave', () => {
    mirino.setAttribute('visibility', 'hidden');
    lettura.querySelector('.val').textContent = `${nkg(punti.at(-1).y, decimali)} ${unita} · ${dataBreve(punti.at(-1).x)}`;
  });

  figura.append(lettura, svg);
  return figura;
}
