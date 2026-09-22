/* Modulo PASTI: le tre sezioni del generatore originale (Cosa ho, Settimana,
   Scambi), con in più il salvataggio su IndexedDB degli ingredienti scelti
   e dell'ultima settimana generata. */

import { ING, VERDURE, TARGET, GIORNI, QUOTE, POOL, CARBS, ALT_FAT,
         PROT_FISSE, SOGLIA, SCAMBI, REPARTI, PARTE_FISSA } from './dati.js';
import { combo, completa, sumN, label, testo, pick, mescola, suggerisci,
         candidati, migliorParziale } from './motore.js';
import { esc, el, $, $$, svuota, conferma, oggiISO, dataBreve } from '../ui.js';
import { db } from '../store.js';

const CHIAVE_ING = 'pasti_ingredienti';
const CHIAVE_SETT = 'pasti_settimana';

/* ====================== struttura del pannello ====================== */

const IMPIANTO = `
<nav class="sottonav" role="tablist" aria-label="Sezioni dei pasti">
  <button role="tab" data-sez="frigo"  aria-selected="true">Cosa ho</button>
  <button role="tab" data-sez="sett"   aria-selected="false" tabindex="-1">Settimana</button>
  <button role="tab" data-sez="scambi" aria-selected="false" tabindex="-1">Scambi</button>
</nav>

<div data-pannello="frigo">
  <section class="scheda">
    <h2 class="stit">Cosa hai <small>tocca gli ingredienti</small></h2>
    <div class="seg" role="group" aria-label="Pasto">
      <button type="button" data-tipo="p" aria-pressed="true">Pranzo</button>
      <button type="button" data-tipo="c" aria-pressed="false">Cena</button>
    </div>
    <div id="chips-frigo"></div>
    <button class="cta" id="btn-frigo" type="button">Crea le combinazioni</button>
  </section>
  <section id="ris-frigo-box" class="hide">
    <h2 class="stit">Combinazioni <small id="ris-lab"></small></h2>
    <div id="ris-frigo"></div>
    <div class="azioni"><button class="ghost hide" id="btn-altre" type="button">Mostrane altre</button></div>
  </section>
</div>

<div data-pannello="sett" hidden>
  <section class="scheda">
    <h2 class="stit">Rotazione <small>14 pasti principali</small></h2>
    <div class="rot">
      <span><b>4×</b> pesce (2 grasso)</span><span><b>3×</b> carne bianca</span><span><b>2×</b> carne rossa</span>
      <span><b>2×</b> uova</span><span><b>2×</b> latticini</span><span><b>1×</b> legumi / tofu</span>
    </div>
    <button class="cta" id="btn-sett" type="button" style="margin-top:4px">Genera la settimana</button>
  </section>
  <section class="scheda">
    <h2 class="stit">La settimana <small id="lab-sett">da generare</small></h2>
    <div id="griglia"><p class="vuoto">Premi «Genera la settimana».</p></div>
    <p class="nota hide" id="nota-sett">↻ cambia il singolo pasto restando nella stessa categoria.
      L'olio è calcolato sulla fonte proteica: con salmone, uova o feta ne serve poco o niente.</p>
  </section>
  <section id="blocco-spesa" class="hide">
    <h2 class="stit">Lista della spesa <small>quantità già sommate</small></h2>
    <div id="spesa"></div>
    <div class="azioni">
      <button class="ghost" id="btn-copia" type="button">Copia la lista</button>
      <button class="ghost" id="btn-stampa" type="button">Stampa</button>
    </div>
  </section>
</div>

<div data-pannello="scambi" hidden>
  <section class="scheda">
    <h2 class="stit">Tabella scambi <small>tutte equivalenti</small></h2>
    <div class="seg" role="group" aria-label="Pasto">
      <button type="button" data-tipo="p" aria-pressed="true">Pranzo</button>
      <button type="button" data-tipo="c" aria-pressed="false">Cena</button>
    </div>
    <div class="tabwrap"><table id="tab-scambi-t"></table></div>
    <p class="nota">Ogni riga vale una porzione proteica e si sostituisce a qualsiasi altra.
      L'olio è calcolato per chiudere il pasto a ~25 g di grassi con il riso come carboidrato.
      Legumi pesati a secco: contano anche come carboidrato, quindi il riso si riduce.</p>
  </section>
</div>`;

/* ====================== stato del modulo ====================== */

let radice = null;
let sel = new Set(['olio']);
let tipoF = 'p';
let lista = [], offset = 0, ctx = null;
let piano = [];      // [[pranzo, cena] × 7] — solo il seme, i grammi si ricalcolano

const dentro = (sel_, r = radice) => r.querySelector(sel_);

/* ====================== persistenza ====================== */

const salvaIngredienti = () =>
  db.salvaMeta(CHIAVE_ING, { sel: [...sel], tipo: tipoF });

const salvaSettimana = () =>
  db.salvaMeta(CHIAVE_SETT, { generatoIl: oggiISO(), piano });

/* ====================== COSA HO IN FRIGO ====================== */

function disegnaChips() {
  const box = dentro('#chips-frigo');
  svuota(box);
  const mk = (chiave, txt) => {
    const b = el('button.chip', { type: 'button', testo: txt, 'aria-pressed': sel.has(chiave) });
    b.addEventListener('click', () => {
      sel.has(chiave) ? sel.delete(chiave) : sel.add(chiave);
      b.setAttribute('aria-pressed', sel.has(chiave));
      salvaIngredienti();
    });
    return b;
  };
  const gruppo = (etichetta, voci) => {
    box.append(el('p.glab', { testo: etichetta }));
    box.append(el('div.chips', {}, voci));
  };
  [['PROTEINE', 'prot'], ['CARBOIDRATI', 'carb'], ['GRASSI', 'grasso']].forEach(([lab, cat]) =>
    gruppo(lab, Object.entries(ING).filter(([, v]) => v.cat === cat).map(([k, v]) => mk(k, v.s || v.n))));
  gruppo('VERDURE', VERDURE.map(v => mk('v:' + v, v)));
}

function cardPasto(titolo, r, verd, tipo) {
  const T = TARGET[tipo].P;
  const d = el('div.opz');
  const manca = Math.round(T - r.protP);
  const okP = r.protP >= T - 3;
  let h = '<h3><span>' + esc(titolo) + '</span><span class="badge ' + (okP ? 'ok' : 'basso') + '">' +
          Math.round(r.protP) + ' g proteine</span></h3>';
  const righe = r.items.concat(r.carb ? [r.carb] : [], r.fat ? [r.fat] : []);
  righe.forEach(([id, g]) => {
    const [a, b] = label(id, g);
    h += '<div class="voce"><span class="n">' + esc(a) + '</span><span class="leader"></span><span class="q">' + esc(b || '') + '</span></div>';
  });
  h += '<div class="voce"><span class="n">' + esc(verd.length ? verd.join(', ') : 'Verdura a scelta') +
       '</span><span class="leader"></span><span class="q">200 g+</span></div>';
  h += '<p class="tot">Totale pasto: ' + Math.round(r.P) + ' g proteine · ' + Math.round(r.C) +
       ' g carboidrati · ' + Math.round(r.F) + ' g grassi · ~' + Math.round(r.kcal / 10) * 10 + ' kcal</p>';
  const note = [];
  if (r.fatNota) note.push(r.fatNota);
  if (r.items.some(([id]) => ING[id].leg)) note.push('Legumi pesati a secco: contano anche come carboidrato, per questo il cereale è ridotto o assente.');
  if (verd.includes('Zucca')) note.push('La zucca conta come verdura, non come carboidrato.');
  if (!okP) note.push('Mancano ~' + manca + ' g di proteine: aggiungi ' + suggerisci(manca) + '.');
  note.forEach(t => h += '<p class="nt">' + esc(t) + '</p>');
  d.innerHTML = h;
  return d;
}

function mostraFrigo() {
  const box = dentro('#ris-frigo');
  svuota(box);
  const { carbs, fats, verd, tipo } = ctx;
  lista.slice(offset, offset + 3).forEach((x, i) => {
    const k = offset + i;
    const r = completa(x.items, carbs.length ? carbs[k % carbs.length] : null,
                       fats.length ? fats[k % fats.length] : 'olio', tipo);
    const v = verd.length
      ? [verd[(2 * k) % verd.length], verd[(2 * k + 1) % verd.length]].filter((a, j, s) => s.indexOf(a) === j)
      : [];
    box.append(cardPasto('Opzione ' + (k + 1), r, v, tipo));
  });
  dentro('#ris-lab').textContent = (tipo === 'p' ? 'pranzo' : 'cena') + ' · ' + lista.length + ' possibili';
  dentro('#btn-altre').classList.toggle('hide', lista.length <= 3);
}

function creaFrigo() {
  const all = [...sel];
  const prot = all.filter(id => ING[id] && ING[id].cat === 'prot');
  const carbs = all.filter(id => ING[id] && ING[id].cat === 'carb');
  const fats = all.filter(id => ING[id] && ING[id].cat === 'grasso');
  const verd = all.filter(id => id.startsWith('v:')).map(id => id.slice(2));
  ctx = { carbs, fats, verd, tipo: tipoF };

  const boxW = dentro('#ris-frigo-box'), box = dentro('#ris-frigo');
  boxW.classList.remove('hide');
  dentro('#btn-altre').classList.add('hide');
  if (!prot.length) { box.innerHTML = '<p class="vuoto">Scegli almeno una fonte proteica.</p>'; return; }

  lista = candidati(prot, tipoF); offset = 0;
  const pre = [];
  if (!carbs.length) pre.push('Nessun carboidrato scelto: il pasto resta corto di calorie. Aggiungine uno se puoi.');
  if (!lista.length) {
    const b = migliorParziale(prot, tipoF);
    box.innerHTML = '<div class="avviso">Con queste proteine non arrivi a ' + TARGET[tipoF].P +
                    ' g. <span>Ecco il massimo che puoi fare, con cosa aggiungere.</span></div>';
    box.append(cardPasto('Il meglio possibile',
      completa(b.items, carbs[0] || null, fats[0] || 'olio', tipoF), verd.slice(0, 2), tipoF));
  } else {
    mostraFrigo();
  }
  pre.forEach(t => box.insertAdjacentHTML('afterbegin', '<div class="avviso">' + esc(t) + '</div>'));
  boxW.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
}

/* ====================== SETTIMANA ====================== */

/* Del piano salvo solo il seme — categoria, ingredienti, carboidrato, grasso.
   I grammi li ricalcola il motore a ogni apertura: il record resta piccolo
   e resta coerente anche se un domani cambiano i target. */
function nuovoPasto(cat, tipo, escludi) {
  const pool = POOL[cat].filter(s => s.join() !== escludi);
  const ids = pick(pool.length ? pool : POOL[cat]);
  return { cat, tipo, ids, carbId: pick(CARBS), fatId: Math.random() < 0.65 ? 'olio' : pick(ALT_FAT) };
}
const calcola = x => completa(combo(x.ids, x.tipo, true), x.carbId, x.fatId, x.tipo);

function generaSett() {
  const cats = mescola(QUOTE);
  piano = GIORNI.map((_, g) => [nuovoPasto(cats[g * 2], 'p'), nuovoPasto(cats[g * 2 + 1], 'c')]);
  disegnaSett();
  salvaSettimana();
}

function disegnaSett(generatoIl = null) {
  const box = dentro('#griglia');
  svuota(box);
  piano.forEach((pasti, g) => {
    const calcolati = pasti.map(calcola);
    const tot = Math.round(PROT_FISSE + calcolati.reduce((s, r) => s + r.protP, 0));
    const d = el('div.giorno');
    d.innerHTML = '<div class="dnome"><span>' + GIORNI[g] + '</span><span class="badge ' +
                  (tot >= SOGLIA ? 'ok' : 'basso') + '">' + tot + ' g proteine</span></div>';
    pasti.forEach((x, k) => {
      const r = calcolati[k];
      const side = [];
      if (r.carb) side.push(testo(...r.carb));
      side.push(r.fat ? testo(...r.fat) : 'niente olio');
      side.push('verdura 200 g+');
      const row = el('div.pasto');
      row.innerHTML = '<div class="plab">' + (k ? 'CENA' : 'PRANZO') + '</div><div class="pbody"><div class="pmain">' +
        esc(r.items.map(([id, gr]) => testo(id, gr)).join(' + ')) + '</div><div class="pside">' +
        esc(side.join(' · ')) + '</div></div>';
      row.append(el('button.swap', {
        type: 'button', testo: '↻',
        'aria-label': 'Cambia ' + (k ? 'cena' : 'pranzo') + ' di ' + GIORNI[g],
        onclick: () => {
          piano[g][k] = nuovoPasto(x.cat, x.tipo, x.ids.join());
          disegnaSett();
          salvaSettimana();
        },
      }));
      d.append(row);
    });
    if (tot < SOGLIA) {
      d.append(el('div.integra', { testo: 'Integra nello spuntino: ' + suggerisci(162 - tot) }));
    }
    box.append(d);
  });
  dentro('#lab-sett').textContent = generatoIl
    ? '7 giorni · generata il ' + dataBreve(generatoIl)
    : '7 giorni · 14 pasti';
  dentro('#nota-sett').classList.remove('hide');
  dentro('#blocco-spesa').classList.remove('hide');
  disegnaSpesa();
}

function disegnaSpesa() {
  const s = {};
  piano.flat().map(calcola).forEach(r => {
    r.items.concat(r.carb ? [r.carb] : [], r.fat ? [r.fat] : [])
      .forEach(([id, g]) => { s[id] = (s[id] || 0) + g; });
  });
  const fmt = (id, v) => {
    const i = ING[id];
    if (i.pz) return v + ' pz';
    if (i.ml) return v + ' ml';
    if (v >= 1000) return (Math.ceil(v / 50) * 50 / 1000).toFixed(2).replace('.', ',').replace(/0$/, '').replace(/,0$/, '') + ' kg';
    return Math.ceil(v / 10) * 10 + ' g';
  };
  const voci = Object.entries(s).map(([id, v]) => [ING[id].rep, ING[id].n, fmt(id, v)]);
  PARTE_FISSA.forEach(v => voci.push(['Parte fissa', v[0], v[1]]));

  const box = dentro('#spesa');
  svuota(box);
  REPARTI.forEach(rep => {
    const gr = voci.filter(v => v[0] === rep);
    if (!gr.length) return;
    box.insertAdjacentHTML('beforeend', '<p class="reparto">' + rep.toUpperCase() + '</p>');
    gr.sort((a, b) => a[1].localeCompare(b[1], 'it')).forEach(v =>
      box.insertAdjacentHTML('beforeend', '<div class="voce"><span class="n">' + esc(v[1]) +
        '</span><span class="leader"></span><span class="q">' + esc(v[2]) + '</span></div>'));
  });
}

async function copiaLista(e) {
  const b = e.currentTarget;
  let txt = 'LISTA DELLA SPESA\n';
  $$('#spesa > *', radice).forEach(n => {
    txt += n.classList.contains('reparto')
      ? '\n' + n.textContent + '\n'
      : '- ' + $('.n', n).textContent + ': ' + $('.q', n).textContent + '\n';
  });
  try {
    await navigator.clipboard.writeText(txt.trim());
    conferma(b, 'Lista copiata');
  } catch {
    const ta = el('textarea', { style: 'position:fixed;opacity:0' });
    ta.value = txt; document.body.append(ta); ta.select();
    try { document.execCommand('copy'); conferma(b, 'Lista copiata'); }
    catch { conferma(b, 'Copia non disponibile'); }
    ta.remove();
  }
}

/* ====================== SCAMBI ====================== */

function disegnaScambi(tipo) {
  let h = '<thead><tr><th>Combinazione</th><th class="num">Proteine</th><th class="num">Grassi</th><th class="num">Olio</th></tr></thead><tbody>';
  SCAMBI.forEach(([g, rows]) => {
    h += '<tr class="grp"><td colspan="4">' + g + '</td></tr>';
    rows.forEach(ids => {
      const items = combo(ids, tipo, true), r = completa(items, 'riso', 'olio', tipo);
      const fp = sumN(items).f;
      h += '<tr><td>' + esc(items.map(([id, gr]) => testo(id, gr)).join(' + ')) +
           '</td><td class="num">' + Math.round(r.protP) +
           ' g</td><td class="num">' + Math.round(fp) +
           ' g</td><td class="num">' + (r.fat ? r.fat[1] + ' ml' : '—') + '</td></tr>';
    });
  });
  dentro('#tab-scambi-t').innerHTML = h + '</tbody>';
}

/* ====================== montaggio ====================== */

function segmento(dove, alCambio) {
  const bs = $$('.seg button', dove);
  bs.forEach(b => b.addEventListener('click', () => {
    bs.forEach(x => x.setAttribute('aria-pressed', x === b));
    alCambio(b.dataset.tipo);
  }));
}

function collegaSottonav() {
  const bs = $$('.sottonav button', radice);
  const vai = b => {
    bs.forEach(x => {
      const on = x === b;
      x.setAttribute('aria-selected', on);
      x.tabIndex = on ? 0 : -1;
      dentro(`[data-pannello="${x.dataset.sez}"]`).hidden = !on;
    });
  };
  bs.forEach((b, i) => {
    b.addEventListener('click', () => vai(b));
    b.addEventListener('keydown', e => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const n = bs[(i + (e.key === 'ArrowRight' ? 1 : bs.length - 1)) % bs.length];
      vai(n); n.focus();
    });
  });
}

export async function monta(pannello) {
  radice = pannello;
  pannello.innerHTML = IMPIANTO;
  collegaSottonav();

  // ingredienti dell'ultima volta
  const salvati = await db.meta(CHIAVE_ING);
  if (salvati) {
    sel = new Set(salvati.sel);
    tipoF = salvati.tipo || 'p';
    $$(`[data-pannello="frigo"] .seg button`, radice)
      .forEach(b => b.setAttribute('aria-pressed', b.dataset.tipo === tipoF));
  }
  disegnaChips();

  segmento(dentro('[data-pannello="frigo"]'), t => { tipoF = t; salvaIngredienti(); });
  dentro('#btn-frigo').addEventListener('click', creaFrigo);
  dentro('#btn-altre').addEventListener('click', () => {
    offset = offset + 3 >= lista.length ? 0 : offset + 3;
    mostraFrigo();
  });

  dentro('#btn-sett').addEventListener('click', generaSett);
  dentro('#btn-stampa').addEventListener('click', () => window.print());
  dentro('#btn-copia').addEventListener('click', copiaLista);

  // ultima settimana generata
  const settimana = await db.meta(CHIAVE_SETT);
  if (settimana?.piano?.length) {
    piano = settimana.piano;
    disegnaSett(settimana.generatoIl);
  }

  segmento(dentro('[data-pannello="scambi"]'), disegnaScambi);
  disegnaScambi('p');
}
