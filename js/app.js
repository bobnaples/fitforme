/* Avvio e guscio dell'app: barra in basso, intestazione che si riduce,
   tema, semina del database al primo giro.
   La logica dei moduli non sta qui: ognuno ha la sua vista, caricata solo
   quando apri quella scheda la prima volta. */

import { primoAvvio, prefs, salvaPrefs } from './store.js';
import { $, $$, el, dataLunga, oggiISO } from './ui.js';
import { icona } from './icone.js';

const MODULI = {
  oggi: {
    etichetta: 'Oggi', icona: 'oggi', titolo: 'Oggi',
    sottotitolo: () => dataLunga(oggiISO()),
    carica: () => import('./oggi/vista.js'),
  },
  pasti: {
    etichetta: 'Pasti', icona: 'pasti', titolo: 'Pasti',
    sottotitolo: () => 'pranzo 45 g · cena 40 g proteine · ~25 g grassi a pasto',
    carica: () => import('./pasti/vista.js'),
  },
  allenamento: {
    etichetta: 'Allenamento', icona: 'allenamento', titolo: 'Allenamento',
    sottotitolo: () => 'schede A · B · C',
    carica: () => import('./allenamento/vista.js'),
  },
  corpo: {
    etichetta: 'Corpo', icona: 'corpo', titolo: 'Peso e misure',
    sottotitolo: () => 'peso ogni mattina, circonferenze ogni due settimane',
    carica: () => import('./corpo/vista.js'),
  },
  dati: {
    etichetta: 'Dati', icona: 'dati', titolo: 'Dati',
    sottotitolo: () => 'esportazione, importazione, preferenze',
    carica: () => import('./dati/vista.js'),
  },
};

const montati = new Set();

/* ====================== navigazione ====================== */

function costruisciBarra() {
  const barra = $('#barra');
  Object.entries(MODULI).forEach(([nome, m]) => {
    barra.append(el('button', {
      role: 'tab', id: 'tab-' + nome, 'aria-controls': 'p-' + nome,
      'aria-selected': false, tabindex: -1,
      onclick: () => { location.hash = nome; },
    },
      el('span.punto'),
      icona(m.icona),
      el('span', { testo: m.etichetta })));
  });

  barra.addEventListener('keydown', e => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const tabs = $$('button', barra);
    const i = tabs.indexOf(document.activeElement);
    if (i < 0) return;
    const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    location.hash = n.id.replace('tab-', '');
    n.focus();
  });
}

async function apri(nome, { forza = false } = {}) {
  if (!MODULI[nome]) nome = 'oggi';
  const m = MODULI[nome];

  $$('#barra button').forEach(t => {
    const attivo = t.id === 'tab-' + nome;
    t.setAttribute('aria-selected', attivo);
    t.tabIndex = attivo ? 0 : -1;
    $('#' + t.getAttribute('aria-controls')).hidden = !attivo;
  });
  $('#titolo').textContent = m.titolo;
  $('#sottotitolo').textContent = m.sottotitolo();
  document.title = nome === 'oggi' ? 'FitForMe' : 'FitForMe — ' + m.titolo;
  scrollTo({ top: 0, behavior: 'instant' });

  const pannello = $('#p-' + nome);
  pannello.classList.remove('anima');
  void pannello.offsetWidth;          // forza il riavvio dell'animazione
  pannello.classList.add('anima');

  if (montati.has(nome) && !forza) return;
  montati.add(nome);
  try {
    const modulo = await m.carica();
    await modulo.monta(pannello);
  } catch (errore) {
    montati.delete(nome);
    console.error('Modulo «%s» non caricato:', nome, errore);
    pannello.replaceChildren(el('div.incorso', {},
      el('b', { testo: m.titolo }),
      ' — questo modulo non si è caricato. Gli altri continuano a funzionare.'));
  }
}

/* Ricarica un modulo già aperto: lo chiama chi cambia dati che si vedono
   altrove, per esempio la palestra quando chiude una seduta. */
export function invalida(...nomi) {
  nomi.forEach(n => montati.delete(n));
  const attuale = daHash();
  if (nomi.includes(attuale)) apri(attuale, { forza: true });
}
window.fitforme = { invalida };

const daHash = () => (location.hash.replace('#', '') || 'oggi').split('/')[0];

/* La scorciatoia «In palestra» della schermata home apre index.html#palestra:
   non è una scheda, è l'allenamento con la palestra già aperta. */
async function forseApriPalestra() {
  if (daHash() !== 'palestra') return false;
  history.replaceState(null, '', '#allenamento');
  await apri('allenamento');
  const palestra = await import('./allenamento/palestra.js');
  await palestra.apri({ onChiudi: () => invalida('oggi', 'allenamento') });
  return true;
}

/* La barra in basso cambia altezza con le etichette a capo e con la zona
   sicura del telefono: la misuriamo davvero invece di indovinarla. */
function misuraBarra() {
  const barra = $('#barra');
  const scrivi = () => document.documentElement.style
    .setProperty('--barra', Math.ceil(barra.getBoundingClientRect().height) + 'px');
  scrivi();
  new ResizeObserver(scrivi).observe(barra);
  addEventListener('orientationchange', () => setTimeout(scrivi, 150));
}

/* ====================== intestazione che si riduce ====================== */

function collegaScorrimento() {
  const testa = $('#testa');
  let ultimo = false;
  addEventListener('scroll', () => {
    const giu = scrollY > 12;
    if (giu !== ultimo) { testa.classList.toggle('staccata', giu); ultimo = giu; }
  }, { passive: true });
}

/* ====================== tema ====================== */

const ORDINE_TEMA = ['scuro', 'chiaro', 'auto'];
const ICONA_TEMA = { scuro: 'luna', chiaro: 'sole', auto: 'auto' };

export async function applicaTema() {
  const { tema } = await prefs();
  document.documentElement.setAttribute(
    'data-theme', tema === 'chiaro' ? 'light' : tema === 'auto' ? 'auto' : 'dark');
  document.querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', tema === 'chiaro' ? '#F3EFE4' : '#0D1411');
  const b = $('#btn-tema');
  if (b) {
    b.replaceChildren(icona(ICONA_TEMA[tema] || 'luna'));
    b.setAttribute('aria-label', `Tema: ${tema}. Tocca per cambiarlo.`);
  }
}
addEventListener('fitforme:tema', applicaTema);

async function giraTema() {
  const { tema } = await prefs();
  const prossimo = ORDINE_TEMA[(ORDINE_TEMA.indexOf(tema) + 1) % ORDINE_TEMA.length];
  await salvaPrefs({ tema: prossimo });
  await applicaTema();
  try { navigator.vibrate?.(20); } catch {}
}

/* ====================== service worker ====================== */

function avvisoAggiornamento(registrazione) {
  if (document.querySelector('.aggiorna')) return;
  document.body.append(el('div.aggiorna', { role: 'status' },
    el('span', { testo: 'C\'è una versione nuova.' }),
    el('button', {
      testo: 'Aggiorna',
      onclick: () => {
        registrazione.waiting?.postMessage('aggiorna-ora');
        registrazione.waiting?.addEventListener('statechange', e => {
          if (e.target.state === 'activated') location.reload();
        });
      },
    })));
}

async function registraSW() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.register('sw.js', { scope: './' });
    if (reg.waiting) avvisoAggiornamento(reg);
    reg.addEventListener('updatefound', () => {
      const nuovo = reg.installing;
      nuovo?.addEventListener('statechange', () => {
        if (nuovo.state === 'installed' && navigator.serviceWorker.controller) avvisoAggiornamento(reg);
      });
    });
  } catch (e) {
    console.warn('Service worker non registrato:', e.message);
  }
}

/* ====================== avvio ====================== */

(async function avvia() {
  await applicaTema();
  const seminato = await primoAvvio();
  if (seminato) console.info('Database creato e popolato con lo storico del tracker.');
  costruisciBarra();
  misuraBarra();
  collegaScorrimento();
  $('#btn-tema').addEventListener('click', giraTema);
  addEventListener('hashchange', async () => {
    if (await forseApriPalestra()) return;
    apri(daHash());
  });
  if (!await forseApriPalestra()) await apri(daHash());
  registraSW();
})();
