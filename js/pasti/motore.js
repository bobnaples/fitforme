/* Il motore di calcolo dei pasti, identico all'originale: stesse formule,
   stessi arrotondamenti, stessi risultati. Qui non si tocca nulla —
   cambiare un numero significa cambiare i grammi che finiscono nel piatto. */

import { ING, TARGET, TOLL } from './dati.js';

export const round = (id, g) => { const r = ING[id].rnd || 10; return Math.max(r, Math.round(g / r) * r); };

export const nutr = (id, g) => {
  const i = ING[id];
  if (i.ml) return {p:0, c:0, f:g * i.f};
  const k = i.pz ? g : g / 100;
  return {p:i.p * k, c:i.c * k, f:i.f * k};
};

export const need = (id, P) => ING[id].pz ? P / ING[id].p : P / ING[id].p * 100;

export const sumN = list => list.reduce((s, [id, g]) => {
  const n = nutr(id, g); s.p += n.p; s.c += n.c; s.f += n.f; return s;
}, {p:0, c:0, f:0});

/* ids = [singolo] oppure [base, riempitivo]. force = restituisce anche se sotto soglia */
export function combo(ids, tipo, force){
  const T = TARGET[tipo].P, sc = tipo === 'c' ? 0.85 : 1;
  let items;
  if (ids.length === 1){
    const id = ids[0];
    items = [[id, Math.min(round(id, need(id, T)), ING[id].max)]];
  } else {
    const [a, b] = ids, A = ING[a];
    if (!A.base) return null;
    const ga = Math.min(A.pz ? A.base : round(a, A.base * sc), A.max);
    const rest = T - nutr(a, ga).p;
    const gb = Math.min(round(b, need(b, rest)), ING[b].max);
    items = [[a, ga], [b, gb]];
  }
  const P = sumN(items).p;
  if (!force && P < T - TOLL) return null;
  return items;
}

export function completa(items, carbId, fatId, tipo){
  const T = TARGET[tipo];
  const all = items.slice();
  let n = sumN(all);
  let carb = null, fat = null, fatNota = null;
  if (carbId){
    const restC = T.C - n.c;
    if (restC >= 20){ carb = [carbId, round(carbId, restC / ING[carbId].c * 100)]; all.push(carb); n = sumN(all); }
  }
  const restF = T.F - n.f;
  if (restF > 3){
    const id = fatId || 'olio', F = ING[id];
    const g = F.ml ? round(id, restF / F.f) : Math.min(round(id, restF / F.f * 100), F.max);
    fat = [id, g]; all.push(fat); n = sumN(all);
  } else {
    fatNota = restF < -3
      ? 'Grassi già oltre il previsto: niente olio, e scegli un contorno semplice.'
      : 'I grassi li porta già la fonte proteica: niente olio.';
  }
  return {items, carb, fat, fatNota, P:n.p, C:n.c, F:n.f,
          kcal: 4 * n.p + 4 * n.c + 9 * n.f + 50, protP: sumN(items).p};
}

export const label = (id, g) => {
  const i = ING[id];
  if (i.pz) return [g === 1 ? '1 uovo' : g + ' uova', ''];
  if (i.ml) return [i.n, g + ' ml'];
  return [i.n, g + ' g'];
};
export const testo = (id, g) => { const [a, b] = label(id, g); return b ? a + ' ' + b : a; };

export const pick = a => a[Math.floor(Math.random() * a.length)];
export const mescola = a => {
  const x = a.slice();
  for (let i = x.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; }
  return x;
};

export function suggerisci(d){
  if (d <= 11) return '100 g di Philadelphia Protein o 100 g di albume';
  if (d <= 17) return '150 g di fiocchi di latte';
  if (d <= 25) return '30 g di whey dopo il pasto';
  return '150 g di albume o 100 g di tonno, più 30 g di whey';
}

/* --- combinazioni a partire da quello che hai in frigo --- */
export function candidati(prot, tipo){
  const singles = [], pairs = [];
  prot.forEach(a => { const c = combo([a], tipo); if (c) singles.push({lead:a, items:c}); });
  prot.forEach(a => {
    if (!ING[a].base) return;
    prot.forEach(b => {
      if (b === a || ING[b].nofill) return;
      const c = combo([a, b], tipo); if (c) pairs.push({lead:a, items:c});
    });
  });
  const uniq = arr => {
    const seen = new Set(), f = [], r = [];
    arr.forEach(x => { (seen.has(x.lead) ? r : f).push(x); seen.add(x.lead); });
    return [f, r];
  };
  const [p1, p2] = uniq(pairs), out = [];
  for (let i = 0; i < Math.max(singles.length, p1.length); i++){
    if (singles[i]) out.push(singles[i]);
    if (p1[i]) out.push(p1[i]);
  }
  return out.concat(p2);
}

export function migliorParziale(prot, tipo){
  let best = null;
  const prova = items => { if (!items) return; const P = sumN(items).p; if (!best || P > best.P) best = {items, P}; };
  prot.forEach(a => prova(combo([a], tipo, true)));
  prot.forEach(a => { if (ING[a].base) prot.forEach(b => { if (b !== a && !ING[b].nofill) prova(combo([a, b], tipo, true)); }); });
  return best;
}
