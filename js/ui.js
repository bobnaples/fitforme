/* Piccoli aiuti condivisi: creazione di elementi, formattazione all'italiana,
   date. Nessuna dipendenza esterna. */

export const esc = s => String(s).replace(/[&<>"]/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* el('div.classe', {attributi}, ...figli) */
export function el(selettore, attributi = {}, ...figli) {
  const [tag, ...classi] = selettore.split('.');
  const n = document.createElement(tag || 'div');
  if (classi.length) n.className = classi.join(' ');
  for (const [k, v] of Object.entries(attributi)) {
    if (v === null || v === undefined) continue;
    // aria-* vuole la stringa "true"/"false": un attributo vuoto non conta
    // come pressed, e un attributo assente non conta come non-pressed.
    const aria = k.startsWith('aria-');
    if (v === false && !aria) continue;
    if (k === 'testo') n.textContent = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'dataset') Object.assign(n.dataset, v);
    else n.setAttribute(k, aria ? String(v) : v === true ? '' : v);
  }
  for (const f of figli.flat()) {
    if (f === null || f === undefined || f === false) continue;
    n.append(f.nodeType ? f : document.createTextNode(String(f)));
  }
  return n;
}

export const $ = (sel, dentro = document) => dentro.querySelector(sel);
export const $$ = (sel, dentro = document) => [...dentro.querySelectorAll(sel)];
export const svuota = n => { while (n.firstChild) n.firstChild.remove(); return n; };

/* --- numeri: virgola decimale, niente zeri inutili --- */
export function nkg(v, decimali = 1) {
  if (v === null || v === undefined || v === '' || Number.isNaN(v)) return '—';
  let t = Number(v).toFixed(decimali);
  // gli zeri inutili si tolgono solo dopo la virgola: senza questo controllo
  // «90» con zero decimali diventerebbe «9»
  if (t.includes('.')) t = t.replace(/\.?0+$/, '');
  return t.replace('.', ',');
}
export const npiu = v => (v > 0 ? '+' : v < 0 ? '−' : '') + nkg(Math.abs(v));

/* --- date: chiave ISO nel database, testo italiano a schermo --- */
export const oggiISO = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
};
export const daISO = iso => {
  const [a, m, g] = iso.split('-').map(Number);
  return new Date(a, m - 1, g);
};
export const giorniFra = (isoA, isoB) =>
  Math.round((daISO(isoB) - daISO(isoA)) / 864e5);
export const sommaGiorni = (iso, n) => {
  const d = daISO(iso); d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const fmtLungo = new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtBreve = new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: '2-digit' });

export const dataLunga = iso => fmtLungo.format(daISO(iso));
export const dataBreve = iso => fmtBreve.format(daISO(iso));

/* «oggi», «ieri», «3 giorni fa», poi la data vera */
export function quando(iso) {
  const d = giorniFra(iso, oggiISO());
  if (d === 0) return 'oggi';
  if (d === 1) return 'ieri';
  if (d < 0) return dataBreve(iso);
  if (d < 7) return `${d} giorni fa`;
  if (d < 14) return 'la settimana scorsa';
  return dataBreve(iso);
}

/* --- tempo: 180 -> «3:00» ---
   Arrotonda per eccesso: in un conto alla rovescia «0:00» deve comparire
   quando il tempo è finito davvero, non mezzo secondo prima. */
export const mmss = secondi => {
  const s = Math.max(0, Math.ceil(secondi - 1e-6));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/* Messaggio temporaneo su un pulsante, senza perdere l'etichetta originale */
export function conferma(bottone, messaggio, ms = 2200) {
  const originale = bottone.dataset.etichetta || bottone.textContent;
  bottone.dataset.etichetta = originale;
  bottone.textContent = messaggio;
  clearTimeout(bottone._t);
  bottone._t = setTimeout(() => { bottone.textContent = originale; }, ms);
}
