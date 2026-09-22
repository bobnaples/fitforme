/* Icone della barra in basso e dell'interfaccia: SVG scritti a mano, di
   tratto, coerenti fra loro (24×24, tratto 1.9, estremi arrotondati).
   Sono qui e non in un font perché in un font sarebbero un file in più da
   scaricare, e perché così prendono il colore del testo senza trucchi. */

const NS = 'http://www.w3.org/2000/svg';

const TRACCE = {
  oggi: ['M4 6.5h16v13.5H4z', 'M4 10.5h16', 'M8.5 3.5v4', 'M15.5 3.5v4', 'M12 15.5h.01'],
  pasti: ['M7 3.5v7a2.5 2.5 0 0 0 5 0v-7', 'M9.5 10.5V21', 'M17.5 3.5c-1.6 1-2.5 3-2.5 5.5s.9 3.5 2.5 3.5', 'M17.5 12.5V21'],
  allenamento: ['M3 12h18', 'M6.5 8.5v7', 'M17.5 8.5v7', 'M9.5 6.5v11', 'M14.5 6.5v11'],
  corpo: ['M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17z', 'M12 12l4-4', 'M12 12h.01'],
  dati: ['M12 3.5v10', 'M8.5 10l3.5 3.5 3.5-3.5', 'M4.5 16v3a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-3'],

  luna: ['M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z'],
  sole: ['M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9z', 'M12 2v2.5', 'M12 19.5V22',
         'M2 12h2.5', 'M19.5 12H22', 'M4.9 4.9l1.8 1.8', 'M17.3 17.3l1.8 1.8',
         'M19.1 4.9l-1.8 1.8', 'M6.7 17.3l-1.8 1.8'],
  auto: ['M12 20.5a8.5 8.5 0 1 0 0-17v17z', 'M12 20.5a8.5 8.5 0 1 1 0-17'],

  piu: ['M12 5v14', 'M5 12h14'],
  freccia: ['M5 12h14', 'M13 6l6 6-6 6'],
  peso: ['M4.5 20.5h15l-1.5-12h-12z', 'M9 8.5a3 3 0 1 1 6 0', 'M12 12v4'],
  metro: ['M3 8.5h18v7H3z', 'M7 8.5v3', 'M11 8.5v4.5', 'M15 8.5v3', 'M19 8.5v4.5'],
};

export function icona(nome, { dimensione = 24, classe = '' } = {}) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', dimensione);
  svg.setAttribute('height', dimensione);
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.9');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  if (classe) svg.setAttribute('class', classe);
  (TRACCE[nome] || []).forEach(d => {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', d);
    svg.append(p);
  });
  return svg;
}
