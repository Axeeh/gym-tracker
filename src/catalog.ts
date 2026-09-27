import type { Exercise } from './types'
import type { IconKey } from './icons'
import { uid } from './logic'

// Catalogo degli esercizi tra cui scegliere quando crei o modifichi la scheda.
// Serie, obiettivo, recupero e aumento sono valori di partenza, modificabili dopo.

export type Group = 'petto' | 'schiena' | 'spalle' | 'bicipiti' | 'tricipiti' | 'gambe' | 'addome'

export const GROUPS: { key: Group; label: string }[] = [
  { key: 'petto', label: 'Petto' },
  { key: 'schiena', label: 'Schiena' },
  { key: 'spalle', label: 'Spalle' },
  { key: 'bicipiti', label: 'Bicipiti' },
  { key: 'tricipiti', label: 'Tricipiti' },
  { key: 'gambe', label: 'Gambe' },
  { key: 'addome', label: 'Addome' },
]

export type CatalogItem = {
  id: string
  name: string
  group: Group
  icon: IconKey
  target: number | null
  sets: number
  rest: number
  step: number
  bodyweight?: boolean
}

// [id, nome, gruppo, icona, obiettivo, serie, recupero, aumento, corpo libero]
type Row = [string, string, Group, IconKey, number | null, number, number, number, boolean?]

const ROWS: Row[] = [
  ['panca-piana', 'Panca piana con bilanciere', 'petto', 'panca-piana', 8, 4, 150, 2.5],
  ['panca-piana-manubri', 'Panca piana con manubri', 'petto', 'panca-piana', 10, 3, 120, 2],
  ['spinte-inclinata', 'Spinte manubri inclinata', 'petto', 'panca-inclinata', 8, 3, 120, 2],
  ['panca-inclinata', 'Panca inclinata con bilanciere', 'petto', 'panca-inclinata', 8, 3, 150, 2.5],
  ['chest-press', 'Chest press', 'petto', 'chest-press', 8, 3, 120, 5],
  ['croci-manubri', 'Croci con manubri', 'petto', 'croci', 12, 3, 90, 2],
  ['croci-cavo', 'Croci ai cavi', 'petto', 'croci', 12, 3, 90, 2],
  ['pectoral-machine', 'Pectoral machine', 'petto', 'croci', 12, 3, 90, 5],
  ['dip', 'Dip alle parallele', 'petto', 'dip', 10, 3, 120, 2.5, true],
  ['piegamenti', 'Piegamenti', 'petto', 'piegamenti', 15, 3, 60, 0, true],

  ['trazioni', 'Trazioni', 'schiena', 'trazioni', null, 3, 150, 2.5, true],
  ['lat-machine', 'Lat machine', 'schiena', 'lat', 10, 3, 120, 5],
  ['lat-presa-stretta', 'Lat machine presa stretta', 'schiena', 'lat', 10, 3, 120, 5],
  ['pulley-basso', 'Pulley basso', 'schiena', 'rematore', 10, 3, 120, 5],
  ['rematore', 'Rematore alla macchina', 'schiena', 'rematore', 10, 3, 120, 2.5],
  ['rematore-bilanciere', 'Rematore con bilanciere', 'schiena', 'rematore', 8, 4, 150, 2.5],
  ['rematore-manubrio', 'Rematore con manubrio', 'schiena', 'rematore', 10, 3, 90, 2],
  ['pulldown-braccia-tese', 'Pulldown a braccia tese', 'schiena', 'pushdown', 12, 3, 90, 4],
  ['stacco', 'Stacco da terra', 'schiena', 'stacco', 5, 3, 180, 5],

  ['lento-avanti', 'Lento avanti con manubri', 'spalle', 'lento', 8, 3, 120, 2],
  ['military-press', 'Military press', 'spalle', 'lento', 6, 4, 150, 2.5],
  ['shoulder-press', 'Shoulder press alla macchina', 'spalle', 'lento', 10, 3, 120, 5],
  ['alzate-laterali', 'Alzate laterali con manubri', 'spalle', 'alzate', 12, 3, 90, 1],
  ['alzate-laterali-cavo', 'Alzate laterali al cavo', 'spalle', 'alzate', 12, 3, 60, 1],
  ['alzate-posteriori', 'Alzate posteriori', 'spalle', 'alzate', 15, 3, 60, 1],
  ['face-pull', 'Face pull', 'spalle', 'face-pull', 15, 3, 60, 4],

  ['curl-bilanciere', 'Curl con bilanciere', 'bicipiti', 'curl', 10, 3, 90, 2.5],
  ['curl-manubri', 'Curl con manubri', 'bicipiti', 'curl', 10, 3, 90, 2],
  ['hammer-curl', 'Hammer curl', 'bicipiti', 'curl', 10, 3, 90, 2],
  ['panca-scott', 'Panca Scott', 'bicipiti', 'scott', 10, 3, 90, 2],
  ['curl-cavo', 'Curl al cavo', 'bicipiti', 'curl', 12, 3, 60, 4],

  ['push-down', 'Push down con barra', 'tricipiti', 'pushdown', 10, 3, 90, 4],
  ['push-down-corda', 'Push down con corda', 'tricipiti', 'corda', 12, 3, 90, 4],
  ['french-press', 'French press con corda', 'tricipiti', 'corda', 10, 3, 90, 4],
  ['french-press-bilanciere', 'French press con bilanciere', 'tricipiti', 'panca-piana', 10, 3, 90, 2.5],
  ['dip-panca', 'Dip su panca', 'tricipiti', 'dip', 12, 3, 60, 0, true],

  ['squat', 'Squat con bilanciere', 'gambe', 'squat', 8, 4, 180, 2.5],
  ['hack-squat', 'Hack squat', 'gambe', 'squat', 10, 3, 150, 5],
  ['leg-press', 'Leg press', 'gambe', 'leg-press', 10, 3, 150, 10],
  ['leg-extension', 'Leg extension', 'gambe', 'leg-extension', 12, 3, 90, 5],
  ['leg-curl', 'Leg curl', 'gambe', 'leg-curl', 10, 3, 90, 5],
  ['affondi', 'Affondi con manubri', 'gambe', 'affondo', 10, 3, 90, 2],
  ['stacco-rumeno', 'Stacco rumeno', 'gambe', 'stacco', 8, 3, 150, 2.5],
  ['hip-thrust', 'Hip thrust', 'gambe', 'hip-thrust', 10, 3, 120, 5],
  ['polpacci', 'Calf raise in piedi', 'gambe', 'polpacci', 15, 3, 60, 5],
  ['polpacci-seduto', 'Calf raise da seduto', 'gambe', 'polpacci', 15, 3, 60, 5],

  ['crunch', 'Crunch', 'addome', 'crunch', 20, 3, 60, 0, true],
  ['crunch-cavo', 'Crunch al cavo', 'addome', 'crunch', 15, 3, 60, 4],
  ['leg-raise', 'Leg raise alla sbarra', 'addome', 'trazioni', 12, 3, 60, 0, true],
]

export const CATALOG: CatalogItem[] = ROWS.map(
  ([id, name, group, icon, target, sets, rest, step, bodyweight]) => ({
    id,
    name,
    group,
    icon,
    target,
    sets,
    rest,
    step,
    ...(bodyweight ? { bodyweight } : {}),
  }),
)

export const catalogById = (id: string) => CATALOG.find((c) => c.id === id)

// Gruppi consigliati in base al nome del giorno (Push, Pull, Legs, Upper...)
export function suggestedGroups(dayName: string): Group[] {
  const n = dayName.toLowerCase()
  if (/push|spinta|petto|chest/.test(n)) return ['petto', 'spalle', 'tricipiti']
  if (/pull|tirata|schiena|back/.test(n)) return ['schiena', 'bicipiti']
  if (/leg|gamb|lower|inferior/.test(n)) return ['gambe', 'addome']
  if (/upper|superior/.test(n)) return ['petto', 'schiena', 'spalle', 'bicipiti', 'tricipiti']
  if (/brac|arm/.test(n)) return ['bicipiti', 'tricipiti']
  if (/spall|shoulder/.test(n)) return ['spalle']
  return []
}

// Crea l'esercizio della scheda. L'id resta quello del catalogo quando e' libero,
// cosi' ritrova lo storico se rifai la scheda con gli stessi esercizi.
export function fromCatalog(item: CatalogItem, usedIds: Set<string>): Exercise {
  const id = usedIds.has(item.id) ? `${item.id}-${uid()}` : item.id
  usedIds.add(id)
  const { name, icon, target, sets, rest, step, bodyweight } = item
  return { id, name, icon, target, sets, rest, step, ...(bodyweight ? { bodyweight } : {}) }
}

export function customExercise(name: string, usedIds: Set<string>): Exercise {
  const id = uid()
  usedIds.add(id)
  return { id, name: name.trim(), target: 10, sets: 3, rest: 90, step: 2.5 }
}
