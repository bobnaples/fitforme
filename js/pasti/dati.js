/* Tabelle nutrizionali e regole della rotazione, riportate identiche dal
   generatore originale: valori per 100 g, uova per pezzo, olio per ml. */

export const ING = {
  pollo:        {n:'Petto di pollo',  cat:'prot', p:23,  c:0,   f:1.5, max:250, rep:'Macelleria'},
  tacchino:     {n:'Fesa di tacchino',cat:'prot', p:24,  c:0,   f:1,   max:250, rep:'Macelleria'},
  maiale:       {n:'Lonza / filetto di maiale', s:'Maiale magro', cat:'prot', p:21, c:0, f:3, max:250, rep:'Macelleria'},
  manzo:        {n:'Manzo magro',     cat:'prot', p:22,  c:0,   f:3,   max:250, rep:'Macelleria'},
  vitello:      {n:'Vitello',         cat:'prot', p:21,  c:0,   f:3,   max:250, rep:'Macelleria'},
  merluzzo:     {n:'Merluzzo',        cat:'prot', p:17.5,c:0,   f:0.7, max:300, rep:'Pescheria'},
  orata:        {n:'Orata / branzino',cat:'prot', p:19.5,c:0,   f:5,   max:280, rep:'Pescheria'},
  gamberi:      {n:'Gamberi',         cat:'prot', p:18,  c:0,   f:1,   max:300, rep:'Pescheria'},
  seppie:       {n:'Seppie / calamari',cat:'prot',p:16,  c:1,   f:1,   max:300, rep:'Pescheria'},
  salmone:      {n:'Salmone',         cat:'prot', p:20,  c:0,   f:13,  max:230, rep:'Pescheria'},
  sgombro:      {n:'Sgombro',         cat:'prot', p:17,  c:0,   f:11,  max:270, rep:'Pescheria'},
  tonno_fresco: {n:'Tonno fresco',    cat:'prot', p:24,  c:0,   f:2,   max:250, rep:'Pescheria'},
  tonno:        {n:'Tonno al naturale (sgocciolato)', s:'Tonno in scatola', cat:'prot', p:25, c:0, f:1, max:200, rep:'Dispensa'},
  uova:         {n:'Uova', cat:'prot', pz:true, p:6.5, c:0.4, f:5, max:5, base:3, rnd:1, rep:'Uova e latticini'},
  albume:       {n:'Albume',          cat:'prot', p:11,  c:0.7, f:0.2, max:300, rep:'Uova e latticini'},
  fiocchi:      {n:'Fiocchi di latte',cat:'prot', p:11.5,c:3,   f:4.3, max:400, base:200, rep:'Uova e latticini'},
  philadelphia: {n:'Philadelphia Protein', cat:'prot', p:11, c:5, f:2.5, max:150, base:150, nofill:true, rep:'Uova e latticini'},
  feta:         {n:'Feta light',      cat:'prot', p:19,  c:1,   f:12,  max:70,  base:70,  nofill:true, rep:'Uova e latticini'},
  parmigiano:   {n:'Parmigiano',      cat:'prot', p:33,  c:0,   f:28,  max:40,  base:30,  nofill:true, rnd:5, rep:'Uova e latticini'},
  lenticchie:   {n:'Lenticchie secche',cat:'prot',p:24,  c:50,  f:1.5, max:150, base:80,  leg:true, rep:'Dispensa'},
  ceci:         {n:'Ceci secchi',     cat:'prot', p:21,  c:45,  f:6,   max:150, base:80,  leg:true, rep:'Dispensa'},
  tofu:         {n:'Tofu',            cat:'prot', p:14,  c:2,   f:8,   max:330, rep:'Dispensa'},

  riso:         {n:'Riso basmati',    cat:'carb', p:7,   c:78,  f:0.6, rep:'Dispensa'},
  riso_int:     {n:'Riso integrale',  cat:'carb', p:7.5, c:75,  f:2.5, rep:'Dispensa'},
  pasta:        {n:'Pasta integrale', cat:'carb', p:13,  c:66,  f:2.5, rep:'Dispensa'},
  farro:        {n:'Farro',           cat:'carb', p:14,  c:67,  f:2.5, rep:'Dispensa'},
  orzo:         {n:'Orzo',            cat:'carb', p:10,  c:73,  f:1.2, rep:'Dispensa'},
  couscous:     {n:'Cous cous integrale', s:'Cous cous', cat:'carb', p:12, c:70, f:1.8, rep:'Dispensa'},
  quinoa:       {n:'Quinoa',          cat:'carb', p:14,  c:64,  f:6,   rep:'Dispensa'},
  patate:       {n:'Patate',          cat:'carb', p:2,   c:17,  f:0.1, rnd:50, rep:'Ortofrutta'},
  patate_dolci: {n:'Patate dolci',    cat:'carb', p:1.6, c:20,  f:0.1, rnd:50, rep:'Ortofrutta'},
  pane:         {n:'Pane integrale',  cat:'carb', p:9,   c:45,  f:2.5, rep:'Dispensa'},

  olio:         {n:'Olio EVO', cat:'grasso', ml:true, f:0.9, rnd:5, rep:'Dispensa'},
  mandorle:     {n:'Mandorle',        cat:'grasso', p:21, c:9, f:50, max:40, rnd:5, rep:'Dispensa'},
  noci:         {n:'Noci',            cat:'grasso', p:15, c:7, f:65, max:40, rnd:5, rep:'Dispensa'},
  avocado:      {n:'Avocado',         cat:'grasso', p:2,  c:2, f:15, max:150, rep:'Ortofrutta'},
  semi:         {n:'Semi di zucca',   cat:'grasso', p:30, c:5, f:49, max:40, rnd:5, rep:'Dispensa'}
};

export const VERDURE = ['Zucchine','Broccoli','Spinaci','Insalata','Pomodori','Peperoni','Melanzane',
                        'Zucca','Carote','Finocchi','Cavolfiore','Fagiolini','Funghi','Rucola'];

export const TARGET = { p:{P:45, C:88, F:25}, c:{P:40, C:56, F:25} };
export const TOLL = 3;

/* --- rotazione settimanale --- */
export const POOL = {
  pesce_grasso: [['salmone'], ['sgombro'], ['tonno_fresco']],
  pesce_magro:  [['merluzzo'], ['orata'], ['gamberi'], ['seppie']],
  bianca:       [['pollo'], ['tacchino'], ['maiale']],
  rossa:        [['manzo'], ['vitello']],
  uova:         [['uova', 'albume'], ['uova', 'tonno'], ['uova', 'fiocchi']],
  latticini:    [['fiocchi'], ['fiocchi', 'albume'], ['feta', 'pollo'], ['feta', 'ceci'], ['philadelphia', 'tonno']],
  legumi:       [['parmigiano', 'lenticchie'], ['uova', 'ceci'], ['tofu']]
};
export const QUOTE = [...Array(2).fill('pesce_grasso'), ...Array(2).fill('pesce_magro'),
                      ...Array(3).fill('bianca'), ...Array(2).fill('rossa'),
                      ...Array(2).fill('uova'), ...Array(2).fill('latticini'), 'legumi'];

export const CARBS = Object.keys(ING).filter(k => ING[k].cat === 'carb');
export const ALT_FAT = ['mandorle', 'noci', 'avocado', 'semi'];
export const PROT_FISSE = 80;
export const SOGLIA = 155;
export const GIORNI = ['Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato','Domenica'];

/* --- lista della spesa --- */
export const REPARTI = ['Pescheria','Macelleria','Uova e latticini','Dispensa','Ortofrutta','Parte fissa'];
export const PARTE_FISSA = [
  ['Verdura mista','3,5 kg'], ['Frutta','2 kg'], ['Yogurt greco 0% (colazione e spuntini)','1,5 kg'],
  ['Fiocchi di latte (spuntini)','800 g'], ['Uova (colazione e spuntini)','18 pz'], ['Avena','1 kg'],
  ['Frutta secca (spuntini)','500 g'], ['Burro di arachidi 100%','1 barattolo'],
  ['Proteine whey','controlla la scorta']
];

/* --- tabella scambi --- */
export const SCAMBI = [
  ['CARNE', [['pollo'], ['tacchino'], ['maiale'], ['manzo']]],
  ['PESCE', [['merluzzo'], ['orata'], ['gamberi'], ['tonno_fresco'], ['tonno'], ['salmone']]],
  ['UOVA', [['uova', 'albume'], ['uova', 'tonno'], ['uova', 'fiocchi']]],
  ['LATTICINI', [['fiocchi'], ['fiocchi', 'albume'], ['philadelphia', 'tonno'], ['feta', 'pollo'], ['feta', 'ceci']]],
  ['LEGUMI E VEGETALI', [['parmigiano', 'lenticchie'], ['uova', 'ceci'], ['tofu']]]
];
