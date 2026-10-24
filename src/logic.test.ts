import { describe, expect, it } from 'vitest'
import { freshState, noteSessions, templateState } from './seed'
import {
  applyEntry,
  createDraft,
  draftToSession,
  newRecords,
  nextDayId,
  normalizeState,
  prefillSets,
  progressionFor,
  progressSeries,
  syncDraft,
} from './logic'
import { fmtSets, parseNum, planAsText, relDay } from './format'
import type { DraftSet, Session } from './types'
import { guessIcon, iconFor } from './icons'

// Scheda pronta con alcuni pesi di partenza, come dopo l'import del backup delle note
const PESI: Record<string, number[][]> = {
  'chest-press': [[45], [40], [40]],
  'spinte-inclinata': [[20], [18], [18]],
  'croci-cavi': [[27, 14], [25, 12], [23, 9]],
  'lento-avanti': [[18], [18], [16]],
  'alzate-laterali': [[9], [9], [9]],
  'french-press': [[32], [32], [32]],
  'push-down': [[45], [45], [41]],
}
const base = () => {
  const s = templateState()
  s.sessions = noteSessions(s.days, PESI, new Date('2026-09-26T08:00:00'))
  return s
}
const push = (s = base()) => s.days.find((d) => d.id === 'push')!

function session(dayId: string, date: string, sets: Record<string, [number, number][]>): Session {
  return {
    id: `${dayId}-${date}`,
    dayId,
    dayName: dayId,
    color: 'corallo',
    date: new Date(date).toISOString(),
    exercises: Object.entries(sets).map(([exId, rows]) => ({
      exId,
      name: exId,
      sets: rows.map(([w, r]) => [{ w, r }]),
    })),
  }
}

describe('scheda iniziale', () => {
  it('parte vuota al primo avvio', () => {
    expect(freshState()).toMatchObject({ days: [], sessions: [], onboarded: false })
  })

  it('la scheda pronta ha Push, Pull e Legs, senza pesi', () => {
    expect(templateState().days.map((d) => d.name)).toEqual(['Push', 'Pull', 'Legs'])
    expect(templateState().sessions).toEqual([])
  })

  it('i pesi di partenza diventano una sessione per giorno', () => {
    const s = base()
    const chest = s.sessions.find((x) => x.dayId === 'push')!.exercises[0]
    expect(chest.sets.map((r) => r[0].w)).toEqual([45, 40, 40])
    const croci = s.sessions[0].exercises.find((e) => e.exId === 'croci-cavi')!
    expect(croci.sets[0].map((e) => e.w)).toEqual([27, 14])
  })

  it('usa il numero piu alto del range come obiettivo', () => {
    const ex = push().exercises
    expect(ex.find((e) => e.id === 'chest-press')!.target).toBe(8)
    expect(ex.find((e) => e.id === 'french-press')!.target).toBe(9)
  })
})

describe('precompilazione', () => {
  it('propone i pesi dell ultima volta', () => {
    const s = base()
    const sets = prefillSets(push(s).exercises[0], s.sessions)
    expect(sets.map((x) => x.e[0].w)).toEqual([45, 40, 40])
    expect(sets.every((x) => !x.done)).toBe(true)
  })

  it('preferisce l allenamento piu recente alle note', () => {
    const s = base()
    s.sessions.push(session('push', '2026-09-28T08:00:00', { 'chest-press': [[50, 8], [45, 8], [45, 8]] }))
    const sets = prefillSets(push(s).exercises[0], s.sessions)
    expect(sets.map((x) => [x.e[0].w, x.e[0].r])).toEqual([[50, 8], [45, 8], [45, 8]])
  })

  it('il superset ha due valori per serie', () => {
    const s = base()
    const draft = createDraft(push(s), s.sessions)
    expect(draft.exercises['croci-cavi'].sets[2].e.map((e) => e.w)).toEqual([23, 9])
  })

  it('riallinea un allenamento in corso se la scheda cambia', () => {
    const s = base()
    const day = push(s)
    const draft = createDraft(day, s.sessions)
    const changed = { ...day, exercises: [...day.exercises.slice(1), { id: 'nuovo', name: 'Nuovo', target: 10, sets: 2, rest: 60, step: 2 }] }
    const synced = syncDraft(changed, draft, s.sessions)
    expect(synced.exercises['chest-press']).toBeUndefined()
    expect(synced.exercises['nuovo'].sets).toHaveLength(2)
  })
})

describe('correzione delle serie', () => {
  const serie = (pesi: (number | null)[], fatte: boolean[] = []): DraftSet[] =>
    pesi.map((w, i) => ({ e: [{ w, r: 8 }], done: fatte[i] ?? false }))
  const pesi = (sets: DraftSet[]) => sets.map((s) => s.e[0].w)

  it('il peso nuovo passa alle serie dopo con lo stesso peso', () => {
    expect(pesi(applyEntry(serie([40, 40, 40]), 0, 0, 'w', 45))).toEqual([45, 45, 45])
  })

  it('una piramide resta com e dalla serie diversa in poi', () => {
    expect(pesi(applyEntry(serie([40, 40, 35]), 0, 0, 'w', 45))).toEqual([45, 45, 35])
  })

  it('segue anche mentre scrivi una cifra alla volta', () => {
    let sets = applyEntry(serie([40, 40, 40]), 0, 0, 'w', 4)
    sets = applyEntry(sets, 0, 0, 'w', 42.5)
    expect(pesi(sets)).toEqual([42.5, 42.5, 42.5])
  })

  it('non tocca le serie gia fatte, quelle prima e le ripetizioni', () => {
    const sets = applyEntry(serie([40, 40, 40, 40], [false, false, true]), 1, 0, 'w', 45)
    expect(pesi(sets)).toEqual([40, 45, 40, 40])
    const reps = applyEntry(serie([40, 40]), 0, 0, 'r', 6)
    expect(reps.map((s) => s.e[0].r)).toEqual([6, 8])
  })

  it('nel superset cambia solo la parte toccata', () => {
    const sets: DraftSet[] = [0, 1].map(() => ({ e: [{ w: 20, r: 10 }, { w: 10, r: 10 }], done: false }))
    const out = applyEntry(sets, 0, 1, 'w', 12)
    expect(out.map((s) => s.e.map((en) => en.w))).toEqual([[20, 12], [20, 12]])
  })
})

describe('suggerimento di progressione', () => {
  it('non suggerisce nulla se le ripetizioni non sono note', () => {
    const s = base()
    expect(progressionFor(push(s).exercises[0], s.sessions)).toBeNull()
  })

  it('suggerisce di salire quando chiudi l obiettivo in tutte le serie', () => {
    const s = base()
    s.sessions.push(session('push', '2026-09-28T08:00:00', { 'chest-press': [[45, 8], [40, 9], [40, 8]] }))
    expect(progressionFor(push(s).exercises[0], s.sessions)).toEqual({ kind: 'obiettivo', step: 5, reps: 8 })
  })

  it('non suggerisce se una serie resta sotto', () => {
    const s = base()
    s.sessions.push(session('push', '2026-09-28T08:00:00', { 'chest-press': [[45, 8], [40, 7], [40, 8]] }))
    expect(progressionFor(push(s).exercises[0], s.sessions)).toBeNull()
  })

  it('suggerisce di salire dopo due allenamenti di fila con lo stesso peso', () => {
    const s = base()
    s.sessions.push(session('push', '2026-09-28T08:00:00', { 'chest-press': [[45, 7], [40, 6], [40, 6]] }))
    expect(progressionFor(push(s).exercises[0], s.sessions)).toBeNull()
    s.sessions.push(session('push', '2026-10-01T08:00:00', { 'chest-press': [[45, 7], [40, 7], [40, 6]] }))
    expect(progressionFor(push(s).exercises[0], s.sessions)).toEqual({ kind: 'stesso-peso', step: 5, times: 2 })
    s.sessions.push(session('push', '2026-10-04T08:00:00', { 'chest-press': [[45, 7], [40, 7]] }))
    expect(progressionFor(push(s).exercises[0], s.sessions)).toMatchObject({ times: 3 })
  })

  it('non conta come stesso peso se una serie e cambiata', () => {
    const s = base()
    s.sessions.push(session('push', '2026-09-28T08:00:00', { 'chest-press': [[45, 7], [40, 6], [40, 6]] }))
    s.sessions.push(session('push', '2026-10-01T08:00:00', { 'chest-press': [[45, 7], [42.5, 6], [40, 6]] }))
    expect(progressionFor(push(s).exercises[0], s.sessions)).toBeNull()
  })

  it('il punto di partenza dalle note non conta come allenamento', () => {
    const s = base()
    s.sessions.push(session('push', '2026-09-28T08:00:00', { 'chest-press': [[45, 7], [40, 6], [40, 6]] }))
    expect(progressionFor(push(s).exercises[0], s.sessions)).toBeNull()
  })
})

describe('fine allenamento', () => {
  it('salva solo le serie fatte, oppure tutte se richiesto', () => {
    const s = base()
    const day = push(s)
    const draft = createDraft(day, s.sessions, new Date('2026-09-28T07:00:00'))
    draft.exercises['chest-press'].sets[0] = { e: [{ w: 47.5, r: 8 }], done: true }
    const onlyDone = draftToSession(day, draft, false, new Date('2026-09-28T07:50:00'))
    expect(onlyDone.exercises).toHaveLength(1)
    expect(onlyDone.durationMin).toBe(50)
    const all = draftToSession(day, draft, true, new Date('2026-09-28T07:50:00'))
    expect(all.exercises.length).toBeGreaterThan(5)
  })

  it('riconosce un nuovo record di peso', () => {
    const s = base()
    const today = session('push', '2026-09-28T08:00:00', { 'chest-press': [[50, 6]] })
    expect(newRecords(today, s.sessions)).toEqual([{ name: 'chest-press', part: undefined, w: 50, prev: 45 }])
  })

  it('propone il giorno dopo l ultimo fatto, ignorando le note', () => {
    const s = base()
    expect(nextDayId(s.days, s.sessions)).toBe('push')
    s.sessions.push(session('push', '2026-09-28T08:00:00', {}))
    expect(nextDayId(s.days, s.sessions)).toBe('pull')
    s.sessions.push(session('legs', '2026-09-30T08:00:00', {}))
    expect(nextDayId(s.days, s.sessions)).toBe('push')
  })
})

describe('progressi', () => {
  it('carico, volume e ripetizioni per sessione', () => {
    const s = base()
    s.sessions.push(session('push', '2026-09-28T08:00:00', { 'chest-press': [[50, 6], [45, 8]] }))
    expect(progressSeries(s.sessions, 'chest-press', 'carico').map((p) => p.value)).toEqual([45, 50])
    expect(progressSeries(s.sessions, 'chest-press', 'volume').map((p) => p.value)).toEqual([660])
    expect(progressSeries(s.sessions, 'chest-press', 'ripetizioni').map((p) => p.value)).toEqual([14])
  })
})

describe('formati e backup', () => {
  it('legge i numeri con la virgola', () => {
    expect(parseNum('47,5')).toBe(47.5)
    expect(parseNum('')).toBeNull()
    expect(parseNum('abc')).toBeNull()
  })

  it('descrive le serie e le date', () => {
    expect(fmtSets([[{ w: 45, r: 6 }], [{ w: 40, r: null }]])).toBe('45×6  ·  40 kg')
    expect(relDay('2026-09-25T20:00:00', new Date('2026-09-26T08:00:00'))).toBe('ieri')
  })

  it('esporta la scheda nel formato delle note', () => {
    const s = base()
    const text = planAsText(s.days, s.sessions)
    expect(text).toContain('Giorno 1, Push\nChest press 45kg 40kg 40kg')
    expect(text).toContain('Superset croci ai cavi 27kg - 14kg')
  })

  it('rifiuta un file che non e un backup', () => {
    expect(normalizeState({ foo: 1 })).toBeNull()
    expect(normalizeState(base())).not.toBeNull()
  })
})

describe('icone', () => {
  it('ogni esercizio della scheda ha la sua icona', () => {
    const icons = Object.fromEntries(base().days.flatMap((d) => d.exercises).map((ex) => [ex.id, iconFor(ex)]))
    expect(icons).toEqual({
      'chest-press': 'chest-press',
      'spinte-inclinata': 'panca-inclinata',
      'croci-cavi': 'croci',
      'lento-avanti': 'lento',
      'alzate-laterali': 'alzate',
      'french-press': 'corda',
      'push-down': 'pushdown',
      trazioni: 'trazioni',
      rematore: 'rematore',
      'lat-machine': 'lat',
      'pulldown-facepull': 'face-pull',
      'panca-scott': 'scott',
      'hammer-curl': 'curl',
      'hack-squat': 'squat',
      'leg-extension': 'leg-extension',
      'leg-press': 'leg-press',
      'leg-curl': 'leg-curl',
      polpacci: 'polpacci',
    })
  })

  it('usa l icona scelta, e il manubrio se non riconosce il nome', () => {
    expect(iconFor({ name: 'Chest press', icon: 'squat' })).toBe('squat')
    expect(iconFor({ name: 'Chest press', icon: 'inesistente' })).toBe('chest-press')
    expect(guessIcon('Esercizio misterioso')).toBe('manubrio')
  })
})

describe('catalogo', () => {
  it('ogni esercizio ha un id unico e un icona esistente', async () => {
    const { CATALOG } = await import('./catalog')
    const { ICONS } = await import('./icons')
    expect(new Set(CATALOG.map((c) => c.id)).size).toBe(CATALOG.length)
    expect(CATALOG.filter((c) => !(c.icon in ICONS))).toEqual([])
  })

  it('lo stesso esercizio due volte ha due id diversi', async () => {
    const { catalogById, fromCatalog } = await import('./catalog')
    const used = new Set<string>()
    const a = fromCatalog(catalogById('squat')!, used)
    const b = fromCatalog(catalogById('squat')!, used)
    expect(a.id).toBe('squat')
    expect(b.id).not.toBe('squat')
    expect(b.id.startsWith('squat-')).toBe(true)
  })

  it('consiglia i muscoli giusti per Push, Pull e Legs', async () => {
    const { suggestedGroups } = await import('./catalog')
    expect(suggestedGroups('Push')).toContain('petto')
    expect(suggestedGroups('Pull')).toContain('schiena')
    expect(suggestedGroups('Legs')).toContain('gambe')
    expect(suggestedGroups('Giorno A')).toEqual([])
  })
})
