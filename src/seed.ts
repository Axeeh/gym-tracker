import type { AppState, Day, Entry, Session } from './types'

// Scheda pronta Push, Pull, Legs: la scheda di Alessio, senza i suoi pesi.
// Il range di ripetizioni (es. "6 8") diventa un obiettivo unico: il numero piu' alto.
export const templateDays: Day[] = [
  {
    id: 'push',
    name: 'Push',
    color: 'corallo',
    exercises: [
      { id: 'chest-press', name: 'Chest press', target: 8, sets: 3, rest: 120, step: 5 },
      { id: 'spinte-inclinata', name: 'Spinte manubri inclinata', target: 8, sets: 3, rest: 120, step: 2 },
      {
        id: 'croci-cavi',
        name: 'Superset croci ai cavi',
        parts: ['Cavo alto', 'Cavo basso'],
        target: null,
        sets: 3,
        rest: 90,
        step: 2,
      },
      { id: 'lento-avanti', name: 'Lento avanti', target: 8, sets: 3, rest: 120, step: 2 },
      { id: 'alzate-laterali', name: 'Alzate laterali manubri', target: 10, sets: 3, rest: 90, step: 1 },
      { id: 'french-press', name: 'French press corda', target: 9, sets: 3, rest: 90, step: 4 },
      { id: 'push-down', name: 'Push down manubrio dritto', target: 10, sets: 3, rest: 90, step: 4 },
    ],
  },
  {
    id: 'pull',
    name: 'Pull',
    color: 'blu',
    exercises: [
      {
        id: 'trazioni',
        name: 'Trazioni presa neutra',
        note: 'Max ripetizioni',
        target: null,
        sets: 3,
        rest: 150,
        step: 2.5,
        bodyweight: true,
      },
      {
        id: 'rematore',
        name: 'Rematore presa larga, gomiti alti',
        note: 'Con straps',
        target: 9,
        sets: 3,
        rest: 120,
        step: 2.5,
      },
      {
        id: 'lat-machine',
        name: 'Lat machine presa neutra',
        note: 'Con straps',
        target: 8,
        sets: 3,
        rest: 120,
        step: 5,
      },
      {
        id: 'pulldown-facepull',
        name: 'Superset pulldown e face pull',
        parts: ['Pulldown corda', 'Face pull'],
        target: null,
        sets: 3,
        rest: 90,
        step: 4,
      },
      { id: 'panca-scott', name: 'Panca Scott', target: 9, sets: 3, rest: 90, step: 2 },
      { id: 'hammer-curl', name: 'Hammer curl panca inclinata', target: 7, sets: 3, rest: 90, step: 2 },
    ],
  },
  {
    id: 'legs',
    name: 'Legs',
    color: 'verde',
    exercises: [
      { id: 'hack-squat', name: 'Hack squat', target: 12, sets: 2, rest: 150, step: 5 },
      { id: 'leg-extension', name: 'Leg extension', target: 12, sets: 3, rest: 90, step: 5 },
      { id: 'leg-press', name: 'Leg press', target: 8, sets: 2, rest: 150, step: 10 },
      { id: 'leg-curl', name: 'Leg curl', target: 9, sets: 3, rest: 90, step: 5 },
      { id: 'polpacci', name: 'Polpacci', target: null, sets: 3, rest: 60, step: 5 },
    ],
  },
]

// Primo avvio: nessuna scheda, si sceglie da dove partire
export function freshState(): AppState {
  return { v: 1, days: [], sessions: [], drafts: {}, onboarded: false }
}

export function templateState(): AppState {
  return { ...freshState(), days: structuredClone(templateDays), onboarded: true }
}

// Punto di partenza con pesi gia' noti (es. dalle note del telefono): una sessione
// per giorno, con le ripetizioni vuote. pesi: id esercizio -> una riga per serie
export function noteSessions(
  days: Day[],
  pesi: Record<string, number[][]>,
  now = new Date(),
): Session[] {
  return days.map((day) => ({
    id: `note-${day.id}`,
    dayId: day.id,
    dayName: day.name,
    color: day.color,
    date: now.toISOString(),
    source: 'note' as const,
    exercises: day.exercises
      .filter((ex) => pesi[ex.id])
      .map((ex) => ({
        exId: ex.id,
        name: ex.name,
        parts: ex.parts,
        sets: pesi[ex.id].map((row) => row.map((w): Entry => ({ w, r: null }))),
      })),
  }))
}
