// Icone degli esercizi: pittogrammi a linea su una griglia 48x48.
// Disegnate a mano per quest'app. Solo dati, cosi' le usa anche lo script di anteprima.

export type IconDef = {
  label: string
  // Tratto principale
  d: string
  // Tratti sottili: cavi, dettagli
  thin?: string
  // [cx, cy, r]
  circles?: [number, number, number][]
}

export const ICONS = {
  'chest-press': {
    label: 'Chest press',
    d: 'M8 14v20M8 34h16M12 34v8M8 42h8M13 16v15h11v11M13 20h19M34 14v12M34 14l6-6M40 5v37',
    circles: [[13.5, 11, 3.4]],
  },
  'panca-inclinata': {
    label: 'Panca inclinata',
    d: 'M25 39L13 20M25 39h12M29 39v4M35 39v4M28 34L18 18M28 34h8l1 9M18 18l5-11M19 7h8M19 4v6M27 4v6',
    circles: [[12.5, 13, 3.4]],
  },
  croci: {
    label: 'Croci ai cavi',
    d: 'M24 16v13l-4 13M24 29l4 13M24 19l-8 6M24 19l8 6M5 5v38M43 5v38',
    thin: 'M16 25L5 8M32 25l11-17',
    circles: [[24, 11.5, 3.4]],
  },
  lento: {
    label: 'Lento avanti',
    d: 'M24 23v11l-4 9M24 34l4 9M24 25h-8v-12M24 25h8v-12M12 13h8M28 13h8M12 10v6M20 10v6M28 10v6M36 10v6',
    circles: [[24, 18.5, 3.4]],
  },
  alzate: {
    label: 'Alzate laterali',
    d: 'M24 16v13l-4 13M24 29l4 13M24 19H10M24 19h14M8 15v8M40 15v8',
    circles: [[24, 11.5, 3.4]],
  },
  corda: {
    label: 'Corda al cavo',
    d: 'M24 16l-8 18M24 16l8 18',
    thin: 'M24 4v9',
    circles: [
      [24, 14.5, 2],
      [15, 37, 3],
      [33, 37, 3],
    ],
  },
  pushdown: {
    label: 'Push down',
    d: 'M28 16v14l-3 13M28 30l3 13M28 19l-3 8l-7 3M8 4v39',
    thin: 'M18 30L12 11',
    circles: [
      [28, 11.5, 3.4],
      [11, 8, 3.2],
    ],
  },
  trazioni: {
    label: 'Trazioni',
    d: 'M5 7h38M8 7v36M40 7v36M24 17v12l-3 12M24 29l3 12M24 19h-8l1-12M24 19h8l-1-12',
    circles: [[24, 13.5, 3.4]],
  },
  rematore: {
    label: 'Rematore',
    d: 'M5 33h13M11 33v9M6 42h10M11 15v16l10-5l8 5M31 25v11M11 19h14',
    thin: 'M25 19h14M40 6v37',
    circles: [[11, 10.5, 3.4]],
  },
  lat: {
    label: 'Lat machine',
    d: 'M24 21v12M24 33l-7 1l-1 9M24 33l7 1l1 9M16 32h16M24 23l-9-2l-2-12M24 23l9-2l2-12M8 9h32',
    thin: 'M24 9V2',
    circles: [[24, 16.5, 3.4]],
  },
  'face-pull': {
    label: 'Face pull',
    d: 'M28 16v14l-3 13M28 30l3 13M28 19h7l-13-4M8 4v39',
    thin: 'M22 15h-8',
    circles: [
      [28, 11.5, 3.4],
      [11, 15, 3.2],
    ],
  },
  scott: {
    label: 'Panca Scott',
    d: 'M15 22l3-3l13 11l-3 3zM26 33v10M20 43h12M9 15v16h7v12M9 19l12 9l-1-12M17 16h6',
    circles: [[9, 10.5, 3.4]],
  },
  curl: {
    label: 'Curl',
    d: 'M22 16v13l-4 13M22 29l4 13M22 19l-6 9M22 19l7 7l1-9M16 25v7M14 25h4M14 32h4M30 13v8M28 13h4M28 21h4',
    circles: [[22, 11.5, 3.4]],
  },
  squat: {
    label: 'Squat',
    d: 'M5 14h38M8 10v8M40 10v8M24 14v14M24 17l-7 3l-2-6M24 17l7 3l2-6M24 28l-9 4l1 10M24 28l9 4l-1 10',
    circles: [[24, 9.5, 3.4]],
  },
  'leg-extension': {
    label: 'Leg extension',
    d: 'M8 12v22M7 32h17M17 36v7M11 43h13M16 15v15h10l11-6M16 19l6 6',
    circles: [
      [16, 10, 3.4],
      [38, 27, 2.6],
    ],
  },
  'leg-press': {
    label: 'Leg press',
    d: 'M5 26l6 16h12M16 36L10 24M16 36l7-12l11-2M32 12l5 13',
    thin: 'M27 43L44 13',
    circles: [[8, 19, 3.4]],
  },
  'leg-curl': {
    label: 'Leg curl',
    d: 'M6 31h30M12 31v12M30 31v12M14 27h14h7l-3-11M14 27l-4 4',
    circles: [
      [9, 24, 3.4],
      [35, 16, 2.6],
    ],
  },
  polpacci: {
    label: 'Polpacci',
    d: 'M26 12v15v9l3 2M26 15l-3 10M26 15l3 10M20 39h16v4H20zM13 32V20M10 23l3-3l3 3',
    circles: [[26, 7.5, 3.4]],
  },
  'panca-piana': {
    label: 'Panca piana',
    d: 'M6 31h28M11 31v11M29 31v11M15 27h13l7 1l2 14M17 27V13M11 11h12M11 8v6M23 8v6',
    circles: [[10.5, 25.5, 3.4]],
  },
  dip: {
    label: 'Dip',
    d: 'M24 14v14l-3 10M24 28l3 10M24 17l-9 4M24 17l9 4M15 21v22M33 21v22',
    circles: [[24, 9.5, 3.4]],
  },
  piegamenti: {
    label: 'Piegamenti',
    d: 'M14 25l24 10M14 25l-1 11M38 35l3 1',
    thin: 'M5 37h38',
    circles: [[9.5, 22.5, 3.4]],
  },
  stacco: {
    label: 'Stacco',
    d: 'M13 24l12-5M13 24l7 7l-3 11M25 19l3 11',
    circles: [
      [29.5, 15, 3.4],
      [28, 36, 5.5],
    ],
  },
  affondo: {
    label: 'Affondi',
    d: 'M24 13v14M24 27l9 1v14M24 27l-6 12l-7 2',
    circles: [[24, 8.5, 3.4]],
  },
  crunch: {
    label: 'Crunch',
    d: 'M27 37L15 31M27 37l7-9l6 10M15 31l8-5',
    thin: 'M5 40h38',
    circles: [[11.5, 27.5, 3.4]],
  },
  'hip-thrust': {
    label: 'Hip thrust',
    d: 'M4 31h10M9 31v11M13 28h14l8 1v13',
    circles: [
      [8.5, 24.5, 3.4],
      [26, 22, 4.5],
    ],
  },
  manubrio: {
    label: 'Manubrio',
    d: 'M14 24h20M8 18v12M14 14v20M34 14v20M40 18v12',
  },
  kettlebell: {
    label: 'Kettlebell',
    d: 'M17 17a7 7 0 0 1 14 0M13 30a11 11 0 1 1 22 0c0 5-3 9-4 11H17c-1-2-4-6-4-11z',
  },
} satisfies Record<string, IconDef>

export type IconKey = keyof typeof ICONS

export const ICON_KEYS = Object.keys(ICONS) as IconKey[]

// Indovina l'icona dal nome, per gli esercizi senza icona scelta.
// L'ordine conta: "leg curl" prima di "curl", "french press" prima di "press".
const RULES: [RegExp, IconKey][] = [
  [/face ?pull/i, 'face-pull'],
  [/leg ?curl/i, 'leg-curl'],
  [/leg ?ext/i, 'leg-extension'],
  [/leg ?press/i, 'leg-press'],
  [/hip ?thrust|ponte|glute/i, 'hip-thrust'],
  [/crunch|addom|\babs\b/i, 'crunch'],
  [/piegament|push ?up/i, 'piegamenti'],
  [/\bdip/i, 'dip'],
  [/stacc|deadlift/i, 'stacco'],
  [/affond|lunge|bulgar/i, 'affondo'],
  [/panca piana|flat bench|distensioni/i, 'panca-piana'],
  [/scott|preacher/i, 'scott'],
  [/curl|bicip/i, 'curl'],
  [/french|corda|rope|tricip/i, 'corda'],
  [/push ?down/i, 'pushdown'],
  [/croci|crossover|\bfly|\bpec/i, 'croci'],
  [/inclinat|bench|spint/i, 'panca-inclinata'],
  [/chest|petto/i, 'chest-press'],
  [/lento|military|shoulder|spalle/i, 'lento'],
  [/alzat|laterali|raise/i, 'alzate'],
  [/trazion|pull ?up|\bchin ?up/i, 'trazioni'],
  [/\blat\b|pulldown/i, 'lat'],
  [/remator|\brow/i, 'rematore'],
  [/squat/i, 'squat'],
  [/polpacc|calf/i, 'polpacci'],
  [/kettle/i, 'kettlebell'],
]

export function guessIcon(name: string): IconKey {
  return RULES.find(([re]) => re.test(name))?.[1] ?? 'manubrio'
}

// L'icona scelta dall'utente, oppure quella indovinata dal nome
export function iconFor(ex: { name: string; icon?: string }): IconKey {
  return ex.icon && ex.icon in ICONS ? (ex.icon as IconKey) : guessIcon(ex.name)
}
