/* Il punto di partenza dell'app: il catalogo degli esercizi e la struttura
   della scheda. Viene scritto nel database una volta sola, al primo avvio.

   Lo storico — sedute, pesate, misure — qui NON c'è di proposito: è roba
   personale e questo file finisce in un repository pubblico. Si carica una
   volta sola da Dati → Importa, con i CSV che stanno fuori dal repo. */

export const ESERCIZI = [
  {
    "id": "squat_machine",
    "nome": "Squat machine",
    "attrezzo": "macchina",
    "incremento": 5,
    "gruppo": "gambe"
  },
  {
    "id": "shoulder_press",
    "nome": "Shoulder press",
    "attrezzo": "macchina",
    "incremento": 5,
    "gruppo": "spalle"
  },
  {
    "id": "rematore_rowing",
    "nome": "Rematore rowing",
    "attrezzo": "macchina",
    "incremento": 5,
    "gruppo": "dorso"
  },
  {
    "id": "panca_piana_manubri",
    "nome": "Panca piana manubri",
    "attrezzo": "manubri",
    "incremento": 2.5,
    "gruppo": "petto"
  },
  {
    "id": "chest_press",
    "nome": "Chest press",
    "attrezzo": "macchina",
    "incremento": 5,
    "gruppo": "petto"
  },
  {
    "id": "panca_presa_stretta",
    "nome": "Panca presa stretta",
    "attrezzo": "bilanciere",
    "incremento": 2.5,
    "gruppo": "tricipiti"
  },
  {
    "id": "affondi_con_manubri",
    "nome": "Affondi con manubri",
    "attrezzo": "manubri",
    "incremento": 2.5,
    "gruppo": "gambe"
  },
  {
    "id": "leg_extension",
    "nome": "Leg extension",
    "attrezzo": "macchina",
    "incremento": 5,
    "gruppo": "quadricipiti"
  },
  {
    "id": "alzate_a_90_seduto",
    "nome": "Alzate a 90° seduto",
    "attrezzo": "manubri",
    "incremento": 2.5,
    "gruppo": "spalle"
  },
  {
    "id": "pectoral",
    "nome": "Pectoral",
    "attrezzo": "macchina",
    "incremento": 5,
    "gruppo": "petto"
  },
  {
    "id": "alzate_laterali",
    "nome": "Alzate laterali",
    "attrezzo": "manubri",
    "incremento": 2.5,
    "gruppo": "spalle"
  },
  {
    "id": "butterfly",
    "nome": "Butterfly",
    "attrezzo": "macchina",
    "incremento": 5,
    "gruppo": "petto"
  },
  {
    "id": "curl_panca_45",
    "nome": "Curl panca 45°",
    "attrezzo": "manubri",
    "incremento": 2.5,
    "gruppo": "bicipiti"
  },
  {
    "id": "pull_through",
    "nome": "Pull through",
    "attrezzo": "cavi",
    "incremento": 5,
    "gruppo": "femorali"
  },
  {
    "id": "curl_a_martello",
    "nome": "Curl a martello",
    "attrezzo": "manubri",
    "incremento": 2.5,
    "gruppo": "bicipiti"
  },
  {
    "id": "pulldown_machine",
    "nome": "Pulldown machine",
    "attrezzo": "macchina",
    "incremento": 5,
    "gruppo": "dorso"
  },
  {
    "id": "push_down_singolo",
    "nome": "Push down singolo",
    "attrezzo": "cavi",
    "incremento": 2.5,
    "gruppo": "tricipiti"
  },
  {
    "id": "leg_curl_sdraiato",
    "nome": "Leg curl sdraiato",
    "attrezzo": "macchina",
    "incremento": 5,
    "gruppo": "femorali"
  }
];

export const PROGRAMMA = {
  "id": "pr_scheda9",
  "nome": "Scheda 9",
  "dal": "2026-09-09",
  "al": null,
  "attivo": true,
  "voci": [
    {
      "esId": "squat_machine",
      "scheda": "A",
      "protocollo": "5x5",
      "recupero": 180,
      "ordine": 1
    },
    {
      "esId": "shoulder_press",
      "scheda": "A",
      "protocollo": "5x5",
      "recupero": 180,
      "ordine": 2
    },
    {
      "esId": "leg_extension",
      "scheda": "A",
      "protocollo": "iso",
      "recupero": 120,
      "ordine": 3
    },
    {
      "esId": "alzate_a_90_seduto",
      "scheda": "A",
      "protocollo": "iso",
      "recupero": 120,
      "ordine": 4
    },
    {
      "esId": "pull_through",
      "scheda": "A",
      "protocollo": "3x12",
      "recupero": 90,
      "ordine": 5
    },
    {
      "esId": "curl_a_martello",
      "scheda": "A",
      "protocollo": "3x12",
      "recupero": 90,
      "ordine": 6
    },
    {
      "esId": "rematore_rowing",
      "scheda": "B",
      "protocollo": "5x5",
      "recupero": 180,
      "ordine": 1
    },
    {
      "esId": "panca_piana_manubri",
      "scheda": "B",
      "protocollo": "5x5",
      "recupero": 180,
      "ordine": 2
    },
    {
      "esId": "pectoral",
      "scheda": "B",
      "protocollo": "iso",
      "recupero": 120,
      "ordine": 3
    },
    {
      "esId": "alzate_laterali",
      "scheda": "B",
      "protocollo": "iso",
      "recupero": 120,
      "ordine": 4
    },
    {
      "esId": "pulldown_machine",
      "scheda": "B",
      "protocollo": "3x12",
      "recupero": 90,
      "ordine": 5
    },
    {
      "esId": "push_down_singolo",
      "scheda": "B",
      "protocollo": "3x12",
      "recupero": 90,
      "ordine": 6
    },
    {
      "esId": "chest_press",
      "scheda": "C",
      "protocollo": "5x5",
      "recupero": 180,
      "ordine": 1
    },
    {
      "esId": "panca_presa_stretta",
      "scheda": "C",
      "protocollo": "5x5",
      "recupero": 180,
      "ordine": 2
    },
    {
      "esId": "affondi_con_manubri",
      "scheda": "C",
      "protocollo": "5x5",
      "recupero": 180,
      "ordine": 3
    },
    {
      "esId": "butterfly",
      "scheda": "C",
      "protocollo": "iso",
      "recupero": 120,
      "ordine": 4
    },
    {
      "esId": "curl_panca_45",
      "scheda": "C",
      "protocollo": "iso",
      "recupero": 120,
      "ordine": 5
    },
    {
      "esId": "shoulder_press",
      "scheda": "C",
      "protocollo": "3x12",
      "recupero": 90,
      "ordine": 6
    },
    {
      "esId": "leg_curl_sdraiato",
      "scheda": "C",
      "protocollo": "3x12",
      "recupero": 90,
      "ordine": 7
    }
  ]
};

export const SEDUTE = [];   // lo storico si importa dai CSV

export const PESO = [];   // idem

export const MISURE = [];   // idem
